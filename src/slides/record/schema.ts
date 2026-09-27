import type {
	AnnotationRegion,
	AudioRegion,
	CropRegion,
	ClipRegion,
	ClipTransitionType,
	CursorStyle,
	CursorTelemetryPoint,
	LayoutCameraSettings,
	LayoutRegion,
	LayoutScenePreset,
	MediaTrackLayer,
	Padding,
	PropertyKeyframe,
	SpeedRegion,
	TrimRegion,
	WebcamOverlaySettings,
	ZoomDepth,
	ZoomFocus,
	ZoomMode,
	ZoomRegion,
	ZoomTransitionEasing,
} from "@/components/video-editor/types";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import {
	isArrayOf,
	isFiniteNumber,
	isObjectRecord,
	isOptional,
	isOptionalNullable,
	isString,
} from "@/core/slides/validation";

export type {
	AnnotationRegion,
	AspectRatio,
	AudioRegion,
	ClipRegion,
	CursorStyle,
	CursorTelemetryPoint,
	LayoutCameraSettings,
	LayoutRegion,
	Padding,
	WebcamOverlaySettings,
	ZoomDepth,
	ZoomFocus,
	ZoomMode,
	ZoomRegion,
	ZoomTransitionEasing,
};

export interface RecordSlideMeta {
	videoPath?: string;
	webcamPath?: string | null;
	microphoneAudioPath?: string | null;
	systemAudioPath?: string | null;
	cursorTelemetryPath?: string | null;
	cursorTelemetry?: CursorTelemetryPoint[] | null;
	wallpaper: string;
	shadowIntensity: number;
	backgroundBlur: number;
	borderRadius: number;
	padding: Padding;
	cropRegion?: { x: number; y: number; width: number; height: number };
	zoomRegions: ZoomRegion[];
	clipRegions?: ClipRegion[];
	trimRegions: Array<{ id: string; startMs: number; endMs: number }>;
	speedRegions: Array<{ id: string; startMs: number; endMs: number; speed: number }>;
	layoutRegions: LayoutRegion[];
	annotationRegions: AnnotationRegion[];
	audioRegions: AudioRegion[];
	webcam: WebcamOverlaySettings;
	showCursor: boolean;
	cursorSmoothing: number;
	cursorStyle?: CursorStyle;
	cursorSize?: number;
	cursorClickBounce?: number;
	cursorSway?: number;
	zoomMotionBlur?: number;
	connectZooms?: boolean;
	zoomInDurationMs?: number;
	zoomOutDurationMs?: number;
	frame?: string | null;
}

function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
	return typeof value === "string" && values.some((candidate) => candidate === value);
}

function isCropRegion(value: unknown): value is CropRegion {
	if (!isObjectRecord(value)) return false;
	return (
		isFiniteNumber(value.x) &&
		isFiniteNumber(value.y) &&
		isFiniteNumber(value.width) &&
		isFiniteNumber(value.height)
	);
}

function isPadding(value: unknown): value is Padding {
	if (!isObjectRecord(value)) return false;
	return (
		isFiniteNumber(value.top) &&
		isFiniteNumber(value.bottom) &&
		isFiniteNumber(value.left) &&
		isFiniteNumber(value.right) &&
		isOptional(value.linked, isBoolean)
	);
}

function isZoomFocus(value: unknown): value is ZoomFocus {
	return (
		isObjectRecord(value) && isFiniteNumber(value.cx) && isFiniteNumber(value.cy)
	);
}

function isZoomRegion(value: unknown): value is ZoomRegion {
	if (!isObjectRecord(value)) return false;
	return (
		isString(value.id) &&
		isFiniteNumber(value.startMs) &&
		isFiniteNumber(value.endMs) &&
		isFiniteNumber(value.depth) &&
		[1, 2, 3, 4, 5, 6].some((depth) => depth === value.depth) &&
		isZoomFocus(value.focus) &&
		isOptional(value.mode, (candidate): candidate is ZoomMode =>
			isOneOf(candidate, ["auto", "manual"]),
		)
	);
}

