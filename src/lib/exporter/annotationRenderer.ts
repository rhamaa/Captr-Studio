import {
	type AnnotationRegion,
	type ArrowDirection,
	BLUR_ANNOTATION_STRENGTH,
	type AnnotationTextStyle,
} from "@/components/video-editor/types";
import { decodeGif, getGifFrameAtTime } from '@/lib/gifDecoder';

export interface AnnotationRenderAssets {
	imageCache: Map<string, HTMLImageElement>;
	gifCache: Map<string, import('@/lib/gifDecoder').DecodedGif>;
	fileImageCache: Map<string, HTMLImageElement>;
}

const annotationImagePromiseCache = new Map<string, Promise<HTMLImageElement | null>>();

let blurBufferCanvas: HTMLCanvasElement | null = null;
function getBlurBufferCanvas(): HTMLCanvasElement | null {
	if (typeof document === "undefined") return null;
	if (!blurBufferCanvas) {
		blurBufferCanvas = document.createElement("canvas");
	}
	return blurBufferCanvas;
}

function getAnnotationImageContent(annotation: AnnotationRegion): string | null {
	if (annotation.imageFilePath && !annotation.imageContent && !annotation.content) {
		return `file:${annotation.imageFilePath}`;
	}
	const source = annotation.imageContent || annotation.content;
	if (!source || !source.startsWith("data:image")) {
		return null;
	}

	return source;
}

function loadAnnotationImage(source: string): Promise<HTMLImageElement | null> {
	const cachedPromise = annotationImagePromiseCache.get(source);
	if (cachedPromise) {
		return cachedPromise;
	}

	const loadPromise = new Promise<HTMLImageElement | null>((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => {
			console.error("[AnnotationRenderer] Failed to load image annotation");
			resolve(null);
		};
		img.src = source;
	});

	annotationImagePromiseCache.set(source, loadPromise);
	return loadPromise;
}

export async function preloadAnnotationAssets(
	annotations: AnnotationRegion[] = [],
): Promise<AnnotationRenderAssets> {
	if (typeof document !== "undefined" && document.fonts) {
		try {
			await document.fonts.ready;
		} catch {}
	}
	const uniqueSources = [
		...new Set(
			annotations
				.filter((annotation) => annotation.type === "image")
				.map((annotation) => getAnnotationImageContent(annotation))
				.filter((source): source is string => !!source),
		),
	];

	const imageCache = new Map<string, HTMLImageElement>();
	const fileImageCache = new Map<string, HTMLImageElement>();

	if (uniqueSources.length > 0) {
		await Promise.all(
			uniqueSources.map(async (source) => {
				if (source.startsWith('file:')) {
					const filePath = source.slice(5);
					try {
						const res = await fetch('file://' + filePath.replace(/\\/g, '/'));
						const blob = await res.blob();
						const url = URL.createObjectURL(blob);
						const image = await loadAnnotationImage(url);
						if (image) fileImageCache.set(filePath, image);
					} catch (e) {
						console.error("[AnnotationRenderer] Failed to load file image", filePath, e);
					}
				} else {
					const image = await loadAnnotationImage(source);
					if (image) imageCache.set(source, image);
				}
			}),
		);
	}

	const gifAnnotations = annotations.filter((a) => a.type === 'gif' && a.gifDataUrl);
	const gifCacheMap = new Map<string, import('@/lib/gifDecoder').DecodedGif>();
	for (const ann of gifAnnotations) {
		if (ann.gifDataUrl && !gifCacheMap.has(ann.gifDataUrl)) {
			const decoded = await decodeGif(ann.gifDataUrl);
			if (decoded) gifCacheMap.set(ann.gifDataUrl, decoded);
		}
	}

	return {
		imageCache,
		fileImageCache,
		gifCache: gifCacheMap,
	};
}

