import type {
	LayoutCameraSettings,
	LayoutRegion,
	LayoutSceneEasing,
	LayoutScenePreset,
	WebcamCorner,
	LayoutCameraPosition,
	WebcamOverlaySettings,
} from "./types";
import {
	DEFAULT_LAYOUT_SCENE_EASING,
	DEFAULT_LAYOUT_SCENE_PRESET,
	DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
} from "./types";
import {
	getWebcamCornerRadiusPx,
	getWebcamOverlayDimensions,
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
	/** Stable base layout; keep the screen's existing scene styling. */
	isDefault?: boolean;
	screen: LayoutSceneLayerTransform;
	webcam: LayoutSceneLayerTransform;
}

export const LAYOUT_SCENE_CATEGORIES: Array<{
	id: "camera-bubble" | "camera-only" | "screen-only";
	label: string;
	description: string;
	value: LayoutScenePreset;
}> = [
	{
		id: "camera-bubble",
		label: "Camera Bubble",
		description: "Floating camera over screen",
		value: "bubble",
	},
	{
		id: "camera-only",
		label: "Camera Only",
		description: "Full webcam focus",
		value: "webcam-only",
	},
	{
		id: "screen-only",
		label: "Screen Only",
		description: "Full screen focus",
		value: "screen-only",
	},
];

export const LAYOUT_SCENE_CATEGORY_DETAILS: Record<
	(typeof LAYOUT_SCENE_CATEGORIES)[number]["id"],
	Array<{ value: LayoutScenePreset; label: string }>
> = {
	"camera-bubble": [{ value: "bubble", label: "Floating bubble" }],
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

const LEGACY_BUBBLE_LAYOUT_PRESETS: LayoutScenePreset[] = [
	"bubble-bottom-right",
	"bubble-bottom-left",
	"bubble-top-right",
	"bubble-bottom-right-landscape",
	"side-by-side",
	"split-right",
	"split-right-overlap",
	"split-right-50",
	"split-left",
	"split-left-overlap",
	"split-left-50",
	"presenter",
];
const REMOVED_SPLIT_LAYOUT_PRESETS: LayoutScenePreset[] = [
	"side-by-side",
	"split-right",
	"split-right-overlap",
	"split-right-50",
	"split-left",
	"split-left-overlap",
	"split-left-50",
	"presenter",
];

const ALL_LAYOUT_SCENE_PRESETS = [
	...LAYOUT_SCENE_PRESETS,
	...LEGACY_BUBBLE_LAYOUT_PRESETS.map((value) => ({ value, label: value })),
];

export function getLayoutSceneCategory(preset: LayoutScenePreset) {
	return (
		LAYOUT_SCENE_CATEGORIES.find((category) =>
			LAYOUT_SCENE_CATEGORY_DETAILS[category.id].some((option) => option.value === preset),
		) ?? LAYOUT_SCENE_CATEGORIES[0]
	);
}

const LAYOUT_CAMERA_POSITIONS: LayoutCameraPosition[] = [
	"top-left",
	"top-center",
	"top-right",
	"center-left",
	"center",
	"center-right",
	"bottom-left",
	"bottom-center",
	"bottom-right",
];

function isLayoutCameraPosition(value: unknown): value is LayoutCameraPosition {
	return (
		typeof value === "string" && LAYOUT_CAMERA_POSITIONS.includes(value as LayoutCameraPosition)
	);
}

export function getLayoutCameraSettings(
	region: Pick<LayoutRegion, "preset" | "cameraSettings">,
	webcam: WebcamOverlaySettings,
): LayoutCameraSettings {
	const legacyPosition: WebcamCorner | null =
		region.preset === "bubble-bottom-left"
			? "bottom-left"
			: region.preset === "bubble-top-right"
				? "top-right"
				: region.preset === "bubble-bottom-right" ||
						region.preset === "bubble-bottom-right-landscape"
					? "bottom-right"
					: null;
	return {
		position: region.cameraSettings?.position ?? legacyPosition ?? "bottom-right",
		size: region.cameraSettings?.size ?? webcam.size,
	};
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
	position: LayoutCameraPosition;
	aspectRatio?: number;
	size?: number;
	margin?: number;
	cornerRadius?: number;
	cornerRadiusPercent?: number;
	shadow?: number;
	zoomScale?: number;
	reactToZoom?: boolean;
}): LayoutSceneLayerTransform {
	const margin = Math.round(
		params.margin ?? Math.min(params.stageWidth, params.stageHeight) * 0.035,
	);
	const requestedWidth =
		params.size === undefined
			? Math.round(Math.min(params.stageWidth, params.stageHeight) * 0.2)
			: getWebcamOverlaySizePx({
					containerWidth: params.stageWidth,
					containerHeight: params.stageHeight,
					sizePercent: params.size,
					margin,
					zoomScale: params.zoomScale ?? 1,
					reactToZoom: params.reactToZoom ?? true,
				});
	const aspectRatio = clamp(params.aspectRatio ?? 1, 0.05, 20);
	const { width, height } = getWebcamOverlayDimensions({
		containerWidth: params.stageWidth,
		containerHeight: params.stageHeight,
		size: requestedWidth,
		aspectRatio,
		margin,
	});
	const { x, y } = getWebcamOverlayPosition({
		containerWidth: params.stageWidth,
		containerHeight: params.stageHeight,
		size: width,
		height,
		margin,
		positionPreset: params.position,
		positionX: 0.5,
		positionY: 0.5,
		legacyCorner: "bottom-right",
	});

	return layer({
		x,
		y,
		width,
		height,
		borderRadius: getWebcamCornerRadiusPx({
			width,
			height,
			cornerRadius: params.cornerRadius,
			cornerRadiusPercent: params.cornerRadiusPercent,
			fallback: 28,
		}),
		shadow: params.shadow ?? 0.5,
	});
}

