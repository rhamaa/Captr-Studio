import type { SourceAudioTrackSettings } from "@/components/video-editor/audio/audioTypes";
import type {
	ExportBackendPreference,
	ExportEncodingMode,
	ExportFormat,
	ExportMp4FrameRate,
	ExportPipelineModel,
	ExportQuality,
	GifFrameRate,
	GifSizePreset,
} from "@/lib/exporter";
import { isValidMp4FrameRate } from "@/lib/exporter";
import {
	TEMPORAL_MOTION_BLUR_DEFAULT_SAMPLE_COUNT,
	TEMPORAL_MOTION_BLUR_DEFAULT_SHUTTER_FRACTION,
	TEMPORAL_MOTION_BLUR_MAX_SAMPLE_COUNT,
	TEMPORAL_MOTION_BLUR_MAX_SHUTTER_FRACTION,
	TEMPORAL_MOTION_BLUR_MIN_SAMPLE_COUNT,
	TEMPORAL_MOTION_BLUR_MIN_SHUTTER_FRACTION,
} from "@/lib/exporter/temporalMotionBlur";
import { DEFAULT_WALLPAPER_PATH } from "@/lib/wallpapers";
import { ASPECT_RATIOS, type AspectRatio, isCustomAspectRatio } from "@/utils/aspectRatioUtils";
import { normalizeColorGrading } from "./colorGrading";
import { CURSOR_MOTION_PRESETS, resolveCursorMotionPresetId } from "./cursorMotionPresets";
import { normalizeLayoutRegion } from "./layoutScenes";
import {
	type AnnotationRegion,
	type AudioDuckingSettings,
	type AudioRegion,
	type AutoCaptionAnimation,
	type AutoCaptionSettings,
	type CaptionCue,
	type CaptionCueWord,
	type CaptionHighlightStyle,
	type ClipEntry,
	type ClipRegion,
	type ClipTransitionType,
	type ColorGradingSettings,
	type CropRegion,
	type CursorStyle,
	DEFAULT_ANNOTATION_POSITION,
	DEFAULT_ANNOTATION_SIZE,
	DEFAULT_ANNOTATION_STYLE,
	DEFAULT_AUDIO_DUCKING_SETTINGS,
	DEFAULT_AUTO_CAPTION_SETTINGS,
	DEFAULT_CAMERA_PERSPECTIVE_TILT,
	DEFAULT_CONNECTED_ZOOM_DURATION_MS,
	DEFAULT_CONNECTED_ZOOM_EASING,
	DEFAULT_CONNECTED_ZOOM_GAP_MS,
	DEFAULT_CROP_REGION,
	DEFAULT_CURSOR_STYLE,
	DEFAULT_CURSOR_SWAY,
	DEFAULT_FIGURE_DATA,
	DEFAULT_LAYOUT_SCENE_EASING,
	DEFAULT_LAYOUT_SCENE_PRESET,
	DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
	DEFAULT_PADDING,
	DEFAULT_PLAYBACK_SPEED,
	DEFAULT_WEBCAM_CORNER_RADIUS,
	DEFAULT_WEBCAM_MARGIN,
	DEFAULT_WEBCAM_OVERLAY,
	DEFAULT_WEBCAM_POSITION_PRESET,
	DEFAULT_WEBCAM_POSITION_X,
	DEFAULT_WEBCAM_POSITION_Y,
	DEFAULT_WEBCAM_REACT_TO_ZOOM,
	DEFAULT_WEBCAM_SHADOW,
	DEFAULT_WEBCAM_SIZE,
	DEFAULT_WEBCAM_TIME_OFFSET_MS,
	DEFAULT_ZOOM_DEPTH,
	DEFAULT_ZOOM_IN_EASING,
	DEFAULT_ZOOM_IN_OVERLAP_MS,
	DEFAULT_ZOOM_MOTION_BLUR,
	DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	DEFAULT_ZOOM_OUT_EASING,
	DEFAULT_ZOOM_SMOOTHNESS,
	getDefaultCaptionFontFamily,
	type LayoutRegion,
	type LayoutScenePreset,
	type Padding,
	type SpeedRegion,
	type TrimRegion,
	type WebcamOverlaySettings,
	type ZoomMotionBlurTuning,
	type ZoomRegion,
	type ZoomTransitionEasing,
} from "./types";
import { normalizeWebcamCropRegion } from "./webcamOverlay";

export const PROJECT_VERSION = 1;

const DEFAULT_MOTION_PRESET = CURSOR_MOTION_PRESETS.focused;

export interface ProjectEditorState {
	wallpaper: string;
	shadowIntensity: number;
	backgroundBlur: number;
	colorGrading: ColorGradingSettings;
	zoomMotionBlur: number;
	zoomMotionBlurTuning: ZoomMotionBlurTuning;
	zoomTemporalMotionBlur: number;
	zoomMotionBlurSampleCount: number | null;
	zoomMotionBlurShutterFraction: number | null;
	connectZooms: boolean;
	zoomInDurationMs: number;
	zoomInOverlapMs: number;
	zoomOutDurationMs: number;
	connectedZoomGapMs: number;
	connectedZoomDurationMs: number;
	zoomInEasing: ZoomTransitionEasing;
	zoomOutEasing: ZoomTransitionEasing;
	connectedZoomEasing: ZoomTransitionEasing;
	showCursor: boolean;
	loopCursor: boolean;
	cursorStyle: CursorStyle;
	cursorSize: number;
	cursorSmoothing: number;
	cursorSpringStiffnessMultiplier: number;
	cursorSpringDampingMultiplier: number;
	cursorSpringMassMultiplier: number;
	cameraSpringStiffnessMultiplier: number;
	cameraSpringDampingMultiplier: number;
	cameraSpringMassMultiplier: number;
	zoomSmoothness: number;
	zoomClassicMode: boolean;
	cursorMotionBlur: number;
	cursorClickBounce: number;
	cursorClickBounceDuration: number;
	cursorSway: number;
	cameraPerspectiveTilt: number;
	borderRadius: number;
	padding: Padding;
	/** Selected frame ID (e.g. "recordly.frames/browser-dark"), or null for none */
	frame: string | null;
	cropRegion: CropRegion;
	zoomRegions: ZoomRegion[];
	trimRegions: TrimRegion[];
	clipRegions: ClipRegion[];
	autoFullTrackClipId?: string | null;
	autoFullTrackClipEndMs?: number | null;
	speedRegions: SpeedRegion[];
	annotationRegions: AnnotationRegion[];
	audioRegions: AudioRegion[];
	audioDuckingSettings: AudioDuckingSettings;
	autoCaptions: CaptionCue[];
	autoCaptionSettings: AutoCaptionSettings;
	webcam: WebcamOverlaySettings;
	layoutRegions: LayoutRegion[];
	aspectRatio: AspectRatio;
	sourceAudioTrackSettingsByClip?: Record<string, SourceAudioTrackSettings>;
	defaultSourceAudioTrackSettings?: SourceAudioTrackSettings;
	exportEncodingMode: ExportEncodingMode;
	exportBackendPreference: ExportBackendPreference;
	exportPipelineModel: ExportPipelineModel;
	exportQuality: ExportQuality;
	mp4FrameRate: ExportMp4FrameRate;
	exportFormat: ExportFormat;
	gifFrameRate: GifFrameRate;
	gifLoop: boolean;
	gifSizePreset: GifSizePreset;
}