const ARROW_PATHS: Record<ArrowDirection, string[]> = {
	up: ["M 50 20 L 50 80", "M 50 20 L 35 35", "M 50 20 L 65 35"],
	down: ["M 50 20 L 50 80", "M 50 80 L 35 65", "M 50 80 L 65 65"],
	left: ["M 80 50 L 20 50", "M 20 50 L 35 35", "M 20 50 L 35 65"],
	right: ["M 20 50 L 80 50", "M 80 50 L 65 35", "M 80 50 L 65 65"],
	"up-right": ["M 25 75 L 75 25", "M 75 25 L 60 30", "M 75 25 L 70 40"],
	"up-left": ["M 75 75 L 25 25", "M 25 25 L 40 30", "M 25 25 L 30 40"],
	"down-right": ["M 25 25 L 75 75", "M 75 75 L 70 60", "M 75 75 L 60 70"],
	"down-left": ["M 75 25 L 25 75", "M 25 75 L 30 60", "M 25 75 L 40 70"],
};

function parseSvgPath(
	pathString: string,
	scaleX: number,
	scaleY: number,
): Array<{ cmd: string; args: number[] }> {
	const commands: Array<{ cmd: string; args: number[] }> = [];
	const parts = pathString.trim().split(/\s+/);

	let i = 0;
	while (i < parts.length) {
		const cmd = parts[i];
		if (cmd === "M" || cmd === "L") {
			const x = parseFloat(parts[i + 1]) * scaleX;
			const y = parseFloat(parts[i + 2]) * scaleY;
			commands.push({ cmd, args: [x, y] });
			i += 3;
		} else {
			i++;
		}
	}

	return commands;
}

function renderArrow(
	ctx: CanvasRenderingContext2D,
	direction: ArrowDirection,
	color: string,
	strokeWidth: number,
	x: number,
	y: number,
	width: number,
	height: number,
	_scaleFactor: number,
) {
	const paths = ARROW_PATHS[direction];
	if (!paths) return;

	ctx.save();
	ctx.translate(x, y);

	const padding = 8 * _scaleFactor;
	const availableWidth = Math.max(0, width - padding * 2);
	const availableHeight = Math.max(0, height - padding * 2);

	const scale = Math.min(availableWidth / 100, availableHeight / 100);

	const offsetX = padding + (availableWidth - 100 * scale) / 2;
	const offsetY = padding + (availableHeight - 100 * scale) / 2;

	ctx.translate(offsetX, offsetY);

	ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
	ctx.shadowBlur = 8 * scale;
	ctx.shadowOffsetX = 0;
	ctx.shadowOffsetY = 4 * scale;

	ctx.strokeStyle = color;
	ctx.lineWidth = strokeWidth * scale;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";

	ctx.beginPath();

	for (const pathString of paths) {
		const commands = parseSvgPath(pathString, scale, scale);

		for (const { cmd, args } of commands) {
			if (cmd === "M") {
				ctx.moveTo(args[0], args[1]);
			} else if (cmd === "L") {
				ctx.lineTo(args[0], args[1]);
			}
		}
	}

	ctx.stroke();

	ctx.restore();
}