function isClipTransitionType(value: unknown): value is ClipTransitionType {
	return isOneOf(value, ["none", "fade-black", "fade-white", "slide-left", "slide-right", "zoom-push"]);
}

function isClipRegion(value: unknown): value is ClipRegion {
	if (!isObjectRecord(value)) return false;
	return (
		isString(value.id) &&
		isFiniteNumber(value.startMs) &&
		isFiniteNumber(value.endMs) &&
		isFiniteNumber(value.speed) &&
		isOptional(value.muted, isBoolean) &&
		isOptional(value.showSourceAudio, isBoolean) &&
		isOptional(value.transitionIn, isClipTransitionType) &&
		isOptional(value.transitionInDurationMs, isFiniteNumber)
	);
}

function isTrimRegion(value: unknown): value is TrimRegion {
	return (
		isObjectRecord(value) &&
		isString(value.id) &&
		isFiniteNumber(value.startMs) &&
		isFiniteNumber(value.endMs)
	);
}

function isSpeedRegion(value: unknown): value is SpeedRegion {
	if (!isObjectRecord(value)) return false;
	return (
		isString(value.id) &&
		isFiniteNumber(value.startMs) &&
		isFiniteNumber(value.endMs) &&
		isFiniteNumber(value.speed) &&
		[0.25, 0.5, 0.75, 1.25, 1.5, 1.75, 2].some((speed) => speed === value.speed)
	);
}

const layoutPresets = [
	"screen-only",
	"screen-center",
	"webcam-only",
	"camera-circle",
	"bubble",
	"bubble-bottom-right",
	"bubble-bottom-left",
	"bubble-top-right",
	"bubble-bottom-right-landscape",
	"presenter",
	"side-by-side",
	"split-right",
	"split-right-overlap",
	"split-right-50",
	"split-left",
	"split-left-overlap",
	"split-left-50",
] as const;

function isLayoutScenePreset(value: unknown): value is LayoutScenePreset {
	return isOneOf(value, layoutPresets);
}

function isLayoutCameraSettings(value: unknown): value is Partial<LayoutCameraSettings> {
	if (!isObjectRecord(value)) return false;
	return (
		(value.shape === undefined || isOneOf(value.shape, ["circle", "rectangle"])) &&
		(value.position === undefined ||
			isOneOf(value.position, ["top-left", "top-center", "top-right", "center-left", "center", "center-right", "bottom-left", "bottom-center", "bottom-right"])) &&
		(value.size === undefined || isFiniteNumber(value.size)) &&
		(value.shape !== undefined || value.position !== undefined || value.size !== undefined)
	);
}

function isLayoutRegion(value: unknown): value is LayoutRegion {
	if (!isObjectRecord(value)) return false;
	return (
		isString(value.id) &&
		isFiniteNumber(value.startMs) &&
		isFiniteNumber(value.endMs) &&
		isLayoutScenePreset(value.preset) &&
		(value.cameraSettings === undefined || isLayoutCameraSettings(value.cameraSettings)) &&
		isFiniteNumber(value.transitionMs) &&
		isOneOf(value.easing, ["smooth", "snappy", "linear"])
	);
}

function isWebcamOverlaySettings(value: unknown): value is WebcamOverlaySettings {
	if (!isObjectRecord(value)) return false;
	return (
		isBoolean(value.enabled) &&
		(value.sourcePath === null || isString(value.sourcePath)) &&
		isFiniteNumber(value.timeOffsetMs) &&
		isBoolean(value.mirror) &&
		isCropRegion(value.cropRegion) &&
		(value.cropAspectRatio === undefined ||
			(isFiniteNumber(value.cropAspectRatio) &&
				value.cropAspectRatio >= 0.05 &&
				value.cropAspectRatio <= 20)) &&
		(value.cornerRadiusPercent === undefined ||
			(isFiniteNumber(value.cornerRadiusPercent) &&
				value.cornerRadiusPercent >= 0 &&
				value.cornerRadiusPercent <= 1)) &&
		isOneOf(value.corner, ["top-left", "top-right", "bottom-left", "bottom-right"]) &&
		isOneOf(value.positionPreset, [
			"top-left",
			"top-right",
			"bottom-left",
			"bottom-right",
			"top-center",
			"center-left",
			"center",
			"center-right",
			"bottom-center",
			"custom",
		]) &&
		isFiniteNumber(value.positionX) &&
		isFiniteNumber(value.positionY) &&
		isFiniteNumber(value.size) &&
		isBoolean(value.reactToZoom) &&
		isFiniteNumber(value.cornerRadius) &&
		isFiniteNumber(value.shadow) &&
		isFiniteNumber(value.margin)
	);
}

