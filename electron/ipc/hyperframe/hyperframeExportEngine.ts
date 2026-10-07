import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { app, BrowserWindow } from "electron";
import { getFfmpegBinaryPath } from "../ffmpeg/binary";
import { resolveNativeVideoEncoder } from "../export/native-video";
import type { NativeExportEncodingMode } from "../nativeVideoExport";

export interface HyperframeExportOptions {
	sessionId?: string;
	htmlContent: string;
	width: number;
	height: number;
	fps: number;
	durationSec: number;
	bitrate?: number;
	encodingMode?: NativeExportEncodingMode;
	audioSourcePath?: string | null;
	outputPath: string;
	onProgress?: (progress: HyperframeExportProgress) => void;
	isCancelled?: () => boolean;
}

export interface HyperframeExportProgress {
	sessionId?: string;
	currentFrame: number;
	totalFrames: number;
	percentage: number;
	stage?: "preparing" | "rendering" | "muxing" | "completed";
}

export interface HyperframeExportResult {
	success: boolean;
	outputPath?: string;
	error?: string;
	totalFrames?: number;
	durationSec?: number;
}

export function calculateHyperframeCount(durationSec: number, fps: number): number {
	if (!Number.isFinite(durationSec) || durationSec <= 0) {
		return 1;
	}
	const safeFps = Math.max(1, Math.min(120, fps || 60));
	return Math.max(1, Math.round(durationSec * safeFps));
}