function renderText(
	ctx: CanvasRenderingContext2D,
	annotation: AnnotationRegion,
	x: number,
	y: number,
	width: number,
	height: number,
	scaleFactor: number,
	currentTimeMs?: number,
) {
	const style = annotation.style;

	ctx.save();

	const animDuration = annotation.animationDurationMs ?? 500;
	let animAlpha = (annotation.style.opacity ?? 1);
	let slideY = 0;

	if (currentTimeMs !== undefined && animDuration > 0) {
		const elapsed = currentTimeMs - annotation.startMs;
		const remaining = annotation.endMs - currentTimeMs;

		if (annotation.animationIn === "fade") {
			animAlpha *= Math.min(1, Math.max(0, elapsed / animDuration));
		} else if (annotation.animationIn === "slide-up") {
			const progress = Math.min(1, Math.max(0, elapsed / animDuration));
			animAlpha *= progress;
			slideY = (1 - progress) * (20 * scaleFactor);
		}

		if (annotation.animationOut === "fade") {
			animAlpha *= Math.min(1, Math.max(0, remaining / animDuration));
		}
	}

	ctx.globalAlpha = Math.max(0, Math.min(1, animAlpha));

	if (style.dropShadow) {
		ctx.shadowColor = style.dropShadowColor || "rgba(0, 0, 0, 0.5)";
		ctx.shadowBlur = (style.dropShadowBlur ?? 8) * scaleFactor;
		ctx.shadowOffsetX = (style.dropShadowOffsetX ?? 0) * scaleFactor;
		ctx.shadowOffsetY = (style.dropShadowOffsetY ?? 4) * scaleFactor;
	}

	ctx.beginPath();
	ctx.rect(x, y, width, height);
	ctx.clip();

	const fontWeight = style.fontWeight === "bold" ? "bold" : "normal";
	const fontStyle = style.fontStyle === "italic" ? "italic" : "normal";
	const scaledFontSize = style.fontSize * scaleFactor;
	ctx.font = `${fontStyle} ${fontWeight} ${scaledFontSize}px ${style.fontFamily}`;
	ctx.textBaseline = "middle";

	const containerPadding = 8 * scaleFactor;

	let textX = x;
	const textY = y + height / 2 + slideY;

	if (style.textAlign === "center") {
		textX = x + width / 2;
		ctx.textAlign = "center";
	} else if (style.textAlign === "right") {
		textX = x + width - containerPadding;
		ctx.textAlign = "right";
	} else {
		textX = x + containerPadding;
		ctx.textAlign = "left";
	}

	const availableWidth = width - containerPadding * 2;
	const rawLines = annotation.content.split("\n");
	const lines: string[] = [];
	for (const rawLine of rawLines) {
		if (!rawLine) {
			lines.push("");
			continue;
		}
		const words = rawLine.split(/(\s+)/);
		let current = "";
		for (const word of words) {
			const test = current + word;
			if (current && ctx.measureText(test).width > availableWidth) {
				lines.push(current);
				current = word.trimStart();
			} else {
				current = test;
			}
		}
		if (current) lines.push(current);
	}
	const lineHeight = scaledFontSize * 1.4;

	const startY = textY - ((lines.length - 1) * lineHeight) / 2;

	lines.forEach((line, index) => {
		const currentY = startY + index * lineHeight;

		if (style.backgroundColor && style.backgroundColor !== "transparent") {
			const metrics = ctx.measureText(line);
			const verticalPadding = scaledFontSize * 0.1;
			const horizontalPadding = scaledFontSize * 0.2;
			const borderRadius = 4 * scaleFactor;

			let bgX = textX - horizontalPadding;
			const bgWidth = metrics.width + horizontalPadding * 2;

			const contentHeight = scaledFontSize * 1.4;
			const bgHeight = contentHeight + verticalPadding * 2;
			const bgY = currentY - bgHeight / 2;

			if (style.textAlign === "center") {
				bgX = textX - bgWidth / 2;
			} else if (style.textAlign === "right") {
				bgX = textX - bgWidth;
			}

			ctx.fillStyle = style.backgroundColor;
			ctx.beginPath();
			ctx.roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius);
			ctx.fill();
		}

		ctx.fillStyle = style.color;
		ctx.fillText(line, textX, currentY);

		if (style.textDecoration === "underline") {
			const metrics = ctx.measureText(line);
			let underlineX = textX;
			const underlineY = currentY + scaledFontSize * 0.15;

			if (style.textAlign === "center") {
				underlineX = textX - metrics.width / 2;
			} else if (style.textAlign === "right") {
				underlineX = textX - metrics.width;
			}

			ctx.strokeStyle = style.color;
			ctx.lineWidth = Math.max(1, scaledFontSize / 16);
			ctx.beginPath();
			ctx.moveTo(underlineX, underlineY);
			ctx.lineTo(underlineX + metrics.width, underlineY);
			ctx.stroke();
		}
	});

	ctx.restore();
}

