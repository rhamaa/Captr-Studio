import { afterEach, expect, it, vi } from "vitest";
import { LayerVideoSource } from "./layerVideoSource";

const revoke = vi.hoisted(() => vi.fn());
vi.mock("./localMediaSource", () => ({
	resolveMediaElementSource: async () => ({ src: "http://localhost/video", revoke }),
}));
afterEach(() => {
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

it("waits for the sought video frame to be presented before returning it", async () => {
	let onPresentedFrame:
		| ((now: number, metadata: { mediaTime: number }) => void)
		| undefined;
	class Media extends EventTarget {
		duration = 4;
		seeking = false;
		src = "";
		crossOrigin = "";
		muted = false;
		preload = "";
		playsInline = false;
		private time = 0;
		get currentTime() {
			return this.time;
		}
		set currentTime(value: number) {
			this.time = value;
			queueMicrotask(() => this.dispatchEvent(new Event("seeked")));
		}
		load() {
			queueMicrotask(() =>
				this.dispatchEvent(new Event(this.src ? "loadeddata" : "emptied")),
			);
		}
		requestVideoFrameCallback(callback: (now: number, metadata: { mediaTime: number }) => void) {
			onPresentedFrame = callback;
			return 1;
		}
		pause = vi.fn();
		removeAttribute() {
			this.src = "";
		}
	}
	const media = new Media();
	vi.stubGlobal("document", { createElement: () => media });
	const source = new LayerVideoSource();
	await source.load("b.mp4");
	let resolved = false;
	const pending = source.frame(2).then((frame) => {
		resolved = true;
		return frame;
	});
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	expect(resolved).toBe(false);
	expect(onPresentedFrame).toBeTypeOf("function");
	onPresentedFrame?.(0, { mediaTime: 2 });
	await expect(pending).resolves.toBe(media);
	source.destroy();
});

it("seeks both directions, clamps EOF, opts into CORS and releases the decoder", async () => {
	class Media extends EventTarget {
		duration = 4;
		seeking = false;
		src = "";
		crossOrigin = "";
		muted = false;
		preload = "";
		playsInline = false;
		private time = 0;
		get currentTime() {
			return this.time;
		}
		set currentTime(value: number) {
			this.time = value;
			queueMicrotask(() => this.dispatchEvent(new Event("seeked")));
		}
		load() {
			queueMicrotask(() =>
				this.dispatchEvent(new Event(this.src ? "loadeddata" : "emptied")),
			);
		}
		pause = vi.fn();
		removeAttribute() {
			this.src = "";
		}
	}
	const media = new Media();
	vi.stubGlobal("document", { createElement: () => media });
	const source = new LayerVideoSource();
	await source.load("b.mp4");
	expect(media.crossOrigin).toBe("anonymous");
	await source.frame(3);
	expect(media.currentTime).toBe(3);
	await source.frame(1);
	expect(media.currentTime).toBe(1);
	await source.frame(8);
	expect(media.currentTime).toBeCloseTo(3.999);
	source.destroy();
	expect(media.pause).toHaveBeenCalledOnce();
	expect(revoke).toHaveBeenCalledOnce();
	await expect(source.frame(0)).rejects.toThrow("disposed");
});

it("plays adjacent preview frames without seeking the decoder on every update", async () => {
	const presentedFrames: Array<
		(now: number, metadata: { mediaTime: number }) => void
	> = [];
	class Media extends EventTarget {
		duration = 4;
		seeking = false;
		paused = true;
		src = "";
		crossOrigin = "";
		muted = false;
		preload = "";
		playsInline = false;
		playbackRate = 1;
		seekCount = 0;
		private time = 1;
		get currentTime() {
			return this.time;
		}
		set currentTime(value: number) {
			this.seekCount += 1;
			this.time = value;
			queueMicrotask(() => this.dispatchEvent(new Event("seeked")));
		}
		load() {
			queueMicrotask(() =>
				this.dispatchEvent(new Event(this.src ? "loadeddata" : "emptied")),
			);
		}
		play = vi.fn(async () => {
			this.paused = false;
		});
		pause = vi.fn(() => {
			this.paused = true;
		});
		requestVideoFrameCallback(
			callback: (now: number, metadata: { mediaTime: number }) => void,
		) {
			presentedFrames.push(callback);
			return presentedFrames.length;
		}
		cancelVideoFrameCallback() {}
		removeAttribute() {
			this.src = "";
		}
	}
	const media = new Media();
	vi.stubGlobal("document", { createElement: () => media });
	const source = new LayerVideoSource();
	await source.load("b.mp4");

	let firstResolved = false;
	const first = source
		.frame(1.03, { continuousPlayback: true, playbackRate: 1.5 })
		.then(() => {
			firstResolved = true;
		});
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	expect(media.currentTime).toBe(1);
	expect(media.playbackRate).toBe(1.5);
	expect(media.play).toHaveBeenCalledOnce();
	expect(firstResolved).toBe(true);
	await first;

	let secondResolved = false;
	const second = source
		.frame(1.06, { continuousPlayback: true, playbackRate: 1.5 })
		.then(() => {
			secondResolved = true;
		});
	await new Promise<void>((resolve) => setTimeout(resolve, 0));
	expect(media.currentTime).toBe(1);
	expect(media.seekCount).toBe(0);
	expect(secondResolved).toBe(true);
	await second;
	source.destroy();
});
