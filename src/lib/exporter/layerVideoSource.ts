import { resolveMediaElementSource } from "./localMediaSource";

/** One paused decoder per layer. Export waits for each exact seek before drawing. */
export class LayerVideoSource {
	readonly video = document.createElement("video");
	private revoke: () => void = () => undefined;
	private disposed = false;
	private playbackActive = false;

	async load(path: string): Promise<void> {
		const source = await resolveMediaElementSource(path);
		if (this.disposed) {
			source.revoke();
			throw new Error("Video layer disposed");
		}
		this.revoke = source.revoke;
		this.video.crossOrigin = "anonymous";
		this.video.muted = true;
		this.video.preload = "auto";
		this.video.playsInline = true;
		await this.waitFor("loadeddata", () => {
			this.video.src = source.src;
			this.video.load();
		});
	}

	async frame(
		timeSec: number,
		options: { continuousPlayback?: boolean; playbackRate?: number } = {},
	): Promise<HTMLVideoElement> {
		if (this.disposed) throw new Error("Video layer disposed");
		const end = Number.isFinite(this.video.duration)
			? Math.max(0, this.video.duration - 0.001)
			: timeSec;
		const target = Math.min(Math.max(0, timeSec), end);
		const continuousPlayback = options.continuousPlayback ?? false;
		if (continuousPlayback) {
			const rate = options.playbackRate ?? 1;
			this.video.playbackRate =
				Number.isFinite(rate) && rate > 0 ? Math.min(16, Math.max(0.0625, rate)) : 1;
		} else {
			if (this.playbackActive) this.video.pause();
			this.playbackActive = false;
			this.video.playbackRate = 1;
		}
		const syncToleranceSec = continuousPlayback ? 0.25 : 0.0001;
		const needsSeek =
			Math.abs(this.video.currentTime - target) > syncToleranceSec || this.video.seeking;
		if (needsSeek) {
			await this.waitFor("seeked", () => {
				this.video.currentTime = target;
			});
		}
		if (continuousPlayback) {
			if (this.video.paused || !this.playbackActive) await this.video.play();
			this.playbackActive = true;
			if (needsSeek) await this.waitForPresentedFrame();
		} else if (needsSeek) await this.waitForPresentedFrame();
		return this.video;
	}

	private waitForPresentedFrame(): Promise<void> {
		const video = this.video as HTMLVideoElement & {
			requestVideoFrameCallback?: (callback: () => void) => number;
			cancelVideoFrameCallback?: (handle: number) => void;
		};

		return new Promise((resolve) => {
			let settled = false;
			let frameRequest: number | null = null;
			let animationRequest: number | null = null;
			let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
			const finish = () => {
				if (settled) return;
				settled = true;
				if (fallbackTimer !== undefined) clearTimeout(fallbackTimer);
				if (frameRequest !== null) video.cancelVideoFrameCallback?.(frameRequest);
				if (animationRequest !== null) cancelAnimationFrame(animationRequest);
				resolve();
			};
			const hasFrameCallback = typeof video.requestVideoFrameCallback === "function";
			const hasAnimationFrame = typeof requestAnimationFrame === "function";
			fallbackTimer = setTimeout(finish, hasFrameCallback || hasAnimationFrame ? 350 : 0);

			if (hasFrameCallback) {
				frameRequest = video.requestVideoFrameCallback(finish);
			} else if (hasAnimationFrame) {
				animationRequest = requestAnimationFrame(() => {
					animationRequest = requestAnimationFrame(finish);
				});
			}
		});
	}

	private waitFor(event: string, action: () => void): Promise<void> {
		return new Promise((resolve, reject) => {
			const finish = (error?: Error) => {
				clearTimeout(timer);
				this.video.removeEventListener(event, ready);
				this.video.removeEventListener("error", failed);
				this.video.removeEventListener("emptied", emptied);
				error ? reject(error) : resolve();
			};
			const ready = () => finish();
			const failed = () =>
				finish(
					new Error(
						`Unable to decode video layer: ${this.video.error?.message ?? "media error"}`,
					),
				);
			const emptied = () => {
				if (this.disposed) finish(new Error("Video layer disposed"));
			};
			const timer = setTimeout(
				() => finish(new Error(`Video layer ${event} timed out`)),
				15000,
			);
			this.video.addEventListener(event, ready, { once: true });
			this.video.addEventListener("error", failed, { once: true });
			this.video.addEventListener("emptied", emptied);
			try {
				action();
			} catch (error) {
				finish(error instanceof Error ? error : new Error(String(error)));
			}
		});
	}

	destroy(): void {
		this.disposed = true;
		this.video.pause();
		this.playbackActive = false;
		this.video.removeAttribute("src");
		this.video.load();
		this.revoke();
	}
}