async function renderImage(
	ctx: CanvasRenderingContext2D,
	annotation: AnnotationRegion,
	x: number,
	y: number,
	width: number,
	height: number,
	scaleFactor: number,
	assets?: AnnotationRenderAssets,
): Promise<void> {
	let img: HTMLImageElement | undefined | null = null;
	const source = getAnnotationImageContent(annotation);
	
	if (source?.startsWith('file:')) {
		const filePath = source.slice(5);
		img = assets?.fileImageCache.get(filePath);
	} else if (source) {
		img = assets?.imageCache.get(source) ?? (await loadAnnotationImage(source));
	} else if (annotation.imageFilePath) {
		img = assets?.fileImageCache.get(annotation.imageFilePath);
	}

	if (!img) {
		return;
	}

	const imgAspect = img.width / img.height;
	const boxAspect = width / height;

	let drawWidth = width;
	let drawHeight = height;
	let drawX = x;
	let drawY = y;

	if (imgAspect > boxAspect) {
		drawHeight = width / imgAspect;
		drawY = y + (height - drawHeight) / 2;
	} else {
		drawWidth = height * imgAspect;
		drawX = x + (width - drawWidth) / 2;
	}

	const style = annotation.style;
	ctx.save();
	if (style.opacity !== undefined && style.opacity !== 1) {
		ctx.globalAlpha = style.opacity;
	}
	if (style.dropShadow) {
		ctx.shadowColor = style.dropShadowColor || 'rgba(0,0,0,0.5)';
		ctx.shadowBlur = (style.dropShadowBlur ?? 8) * scaleFactor;
		ctx.shadowOffsetX = (style.dropShadowOffsetX ?? 0) * scaleFactor;
		ctx.shadowOffsetY = (style.dropShadowOffsetY ?? 4) * scaleFactor;
	}
	ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
	ctx.restore();
}

async function renderGif(
	ctx: CanvasRenderingContext2D,
	annotation: AnnotationRegion,
	x: number, y: number, width: number, height: number,
	currentTimeMs: number,
	assets?: AnnotationRenderAssets,
): Promise<void> {
	const dataUrl = annotation.gifDataUrl;
	if (!dataUrl) return;

	let gif = assets?.gifCache.get(dataUrl) ?? null;
	if (!gif) {
		gif = await decodeGif(dataUrl);
		if (!gif) return;
	}

	const frame = getGifFrameAtTime(gif, currentTimeMs, annotation.startMs);
	if (!frame) return;

	// Draw frame to offscreen canvas then composite
	const offscreen = new OffscreenCanvas(gif.width, gif.height);
	const offCtx = offscreen.getContext('2d')!;
	offCtx.putImageData(frame.imageData, 0, 0);

	// Respect opacity if set
	const opacity = (annotation.style as AnnotationTextStyle & { opacity?: number }).opacity ?? 1;
	ctx.save();
	ctx.globalAlpha = opacity;
	ctx.drawImage(offscreen, x, y, width, height);
	ctx.restore();
}

import {
	interpolateNumericKeyframe,
	interpolatePositionKeyframe,
} from "@/components/video-editor/keyframeInterpolation";