function isCursorTelemetryPoint(value: unknown): value is CursorTelemetryPoint {
	if (!isObjectRecord(value)) return false;
	return (
		isFiniteNumber(value.timeMs) &&
		isFiniteNumber(value.cx) &&
		isFiniteNumber(value.cy) &&
		isOptional(value.pressure, isFiniteNumber) &&
		isOptional(value.interactionType, (candidate) =>
			isOneOf(candidate, ["move", "click", "double-click", "right-click", "middle-click", "mouseup"]),
		) &&
		isOptional(value.cursorType, (candidate) =>
			isOneOf(candidate, [
				"arrow",
				"text",
				"pointer",
				"crosshair",
				"open-hand",
				"closed-hand",
				"resize-ew",
				"resize-ns",
				"not-allowed",
			]),
		)
	);
}

function isAudioRegion(value: unknown): value is AudioRegion {
	if (!isObjectRecord(value)) return false;
	return (
		isString(value.id) &&
		isFiniteNumber(value.startMs) &&
		isFiniteNumber(value.endMs) &&
		isString(value.audioPath) &&
		isOptional(value.sourceOffsetMs, isFiniteNumber) &&
		isOptional(value.playbackRate, isFiniteNumber) &&
		isFiniteNumber(value.volume) &&
		isOptional(value.normalize, isBoolean) &&
		isOptional(value.trackIndex, isFiniteNumber) &&
		isOptional(value.ducking, isBoolean)
	);
}

function isPropertyKeyframe(value: unknown): value is PropertyKeyframe {
	if (!isObjectRecord(value)) return false;
	const validValue =
		isFiniteNumber(value.value) ||
		(isObjectRecord(value.value) &&
			isFiniteNumber(value.value.x) &&
			isFiniteNumber(value.value.y));
	return (
		isString(value.id) &&
		isFiniteNumber(value.timeMs) &&
		isOneOf(value.property, ["position", "scale", "rotation", "opacity"]) &&
		validValue &&
		isOneOf(value.easing, [
			"linear",
			"ease-in",
			"ease-out",
			"ease-in-out",
			"spring-bounce",
			"cubic-bezier",
		]) &&
		(value.bezier === undefined ||
			(Array.isArray(value.bezier) &&
				value.bezier.length === 4 &&
				value.bezier.every(isFiniteNumber)))
	);
}

