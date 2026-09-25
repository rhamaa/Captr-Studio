export type ZoomDepth = 1 | 2 | 3 | 4 | 5 | 6;

export interface ZoomFocus {
	cx: number; // normalized horizontal center (0-1)
	cy: number; // normalized vertical center (0-1)
}

export type ZoomMode = "auto" | "manual";

export interface ZoomRegion {
	id: string;
	startMs: number;
	endMs: number;
	depth: ZoomDepth;
	focus: ZoomFocus;
	mode?: ZoomMode;
}

export interface CursorTelemetryPoint {
	timeMs: number;
	cx: number;
	cy: number;
	pressure?: number;
	interactionType?:
		| "move"
		| "click"
		| "double-click"
		| "right-click"
		| "middle-click"
		| "mouseup";
	cursorType?:
		| "arrow"
		| "text"
		| "pointer"
		| "crosshair"
		| "open-hand"
		| "closed-hand"
		| "resize-ew"
		| "resize-ns"
		| "not-allowed";
}

export interface CursorVisualSettings {
	size: number;
	smoothing: number;
	motionBlur: number;
	clickBounce: number;
	clickBounceDuration: number;
	sway: number;
	style: CursorStyle;
}

export type CursorStyle = "macos" | "tahoe" | "tahoe-inverted" | "dot" | "figma" | (string & {}); // extension-contributed cursor styles
export const DEFAULT_CURSOR_STYLE: CursorStyle = "macos";

export type SlideMode = "record" | "video";

export type EditorEffectSection =
	| "scene"
	| "cursor"
	| "webcam"
	| "layout"
	| "settings"
	| "zoom"
	| "frame"
	| "crop"
	| "extensions"
	| "clip"
	| "audio"
	| "media"
	| "audio-record"
	| "video-adjust"
	| "transitions"
	| `ext:${string}`;

export type ZoomTransitionEasing = "recordly" | "glide" | "smooth" | "snappy" | "linear";

export type WebcamCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";
export type WebcamPositionPreset =
	| WebcamCorner
	| "top-center"
	| "center-left"
	| "center"
	| "center-right"
	| "bottom-center"
	| "custom";

export interface WebcamOverlaySettings {
	enabled: boolean;
	sourcePath: string | null;
	timeOffsetMs: number;
	mirror: boolean;
	cropRegion: CropRegion;
	corner: WebcamCorner;
	positionPreset: WebcamPositionPreset;
	positionX: number;
	positionY: number;
	size: number;
	reactToZoom: boolean;
	cornerRadius: number;
	shadow: number;
	margin: number;
}

export type LayoutScenePreset =
	| "screen-only"
	| "screen-center"
	| "webcam-only"
	| "camera-circle"
	| "bubble"
	| "bubble-bottom-right"
	| "bubble-bottom-left"
	| "bubble-top-right"
	| "bubble-bottom-right-landscape"
	| "presenter"
	| "side-by-side"
	| "split-right"
	| "split-right-overlap"
	| "split-right-50"
	| "split-left"
	| "split-left-overlap"
	| "split-left-50";

export type LayoutSceneEasing = "smooth" | "snappy" | "linear";

export interface LayoutRegion {
	id: string;
	startMs: number;
	endMs: number;
	preset: LayoutScenePreset;
	transitionMs: number;
	easing: LayoutSceneEasing;
}

export const DEFAULT_LAYOUT_SCENE_PRESET: LayoutScenePreset = "bubble";
export const DEFAULT_LAYOUT_SCENE_TRANSITION_MS = 600;
export const DEFAULT_LAYOUT_SCENE_EASING: LayoutSceneEasing = "smooth";
export const DEFAULT_LAYOUT_SCENE_DURATION_MS = 4000;

