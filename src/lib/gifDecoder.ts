// Uses gifuct-js to decode GIF into frames for frame-accurate export rendering
import { decompressFrames, parseGIF } from "gifuct-js";

export interface GifFrame {
	imageData: ImageData;
	delay: number; // ms
	disposalType: number;
}

export interface DecodedGif {
	frames: GifFrame[];
	totalDuration: number; // ms
	width: number;
	height: number;
}

const gifCache = new Map<string, DecodedGif>();

export async function decodeGif(dataUrl: string): Promise<DecodedGif | null> {
	const cached = gifCache.get(dataUrl);
	if (cached) return cached;

	try {
		// Convert data URL to ArrayBuffer
		const response = await fetch(dataUrl);
		const arrayBuffer = await response.arrayBuffer();
		const gif = parseGIF(arrayBuffer);
		const rawFrames = decompressFrames(gif, true);

		if (rawFrames.length === 0) return null;

		const width = gif.lsd.width;
		const height = gif.lsd.height;
		const frames: GifFrame[] = [];
		let totalDuration = 0;

		// Composited canvas for proper disposal mode rendering
		const canvas = new OffscreenCanvas(width, height);
		const ctx = canvas.getContext("2d")!;
		let prevFrameData: ImageData | null = null;

		for (const rawFrame of rawFrames) {
			const delay = rawFrame.delay > 0 ? rawFrame.delay * 10 : 100; // gifuct returns delay in 1/100s → convert to ms

			// Handle disposal types
			if (rawFrame.disposalType === 2) {
				// Restore to background
				ctx.clearRect(0, 0, width, height);
			} else if (rawFrame.disposalType === 3 && prevFrameData) {
				ctx.putImageData(prevFrameData, 0, 0);
			}

			prevFrameData = ctx.getImageData(0, 0, width, height);

			// Draw current frame pixels
			const frameCanvas = new OffscreenCanvas(rawFrame.dims.width, rawFrame.dims.height);
			const frameCtx = frameCanvas.getContext("2d")!;
			const imageData = new ImageData(
				new Uint8ClampedArray(rawFrame.patch),
				rawFrame.dims.width,
				rawFrame.dims.height,
			);
			frameCtx.putImageData(imageData, 0, 0);
			ctx.drawImage(frameCanvas, rawFrame.dims.left, rawFrame.dims.top);

			const composited = ctx.getImageData(0, 0, width, height);
			frames.push({ imageData: composited, delay, disposalType: rawFrame.disposalType ?? 0 });
			totalDuration += delay;
		}

		const decoded: DecodedGif = { frames, totalDuration, width, height };
		gifCache.set(dataUrl, decoded);
		return decoded;
	} catch (e) {
		console.error("[gifDecoder] Failed to decode GIF:", e);
		return null;
	}
}

/**
 * Get the GIF frame index for a given playback time.
 * Handles looping automatically.
 */
export function getGifFrameAtTime(
	gif: DecodedGif,
	currentMs: number,
	startMs: number,
): GifFrame | null {
	if (gif.frames.length === 0) return null;
	const elapsed = (currentMs - startMs) % gif.totalDuration;
	let acc = 0;
	for (const frame of gif.frames) {
		acc += frame.delay;
		if (elapsed < acc) return frame;
	}
	return gif.frames[gif.frames.length - 1];
}
