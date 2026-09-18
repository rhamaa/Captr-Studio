import { resolveMediaElementSource } from "./localMediaSource";

/** One paused decoder per layer. Export waits for each exact seek before drawing. */
export class LayerVideoSource {
	readonly video = document.createElement("video");
	private revoke: () => void = () => {};
	private disposed = false;

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

	async frame(timeSec: number): Promise<HTMLVideoElement> {
		if (this.disposed) throw new Error("Video layer disposed");
		const end = Number.isFinite(this.video.duration)
			? Math.max(0, this.video.duration - 0.001)
			: timeSec;
		const target = Math.min(Math.max(0, timeSec), end);
		if (Math.abs(this.video.currentTime - target) > 0.0001 || this.video.seeking) {
			await this.waitFor("seeked", () => {
				this.video.currentTime = target;
			});
		}
		return this.video;
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
		this.video.removeAttribute("src");
		this.video.load();
		this.revoke();
	}
}