export const DEFAULT_CURSOR_SIZE = 3.0;
export const DEFAULT_CURSOR_SMOOTHING = 0.67;
export const DEFAULT_CURSOR_MOTION_BLUR = 0.4;
export const DEFAULT_CURSOR_CLICK_BOUNCE = 2.5;
export const DEFAULT_CURSOR_CLICK_BOUNCE_DURATION = 350;
export const DEFAULT_CURSOR_SWAY = 0.4;
export const DEFAULT_CAMERA_PERSPECTIVE_TILT = 0;
export const DEFAULT_ZOOM_SMOOTHNESS = 0.5;
export const DEFAULT_ZOOM_MOTION_BLUR = 0.35;
export interface ZoomMotionBlurTuning {
	panVelocityThreshold: number;
	zoomVelocityThreshold: number;
	maxDirectionalBlurPx: number;
	maxRadialBlurStrength: number;
	panResponsePerSecond: number;
	zoomResponsePerSecond: number;
	zoomSafeZoneRadiusPx: number;
}

export const DEFAULT_ZOOM_MOTION_BLUR_TUNING: ZoomMotionBlurTuning = {
	panVelocityThreshold: 0,
	zoomVelocityThreshold: 0,
	maxDirectionalBlurPx: 41.8,
	maxRadialBlurStrength: 1,
	panResponsePerSecond: 11,
	zoomResponsePerSecond: 9,
	zoomSafeZoneRadiusPx: 6,
};
export const DEFAULT_ZOOM_IN_DURATION_MS = 1522.575;
export const DEFAULT_ZOOM_IN_OVERLAP_MS = 500;
export const DEFAULT_ZOOM_OUT_DURATION_MS = 1015.05;
export const DEFAULT_CONNECTED_ZOOM_GAP_MS = 1500;
export const DEFAULT_CONNECTED_ZOOM_DURATION_MS = 1000;
export const DEFAULT_ZOOM_IN_EASING: ZoomTransitionEasing = "recordly";
export const DEFAULT_ZOOM_OUT_EASING: ZoomTransitionEasing = "recordly";
export const DEFAULT_CONNECTED_ZOOM_EASING: ZoomTransitionEasing = "glide";
export const DEFAULT_WEBCAM_SIZE = 40;
export const DEFAULT_WEBCAM_REACT_TO_ZOOM = true;
export const DEFAULT_WEBCAM_CORNER_RADIUS = 90;
export const DEFAULT_WEBCAM_SHADOW = 0.67;
export const DEFAULT_WEBCAM_MARGIN = 24;
export const DEFAULT_WEBCAM_POSITION_PRESET: WebcamPositionPreset = "bottom-right";
export const DEFAULT_WEBCAM_POSITION_X = 1;
export const DEFAULT_WEBCAM_POSITION_Y = 1;
export const DEFAULT_WEBCAM_TIME_OFFSET_MS = 0;

export const DEFAULT_WEBCAM_OVERLAY: WebcamOverlaySettings = {
	enabled: false,
	sourcePath: null,
	timeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
	mirror: true,
	cropRegion: { x: 0, y: 0, width: 1, height: 1 },
	corner: "bottom-right",
	positionPreset: DEFAULT_WEBCAM_POSITION_PRESET,
	positionX: DEFAULT_WEBCAM_POSITION_X,
	positionY: DEFAULT_WEBCAM_POSITION_Y,
	size: DEFAULT_WEBCAM_SIZE,
	reactToZoom: DEFAULT_WEBCAM_REACT_TO_ZOOM,
	cornerRadius: DEFAULT_WEBCAM_CORNER_RADIUS,
	shadow: DEFAULT_WEBCAM_SHADOW,
	margin: DEFAULT_WEBCAM_MARGIN,
};

export interface TrimRegion {
	id: string;
	startMs: number;
	endMs: number;
}

export type ClipTransitionType =
	| "none"
	| "fade-black"
	| "fade-white"
	| "slide-left"
	| "slide-right"
	| "zoom-push";

export const DEFAULT_CLIP_TRANSITION_DURATION_MS = 400;

export interface ClipRegion {
	id: string;
	startMs: number;
	endMs: number;
	speed: number;
	muted?: boolean;
	showSourceAudio?: boolean;
	transitionIn?: ClipTransitionType;
	transitionInDurationMs?: number;
}

export type ClipOrigin = "recorded" | "uploaded";

export interface ClipTransition {
	type: ClipTransitionType;
	durationMs: number;
}