function isAnnotationRegion(value: unknown): value is AnnotationRegion {
	if (
		!isObjectRecord(value) ||
		!isObjectRecord(value.position) ||
		!isObjectRecord(value.size) ||
		!isObjectRecord(value.style)
	) {
		return false;
	}
	const style = value.style;
	const figure = value.figureData;
	return (
		isString(value.id) &&
		isFiniteNumber(value.startMs) &&
		isFiniteNumber(value.endMs) &&
		isOneOf(value.type, ["video", "text", "image", "gif", "figure", "blur"]) &&
		isString(value.content) &&
		isFiniteNumber(value.position.x) &&
		isFiniteNumber(value.position.y) &&
		isFiniteNumber(value.size.width) &&
		isFiniteNumber(value.size.height) &&
		isString(style.color) &&
		isString(style.backgroundColor) &&
		isFiniteNumber(style.fontSize) &&
		isString(style.fontFamily) &&
		isOneOf(style.fontWeight, ["normal", "bold"]) &&
		isOneOf(style.fontStyle, ["normal", "italic"]) &&
		isOneOf(style.textDecoration, ["none", "underline"]) &&
		isOneOf(style.textAlign, ["left", "center", "right"]) &&
		isFiniteNumber(style.borderRadius) &&
		isOptional(style.opacity, isFiniteNumber) &&
		isOptional(style.dropShadow, isBoolean) &&
		isOptional(style.dropShadowColor, isString) &&
		isOptional(style.dropShadowBlur, isFiniteNumber) &&
		isOptional(style.dropShadowOffsetX, isFiniteNumber) &&
		isOptional(style.dropShadowOffsetY, isFiniteNumber) &&
		isFiniteNumber(value.zIndex) &&
		isOptional(value.trackIndex, isFiniteNumber) &&
		(figure === undefined ||
			(isObjectRecord(figure) &&
				isOneOf(figure.arrowDirection, [
					"up",
					"down",
					"left",
					"right",
					"up-right",
					"up-left",
					"down-right",
					"down-left",
				]) &&
				isString(figure.color) &&
				isFiniteNumber(figure.strokeWidth))) &&
		isOptional(value.blurIntensity, isFiniteNumber) &&
		isOptional(value.blurColor, isString) &&
		isOptional(value.gifPath, isString) &&
		isOptional(value.gifDataUrl, isString) &&
		isOptional(value.imageFilePath, isString) &&
		isOptional(value.keyframeTimeOffsetMs, isFiniteNumber) &&
		isOptional(value.videoFilePath, isString) &&
		isOptional(value.sourceOffsetMs, isFiniteNumber) &&
		isOptional(value.playbackRate, isFiniteNumber) &&
		isOptional(value.animationIn, (candidate) => isOneOf(candidate, ["none", "fade", "slide-up"])) &&
		isOptional(value.animationOut, (candidate) => isOneOf(candidate, ["none", "fade"])) &&
		isOptional(value.animationDurationMs, isFiniteNumber) &&
		isOptional(value.name, isString) &&
		isOptional(value.locked, isBoolean) &&
		isOptional(value.visible, isBoolean) &&
		isOptional(value.muted, isBoolean) &&
		isOptional(value.blendMode, (candidate) =>
			isOneOf(candidate, ["normal", "multiply", "screen", "overlay", "soft-light"]),
		) &&
		isOptional(value.rotationDeg, isFiniteNumber) &&
		isOptional(value.keyframes, (candidate) => isArrayOf(candidate, isPropertyKeyframe))
	);
}

function isMediaTrackLayer(value: unknown): value is MediaTrackLayer {
	if (!isObjectRecord(value) || !isObjectRecord(value.transform)) return false;
	return (
		isString(value.id) &&
		isString(value.name) &&
		isFiniteNumber(value.trackIndex) &&
		isOneOf(value.type, ["video", "image", "gif", "text", "sticker", "figure", "blur"]) &&
		isOptional(value.sourcePath, isString) &&
		isOptional(value.dataUrl, isString) &&
		isFiniteNumber(value.startMs) &&
		isFiniteNumber(value.endMs) &&
		isFiniteNumber(value.zIndex) &&
		isOptional(value.locked, isBoolean) &&
		isOptional(value.muted, isBoolean) &&
		isOptional(value.visible, isBoolean) &&
		isOptional(value.blendMode, (candidate) =>
			isOneOf(candidate, ["normal", "multiply", "screen", "overlay", "soft-light"]),
		) &&
		isFiniteNumber(value.opacity) &&
		isFiniteNumber(value.transform.x) &&
		isFiniteNumber(value.transform.y) &&
		isFiniteNumber(value.transform.width) &&
		isFiniteNumber(value.transform.height) &&
		isOptional(value.transform.rotationDeg, isFiniteNumber) &&
		isOptional(value.keyframes, (candidate) => isArrayOf(candidate, isPropertyKeyframe))
	);
}

