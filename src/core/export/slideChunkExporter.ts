import { slideRegistry } from "../slides/registry";
import type { CanvasDimensions, SlideData } from "../slides/types";

export interface SlideChunkResult {
	filePath: string;
	durationSec: number;
	isTemp?: boolean;
}

export interface SlideChunkExportOptions {
	slide: SlideData;
	canvas: CanvasDimensions;
	onProgress?: (progressPercent: number) => void;
}

/**
 * Checks if the WebCodecs VideoEncoder API is available in the current environment.
 */
export function isWebCodecsSupported(): boolean {
	return (
		typeof window !== "undefined" &&
		typeof VideoEncoder !== "undefined" &&
		typeof VideoEncoder.isConfigSupported === "function"
	);
}

/**
 * Exports a single slide as a standalone video chunk (MP4) ready for the global stitcher.
 * 
 * Strategy:
 * 1. If module provides `exportChunk`, delegates to it.
 * 2. If module provides `renderFrame` and WebCodecs is supported, renders frames sequentially.
 * 3. Fallbacks to raw media path defined in slide metadata (videoPath / track clips).
 */
export async function exportSlideChunk(
	options: SlideChunkExportOptions,
): Promise<SlideChunkResult> {
	const { slide, canvas, onProgress } = options;
	const durationSec = Math.max(0.5, (slide.durationMs || 1000) / 1000);

	let module = null;
	try {
		module = slideRegistry.get(slide.type);
	} catch {
		// Module may not be registered yet or test environment
	}

	// 1. Delegated exportChunk from module
	if (module?.exportChunk) {
		const chunk = await module.exportChunk(slide, {
			width: canvas.width,
			height: canvas.height,
			fps: canvas.fps,
			onProgress,
		});
		return {
			filePath: chunk.filePath,
			durationSec: chunk.durationSec || durationSec,
		};
	}

	// 2. WebCodecs Frame-by-frame rendering if renderFrame is available
	if (module?.renderFrame && isWebCodecsSupported() && typeof OffscreenCanvas !== "undefined") {
		try {
			const renderedChunk = await renderFramesWithWebCodecs(slide, module.renderFrame, canvas, onProgress);
			if (renderedChunk) {
				return renderedChunk;
			}
		} catch (err) {
			console.warn(`[slideChunkExporter] WebCodecs render failed for slide ${slide.id}, falling back:`, err);
		}
	}

	// 3. Metadata video source fallback
	const meta = (slide.meta || {}) as Record<string, unknown>;
	let sourcePath = (meta.videoPath as string) || "";

	if (!sourcePath && Array.isArray(meta.videoTracks)) {
		const tracks = meta.videoTracks as Array<{ clips?: Array<{ sourcePath: string }> }>;
		sourcePath = tracks[0]?.clips?.[0]?.sourcePath || "";
	}

	onProgress?.(100);

	return {
		filePath: sourcePath,
		durationSec,
	};
}

/**
 * Sequential frame renderer using WebCodecs VideoEncoder & OffscreenCanvas.
 */
async function renderFramesWithWebCodecs(
	slide: SlideData,
	renderFrame: (slide: SlideData, timeMs: number, canvas: OffscreenCanvas) => Promise<void>,
	canvasDim: CanvasDimensions,
	onProgress?: (progressPercent: number) => void,
): Promise<SlideChunkResult | null> {
	const durationSec = Math.max(0.5, (slide.durationMs || 1000) / 1000);
	const fps = canvasDim.fps || 30;
	const totalFrames = Math.round(durationSec * fps);
	const offscreen = new OffscreenCanvas(canvasDim.width, canvasDim.height);

	// Test if electron export stream is available to write temp file
	if (!window.electronAPI?.openExportStream || !window.electronAPI?.writeExportStreamChunk || !window.electronAPI?.closeExportStream) {
		return null;
	}

	const streamResult = await window.electronAPI.openExportStream({ extension: "mp4" });
	if (!streamResult.success || !streamResult.streamId || !streamResult.tempPath) {
		return null;
	}

	const streamId = streamResult.streamId;
	const tempPath = streamResult.tempPath;

	return new Promise<SlideChunkResult | null>((resolve, reject) => {
		let encodedFrames = 0;

		const encoder = new VideoEncoder({
			output: (chunk) => {
				const buffer = new Uint8Array(chunk.byteLength);
				chunk.copyTo(buffer);
				window.electronAPI?.writeExportStreamChunk(streamId, 0, buffer).catch(console.error);
			},
			error: (e) => {
				console.error("[slideChunkExporter] VideoEncoder error:", e);
				window.electronAPI?.closeExportStream(streamId, { abort: true });
				reject(e);
			},
		});

		encoder.configure({
			codec: "avc1.42001f",
			width: canvasDim.width,
			height: canvasDim.height,
			bitrate: 4_000_000,
			framerate: fps,
		});

		(async () => {
			for (let i = 0; i < totalFrames; i++) {
				const timeMs = (i / fps) * 1000;
				await renderFrame(slide, timeMs, offscreen);

				const bitmap = offscreen.transferToImageBitmap();
				const videoFrame = new VideoFrame(bitmap, {
					timestamp: Math.round((i / fps) * 1_000_000), // microseconds
				});

				encoder.encode(videoFrame, { keyFrame: i % (fps * 2) === 0 });
				videoFrame.close();
				bitmap.close();

				encodedFrames++;
				if (onProgress) {
					onProgress(Math.round((encodedFrames / totalFrames) * 100));
				}
			}

			await encoder.flush();
			encoder.close();

			await window.electronAPI!.closeExportStream(streamId);
			resolve({
				filePath: tempPath,
				durationSec,
				isTemp: true,
			});
		})().catch(async (err) => {
			await window.electronAPI?.closeExportStream(streamId, { abort: true });
			reject(err);
		});
	});
}