export type SceneVisualSettings = Pick<
	import("./projectPersistence").ProjectEditorState,
	| "padding"
	| "borderRadius"
	| "shadowIntensity"
	| "backgroundBlur"
	| "frame"
	| "audioDuckingSettings"
>;

export interface SlideAssetFile {
	id: string;
	name: string;
	path: string;
	size: number;
	mtimeMs: number;
	type: "video" | "audio" | "image";
	subfolder?: string;
	category?: "main" | "layer" | "audio" | "graphic" | "imported";
}

export interface ClipEntry {
	sceneSettings?: SceneVisualSettings;
	id: string;
	origin?: ClipOrigin; // "recorded" (internal screen/cam capture) vs "uploaded" (external media)
	slideMode?: SlideMode; // "record" (screen/cam/telemetry) vs "video" (standard video editor mode)
	videoPath: string; // Absolute path to original video clip file
	webcamPath?: string | null; // Optional companion webcam file
	microphoneAudioPath?: string | null; // Optional companion mic sidecar
	systemAudioPath?: string | null; // Optional companion system audio sidecar
	cursorTelemetryPath?: string | null; // Optional telemetry file
	cursorTelemetry?: CursorTelemetryPoint[] | null;
	startMsOffset: number; // Offset from start of timeline in ms
	durationMs: number; // Duration of this clip in ms
	label?: string; // e.g. "Take 1", "External Video"
	// Tella.tv style independent per-clip styling & timings:
	wallpaper?: string;
	cropRegion?: CropRegion;
	layoutPreset?: LayoutScenePreset;
	layoutRegions?: LayoutRegion[];
	webcam?: WebcamOverlaySettings;
	zoomRegions?: ZoomRegion[];
	trimStartMs?: number;
	trimEndMs?: number;
	speed?: number;
	showCursor?: boolean; // false for uploaded by default, true for recorded
	/** Transition entering this scene, matching preview and export semantics. */
	transitionIn?: ClipTransition;
	/** @deprecated Legacy field was rendered as an incoming transition. */
	transitionToNext?: ClipTransition;
	annotationRegions?: AnnotationRegion[];
	audioRegions?: AudioRegion[];
	/** Legacy read-only format; new edits use annotationRegions. */
	mediaTrackLayers?: MediaTrackLayer[];
	keyframes?: PropertyKeyframe[];
	/** Exclusive per-slide asset library for video and multimedia slides */
	assetFiles?: SlideAssetFile[];
}

export function getClipSourceEndMs(clip: ClipRegion): number {
	const displayDurationMs = Math.max(0, clip.endMs - clip.startMs);
	const speed = Number.isFinite(clip.speed) && clip.speed > 0 ? clip.speed : 1;
	return Math.round(clip.startMs + displayDurationMs * speed);
}

export function getTimelineDurationMs(clips: ClipRegion[], sourceDurationMs: number): number {
	const baseDurationMs = Math.max(0, Math.round(sourceDurationMs));
	if (clips.length === 0) {
		return baseDurationMs;
	}

	return clips.reduce(
		(durationMs, clip) => Math.max(durationMs, Math.max(0, Math.round(clip.endMs))),
		baseDurationMs,
	);
}

export function sortClipRegions(clips: ClipRegion[]): ClipRegion[] {
	return [...clips].sort((left, right) => left.startMs - right.startMs);
}

function getSafeClipSpeed(clip: ClipRegion) {
	return Number.isFinite(clip.speed) && clip.speed > 0 ? clip.speed : 1;
}

function clampToNearestClipBoundary(
	timeMs: number,
	clips: ClipRegion[],
	kind: "timeline" | "source",
) {
	let nearestTimeMs = Math.round(timeMs);
	let nearestDistance = Number.POSITIVE_INFINITY;

	for (const clip of clips) {
		const boundaries =
			kind === "timeline"
				? [clip.startMs, clip.endMs]
				: [clip.startMs, getClipSourceEndMs(clip)];

		for (const boundary of boundaries) {
			const distance = Math.abs(timeMs - boundary);
			if (distance < nearestDistance) {
				nearestDistance = distance;
				nearestTimeMs = Math.round(boundary);
			}
		}
	}

	return nearestTimeMs;
}

