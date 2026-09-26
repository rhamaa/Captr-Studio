import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { getFfmpegBinaryPath } from "../ffmpeg/binary";
import { probeNativeVideoMetadata } from "./native-video";

export interface SlideStitchInput {
	filePath: string;
	durationSec: number;
}

export interface TransitionStitchConfig {
	type:
		| "none"
		| "crossfade"
		| "fade-black"
		| "wipe-left"
		| "wipe-right"
		| "slide-left"
		| "slide-right";
	durationSec: number;
}

export interface GlobalAudioConfig {
	path: string;
	volume?: number;
	loop?: boolean;
}

export interface BuildStitchFiltergraphOptions {
	normalize?: boolean;
	targetWidth?: number;
	targetHeight?: number;
	targetFps?: number;
	hasAudioPerSlide?: boolean[];
}

export interface StitchProjectOptions {
	slides: SlideStitchInput[];
	transitions?: TransitionStitchConfig[];
	globalAudio?: GlobalAudioConfig;
	outputPath: string;
	onProgress?: (progressPercent: number) => void;
}

/**
 * Maps application transition types to FFmpeg xfade transition names.
 */
export function mapToFfmpegXfadeType(type: TransitionStitchConfig["type"]): string {
	switch (type) {
		case "crossfade":
			return "fade";
		case "fade-black":
			return "fadeblack";
		case "wipe-left":
			return "wipeleft";
		case "wipe-right":
			return "wiperight";
		case "slide-left":
			return "slideleft";
		case "slide-right":
			return "slideright";
		default:
			return "fade";
	}
}

/**
 * Builds the complex filtergraph string to chain multiple video inputs with xfade and acrossfade.
 */
export function buildStitchFiltergraph(
	slides: SlideStitchInput[],
	transitions: TransitionStitchConfig[],
	options?: BuildStitchFiltergraphOptions,
): { filtergraph: string; lastVideoLabel: string; lastAudioLabel: string } {
	if (slides.length <= 1) {
		return {
			filtergraph: "",
			lastVideoLabel: "0:v",
			lastAudioLabel: "0:a",
		};
	}

	const filterParts: string[] = [];
	const normalize = options?.normalize ?? false;
	const targetWidth = options?.targetWidth ?? 1920;
	const targetHeight = options?.targetHeight ?? 1080;
	const targetFps = options?.targetFps ?? 60;
	const hasAudioPerSlide = options?.hasAudioPerSlide ?? [];

	if (normalize) {
		for (let i = 0; i < slides.length; i++) {
			filterParts.push(
				`[${i}:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${targetFps}[nv_${i}]`,
			);
			if (hasAudioPerSlide[i] !== false) {
				filterParts.push(
					`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo[na_${i}]`,
				);
			} else {
				const dur = slides[i].durationSec || 5;
				filterParts.push(`aevalsrc=0:d=${dur.toFixed(3)}:s=48000:c=stereo[na_${i}]`);
			}
		}
	}

	let currentVideoLabel = normalize ? "nv_0" : "0:v";
	let currentAudioLabel = normalize ? "na_0" : "0:a";
	let currentTotalDurationSec = slides[0].durationSec;

	for (let i = 1; i < slides.length; i++) {
		const nextVideoInput = normalize ? `nv_${i}` : `${i}:v`;
		const nextAudioInput = normalize ? `na_${i}` : `${i}:a`;
		const nextVideoLabel = `v_out_${i}`;
		const nextAudioLabel = `a_out_${i}`;

		const trans = transitions[i - 1] ?? { type: "crossfade", durationSec: 0.5 };
		const transDuration = trans.type === "none" ? 0 : Math.min(trans.durationSec, 2.0);
		const xfadeName = mapToFfmpegXfadeType(trans.type);

		// Calculate xfade offset: cumulative duration minus transition duration
		const offsetSec = Math.max(0, currentTotalDurationSec - transDuration);

		if (transDuration > 0) {
			filterParts.push(
				`[${currentVideoLabel}][${nextVideoInput}]xfade=transition=${xfadeName}:duration=${transDuration.toFixed(
					3,
				)}:offset=${offsetSec.toFixed(3)}[${nextVideoLabel}]`,
			);
			filterParts.push(
				`[${currentAudioLabel}][${nextAudioInput}]acrossfade=d=${transDuration.toFixed(
					3,
				)}[${nextAudioLabel}]`,
			);
			currentTotalDurationSec = offsetSec + slides[i].durationSec;
		} else {
			// Hard concat without transition
			filterParts.push(
				`[${currentVideoLabel}][${currentAudioLabel}][${nextVideoInput}][${nextAudioInput}]concat=n=2:v=1:a=1[${nextVideoLabel}][${nextAudioLabel}]`,
			);
			currentTotalDurationSec += slides[i].durationSec;
		}

		currentVideoLabel = nextVideoLabel;
		currentAudioLabel = nextAudioLabel;
	}

	return {
		filtergraph: filterParts.join(";"),
		lastVideoLabel: currentVideoLabel,
		lastAudioLabel: currentAudioLabel,
	};
}