export async function renderAnnotations(
	ctx: CanvasRenderingContext2D,
	annotations: AnnotationRegion[],
	canvasWidth: number,
	canvasHeight: number,
	currentTimeMs: number,
	scaleFactor: number = 1.0,
	assets?: AnnotationRenderAssets,
): Promise<void> {
	const activeAnnotations = annotations.filter(
		(ann) =>
			ann.visible !== false &&
			currentTimeMs >= ann.startMs &&
			currentTimeMs <= ann.endMs,
	);

	const sortedAnnotations = [...activeAnnotations].sort((a, b) => a.zIndex - b.zIndex);

	for (const annotation of sortedAnnotations) {
		const hasKeyframes = Array.isArray(annotation.keyframes) && annotation.keyframes.length > 0;

		const interpolatedPos = hasKeyframes
			? interpolatePositionKeyframe(annotation.keyframes!, currentTimeMs, annotation.position)
			: annotation.position;

		const interpolatedScale = hasKeyframes
			? interpolateNumericKeyframe(annotation.keyframes!, "scale", currentTimeMs, 1)
			: 1;

		const interpolatedOpacity = hasKeyframes
			? interpolateNumericKeyframe(annotation.keyframes!, "opacity", currentTimeMs, annotation.style.opacity ?? 1)
			: (annotation.style.opacity ?? 1);

		const interpolatedRotation = hasKeyframes
			? interpolateNumericKeyframe(annotation.keyframes!, "rotation", currentTimeMs, annotation.rotationDeg ?? 0)
			: (annotation.rotationDeg ?? 0);

		const x = (interpolatedPos.x / 100) * canvasWidth;
		const y = (interpolatedPos.y / 100) * canvasHeight;
		const width = (annotation.size.width / 100) * canvasWidth * interpolatedScale;
		const height = (annotation.size.height / 100) * canvasHeight * interpolatedScale;

		ctx.save();
		if (annotation.blendMode && annotation.blendMode !== "normal") {
			ctx.globalCompositeOperation =
				annotation.blendMode === "multiply"
					? "multiply"
					: annotation.blendMode === "screen"
						? "screen"
						: annotation.blendMode === "overlay"
							? "overlay"
							: "source-over";
		}
		if (interpolatedRotation !== 0) {
			const cx = x + width / 2;
			const cy = y + height / 2;
			ctx.translate(cx, cy);
			ctx.rotate((interpolatedRotation * Math.PI) / 180);
			ctx.translate(-cx, -cy);
		}
		if (interpolatedOpacity !== 1) {
			ctx.globalAlpha = interpolatedOpacity;
		}

		switch (annotation.type) {
			case "text":
				renderText(ctx, annotation, x, y, width, height, scaleFactor, currentTimeMs);
				break;

			case "image":
				await renderImage(ctx, annotation, x, y, width, height, scaleFactor, assets);
				break;
			
			case "gif":
				await renderGif(ctx, annotation, x, y, width, height, currentTimeMs, assets);
				break;

			case "figure":
				if (annotation.figureData) {
					renderArrow(
						ctx,
						annotation.figureData.arrowDirection,
						annotation.figureData.color,
						annotation.figureData.strokeWidth,
						x,
						y,
						width,
						height,
						scaleFactor,
					);
				}
				break;

			case "blur": {
				const blurStrength =
					(annotation.blurIntensity ?? BLUR_ANNOTATION_STRENGTH) * scaleFactor;
				const padding = Math.ceil(blurStrength * 2);

				ctx.save();

				ctx.beginPath();
				const borderRadius = (annotation.style.borderRadius ?? 0) * scaleFactor;
				ctx.roundRect(x, y, width, height, borderRadius);
				ctx.clip();

				const sx = Math.max(0, x - padding);
				const sy = Math.max(0, y - padding);
				const sw = Math.min(canvasWidth - sx, width + padding * 2);
				const sh = Math.min(canvasHeight - sy, height + padding * 2);

				if (sw > 0 && sh > 0) {
					const buffer = getBlurBufferCanvas();
					if (buffer) {
						buffer.width = sw;
						buffer.height = sh;
						const bCtx = buffer.getContext("2d");
						if (bCtx) {
							bCtx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, sw, sh);

							ctx.filter = `blur(${blurStrength}px)`;
							ctx.drawImage(buffer, sx, sy);

							if (annotation.blurColor && annotation.blurColor !== "transparent") {
								ctx.filter = "none";
								ctx.fillStyle = annotation.blurColor;
								ctx.fillRect(x, y, width, height);
							}
						}
					}
				}

				ctx.restore();
				break;
			}
		}

		ctx.restore();
	}
}

export async function renderAnnotationToCanvas(
	annotation: AnnotationRegion,
	width: number,
	height: number,
	scaleFactor: number = 1.0,
	assets?: AnnotationRenderAssets,
): Promise<HTMLCanvasElement | null> {
	const canvasWidth = Math.max(1, Math.ceil(width));
	const canvasHeight = Math.max(1, Math.ceil(height));
	const canvas = document.createElement("canvas");
	canvas.width = canvasWidth;
	canvas.height = canvasHeight;

	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return null;
	}

	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";

	switch (annotation.type) {
		case "text":
			renderText(ctx, annotation, 0, 0, canvasWidth, canvasHeight, scaleFactor, undefined);
			break;

		case "image":
			await renderImage(ctx, annotation, 0, 0, canvasWidth, canvasHeight, scaleFactor, assets);
			break;

		case "gif":
			// GIF cannot be rendered standalone (needs currentTime for frame selection)
			return null;

		case "figure":
			if (!annotation.figureData) {
				return null;
			}

			renderArrow(
				ctx,
				annotation.figureData.arrowDirection,
				annotation.figureData.color,
				annotation.figureData.strokeWidth,
				0,
				0,
				canvasWidth,
				canvasHeight,
				scaleFactor,
			);
			break;
		case "blur":
			// Blur annotations must sample already-rendered scene pixels,
			// so they cannot be rasterized as standalone sprites.
			return null;
	}

	return canvas;
}