export function mapTimelineTimeToSourceTime(timeMs: number, clips: ClipRegion[]): number {
	const roundedTimeMs = Math.round(timeMs);
	const sortedClips = sortClipRegions(clips);

	for (const clip of sortedClips) {
		if (roundedTimeMs < clip.startMs || roundedTimeMs > clip.endMs) {
			continue;
		}

		return Math.round(clip.startMs + (roundedTimeMs - clip.startMs) * getSafeClipSpeed(clip));
	}

	if (sortedClips.length === 0) {
		return roundedTimeMs;
	}

	return clampToNearestClipBoundary(roundedTimeMs, sortedClips, "timeline");
}

export function mapSourceTimeToTimelineTime(timeMs: number, clips: ClipRegion[]): number {
	const roundedTimeMs = Math.round(timeMs);
	const sortedClips = sortClipRegions(clips);

	for (const clip of sortedClips) {
		const sourceEndMs = getClipSourceEndMs(clip);
		if (roundedTimeMs < clip.startMs || roundedTimeMs > sourceEndMs) {
			continue;
		}

		return Math.round(clip.startMs + (roundedTimeMs - clip.startMs) / getSafeClipSpeed(clip));
	}

	if (sortedClips.length === 0) {
		return roundedTimeMs;
	}

	return clampToNearestClipBoundary(roundedTimeMs, sortedClips, "source");
}

export function findClipAtTimelineTime(timeMs: number, clips: ClipRegion[]): ClipRegion | null {
	const roundedTimeMs = Math.round(timeMs);
	return (
		sortClipRegions(clips).find(
			(clip) => roundedTimeMs >= clip.startMs && roundedTimeMs < clip.endMs,
		) ?? null
	);
}

export function extendAutoFullTrackClip(
	clips: ClipRegion[],
	autoClipId: string | null,
	previousAutoEndMs: number | null,
	nextTotalDurationMs: number,
): ClipRegion[] | null {
	if (
		!autoClipId ||
		!Number.isFinite(previousAutoEndMs) ||
		!Number.isFinite(nextTotalDurationMs) ||
		nextTotalDurationMs <= (previousAutoEndMs ?? 0) ||
		clips.length !== 1
	) {
		return null;
	}

	const [clip] = clips;
	if (
		clip.id !== autoClipId ||
		clip.startMs !== 0 ||
		clip.speed !== 1 ||
		clip.endMs !== previousAutoEndMs
	) {
		return null;
	}

	return [{ ...clip, endMs: nextTotalDurationMs }];
}

/** Convert clip regions (kept segments) to trim regions (gaps to remove). */
export function clipsToTrims(clips: ClipRegion[], totalDurationMs: number): TrimRegion[] {
	if (clips.length === 0) return [];
	const sorted = [...clips].sort((a, b) => a.startMs - b.startMs);
	const trims: TrimRegion[] = [];
	let cursor = 0;
	let trimId = 1;
	for (const clip of sorted) {
		if (clip.startMs > cursor) {
			trims.push({ id: `trim-gap-${trimId++}`, startMs: cursor, endMs: clip.startMs });
		}
		cursor = getClipSourceEndMs(clip);
	}
	if (totalDurationMs - cursor > 100) {
		trims.push({ id: `trim-gap-${trimId++}`, startMs: cursor, endMs: totalDurationMs });
	}
	return trims;
}

/** Convert legacy trim regions to clip regions (complement). */
export function trimsToClips(trims: TrimRegion[], totalDurationMs: number): ClipRegion[] {
	if (trims.length === 0) return [{ id: "clip-1", startMs: 0, endMs: totalDurationMs, speed: 1 }];
	const sorted = [...trims].sort((a, b) => a.startMs - b.startMs);
	const clips: ClipRegion[] = [];
	let cursor = 0;
	let clipId = 1;
	for (const trim of sorted) {
		if (trim.startMs > cursor) {
			clips.push({ id: `clip-${clipId++}`, startMs: cursor, endMs: trim.startMs, speed: 1 });
		}
		cursor = trim.endMs;
	}
	if (cursor < totalDurationMs) {
		clips.push({ id: `clip-${clipId++}`, startMs: cursor, endMs: totalDurationMs, speed: 1 });
	}
	return clips;
}