export interface EditorProjectData {
	version: number;
	projectId?: string;
	videoPath: string;
	clips?: ClipEntry[];
	editor: Partial<ProjectEditorState>;
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

type PersistedDevMotionBlurSettings = {
	zoomMotionBlurTuning?: unknown;
};

export function stripPersistedDevMotionBlurSettings<T extends PersistedDevMotionBlurSettings>(
	editor: T,
): Omit<T, keyof PersistedDevMotionBlurSettings> {
	const { zoomMotionBlurTuning: _zoomMotionBlurTuning, ...persistedEditor } = editor;

	return persistedEditor;
}

export function normalizeExportEncodingMode(value: unknown): ExportEncodingMode {
	if (value === "fast" || value === "balanced" || value === "quality") {
		return value;
	}

	return "balanced";
}

export function normalizeExportBackendPreference(value: unknown): ExportBackendPreference {
	if (value === "auto" || value === "webcodecs" || value === "breeze") {
		return value;
	}

	return "auto";
}

export function normalizeExportPipelineModel(value: unknown): ExportPipelineModel {
	if (value === "modern" || value === "legacy") {
		return value;
	}

	return "modern";
}

export function normalizeExportMp4FrameRate(value: unknown): ExportMp4FrameRate {
	return typeof value === "number" && isValidMp4FrameRate(value) ? value : 30;
}

function normalizeZoomTransitionEasing(
	value: unknown,
	fallback: ZoomTransitionEasing,
): ZoomTransitionEasing {
	return value === "recordly" ||
		value === "glide" ||
		value === "smooth" ||
		value === "snappy" ||
		value === "linear"
		? value
		: fallback;
}

function normalizeAutoCaptionAnimation(
	value: unknown,
	fallback: AutoCaptionAnimation,
): AutoCaptionAnimation {
	return value === "none" || value === "fade" || value === "rise" || value === "pop"
		? value
		: fallback;
}

function normalizeCaptionHighlightStyle(
	value: unknown,
	fallback: CaptionHighlightStyle,
): CaptionHighlightStyle {
	return value === "classic" ||
		value === "karaoke-pop" ||
		value === "hormozi" ||
		value === "neon-glow" ||
		value === "box-highlight"
		? value
		: fallback;
}

function isFileUrl(value: string): boolean {
	return /^file:\/\//i.test(value);
}

function encodePathSegments(pathname: string, keepWindowsDrive = false): string {
	return pathname
		.split("/")
		.map((segment, index) => {
			if (!segment) return "";
			if (keepWindowsDrive && index === 1 && /^[a-zA-Z]:$/.test(segment)) {
				return segment;
			}
			return encodeURIComponent(segment);
		})
		.join("/");
}

export function toFileUrl(filePath: string): string {
	const normalized = filePath.replace(/\\/g, "/");

	// Windows drive path: C:/Users/...
	if (/^[a-zA-Z]:\//.test(normalized)) {
		return `file://${encodePathSegments(`/${normalized}`, true)}`;
	}

	// UNC path: //server/share/...
	if (normalized.startsWith("//")) {
		const [host, ...pathParts] = normalized.replace(/^\/+/, "").split("/");
		const encodedPath = pathParts.map((part) => encodeURIComponent(part)).join("/");
		return encodedPath ? `file://${host}/${encodedPath}` : `file://${host}/`;
	}

	const absolutePath = normalized.startsWith("/") ? normalized : `/${normalized}`;
	return `file://${encodePathSegments(absolutePath)}`;
}

export function fromFileUrl(fileUrl: string): string {
	const value = fileUrl.trim();
	if (!isFileUrl(value)) {
		return fileUrl;
	}

	try {
		const url = new URL(value);
		const pathname = decodeURIComponent(url.pathname);

		if (url.host && url.host !== "localhost") {
			const uncPath = `//${url.host}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
			return uncPath.replace(/\//g, "\\");
		}

		if (/^\/[A-Za-z]:/.test(pathname)) {
			return pathname.slice(1);
		}

		return pathname;
	} catch {
		const rawFallbackPath = value.replace(/^file:\/\//i, "");
		let fallbackPath = rawFallbackPath;
		try {
			fallbackPath = decodeURIComponent(rawFallbackPath);
		} catch {
			// Keep raw best-effort path if percent decoding fails.
		}
		return fallbackPath.replace(/^\/([a-zA-Z]:)/, "$1");
	}
}

export function deriveNextId(prefix: string, ids: string[]): number {
	const max = ids.reduce((acc, id) => {
		const match = id.match(new RegExp(`^${prefix}-(\\d+)$`));
		if (!match) return acc;
		const value = Number(match[1]);
		return Number.isFinite(value) ? Math.max(acc, value) : acc;
	}, 0);
	return max + 1;
}

/**
 * Resolve a local file path to a URL the `<video>` element can load.
 *
 * Prefers the local media HTTP server (works on all platforms regardless of
 * Chromium's `file://` restrictions).  Falls back to a `file://` URL if the
 * media server is unavailable.
 */
export async function resolveVideoUrl(sourcePath: string): Promise<string> {
	try {
		const result = await window.electronAPI.getLocalMediaUrl(sourcePath);
		if (result.success) {
			return result.url;
		}
	} catch {
		// Media server unavailable — fall through to file:// URL.
	}
	return toFileUrl(sourcePath);
}

export function normalizeClipEntries(candidateClips: unknown): ClipEntry[] {
	if (!Array.isArray(candidateClips)) return [];
	return candidateClips
		.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
		.map((raw, index) => {
			const id = typeof raw.id === "string" && raw.id ? raw.id : `clip-${index + 1}`;
			const videoPath = typeof raw.videoPath === "string" ? raw.videoPath : "";
			const webcamPath = typeof raw.webcamPath === "string" && raw.webcamPath ? raw.webcamPath : null;
			const origin = raw.origin === "uploaded" ? "uploaded" : "recorded";
			const startMsOffset = isFiniteNumber(raw.startMsOffset) ? Math.max(0, Math.round(raw.startMsOffset)) : 0;
			const durationMs = isFiniteNumber(raw.durationMs) ? Math.max(100, Math.round(raw.durationMs)) : 5000;
			const label = typeof raw.label === "string" ? raw.label : (origin === "uploaded" ? `Video ${index + 1}` : `Take ${index + 1}`);

			return {
				id,
				origin,
				videoPath,
				webcamPath,
				microphoneAudioPath: typeof raw.microphoneAudioPath === "string" ? raw.microphoneAudioPath : null,
				systemAudioPath: typeof raw.systemAudioPath === "string" ? raw.systemAudioPath : null,
				cursorTelemetryPath: typeof raw.cursorTelemetryPath === "string" ? raw.cursorTelemetryPath : null,
				startMsOffset,
				durationMs,
				label,
				wallpaper: typeof raw.wallpaper === "string" ? raw.wallpaper : undefined,
				cropRegion: raw.cropRegion as CropRegion | undefined,
				layoutPreset: raw.layoutPreset as LayoutScenePreset | undefined,
				layoutRegions: Array.isArray(raw.layoutRegions) ? (raw.layoutRegions as LayoutRegion[]) : undefined,
				webcam: raw.webcam as WebcamOverlaySettings | undefined,
				zoomRegions: Array.isArray(raw.zoomRegions) ? (raw.zoomRegions as ZoomRegion[]) : undefined,
				trimStartMs: isFiniteNumber(raw.trimStartMs) ? raw.trimStartMs : undefined,
				trimEndMs: isFiniteNumber(raw.trimEndMs) ? raw.trimEndMs : undefined,
				speed: isFiniteNumber(raw.speed) ? raw.speed : undefined,
				showCursor: typeof raw.showCursor === "boolean" ? raw.showCursor : origin === "recorded",
				slideMode:
					raw.slideMode === "video" || raw.slideMode === "record"
						? raw.slideMode
						: origin === "uploaded"
							? "video"
							: "record",
				mediaTrackLayers: Array.isArray(raw.mediaTrackLayers)
					? (raw.mediaTrackLayers as import("./types").MediaTrackLayer[])
					: undefined,
				keyframes: Array.isArray(raw.keyframes)
					? (raw.keyframes as import("./types").PropertyKeyframe[])
					: undefined,
				transitionToNext:
					raw.transitionToNext && typeof raw.transitionToNext === "object"
						? {
								type: (["none", "crossfade", "slide", "wipe"].includes(
									String((raw.transitionToNext as Record<string, unknown>).type),
								)
									? (raw.transitionToNext as Record<string, unknown>).type
									: "none") as import("./types").ClipTransition["type"],
								durationMs: isFiniteNumber(
									(raw.transitionToNext as Record<string, unknown>).durationMs,
								)
									? Math.max(
											0,
											Math.round(
												(raw.transitionToNext as Record<string, unknown>).durationMs as number,
											),
									  )
									: 300,
						  }
						: undefined,
			};
		});
}

export function validateProjectData(candidate: unknown): candidate is EditorProjectData {
	if (!candidate || typeof candidate !== "object") return false;
	const project = candidate as Partial<EditorProjectData>;
	if (typeof project.version !== "number") return false;
	if (project.projectId !== undefined && typeof project.projectId !== "string") return false;
	const hasValidVideoPath = typeof project.videoPath === "string" && project.videoPath;
	const hasValidClips = Array.isArray(project.clips) && project.clips.length > 0;
	if (!hasValidVideoPath && !hasValidClips) return false;
	if (!project.editor || typeof project.editor !== "object") return false;
	return true;
}

export function normalizeProjectEditor(editor: Partial<ProjectEditorState>): ProjectEditorState {
	const normalizeTemporalBlurSampleCount = (value: unknown): number => {
		if (!isFiniteNumber(value)) {
			return TEMPORAL_MOTION_BLUR_DEFAULT_SAMPLE_COUNT;
		}

		const roundedValue = Math.round(value);
		const clampedValue = clamp(
			roundedValue,
			TEMPORAL_MOTION_BLUR_MIN_SAMPLE_COUNT,
			TEMPORAL_MOTION_BLUR_MAX_SAMPLE_COUNT,
		);

		if (clampedValue % 2 === 1) {
			return clampedValue;
		}

		return clampedValue >= TEMPORAL_MOTION_BLUR_MAX_SAMPLE_COUNT
			? clampedValue - 1
			: clampedValue + 1;
	};

	const validAspectRatios = new Set<AspectRatio>(ASPECT_RATIOS);
	const legacyMotionBlurEnabled = (editor as Partial<{ motionBlurEnabled: boolean }>)
		.motionBlurEnabled;
	const legacyShowBlur = (editor as Partial<{ showBlur: boolean }>).showBlur;
	const normalizedZoomMotionBlur = isFiniteNumber(
		(editor as Partial<ProjectEditorState>).zoomMotionBlur,
	)
		? clamp((editor as Partial<ProjectEditorState>).zoomMotionBlur as number, 0, 2)
		: legacyMotionBlurEnabled
			? 0.35
			: DEFAULT_ZOOM_MOTION_BLUR;
	const rawZoomMotionBlurTuning =
		(editor as Partial<ProjectEditorState>).zoomMotionBlurTuning &&
		typeof (editor as Partial<ProjectEditorState>).zoomMotionBlurTuning === "object"
			? ((editor as Partial<ProjectEditorState>)
					.zoomMotionBlurTuning as Partial<ZoomMotionBlurTuning>)
			: {};
	const normalizedZoomMotionBlurTuning: ZoomMotionBlurTuning = {
		panVelocityThreshold: isFiniteNumber(rawZoomMotionBlurTuning.panVelocityThreshold)
			? clamp(rawZoomMotionBlurTuning.panVelocityThreshold, 0, 240)
			: DEFAULT_ZOOM_MOTION_BLUR_TUNING.panVelocityThreshold,
		zoomVelocityThreshold: isFiniteNumber(rawZoomMotionBlurTuning.zoomVelocityThreshold)
			? clamp(rawZoomMotionBlurTuning.zoomVelocityThreshold, 0, 0.4)
			: DEFAULT_ZOOM_MOTION_BLUR_TUNING.zoomVelocityThreshold,
		maxDirectionalBlurPx: isFiniteNumber(rawZoomMotionBlurTuning.maxDirectionalBlurPx)
			? clamp(rawZoomMotionBlurTuning.maxDirectionalBlurPx, 0, 96)
			: DEFAULT_ZOOM_MOTION_BLUR_TUNING.maxDirectionalBlurPx,
		maxRadialBlurStrength: isFiniteNumber(rawZoomMotionBlurTuning.maxRadialBlurStrength)
			? clamp(rawZoomMotionBlurTuning.maxRadialBlurStrength, 0, 1.5)
			: DEFAULT_ZOOM_MOTION_BLUR_TUNING.maxRadialBlurStrength,
		panResponsePerSecond: isFiniteNumber(rawZoomMotionBlurTuning.panResponsePerSecond)
			? clamp(rawZoomMotionBlurTuning.panResponsePerSecond, 1, 30)
			: DEFAULT_ZOOM_MOTION_BLUR_TUNING.panResponsePerSecond,
		zoomResponsePerSecond: isFiniteNumber(rawZoomMotionBlurTuning.zoomResponsePerSecond)
			? clamp(rawZoomMotionBlurTuning.zoomResponsePerSecond, 1, 30)
			: DEFAULT_ZOOM_MOTION_BLUR_TUNING.zoomResponsePerSecond,
		zoomSafeZoneRadiusPx: isFiniteNumber(rawZoomMotionBlurTuning.zoomSafeZoneRadiusPx)
			? clamp(rawZoomMotionBlurTuning.zoomSafeZoneRadiusPx, 0, 80)
			: DEFAULT_ZOOM_MOTION_BLUR_TUNING.zoomSafeZoneRadiusPx,
	};
	const normalizedZoomTemporalMotionBlur = isFiniteNumber(
		(editor as Partial<ProjectEditorState>).zoomTemporalMotionBlur,
	)
		? clamp((editor as Partial<ProjectEditorState>).zoomTemporalMotionBlur as number, 0, 2)
		: normalizedZoomMotionBlur;
	const normalizedBackgroundBlur = isFiniteNumber(
		(editor as Partial<ProjectEditorState>).backgroundBlur,
	)
		? clamp((editor as Partial<ProjectEditorState>).backgroundBlur as number, 0, 8)
		: legacyShowBlur
			? 2
			: 0;
	const normalizedZoomMotionBlurSampleCount = normalizeTemporalBlurSampleCount(
		(editor as Partial<ProjectEditorState>).zoomMotionBlurSampleCount,
	);
	const normalizedZoomMotionBlurShutterFraction = isFiniteNumber(
		(editor as Partial<ProjectEditorState>).zoomMotionBlurShutterFraction,
	)
		? clamp(
				(editor as Partial<ProjectEditorState>).zoomMotionBlurShutterFraction as number,
				TEMPORAL_MOTION_BLUR_MIN_SHUTTER_FRACTION,
				TEMPORAL_MOTION_BLUR_MAX_SHUTTER_FRACTION,
			)
		: TEMPORAL_MOTION_BLUR_DEFAULT_SHUTTER_FRACTION;
	const normalizedZoomInDurationMs = isFiniteNumber(editor.zoomInDurationMs)
		? clamp(editor.zoomInDurationMs, 60, 4000)
		: DEFAULT_MOTION_PRESET.zoomInDurationMs;
	const normalizedZoomInOverlapMs = isFiniteNumber(editor.zoomInOverlapMs)
		? clamp(editor.zoomInOverlapMs, 0, normalizedZoomInDurationMs)
		: DEFAULT_ZOOM_IN_OVERLAP_MS;
	const normalizedZoomOutDurationMs = isFiniteNumber(editor.zoomOutDurationMs)
		? clamp(editor.zoomOutDurationMs, 60, 4000)
		: DEFAULT_MOTION_PRESET.zoomOutDurationMs;
	const normalizedConnectedZoomGapMs = isFiniteNumber(editor.connectedZoomGapMs)
		? clamp(editor.connectedZoomGapMs, 0, 5000)
		: DEFAULT_CONNECTED_ZOOM_GAP_MS;
	const normalizedConnectedZoomDurationMs = isFiniteNumber(editor.connectedZoomDurationMs)
		? clamp(editor.connectedZoomDurationMs, 60, 4000)
		: DEFAULT_CONNECTED_ZOOM_DURATION_MS;

	const normalizedZoomRegions: ZoomRegion[] = Array.isArray(editor.zoomRegions)
		? editor.zoomRegions
				.filter((region): region is ZoomRegion =>
					Boolean(region && typeof region.id === "string"),
				)
				.map((region) => {
					const rawStart = isFiniteNumber(region.startMs)
						? Math.round(region.startMs)
						: 0;
					const rawEnd = isFiniteNumber(region.endMs)
						? Math.round(region.endMs)
						: rawStart + 1000;
					const startMs = Math.max(0, Math.min(rawStart, rawEnd));
					const endMs = Math.max(startMs + 1, rawEnd);

					return {
						id: region.id,
						startMs,
						endMs,
						depth: [1, 2, 3, 4, 5, 6].includes(region.depth)
							? region.depth
							: DEFAULT_ZOOM_DEPTH,
						focus: {
							cx: clamp(
								isFiniteNumber(region.focus?.cx) ? region.focus.cx : 0.5,
								0,
								1,
							),
							cy: clamp(
								isFiniteNumber(region.focus?.cy) ? region.focus.cy : 0.5,
								0,
								1,
							),
						},
						mode:
							region.mode === "auto" || region.mode === "manual"
								? region.mode
								: undefined,
					};
				})
		: [];

	const normalizedTrimRegions: TrimRegion[] = Array.isArray(editor.trimRegions)
		? editor.trimRegions
				.filter((region): region is TrimRegion =>
					Boolean(region && typeof region.id === "string"),
				)
				.map((region) => {
					const rawStart = isFiniteNumber(region.startMs)
						? Math.round(region.startMs)
						: 0;
					const rawEnd = isFiniteNumber(region.endMs)
						? Math.round(region.endMs)
						: rawStart + 1000;
					const startMs = Math.max(0, Math.min(rawStart, rawEnd));
					const endMs = Math.max(startMs + 1, rawEnd);
					return {
						id: region.id,
						startMs,
						endMs,
					};
				})
		: [];

	const normalizedClipRegions: ClipRegion[] = Array.isArray(editor.clipRegions)
		? editor.clipRegions
				.filter((region): region is ClipRegion =>
					Boolean(region && typeof region.id === "string"),
				)
				.map((region) => {
					const rawStart = isFiniteNumber(region.startMs)
						? Math.round(region.startMs)
						: 0;
					const rawEnd = isFiniteNumber(region.endMs)
						? Math.round(region.endMs)
						: rawStart + 1000;
					const startMs = Math.max(0, Math.min(rawStart, rawEnd));
					const endMs = Math.max(startMs + 1, rawEnd);
					const transitionIn: ClipTransitionType =
						region.transitionIn === "fade-black" ||
						region.transitionIn === "fade-white" ||
						region.transitionIn === "slide-left" ||
						region.transitionIn === "slide-right" ||
						region.transitionIn === "zoom-push"
							? region.transitionIn
							: "none";
					const transitionInDurationMs =
						isFiniteNumber(region.transitionInDurationMs) &&
						region.transitionInDurationMs > 0
							? Math.round(region.transitionInDurationMs)
							: 400;

					return {
						id: region.id,
						startMs,
						endMs,
						speed: isFiniteNumber(region.speed) ? region.speed : 1,
						muted: typeof region.muted === "boolean" ? region.muted : false,
						showSourceAudio:
							typeof region.showSourceAudio === "boolean"
								? region.showSourceAudio
								: false,
						transitionIn,
						transitionInDurationMs,
					};
				})
		: [];

	const normalizedAutoFullTrackClipId =
		typeof editor.autoFullTrackClipId === "string" ? editor.autoFullTrackClipId : null;
	const normalizedAutoFullTrackClipEndMs = isFiniteNumber(editor.autoFullTrackClipEndMs)
		? Math.round(editor.autoFullTrackClipEndMs)
		: null;

	const normalizedSpeedRegions: SpeedRegion[] = Array.isArray(editor.speedRegions)
		? editor.speedRegions
				.filter((region): region is SpeedRegion =>
					Boolean(region && typeof region.id === "string"),
				)
				.map((region) => {
					const rawStart = isFiniteNumber(region.startMs)
						? Math.round(region.startMs)
						: 0;
					const rawEnd = isFiniteNumber(region.endMs)
						? Math.round(region.endMs)
						: rawStart + 1000;
					const startMs = Math.max(0, Math.min(rawStart, rawEnd));
					const endMs = Math.max(startMs + 1, rawEnd);

					const speed =
						region.speed === 0.25 ||
						region.speed === 0.5 ||
						region.speed === 0.75 ||
						region.speed === 1.25 ||
						region.speed === 1.5 ||
						region.speed === 1.75 ||
						region.speed === 2
							? region.speed
							: DEFAULT_PLAYBACK_SPEED;

					return {
						id: region.id,
						startMs,
						endMs,
						speed,
					};
				})
		: [];

	const normalizedAnnotationRegions: AnnotationRegion[] = Array.isArray(editor.annotationRegions)
		? editor.annotationRegions
				.filter((region): region is AnnotationRegion =>
					Boolean(region && typeof region.id === "string"),
				)
				.map((region, index) => {
					const rawStart = isFiniteNumber(region.startMs)
						? Math.round(region.startMs)
						: 0;
					const rawEnd = isFiniteNumber(region.endMs)
						? Math.round(region.endMs)
						: rawStart + 1000;
					const startMs = Math.max(0, Math.min(rawStart, rawEnd));
					const endMs = Math.max(startMs + 1, rawEnd);

					return {
						id: region.id,
						startMs,
						endMs,
						type:
							region.type === "image" ||
							region.type === "figure" ||
							region.type === "blur"
								? region.type
								: "text",
						content: typeof region.content === "string" ? region.content : "",
						textContent:
							typeof region.textContent === "string" ? region.textContent : undefined,
						imageContent:
							typeof region.imageContent === "string"
								? region.imageContent
								: undefined,
						imageFilePath:
							typeof region.imageFilePath === "string"
								? region.imageFilePath
								: undefined,
						animationIn:
							typeof region.animationIn === "string" &&
							["none", "fade", "slide-up"].includes(region.animationIn)
								? (region.animationIn as "none" | "fade" | "slide-up")
								: undefined,
						animationOut:
							typeof region.animationOut === "string" &&
							["none", "fade"].includes(region.animationOut)
								? (region.animationOut as "none" | "fade")
								: undefined,
						animationDurationMs: isFiniteNumber(region.animationDurationMs)
							? region.animationDurationMs
							: undefined,
						gifPath: typeof region.gifPath === "string" ? region.gifPath : undefined,
						gifDataUrl:
							typeof region.gifDataUrl === "string" ? region.gifDataUrl : undefined,
						position: {
							x: clamp(
								isFiniteNumber(region.position?.x)
									? region.position.x
									: DEFAULT_ANNOTATION_POSITION.x,
								0,
								100,
							),
							y: clamp(
								isFiniteNumber(region.position?.y)
									? region.position.y
									: DEFAULT_ANNOTATION_POSITION.y,
								0,
								100,
							),
						},
						size: {
							width: clamp(
								isFiniteNumber(region.size?.width)
									? region.size.width
									: DEFAULT_ANNOTATION_SIZE.width,
								1,
								200,
							),
							height: clamp(
								isFiniteNumber(region.size?.height)
									? region.size.height
									: DEFAULT_ANNOTATION_SIZE.height,
								1,
								200,
							),
						},
						style: {
							...DEFAULT_ANNOTATION_STYLE,
							...(region.style && typeof region.style === "object"
								? region.style
								: {}),
						},
						zIndex: isFiniteNumber(region.zIndex) ? region.zIndex : index + 1,
						figureData: region.figureData
							? {
									...DEFAULT_FIGURE_DATA,
									...region.figureData,
								}
							: undefined,
						blurIntensity: isFiniteNumber(region.blurIntensity)
							? clamp(region.blurIntensity, 1, 100)
							: 20,
						blurColor:
							typeof region.blurColor === "string" ? region.blurColor : undefined,
						trackIndex: isFiniteNumber(region.trackIndex)
							? Math.max(0, Math.floor(region.trackIndex))
							: 0,
						videoFilePath:
							typeof region.videoFilePath === "string" ? region.videoFilePath : undefined,
						name: typeof region.name === "string" ? region.name : undefined,
						locked: typeof region.locked === "boolean" ? region.locked : false,
						visible: typeof region.visible === "boolean" ? region.visible : true,
						muted: typeof region.muted === "boolean" ? region.muted : false,
						blendMode:
							region.blendMode === "multiply" ||
							region.blendMode === "screen" ||
							region.blendMode === "overlay" ||
							region.blendMode === "soft-light"
								? region.blendMode
								: "normal",
						rotationDeg: isFiniteNumber(region.rotationDeg) ? region.rotationDeg : 0,
						keyframes: Array.isArray(region.keyframes)
							? (region.keyframes as import("./types").PropertyKeyframe[])
							: undefined,
					};
				})
		: [];

	const normalizedAudioRegions: AudioRegion[] = Array.isArray(
		(editor as Partial<ProjectEditorState>).audioRegions,
	)
		? ((editor as Partial<ProjectEditorState>).audioRegions as AudioRegion[])
				.filter((region): region is AudioRegion =>
					Boolean(region && typeof region.id === "string"),
				)
				.map((region) => {
					const rawStart = isFiniteNumber(region.startMs)
						? Math.round(region.startMs)
						: 0;
					const rawEnd = isFiniteNumber(region.endMs)
						? Math.round(region.endMs)
						: rawStart + 1000;
					const startMs = Math.max(0, Math.min(rawStart, rawEnd));
					const endMs = Math.max(startMs + 1, rawEnd);

					return {
						id: region.id,
						startMs,
						endMs,
						audioPath: typeof region.audioPath === "string" ? region.audioPath : "",
						volume: isFiniteNumber(region.volume) ? clamp(region.volume, 0, 1) : 1,
						normalize: Boolean(region.normalize),
						trackIndex: isFiniteNumber(region.trackIndex)
							? Math.max(0, Math.floor(region.trackIndex))
							: 0,
						ducking: typeof region.ducking === "boolean" ? region.ducking : true,
					};
				})
		: [];

	const normalizedLayoutRegions: LayoutRegion[] = Array.isArray(
		(editor as Partial<ProjectEditorState>).layoutRegions,
	)
		? ((editor as Partial<ProjectEditorState>).layoutRegions as Partial<LayoutRegion>[])
				.filter((region) => Boolean(region && typeof region === "object"))
				.map((region, index) =>
					normalizeLayoutRegion(
						{
							id: region.id,
							startMs: region.startMs,
							endMs: region.endMs,
							preset: region.preset ?? DEFAULT_LAYOUT_SCENE_PRESET,
							transitionMs: region.transitionMs ?? DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
							easing: region.easing ?? DEFAULT_LAYOUT_SCENE_EASING,
						},
						index,
					),
				)
				.sort((left, right) => left.startMs - right.startMs)
		: [];

	const normalizedAutoCaptions: CaptionCue[] = Array.isArray(
		(editor as Partial<ProjectEditorState>).autoCaptions,
	)
		? ((editor as Partial<ProjectEditorState>).autoCaptions as CaptionCue[])
				.filter((cue): cue is CaptionCue => Boolean(cue && typeof cue.id === "string"))
				.map((cue) => {
					const rawStart = isFiniteNumber(cue.startMs) ? Math.round(cue.startMs) : 0;
					const rawEnd = isFiniteNumber(cue.endMs)
						? Math.round(cue.endMs)
						: rawStart + 1000;
					const startMs = Math.max(0, Math.min(rawStart, rawEnd));
					const endMs = Math.max(startMs + 1, rawEnd);
					const words: CaptionCueWord[] | undefined = Array.isArray(cue.words)
						? cue.words
								.filter((word): word is CaptionCueWord =>
									Boolean(word && typeof word.text === "string"),
								)
								.map((word) => {
									const rawWordStart = isFiniteNumber(word.startMs)
										? Math.round(word.startMs)
										: startMs;
									const rawWordEnd = isFiniteNumber(word.endMs)
										? Math.round(word.endMs)
										: rawWordStart + 1;
									const normalizedWordStart = clamp(
										rawWordStart,
										startMs,
										endMs - 1,
									);
									const normalizedWordEnd = clamp(
										rawWordEnd,
										normalizedWordStart + 1,
										endMs,
									);

									return {
										text: word.text.trim(),
										startMs: normalizedWordStart,
										endMs: normalizedWordEnd,
										...(word.leadingSpace ? { leadingSpace: true } : {}),
									};
								})
								.filter((word) => word.text.length > 0)
						: undefined;

					return {
						id: cue.id,
						startMs,
						endMs,
						text: typeof cue.text === "string" ? cue.text.trim() : "",
						...(words && words.length > 0 ? { words } : {}),
					};
				})
				.filter((cue) => cue.text.length > 0)
		: [];

	const rawAutoCaptionSettings: Partial<AutoCaptionSettings> =
		editor.autoCaptionSettings && typeof editor.autoCaptionSettings === "object"
			? (editor.autoCaptionSettings as Partial<AutoCaptionSettings>)
			: {};
	const normalizedAutoCaptionSettings: AutoCaptionSettings = {
		enabled:
			typeof rawAutoCaptionSettings.enabled === "boolean"
				? rawAutoCaptionSettings.enabled
				: DEFAULT_AUTO_CAPTION_SETTINGS.enabled,
		language:
			typeof rawAutoCaptionSettings.language === "string" &&
			rawAutoCaptionSettings.language.trim()
				? rawAutoCaptionSettings.language.trim()
				: DEFAULT_AUTO_CAPTION_SETTINGS.language,
		fontFamily: getDefaultCaptionFontFamily(),
		fontSize: isFiniteNumber(rawAutoCaptionSettings.fontSize)
			? clamp(rawAutoCaptionSettings.fontSize, 16, 72)
			: DEFAULT_AUTO_CAPTION_SETTINGS.fontSize,
		bottomOffset: isFiniteNumber(rawAutoCaptionSettings.bottomOffset)
			? clamp(rawAutoCaptionSettings.bottomOffset, 0, 30)
			: DEFAULT_AUTO_CAPTION_SETTINGS.bottomOffset,
		maxWidth: isFiniteNumber(rawAutoCaptionSettings.maxWidth)
			? clamp(rawAutoCaptionSettings.maxWidth, 40, 95)
			: DEFAULT_AUTO_CAPTION_SETTINGS.maxWidth,
		maxRows: isFiniteNumber(rawAutoCaptionSettings.maxRows)
			? clamp(Math.round(rawAutoCaptionSettings.maxRows), 1, 4)
			: DEFAULT_AUTO_CAPTION_SETTINGS.maxRows,
		animationStyle: normalizeAutoCaptionAnimation(
			rawAutoCaptionSettings.animationStyle,
			DEFAULT_AUTO_CAPTION_SETTINGS.animationStyle,
		),
		boxRadius: isFiniteNumber(rawAutoCaptionSettings.boxRadius)
			? clamp(rawAutoCaptionSettings.boxRadius, 0, 40)
			: DEFAULT_AUTO_CAPTION_SETTINGS.boxRadius,
		textColor:
			typeof rawAutoCaptionSettings.textColor === "string" &&
			rawAutoCaptionSettings.textColor.trim()
				? rawAutoCaptionSettings.textColor
				: DEFAULT_AUTO_CAPTION_SETTINGS.textColor,
		inactiveTextColor:
			typeof rawAutoCaptionSettings.inactiveTextColor === "string" &&
			rawAutoCaptionSettings.inactiveTextColor.trim()
				? rawAutoCaptionSettings.inactiveTextColor
				: DEFAULT_AUTO_CAPTION_SETTINGS.inactiveTextColor,
		backgroundOpacity: isFiniteNumber(rawAutoCaptionSettings.backgroundOpacity)
			? clamp(rawAutoCaptionSettings.backgroundOpacity, 0, 1)
			: DEFAULT_AUTO_CAPTION_SETTINGS.backgroundOpacity,
		highlightStyle: normalizeCaptionHighlightStyle(
			rawAutoCaptionSettings.highlightStyle,
			DEFAULT_AUTO_CAPTION_SETTINGS.highlightStyle ?? "karaoke-pop",
		),
		highlightColor:
			typeof rawAutoCaptionSettings.highlightColor === "string" &&
			rawAutoCaptionSettings.highlightColor.trim()
				? rawAutoCaptionSettings.highlightColor
				: DEFAULT_AUTO_CAPTION_SETTINGS.highlightColor,
		highlightTextColor:
			typeof rawAutoCaptionSettings.highlightTextColor === "string" &&
			rawAutoCaptionSettings.highlightTextColor.trim()
				? rawAutoCaptionSettings.highlightTextColor
				: DEFAULT_AUTO_CAPTION_SETTINGS.highlightTextColor,
		uppercase:
			typeof rawAutoCaptionSettings.uppercase === "boolean"
				? rawAutoCaptionSettings.uppercase
				: DEFAULT_AUTO_CAPTION_SETTINGS.uppercase,
	};

	const rawAudioDuckingSettings: Partial<AudioDuckingSettings> =
		editor.audioDuckingSettings && typeof editor.audioDuckingSettings === "object"
			? (editor.audioDuckingSettings as Partial<AudioDuckingSettings>)
			: {};
	const normalizedAudioDuckingSettings: AudioDuckingSettings = {
		enabled:
			typeof rawAudioDuckingSettings.enabled === "boolean"
				? rawAudioDuckingSettings.enabled
				: DEFAULT_AUDIO_DUCKING_SETTINGS.enabled,
		duckingAmountDb: isFiniteNumber(rawAudioDuckingSettings.duckingAmountDb)
			? clamp(rawAudioDuckingSettings.duckingAmountDb, -40, 0)
			: DEFAULT_AUDIO_DUCKING_SETTINGS.duckingAmountDb,
		attackMs: isFiniteNumber(rawAudioDuckingSettings.attackMs)
			? clamp(Math.round(rawAudioDuckingSettings.attackMs), 20, 1500)
			: DEFAULT_AUDIO_DUCKING_SETTINGS.attackMs,
		releaseMs: isFiniteNumber(rawAudioDuckingSettings.releaseMs)
			? clamp(Math.round(rawAudioDuckingSettings.releaseMs), 50, 3000)
			: DEFAULT_AUDIO_DUCKING_SETTINGS.releaseMs,
		holdMs: isFiniteNumber(rawAudioDuckingSettings.holdMs)
			? clamp(Math.round(rawAudioDuckingSettings.holdMs), 0, 2000)
			: DEFAULT_AUDIO_DUCKING_SETTINGS.holdMs,
	};

	const rawCropX = isFiniteNumber(editor.cropRegion?.x)
		? editor.cropRegion.x
		: DEFAULT_CROP_REGION.x;
	const rawCropY = isFiniteNumber(editor.cropRegion?.y)
		? editor.cropRegion.y
		: DEFAULT_CROP_REGION.y;
	const rawCropWidth = isFiniteNumber(editor.cropRegion?.width)
		? editor.cropRegion.width
		: DEFAULT_CROP_REGION.width;
	const rawCropHeight = isFiniteNumber(editor.cropRegion?.height)
		? editor.cropRegion.height
		: DEFAULT_CROP_REGION.height;

	const cropX = clamp(rawCropX, 0, 1);
	const cropY = clamp(rawCropY, 0, 1);
	const cropWidth = clamp(rawCropWidth, 0.01, 1 - cropX);
	const cropHeight = clamp(rawCropHeight, 0.01, 1 - cropY);

	const webcam: Partial<WebcamOverlaySettings> =
		editor.webcam && typeof editor.webcam === "object" ? editor.webcam : {};
	const webcamSourcePath = typeof webcam.sourcePath === "string" ? webcam.sourcePath : null;
	const legacyZoomScaleEffect = isFiniteNumber(
		(webcam as Partial<{ zoomScaleEffect: number }>).zoomScaleEffect,
	)
		? (webcam as Partial<{ zoomScaleEffect: number }>).zoomScaleEffect
		: null;
	const normalizedCursorStyle =
		typeof editor.cursorStyle === "string" && editor.cursorStyle.trim().length > 0
			? editor.cursorStyle === "mono"
				? "tahoe-inverted"
				: editor.cursorStyle
			: DEFAULT_CURSOR_STYLE;
	const normalizedMotionValues = {
		zoomInDurationMs: normalizedZoomInDurationMs,
		zoomOutDurationMs: normalizedZoomOutDurationMs,
		cursorSize: isFiniteNumber(editor.cursorSize)
			? clamp(editor.cursorSize, 0.5, 10)
			: DEFAULT_MOTION_PRESET.cursorSize,
		cursorSmoothing: isFiniteNumber(editor.cursorSmoothing)
			? clamp(editor.cursorSmoothing, 0, 2)
			: DEFAULT_MOTION_PRESET.cursorSmoothing,
		cursorSpringStiffnessMultiplier: isFiniteNumber(editor.cursorSpringStiffnessMultiplier)
			? clamp(editor.cursorSpringStiffnessMultiplier, 0.25, 3)
			: DEFAULT_MOTION_PRESET.cursorSpringStiffnessMultiplier,
		cursorSpringDampingMultiplier: isFiniteNumber(editor.cursorSpringDampingMultiplier)
			? clamp(editor.cursorSpringDampingMultiplier, 0.25, 3)
			: DEFAULT_MOTION_PRESET.cursorSpringDampingMultiplier,
		cursorSpringMassMultiplier: isFiniteNumber(editor.cursorSpringMassMultiplier)
			? clamp(editor.cursorSpringMassMultiplier, 0.25, 3)
			: DEFAULT_MOTION_PRESET.cursorSpringMassMultiplier,
		cursorMotionBlur: isFiniteNumber((editor as Partial<ProjectEditorState>).cursorMotionBlur)
			? clamp((editor as Partial<ProjectEditorState>).cursorMotionBlur as number, 0, 2)
			: DEFAULT_MOTION_PRESET.cursorMotionBlur,
		cursorClickBounce: isFiniteNumber((editor as Partial<ProjectEditorState>).cursorClickBounce)
			? clamp((editor as Partial<ProjectEditorState>).cursorClickBounce as number, 0, 5)
			: DEFAULT_MOTION_PRESET.cursorClickBounce,
		cursorClickBounceDuration: isFiniteNumber(
			(editor as Partial<ProjectEditorState>).cursorClickBounceDuration,
		)
			? clamp(
					(editor as Partial<ProjectEditorState>).cursorClickBounceDuration as number,
					60,
					500,
				)
			: DEFAULT_MOTION_PRESET.cursorClickBounceDuration,
	};
	const normalizedMotionPreset =
		CURSOR_MOTION_PRESETS[resolveCursorMotionPresetId(normalizedMotionValues)];

	return {
		wallpaper: typeof editor.wallpaper === "string" ? editor.wallpaper : DEFAULT_WALLPAPER_PATH,
		shadowIntensity: typeof editor.shadowIntensity === "number" ? editor.shadowIntensity : 0.67,
		backgroundBlur: normalizedBackgroundBlur,
		colorGrading: normalizeColorGrading(editor.colorGrading),
		zoomMotionBlur: normalizedZoomMotionBlur,
		zoomMotionBlurTuning: normalizedZoomMotionBlurTuning,
		zoomTemporalMotionBlur: normalizedZoomTemporalMotionBlur,
		zoomMotionBlurSampleCount: normalizedZoomMotionBlurSampleCount,
		zoomMotionBlurShutterFraction: normalizedZoomMotionBlurShutterFraction,
		connectZooms: typeof editor.connectZooms === "boolean" ? editor.connectZooms : true,
		zoomInDurationMs: normalizedMotionPreset.zoomInDurationMs,
		zoomInOverlapMs: normalizedZoomInOverlapMs,
		zoomOutDurationMs: normalizedMotionPreset.zoomOutDurationMs,
		connectedZoomGapMs: normalizedConnectedZoomGapMs,
		connectedZoomDurationMs: normalizedConnectedZoomDurationMs,
		zoomInEasing: normalizeZoomTransitionEasing(editor.zoomInEasing, DEFAULT_ZOOM_IN_EASING),
		zoomOutEasing: normalizeZoomTransitionEasing(editor.zoomOutEasing, DEFAULT_ZOOM_OUT_EASING),
		connectedZoomEasing: normalizeZoomTransitionEasing(
			editor.connectedZoomEasing,
			DEFAULT_CONNECTED_ZOOM_EASING,
		),
		showCursor: typeof editor.showCursor === "boolean" ? editor.showCursor : true,
		loopCursor: typeof editor.loopCursor === "boolean" ? editor.loopCursor : false,
		cursorStyle: normalizedCursorStyle,
		cursorSize: normalizedMotionPreset.cursorSize,
		cursorSmoothing: normalizedMotionPreset.cursorSmoothing,
		cursorSpringStiffnessMultiplier: normalizedMotionPreset.cursorSpringStiffnessMultiplier,
		cursorSpringDampingMultiplier: normalizedMotionPreset.cursorSpringDampingMultiplier,
		cursorSpringMassMultiplier: normalizedMotionPreset.cursorSpringMassMultiplier,
		cameraSpringStiffnessMultiplier: isFiniteNumber(editor.cameraSpringStiffnessMultiplier)
			? clamp(editor.cameraSpringStiffnessMultiplier, 0.25, 3)
			: 1,
		cameraSpringDampingMultiplier: isFiniteNumber(editor.cameraSpringDampingMultiplier)
			? clamp(editor.cameraSpringDampingMultiplier, 0.25, 3)
			: 1.13,
		cameraSpringMassMultiplier: isFiniteNumber(editor.cameraSpringMassMultiplier)
			? clamp(editor.cameraSpringMassMultiplier, 0.25, 3)
			: 1.12,
		zoomSmoothness: DEFAULT_ZOOM_SMOOTHNESS,
		zoomClassicMode:
			typeof editor.zoomClassicMode === "boolean" ? editor.zoomClassicMode : false,
		cursorMotionBlur: normalizedMotionPreset.cursorMotionBlur,
		cursorClickBounce: normalizedMotionPreset.cursorClickBounce,
		cursorClickBounceDuration: normalizedMotionPreset.cursorClickBounceDuration,
		cursorSway: isFiniteNumber((editor as Partial<ProjectEditorState>).cursorSway)
			? clamp((editor as Partial<ProjectEditorState>).cursorSway as number, 0, 2)
			: DEFAULT_CURSOR_SWAY,
		cameraPerspectiveTilt: isFiniteNumber(
			(editor as Partial<ProjectEditorState>).cameraPerspectiveTilt,
		)
			? clamp((editor as Partial<ProjectEditorState>).cameraPerspectiveTilt as number, 0, 1)
			: DEFAULT_CAMERA_PERSPECTIVE_TILT,
		borderRadius: typeof editor.borderRadius === "number" ? editor.borderRadius : 12.5,
		padding: (() => {
			const p = editor.padding;
			if (p && typeof p === "object") {
				const linked = typeof p.linked === "boolean" ? p.linked : true;
				const top = isFiniteNumber(p.top) ? clamp(p.top, 0, 100) : DEFAULT_PADDING.top;
				if (linked) {
					return { top, bottom: top, left: top, right: top, linked: true };
				}
				return {
					top,
					bottom: isFiniteNumber(p.bottom)
						? clamp(p.bottom, 0, 100)
						: DEFAULT_PADDING.bottom,
					left: isFiniteNumber(p.left) ? clamp(p.left, 0, 100) : DEFAULT_PADDING.left,
					right: isFiniteNumber(p.right) ? clamp(p.right, 0, 100) : DEFAULT_PADDING.right,
					linked: false,
				};
			}
			if (typeof p === "number" && isFiniteNumber(p)) {
				const val = clamp(p, 0, 100);
				return { top: val, bottom: val, left: val, right: val, linked: true };
			}
			return { ...DEFAULT_PADDING };
		})(),
		frame: typeof editor.frame === "string" ? editor.frame : null,
		cropRegion: {
			x: cropX,
			y: cropY,
			width: cropWidth,
			height: cropHeight,
		},
		zoomRegions: normalizedZoomRegions,
		trimRegions: normalizedTrimRegions,
		clipRegions: normalizedClipRegions,
		autoFullTrackClipId: normalizedAutoFullTrackClipId,
		autoFullTrackClipEndMs: normalizedAutoFullTrackClipEndMs,
		speedRegions: normalizedSpeedRegions,
		annotationRegions: normalizedAnnotationRegions,
		audioRegions: normalizedAudioRegions,
		audioDuckingSettings: normalizedAudioDuckingSettings,
		layoutRegions: normalizedLayoutRegions,
		autoCaptions: normalizedAutoCaptions,
		autoCaptionSettings: normalizedAutoCaptionSettings,
		webcam: {
			enabled:
				typeof webcam.enabled === "boolean"
					? webcam.enabled
					: DEFAULT_WEBCAM_OVERLAY.enabled,
			sourcePath: webcamSourcePath,
			mirror:
				typeof webcam.mirror === "boolean" ? webcam.mirror : DEFAULT_WEBCAM_OVERLAY.mirror,
			cropRegion: normalizeWebcamCropRegion(webcam.cropRegion),
			positionPreset:
				webcam.positionPreset === "top-left" ||
				webcam.positionPreset === "top-center" ||
				webcam.positionPreset === "top-right" ||
				webcam.positionPreset === "center-left" ||
				webcam.positionPreset === "center" ||
				webcam.positionPreset === "center-right" ||
				webcam.positionPreset === "bottom-left" ||
				webcam.positionPreset === "bottom-center" ||
				webcam.positionPreset === "bottom-right" ||
				webcam.positionPreset === "custom"
					? webcam.positionPreset
					: webcam.corner === "top-left" ||
							webcam.corner === "top-right" ||
							webcam.corner === "bottom-left" ||
							webcam.corner === "bottom-right"
						? webcam.corner
						: DEFAULT_WEBCAM_POSITION_PRESET,
			positionX: isFiniteNumber(webcam.positionX)
				? clamp(webcam.positionX, 0, 1)
				: DEFAULT_WEBCAM_POSITION_X,
			positionY: isFiniteNumber(webcam.positionY)
				? clamp(webcam.positionY, 0, 1)
				: DEFAULT_WEBCAM_POSITION_Y,
			corner:
				webcam.corner === "top-left" ||
				webcam.corner === "top-right" ||
				webcam.corner === "bottom-left" ||
				webcam.corner === "bottom-right"
					? webcam.corner
					: DEFAULT_WEBCAM_OVERLAY.corner,
			size: isFiniteNumber(webcam.size) ? clamp(webcam.size, 10, 100) : DEFAULT_WEBCAM_SIZE,
			reactToZoom:
				typeof webcam.reactToZoom === "boolean"
					? webcam.reactToZoom
					: legacyZoomScaleEffect != null
						? legacyZoomScaleEffect > 0
						: DEFAULT_WEBCAM_REACT_TO_ZOOM,
			cornerRadius: isFiniteNumber(webcam.cornerRadius)
				? clamp(webcam.cornerRadius, 0, 160)
				: DEFAULT_WEBCAM_CORNER_RADIUS,
			shadow: isFiniteNumber(webcam.shadow)
				? clamp(webcam.shadow, 0, 1)
				: DEFAULT_WEBCAM_SHADOW,
			timeOffsetMs: isFiniteNumber(webcam.timeOffsetMs)
				? Math.round(webcam.timeOffsetMs)
				: DEFAULT_WEBCAM_TIME_OFFSET_MS,
			margin: isFiniteNumber(webcam.margin)
				? clamp(webcam.margin, 0, 96)
				: DEFAULT_WEBCAM_MARGIN,
		},
		sourceAudioTrackSettingsByClip:
			editor.sourceAudioTrackSettingsByClip &&
			typeof editor.sourceAudioTrackSettingsByClip === "object"
				? editor.sourceAudioTrackSettingsByClip
				: {},
		defaultSourceAudioTrackSettings:
			editor.defaultSourceAudioTrackSettings &&
			typeof editor.defaultSourceAudioTrackSettings === "object"
				? editor.defaultSourceAudioTrackSettings
				: {},
		aspectRatio:
			typeof editor.aspectRatio === "string" &&
			(validAspectRatios.has(editor.aspectRatio as AspectRatio) ||
				isCustomAspectRatio(editor.aspectRatio))
				? (editor.aspectRatio as AspectRatio)
				: "16:9",
		exportEncodingMode: normalizeExportEncodingMode(editor.exportEncodingMode),
		exportBackendPreference: normalizeExportBackendPreference(editor.exportBackendPreference),
		exportPipelineModel: normalizeExportPipelineModel(editor.exportPipelineModel),
		exportQuality:
			editor.exportQuality === "medium" ||
			editor.exportQuality === "good" ||
			editor.exportQuality === "high" ||
			editor.exportQuality === "source"
				? editor.exportQuality
				: "source",
		mp4FrameRate: normalizeExportMp4FrameRate(editor.mp4FrameRate),
		exportFormat: editor.exportFormat === "gif" ? "gif" : "mp4",
		gifFrameRate:
			editor.gifFrameRate === 15 ||
			editor.gifFrameRate === 20 ||
			editor.gifFrameRate === 25 ||
			editor.gifFrameRate === 30
				? editor.gifFrameRate
				: 15,
		gifLoop: typeof editor.gifLoop === "boolean" ? editor.gifLoop : true,
		gifSizePreset:
			editor.gifSizePreset === "medium" ||
			editor.gifSizePreset === "large" ||
			editor.gifSizePreset === "original"
				? editor.gifSizePreset
				: "medium",
	};
}

export function createProjectData(
	videoPath: string,
	editor: Partial<ProjectEditorState>,
	projectId?: string | null,
	clips?: ClipEntry[],
): EditorProjectData {
	const safeEditor = { ...editor };
	if (safeEditor.annotationRegions) {
		safeEditor.annotationRegions = safeEditor.annotationRegions.map((region) => {
			if (region.type === "gif") {
				const { gifDataUrl: _stripped, ...rest } = region;
				return rest as AnnotationRegion;
			}
			if (region.type === "image" && region.imageFilePath) {
				const { imageContent: _stripped1, content: _stripped2, ...rest } = region;
				return { ...rest, content: "" } as AnnotationRegion;
			}
			return region;
		});
	}

	const normalizedClips = clips && clips.length > 0 ? normalizeClipEntries(clips) : undefined;
	const resolvedVideoPath = videoPath || (normalizedClips && normalizedClips[0]?.videoPath) || "";

	return {
		version: PROJECT_VERSION,
		...(typeof projectId === "string" && projectId.trim().length > 0 ? { projectId } : {}),
		videoPath: resolvedVideoPath,
		...(normalizedClips && normalizedClips.length > 0 ? { clips: normalizedClips } : {}),
		editor: safeEditor,
	};
}
