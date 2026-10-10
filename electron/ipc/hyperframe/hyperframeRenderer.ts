import { spawn } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import type { BRollRenderResult, BRollSpec } from "../../../src/core/timeline/brollTypes";
import { getFfmpegBinaryPath } from "../ffmpeg/binary";

export interface CanvasDimensions {
	width: number;
	height: number;
	fps: number;
}

/**
 * Returns a reliable system font file path for FFmpeg drawtext.
 */
export function getDefaultFontFile(): string | null {
	if (process.platform === "win32") {
		const winFonts = [
			"C:\\Windows\\Fonts\\segoeui.ttf",
			"C:\\Windows\\Fonts\\arial.ttf",
			"C:\\Windows\\Fonts\\calibri.ttf",
		];
		for (const f of winFonts) {
			if (fs.existsSync(f)) return f;
		}
	} else if (process.platform === "darwin") {
		const macFonts = [
			"/System/Library/Fonts/SFNS.ttf",
			"/System/Library/Fonts/Helvetica.ttc",
			"/Library/Fonts/Arial.ttf",
		];
		for (const f of macFonts) {
			if (fs.existsSync(f)) return f;
		}
	} else {
		const linuxFonts = [
			"/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
			"/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
		];
		for (const f of linuxFonts) {
			if (fs.existsSync(f)) return f;
		}
	}
	return null;
}

/**
 * Escapes characters for FFmpeg drawtext filter syntax.
 */
