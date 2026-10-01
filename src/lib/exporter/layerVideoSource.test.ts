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
