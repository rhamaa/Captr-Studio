import type { ProjectEvaluation } from "@/core/timeline/evaluation";
import type {
	EvaluatedClipTransition,
	ProjectVisualSample,
} from "@/core/timeline/visualAnimation";
import type {
	ComponentAnimation,
	ShapeDefinition,
	ShapeStyle,
} from "@/core/timeline/types";
import { localMediaUrl } from "@/recording/mediaProbe";
import { FrameRenderer } from "./frameRenderer";
import { LayerVideoSource } from "./layerVideoSource";

type Direction = "left" | "right" | "up" | "down";

/** Paused source decoders and effect renderers are bounded and shared by preview/export. */
export class ProjectFrameRenderer {
	private canvas = document.createElement("canvas");
	private frameCanvases: HTMLCanvasElement[] = [];
	private sources = new Map<string, LayerVideoSource>();
	private images = new Map<string, HTMLImageElement>();
	private effects = new Map<string, FrameRenderer>();
	private playbackPositions = new Map<string, { projectUs: number; sourceUs: number }>();
	private compositionKeys = new WeakMap<object, number>();
	private nextCompositionKey = 0;
	private disposed = false;
	private playbackRate(path: string, projectUs: number, sourceUs: number, playing: boolean) {
		if (!playing) {
			this.playbackPositions.delete(path);
			return 1;
		}
		const previous = this.playbackPositions.get(path);
		this.playbackPositions.set(path, { projectUs, sourceUs });
		if (!previous) return 1;
		const projectDelta = projectUs - previous.projectUs;
		if (projectDelta <= 0 || projectDelta > 500_000) return 1;
		const rate = (sourceUs - previous.sourceUs) / projectDelta;
		return Number.isFinite(rate) && rate >= 0.0625 && rate <= 16 ? rate : 1;
	}
	private async video(
		path: string,
		timeUs: number,
		projectUs: number,
		continuousPlayback: boolean,
	) {
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
		return source.frame(timeUs / 1_000_000, {
			continuousPlayback,
			playbackRate: this.playbackRate(path, projectUs, timeUs, continuousPlayback),
		});
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
	private async recording(
		visual: ProjectVisualSample,
		evaluation: ProjectEvaluation,
		continuousPlayback: boolean,
	) {
		const record = visual.recording!;
		const { settings, package: pkg, composition } = record;
		const { width, height } = evaluation.project.canvas;
		// History branches may reuse a numeric revision; immutable object identity cannot collide.
		let identity = this.compositionKeys.get(composition);
		if (identity === undefined) {
			identity = ++this.nextCompositionKey;
			this.compositionKeys.set(composition, identity);
		}
		const key = `${identity}:${width}:${height}`;
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
		const video = await this.video(
			visual.path,
			visual.sourceUs,
			evaluation.timeUs,
			continuousPlayback,
		);
		if (pkg.webcam && settings.webcam.enabled && record.webcamUs !== null) {
			const webcam = await this.video(
				pkg.webcam.path,
				record.webcamUs,
				evaluation.timeUs,
				continuousPlayback,
			);
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
	private makeCanvas(width: number, height: number, poolIndex: number) {
		const canvas = this.frameCanvases[poolIndex] ?? document.createElement("canvas");
		this.frameCanvases[poolIndex] = canvas;
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Project canvas is unavailable");
		ctx.clearRect(0, 0, width, height);
		return { canvas, ctx };
	}
	private animationTransform(visual: ProjectVisualSample, width: number, height: number) {
		let { x, y, scale, opacity } = visual.transform;
		let wipe: { progress: number; direction: Direction } | undefined;
		const animations = visual.componentAnimations;
		if (!animations) return { x, y, scale, opacity, wipe };
		for (const [edge, sample] of [["enter", animations.enter], ["exit", animations.exit]] as const) {
			if (!sample) continue;
			const progress = sample.progress;
			applyComponentAnimation(sample.preset, edge, progress, sample.direction ?? "left", width, height,
				(value) => { opacity *= value; },
				(dx, dy) => { x += dx; y += dy; },
				(value) => { scale *= value; },
				(value, direction) => { wipe = { progress: value, direction }; },
			);
		}
		return { x, y, scale, opacity, wipe };
	}
	private applyMask(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		mask: { progress: number; direction: Direction } | undefined,
	) {
		if (!mask) return;
		const p = Math.max(0, Math.min(1, mask.progress));
		ctx.beginPath();
		switch (mask.direction) {
			case "left": ctx.rect(0, 0, width * p, height); break;
			case "right": ctx.rect(width * (1 - p), 0, width * p, height); break;
			case "up": ctx.rect(0, 0, width, height * p); break;
			case "down": ctx.rect(0, height * (1 - p), width, height * p); break;
		}
		ctx.clip();
	}
	private drawShape(
		ctx: CanvasRenderingContext2D,
		shape: ShapeDefinition,
		style: ShapeStyle,
		assetWidth: number,
		assetHeight: number,
		ratio: number,
	) {
		ctx.scale(ratio, ratio);
		const stroke = style.stroke;
		if (stroke) {
			ctx.strokeStyle = stroke.color;
			ctx.lineWidth = stroke.width;
			ctx.lineCap = "round";
			ctx.lineJoin = "round";
		}
		if (style.fill) ctx.fillStyle = style.fill;
		if (shape.kind === "rectangle") {
			const x = -assetWidth / 2, y = -assetHeight / 2;
			if (style.fill) ctx.fillRect(x, y, shape.width, shape.height);
			if (stroke) ctx.strokeRect(x, y, shape.width, shape.height);
			return;
		}
		if (shape.kind === "ellipse") {
			ctx.beginPath();
			ctx.ellipse(0, 0, shape.width / 2, shape.height / 2, 0, 0, Math.PI * 2);
			if (style.fill) ctx.fill();
			if (stroke) ctx.stroke();
			return;
		}
		const fromX = shape.from.x - assetWidth / 2;
		const fromY = shape.from.y - assetHeight / 2;
		const toX = shape.to.x - assetWidth / 2;
		const toY = shape.to.y - assetHeight / 2;
		ctx.beginPath();
		ctx.moveTo(fromX, fromY);
		ctx.lineTo(toX, toY);
		if (shape.kind === "arrow") {
			const angle = Math.atan2(toY - fromY, toX - fromX);
			const length = Math.hypot(toX - fromX, toY - fromY);
			const headLength = Math.min(length * 0.4, shape.headLength);
			const spread = Math.PI / 6;
			ctx.moveTo(toX, toY);
			ctx.lineTo(toX - headLength * Math.cos(angle - spread), toY - headLength * Math.sin(angle - spread));
			ctx.moveTo(toX, toY);
			ctx.lineTo(toX - headLength * Math.cos(angle + spread), toY - headLength * Math.sin(angle + spread));
		}
		if (stroke) ctx.stroke();
	}
	private async visualLayer(
		visual: ProjectVisualSample,
		evaluation: ProjectEvaluation,
		continuousPlayback: boolean,
		poolIndex = 0,
	): Promise<HTMLCanvasElement> {
		const { width, height } = evaluation.project.canvas;
		const { canvas, ctx } = this.makeCanvas(width, height, poolIndex);
		const animated = this.animationTransform(visual, width, height);
		ctx.save();
		this.applyMask(ctx, width, height, animated.wipe);
		ctx.globalAlpha = animated.opacity;
		ctx.translate(width / 2 + animated.x, height / 2 + animated.y);
		ctx.rotate((visual.transform.rotation * Math.PI) / 180);
		ctx.scale(animated.scale, animated.scale);
		if (visual.asset.kind === "text") {
			const overlay = visual.clip.text ?? visual.asset.text!;
			ctx.font = `${overlay.fontWeight} ${overlay.fontSizePx}px "${overlay.fontFamily.replace(/["\\\r\n]/g, "")}"`;
			ctx.textAlign = overlay.align;
			ctx.textBaseline = "middle";
			ctx.fillStyle = overlay.color;
			const lines = overlay.content.split("\n"), lineHeight = overlay.fontSizePx * 1.2;
			lines.forEach((line, index) => ctx.fillText(
				line,
				0,
				(index - (lines.length - 1) / 2) * lineHeight,
				width * 0.9,
			));
			ctx.restore();
			return canvas;
		}
		if (visual.asset.kind === "shape") {
			const definition = visual.asset.shapeDefinition;
			if (!definition) throw new Error(`Missing shape definition for ${visual.clipId}`);
			const defaultStyle: ShapeStyle = {
				fill: "fill" in definition.style ? definition.style.fill : null,
				stroke: definition.style.stroke,
			};
			const style = visual.clip.shapeStyleOverride ?? defaultStyle;
			const ratio = Math.min(width / visual.asset.width, height / visual.asset.height);
			this.drawShape(ctx, definition, style, visual.asset.width, visual.asset.height, ratio);
			ctx.restore();
			return canvas;
		}
		const source = visual.recording
			? await this.recording(visual, evaluation, continuousPlayback)
			: visual.asset.kind === "image"
				? await this.image(visual.path)
				: await this.video(visual.path, visual.sourceUs, evaluation.timeUs, continuousPlayback);
		if (this.disposed) throw new Error("Project renderer disposed");
		const sourceWidth = source instanceof HTMLVideoElement
			? source.videoWidth
			: source instanceof HTMLImageElement ? source.naturalWidth : source.width;
		const sourceHeight = source instanceof HTMLVideoElement
			? source.videoHeight
			: source instanceof HTMLImageElement ? source.naturalHeight : source.height;
		if (!sourceWidth || !sourceHeight) throw new Error(`No decoded frame for ${visual.clipId}`);
		const ratio = Math.min(width / sourceWidth, height / sourceHeight);
		const drawWidth = sourceWidth * ratio, drawHeight = sourceHeight * ratio;
		ctx.drawImage(source, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
		ctx.restore();
		return canvas;
	}
	private paintWipe(ctx: CanvasRenderingContext2D, incoming: HTMLCanvasElement, transition: EvaluatedClipTransition) {
		const { width, height } = incoming;
		const p = transition.progress;
		const direction: Direction = transition.preset.kind === "wipe" ? transition.preset.direction : "left";
		ctx.save();
		ctx.beginPath();
		switch (direction) {
			case "left": ctx.rect(0, 0, width * p, height); break;
			case "right": ctx.rect(width * (1 - p), 0, width * p, height); break;
			case "up": ctx.rect(0, 0, width, height * p); break;
			case "down": ctx.rect(0, height * (1 - p), width, height * p); break;
		}
		ctx.clip();
		ctx.drawImage(incoming, 0, 0);
		ctx.restore();
	}
	private async transitionLayer(
		transition: EvaluatedClipTransition,
		evaluation: ProjectEvaluation,
		continuousPlayback: boolean,
	): Promise<HTMLCanvasElement> {
		const { width, height } = evaluation.project.canvas;
		const outgoing = await this.visualLayer(transition.outgoing, evaluation, continuousPlayback, 1);
		const incoming = await this.visualLayer(transition.incoming, evaluation, continuousPlayback, 2);
		const { canvas, ctx } = this.makeCanvas(width, height, 3);
		const p = Math.max(0, Math.min(1, transition.progress));
		const preset = transition.preset;
		if (preset.kind === "cross-dissolve") {
			ctx.globalCompositeOperation = "lighter";
			ctx.globalAlpha = 1 - p;
			ctx.drawImage(outgoing, 0, 0);
			ctx.globalAlpha = p;
			ctx.drawImage(incoming, 0, 0);
			ctx.globalAlpha = 1;
			ctx.globalCompositeOperation = "source-over";
		} else if (preset.kind === "fade-through") {
			if (p < 0.5) {
				ctx.drawImage(outgoing, 0, 0);
				ctx.globalAlpha = p * 2;
				ctx.fillStyle = preset.color === "white" ? "#fff" : "#000";
				ctx.fillRect(0, 0, width, height);
			} else {
				ctx.fillStyle = preset.color === "white" ? "#fff" : "#000";
				ctx.fillRect(0, 0, width, height);
				ctx.globalAlpha = (p - 0.5) * 2;
				ctx.drawImage(incoming, 0, 0);
			}
			ctx.globalAlpha = 1;
		} else if (preset.kind === "wipe") {
			ctx.drawImage(outgoing, 0, 0);
			this.paintWipe(ctx, incoming, transition);
		} else {
			const horizontal = preset.direction === "left" || preset.direction === "right";
			const sign = preset.direction === "left" || preset.direction === "up" ? -1 : 1;
			const distance = horizontal ? width : height;
			const incomingX = horizontal ? sign * distance * (1 - p) : 0;
			const incomingY = horizontal ? 0 : sign * distance * (1 - p);
			ctx.drawImage(outgoing, horizontal ? -sign * distance * p : 0, horizontal ? 0 : -sign * distance * p);
			ctx.drawImage(incoming, incomingX, incomingY);
		}
		return canvas;
	}
	async render(
		evaluation: ProjectEvaluation,
		options: { continuousPlayback?: boolean } = {},
	): Promise<HTMLCanvasElement> {
		if (this.disposed) throw new Error("Project renderer disposed");
		if (evaluation.issues.length) throw new Error(evaluation.issues.join("; "));
		const { width, height } = evaluation.project.canvas;
		const continuousPlayback = options.continuousPlayback ?? false;
		this.canvas.width = width;
		this.canvas.height = height;
		const ctx = this.canvas.getContext("2d");
		if (!ctx) throw new Error("Project canvas is unavailable");
		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = "#000";
		ctx.fillRect(0, 0, width, height);
		const transitions = new Map<string, EvaluatedClipTransition>();
		for (const transition of evaluation.visualTransitions) {
			transitions.set(transition.fromClipId, transition);
			transitions.set(transition.toClipId, transition);
		}
		const renderedTransitions = new Set<string>(), transitionClips = new Set<string>();
		for (const visual of evaluation.visuals) {
			if (transitionClips.has(visual.clipId)) continue;
			const transition = transitions.get(visual.clipId);
			if (transition) {
				if (renderedTransitions.has(transition.id)) continue;
				const layer = await this.transitionLayer(transition, evaluation, continuousPlayback);
				ctx.drawImage(layer, 0, 0);
				renderedTransitions.add(transition.id);
				transitionClips.add(transition.fromClipId);
				transitionClips.add(transition.toClipId);
				continue;
			}
			const layer = await this.visualLayer(visual, evaluation, continuousPlayback);
			ctx.drawImage(layer, 0, 0);
		}
		return this.canvas;
	}
	destroy() {
		this.disposed = true;
		this.sources.forEach((s) => s.destroy());
		this.effects.forEach((s) => s.destroy());
		this.sources.clear();
		this.effects.clear();
		this.playbackPositions.clear();
		this.images.clear();
		this.frameCanvases.forEach((canvas) => { canvas.width = canvas.height = 0; });
		this.frameCanvases = [];
		this.canvas.width = this.canvas.height = 0;
	}
}

function applyComponentAnimation(
	preset: ComponentAnimation["preset"],
	edge: "enter" | "exit",
	progress: number,
	direction: Direction,
	width: number,
	height: number,
	setOpacity: (factor: number) => void,
	addOffset: (x: number, y: number) => void,
	setScale: (factor: number) => void,
	setWipe: (progress: number, direction: Direction) => void,
) {
	const p = Math.max(0, Math.min(1, progress));
	if (preset === "fade") {
		setOpacity(edge === "enter" ? p : 1 - p);
		return;
	}
	if (preset === "slide") {
		const offset = edge === "enter" ? 1 - p : p;
		const sign = direction === "left" || direction === "up" ? -1 : 1;
		if (direction === "left" || direction === "right") addOffset(sign * width * offset, 0);
		else addOffset(0, sign * height * offset);
		return;
	}
	if (preset === "scale-pop") {
		setScale(edge === "enter" ? 0.85 + p * 0.15 : 1 - p * 0.15);
		return;
	}
	setWipe(edge === "enter" ? p : 1 - p, direction);
}