export type AnnotationType = "video" | "text" | "image" | "gif" | "figure" | "blur";
export const BLUR_ANNOTATION_STRENGTH = 20;
export const BASE_PREVIEW_WIDTH = 1920;
export const BASE_PREVIEW_HEIGHT = 1080;

export type ArrowDirection =
	| "up"
	| "down"
	| "left"
	| "right"
	| "up-right"
	| "up-left"
	| "down-right"
	| "down-left";

export interface FigureData {
	arrowDirection: ArrowDirection;
	color: string;
	strokeWidth: number;
}

export interface AnnotationPosition {
	x: number;
	y: number;
}

export interface AnnotationSize {
	width: number;
	height: number;
}

export interface AnnotationTextStyle {
	color: string;
	backgroundColor: string;
	fontSize: number; // pixels
	fontFamily: string;
	fontWeight: "normal" | "bold";
	fontStyle: "normal" | "italic";
	textDecoration: "none" | "underline";
	textAlign: "left" | "center" | "right";
	borderRadius: number;
	opacity?: number;
	dropShadow?: boolean;
	dropShadowColor?: string;
	dropShadowBlur?: number;
	dropShadowOffsetX?: number;
	dropShadowOffsetY?: number;
}

function getDefaultAnnotationFontFamily() {
	return '"SF Pro Display", "SF Pro Text", Helvetica, sans-serif';
}

export type MediaBlendMode = "normal" | "multiply" | "screen" | "overlay" | "soft-light";

export type KeyframeProperty = "position" | "scale" | "rotation" | "opacity";
export type KeyframeEasing =
	| "linear"
	| "ease-in"
	| "ease-out"
	| "ease-in-out"
	| "spring-bounce"
	| "cubic-bezier";

export interface PropertyKeyframe {
	id: string;
	timeMs: number;
	property: KeyframeProperty;
	value: number | { x: number; y: number };
	easing: KeyframeEasing;
	bezier?: [number, number, number, number];
}

export interface MediaTrackLayer {
	id: string;
	name: string;
	trackIndex: number;
	type: "video" | "image" | "gif" | "text" | "sticker" | "figure" | "blur";
	sourcePath?: string;
	dataUrl?: string; // transient
	startMs: number;
	endMs: number;
	zIndex: number;
	locked?: boolean;
	muted?: boolean;
	visible?: boolean;
	blendMode?: MediaBlendMode;
	opacity: number; // 0..1
	transform: {
		x: number; // 0..100% canvas
		y: number; // 0..100% canvas
		width: number; // 0..100% canvas
		height: number; // 0..100% canvas
		rotationDeg?: number; // -360..360
	};
	keyframes?: PropertyKeyframe[];
}

export interface AnnotationRegion {
	id: string;
	startMs: number;
	endMs: number;
	type: AnnotationType;
	content: string; // Legacy - still used for current type
	textContent?: string; // Separate storage for text
	imageContent?: string; // Separate storage for image data URL
	position: AnnotationPosition;
	size: AnnotationSize;
	style: AnnotationTextStyle;
	zIndex: number;
	trackIndex?: number;
	figureData?: FigureData;
	blurIntensity?: number;
	blurColor?: string;
	gifPath?: string; // persisted to disk — absolute path to .gif file
	gifDataUrl?: string; // TRANSIENT: runtime-only, re-loaded from gifPath on project open, NOT serialized
	imageFilePath?: string; // absolute file path for file-based images (Piece 2)
	keyframeTimeOffsetMs?: number;
	videoFilePath?: string; // absolute file path for overlay video B-roll
	sourceOffsetMs?: number;
	playbackRate?: number;
	animationIn?: "none" | "fade" | "slide-up";
	animationOut?: "none" | "fade";
	animationDurationMs?: number;
	// Phase 7 Multi-Track & Keyframe extension
	name?: string;
	locked?: boolean;
	visible?: boolean;
	muted?: boolean;
	blendMode?: MediaBlendMode;
	rotationDeg?: number;
	keyframes?: PropertyKeyframe[];
}