export function getLayoutPresetTransform(params: {
	preset: LayoutScenePreset;
	stageWidth: number;
	stageHeight: number;
	webcam: WebcamOverlaySettings;
	cameraSettings?: LayoutCameraSettings;
	zoomScale?: number;
	hasWebcam: boolean;
}): ResolvedLayoutScene {
	const { webcam, hasWebcam } = params;
	const stageWidth = Math.max(1, params.stageWidth);
	const stageHeight = Math.max(1, params.stageHeight);
	const preset = hasWebcam
		? REMOVED_SPLIT_LAYOUT_PRESETS.includes(params.preset)
			? "bubble"
			: params.preset
		: "screen-only";
	const fullScreen = fullLayer(stageWidth, stageHeight);
	const hidden = hiddenLayer(stageWidth, stageHeight);
	const requestedBubbleSize = getWebcamOverlaySizePx({
		containerWidth: stageWidth,
		containerHeight: stageHeight,
		sizePercent: webcam.size,
		margin: webcam.margin,
		zoomScale: params.zoomScale ?? 1,
		reactToZoom: webcam.reactToZoom,
	});
	const { width: bubbleSize, height: bubbleHeight } = getWebcamOverlayDimensions({
		containerWidth: stageWidth,
		containerHeight: stageHeight,
		size: requestedBubbleSize,
		aspectRatio: webcam.cropAspectRatio ?? 1,
		margin: webcam.margin,
	});
	const bubblePosition = getWebcamOverlayPosition({
		containerWidth: stageWidth,
		containerHeight: stageHeight,
		size: bubbleSize,
		height: bubbleHeight,
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
		height: bubbleHeight,
		opacity: 1,
		borderRadius: getWebcamCornerRadiusPx({
			width: bubbleSize,
			height: bubbleHeight,
			cornerRadius: webcam.cornerRadius,
			cornerRadiusPercent: webcam.cornerRadiusPercent,
		}),
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
		params.cameraSettings &&
		(preset === "bubble" ||
			preset === "bubble-bottom-right" ||
			preset === "bubble-bottom-left" ||
			preset === "bubble-top-right" ||
			preset === "bubble-bottom-right-landscape")
	) {
		const cameraSettings = getLayoutCameraSettings(
			{ preset, cameraSettings: params.cameraSettings },
			webcam,
		);
		return {
			preset,
			screen: fullScreen,
			webcam: bubbleAt({
				stageWidth,
				stageHeight,
				position: cameraSettings.position,
				aspectRatio: webcam.cropAspectRatio,
				size: cameraSettings.size,
				margin: webcam.margin,
				cornerRadius: webcam.cornerRadius,
				cornerRadiusPercent: webcam.cornerRadiusPercent,
				shadow: webcam.shadow,
				zoomScale: params.zoomScale,
				reactToZoom: webcam.reactToZoom,
			}),
		};
	}

	if (
		preset === "bubble-bottom-right" ||
		preset === "bubble-bottom-left" ||
		preset === "bubble-top-right" ||
		preset === "bubble-bottom-right-landscape"
	) {
		const position: WebcamCorner =
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
				aspectRatio: webcam.cropAspectRatio,
				cornerRadius: webcam.cornerRadius,
				cornerRadiusPercent: webcam.cornerRadiusPercent,
			}),
		};
	}

	return { preset, screen: fullScreen, webcam: bubble };
}

