import type {
	LayoutRegion,
	LayoutSceneEasing,
	LayoutScenePreset,
	WebcamOverlaySettings,
} from "./types";
import {
	DEFAULT_LAYOUT_SCENE_EASING,
	DEFAULT_LAYOUT_SCENE_PRESET,
	DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
} from "./types";
import {
	getWebcamOverlayPosition,
	getWebcamOverlaySizePx,
} from "./webcamOverlay";

export interface LayoutSceneLayerTransform {
	x: number;
	y: number;
	width: number;
	height: number;
	opacity: number;
	borderRadius: number;
	shadow: number;
}

export interface ResolvedLayoutScene {
	preset: LayoutScenePreset;
	screen: LayoutSceneLayerTransform;
	webcam: LayoutSceneLayerTransform;
}

export const LAYOUT_SCENE_CATEGORIES: Array<{
	id: "camera-bubble" | "side-by-side" | "camera-only" | "screen-only";
	label: string;
	value: LayoutScenePreset;
}> = [
	{
		id: "camera-bubble",
		label: "Camera Bubble",
		value: "bubble",
	},
	{
		id: "side-by-side",
		label: "Side-by-side",
		value: "side-by-side",
	},
	{
		id: "camera-only",
		label: "Camera Only",
		value: "webcam-only",
	},
	{
		id: "screen-only",
		label: "Screen Only",
		value: "screen-only",
	},
];

export const LAYOUT_SCENE_CATEGORY_DETAILS: Record<
	(typeof LAYOUT_SCENE_CATEGORIES)[number]["id"],
	Array<{ value: LayoutScenePreset; label: string }>
> = {
	"camera-bubble": [
		{ value: "bubble", label: "Default bubble" },
		{ value: "bubble-bottom-right", label: "Bottom right circle" },
		{ value: "bubble-bottom-left", label: "Bottom left circle" },
		{ value: "bubble-top-right", label: "Top right circle" },
		{ value: "bubble-bottom-right-landscape", label: "Bottom right landscape" },
	],
	"side-by-side": [
		{ value: "side-by-side", label: "Equal columns" },
		{ value: "split-right", label: "Split right" },
		{ value: "split-right-overlap", label: "Split right overlap" },
		{ value: "split-right-50", label: "Split right 50/50" },
		{ value: "split-left", label: "Split left" },
		{ value: "split-left-overlap", label: "Split left overlap" },
		{ value: "split-left-50", label: "Split left 50/50" },
		{ value: "presenter", label: "Presenter" },
	],
	"camera-only": [
		{ value: "webcam-only", label: "Camera full" },
		{ value: "camera-circle", label: "Camera circle" },
	],
	"screen-only": [
		{ value: "screen-only", label: "Screen full" },
		{ value: "screen-center", label: "Screen center" },
	],
};

export const LAYOUT_SCENE_PRESETS = Object.values(LAYOUT_SCENE_CATEGORY_DETAILS).flat();

