import GIF from "gif.js";
import { drawPatternFrame, type LoopPattern, type PatternRenderSettings } from "./patternRenderer";

export type GifAspectRatio = "16:9" | "9:16" | "1:1";
export type GifFrameRate = 15 | 20 | 25 | 30;
export type GifResolution = 720 | 1080;

export interface GifExportSettings {
	pattern: LoopPattern;
	aspectRatio: GifAspectRatio;
	resolution: GifResolution;
	backgroundColor: string;
	accentColor: string;
	density: number;
	scale: number;
	speed: number;
	durationSeconds: number;
	frameRate: GifFrameRate;
	seed?: number;
}

export interface GifFrameScheduleItem {
	index: number;
	phase: number;
	delayMs: number;
}

export interface GifExportProgress {
	phase: "rendering" | "encoding";
	currentFrame: number;
	totalFrames: number;
	percentage: number;
}

export interface GifEncoderOptions {
	workers: number;
	quality: number;
	width: number;
	height: number;
	workerScript: string;
	repeat: 0;
}

export interface GifEncoderLike {
	addFrame(canvas: HTMLCanvasElement, options: { delay: number; copy: boolean }): void;
	on(event: string, listener: (...args: unknown[]) => void): void;
	render(): void;
	abort(): void;
}

export type GifEncoderFactory = (options: GifEncoderOptions) => GifEncoderLike;

export interface GifExportDependencies {
	createEncoder?: GifEncoderFactory;
	createCanvas?: () => HTMLCanvasElement;
	drawFrame?: typeof drawPatternFrame;
	yieldToUi?: () => Promise<void>;
}

export interface GifExportJob {
	promise: Promise<Blob>;
	cancel: () => void;
}

export interface GifExportCallbacks {
	onProgress?: (progress: GifExportProgress) => void;
}

export class GifExportCancelledError extends Error {
	constructor() {
		super("GIF export cancelled");
		this.name = "GifExportCancelledError";
	}
}

const GIF_WORKER_URL = new URL("gif.js/dist/gif.worker.js", import.meta.url).toString();
const VALID_FRAME_RATES: GifFrameRate[] = [15, 20, 25, 30];

export function getGifDimensions(
	aspectRatio: GifAspectRatio,
	resolution: GifResolution,
): { width: number; height: number } {
	if (aspectRatio === "9:16")
		return { width: resolution, height: Math.round((resolution * 16) / 9) };
	if (aspectRatio === "1:1") return { width: resolution, height: resolution };
	return { width: Math.round((resolution * 16) / 9), height: resolution };
}

export function createGifFrameSchedule(
	durationSeconds: number,
	frameRate: GifFrameRate,
): GifFrameScheduleItem[] {
	if (!VALID_FRAME_RATES.includes(frameRate)) throw new RangeError("Unsupported GIF frame rate");
	if (!Number.isFinite(durationSeconds)) throw new RangeError("Duration must be a finite number");
	const duration = Math.min(10, Math.max(1, Math.round(durationSeconds)));
	const totalFrames = duration * frameRate;
	const delayMs = Math.round(1000 / frameRate);
	return Array.from({ length: totalFrames }, (_, index) => ({
		index,
		phase: index / totalFrames,
		delayMs,
	}));
}

function createDefaultEncoder(options: GifEncoderOptions): GifEncoderLike {
	return new GIF(options as ConstructorParameters<typeof GIF>[0]) as unknown as GifEncoderLike;
}

function yieldToBrowser(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

export function exportLoopGif(
	settings: GifExportSettings,
	callbacks: GifExportCallbacks = {},
	dependencies: GifExportDependencies = {},
): GifExportJob {
	let encoder: GifEncoderLike | null = null;
	let cancelled = false;
	let settled = false;
	let resolveExport!: (blob: Blob) => void;
	let rejectExport!: (error: Error) => void;

	const promise = new Promise<Blob>((resolve, reject) => {
		resolveExport = resolve;
		rejectExport = reject;
	});
	const resolveOnce = (blob: Blob) => {
		if (settled) return;
		settled = true;
		resolveExport(blob);
	};
	const rejectOnce = (error: Error) => {
		if (settled) return;
		settled = true;
		rejectExport(error);
	};

	const run = async () => {
		try {
			const dimensions = getGifDimensions(settings.aspectRatio, settings.resolution);
			const schedule = createGifFrameSchedule(settings.durationSeconds, settings.frameRate);
			const canvas = (
				dependencies.createCanvas ?? (() => document.createElement("canvas"))
			)();
			canvas.width = dimensions.width;
			canvas.height = dimensions.height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("Unable to create a canvas rendering context");
			const hardwareConcurrency =
				typeof navigator === "undefined" ? 4 : navigator.hardwareConcurrency || 4;
			encoder = (dependencies.createEncoder ?? createDefaultEncoder)({
				workers: Math.max(1, Math.min(8, hardwareConcurrency - 1)),
				quality: 10,
				width: dimensions.width,
				height: dimensions.height,
				workerScript: GIF_WORKER_URL,
				repeat: 0,
			});
			encoder.on("finished", (blob) => {
				if (blob instanceof Blob) resolveOnce(blob);
				else rejectOnce(new Error("GIF encoder returned an invalid file"));
			});
			encoder.on("error", (error) => {
				rejectOnce(error instanceof Error ? error : new Error(String(error)));
			});
			encoder.on("progress", (progress) => {
				const ratio = typeof progress === "number" ? Math.min(1, Math.max(0, progress)) : 0;
				callbacks.onProgress?.({
					phase: "encoding",
					currentFrame: schedule.length,
					totalFrames: schedule.length,
					percentage: 85 + Math.round(ratio * 15),
				});
			});

			for (const frame of schedule) {
				if (cancelled) throw new GifExportCancelledError();
				const renderSettings: PatternRenderSettings = {
					pattern: settings.pattern,
					width: dimensions.width,
					height: dimensions.height,
					phase: frame.phase,
					seed: settings.seed ?? 42,
					backgroundColor: settings.backgroundColor,
					accentColor: settings.accentColor,
					density: settings.density,
					scale: settings.scale,
					speed: settings.speed,
				};
				(dependencies.drawFrame ?? drawPatternFrame)(context, renderSettings);
				encoder.addFrame(canvas, { delay: frame.delayMs, copy: true });
				callbacks.onProgress?.({
					phase: "rendering",
					currentFrame: frame.index + 1,
					totalFrames: schedule.length,
					percentage: Math.round(((frame.index + 1) / schedule.length) * 85),
				});
				await (dependencies.yieldToUi ?? yieldToBrowser)();
			}
			if (cancelled) throw new GifExportCancelledError();
			encoder.render();
		} catch (error) {
			rejectOnce(error instanceof Error ? error : new Error(String(error)));
		}
	};

	void run();
	return {
		promise,
		cancel: () => {
			if (settled || cancelled) return;
			cancelled = true;
			encoder?.abort();
			rejectOnce(new GifExportCancelledError());
		},
	};
}