export const recordMetadataGuards = {
	annotationRegion: isAnnotationRegion,
	audioRegion: isAudioRegion,
	clipRegion: isClipRegion,
	cursorTelemetryPoint: isCursorTelemetryPoint,
	cropRegion: isCropRegion,
	layoutPreset: isLayoutScenePreset,
	layoutRegion: isLayoutRegion,
	mediaTrackLayer: isMediaTrackLayer,
	padding: isPadding,
	trimRegion: isTrimRegion,
	webcam: isWebcamOverlaySettings,
	zoomRegion: isZoomRegion,
};

/** Runtime schema check for the Record slide's canonical persisted metadata. */
export function isValidRecordSlideMeta(value: unknown): value is RecordSlideMeta {
	if (!isObjectRecord(value)) return false;
	return (
		isOptional(value.videoPath, isString) &&
		isOptionalNullable(value.webcamPath, isString) &&
		isOptionalNullable(value.microphoneAudioPath, isString) &&
		isOptionalNullable(value.systemAudioPath, isString) &&
		isOptionalNullable(value.cursorTelemetryPath, isString) &&
		(value.cursorTelemetry === undefined ||
			value.cursorTelemetry === null ||
			isArrayOf(value.cursorTelemetry, isCursorTelemetryPoint)) &&
		isString(value.wallpaper) &&
		isFiniteNumber(value.shadowIntensity) &&
		isFiniteNumber(value.backgroundBlur) &&
		isFiniteNumber(value.borderRadius) &&
		isPadding(value.padding) &&
		isOptional(value.cropRegion, isCropRegion) &&
		isArrayOf(value.zoomRegions, isZoomRegion) &&
		isOptional(value.clipRegions, (candidate) => isArrayOf(candidate, isClipRegion)) &&
		isArrayOf(value.trimRegions, isTrimRegion) &&
		isArrayOf(value.speedRegions, isSpeedRegion) &&
		isArrayOf(value.layoutRegions, isLayoutRegion) &&
		isArrayOf(value.annotationRegions, isAnnotationRegion) &&
		isArrayOf(value.audioRegions, isAudioRegion) &&
		isWebcamOverlaySettings(value.webcam) &&
		isBoolean(value.showCursor) &&
		isFiniteNumber(value.cursorSmoothing) &&
		isOptional(value.cursorStyle, isString) &&
		isOptional(value.cursorSize, isFiniteNumber) &&
		isOptional(value.cursorClickBounce, isFiniteNumber) &&
		isOptional(value.cursorSway, isFiniteNumber) &&
		isOptional(value.zoomMotionBlur, isFiniteNumber) &&
		isOptional(value.connectZooms, isBoolean) &&
		isOptional(value.zoomInDurationMs, isFiniteNumber) &&
		isOptional(value.zoomOutDurationMs, isFiniteNumber) &&
		isOptionalNullable(value.frame, isString)
	);
}

export function createDefaultRecordMeta(): RecordSlideMeta {
	return {
		wallpaper: "wallpapers/tahoe-light.jpg",
		shadowIntensity: 0.67,
		backgroundBlur: 0,
		borderRadius: 12.5,
		padding: { top: 20, bottom: 20, left: 20, right: 20, linked: true },
		zoomRegions: [],
		clipRegions: [],
		trimRegions: [],
		speedRegions: [],
		layoutRegions: [],
		annotationRegions: [],
		audioRegions: [],
		webcam: {
			enabled: false,
			sourcePath: null,
			timeOffsetMs: 0,
			mirror: true,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			corner: "bottom-right",
			positionPreset: "bottom-right",
			positionX: 1,
			positionY: 1,
			size: 25,
			reactToZoom: true,
			cornerRadius: 50,
			shadow: 0.5,
			margin: 20,
		},
		showCursor: true,
		cursorSmoothing: 0.67,
		cursorStyle: "macos",
		cursorSize: 2.5,
		cursorClickBounce: 2.5,
		cursorSway: 0.4,
		zoomMotionBlur: 0.35,
		connectZooms: true,
		zoomInDurationMs: 200,
		zoomOutDurationMs: 200,
	};
}