export function getLayoutSceneCategory(preset: LayoutScenePreset) {
	return (
		LAYOUT_SCENE_CATEGORIES.find((category) =>
			LAYOUT_SCENE_CATEGORY_DETAILS[category.id].some((option) => option.value === preset),
		) ?? LAYOUT_SCENE_CATEGORIES[0]
	);
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function ease(progress: number, easing: LayoutSceneEasing) {
	const t = clamp(progress, 0, 1);
	if (easing === "linear") return t;
	if (easing === "snappy") return 1 - (1 - t) ** 4;
	return t * t * (3 - 2 * t);
}

function lerp(left: number, right: number, progress: number) {
	return left + (right - left) * progress;
}

function mixLayer(
	from: LayoutSceneLayerTransform,
	to: LayoutSceneLayerTransform,
	progress: number,
): LayoutSceneLayerTransform {
	return {
		x: lerp(from.x, to.x, progress),
		y: lerp(from.y, to.y, progress),
		width: lerp(from.width, to.width, progress),
		height: lerp(from.height, to.height, progress),
		opacity: lerp(from.opacity, to.opacity, progress),
		borderRadius: lerp(from.borderRadius, to.borderRadius, progress),
		shadow: lerp(from.shadow, to.shadow, progress),
	};
}

function hiddenLayer(width: number, height: number): LayoutSceneLayerTransform {
	return {
		x: width / 2,
		y: height / 2,
		width: Math.max(1, width * 0.12),
		height: Math.max(1, height * 0.12),
		opacity: 0,
		borderRadius: 24,
		shadow: 0,
	};
}

function fullLayer(width: number, height: number): LayoutSceneLayerTransform {
	return {
		x: 0,
		y: 0,
		width,
		height,
		opacity: 1,
		borderRadius: 0,
		shadow: 0,
	};
}

function layer(params: {
	x: number;
	y: number;
	width: number;
	height: number;
	opacity?: number;
	borderRadius?: number;
	shadow?: number;
}): LayoutSceneLayerTransform {
	return {
		x: params.x,
		y: params.y,
		width: params.width,
		height: params.height,
		opacity: params.opacity ?? 1,
		borderRadius: params.borderRadius ?? 24,
		shadow: params.shadow ?? 0.24,
	};
}

function bubbleAt(params: {
	stageWidth: number;
	stageHeight: number;
	position: "bottom-right" | "bottom-left" | "top-right";
	shape: "circle" | "landscape";
}): LayoutSceneLayerTransform {
	const margin = Math.round(Math.min(params.stageWidth, params.stageHeight) * 0.035);
	const width =
		params.shape === "landscape"
			? Math.round(params.stageWidth * 0.22)
			: Math.round(Math.min(params.stageWidth, params.stageHeight) * 0.2);
	const height = params.shape === "landscape" ? Math.round(width * 0.66) : width;
	const x =
		params.position === "bottom-left"
			? margin
			: params.stageWidth - width - margin;
	const y =
		params.position === "top-right"
			? margin
			: params.stageHeight - height - margin;

	return layer({
		x,
		y,
		width,
		height,
		borderRadius: params.shape === "circle" ? Math.min(width, height) / 2 : 28,
		shadow: 0.5,
	});
}

export function getLayoutPresetTransform(params: {
	preset: LayoutScenePreset;
	stageWidth: number;
	stageHeight: number;
	webcam: WebcamOverlaySettings;
	zoomScale?: number;
	hasWebcam: boolean;
}): ResolvedLayoutScene {
	const { webcam, hasWebcam } = params;
	const stageWidth = Math.max(1, params.stageWidth);
	const stageHeight = Math.max(1, params.stageHeight);
	const preset = hasWebcam ? params.preset : "screen-only";
	const fullScreen = fullLayer(stageWidth, stageHeight);
	const hidden = hiddenLayer(stageWidth, stageHeight);
	const bubbleSize = getWebcamOverlaySizePx({
		containerWidth: stageWidth,
		containerHeight: stageHeight,
		sizePercent: webcam.size,
		margin: webcam.margin,
		zoomScale: params.zoomScale ?? 1,
		reactToZoom: webcam.reactToZoom,
	});
	const bubblePosition = getWebcamOverlayPosition({
		containerWidth: stageWidth,
		containerHeight: stageHeight,
		size: bubbleSize,
		margin: webcam.margin,
		positionPreset: webcam.positionPreset,
		positionX: webcam.positionX,
		positionY: webcam.positionY,
		legacyCorner: webcam.corner,
	});
	const bubble: LayoutSceneLayerTransform = {
		x: bubblePosition.x,
		y: bubblePosition.y,
		width: bubbleSize,
		height: bubbleSize,
		opacity: 1,
		borderRadius: webcam.cornerRadius,
		shadow: webcam.shadow,
	};

	if (preset === "screen-only") {
		return { preset, screen: fullScreen, webcam: hidden };
	}

	if (preset === "screen-center") {
		const width = stageWidth * 0.82;
		const height = stageHeight * 0.78;
		return {
			preset,
			screen: layer({
				x: (stageWidth - width) / 2,
				y: (stageHeight - height) / 2,
				width,
				height,
				borderRadius: 24,
				shadow: 0.32,
			}),
			webcam: hidden,
		};
	}

	if (preset === "webcam-only") {
		return { preset, screen: { ...hidden, opacity: 0 }, webcam: fullScreen };
	}

	if (preset === "camera-circle") {
		const size = Math.min(stageWidth, stageHeight) * 0.72;
		return {
			preset,
			screen: { ...hidden, opacity: 0 },
			webcam: layer({
				x: (stageWidth - size) / 2,
				y: (stageHeight - size) / 2,
				width: size,
				height: size,
				borderRadius: size / 2,
				shadow: 0.5,
			}),
		};
	}

	if (
		preset === "bubble-bottom-right" ||
		preset === "bubble-bottom-left" ||
		preset === "bubble-top-right" ||
		preset === "bubble-bottom-right-landscape"
	) {
		const position =
			preset === "bubble-bottom-left"
				? "bottom-left"
				: preset === "bubble-top-right"
					? "top-right"
					: "bottom-right";
		return {
			preset,
			screen: fullScreen,
			webcam: bubbleAt({
				stageWidth,
				stageHeight,
				position,
				shape: preset === "bubble-bottom-right-landscape" ? "landscape" : "circle",
			}),
		};
	}

	if (preset === "side-by-side") {
		const gap = Math.round(Math.min(stageWidth, stageHeight) * 0.035);
		const columnWidth = (stageWidth - gap) / 2;
		return {
			preset,
			screen: {
				x: 0,
				y: 0,
				width: columnWidth,
				height: stageHeight,
				opacity: 1,
				borderRadius: 20,
				shadow: 0.18,
			},
			webcam: {
				x: columnWidth + gap,
				y: 0,
				width: columnWidth,
				height: stageHeight,
				opacity: 1,
				borderRadius: 20,
				shadow: 0.18,
			},
		};
	}

	if (
		preset === "split-right" ||
		preset === "split-right-overlap" ||
		preset === "split-right-50" ||
		preset === "split-left" ||
		preset === "split-left-overlap" ||
		preset === "split-left-50"
	) {
		const gap = Math.round(Math.min(stageWidth, stageHeight) * 0.035);
		const isLeft = preset.startsWith("split-left");
		const isOverlap = preset.endsWith("overlap");
		const isHalf = preset.endsWith("50");
		const screenWidth = isHalf ? (stageWidth - gap) / 2 : stageWidth * 0.74;
		const cameraWidth = isHalf ? (stageWidth - gap) / 2 : stageWidth * 0.22;
		const cameraHeight = isHalf ? stageHeight : stageHeight * 0.88;
		const screenX = isLeft
			? isHalf
				? cameraWidth + gap
				: isOverlap
					? stageWidth * 0.16
					: cameraWidth + gap
			: 0;
		const cameraX = isLeft
			? 0
			: isHalf
				? screenWidth + gap
				: isOverlap
					? stageWidth - cameraWidth - stageWidth * 0.035
					: screenWidth + gap;
		const cameraY = isHalf ? 0 : (stageHeight - cameraHeight) / 2;

		return {
			preset,
			screen: layer({
				x: screenX,
				y: isOverlap ? stageHeight * 0.045 : 0,
				width: isOverlap ? stageWidth * 0.78 : screenWidth,
				height: isOverlap ? stageHeight * 0.91 : stageHeight,
				borderRadius: 24,
				shadow: isOverlap ? 0.34 : 0.2,
			}),
			webcam: layer({
				x: cameraX,
				y: cameraY,
				width: cameraWidth,
				height: cameraHeight,
				borderRadius: 34,
				shadow: 0.42,
			}),
		};
	}

	if (preset === "presenter") {
		const insetWidth = stageWidth * 0.34;
		const insetHeight = insetWidth * (9 / 16);
		return {
			preset,
			screen: {
				x: stageWidth - insetWidth - stageWidth * 0.045,
				y: stageHeight - insetHeight - stageHeight * 0.06,
				width: insetWidth,
				height: insetHeight,
				opacity: 1,
				borderRadius: 18,
				shadow: 0.45,
			},
			webcam: fullScreen,
		};
	}

	return { preset, screen: fullScreen, webcam: bubble };
}

export function resolveActiveLayoutRegion(
	timeMs: number,
	layoutRegions: LayoutRegion[],
): LayoutRegion | null {
	const rounded = Math.max(0, Math.round(timeMs));
	return (
		[...layoutRegions]
			.sort((left, right) => left.startMs - right.startMs)
			.find((region) => rounded >= region.startMs && rounded < region.endMs) ?? null
	);
}

export function resolveLayoutSceneAtTime(params: {
	timeMs: number;
	layoutRegions: LayoutRegion[];
	stageWidth: number;
	stageHeight: number;
	webcam: WebcamOverlaySettings;
	zoomScale?: number;
	hasWebcam: boolean;
}): ResolvedLayoutScene | null {
	const active = resolveActiveLayoutRegion(params.timeMs, params.layoutRegions);
	const sorted = [...params.layoutRegions].sort((left, right) => left.startMs - right.startMs);

	if (!active) {
		const previous = [...sorted]
			.reverse()
			.find((region) => params.timeMs >= region.endMs);
		if (!previous) return null;

		const transitionMs = clamp(
			previous.transitionMs || DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
			0,
			4000,
		);
		if (transitionMs <= 0 || params.timeMs - previous.endMs >= transitionMs) return null;

		const from = getLayoutPresetTransform({ ...params, preset: previous.preset });
		const to = getLayoutPresetTransform({ ...params, preset: DEFAULT_LAYOUT_SCENE_PRESET });
		const progress = ease((params.timeMs - previous.endMs) / transitionMs, previous.easing);
		return {
			preset: DEFAULT_LAYOUT_SCENE_PRESET,
			screen: mixLayer(from.screen, to.screen, progress),
			webcam: mixLayer(from.webcam, to.webcam, progress),
		};
	}

	const activeIndex = sorted.findIndex((region) => region.id === active.id);
	const previous = activeIndex > 0 ? sorted[activeIndex - 1] : null;
	const base = getLayoutPresetTransform({ ...params, preset: active.preset });
	const transitionMs = clamp(
		active.transitionMs || DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
		0,
		4000,
	);

	if (previous && transitionMs > 0 && params.timeMs - active.startMs < transitionMs) {
		const from = getLayoutPresetTransform({
			...params,
			preset:
				previous.endMs >= active.startMs
					? previous.preset
					: DEFAULT_LAYOUT_SCENE_PRESET,
		});
		const progress = ease((params.timeMs - active.startMs) / transitionMs, active.easing);
		return {
			preset: active.preset,
			screen: mixLayer(from.screen, base.screen, progress),
			webcam: mixLayer(from.webcam, base.webcam, progress),
		};
	}

	if (!previous && transitionMs > 0 && params.timeMs - active.startMs < transitionMs) {
		const from = getLayoutPresetTransform({ ...params, preset: DEFAULT_LAYOUT_SCENE_PRESET });
		const progress = ease((params.timeMs - active.startMs) / transitionMs, active.easing);
		return {
			preset: active.preset,
			screen: mixLayer(from.screen, base.screen, progress),
			webcam: mixLayer(from.webcam, base.webcam, progress),
		};
	}

	return base;
}

export function normalizeLayoutRegion(region: Partial<LayoutRegion>, index = 0): LayoutRegion {
	const startMs = Number.isFinite(region.startMs) ? Math.max(0, Math.round(region.startMs!)) : 0;
	const rawEnd = Number.isFinite(region.endMs)
		? Math.round(region.endMs!)
		: startMs + 4000;
	const preset = LAYOUT_SCENE_PRESETS.some((option) => option.value === region.preset)
		? region.preset!
		: DEFAULT_LAYOUT_SCENE_PRESET;
	const easing =
		region.easing === "linear" || region.easing === "snappy" || region.easing === "smooth"
			? region.easing
			: DEFAULT_LAYOUT_SCENE_EASING;

	return {
		id: typeof region.id === "string" && region.id ? region.id : `layout-${index + 1}`,
		startMs,
		endMs: Math.max(startMs + 1, rawEnd),
		preset,
		transitionMs: Number.isFinite(region.transitionMs)
			? clamp(Math.round(region.transitionMs!), 0, 4000)
			: DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
		easing,
	};
}