export function resolveActiveLayoutRegion(
	timeMs: number,
	layoutRegions: LayoutRegion[],
): LayoutRegion | null {
	const time = Math.max(0, timeMs);
	return (
		[...layoutRegions]
			.sort((left, right) => left.startMs - right.startMs)
			.find((region) => time >= region.startMs && time < region.endMs) ?? null
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
}): ResolvedLayoutScene {
	const timeMs = Math.max(0, params.timeMs);
	const active = resolveActiveLayoutRegion(timeMs, params.layoutRegions);
	const sorted = [...params.layoutRegions].sort((left, right) => left.startMs - right.startMs);
	const getRegionTransform = (region: LayoutRegion | null) =>
		getLayoutPresetTransform({
			...params,
			preset: region?.preset ?? DEFAULT_LAYOUT_SCENE_PRESET,
			cameraSettings: region
				? getLayoutCameraSettings(region, params.webcam)
				: { position: "bottom-right", size: params.webcam.size },
		});
	const defaultScene: ResolvedLayoutScene = { ...getRegionTransform(null), isDefault: true };

	if (!active) {
		const previous = [...sorted].reverse().find((region) => timeMs >= region.endMs);
		if (!previous) return defaultScene;
		const next = sorted.find((region) => region.startMs > previous.endMs);

		const transitionMs = clamp(
			previous.transitionMs ?? DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
			0,
			Math.min(4000, next ? next.startMs - previous.endMs : 4000),
		);
		if (transitionMs <= 0 || timeMs - previous.endMs >= transitionMs) return defaultScene;

		const from = getRegionTransform(previous);
		const to = defaultScene;
		const progress = ease((timeMs - previous.endMs) / transitionMs, previous.easing);
		return {
			preset: DEFAULT_LAYOUT_SCENE_PRESET,
			screen: mixLayer(from.screen, to.screen, progress),
			webcam: mixLayer(from.webcam, to.webcam, progress),
		};
	}

	const activeIndex = sorted.findIndex((region) => region.id === active.id);
	const previous = activeIndex > 0 ? sorted[activeIndex - 1] : null;
	const base = getRegionTransform(active);
	const transitionMs = clamp(
		active.transitionMs ?? DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
		0,
		Math.min(4000, active.endMs - active.startMs),
	);

	if (transitionMs > 0 && timeMs - active.startMs < transitionMs) {
		const from =
			previous && previous.endMs >= active.startMs ? getRegionTransform(previous) : defaultScene;
		const progress = ease((timeMs - active.startMs) / transitionMs, active.easing);
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
	const rawEnd = Number.isFinite(region.endMs) ? Math.round(region.endMs!) : startMs + 4000;
	const preset = ALL_LAYOUT_SCENE_PRESETS.some((option) => option.value === region.preset)
		? REMOVED_SPLIT_LAYOUT_PRESETS.includes(region.preset!)
			? "bubble"
			: region.preset!
		: DEFAULT_LAYOUT_SCENE_PRESET;
	const easing =
		region.easing === "linear" || region.easing === "snappy" || region.easing === "smooth"
			? region.easing
			: DEFAULT_LAYOUT_SCENE_EASING;
	const rawCameraSettings = region.cameraSettings;
	const cameraSettings: Partial<LayoutCameraSettings> | undefined = rawCameraSettings
		? {
				...(rawCameraSettings.shape === "circle" || rawCameraSettings.shape === "rectangle"
					? { shape: rawCameraSettings.shape }
					: {}),
				...(isLayoutCameraPosition(rawCameraSettings.position)
					? { position: rawCameraSettings.position }
					: {}),
				...(Number.isFinite(rawCameraSettings.size)
					? { size: clamp(rawCameraSettings.size!, 10, 100) }
					: {}),
			}
		: undefined;

	return {
		id: typeof region.id === "string" && region.id ? region.id : `layout-${index + 1}`,
		startMs,
		endMs: Math.max(startMs + 1, rawEnd),
		preset,
		...(cameraSettings && Object.keys(cameraSettings).length > 0 ? { cameraSettings } : {}),
		transitionMs: Number.isFinite(region.transitionMs)
			? clamp(Math.round(region.transitionMs!), 0, 4000)
			: DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
		easing,
	};
}