/**
 * Stitches multiple slide videos and their transitions into a single output video via FFmpeg.
 */
export async function stitchSlidesWithTransitions(
	options: StitchProjectOptions,
): Promise<{ success: boolean; outputPath?: string; error?: string }> {
	const { slides, transitions = [], globalAudio, outputPath } = options;

	if (!slides || slides.length === 0) {
		return { success: false, error: "No slides provided to stitch" };
	}

	// Single slide fast-path: simply copy or remux if no global audio
	if (slides.length === 1 && !globalAudio) {
		try {
			await fs.copyFile(slides[0].filePath, outputPath);
			return { success: true, outputPath };
		} catch (copyErr) {
			return { success: false, error: String(copyErr) };
		}
	}

	const ffmpegPath = getFfmpegBinaryPath();

	// Probe all slide inputs to check audio presence and dimensions
	const probes = await Promise.all(
		slides.map((s) => probeNativeVideoMetadata(ffmpegPath, s.filePath).catch(() => null)),
	);
	const firstValid = probes.find(Boolean);
	const targetWidth = firstValid?.width ?? 1920;
	const targetHeight = firstValid?.height ?? 1080;
	const targetFps = firstValid?.frameRate ?? 60;
	// Resolve audio presence per input. A failed probe must NOT be treated as
	// "has audio": the filtergraph would reference a stream that does not exist
	// and the whole stitch aborts. Confirm with a direct stream check, and only
	// fall back to a silent placeholder when that fails too.
	const hasAudioPerSlide = await Promise.all(
		slides.map(async (slide, index) => {
			const probe = probes[index];
			if (typeof probe?.hasAudio === "boolean") return probe.hasAudio;
			try {
				// Loaded lazily: the diagnostics module pulls app-scoped paths that
				// must not be evaluated when this file is imported in tests.
				const { hasEmbeddedAudioStream } = await import("../recording/diagnostics");
				return await hasEmbeddedAudioStream(slide.filePath);
			} catch {
				return false;
			}
		}),
	);

	const args: string[] = ["-y"];

	// 1. Add all slide inputs
	for (const slide of slides) {
		args.push("-i", slide.filePath);
	}

	// 2. Add global audio input if present
	let globalAudioIndex = -1;
	if (globalAudio?.path) {
		globalAudioIndex = slides.length;
		args.push("-i", globalAudio.path);
	}

	// 3. Build filtergraph
	const { filtergraph, lastVideoLabel, lastAudioLabel } = buildStitchFiltergraph(
		slides,
		transitions,
		{
			normalize: true,
			targetWidth,
			targetHeight,
			targetFps,
			hasAudioPerSlide,
		},
	);

	let finalVideo = lastVideoLabel;
	let finalAudio = lastAudioLabel;

	let fullFiltergraph = filtergraph;

	if (globalAudioIndex >= 0 && globalAudio) {
		const bgmVol = globalAudio.volume ?? 0.3;
		const mixFilter = `[${globalAudioIndex}:a]volume=${bgmVol.toFixed(2)}[bgm];[${lastAudioLabel}][bgm]amix=inputs=2:duration=first[a_final]`;
		fullFiltergraph = fullFiltergraph ? `${fullFiltergraph};${mixFilter}` : mixFilter;
		finalAudio = "a_final";
	}

	if (fullFiltergraph) {
		args.push("-filter_complex", fullFiltergraph);
		args.push("-map", `[${finalVideo}]`);
		args.push("-map", `[${finalAudio}]`);
	} else {
		args.push("-map", "0:v");
		args.push("-map", "0:a");
	}

	// Codec settings for final container
	args.push(
		"-c:v",
		"libx264",
		"-preset",
		"fast",
		"-crf",
		"20",
		"-c:a",
		"aac",
		"-b:a",
		"192k",
		"-ar",
		"48000",
		"-movflags",
		"+faststart",
		outputPath,
	);

	return new Promise((resolve) => {
		const child = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
		let stderrLog = "";

		child.stderr.on("data", (chunk) => {
			stderrLog += chunk.toString();
		});

		child.on("close", (code) => {
			if (code === 0) {
				resolve({ success: true, outputPath });
			} else {
				console.error("[globalStitcher] FFmpeg stitch failed:", stderrLog);
				resolve({
					success: false,
					error: `FFmpeg process exited with code ${code}: ${stderrLog.slice(-500)}`,
				});
			}
		});

		child.on("error", (err) => {
			resolve({ success: false, error: String(err) });
		});
	});
}