export const DEFAULT_ANNOTATION_POSITION: AnnotationPosition = {
	x: 50,
	y: 50,
};

export const DEFAULT_ANNOTATION_SIZE: AnnotationSize = {
	width: 30,
	height: 20,
};

export const DEFAULT_ANNOTATION_STYLE: AnnotationTextStyle = {
	color: "#ffffff",
	backgroundColor: "transparent",
	fontSize: 32,
	fontFamily: getDefaultAnnotationFontFamily(),
	fontWeight: "bold",
	fontStyle: "normal",
	textDecoration: "none",
	textAlign: "center",
	borderRadius: 8,
	opacity: 1,
	dropShadow: false,
	dropShadowColor: "rgba(0,0,0,0.5)",
	dropShadowBlur: 8,
	dropShadowOffsetX: 0,
	dropShadowOffsetY: 4,
};

export const DEFAULT_FIGURE_DATA: FigureData = {
	arrowDirection: "right",
	color: "#2563EB",
	strokeWidth: 4,
};

export interface CropRegion {
	x: number;
	y: number;
	width: number;
	height: number;
}

export const DEFAULT_CROP_REGION: CropRegion = {
	x: 0,
	y: 0,
	width: 1,
	height: 1,
};

export interface Padding {
	top: number;
	bottom: number;
	left: number;
	right: number;
	linked?: boolean;
}

export const DEFAULT_PADDING: Padding = {
	top: 20,
	bottom: 20,
	left: 20,
	right: 20,
	linked: true,
};
export type {
	SourceAudioTrackSetting,
	SourceAudioTrackSettings,
} from "@/components/video-editor/audio/audioTypes";

export interface AudioRegion {
	id: string;
	startMs: number;
	endMs: number;
	audioPath: string;
	sourceOffsetMs?: number;
	playbackRate?: number;
	volume: number;
	normalize?: boolean;
	trackIndex?: number;
	ducking?: boolean;
}

export interface AudioDuckingSettings {
	enabled: boolean;
	duckingAmountDb: number; // e.g. -14 dB (attenuation down to ~20%)
	attackMs: number; // fade down duration, e.g. 200ms
	releaseMs: number; // fade up duration, e.g. 600ms
	holdMs: number; // pause hold duration to prevent volume pumping between words, e.g. 350ms
}

export const DEFAULT_AUDIO_DUCKING_SETTINGS: AudioDuckingSettings = {
	enabled: false,
	duckingAmountDb: -14,
	attackMs: 200,
	releaseMs: 600,
	holdMs: 350,
};

export type PlaybackSpeed = 0.25 | 0.5 | 0.75 | 1.25 | 1.5 | 1.75 | 2;

export interface SpeedRegion {
	id: string;
	startMs: number;
	endMs: number;
	speed: PlaybackSpeed;
}

export const SPEED_OPTIONS: Array<{ speed: PlaybackSpeed; label: string }> = [
	{ speed: 0.25, label: "0.25×" },
	{ speed: 0.5, label: "0.5×" },
	{ speed: 0.75, label: "0.75×" },
	{ speed: 1.25, label: "1.25×" },
	{ speed: 1.5, label: "1.5×" },
	{ speed: 1.75, label: "1.75×" },
	{ speed: 2, label: "2×" },
];

export const DEFAULT_PLAYBACK_SPEED: PlaybackSpeed = 1.5;

export const ZOOM_DEPTH_SCALES: Record<ZoomDepth, number> = {
	1: 1.25,
	2: 1.5,
	3: 1.8,
	4: 2.2,
	5: 3.5,
	6: 5.0,
};

export const DEFAULT_ZOOM_DEPTH: ZoomDepth = 3;
export const DEFAULT_AUTO_ZOOM_DEPTH: ZoomDepth = 2;

export function clampFocusToDepth(focus: ZoomFocus, _depth: ZoomDepth): ZoomFocus {
	return {
		cx: clamp(focus.cx, 0, 1),
		cy: clamp(focus.cy, 0, 1),
	};
}

function clamp(value: number, min: number, max: number) {
	if (Number.isNaN(value)) return (min + max) / 2;
	return Math.min(max, Math.max(min, value));
}
