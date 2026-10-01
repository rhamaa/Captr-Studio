import { FrameRenderer } from "./frameRenderer";
import { LayerVideoSource } from "./layerVideoSource";
import { localMediaUrl } from "@/recording/mediaProbe";
import type { ProjectEvaluation, ProjectVisual } from "@/core/timeline/evaluation";
/** Paused source decoders and effect renderers are bounded and shared by preview/export. */
export class ProjectFrameRenderer {
	private canvas = document.createElement("canvas");
	private sources = new Map<string, LayerVideoSource>();
	private images = new Map<string, HTMLImageElement>();
	private effects = new Map<string, FrameRenderer>();
	private disposed = false;
	private async video(path: string, timeUs: number) {
		let source = this.sources.get(path);
		if (!source) {
			source = new LayerVideoSource();
			this.sources.set(path, source);
			try {
				await source.load(path);
			} catch (e) {
				this.sources.delete(path);
				source.destroy();
				throw e;
			}
		}
		this.sources.delete(path);
		this.sources.set(path, source);
		while (this.sources.size > 8) {
			const [key, value] = this.sources.entries().next().value!;
			this.sources.delete(key);
			value.destroy();
		}
		return source.frame(timeUs / 1_000_000);
	}
	private async image(path: string) {
		let image = this.images.get(path);
		if (image) return image;
		const url = await localMediaUrl(path);
		image = await new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image();
			img.crossOrigin = "anonymous";
			const timer = setTimeout(() => reject(new Error(`Image timed out: ${path}`)), 15000);
			img.onload = () => {
				clearTimeout(timer);
				resolve(img);
			};
			img.onerror = () => {
				clearTimeout(timer);
				reject(new Error(`Missing image: ${path}`));
			};
			img.src = url;
		});
		this.images.set(path, image);
		if (this.images.size > 16) this.images.delete(this.images.keys().next().value!);
		return image;
	}
	private async recording(visual: ProjectVisual, evaluation: ProjectEvaluation) {
		const record = visual.recording!,
			{ settings, package: pkg, composition } = record,
			{ width, height } = evaluation.project.canvas;
		const key = `${composition.id}:${composition.revision}:${width}:${height}`;
		let renderer = this.effects.get(key);
		if (!renderer) {
			renderer = new FrameRenderer({
				...settings,
				cursorTelemetry: settings.cursorTelemetry ?? undefined,
				width,
				height,
				videoWidth: pkg.width,
				videoHeight: pkg.height,
				showShadow: settings.shadowIntensity > 0,
				cropRegion: settings.cropRegion ?? { x: 0, y: 0, width: 1, height: 1 },
				webcamUrl: null,
				projectClock: true,
			});
			this.effects.set(key, renderer);
			try {
				await renderer.initialize();
			} catch (e) {
				this.effects.delete(key);
				renderer.destroy();
				throw e;
			}
			while (this.effects.size > 4) {
				const [old, value] = this.effects.entries().next().value!;
				this.effects.delete(old);
				value.destroy();
			}
		}
		const video = await this.video(visual.path, visual.sourceUs);
		if (pkg.webcam && settings.webcam.enabled && record.webcamUs !== null) {
			const webcam = await this.video(pkg.webcam.path, record.webcamUs);
			renderer.setProjectWebcamFrame(
				new VideoFrame(webcam, { timestamp: Math.round(record.webcamUs) }),
			);
		} else renderer.setProjectWebcamFrame(null);
		const frame = new VideoFrame(video, { timestamp: Math.round(record.sourceUs) });
		try {
			await renderer.renderFrame(
				frame,
				record.sourceUs,
				record.sourceUs,
				1_000_000 / evaluation.project.canvas.fps,
				visual.compositionUs,
			);
			return renderer.getCanvas();
		} finally {
			frame.close();
		}
	}
	async render(evaluation: ProjectEvaluation): Promise<HTMLCanvasElement> {
		if (this.disposed) throw new Error("Project renderer disposed");
		if (evaluation.issues.length) throw new Error(evaluation.issues.join("; "));
		const { width, height } = evaluation.project.canvas;
		this.canvas.width = width;
		this.canvas.height = height;
		const ctx = this.canvas.getContext("2d");
		if (!ctx) throw new Error("Project canvas is unavailable");
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, width, height);
		for (const visual of evaluation.visuals) {
			const source = visual.recording
				? await this.recording(visual, evaluation)
				: visual.asset.kind === "image"
					? await this.image(visual.path)
					: await this.video(visual.path, visual.sourceUs);
			if (this.disposed) throw new Error("Project renderer disposed");
			const sourceWidth =
					source instanceof HTMLVideoElement
						? source.videoWidth
						: source instanceof HTMLImageElement
							? source.naturalWidth
							: source.width,
				sourceHeight =
					source instanceof HTMLVideoElement
						? source.videoHeight
						: source instanceof HTMLImageElement
							? source.naturalHeight
							: source.height;
			if (!sourceWidth || !sourceHeight)
				throw new Error(`No decoded frame for ${visual.clipId}`);
			const ratio = Math.min(width / sourceWidth, height / sourceHeight),
				w = sourceWidth * ratio,
				h = sourceHeight * ratio,
				transform = visual.clip.transform;
			ctx.save();
			ctx.globalAlpha = transform.opacity;
			ctx.translate(width / 2 + transform.x, height / 2 + transform.y);
			ctx.rotate((transform.rotation * Math.PI) / 180);
			ctx.scale(transform.scale, transform.scale);
			ctx.drawImage(source, -w / 2, -h / 2, w, h);
			ctx.restore();
		}
		return this.canvas;
	}
	destroy() {
		this.disposed = true;
		this.sources.forEach((s) => s.destroy());
		this.effects.forEach((s) => s.destroy());
		this.sources.clear();
		this.effects.clear();
		this.images.clear();
		this.canvas.width = this.canvas.height = 0;
	}
}