export function escapeDrawtext(text: string): string {
	return text
		.replace(/\\/g, "\\\\")
		.replace(/'/g, "\\'")
		.replace(/:/g, "\\:")
		.replace(/%/g, "\\%");
}

/**
 * Formats a font file path safely for FFmpeg filter parameter (replacing backslashes on Windows).
 */
export function formatFontFileForFfmpeg(filePath: string): string {
	if (process.platform === "win32") {
		return filePath.replace(/\\/g, "/").replace(/:/g, "\\:");
	}
	return filePath;
}

/**
 * Builds the FFmpeg filter graph for the given BRoll specification.
 */
export function buildFfmpegFilterForSpec(
	spec: BRollSpec,
	_canvas: CanvasDimensions,
	fontPath: string | null,
): string {
	const fontArg = fontPath ? `fontfile='${formatFontFileForFfmpeg(fontPath)}':` : "";
	const titleText = escapeDrawtext(spec.title);
	const subtitleText = escapeDrawtext(spec.subtitle || "");

	const titleColor = spec.theme === "light_clean" ? "0x0f172a" : "white";
	const subtitleColor = spec.theme === "light_clean" ? "0x475569" : "0x94a3b8";
	const accentColor = spec.accentColor || (spec.theme === "neon_gradient" ? "0xa855f7" : "0x38bdf8");

	const filters: string[] = [];

	if (spec.type === "kinetic_typography") {
		// Big bold title + subtitle with fade-in and smooth slide
		filters.push(
			`drawtext=${fontArg}text='${titleText}':fontcolor=${titleColor}:fontsize=56:x=(w-text_w)/2:y=(h-text_h)/2-40:alpha='min(1,t*2)'`,
		);
		if (subtitleText) {
			filters.push(
				`drawtext=${fontArg}text='${subtitleText}':fontcolor=${accentColor}:fontsize=32:x=(w-text_w)/2:y=(h-text_h)/2+40:alpha='min(1,max(0,(t-0.3)*2))'`,
			);
		}
	} else if (spec.type === "stat_counter") {
		// Large metric number with supporting caption
		filters.push(
			`drawtext=${fontArg}text='${titleText}':fontcolor=${accentColor}:fontsize=80:x=(w-text_w)/2:y=(h-text_h)/2-50:alpha='min(1,t*3)'`,
		);
		if (subtitleText) {
			filters.push(
				`drawtext=${fontArg}text='${subtitleText}':fontcolor=${titleColor}:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2+60`,
			);
		}
	} else if (spec.type === "code_snippet") {
		// Code window style with monospace header
		filters.push(
			`drawtext=${fontArg}text='● ● ●  ${titleText}':fontcolor=${accentColor}:fontsize=26:x=(w-text_w)/2:y=(h-text_h)/2-60`,
		);
		if (subtitleText) {
			filters.push(
				`drawtext=${fontArg}text='${subtitleText}':fontcolor=${titleColor}:fontsize=30:x=(w-text_w)/2:y=(h-text_h)/2+20`,
			);
		}
	} else {
		// Default title_card / callout_card
		filters.push(
			`drawtext=${fontArg}text='${titleText}':fontcolor=${titleColor}:fontsize=50:x=(w-text_w)/2:y=(h-text_h)/2-30:alpha='min(1,t*2)'`,
		);
		if (subtitleText) {
			filters.push(
				`drawtext=${fontArg}text='${subtitleText}':fontcolor=${subtitleColor}:fontsize=26:x=(w-text_w)/2:y=(h-text_h)/2+40:alpha='min(1,t*2)'`,
			);
		}
	}

	return filters.join(",");
}

/**
 * Renders a programmatic Hyperframe B-Roll animation to an MP4 video file.
 */
export async function renderHyperframeBRoll(
	spec: BRollSpec,
	outputDir: string,
	canvas: CanvasDimensions,
	relativePrefix = `assets`,
): Promise<BRollRenderResult> {
	await fsPromises.mkdir(outputDir, { recursive: true });

	const assetId = `broll-${spec.id}`;
	const outputFileName = "source.mp4";
	const absolutePath = path.join(outputDir, outputFileName);
	const relativePath = `${relativePrefix}/${assetId}/${outputFileName}`;

	const durationSec = Math.max(0.5, spec.durationUs / 1_000_000);
	const fontPath = getDefaultFontFile();

	const themeBg =
		spec.theme === "light_clean"
			? "0xf8fafc"
			: spec.theme === "neon_gradient"
				? "0x1e1b4b"
				: "0x09090b";

	const filterGraph = buildFfmpegFilterForSpec(spec, canvas, fontPath);

	const ffmpegBin = getFfmpegBinaryPath();
	const args = [
		"-f",
		"lavfi",
		"-i",
		`color=c=${themeBg}:s=${canvas.width}x${canvas.height}:d=${durationSec}:r=${canvas.fps}`,
		"-vf",
		filterGraph,
		"-c:v",
		"libx264",
		"-pix_fmt",
		"yuv420p",
		"-preset",
		"ultrafast",
		absolutePath,
		"-y",
	];

	return new Promise((resolve) => {
		const proc = spawn(ffmpegBin, args, {
			windowsHide: true,
		});

		let stderr = "";
		proc.stderr?.on("data", (d: Buffer) => {
			stderr += d.toString();
		});

		const timeout = setTimeout(() => {
			proc.kill();
			resolve({
				specId: spec.id,
				assetId,
				name: `Hyperframe: ${spec.title}`,
				relativePath,
				absolutePath,
				timelineStartUs: spec.timelineStartUs,
				durationUs: spec.durationUs,
				width: canvas.width,
				height: canvas.height,
				success: false,
				error: "Rendering timed out after 30 seconds.",
			});
		}, 30_000);

		proc.on("close", async (code) => {
			clearTimeout(timeout);
			if (code === 0 && fs.existsSync(absolutePath)) {
				// Write metadata sidecar
				await fsPromises
					.writeFile(
						path.join(outputDir, "broll_meta.json"),
						JSON.stringify(spec, null, 2),
						"utf-8",
					)
					.catch(() => undefined);

				resolve({
					specId: spec.id,
					assetId,
					name: `Hyperframe: ${spec.title}`,
					relativePath,
					absolutePath,
					timelineStartUs: spec.timelineStartUs,
					durationUs: spec.durationUs,
					width: canvas.width,
					height: canvas.height,
					success: true,
				});
			} else {
				resolve({
					specId: spec.id,
					assetId,
					name: `Hyperframe: ${spec.title}`,
					relativePath,
					absolutePath,
					timelineStartUs: spec.timelineStartUs,
					durationUs: spec.durationUs,
					width: canvas.width,
					height: canvas.height,
					success: false,
					error: `FFmpeg failed with code ${code}: ${stderr.slice(-200)}`,
				});
			}
		});

		proc.on("error", (err) => {
			clearTimeout(timeout);
			resolve({
				specId: spec.id,
				assetId,
				name: `Hyperframe: ${spec.title}`,
				relativePath,
				absolutePath,
				timelineStartUs: spec.timelineStartUs,
				durationUs: spec.durationUs,
				width: canvas.width,
				height: canvas.height,
				success: false,
				error: err.message,
			});
		});
	});
}