export function buildHyperframeFfmpegExportArgs(options: {
	width: number;
	height: number;
	fps: number;
	bitrate: number;
	encoder: string;
	outputPath: string;
	encodingMode?: NativeExportEncodingMode;
}): string[] {
	const { width, height, fps, bitrate, encoder, outputPath, encodingMode = "balanced" } = options;

	const args = [
		"-y",
		"-hide_banner",
		"-loglevel",
		"error",
		"-f",
		"rawvideo",
		"-pix_fmt",
		"bgra",
		"-s:v",
		`${width}x${height}`,
		"-framerate",
		String(fps),
		"-i",
		"pipe:0",
		"-an",
		"-c:v",
		encoder,
		"-g",
		String(Math.max(1, Math.round(fps * 2))),
		"-b:v",
		`${Math.round(bitrate / 1000)}k`,
		"-maxrate",
		`${Math.round((bitrate / 1000) * 1.5)}k`,
		"-bufsize",
		`${Math.round((bitrate / 1000) * 2)}k`,
	];

	if (encoder.includes("nvenc")) {
		const preset = encodingMode === "quality" ? "p4" : encodingMode === "fast" ? "p1" : "p2";
		args.push("-preset", preset, "-tune", "ll");
	} else if (encoder.includes("qsv")) {
		const preset = encodingMode === "quality" ? "medium" : encodingMode === "fast" ? "veryfast" : "faster";
		args.push("-preset", preset);
	} else if (encoder.includes("videotoolbox")) {
		args.push("-realtime", "0");
	} else if (encoder === "libx264") {
		const preset = encodingMode === "quality" ? "slow" : encodingMode === "fast" ? "ultrafast" : "medium";
		args.push("-preset", preset);
	}

	args.push("-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath);

	return args;
}

export function buildHyperframeAudioMuxArgs(options: {
	videoPath: string;
	audioPath: string;
	outputPath: string;
}): string[] {
	return [
		"-y",
		"-hide_banner",
		"-loglevel",
		"error",
		"-i",
		options.videoPath,
		"-i",
		options.audioPath,
		"-c:v",
		"copy",
		"-c:a",
		"aac",
		"-b:a",
		"192k",
		"-shortest",
		"-movflags",
		"+faststart",
		options.outputPath,
	];
}

/**
 * Executes full offscreen rendering of a Hyperframe composition to an MP4 video.
 */
export async function renderHyperframeToMp4(
	options: HyperframeExportOptions,
): Promise<HyperframeExportResult> {
	const {
		sessionId = `hf-export-${Date.now()}`,
		htmlContent,
		width,
		height,
		fps = 60,
		durationSec,
		bitrate = 12_000_000,
		encodingMode = "balanced",
		audioSourcePath,
		outputPath,
		onProgress,
		isCancelled,
	} = options;

	const totalFrames = calculateHyperframeCount(durationSec, fps);
	const tempDir = app.getPath("temp");
	const tempHtmlPath = path.join(tempDir, `${sessionId}-stage.html`);
	const tempVideoPath = path.join(tempDir, `${sessionId}-raw.mp4`);

	let win: BrowserWindow | null = null;
	let ffmpegProc: ReturnType<typeof spawn> | null = null;

	onProgress?.({
		sessionId,
		currentFrame: 0,
		totalFrames,
		percentage: 0,
		stage: "preparing",
	});

	try {
		// 1. Prepare HTML file
		await fs.writeFile(tempHtmlPath, htmlContent, "utf-8");

		if (isCancelled?.()) {
			throw new Error("Export cancelled by user");
		}

		// 2. Initialize offscreen rendering window
		win = new BrowserWindow({
			width,
			height,
			show: false,
			frame: false,
			transparent: false,
			backgroundColor: "#000000",
			webPreferences: {
				offscreen: true,
				backgroundThrottling: false,
				nodeIntegration: false,
				contextIsolation: true,
			},
		});

		// 3. Load HTML composition
		await win.loadFile(tempHtmlPath);
		await new Promise((resolve) => setTimeout(resolve, 600));

		// Ensure fonts and initial layout are ready
		try {
			await win.webContents.executeJavaScript("document.fonts.ready");
		} catch {}

		// Seek to frame 0
		try {
			await win.webContents.executeJavaScript(
				"if (typeof window.seekFrame === 'function') window.seekFrame(0, false, true, 0);",
			);
		} catch {}

		if (isCancelled?.()) {
			throw new Error("Export cancelled by user");
		}

		// 4. Resolve FFmpeg & Encoder
		const ffmpegPath = getFfmpegBinaryPath();
		const encoder = await resolveNativeVideoEncoder(ffmpegPath, encodingMode);

		const intermediateVideoPath = audioSourcePath ? tempVideoPath : outputPath;
		const ffmpegArgs = buildHyperframeFfmpegExportArgs({
			width,
			height,
			fps,
			bitrate,
			encoder,
			outputPath: intermediateVideoPath,
			encodingMode,
		});

		// 5. Spawn FFmpeg process
		ffmpegProc = spawn(ffmpegPath, ffmpegArgs, {
			stdio: ["pipe", "ignore", "pipe"],
		});

		let ffmpegStderr = "";
		ffmpegProc.stderr?.on("data", (chunk: Buffer) => {
			ffmpegStderr += chunk.toString();
		});

		const ffmpegCompletion = new Promise<void>((resolve, reject) => {
			ffmpegProc?.once("error", reject);
			ffmpegProc?.once("close", (code, signal) => {
				if (code === 0) resolve();
				else {
					reject(
						new Error(
							`FFmpeg export failed with code ${code}${signal ? ` (${signal})` : ""}: ${ffmpegStderr.slice(-400)}`,
						),
					);
				}
			});
		});

		// 6. Frame capture loop
		for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
			if (isCancelled?.()) {
				throw new Error("Export cancelled by user");
			}

			const timeSec = frameIndex / fps;

			// Step timeline & media
			try {
				await win.webContents.executeJavaScript(
					`if (typeof window.seekFrame === 'function') window.seekFrame(${timeSec}, false, true, 0);`,
				);
			} catch {}

			// Wait for video seeks to complete if video elements exist
			try {
				await win.webContents.executeJavaScript(
					`new Promise((resolve) => {
						const vids = Array.from(document.querySelectorAll('video'));
						const seeking = vids.filter(v => v.seeking);
						if (seeking.length === 0) return resolve();
						let left = seeking.length;
						seeking.forEach(v => {
							const done = () => {
								v.removeEventListener('seeked', done);
								if (--left === 0) resolve();
							};
							v.addEventListener('seeked', done);
						});
						setTimeout(resolve, 150);
					});`,
				);
			} catch {}

			// Capture exact frame
			const image = await win.webContents.capturePage({
				x: 0,
				y: 0,
				width,
				height,
			});

			const bitmap = image.getBitmap();

			// Write raw frame into FFmpeg stdin with backpressure support
			if (ffmpegProc.stdin && !ffmpegProc.stdin.destroyed) {
				const canAcceptMore = ffmpegProc.stdin.write(bitmap);
				if (!canAcceptMore) {
					await new Promise((resolve) => ffmpegProc?.stdin?.once("drain", resolve));
				}
			}

			// Report progress
			onProgress?.({
				sessionId,
				currentFrame: frameIndex + 1,
				totalFrames,
				percentage: Math.round(((frameIndex + 1) / totalFrames) * 100),
				stage: "rendering",
			});
		}

		// Close stdin and wait for FFmpeg to finish encoding video
		if (ffmpegProc.stdin && !ffmpegProc.stdin.destroyed) {
			ffmpegProc.stdin.end();
		}
		await ffmpegCompletion;

		// 7. Mux Audio if provided
		if (audioSourcePath) {
			onProgress?.({
				sessionId,
				currentFrame: totalFrames,
				totalFrames,
				percentage: 99,
				stage: "muxing",
			});

			const muxArgs = buildHyperframeAudioMuxArgs({
				videoPath: intermediateVideoPath,
				audioPath: audioSourcePath,
				outputPath,
			});

			await new Promise<void>((resolve, reject) => {
				const muxProc = spawn(ffmpegPath, muxArgs, {
					stdio: ["ignore", "ignore", "pipe"],
				});
				let muxErr = "";
				muxProc.stderr?.on("data", (chunk: Buffer) => {
					muxErr += chunk.toString();
				});
				muxProc.once("close", (code) => {
					if (code === 0) resolve();
					else reject(new Error(`Audio muxing failed (code ${code}): ${muxErr.slice(-300)}`));
				});
				muxProc.once("error", reject);
			});

			// Cleanup intermediate video
			try {
				await fs.unlink(intermediateVideoPath);
			} catch {}
		}

		onProgress?.({
			sessionId,
			currentFrame: totalFrames,
			totalFrames,
			percentage: 100,
			stage: "completed",
		});

		return {
			success: true,
			outputPath,
			totalFrames,
			durationSec,
		};
	} catch (error) {
		if (ffmpegProc && !ffmpegProc.killed) {
			try {
				ffmpegProc.kill("SIGKILL");
			} catch {}
		}
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		};
	} finally {
		if (win && !win.isDestroyed()) {
			win.destroy();
		}
		try {
			await fs.unlink(tempHtmlPath);
		} catch {}
	}
}
