import { describe, expect, it } from "vitest";
import {
	createGifFrameSchedule,
	exportLoopGif,
	type GifEncoderFactory,
	type GifEncoderLike,
	type GifExportSettings,
} from "./gifExport";

const settings: GifExportSettings = {
	pattern: "dot-noise",
	aspectRatio: "16:9",
	resolution: 720,
	backgroundColor: "#101820",
	accentColor: "#72d6ff",
	density: 0.4,
	scale: 1,
	speed: 2,
	durationSeconds: 2,
	frameRate: 20,
	seed: 42,
};

class FakeGifEncoder implements GifEncoderLike {
	frames: Array<{ canvas: HTMLCanvasElement; delay: number }> = [];
	aborted = false;
	private listeners = new Map<string, (...args: unknown[]) => void>();

	addFrame(canvas: HTMLCanvasElement, options: { delay: number }): void {
		this.frames.push({ canvas, delay: options.delay });
	}

	on(event: string, listener: (...args: unknown[]) => void): void {
		this.listeners.set(event, listener);
	}

	render(): void {
		this.listeners.get("finished")?.(new Blob(["gif"]));
	}

	abort(): void {
		this.aborted = true;
	}
}

const createTestCanvas = () => ({ getContext: () => ({}) }) as unknown as HTMLCanvasElement;

describe("loop GIF export", () => {
	it("samples a complete period without repeating its endpoint", () => {
		const schedule = createGifFrameSchedule(2, 20);

		expect(schedule).toHaveLength(40);
		expect(schedule[0]).toMatchObject({ index: 0, phase: 0, delayMs: 50 });
		expect(schedule.at(-1)).toMatchObject({ index: 39, phase: 39 / 40, delayMs: 50 });
	});

	it("configures an infinitely repeating GIF with the selected dimensions", async () => {
		const encoder = new FakeGifEncoder();
		let encoderOptions: Record<string, unknown> | undefined;
		const framePhases: number[] = [];
		const createEncoder: GifEncoderFactory = (options) => {
			encoderOptions = options as unknown as Record<string, unknown>;
			return encoder;
		};
		const job = exportLoopGif(
			settings,
			{},
			{
				createEncoder,
				createCanvas: createTestCanvas,
				drawFrame: (_context, frameSettings) => framePhases.push(frameSettings.phase),
				yieldToUi: async () => {},
			},
		);

		await expect(job.promise).resolves.toBeInstanceOf(Blob);
		expect(encoderOptions).toMatchObject({ width: 1280, height: 720, repeat: 0 });
		expect(encoder.frames).toHaveLength(40);
		expect(encoder.frames.every((frame) => frame.delay === 50)).toBe(true);
		expect(framePhases[0]).toBe(0);
		expect(framePhases.at(-1)).toBe(39 / 40);
		expect(framePhases).not.toContain(1);
	});

	it("aborts the encoder and rejects when export is cancelled", async () => {
		const encoder = new FakeGifEncoder();
		let releaseFrame: (() => void) | undefined;
		const frameGate = new Promise<void>((resolve) => {
			releaseFrame = resolve;
		});
		const job = exportLoopGif(
			settings,
			{},
			{
				createEncoder: () => encoder,
				createCanvas: createTestCanvas,
				drawFrame: () => {},
				yieldToUi: () => frameGate,
			},
		);
		await new Promise((resolve) => setTimeout(resolve, 0));

		job.cancel();
		try {
			await expect(job.promise).rejects.toMatchObject({ name: "GifExportCancelledError" });
			expect(encoder.aborted).toBe(true);
		} finally {
			releaseFrame?.();
		}
	});
});
