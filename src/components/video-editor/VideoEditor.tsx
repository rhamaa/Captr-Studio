import { buildSceneClipRegions } from "./clipsUtils";
import {
	ArrowsLeftRight,
	BookmarkSimple,
	Check,
	CaretDown as ChevronDown,
	CaretUp as ChevronUp,
	Copy,
	Crop,
	Cursor,
	DownloadSimple as Download,
	FolderOpen,
	FolderSimple,
	Gear,
	SquaresFour as LayoutIcon,
	Microphone,
	Pause,
	Camera as PhCameraRegular,
	Faders as PhFaders,
	Play,
	Plus,
	ArrowClockwise as Redo2,
	Scissors,
	SkipBack,
	SkipForward,
	Sliders,
	Sparkle,
	ArrowCounterClockwise as Undo2,
	SpeakerLow as Volume1,
	SpeakerHigh as Volume2,
	SpeakerX as VolumeX,
	UploadSimple,
	VideoCamera,
	MagicWand as WandSparkles,
	X,
	MagnifyingGlassPlus as ZoomIn,
} from "@phosphor-icons/react";
import type { Span } from "dnd-timeline";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toaster } from "@/components/ui/sonner";
import { useI18n } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import {
	calculateOutputDimensions,
	DEFAULT_MP4_CODEC,
	type ExportBackendPreference,
	type ExportEncodingMode,
	type ExportFormat,
	type ExportMp4FrameRate,
	type ExportPipelineModel,
	type ExportProgress,
	type ExportQuality,
	type ExportResult,
	type ExportSettings,
	FrameRenderer,
	GIF_SIZE_PRESETS,
	GifExporter,
	type GifFrameRate,
	type GifSizePreset,
	ModernVideoExporter,
	probeSupportedMp4Dimensions,
	type SupportedMp4Dimensions,
	VideoExporter,
} from "@/lib/exporter";
import { getMp4ExportBitrate, getSourceQualityBitrate } from "@/lib/exporter/exportBitrate";
import {
	canUseInMemoryExportSaveFallback,
	describeBlockedInMemoryExportSave,
} from "@/lib/exporter/exportSavePolicy";
import { matchesShortcut } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import {
	type AspectRatio,
	getAspectRatioLabel,
	getAspectRatioValue,
	SOCIAL_ASPECT_RATIO_PRESETS,
} from "@/utils/aspectRatioUtils";
import type { ExportQuickPreset } from "@/utils/exportPresetUtils";
import { calculateMp4ExportDimensions, calculateMp4SourceDimensions } from "./exportDimensions";
import { resolveSavingExportProgress } from "./exportProgressState";
import { resolveExportStartSettings } from "./exportStartSettings";
import { resolveExportStatusModel } from "./exportStatusModel";
import { resolveMp4ExportRouting } from "./mp4ExportRouting";
import { resolveMp4ExportSettings } from "./mp4ExportSettings";
import { useNvidiaCudaExportOptIn } from "./useNvidiaCudaExportOptIn";

const PhCursorFill = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<Cursor weight="fill" className={props.className} />
);
const PhCamera = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<PhCameraRegular weight={props.weight ?? "regular"} className={props.className} />
);

const PhSparkle = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<Sparkle weight={props.weight ?? "regular"} className={props.className} />
);
const PhSettings = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<Gear weight={props.weight ?? "regular"} className={props.className} />
);
const PhLayout = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<LayoutIcon weight={props.weight ?? "regular"} className={props.className} />
);
const PhFolder = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<FolderSimple weight={props.weight ?? "regular"} className={props.className} />
);
const PhSliders = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<Sliders weight={props.weight ?? "regular"} className={props.className} />
);
const PhMicrophone = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<Microphone weight={props.weight ?? "regular"} className={props.className} />
);
const PhArrowsLeftRight = (props: { className?: string; weight?: "fill" | "regular" }) => (
	<ArrowsLeftRight weight={props.weight ?? "regular"} className={props.className} />
);

import { CaptrLogo } from "@/components/brand/CaptrLogo";
import { AppSettingsDialog } from "@/components/settings/AppSettingsDialog";
import { WelcomeScreen } from "@/components/welcome/WelcomeScreen";
import { EditorMenuBar } from "./EditorMenuBar";
import type { SourceAudioTrackSettings } from "@/components/video-editor/audio/audioTypes";
import { extensionHost } from "@/lib/extensions";
import {
	applySilenceRemovalToTimeline,
	detectSilenceFromAudioUrl,
	type SilenceRegion,
} from "./audio/silenceDetector";
import { useVideoEditorAudio } from "./audio/useVideoEditorAudio";
import { CropControl } from "./CropControl";
import { ExportSettingsMenu } from "./ExportSettingsMenu";
import {
	createEditorHistoryStack,
	type EditorHistorySnapshot,
	recordEditorHistorySnapshot,
	redoEditorHistoryStack,
	resetEditorHistoryStack,
	undoEditorHistoryStack,
} from "./editorHistory";
import {
	type EditorPreset,
	type EditorPresetSnapshot,
	loadEditorPreferences,
	loadEditorPresets,
	saveEditorPreferences,
	saveEditorPresets,
	serializeEditorPresetSnapshot,
} from "./editorPreferences";
import ProjectBrowserDialog, { type ProjectLibraryEntry } from "./ProjectBrowserDialog";
import { hasUnsavedProjectChanges } from "./projectDirtyState";
import {
	createProjectData,
	deriveNextId,
	type EditorProjectData,
	fromFileUrl,
	normalizeClipEntries,
	normalizeProjectEditor,
	resolveVideoUrl,
	stripPersistedDevMotionBlurSettings,
	toFileUrl,
	validateProjectData,
} from "./projectPersistence";
import { SettingsPanel } from "./SettingsPanel";
import { getDevOpenRecordingConfig, getSmokeExportConfig } from "./smokeExportConfig";
import { createSmokeExportProgressSampler } from "./smokeExportProgress";
import {
	APP_HEADER_ICON_BUTTON_CLASS,
	DiscordLinkButton,
	FeedbackDialog,
	openExternalLink,
	RECORDLY_ISSUES_URL,
} from "./TutorialHelp";
import TimelineEditor, { type TimelineEditorHandle } from "./timeline/TimelineEditor";
import {
	buildAutoReframeSuggestions,
	normalizeCursorTelemetry,
} from "./timeline/zoomSuggestionUtils";
import {
	type AnnotationRegion,
	type AudioDuckingSettings,
	type AudioRegion,
	type ClipEntry,
	type ClipRegion,
	type ClipTransitionType,
	type ColorGradingSettings,
	type CropRegion,
	type CursorStyle,
	type CursorTelemetryPoint,
	clampFocusToDepth,
	clipsToTrims,
	DEFAULT_ANNOTATION_POSITION,
	DEFAULT_ANNOTATION_SIZE,
	DEFAULT_ANNOTATION_STYLE,
	DEFAULT_AUDIO_DUCKING_SETTINGS,
	DEFAULT_AUTO_ZOOM_DEPTH,
	DEFAULT_COLOR_GRADING,
	DEFAULT_CONNECTED_ZOOM_DURATION_MS,
	DEFAULT_CONNECTED_ZOOM_EASING,
	DEFAULT_CONNECTED_ZOOM_GAP_MS,
	DEFAULT_CROP_REGION,
	DEFAULT_CURSOR_STYLE,
	DEFAULT_FIGURE_DATA,
	DEFAULT_LAYOUT_SCENE_DURATION_MS,
	DEFAULT_LAYOUT_SCENE_EASING,
	DEFAULT_LAYOUT_SCENE_PRESET,
	DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
	DEFAULT_WEBCAM_OVERLAY,
	DEFAULT_WEBCAM_TIME_OFFSET_MS,
	DEFAULT_ZOOM_IN_DURATION_MS,
	DEFAULT_ZOOM_IN_EASING,
	DEFAULT_ZOOM_IN_OVERLAP_MS,
	DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	DEFAULT_ZOOM_OUT_DURATION_MS,
	DEFAULT_ZOOM_OUT_EASING,
	type EditorEffectSection,
	extendAutoFullTrackClip,
	type FigureData,
	getClipSourceEndMs,
	getTimelineDurationMs,
	type LayoutRegion,
	type LayoutSceneEasing,
	type LayoutScenePreset,
	type Padding,
	mapSourceTimeToTimelineTime as resolveSourceTimeToTimelineTime,
	mapTimelineTimeToSourceTime as resolveTimelineTimeToSourceTime,
	type SpeedRegion,
	type TrimRegion,
	trimsToClips,
	type WebcamOverlaySettings,
	type ZoomDepth,
	type ZoomFocus,
	type ZoomMode,
	type ZoomMotionBlurTuning,
	type ZoomRegion,
	type ZoomTransitionEasing,
} from "./types";
import VideoPlayback, { VideoPlaybackRef } from "./VideoPlayback";
import { SlideList } from "./slides/SlideList";
import {
	createRecordedClip,
	createUploadedClip,
	findClipAtTimelineTime,
	isRecordedClip,
	reorderClips,
} from "./clipsUtils";
import {
	buildLoopedCursorTelemetry,
	getDisplayedTimelineWindowMs,
} from "./videoPlayback/cursorLoopTelemetry";

type PendingExportSave = {
	fileName: string;
	// Exactly one of these is populated. `tempFilePath` is the preferred form
	// for MP4 exports — the main process holds the finished file on disk, so
	// "Save Again" just renames it instead of round-tripping through the
	// renderer's ArrayBuffer heap.
	arrayBuffer?: ArrayBuffer;
	tempFilePath?: string;
};

type CancelableExporter = {
	cancel(): void;
};

const EXPORT_BLOB_STREAM_CHUNK_BYTES = 16 * 1024 * 1024;

async function streamExportBlobToTempFile(blob: Blob, extension: string): Promise<string | null> {
	if (
		typeof window === "undefined" ||
		!window.electronAPI?.openExportStream ||
		!window.electronAPI?.writeExportStreamChunk ||
		!window.electronAPI?.closeExportStream
	) {
		return null;
	}

	const openResult = await window.electronAPI.openExportStream({ extension });
	if (!openResult.success || !openResult.streamId || !openResult.tempPath) {
		throw new Error(openResult.error || "Failed to open export stream");
	}

	const { streamId } = openResult;
	let position = 0;

	try {
		while (position < blob.size) {
			const chunk = blob.slice(position, position + EXPORT_BLOB_STREAM_CHUNK_BYTES);
			const chunkBuffer = await chunk.arrayBuffer();
			const writeResult = await window.electronAPI.writeExportStreamChunk(
				streamId,
				position,
				new Uint8Array(chunkBuffer),
			);
			if (!writeResult.success) {
				throw new Error(writeResult.error || "Failed to write export stream chunk");
			}
			position += chunkBuffer.byteLength;
		}

		const closeResult = await window.electronAPI.closeExportStream(streamId);
		if (!closeResult.success || !closeResult.tempPath) {
			throw new Error(closeResult.error || "Failed to close export stream");
		}

		return closeResult.tempPath;
	} catch (error) {
		try {
			await window.electronAPI.closeExportStream(streamId, { abort: true });
		} catch {
			// Best-effort cleanup; preserve the original error below.
		}
		throw error;
	}
}

type SaveProjectOptions = {
	silent?: boolean;
	remountPreviewAfterSave?: boolean;
	refreshLibraryAfterSave?: boolean;
	captureThumbnail?: boolean;
};

async function writeSmokeExportReport(
	outputPath: string | null,
	report: Record<string, unknown>,
): Promise<void> {
	if (!outputPath || typeof window === "undefined") {
		return;
	}

	try {
		const reportBytes = new TextEncoder().encode(JSON.stringify(report, null, 2));
		const reportBuffer = reportBytes.buffer.slice(
			reportBytes.byteOffset,
			reportBytes.byteOffset + reportBytes.byteLength,
		) as ArrayBuffer;
		await window.electronAPI.writeExportedVideoToPath(
			reportBuffer,
			`${outputPath}.report.json`,
		);
	} catch (error) {
		console.error("[smoke-export] Failed to write report", error);
	}
}

const SMOKE_EXPORT_READY_TIMEOUT_MS = 30_000;
const DEFAULT_MP4_EXPORT_FRAME_RATE: ExportMp4FrameRate = 30;
const PROJECT_AUTOSAVE_DELAY_MS = 1000;
const EXPORT_ERROR_TOAST_DURATION_MS = 20000;

function summarizeErrorMessage(message: string): string {
	const firstLine = message
		.split(/\r?\n/)
		.map((line) => line.trim())
		.find((line) => line.length > 0);

	return firstLine ?? message;
}

function showExportErrorToast(message: string) {
	const summary = summarizeErrorMessage(message);
	toast.error(summary, {
		description: summary === message ? undefined : message,
		duration: EXPORT_ERROR_TOAST_DURATION_MS,
	});
}

function cloneStructured<T>(value: T): T {
	return globalThis.structuredClone(value);
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string") {
		return error.replace(/^Error:\s*/i, "");
	}

	return "Something went wrong";
}

export default function VideoEditor() {
	const { t } = useI18n();
	const smokeExportConfig = useMemo(
		() => getSmokeExportConfig(typeof window === "undefined" ? "" : window.location.search),
		[],
	);
	const devOpenRecordingConfig = useMemo(
		() =>
			getDevOpenRecordingConfig(typeof window === "undefined" ? "" : window.location.search),
		[],
	);
	const [appPlatform, setAppPlatform] = useState<string>(
		typeof navigator !== "undefined" && /Mac/i.test(navigator.platform) ? "darwin" : "",
	);
	const initialEditorPreferences = useMemo(() => loadEditorPreferences(), []);
	const [videoPath, setVideoPath] = useState<string | null>(null);
	const [videoSourcePath, setVideoSourcePath] = useState<string | null>(null);
	const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
	const [projectLibraryEntries, setProjectLibraryEntries] = useState<ProjectLibraryEntry[]>([]);
	const [projectBrowserOpen, setProjectBrowserOpen] = useState(false);
	const [viewMode, setViewMode] = useState<"welcome" | "editor">("welcome");
	const [isEditorMaximized, setIsEditorMaximized] = useState(false);

	useEffect(() => {
		window.electronAPI?.setWindowMode?.(viewMode);
	}, [viewMode]);

	useEffect(() => {
		window.electronAPI?.isWindowMaximized?.().then((maximized) => {
			setIsEditorMaximized(Boolean(maximized));
		}).catch(() => {});

		const unsubscribe = window.electronAPI?.onWindowMaximizedChange?.((maximized) => {
			setIsEditorMaximized(maximized);
		});
		return () => {
			unsubscribe?.();
		};
	}, []);
	const [isSettingsOpen, setIsSettingsOpen] = useState(false);
	const [settingsDefaultTab, setSettingsDefaultTab] = useState("general");
	const [isEditingProjectName, setIsEditingProjectName] = useState(false);
	const [projectNameDraft, setProjectNameDraft] = useState("");
	const [isSavingProjectName, setIsSavingProjectName] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [wallpaper, setWallpaper] = useState<string>(initialEditorPreferences.wallpaper);
	const [shadowIntensity, setShadowIntensity] = useState(
		initialEditorPreferences.shadowIntensity,
	);
	const [backgroundBlur, setBackgroundBlur] = useState(initialEditorPreferences.backgroundBlur);
	const [zoomMotionBlur, setZoomMotionBlur] = useState(initialEditorPreferences.zoomMotionBlur);
	const [zoomMotionBlurTuning, setZoomMotionBlurTuning] = useState<ZoomMotionBlurTuning>(
		initialEditorPreferences.zoomMotionBlurTuning ?? DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	);
	const [zoomTemporalMotionBlur, setZoomTemporalMotionBlur] = useState(
		initialEditorPreferences.zoomTemporalMotionBlur,
	);
	const [zoomMotionBlurSampleCount, setZoomMotionBlurSampleCount] = useState<number | null>(
		initialEditorPreferences.zoomMotionBlurSampleCount,
	);
	const [zoomMotionBlurShutterFraction, setZoomMotionBlurShutterFraction] = useState<
		number | null
	>(initialEditorPreferences.zoomMotionBlurShutterFraction);
	const [autoApplyFreshRecordingAutoZooms, setAutoApplyFreshRecordingAutoZooms] = useState(
		initialEditorPreferences.autoApplyFreshRecordingAutoZooms,
	);
	const [connectZooms, setConnectZooms] = useState(initialEditorPreferences.connectZooms);
	const [zoomInDurationMs, setZoomInDurationMs] = useState(
		initialEditorPreferences.zoomInDurationMs ?? DEFAULT_ZOOM_IN_DURATION_MS,
	);
	const [zoomInOverlapMs, setZoomInOverlapMs] = useState(
		initialEditorPreferences.zoomInOverlapMs ?? DEFAULT_ZOOM_IN_OVERLAP_MS,
	);
	const [zoomOutDurationMs, setZoomOutDurationMs] = useState(
		initialEditorPreferences.zoomOutDurationMs ?? DEFAULT_ZOOM_OUT_DURATION_MS,
	);
	const [connectedZoomGapMs, setConnectedZoomGapMs] = useState(
		initialEditorPreferences.connectedZoomGapMs ?? DEFAULT_CONNECTED_ZOOM_GAP_MS,
	);
	const [connectedZoomDurationMs, setConnectedZoomDurationMs] = useState(
		initialEditorPreferences.connectedZoomDurationMs ?? DEFAULT_CONNECTED_ZOOM_DURATION_MS,
	);
	const [zoomInEasing, setZoomInEasing] = useState<ZoomTransitionEasing>(
		initialEditorPreferences.zoomInEasing ?? DEFAULT_ZOOM_IN_EASING,
	);
	const [zoomOutEasing, setZoomOutEasing] = useState<ZoomTransitionEasing>(
		initialEditorPreferences.zoomOutEasing ?? DEFAULT_ZOOM_OUT_EASING,
	);
	const [connectedZoomEasing, setConnectedZoomEasing] = useState<ZoomTransitionEasing>(
		initialEditorPreferences.connectedZoomEasing ?? DEFAULT_CONNECTED_ZOOM_EASING,
	);
	const [showCursor, setShowCursor] = useState(initialEditorPreferences.showCursor);
	const [loopCursor, setLoopCursor] = useState(initialEditorPreferences.loopCursor);
	const [cursorStyle, setCursorStyle] = useState<CursorStyle>(
		initialEditorPreferences.cursorStyle ?? DEFAULT_CURSOR_STYLE,
	);
	const [cursorSize, setCursorSize] = useState(initialEditorPreferences.cursorSize);
	const [cursorSmoothing, setCursorSmoothing] = useState(
		initialEditorPreferences.cursorSmoothing,
	);
	const [cursorSpringStiffnessMultiplier, setCursorSpringStiffnessMultiplier] = useState(
		initialEditorPreferences.cursorSpringStiffnessMultiplier,
	);
	const [cursorSpringDampingMultiplier, setCursorSpringDampingMultiplier] = useState(
		initialEditorPreferences.cursorSpringDampingMultiplier,
	);
	const [cursorSpringMassMultiplier, setCursorSpringMassMultiplier] = useState(
		initialEditorPreferences.cursorSpringMassMultiplier,
	);
	const [cameraSpringStiffnessMultiplier, setCameraSpringStiffnessMultiplier] = useState(
		initialEditorPreferences.cameraSpringStiffnessMultiplier,
	);
	const [cameraSpringDampingMultiplier, setCameraSpringDampingMultiplier] = useState(
		initialEditorPreferences.cameraSpringDampingMultiplier,
	);
	const [cameraSpringMassMultiplier, setCameraSpringMassMultiplier] = useState(
		initialEditorPreferences.cameraSpringMassMultiplier,
	);
	const [sessionShowCursorOverride, setSessionShowCursorOverride] = useState<boolean | null>(
		null,
	);
	const [sessionNativeCaptureUnavailable, setSessionNativeCaptureUnavailable] = useState(false);
	const [nativeCaptureUnavailableModalOpen, setNativeCaptureUnavailableModalOpen] =
		useState(false);
	const [zoomSmoothness, setZoomSmoothness] = useState(0.5);
	const [zoomClassicMode, setZoomClassicMode] = useState(false);
	const [cursorMotionBlur, setCursorMotionBlur] = useState(
		initialEditorPreferences.cursorMotionBlur,
	);
	const [cursorClickBounce, setCursorClickBounce] = useState(
		initialEditorPreferences.cursorClickBounce,
	);
	const [cursorClickBounceDuration, setCursorClickBounceDuration] = useState(
		initialEditorPreferences.cursorClickBounceDuration,
	);
	const [cursorSway, setCursorSway] = useState(initialEditorPreferences.cursorSway);
	const [cameraPerspectiveTilt, setCameraPerspectiveTilt] = useState(
		initialEditorPreferences.cameraPerspectiveTilt,
	);
	const [colorGrading, setColorGrading] = useState<ColorGradingSettings>(
		initialEditorPreferences.colorGrading ?? DEFAULT_COLOR_GRADING,
	);
	const [borderRadius, setBorderRadius] = useState(initialEditorPreferences.borderRadius);
	const [padding, setPadding] = useState(initialEditorPreferences.padding);
	const [frame, setFrame] = useState<string | null>(initialEditorPreferences.frame);
	const [cropRegion, setCropRegion] = useState<CropRegion>(DEFAULT_CROP_REGION);
	const [webcam, setWebcam] = useState<WebcamOverlaySettings>(
		initialEditorPreferences.webcam ?? DEFAULT_WEBCAM_OVERLAY,
	);
	const [resolvedWebcamVideoUrl, setResolvedWebcamVideoUrl] = useState<string | null>(null);
	const [zoomRegions, setZoomRegions] = useState<ZoomRegion[]>([]);
	const [cursorTelemetry, setCursorTelemetry] = useState<CursorTelemetryPoint[]>([]);
	// Tracks the videoSourcePath for which the cursor telemetry IPC has already
	// resolved. The smoke-export auto-trigger waits on this so long recordings
	// still bake cursor/zoom animations into the output — without it, the
	// auto-export fires as soon as the video loads and the telemetry arrives
	// after encoding has started.
	const [cursorTelemetrySourcePath, setCursorTelemetrySourcePath] = useState<string | null>(null);
	const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
	const [trimRegions, setTrimRegions] = useState<TrimRegion[]>([]);
	const [clipRegions, setClipRegions] = useState<ClipRegion[]>([]);
	const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
	const [clips, setClips] = useState<ClipEntry[]>([]);
	const isSwitchingClipRef = useRef(false);
	const clipsRef = useRef(clips);
	clipsRef.current = clips;
	const clipRegionsRef = useRef(clipRegions);
	clipRegionsRef.current = clipRegions;
	const videoSourcePathRef = useRef(videoSourcePath);
	videoSourcePathRef.current = videoSourcePath;

	useEffect(() => {
		if (duration > 0 && clips.length === 1 && clips[0].durationMs === 0) {
			setClips([{ ...clips[0], durationMs: Math.round(duration * 1000) }]);
		}
	}, [duration, clips]);

	const [layoutRegions, setLayoutRegions] = useState<LayoutRegion[]>([]);
	const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
	const [speedRegions, setSpeedRegions] = useState<SpeedRegion[]>([]);
	const [annotationRegions, setAnnotationRegions] = useState<AnnotationRegion[]>([]);
	const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
	const [audioRegions, setAudioRegions] = useState<AudioRegion[]>([]);
	const [selectedAudioId, setSelectedAudioId] = useState<string | null>(null);
	const [sourceAudioTrackSettingsByClip, setSourceAudioTrackSettingsByClip] = useState<
		Record<string, SourceAudioTrackSettings>
	>({});
	const [defaultSourceAudioTrackSettings, setDefaultSourceAudioTrackSettings] =
		useState<SourceAudioTrackSettings>({});
	const [hasClipSourceAudio, setHasClipSourceAudio] = useState(false);
	
	
	const [audioDuckingSettings, setAudioDuckingSettings] = useState<AudioDuckingSettings>(
		DEFAULT_AUDIO_DUCKING_SETTINGS,
	);
	const [showSocialSafeZone, setShowSocialSafeZone] = useState(false);
	
	
	
	
	
	
	const [silenceModalOpen, setSilenceModalOpen] = useState(false);
	const [isAnalyzingSilence, setIsAnalyzingSilence] = useState(false);
	const [detectedSilences, setDetectedSilences] = useState<SilenceRegion[]>([]);
	const [silenceTotalSavedMs, setSilenceTotalSavedMs] = useState(0);
	const [silenceMinDurationMs, setSilenceMinDurationMs] = useState(1000);
	const [silenceThresholdDb, setSilenceThresholdDb] = useState(-36);
	const [isExporting, setIsExporting] = useState(false);
	const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
	const [exportError, setExportError] = useState<string | null>(null);
	const [showExportDropdown, setShowExportDropdown] = useState(false);
	const [previewVolume, setPreviewVolume] = useState(1);
	const applySessionPresentation = useCallback(
		(
			session:
				| {
						hideOverlayCursorByDefault?: boolean;
						nativeCaptureUnavailable?: boolean;
				  }
				| null
				| undefined,
		) => {
			setSessionShowCursorOverride(session?.hideOverlayCursorByDefault ? false : null);
			setSessionNativeCaptureUnavailable(Boolean(session?.nativeCaptureUnavailable));
			setNativeCaptureUnavailableModalOpen(Boolean(session?.nativeCaptureUnavailable));
		},
		[],
	);
	const effectiveShowCursor = sessionShowCursorOverride ?? showCursor;
	const [aspectRatio, setAspectRatio] = useState<AspectRatio>(
		initialEditorPreferences.aspectRatio,
	);
	const [activeEffectSection, setActiveEffectSection] = useState<EditorEffectSection>("scene");
	const [exportQuality, setExportQuality] = useState<ExportQuality>(
		initialEditorPreferences.exportQuality,
	);
	const [exportEncodingMode, setExportEncodingMode] = useState<ExportEncodingMode>(
		initialEditorPreferences.exportEncodingMode,
	);
	const [exportBackendPreference, setExportBackendPreference] = useState<ExportBackendPreference>(
		initialEditorPreferences.exportBackendPreference,
	);
	const [exportPipelineModel, setExportPipelineModel] = useState<ExportPipelineModel>(
		initialEditorPreferences.exportPipelineModel,
	);
	const enableModernExportPipeline = useCallback(() => {
		setExportPipelineModel("modern");
	}, []);
	const {
		nvidiaCudaExportAvailable,
		experimentalNvidiaCudaExport,
		setExperimentalNvidiaCudaExport,
		gpuEncoders,
	} = useNvidiaCudaExportOptIn({
		onEnabled: enableModernExportPipeline,
	});
	const [mp4FrameRate, setMp4FrameRate] = useState<ExportMp4FrameRate>(
		initialEditorPreferences.mp4FrameRate ?? DEFAULT_MP4_EXPORT_FRAME_RATE,
	);
	const [exportFormat, setExportFormat] = useState<ExportFormat>(
		initialEditorPreferences.exportFormat,
	);
	const [gifFrameRate, setGifFrameRate] = useState<GifFrameRate>(
		initialEditorPreferences.gifFrameRate,
	);
	const [gifLoop, setGifLoop] = useState(initialEditorPreferences.gifLoop);
	const [gifSizePreset, setGifSizePreset] = useState<GifSizePreset>(
		initialEditorPreferences.gifSizePreset,
	);
	const [exportedFilePath, setExportedFilePath] = useState<string | undefined>(undefined);
	const [hasPendingExportSave, setHasPendingExportSave] = useState(false);
	const [lastSavedSnapshot, setLastSavedSnapshot] = useState<EditorProjectData | null>(null);
	const [editorPresets, setEditorPresets] = useState<EditorPreset[]>(() => loadEditorPresets());
	const [activeEditorPresetId, setActiveEditorPresetId] = useState<string | null>(null);
	const [presetPopoverOpen, setPresetPopoverOpen] = useState(false);
	const [presetNameDraft, setPresetNameDraft] = useState("");
	const [showCropModal, setShowCropModal] = useState(false);
	const [previewVersion, setPreviewVersion] = useState(0);
	const [isPreviewReady, setIsPreviewReady] = useState(false);
	const [autoSuggestZoomsTrigger, setAutoSuggestZoomsTrigger] = useState(0);
	const headerLeftControlsPaddingClass = appPlatform === "darwin" ? "pl-[76px]" : "";

	const videoPlaybackRef = useRef<VideoPlaybackRef>(null);
	const projectBrowserTriggerRef = useRef<HTMLButtonElement | null>(null);
	const projectBrowserFallbackTriggerRef = useRef<HTMLButtonElement | null>(null);
	const projectNameInputRef = useRef<HTMLInputElement | null>(null);
	const nextZoomIdRef = useRef(1);
	const nextClipIdRef = useRef(1);
	const nextLayoutIdRef = useRef(1);
	const nextAudioIdRef = useRef(1);

	const deriveUniqueClipId = useCallback(
		(existingClips: ClipEntry[], existingRegions: ClipRegion[] = []) => {
			const allIds = [
				...existingClips.map((c) => c.id),
				...existingRegions.map((r) => r.id),
			];
			const nextNum = deriveNextId("clip", allIds);
			nextClipIdRef.current = Math.max(nextClipIdRef.current, nextNum + 1);
			return `clip-${nextNum}`;
		},
		[],
	);

	const { shortcuts, isMac, openConfig } = useShortcuts();
	const nextAnnotationIdRef = useRef(1);
	const nextAnnotationZIndexRef = useRef(1); // Track z-index for stacking order
	const exporterRef = useRef<CancelableExporter | null>(null);
	const autoSuggestedVideoPathRef = useRef<string | null>(null);
	const pendingFreshRecordingAutoZoomPathRef = useRef<string | null>(null);
	const editorHistoryRef = useRef(createEditorHistoryStack());
	const applyingHistoryRef = useRef(false);
	const pendingExportSaveRef = useRef<PendingExportSave | null>(null);
	const pendingTelemetryRetryTimeoutRef = useRef<number | null>(null);
	const pendingFreshRecordingAutoSuggestTimeoutRef = useRef<number | null>(null);
	const pendingFreshRecordingAutoSuggestTelemetryCountRef = useRef(0);
	const cropSnapshotRef = useRef<CropRegion | null>(null);
	const mp4SupportRequestRef = useRef(0);
	const smokeExportStartedRef = useRef(false);
	const projectAutosaveTimeoutRef = useRef<number | null>(null);
	const projectSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
	const smokeExportReadyStateRef = useRef<Record<string, unknown>>({});
	const [historyVersion, setHistoryVersion] = useState(0);
	const timelineRef = useRef<TimelineEditorHandle>(null);

	function formatTime(seconds: number) {
		if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return "0:00";
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	}

	const [timelineCollapsed, setTimelineCollapsed] = useState(false);
	const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
		try {
			const saved = localStorage.getItem("captr.workspace.sidebarWidth");
			return saved ? Math.max(240, Math.min(560, Number(saved))) : 332;
		} catch {
			return 332;
		}
	});
	const [timelineHeight, setTimelineHeight] = useState<number>(() => {
		try {
			const saved = localStorage.getItem("captr.workspace.timelineHeight");
			return saved ? Math.max(140, Math.min(520, Number(saved))) : 220;
		} catch {
			return 220;
		}
	});
	const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
	const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);

	const handleSidebarResizeStart = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			const startX = e.clientX;
			const startWidth = sidebarWidth;
			setIsDraggingSidebar(true);
			document.body.style.cursor = "col-resize";
			document.body.style.userSelect = "none";

			const onPointerMove = (ev: PointerEvent) => {
				const delta = ev.clientX - startX;
				const nextWidth = Math.max(240, Math.min(560, startWidth + delta));
				setSidebarWidth(nextWidth);
			};

			const onPointerUp = (ev: PointerEvent) => {
				const delta = ev.clientX - startX;
				const nextWidth = Math.max(240, Math.min(560, startWidth + delta));
				setSidebarWidth(nextWidth);
				try {
					localStorage.setItem("captr.workspace.sidebarWidth", String(nextWidth));
				} catch {}
				setIsDraggingSidebar(false);
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				window.removeEventListener("pointermove", onPointerMove);
				window.removeEventListener("pointerup", onPointerUp);
			};

			window.addEventListener("pointermove", onPointerMove);
			window.addEventListener("pointerup", onPointerUp);
		},
		[sidebarWidth],
	);

	const handleResetSidebarWidth = useCallback(() => {
		setSidebarWidth(332);
		try {
			localStorage.setItem("captr.workspace.sidebarWidth", "332");
		} catch {}
	}, []);

	const handleTimelineResizeStart = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			const startY = e.clientY;
			const startHeight = timelineHeight;
			setIsDraggingTimeline(true);
			document.body.style.cursor = "row-resize";
			document.body.style.userSelect = "none";

			const onPointerMove = (ev: PointerEvent) => {
				const delta = startY - ev.clientY;
				const maxHeight = Math.max(200, window.innerHeight - 240);
				const nextHeight = Math.max(130, Math.min(maxHeight, startHeight + delta));
				setTimelineHeight(nextHeight);
				if (timelineCollapsed && nextHeight > 130) {
					setTimelineCollapsed(false);
				}
			};

			const onPointerUp = (ev: PointerEvent) => {
				const delta = startY - ev.clientY;
				const maxHeight = Math.max(200, window.innerHeight - 240);
				const nextHeight = Math.max(130, Math.min(maxHeight, startHeight + delta));
				setTimelineHeight(nextHeight);
				try {
					localStorage.setItem("captr.workspace.timelineHeight", String(nextHeight));
				} catch {}
				setIsDraggingTimeline(false);
				document.body.style.cursor = "";
				document.body.style.userSelect = "";
				window.removeEventListener("pointermove", onPointerMove);
				window.removeEventListener("pointerup", onPointerUp);
			};

			window.addEventListener("pointermove", onPointerMove);
			window.addEventListener("pointerup", onPointerUp);
		},
		[timelineHeight, timelineCollapsed],
	);

	const handleResetTimelineHeight = useCallback(() => {
		setTimelineHeight(220);
		setTimelineCollapsed(false);
		try {
			localStorage.setItem("captr.workspace.timelineHeight", "220");
		} catch {}
	}, []);

	useEffect(() => {
		void window.electronAPI?.getPlatform?.()?.then((platform) => {
			setAppPlatform(platform);
		});
	}, []);

	useEffect(() => {
		autoSuggestedVideoPathRef.current = null;
		pendingFreshRecordingAutoSuggestTelemetryCountRef.current = 0;
		if (pendingFreshRecordingAutoSuggestTimeoutRef.current !== null) {
			window.clearTimeout(pendingFreshRecordingAutoSuggestTimeoutRef.current);
			pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
		}
	}, []);

	const [supportedMp4SourceDimensions, setSupportedMp4SourceDimensions] =
		useState<SupportedMp4Dimensions>({
			width: 1920,
			height: 1080,
			capped: false,
			encoderPath: null,
		});

	const syncHistoryButtons = useCallback(() => {
		setHistoryVersion((version) => version + 1);
	}, []);

	const captureEditorPresetSnapshot = useCallback(
		(): EditorPresetSnapshot => ({
			wallpaper,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			zoomMotionBlurTuning: { ...zoomMotionBlurTuning },
			zoomTemporalMotionBlur,
			zoomMotionBlurSampleCount,
			zoomMotionBlurShutterFraction,
			connectZooms,
			zoomInDurationMs,
			zoomInOverlapMs,
			zoomOutDurationMs,
			connectedZoomGapMs,
			connectedZoomDurationMs,
			zoomInEasing,
			zoomOutEasing,
			connectedZoomEasing,
			showCursor,
			loopCursor,
			cursorStyle,
			cursorSize,
			cursorSmoothing,
			cursorSpringStiffnessMultiplier,
			cursorSpringDampingMultiplier,
			cursorSpringMassMultiplier,
			cameraSpringStiffnessMultiplier,
			cameraSpringDampingMultiplier,
			cameraSpringMassMultiplier,
			cursorMotionBlur,
			cursorClickBounce,
			cursorClickBounceDuration,
			cursorSway,
			cameraPerspectiveTilt,
			borderRadius,
			colorGrading: { ...colorGrading },
			padding: { ...padding },
			frame,
			webcam: { ...webcam },
			aspectRatio,
			exportEncodingMode,
			exportBackendPreference,
			exportPipelineModel,
			exportQuality,
			mp4FrameRate,
			exportFormat,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
		}),
		[
			wallpaper,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			zoomMotionBlurTuning,
			zoomTemporalMotionBlur,
			zoomMotionBlurSampleCount,
			zoomMotionBlurShutterFraction,
			connectZooms,
			zoomInDurationMs,
			zoomInOverlapMs,
			zoomOutDurationMs,
			connectedZoomGapMs,
			connectedZoomDurationMs,
			zoomInEasing,
			zoomOutEasing,
			connectedZoomEasing,
			showCursor,
			loopCursor,
			cursorStyle,
			cursorSize,
			cursorSmoothing,
			cursorSpringStiffnessMultiplier,
			cursorSpringDampingMultiplier,
			cursorSpringMassMultiplier,
			cameraSpringStiffnessMultiplier,
			cameraSpringDampingMultiplier,
			cameraSpringMassMultiplier,
			cursorMotionBlur,
			cursorClickBounce,
			cursorClickBounceDuration,
			cursorSway,
			cameraPerspectiveTilt,
			borderRadius,
			colorGrading,
			padding,
			frame,
			webcam,
			aspectRatio,
			exportEncodingMode,
			exportBackendPreference,
			exportPipelineModel,
			exportQuality,
			mp4FrameRate,
			exportFormat,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
		],
	);

	const currentPresetSnapshot = useMemo(
		() => captureEditorPresetSnapshot(),
		[captureEditorPresetSnapshot],
	);
	const currentPresetSignature = useMemo(
		() => serializeEditorPresetSnapshot(currentPresetSnapshot),
		[currentPresetSnapshot],
	);
	const currentEditorPreset = useMemo(
		() => editorPresets.find((preset) => preset.id === activeEditorPresetId) ?? null,
		[activeEditorPresetId, editorPresets],
	);

	useEffect(() => {
		const activePreset = currentEditorPreset;
		if (
			activePreset &&
			serializeEditorPresetSnapshot(activePreset.snapshot) === currentPresetSignature
		) {
			return;
		}

		const matchingPreset =
			editorPresets.find(
				(preset) =>
					serializeEditorPresetSnapshot(preset.snapshot) === currentPresetSignature,
			) ?? null;
		const nextActivePresetId = matchingPreset?.id ?? null;
		if (nextActivePresetId !== activeEditorPresetId) {
			setActiveEditorPresetId(nextActivePresetId);
		}
	}, [activeEditorPresetId, currentEditorPreset, currentPresetSignature, editorPresets]);

	useEffect(() => {
		if (!presetPopoverOpen) {
			setPresetNameDraft("");
		}
	}, [presetPopoverOpen]);

	const applyEditorPresetSnapshot = useCallback((snapshot: EditorPresetSnapshot) => {
		setWallpaper(snapshot.wallpaper);
		setShadowIntensity(snapshot.shadowIntensity);
		setBackgroundBlur(snapshot.backgroundBlur);
		setZoomMotionBlur(snapshot.zoomMotionBlur);
		setZoomMotionBlurTuning({ ...snapshot.zoomMotionBlurTuning });
		setZoomTemporalMotionBlur(snapshot.zoomTemporalMotionBlur);
		setZoomMotionBlurSampleCount(snapshot.zoomMotionBlurSampleCount);
		setZoomMotionBlurShutterFraction(snapshot.zoomMotionBlurShutterFraction);
		setConnectZooms(snapshot.connectZooms);
		setZoomInDurationMs(snapshot.zoomInDurationMs);
		setZoomInOverlapMs(snapshot.zoomInOverlapMs);
		setZoomOutDurationMs(snapshot.zoomOutDurationMs);
		setConnectedZoomGapMs(snapshot.connectedZoomGapMs);
		setConnectedZoomDurationMs(snapshot.connectedZoomDurationMs);
		setZoomInEasing(snapshot.zoomInEasing);
		setZoomOutEasing(snapshot.zoomOutEasing);
		setConnectedZoomEasing(snapshot.connectedZoomEasing);
		setShowCursor(snapshot.showCursor);
		setLoopCursor(snapshot.loopCursor);
		setCursorStyle(snapshot.cursorStyle);
		setCursorSize(snapshot.cursorSize);
		setCursorSmoothing(snapshot.cursorSmoothing);
		setCursorSpringStiffnessMultiplier(snapshot.cursorSpringStiffnessMultiplier);
		setCursorSpringDampingMultiplier(snapshot.cursorSpringDampingMultiplier);
		setCursorSpringMassMultiplier(snapshot.cursorSpringMassMultiplier);
		setCameraSpringStiffnessMultiplier(snapshot.cameraSpringStiffnessMultiplier);
		setCameraSpringDampingMultiplier(snapshot.cameraSpringDampingMultiplier);
		setCameraSpringMassMultiplier(snapshot.cameraSpringMassMultiplier);
		setCursorMotionBlur(snapshot.cursorMotionBlur);
		setCursorClickBounce(snapshot.cursorClickBounce);
		setCursorClickBounceDuration(snapshot.cursorClickBounceDuration);
		setCursorSway(snapshot.cursorSway);
		setCameraPerspectiveTilt(snapshot.cameraPerspectiveTilt ?? 0);
		setBorderRadius(snapshot.borderRadius);
		setColorGrading(
			snapshot.colorGrading ? { ...snapshot.colorGrading } : DEFAULT_COLOR_GRADING,
		);
		setPadding({ ...snapshot.padding });
		setFrame(snapshot.frame);
		setWebcam({ ...snapshot.webcam });
		setAspectRatio(snapshot.aspectRatio);
		setExportEncodingMode(snapshot.exportEncodingMode);
		setExportBackendPreference(snapshot.exportBackendPreference);
		setExportPipelineModel(snapshot.exportPipelineModel);
		setExportQuality(snapshot.exportQuality);
		setMp4FrameRate(snapshot.mp4FrameRate);
		setExportFormat(snapshot.exportFormat);
		setGifFrameRate(snapshot.gifFrameRate);
		setGifLoop(snapshot.gifLoop);
		setGifSizePreset(snapshot.gifSizePreset);
	}, []);

	const handleApplyEditorPreset = useCallback(
		(presetId: string) => {
			const preset = editorPresets.find((item) => item.id === presetId);
			if (!preset) {
				return;
			}

			setActiveEditorPresetId(preset.id);
			applyEditorPresetSnapshot(preset.snapshot);
			toast.success(
				t("editor.presets.toasts.applied", 'Applied preset "{{name}}"', {
					name: preset.name,
				}),
			);
		},
		[applyEditorPresetSnapshot, editorPresets, t],
	);

	const handleSaveEditorPreset = useCallback(
		(name: string) => {
			const normalizedName = name.trim().replace(/\s+/g, " ");
			if (normalizedName.length === 0) {
				toast.error(t("editor.presets.errors.nameRequired", "Enter a preset name."));
				return false;
			}

			const hasDuplicateName = editorPresets.some(
				(preset) => preset.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
			);
			if (hasDuplicateName) {
				toast.error(
					t(
						"editor.presets.errors.duplicateName",
						"A preset with that name already exists.",
					),
				);
				return false;
			}

			const snapshot = captureEditorPresetSnapshot();
			const timestamp = new Date().toISOString();
			const nextPreset: EditorPreset = {
				id: crypto.randomUUID(),
				name: normalizedName,
				createdAt: timestamp,
				updatedAt: timestamp,
				snapshot,
			};
			const nextPresets: EditorPreset[] = [nextPreset, ...editorPresets];

			if (!saveEditorPresets(nextPresets)) {
				toast.error(
					t(
						"editor.presets.errors.saveFailed",
						"Could not save that preset. Check your browser storage settings and try again.",
					),
				);
				return false;
			}

			setEditorPresets(nextPresets);
			setActiveEditorPresetId(nextPreset.id);
			toast.success(
				t("editor.presets.toasts.saved", 'Saved preset "{{name}}"', {
					name: normalizedName,
				}),
			);
			return true;
		},
		[captureEditorPresetSnapshot, editorPresets, t],
	);

	const handleDeleteEditorPreset = useCallback(
		(presetId: string) => {
			const preset = editorPresets.find((item) => item.id === presetId);
			if (!preset) {
				return;
			}

			const nextPresets = editorPresets.filter((item) => item.id !== presetId);
			if (!saveEditorPresets(nextPresets)) {
				toast.error(
					t(
						"editor.presets.errors.deleteFailed",
						"Could not delete that preset. Check your browser storage settings and try again.",
					),
				);
				return;
			}

			setEditorPresets(nextPresets);
			if (preset.id === activeEditorPresetId) {
				setActiveEditorPresetId(null);
			}
			toast.success(
				t("editor.presets.toasts.deleted", 'Deleted preset "{{name}}"', {
					name: preset.name,
				}),
			);
		},
		[activeEditorPresetId, editorPresets, t],
	);

	const handleSavePresetSubmit = useCallback(() => {
		const didSave = handleSaveEditorPreset(presetNameDraft);
		if (didSave) {
			setPresetNameDraft("");
		}
	}, [handleSaveEditorPreset, presetNameDraft]);

	const clearPendingExportSave = useCallback(() => {
		const pending = pendingExportSaveRef.current;
		pendingExportSaveRef.current = null;
		setHasPendingExportSave(false);
		if (pending?.tempFilePath && typeof window !== "undefined") {
			// Best-effort cleanup — main-process also reaps stale temp files on
			// before-quit, so we ignore failures here.
			void window.electronAPI.discardExportedTemp?.(pending.tempFilePath);
		}
	}, []);

	const refreshProjectLibrary = useCallback(async () => {
		try {
			const result = await window.electronAPI.listProjectFiles();
			if (!result.success) {
				throw new Error(result.error || "Failed to load project library");
			}

			setProjectLibraryEntries(result.entries);
		} catch (projectLibraryError) {
			console.warn("Unable to refresh project library:", projectLibraryError);
		}
	}, []);

	const captureProjectThumbnail = useCallback(async () => {
		const previewHandle = videoPlaybackRef.current;
		const previewVideo = previewHandle?.video ?? null;
		const previewCanvas = previewHandle?.app?.canvas ?? null;

		if (previewHandle && previewVideo && previewVideo.paused) {
			try {
				await previewHandle.refreshFrame();
				await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
			} catch (thumbnailRefreshError) {
				console.warn(
					"Unable to refresh preview frame before thumbnail capture:",
					thumbnailRefreshError,
				);
			}
		}

		const canvas = document.createElement("canvas");
		const targetWidth = 320;
		const targetHeight = 180;
		canvas.width = targetWidth;
		canvas.height = targetHeight;

		const context = canvas.getContext("2d");
		if (!context) {
			return null;
		}
		context.imageSmoothingEnabled = true;
		context.imageSmoothingQuality = "high";
		const editorBgHsl = getComputedStyle(document.documentElement)
			.getPropertyValue("--editor-bg")
			.trim();
		context.fillStyle = editorBgHsl ? `hsl(${editorBgHsl})` : "#111113";
		context.fillRect(0, 0, targetWidth, targetHeight);

		const previewWidth = previewHandle?.containerRef.current?.clientWidth || 1920;
		const previewHeight = previewHandle?.containerRef.current?.clientHeight || 1080;
		const frameTimestampUs = Math.max(0, Math.round(currentTime * 1_000_000));

		if (previewVideo && previewVideo.videoWidth > 0 && previewVideo.videoHeight > 0) {
			let videoFrame: VideoFrame | null = null;
			let frameRenderer: FrameRenderer | null = null;

			try {
				videoFrame = new VideoFrame(previewVideo, { timestamp: frameTimestampUs });
				frameRenderer = new FrameRenderer({
					width: targetWidth,
					height: targetHeight,
					wallpaper,
					zoomRegions,
					showShadow: shadowIntensity > 0,
					shadowIntensity,
					backgroundBlur,
					zoomMotionBlur,
					zoomMotionBlurTuning,
					zoomTemporalMotionBlur,
					zoomMotionBlurSampleCount,
					zoomMotionBlurShutterFraction,
					connectZooms,
					zoomInDurationMs,
					zoomInOverlapMs,
					zoomOutDurationMs,
					connectedZoomGapMs,
					connectedZoomDurationMs,
					zoomInEasing,
					zoomOutEasing,
					connectedZoomEasing,
					borderRadius,
					padding,
					cropRegion,
					webcam,
					webcamUrl:
						resolvedWebcamVideoUrl ??
						(webcam.sourcePath ? toFileUrl(webcam.sourcePath) : null),
					videoWidth: previewVideo.videoWidth,
					videoHeight: previewVideo.videoHeight,
					annotationRegions,
					speedRegions: (() => {
						const clipDerived: SpeedRegion[] = clipRegions
							.filter((clip) => clip.speed !== 1)
							.map((clip) => ({
								id: `clip-speed-${clip.id}`,
								startMs: clip.startMs,
								endMs: getClipSourceEndMs(clip),
								speed: clip.speed as SpeedRegion["speed"],
							}));
						if (clipDerived.length === 0) return speedRegions;
						const result = [...speedRegions];
						for (const cs of clipDerived) {
							const overlaps = speedRegions.some(
								(sr) => sr.endMs > cs.startMs && sr.startMs < cs.endMs,
							);
							if (!overlaps) {
								result.push(cs);
							}
						}
						return result;
					})(),
					previewWidth,
					previewHeight,
					cursorTelemetry,
					showCursor: effectiveShowCursor,
					cursorStyle,
					cursorSize,
					cursorSmoothing,
					cursorSpringStiffnessMultiplier,
					cursorSpringDampingMultiplier,
					cursorSpringMassMultiplier,
					cameraSpringStiffnessMultiplier,
					cameraSpringDampingMultiplier,
					cameraSpringMassMultiplier,
					zoomSmoothness,
					zoomClassicMode,
					cursorMotionBlur,
					cursorClickBounce,
					cursorClickBounceDuration,
					cursorSway,
					cameraPerspectiveTilt,
					clipRegions,
				});
				await frameRenderer.initialize();
				await frameRenderer.renderFrame(videoFrame, frameTimestampUs);
				return frameRenderer.getCanvas().toDataURL("image/png");
			} catch (thumbnailRenderError) {
				console.warn(
					"Unable to render thumbnail from composed frame:",
					thumbnailRenderError,
				);
			} finally {
				videoFrame?.close();
				frameRenderer?.destroy();
			}
		}

		const drawableSource =
			previewCanvas && previewCanvas.width > 0 && previewCanvas.height > 0
				? previewCanvas
				: previewVideo && previewVideo.videoWidth > 0 && previewVideo.videoHeight > 0
					? previewVideo
					: null;

		if (!drawableSource) {
			return null;
		}

		const sourceWidth =
			drawableSource instanceof HTMLVideoElement
				? drawableSource.videoWidth
				: drawableSource.width;
		const sourceHeight =
			drawableSource instanceof HTMLVideoElement
				? drawableSource.videoHeight
				: drawableSource.height;

		if (sourceWidth <= 0 || sourceHeight <= 0) {
			return null;
		}

		const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
		const drawWidth = Math.round(sourceWidth * scale);
		const drawHeight = Math.round(sourceHeight * scale);
		const offsetX = Math.round((targetWidth - drawWidth) / 2);
		const offsetY = Math.round((targetHeight - drawHeight) / 2);

		try {
			context.drawImage(drawableSource, offsetX, offsetY, drawWidth, drawHeight);
			return canvas.toDataURL("image/png");
		} catch (thumbnailError) {
			console.warn("Unable to capture project thumbnail:", thumbnailError);
			return null;
		}
	}, [
		annotationRegions,
		backgroundBlur,
		borderRadius,
		connectZooms,
		connectedZoomDurationMs,
		connectedZoomEasing,
		connectedZoomGapMs,
		cropRegion,
		currentTime,
		cursorClickBounce,
		cursorClickBounceDuration,
		cursorMotionBlur,
		cursorSize,
		cursorSmoothing,
		cursorSpringDampingMultiplier,
		cursorSpringMassMultiplier,
		cursorSpringStiffnessMultiplier,
		cameraSpringStiffnessMultiplier,
		cameraSpringDampingMultiplier,
		cameraSpringMassMultiplier,
		zoomSmoothness,
		cursorStyle,
		cursorSway,
		cameraPerspectiveTilt,
		cursorTelemetry,
		clipRegions,
		padding,
		resolvedWebcamVideoUrl,
		shadowIntensity,
		effectiveShowCursor,
		speedRegions,
		wallpaper,
		webcam,
		zoomInDurationMs,
		zoomInEasing,
		zoomInOverlapMs,
		zoomMotionBlur,
		zoomMotionBlurTuning,
		zoomTemporalMotionBlur,
		zoomMotionBlurSampleCount,
		zoomMotionBlurShutterFraction,
		zoomOutDurationMs,
		zoomOutEasing,
		zoomRegions,
		zoomClassicMode,
	]);

	const markExportAsSaving = useCallback(() => {
		setExportProgress(resolveSavingExportProgress);
	}, []);

	const handleShowCursorChange = useCallback((nextShowCursor: boolean) => {
		setSessionShowCursorOverride(null);
		setShowCursor(nextShowCursor);
	}, []);

	const remountPreview = useCallback(() => {
		setIsPreviewReady(false);
		setPreviewVersion((version) => version + 1);
	}, []);

	const clearPendingProjectAutosave = useCallback(() => {
		if (projectAutosaveTimeoutRef.current !== null) {
			window.clearTimeout(projectAutosaveTimeoutRef.current);
			projectAutosaveTimeoutRef.current = null;
		}
	}, []);

	const queueProjectSave = useCallback((task: () => Promise<boolean>) => {
		const run = projectSaveQueueRef.current.catch(() => undefined).then(task);
		projectSaveQueueRef.current = run.catch(() => undefined);
		return run;
	}, []);

	const saveBlobExport = useCallback(
		async (blob: Blob, fileName: string, outputPath: string | null = null) => {
			const extension = fileName.split(".").pop()?.toLowerCase() || "bin";
			const hasExportStreamApi =
				typeof window !== "undefined" &&
				typeof window.electronAPI?.openExportStream === "function" &&
				typeof window.electronAPI?.writeExportStreamChunk === "function" &&
				typeof window.electronAPI?.closeExportStream === "function";
			let streamError: unknown = null;

			try {
				const tempFilePath = await streamExportBlobToTempFile(blob, extension);
				if (tempFilePath) {
					return {
						saveResult: await window.electronAPI.finalizeExportedVideo({
							tempPath: tempFilePath,
							fileName,
							outputPath,
						}),
						pendingSave: {
							fileName,
							tempFilePath,
						} satisfies PendingExportSave,
					};
				}
			} catch (error) {
				streamError = error;
				console.warn("[export] Temp-file blob save failed", error);
			}

			if (
				!canUseInMemoryExportSaveFallback({
					blobSize: blob.size,
					extension,
					hasExportStreamApi,
				})
			) {
				const message = describeBlockedInMemoryExportSave({
					blobSize: blob.size,
					extension,
				});
				console.error("[export] Refusing in-memory blob save fallback", {
					fileName,
					blobSize: blob.size,
					extension,
					hasExportStreamApi,
					streamError,
				});
				throw new Error(message);
			}

			console.warn("[export] Falling back to in-memory blob save", {
				fileName,
				blobSize: blob.size,
				extension,
				hasExportStreamApi,
			});
			const arrayBuffer = await blob.arrayBuffer();
			return {
				saveResult: outputPath
					? await window.electronAPI.writeExportedVideoToPath(arrayBuffer, outputPath)
					: await window.electronAPI.saveExportedVideo(arrayBuffer, fileName),
				pendingSave: {
					fileName,
					arrayBuffer,
				} satisfies PendingExportSave,
			};
		},
		[],
	);

	useEffect(() => {
		return () => {
			exporterRef.current?.cancel();
			exporterRef.current = null;
			const pending = pendingExportSaveRef.current;
			pendingExportSaveRef.current = null;
			if (pending?.tempFilePath && typeof window !== "undefined") {
				void window.electronAPI.discardExportedTemp?.(pending.tempFilePath);
			}
			if (pendingTelemetryRetryTimeoutRef.current !== null) {
				window.clearTimeout(pendingTelemetryRetryTimeoutRef.current);
				pendingTelemetryRetryTimeoutRef.current = null;
			}
			if (pendingFreshRecordingAutoSuggestTimeoutRef.current !== null) {
				window.clearTimeout(pendingFreshRecordingAutoSuggestTimeoutRef.current);
				pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
			}
			if (projectAutosaveTimeoutRef.current !== null) {
				window.clearTimeout(projectAutosaveTimeoutRef.current);
				projectAutosaveTimeoutRef.current = null;
			}
		};
	}, []);

	useEffect(() => {
		void refreshProjectLibrary();
	}, [refreshProjectLibrary]);

	const canUndo = editorHistoryRef.current.past.length > 0;
	const canRedo = editorHistoryRef.current.future.length > 0;

	void historyVersion;

	const gifOutputDimensions = useMemo(
		() =>
			calculateOutputDimensions(
				videoPlaybackRef.current?.video?.videoWidth || 1920,
				videoPlaybackRef.current?.video?.videoHeight || 1080,
				gifSizePreset,
				GIF_SIZE_PRESETS,
			),
		[gifSizePreset],
	);

	const desiredMp4SourceDimensions = useMemo(
		() =>
			calculateMp4SourceDimensions(
				videoPlaybackRef.current?.video?.videoWidth || 1920,
				videoPlaybackRef.current?.video?.videoHeight || 1080,
				aspectRatio,
			),
		[aspectRatio],
	);

	const mp4OutputDimensions = useMemo(() => {
		const baseWidth = supportedMp4SourceDimensions.encoderPath
			? supportedMp4SourceDimensions.width
			: desiredMp4SourceDimensions.width;
		const baseHeight = supportedMp4SourceDimensions.encoderPath
			? supportedMp4SourceDimensions.height
			: desiredMp4SourceDimensions.height;

		return {
			medium: calculateMp4ExportDimensions(baseWidth, baseHeight, "medium"),
			good: calculateMp4ExportDimensions(baseWidth, baseHeight, "good"),
			high: calculateMp4ExportDimensions(baseWidth, baseHeight, "high"),
			source: calculateMp4ExportDimensions(baseWidth, baseHeight, "source"),
		};
	}, [
		desiredMp4SourceDimensions.height,
		desiredMp4SourceDimensions.width,
		supportedMp4SourceDimensions.encoderPath,
		supportedMp4SourceDimensions.height,
		supportedMp4SourceDimensions.width,
	]);

	const ensureSupportedMp4SourceDimensions = useCallback(
		async (frameRate: ExportMp4FrameRate) => {
			const result = await probeSupportedMp4Dimensions({
				width: desiredMp4SourceDimensions.width,
				height: desiredMp4SourceDimensions.height,
				frameRate,
				codec: DEFAULT_MP4_CODEC,
				getBitrate: getSourceQualityBitrate,
			});

			if (!result.encoderPath) {
				throw new Error(
					`Video encoding not supported on this system. Tried codec ${DEFAULT_MP4_CODEC} at ${frameRate} FPS up to ${desiredMp4SourceDimensions.width}x${desiredMp4SourceDimensions.height}.`,
				);
			}

			setSupportedMp4SourceDimensions((current) => {
				if (
					current.width === result.width &&
					current.height === result.height &&
					current.capped === result.capped &&
					current.encoderPath?.codec === result.encoderPath?.codec &&
					current.encoderPath?.hardwareAcceleration ===
						result.encoderPath?.hardwareAcceleration
				) {
					return current;
				}

				return result;
			});

			return result;
		},
		[desiredMp4SourceDimensions.height, desiredMp4SourceDimensions.width],
	);

	useEffect(() => {
		let cancelled = false;
		const requestId = mp4SupportRequestRef.current + 1;
		mp4SupportRequestRef.current = requestId;
		setSupportedMp4SourceDimensions({
			width: desiredMp4SourceDimensions.width,
			height: desiredMp4SourceDimensions.height,
			capped: false,
			encoderPath: null,
		});

		void ensureSupportedMp4SourceDimensions(mp4FrameRate)
			.then((result) => {
				if (cancelled || requestId !== mp4SupportRequestRef.current) {
					return;
				}
				setSupportedMp4SourceDimensions(result);
			})
			.catch(() => {
				if (cancelled || requestId !== mp4SupportRequestRef.current) {
					return;
				}
				setSupportedMp4SourceDimensions({
					width: desiredMp4SourceDimensions.width,
					height: desiredMp4SourceDimensions.height,
					capped: false,
					encoderPath: null,
				});
			});

		return () => {
			cancelled = true;
		};
	}, [
		desiredMp4SourceDimensions.height,
		desiredMp4SourceDimensions.width,
		ensureSupportedMp4SourceDimensions,
		mp4FrameRate,
	]);

	const activeSlide = useMemo(() => {
		if (clips.length === 0) return null;
		return clips.find((c) => c.id === selectedClipId) ?? clips[0];
	}, [clips, selectedClipId]);

	// Derive the editing mode of the active slide. Legacy clips
	// (without a slideMode field) default based on their origin.
	const activeSlideMode =
		activeSlide?.slideMode ?? (activeSlide?.origin === "uploaded" ? "video" : "record");

	// Extension-contributed standalone section pages (no parentSection)
	const editorSectionButtons = useMemo(() => {
		if (activeSlideMode === "video") {
			return [
				{ id: "media" as const, label: t("settings.sections.media", "Media"), icon: PhFolder },
				{
					id: "video-adjust" as const,
					label: t("settings.sections.videoAdjust", "Transform"),
					icon: PhSliders,
				},
				{
					id: "audio-record" as const,
					label: t("settings.sections.audioRecord", "Audio & Mic"),
					icon: PhMicrophone,
				},
				{
					id: "transitions" as const,
					label: t("settings.sections.transitions", "Transitions"),
					icon: PhArrowsLeftRight,
				},
				{
					id: "color-grading" as const,
					label: t("settings.sections.colorGrading", "Filters & Color"),
					icon: PhFaders,
				},
				{
					id: "settings" as const,
					label: t("settings.sections.settings", "Settings"),
					icon: PhSettings,
				},
			];
		}

		return [
			{ id: "scene" as const, label: t("settings.sections.scene", "Scene"), icon: PhSparkle },
			{
				id: "cursor" as const,
				label: t("settings.sections.cursor", "Cursor"),
				icon: PhCursorFill,
			},
			{
				id: "webcam" as const,
				label: t("settings.sections.webcam", "Webcam"),
				icon: PhCamera,
			},
			{
				id: "layout" as const,
				label: t("settings.sections.layout", "Layout"),
				icon: PhLayout,
			},
			{
				id: "color-grading" as const,
				label: t("settings.sections.colorGrading", "Filters & Color"),
				icon: PhFaders,
			},
			{
				id: "settings" as const,
				label: t("settings.sections.settings", "Settings"),
				icon: PhSettings,
			},
		];
	}, [activeSlideMode, t]);

	useEffect(() => {
		if (activeSlideMode === "video") {
			const validVideoSections = [
				"media",
				"video-adjust",
				"audio-record",
				"transitions",
				"color-grading",
				"settings",
			];
			if (!validVideoSections.includes(activeEffectSection)) {
				setActiveEffectSection("media");
			}
		} else {
			const validRecordSections = [
				"scene",
				"cursor",
				"webcam",
				"layout",
				"color-grading",
				"settings",
			];
			if (!validRecordSections.includes(activeEffectSection)) {
				setActiveEffectSection("scene");
			}
		}
	}, [activeSlideMode]);

	useEffect(() => {
		if (activeEffectSection === "frame" || activeEffectSection === "crop") {
			setActiveEffectSection("scene");
		}
	}, [activeEffectSection]);

	const buildPersistedEditorState = useCallback(
		(
			editor: Partial<{
				wallpaper: string;
				shadowIntensity: number;
				backgroundBlur: number;
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
				colorGrading: ColorGradingSettings;
				padding: Padding;
				frame: string | null;
				cropRegion: CropRegion;
				webcam: WebcamOverlaySettings;
				zoomRegions: ZoomRegion[];
				trimRegions: TrimRegion[];
				clipRegions: ClipRegion[];
				layoutRegions: LayoutRegion[];
				speedRegions: SpeedRegion[];
				annotationRegions: AnnotationRegion[];
				audioRegions: AudioRegion[];
				audioDuckingSettings: AudioDuckingSettings;
				aspectRatio: AspectRatio;
				exportEncodingMode: ExportEncodingMode;
				exportBackendPreference: ExportBackendPreference;
				exportPipelineModel: ExportPipelineModel;
				exportQuality: ExportQuality;
				mp4FrameRate: ExportMp4FrameRate;
				exportFormat: ExportFormat;
				gifFrameRate: GifFrameRate;
				gifLoop: boolean;
				gifSizePreset: GifSizePreset;
				sourceAudioTrackSettingsByClip: Record<string, SourceAudioTrackSettings>;
				defaultSourceAudioTrackSettings: SourceAudioTrackSettings;
			}>,
		) => {
			return stripPersistedDevMotionBlurSettings(editor);
		},
		[],
	);

	const currentSourcePath = useMemo(
		() => videoSourcePath ?? (videoPath ? fromFileUrl(videoPath) : null),
		[videoPath, videoSourcePath],
	);
	const projectDisplayName = useMemo(() => {
		const fileName =
			currentProjectPath?.split(/[\\/]/).pop() ??
			currentSourcePath?.split(/[\\/]/).pop() ??
			"";
		const withoutExtension = fileName.replace(/\.(captr|recordly)$/i, "").replace(/\.[^.]+$/, "");
		return withoutExtension || t("editor.project.untitled", "Untitled");
	}, [currentProjectPath, currentSourcePath, t]);

	useEffect(() => {
		if (!isEditingProjectName) {
			setProjectNameDraft(projectDisplayName);
		}
	}, [isEditingProjectName, projectDisplayName]);

	useEffect(() => {
		if (!isEditingProjectName) {
			return;
		}

		const frameId = window.requestAnimationFrame(() => {
			projectNameInputRef.current?.focus();
			projectNameInputRef.current?.select();
		});

		return () => {
			window.cancelAnimationFrame(frameId);
		};
	}, [isEditingProjectName]);

	const currentPersistedEditorState = useMemo(
		() =>
			buildPersistedEditorState({
				wallpaper,
				shadowIntensity,
				backgroundBlur,
				zoomMotionBlur,
				zoomMotionBlurTuning,
				zoomTemporalMotionBlur,
				zoomMotionBlurSampleCount,
				zoomMotionBlurShutterFraction,
				connectZooms,
				zoomInDurationMs,
				zoomInOverlapMs,
				zoomOutDurationMs,
				connectedZoomGapMs,
				connectedZoomDurationMs,
				zoomInEasing,
				zoomOutEasing,
				connectedZoomEasing,
				showCursor,
				loopCursor,
				cursorStyle,
				cursorSize,
				cursorSmoothing,
				cursorSpringStiffnessMultiplier,
				cursorSpringDampingMultiplier,
				cursorSpringMassMultiplier,
				cameraSpringStiffnessMultiplier,
				cameraSpringDampingMultiplier,
				cameraSpringMassMultiplier,
				zoomSmoothness,
				zoomClassicMode,
				cursorMotionBlur,
				cursorClickBounce,
				cursorClickBounceDuration,
				cursorSway,
				cameraPerspectiveTilt,
				borderRadius,
				colorGrading,
				padding,
				frame,
				cropRegion,
				webcam,
				zoomRegions,
				trimRegions,
				clipRegions,
				layoutRegions,
				speedRegions,
				annotationRegions,
				audioRegions,
				audioDuckingSettings,
				aspectRatio,
				exportEncodingMode,
				exportBackendPreference,
				exportPipelineModel,
				exportQuality,
				mp4FrameRate,
				exportFormat,
				gifFrameRate,
				gifLoop,
				gifSizePreset,
				sourceAudioTrackSettingsByClip,
				defaultSourceAudioTrackSettings,
			}),
		[
			buildPersistedEditorState,
			wallpaper,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			zoomMotionBlurTuning,
			zoomTemporalMotionBlur,
			zoomMotionBlurSampleCount,
			zoomMotionBlurShutterFraction,
			connectZooms,
			zoomInDurationMs,
			zoomInOverlapMs,
			zoomOutDurationMs,
			connectedZoomGapMs,
			connectedZoomDurationMs,
			zoomInEasing,
			zoomOutEasing,
			connectedZoomEasing,
			showCursor,
			loopCursor,
			cursorStyle,
			cursorSize,
			cursorSmoothing,
			cursorSpringStiffnessMultiplier,
			cursorSpringDampingMultiplier,
			cursorSpringMassMultiplier,
			cameraSpringStiffnessMultiplier,
			cameraSpringDampingMultiplier,
			cameraSpringMassMultiplier,
			zoomSmoothness,
			zoomClassicMode,
			cursorMotionBlur,
			cursorClickBounce,
			cursorClickBounceDuration,
			cursorSway,
			cameraPerspectiveTilt,
			borderRadius,
			colorGrading,
			padding,
			cropRegion,
			webcam,
			zoomRegions,
			trimRegions,
			clipRegions,
			layoutRegions,
			speedRegions,
			annotationRegions,
			audioRegions,
			audioDuckingSettings,
			aspectRatio,
			exportEncodingMode,
			exportBackendPreference,
			exportPipelineModel,
			exportQuality,
			mp4FrameRate,
			exportFormat,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
			frame,
			sourceAudioTrackSettingsByClip,
			defaultSourceAudioTrackSettings,
		],
	);

	const buildHistorySnapshot = useCallback((): EditorHistorySnapshot => {
		return {
			zoomRegions,
			clipRegions,
			layoutRegions,
			speedRegions,
			annotationRegions,
			audioRegions,
			selectedZoomId,
			selectedClipId,
			selectedLayoutId,
			selectedAnnotationId,
			selectedAudioId,
		};
	}, [
		zoomRegions,
		clipRegions,
		layoutRegions,
		speedRegions,
		annotationRegions,
		audioRegions,
		selectedZoomId,
		selectedClipId,
		selectedLayoutId,
		selectedAnnotationId,
		selectedAudioId,
	]);

	const applyHistorySnapshot = useCallback((snapshot: EditorHistorySnapshot) => {
		applyingHistoryRef.current = true;
		const cloned = cloneStructured(snapshot);
		setZoomRegions(cloned.zoomRegions);
		setClipRegions(cloned.clipRegions);
		setLayoutRegions(cloned.layoutRegions);
		setSpeedRegions(cloned.speedRegions);
		setAnnotationRegions(cloned.annotationRegions);
		setAudioRegions(cloned.audioRegions);
		setSelectedZoomId(cloned.selectedZoomId);
		setSelectedClipId(cloned.selectedClipId);
		setSelectedLayoutId(cloned.selectedLayoutId);
		setSelectedAnnotationId(cloned.selectedAnnotationId);
		setSelectedAudioId(cloned.selectedAudioId);

		nextZoomIdRef.current = deriveNextId(
			"zoom",
			cloned.zoomRegions.map((region) => region.id),
		);
		nextClipIdRef.current = deriveNextId(
			"clip",
			cloned.clipRegions.map((region) => region.id),
		);
		nextLayoutIdRef.current = deriveNextId(
			"layout",
			cloned.layoutRegions.map((region) => region.id),
		);
		nextAnnotationIdRef.current = deriveNextId(
			"annotation",
			cloned.annotationRegions.map((region) => region.id),
		);
		nextAudioIdRef.current = deriveNextId(
			"audio",
			cloned.audioRegions.map((region) => region.id),
		);
		nextAnnotationZIndexRef.current =
			cloned.annotationRegions.reduce((max, region) => Math.max(max, region.zIndex), 0) + 1;
	}, []);

	const handleUndo = useCallback(() => {
		const previous = undoEditorHistoryStack(editorHistoryRef.current, buildHistorySnapshot());
		if (!previous) return;

		applyHistorySnapshot(previous);
		syncHistoryButtons();
	}, [applyHistorySnapshot, buildHistorySnapshot, syncHistoryButtons]);

	const handleRedo = useCallback(() => {
		const next = redoEditorHistoryStack(editorHistoryRef.current, buildHistorySnapshot());
		if (!next) return;

		applyHistorySnapshot(next);
		syncHistoryButtons();
	}, [applyHistorySnapshot, buildHistorySnapshot, syncHistoryButtons]);

	const applyLoadedProject = useCallback(
		async (candidate: unknown, path?: string | null) => {
			if (!validateProjectData(candidate)) {
				return false;
			}

			const project = candidate;
			const sourcePath = fromFileUrl(project.videoPath);
			const normalizedEditor = normalizeProjectEditor(
				stripPersistedDevMotionBlurSettings(project.editor ?? {}),
			);

			try {
				videoPlaybackRef.current?.pause();
			} catch {
				// no-op
			}
			setIsPlaying(false);
			setCurrentTime(0);
			setDuration(0);

			setError(null);
			setVideoSourcePath(sourcePath);
			setVideoPath(await resolveVideoUrl(sourcePath));
			setCurrentProjectPath(path ?? null);
			pendingFreshRecordingAutoZoomPathRef.current = null;
			if (normalizedEditor.webcam.sourcePath) {
				await window.electronAPI.setCurrentRecordingSession?.(
					{
						videoPath: sourcePath,
						webcamPath: normalizedEditor.webcam.sourcePath,
						timeOffsetMs: normalizedEditor.webcam.timeOffsetMs,
					},
					{
						preserveProjectPath: Boolean(path),
					},
				);
				const sessionResult = await window.electronAPI.getCurrentRecordingSession?.();
				applySessionPresentation(sessionResult?.success ? sessionResult.session : null);
			} else {
				await window.electronAPI.setCurrentVideoPath(sourcePath, {
					preserveProjectPath: Boolean(path),
				});
				applySessionPresentation(null);
			}

			setWallpaper(normalizedEditor.wallpaper);
			setShadowIntensity(normalizedEditor.shadowIntensity);
			setBackgroundBlur(normalizedEditor.backgroundBlur);
			setZoomMotionBlur(normalizedEditor.zoomMotionBlur);
			setZoomMotionBlurTuning({ ...normalizedEditor.zoomMotionBlurTuning });
			setZoomTemporalMotionBlur(normalizedEditor.zoomTemporalMotionBlur);
			setZoomMotionBlurSampleCount(normalizedEditor.zoomMotionBlurSampleCount);
			setZoomMotionBlurShutterFraction(normalizedEditor.zoomMotionBlurShutterFraction);
			setConnectZooms(normalizedEditor.connectZooms);
			setZoomInDurationMs(normalizedEditor.zoomInDurationMs);
			setZoomInOverlapMs(normalizedEditor.zoomInOverlapMs);
			setZoomOutDurationMs(normalizedEditor.zoomOutDurationMs);
			setConnectedZoomGapMs(normalizedEditor.connectedZoomGapMs);
			setConnectedZoomDurationMs(normalizedEditor.connectedZoomDurationMs);
			setZoomInEasing(normalizedEditor.zoomInEasing);
			setZoomOutEasing(normalizedEditor.zoomOutEasing);
			setConnectedZoomEasing(normalizedEditor.connectedZoomEasing);
			setShowCursor(normalizedEditor.showCursor);
			setLoopCursor(normalizedEditor.loopCursor);
			setCursorStyle(normalizedEditor.cursorStyle);
			setCursorSize(normalizedEditor.cursorSize);
			setCursorSmoothing(normalizedEditor.cursorSmoothing);
			setCursorSpringStiffnessMultiplier(normalizedEditor.cursorSpringStiffnessMultiplier);
			setCursorSpringDampingMultiplier(normalizedEditor.cursorSpringDampingMultiplier);
			setCursorSpringMassMultiplier(normalizedEditor.cursorSpringMassMultiplier);
			setCameraSpringStiffnessMultiplier(normalizedEditor.cameraSpringStiffnessMultiplier);
			setCameraSpringDampingMultiplier(normalizedEditor.cameraSpringDampingMultiplier);
			setCameraSpringMassMultiplier(normalizedEditor.cameraSpringMassMultiplier);
			setZoomSmoothness(normalizedEditor.zoomSmoothness);
			setZoomClassicMode(normalizedEditor.zoomClassicMode);
			setCursorMotionBlur(normalizedEditor.cursorMotionBlur);
			setCursorClickBounce(normalizedEditor.cursorClickBounce);
			setCursorClickBounceDuration(normalizedEditor.cursorClickBounceDuration);
			setCursorSway(normalizedEditor.cursorSway);
			setCameraPerspectiveTilt(normalizedEditor.cameraPerspectiveTilt);
			setBorderRadius(normalizedEditor.borderRadius);
			setColorGrading(normalizedEditor.colorGrading);
			setPadding(normalizedEditor.padding);
			setFrame(normalizedEditor.frame);
			setCropRegion(normalizedEditor.cropRegion);
			setWebcam(normalizedEditor.webcam);
			setZoomRegions(normalizedEditor.zoomRegions);
			setTrimRegions(normalizedEditor.trimRegions);
			setClipRegions(normalizedEditor.clipRegions);
			setLayoutRegions(normalizedEditor.layoutRegions);
			clipInitializedRef.current = normalizedEditor.clipRegions.length > 0;
			autoFullTrackClipIdRef.current = null;
			autoFullTrackClipEndMsRef.current = null;
			setSpeedRegions(normalizedEditor.speedRegions);
			const hydratedAnnotations = await Promise.all(
				normalizedEditor.annotationRegions.map(async (region) => {
					if (region.type === "gif" && region.gifPath && !region.gifDataUrl) {
						if (
							window.electronAPI &&
							typeof window.electronAPI.readFileAsDataUrl === "function"
						) {
							const dataUrl = await window.electronAPI.readFileAsDataUrl(
								region.gifPath,
							);
							return dataUrl ? { ...region, gifDataUrl: dataUrl } : region;
						}
					}
					if (
						region.type === "image" &&
						region.imageFilePath &&
						(!region.content || region.content === "")
					) {
						if (
							window.electronAPI &&
							typeof window.electronAPI.readFileAsDataUrl === "function"
						) {
							const dataUrl = await window.electronAPI.readFileAsDataUrl(
								region.imageFilePath,
							);
							return dataUrl
								? { ...region, content: dataUrl, imageContent: dataUrl }
								: region;
						}
					}
					return region;
				}),
			);
			setAnnotationRegions(hydratedAnnotations);
			let initialSelectedClipId: string | null = null;
			if (project.clips && project.clips.length > 0) {
				const normalizedClips = normalizeClipEntries(project.clips);
				setClips(normalizedClips);
				initialSelectedClipId = normalizedClips[0]?.id ?? null;

				// Ensure timeline clipRegions are in sync with multi-clips if missing or length mismatched
				if (
					!normalizedEditor.clipRegions ||
					normalizedEditor.clipRegions.length === 0 ||
					normalizedEditor.clipRegions.length !== normalizedClips.length
				) {
					const generatedRegions = buildSceneClipRegions(normalizedClips, normalizedEditor.clipRegions);
					setClipRegions(generatedRegions);
				}

				// Load first clip properties into active editor state
				const firstClip = normalizedClips[0];
				if (firstClip) {
					if (firstClip.wallpaper !== undefined) setWallpaper(firstClip.wallpaper);
					if (firstClip.cropRegion !== undefined) setCropRegion(firstClip.cropRegion);
					if (firstClip.layoutRegions !== undefined) setLayoutRegions(firstClip.layoutRegions);
					if (firstClip.zoomRegions !== undefined) setZoomRegions(firstClip.zoomRegions);
					if (firstClip.webcam) setWebcam(firstClip.webcam);
					if (typeof firstClip.showCursor === "boolean") setShowCursor(firstClip.showCursor);
				}
			} else if (project.videoPath) {
				const defaultClip: ClipEntry = {
					id: "clip-1",
					origin: "recorded",
					videoPath: project.videoPath,
					webcamPath: normalizedEditor.webcam.sourcePath ?? null,
					startMsOffset: 0,
					durationMs: 0,
					label: "Take 1",
					showCursor: true,
				};
				setClips([defaultClip]);
				initialSelectedClipId = "clip-1";
				nextClipIdRef.current = Math.max(nextClipIdRef.current, 2);
			} else {
				setClips([]);
			}
			setAudioRegions(normalizedEditor.audioRegions);
			setSourceAudioTrackSettingsByClip(
				normalizedEditor.sourceAudioTrackSettingsByClip ?? {},
			);
			setDefaultSourceAudioTrackSettings(
				normalizedEditor.defaultSourceAudioTrackSettings ?? {},
			);
			setAudioDuckingSettings(
				normalizedEditor.audioDuckingSettings ?? DEFAULT_AUDIO_DUCKING_SETTINGS,
			);
			setAspectRatio(normalizedEditor.aspectRatio);
			setExportEncodingMode(normalizedEditor.exportEncodingMode);
			setExportBackendPreference(normalizedEditor.exportBackendPreference);
			setExportPipelineModel(normalizedEditor.exportPipelineModel);
			setExportQuality(normalizedEditor.exportQuality);
			setMp4FrameRate(normalizedEditor.mp4FrameRate);
			setExportFormat(normalizedEditor.exportFormat);
			setGifFrameRate(normalizedEditor.gifFrameRate);
			setGifLoop(normalizedEditor.gifLoop);
			setGifSizePreset(normalizedEditor.gifSizePreset);

			setSelectedZoomId(null);
			setSelectedClipId(initialSelectedClipId);
			setSelectedLayoutId(null);
			setSelectedAnnotationId(null);
			setSelectedAudioId(null);

			nextZoomIdRef.current = deriveNextId(
				"zoom",
				normalizedEditor.zoomRegions.map((region) => region.id),
			);
			nextClipIdRef.current = deriveNextId(
				"clip",
				normalizedEditor.clipRegions.map((region: ClipRegion) => region.id),
			);
			nextLayoutIdRef.current = deriveNextId(
				"layout",
				normalizedEditor.layoutRegions.map((region) => region.id),
			);
			nextAudioIdRef.current = deriveNextId(
				"audio",
				normalizedEditor.audioRegions.map((region) => region.id),
			);
			nextAnnotationIdRef.current = deriveNextId(
				"annotation",
				normalizedEditor.annotationRegions.map((region) => region.id),
			);
			nextAnnotationZIndexRef.current =
				normalizedEditor.annotationRegions.reduce(
					(max, region) => Math.max(max, region.zIndex),
					0,
				) + 1;

			resetEditorHistoryStack(editorHistoryRef.current);
			applyingHistoryRef.current = false;
			syncHistoryButtons();

			setLastSavedSnapshot(
				cloneStructured(
					createProjectData(
						sourcePath,
						buildPersistedEditorState(normalizedEditor),
						project.projectId ?? null,
						project.clips ?? [],
					),
				),
			);
			await refreshProjectLibrary();
			return true;
		},
		[
			applySessionPresentation,
			buildPersistedEditorState,
			refreshProjectLibrary,
			syncHistoryButtons,
		],
	);

	const currentProjectSnapshot = useMemo(() => {
		if (!currentSourcePath) {
			return null;
		}
		return createProjectData(
			currentSourcePath,
			currentPersistedEditorState,
			lastSavedSnapshot?.projectId ?? null,
			clips,
		);
	}, [currentPersistedEditorState, currentSourcePath, lastSavedSnapshot?.projectId, clips]);

	const syncRecordingSessionWebcam = useCallback(
		async (webcamPath: string | null, timeOffsetMs?: number) => {
			if (!currentSourcePath || !window.electronAPI.setCurrentRecordingSession) {
				return;
			}

			await window.electronAPI.setCurrentRecordingSession(
				{
					videoPath: currentSourcePath,
					webcamPath,
					timeOffsetMs:
						webcamPath && Number.isFinite(timeOffsetMs)
							? (timeOffsetMs ?? DEFAULT_WEBCAM_TIME_OFFSET_MS)
							: webcamPath
								? webcam.timeOffsetMs
								: DEFAULT_WEBCAM_TIME_OFFSET_MS,
				},
				{
					preserveProjectPath: Boolean(currentProjectPath),
				},
			);
		},
		[currentProjectPath, currentSourcePath, webcam.timeOffsetMs],
	);

	

	const handleUploadWebcam = useCallback(async () => {
		const result = await window.electronAPI.openVideoFilePicker();
		if (!result.success || !result.path) {
			return;
		}

		setWebcam((prev) => ({
			...prev,
			enabled: true,
			sourcePath: result.path ?? null,
			timeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
		}));

		await syncRecordingSessionWebcam(result.path, DEFAULT_WEBCAM_TIME_OFFSET_MS);
		toast.success(t("settings.effects.webcamFootageAdded"));
	}, [syncRecordingSessionWebcam, t]);

	const handleClearWebcam = useCallback(async () => {
		setWebcam((prev) => ({
			...prev,
			enabled: false,
			sourcePath: null,
			timeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
		}));

		await syncRecordingSessionWebcam(null);
		toast.success(t("settings.effects.webcamFootageRemoved"));
	}, [syncRecordingSessionWebcam, t]);

	useEffect(() => {
		const snapshot = buildHistorySnapshot();
		const result = recordEditorHistorySnapshot(editorHistoryRef.current, snapshot, {
			applyingHistory: applyingHistoryRef.current,
		});

		if (result === "applied") {
			applyingHistoryRef.current = false;
		}

		if (result !== "unchanged") {
			syncHistoryButtons();
		}
	}, [buildHistorySnapshot, syncHistoryButtons]);

	const hasUnsavedChanges = useMemo(
		() => hasUnsavedProjectChanges(currentProjectSnapshot, lastSavedSnapshot),
		[currentProjectSnapshot, lastSavedSnapshot],
	);

	useEffect(() => {
		async function loadInitialData() {
			try {
				if (smokeExportConfig.enabled && smokeExportConfig.projectPath) {
					const projectResult = await window.electronAPI.openProjectFileAtPath(
						smokeExportConfig.projectPath,
					);
					if (!projectResult.success || !projectResult.project) {
						setError(
							`Smoke export failed to load project ${smokeExportConfig.projectPath}: ${
								projectResult.error || projectResult.message || "unknown error"
							}`,
						);
						return;
					}
					const restored = await applyLoadedProject(
						projectResult.project,
						projectResult.path ?? smokeExportConfig.projectPath,
					);
					if (!restored) {
						setError(
							`Smoke export could not apply project ${smokeExportConfig.projectPath}`,
						);
						return;
					}
					setError(null);
					return;
				}

				if (!smokeExportConfig.enabled && devOpenRecordingConfig.inputPath) {
					const sourcePath = fromFileUrl(devOpenRecordingConfig.inputPath);
					const sourceVideoUrl = await resolveVideoUrl(sourcePath);
					const webcamSourcePath = devOpenRecordingConfig.webcamInputPath
						? fromFileUrl(devOpenRecordingConfig.webcamInputPath)
						: null;
					setVideoSourcePath(sourcePath);
					setVideoPath(sourceVideoUrl);
					setCurrentProjectPath(null);
					setLastSavedSnapshot(null);
					pendingFreshRecordingAutoZoomPathRef.current = autoApplyFreshRecordingAutoZooms
						? sourceVideoUrl
						: null;
					setWebcam((prev) => ({
						...prev,
						enabled: Boolean(webcamSourcePath),
						sourcePath: webcamSourcePath,
						timeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
					}));
					setError(null);
					return;
				}

				if (smokeExportConfig.enabled) {
					if (!smokeExportConfig.inputPath) {
						setError("Smoke export input path is missing.");
						return;
					}

					const sourcePath = fromFileUrl(smokeExportConfig.inputPath);
					const sourceVideoUrl = await resolveVideoUrl(sourcePath);
					const smokeWebcamSourcePath = smokeExportConfig.webcamInputPath
						? fromFileUrl(smokeExportConfig.webcamInputPath)
						: null;
					setVideoSourcePath(sourcePath);
					setVideoPath(sourceVideoUrl);
					setCurrentProjectPath(null);
					setLastSavedSnapshot(null);
					pendingFreshRecordingAutoZoomPathRef.current = null;
					setWebcam((prev) => ({
						...prev,
						enabled: !!smokeWebcamSourcePath,
						sourcePath: smokeWebcamSourcePath,
						timeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
						shadow:
							smokeExportConfig.webcamShadow === undefined
								? prev.shadow
								: smokeExportConfig.webcamShadow,
						size:
							smokeExportConfig.webcamSize === undefined
								? prev.size
								: smokeExportConfig.webcamSize,
					}));
					setError(null);
					return;
				}

				const currentProjectResult = await window.electronAPI.loadCurrentProjectFile();
				if (currentProjectResult.success && currentProjectResult.project) {
					const restored = await applyLoadedProject(
						currentProjectResult.project,
						currentProjectResult.path ?? null,
					);
					if (restored) {
						// Re-apply user preferences so stale project data does not
						// overwrite the last-used padding, aspect ratio, export
						// settings, etc. that were saved to localStorage.
						setPadding(initialEditorPreferences.padding);
						setBorderRadius(initialEditorPreferences.borderRadius);
						setAspectRatio(initialEditorPreferences.aspectRatio);
						setExportFormat(initialEditorPreferences.exportFormat);
						setMp4FrameRate(
							initialEditorPreferences.mp4FrameRate ?? DEFAULT_MP4_EXPORT_FRAME_RATE,
						);
						setExportQuality(initialEditorPreferences.exportQuality);
						setExportEncodingMode(initialEditorPreferences.exportEncodingMode);
						setExportBackendPreference(
							initialEditorPreferences.exportBackendPreference,
						);
						setExportPipelineModel(initialEditorPreferences.exportPipelineModel);
						setGifFrameRate(initialEditorPreferences.gifFrameRate);
						setGifLoop(initialEditorPreferences.gifLoop);
						setGifSizePreset(initialEditorPreferences.gifSizePreset);
						setViewMode("editor");
						return;
					}
				}

				// Fresh / empty studio startup in Captr Studio:
				// Clear any leftover stale recording session from main process memory
				// and present the Welcome / Home screen to the user.
				await window.electronAPI.clearCurrentVideoPath?.();
				setVideoSourcePath(null);
				setVideoPath(null);
				setClips([]);
				setClipRegions([]);
				setSelectedClipId(null);
				setError(null);
				setViewMode("welcome");
			} catch (err) {
				setError("Error loading video: " + String(err));
			} finally {
				setLoading(false);
			}
		}

		loadInitialData();
	}, [
		applyLoadedProject,
		applySessionPresentation,
		autoApplyFreshRecordingAutoZooms,
		devOpenRecordingConfig.inputPath,
		devOpenRecordingConfig.webcamInputPath,
		initialEditorPreferences,
		smokeExportConfig.enabled,
		smokeExportConfig.inputPath,
		smokeExportConfig.projectPath,
		smokeExportConfig.webcamInputPath,
		smokeExportConfig.webcamShadow,
		smokeExportConfig.webcamSize,
	]);

	useEffect(() => {
		if (!window.electronAPI.onRecordingSessionChanged) {
			return;
		}

		return window.electronAPI.onRecordingSessionChanged((session) => {
			console.log("[VideoEditor] onRecordingSessionChanged received!", {
				hasSession: Boolean(session),
				hasSessionVideoPath: Boolean(session?.videoPath),
				hasVideoSourcePath: Boolean(videoSourcePath),
				match: session?.videoPath === videoSourcePath,
				hasWebcamPath: Boolean(session?.webcamPath),
			});

			if (!session || !session.videoPath) {
				return;
			}

			const currentClips = clipsRef.current;

			// Deduplicate: check if a clip with this videoPath already exists
			const existingClip = currentClips.find((c) => c.videoPath === session.videoPath);
			if (existingClip) {
				console.log("[VideoEditor] Session videoPath already exists in clips, updating webcam if needed:", session.videoPath);
				if (session.webcamPath && !existingClip.webcamPath) {
					setClips((prevClips) =>
						prevClips.map((c) =>
							c.id === existingClip.id
								? {
										...c,
										webcamPath: session.webcamPath ?? null,
										webcam: session.webcamPath
											? {
													...(c.webcam ?? DEFAULT_WEBCAM_OVERLAY),
													enabled: true,
													sourcePath: session.webcamPath,
													timeOffsetMs: session.timeOffsetMs ?? DEFAULT_WEBCAM_TIME_OFFSET_MS,
											  }
											: c.webcam,
								  }
								: c,
						),
					);
					if (selectedClipId === existingClip.id) {
						setWebcam((prev) => ({
							...prev,
							enabled: Boolean(session.webcamPath),
							sourcePath: session.webcamPath ?? null,
							timeOffsetMs: session.webcamPath
								? (session.timeOffsetMs ?? prev.timeOffsetMs)
								: DEFAULT_WEBCAM_TIME_OFFSET_MS,
						}));
						if (session.webcamPath) {
							resolveVideoUrl(session.webcamPath).then((url) => {
								setResolvedWebcamVideoUrl(url);
							});
						}
					}
				}
				setPreviewVersion((v) => v + 1);
				return;
			}

			if (session.videoPath === videoSourcePathRef.current) {
				setWebcam((prev) => ({
					...prev,
					enabled: Boolean(session.webcamPath),
					sourcePath: session.webcamPath ?? null,
					timeOffsetMs: session.webcamPath
						? (session.timeOffsetMs ?? prev.timeOffsetMs)
						: DEFAULT_WEBCAM_TIME_OFFSET_MS,
				}));
				if (session.webcamPath) {
					resolveVideoUrl(session.webcamPath).then((url) => {
						setResolvedWebcamVideoUrl(url);
					});
				}
				setPreviewVersion((v) => v + 1);
				return;
			}

			// Newly recorded take finished in HUD!
			void (async () => {
				try {
					const resolvedUrl = await resolveVideoUrl(session.videoPath);
					const durMs = await new Promise<number>((resolve) => {
						const video = document.createElement("video");
						video.onloadedmetadata = () => resolve(Math.round(video.duration * 1000) || 5000);
						video.onerror = () => resolve(5000);
						video.src = resolvedUrl;
					});

					const latestClips = clipsRef.current;
					const latestClipRegions = clipRegionsRef.current;

					if (!videoSourcePathRef.current || latestClips.length === 0) {
						const newClipId = deriveUniqueClipId(latestClips, latestClipRegions);
						const newClip = createRecordedClip({
							id: newClipId,
							videoPath: session.videoPath,
							webcamPath: session.webcamPath ?? null,
							microphoneAudioPath: (session as { microphoneAudioPath?: string | null }).microphoneAudioPath ?? null,
							systemAudioPath: (session as { systemAudioPath?: string | null }).systemAudioPath ?? null,
							startMsOffset: 0,
							durationMs: durMs,
							label: "Slide 1",
							webcam: session.webcamPath
								? {
										...webcam,
										enabled: true,
										sourcePath: session.webcamPath,
										timeOffsetMs: session.timeOffsetMs ?? DEFAULT_WEBCAM_TIME_OFFSET_MS,
								  }
								: {
										...webcam,
										enabled: false,
										sourcePath: null,
								  },
						});
						setVideoSourcePath(session.videoPath);
						setVideoPath(resolvedUrl);
						setClips([newClip]);
						setSelectedClipId(newClipId);
						setClipRegions([
							{
								id: newClipId,
								startMs: 0,
								endMs: durMs,
								speed: 1,
							},
						]);
						if (session.webcamPath) {
							setWebcam((prev) => ({
								...prev,
								enabled: true,
								sourcePath: session.webcamPath ?? null,
								timeOffsetMs: session.timeOffsetMs ?? DEFAULT_WEBCAM_TIME_OFFSET_MS,
							}));
							resolveVideoUrl(session.webcamPath).then((url) => {
								setResolvedWebcamVideoUrl(url);
							});
						} else {
							setWebcam((prev) => ({
								...prev,
								enabled: false,
								sourcePath: null,
							}));
							setResolvedWebcamVideoUrl(null);
						}
						setShowCursor(true);
						setPreviewVersion((v) => v + 1);
						toast.success("Slide 1 recorded and added to project!");
					} else {
						const nextTakeNum = latestClips.length + 1;
						const newClipId = deriveUniqueClipId(latestClips, latestClipRegions);
						const startOffset = latestClips.reduce((acc, c) => acc + c.durationMs, 0);
						const newClip = createRecordedClip({
							id: newClipId,
							videoPath: session.videoPath,
							webcamPath: session.webcamPath ?? null,
							microphoneAudioPath: (session as { microphoneAudioPath?: string | null }).microphoneAudioPath ?? null,
							systemAudioPath: (session as { systemAudioPath?: string | null }).systemAudioPath ?? null,
							startMsOffset: startOffset,
							durationMs: durMs,
							label: `Slide ${nextTakeNum}`,
							webcam: session.webcamPath
								? {
										...DEFAULT_WEBCAM_OVERLAY,
										enabled: true,
										sourcePath: session.webcamPath,
										timeOffsetMs: session.timeOffsetMs ?? DEFAULT_WEBCAM_TIME_OFFSET_MS,
								  }
								: {
										...DEFAULT_WEBCAM_OVERLAY,
										enabled: false,
										sourcePath: null,
								  },
						});
						const currentClipsEndTime = latestClipRegions.reduce((acc, c) => Math.max(acc, c.endMs), 0);
						const newClipRegion: ClipRegion = {
							id: newClipId,
							startMs: currentClipsEndTime,
							endMs: currentClipsEndTime + durMs,
							speed: 1,
						};

						setClips((prevClips) => [...prevClips, newClip]);
						setClipRegions((prevRegions) => [...prevRegions, newClipRegion]);
						setSelectedClipId(newClipId);
						setVideoSourcePath(session.videoPath);
						setVideoPath(resolvedUrl);

						if (session.webcamPath) {
							setWebcam((prev) => ({
								...prev,
								enabled: true,
								sourcePath: session.webcamPath ?? null,
								timeOffsetMs: session.timeOffsetMs ?? DEFAULT_WEBCAM_TIME_OFFSET_MS,
							}));
							resolveVideoUrl(session.webcamPath).then((url) => {
								setResolvedWebcamVideoUrl(url);
							});
						} else {
							setWebcam((prev) => ({
								...prev,
								enabled: false,
								sourcePath: null,
							}));
							setResolvedWebcamVideoUrl(null);
						}
						setShowCursor(true);
						setPreviewVersion((v) => v + 1);
						toast.success(`Slide ${nextTakeNum} recorded and added!`);
					}
				} catch (err) {
					console.error("[VideoEditor] Failed to add newly recorded take:", err);
				}
			})();
		});
	}, [deriveUniqueClipId, selectedClipId, webcam]);

	useEffect(() => {
		let cancelled = false;
		if (!webcam.sourcePath) {
			setResolvedWebcamVideoUrl(null);
			return;
		}
		void resolveVideoUrl(webcam.sourcePath).then((url) => {
			if (!cancelled) setResolvedWebcamVideoUrl(url);
		});
		return () => {
			cancelled = true;
		};
	}, [webcam.sourcePath]);

	useEffect(() => {
		if (!autoApplyFreshRecordingAutoZooms) {
			pendingFreshRecordingAutoZoomPathRef.current = null;
		}
	}, [autoApplyFreshRecordingAutoZooms]);

	useEffect(() => {
		saveEditorPreferences({
			wallpaper,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			zoomMotionBlurTuning,
			zoomTemporalMotionBlur,
			zoomMotionBlurSampleCount,
			zoomMotionBlurShutterFraction,
			autoApplyFreshRecordingAutoZooms,
			connectZooms,
			zoomInDurationMs,
			zoomInOverlapMs,
			zoomOutDurationMs,
			connectedZoomGapMs,
			connectedZoomDurationMs,
			zoomInEasing,
			zoomOutEasing,
			connectedZoomEasing,
			showCursor,
			loopCursor,
			cursorStyle,
			cursorSize,
			cursorSmoothing,
			cursorSpringStiffnessMultiplier,
			cursorSpringDampingMultiplier,
			cursorSpringMassMultiplier,
			cameraSpringStiffnessMultiplier,
			cameraSpringDampingMultiplier,
			cameraSpringMassMultiplier,
			cursorMotionBlur,
			cursorClickBounce,
			cursorClickBounceDuration,
			cursorSway,
			cameraPerspectiveTilt,
			borderRadius,
			padding,
			frame,
			webcam,
			aspectRatio,
			exportEncodingMode,
			exportBackendPreference,
			exportPipelineModel,
			exportQuality,
			mp4FrameRate,
			exportFormat,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
		});
	}, [
		wallpaper,
		shadowIntensity,
		backgroundBlur,
		zoomMotionBlur,
		zoomMotionBlurTuning,
		zoomTemporalMotionBlur,
		zoomMotionBlurSampleCount,
		zoomMotionBlurShutterFraction,
		autoApplyFreshRecordingAutoZooms,
		connectZooms,
		zoomInDurationMs,
		zoomInOverlapMs,
		zoomOutDurationMs,
		connectedZoomGapMs,
		connectedZoomDurationMs,
		zoomInEasing,
		zoomOutEasing,
		connectedZoomEasing,
		showCursor,
		loopCursor,
		cursorStyle,
		cursorSize,
		cursorSmoothing,
		cursorSpringStiffnessMultiplier,
		cursorSpringDampingMultiplier,
		cursorSpringMassMultiplier,
		cameraSpringStiffnessMultiplier,
		cameraSpringDampingMultiplier,
		cameraSpringMassMultiplier,
		cursorMotionBlur,
		cursorClickBounce,
		cursorClickBounceDuration,
		cursorSway,
		cameraPerspectiveTilt,
		borderRadius,
		padding,
		frame,
		webcam,
		aspectRatio,
		exportEncodingMode,
		exportBackendPreference,
		exportPipelineModel,
		exportQuality,
		mp4FrameRate,
		exportFormat,
		gifFrameRate,
		gifLoop,
		gifSizePreset,
	]);

	

	const handleOpenRecorderHud = useCallback(async () => {
		try {
			if (window.electronAPI && typeof window.electronAPI.openRecorderHud === "function") {
				await window.electronAPI.openRecorderHud();
				toast.info("Recorder HUD opened. Complete your recording to add a take.");
			} else {
				toast.error("Recorder HUD is not supported on this platform.");
			}
		} catch (err) {
			console.error("Failed to open recorder HUD:", err);
			toast.error("Failed to open recorder HUD");
		}
	}, []);

	const handleSelectClip = useCallback(
		(id: string | null) => {
			isSwitchingClipRef.current = true;
			setSelectedClipId(id);
			if (id) {
				setActiveEffectSection("clip");
				setSelectedZoomId(null);
				setSelectedLayoutId(null);
				setSelectedAnnotationId(null);
				setSelectedAudioId(null);
				const clip = clipsRef.current.find((c) => c.id === id) ?? clips.find((c) => c.id === id);
				if (clip) {
					if (clip.wallpaper !== undefined) setWallpaper(clip.wallpaper);
					if (clip.cropRegion !== undefined) setCropRegion(clip.cropRegion);
					if (clip.layoutRegions !== undefined) setLayoutRegions(clip.layoutRegions);
					if (clip.zoomRegions !== undefined) setZoomRegions(clip.zoomRegions);

					// Main video
					if (clip.videoPath && clip.videoPath !== videoSourcePath) {
						setVideoSourcePath(clip.videoPath);
						resolveVideoUrl(clip.videoPath).then((url) => {
							setVideoPath(url);
						});
					}

					// ISOLATION: Webcam sidecar
					if (clip.webcamPath && clip.webcam?.enabled !== false) {
						setWebcam((prev) => ({
							...prev,
							sourcePath: clip.webcamPath ?? null,
							enabled: true,
							...(clip.webcam ?? {}),
						}));
						resolveVideoUrl(clip.webcamPath).then((url) => {
							setResolvedWebcamVideoUrl(url);
						});
					} else {
						// Strictly disable and clear webcam for takes without webcam or uploaded clips
						setWebcam((prev) => ({
							...prev,
							sourcePath: null,
							enabled: false,
						}));
						setResolvedWebcamVideoUrl(null);
					}

					// ISOLATION: Cursor Telemetry & synthetic cursor
					if (clip.origin === "uploaded") {
						setShowCursor(false);
						setCursorTelemetry([]);
						setCursorTelemetrySourcePath(null);
					} else {
						if (typeof clip.showCursor === "boolean") {
							setShowCursor(clip.showCursor);
						} else {
							setShowCursor(true);
						}
					}

					const video = videoPlaybackRef.current?.video;
					if (video) {
						video.currentTime = 0;
					}
				}
			} else {
				setActiveEffectSection((s) => (s === "clip" ? "scene" : s));
			}

			setTimeout(() => {
				isSwitchingClipRef.current = false;
			}, 60);
		},
		[clips, videoSourcePath],
	);

	const handleImportVideoClip = useCallback(async (filePathInput?: string, labelInput?: string) => {
		try {
			let filePath = filePathInput;
			if (!filePath) {
				const result = await window.electronAPI.showOpenDialog({
					title: "Import Video Clip",
					filters: [{ name: "Videos", extensions: ["mp4", "webm", "mov", "mkv"] }],
					properties: ["openFile"],
				});
				if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
					return;
				}
				filePath = result.filePaths[0];
			}
			const newVideoUrl = await resolveVideoUrl(filePath);
			const durationMs = await new Promise<number>((resolve) => {
				const video = document.createElement("video");
				video.onloadedmetadata = () => resolve(Math.round(video.duration * 1000) || 5000);
				video.onerror = () => resolve(5000);
				video.src = newVideoUrl;
			});

			const currentClips = clipsRef.current;
			const currentClipRegions = clipRegionsRef.current;

			if (currentClips.length === 0 && !videoPath) {
				const newClipId = deriveUniqueClipId(currentClips, currentClipRegions);
				const newClip = createUploadedClip({
					id: newClipId,
					videoPath: filePath,
					startMsOffset: 0,
					durationMs,
					label: labelInput || "Slide 1",
				});
				setVideoSourcePath(filePath);
				setVideoPath(newVideoUrl);
				setClips([newClip]);
				setSelectedClipId(newClipId);
				setWebcam((prev) => ({
					...prev,
					enabled: false,
					sourcePath: null,
				}));
				setResolvedWebcamVideoUrl(null);
				setShowCursor(false);
				setCursorTelemetry([]);
				setCursorTelemetrySourcePath(null);
				setClipRegions([
					{
						id: newClipId,
						startMs: 0,
						endMs: durationMs,
						speed: 1,
					},
				]);
				toast.success(`Slide added as ${labelInput || "Slide 1"}`);
			} else {
				const nextTakeNum = currentClips.length + 1;
				const newClipId = deriveUniqueClipId(currentClips, currentClipRegions);
				const startMsOffset = currentClips.reduce((acc, c) => acc + c.durationMs, 0);
				const newClip = createUploadedClip({
					id: newClipId,
					videoPath: filePath,
					startMsOffset,
					durationMs,
					label: labelInput || `Slide ${nextTakeNum}`,
				});
				const currentClipsEndTime = currentClipRegions.reduce((acc, c) => Math.max(acc, c.endMs), 0);
				const newClipRegion: ClipRegion = {
					id: newClipId,
					startMs: currentClipsEndTime,
					endMs: currentClipsEndTime + durationMs,
					speed: 1,
				};
				const updatedClips = [...currentClips, newClip];
				setClips(updatedClips);
				setClipRegions((prev) => [...prev, newClipRegion]);
				handleSelectClip(newClipId);
				toast.success(`Slide added as ${labelInput || `Slide ${nextTakeNum}`}`);
			}
			recordEditorHistorySnapshot(editorHistoryRef.current, buildHistorySnapshot());
			syncHistoryButtons();
		} catch (err) {
			console.error("Failed to import clip:", err);
			toast.error("Failed to import clip");
		}
	}, [deriveUniqueClipId, videoPath, handleSelectClip, buildHistorySnapshot, syncHistoryButtons]);

	const handleDuplicateSlide = useCallback(
		(slideId: string) => {
			const currentClips = clipsRef.current;
			const target = currentClips.find((c) => c.id === slideId);
			if (!target) return;
			const newClipId = deriveUniqueClipId(currentClips, clipRegionsRef.current);
			const duplicated: ClipEntry = {
				...target,
				id: newClipId,
				label: `${target.label || "Slide"} (Copy)`,
				layoutRegions: target.layoutRegions
					? JSON.parse(JSON.stringify(target.layoutRegions))
					: undefined,
				zoomRegions: target.zoomRegions
					? JSON.parse(JSON.stringify(target.zoomRegions))
					: undefined,
			};
			const targetIndex = currentClips.findIndex((c) => c.id === slideId);
			const nextClips = [...currentClips];
			nextClips.splice(targetIndex + 1, 0, duplicated);
			setClips(nextClips);

			// Also create matching ClipRegion for the duplicated slide
			setClipRegions((prev) => {
				const targetRegion = prev.find((r) => r.id === slideId);
				const currentClipsEndTime = prev.reduce((acc, c) => Math.max(acc, c.endMs), 0);
				const newRegion: ClipRegion = {
					id: newClipId,
					startMs: currentClipsEndTime,
					endMs: currentClipsEndTime + target.durationMs,
					speed: targetRegion?.speed ?? 1,
					muted: targetRegion?.muted,
					transitionIn: targetRegion?.transitionIn,
					transitionInDurationMs: targetRegion?.transitionInDurationMs,
				};
				return [...prev, newRegion];
			});

			handleSelectClip(newClipId);
			toast.success("Slide duplicated");
		},
		[deriveUniqueClipId, handleSelectClip],
	);

	const handleTransitionChange = useCallback(
		(slideId: string, transitionType: ClipTransitionType, durationMs: number) => {
			setClips((prev) =>
				prev.map((c) =>
					c.id === slideId
						? {
								...c,
								transitionIn: {
									type: transitionType,
									durationMs,
								},
							}
						: c,
				),
			);
			setClipRegions((prev) =>
				prev.map((r) =>
					r.id === slideId
						? {
								...r,
								transitionIn: transitionType,
								transitionInDurationMs: durationMs,
							}
						: r,
				),
			);
		},
		[],
	);

	const handleToggleSlideMode = useCallback(
		(slideId: string) => {
			setClips((prev) =>
				prev.map((c) =>
					c.id === slideId
						? {
								...c,
								slideMode: (c.slideMode === "video" ? "record" : "video") as "record" | "video",
							}
						: c,
				),
			);
			recordEditorHistorySnapshot(editorHistoryRef.current, buildHistorySnapshot());
			syncHistoryButtons();
		},
		[buildHistorySnapshot, syncHistoryButtons],
	);

	const handleDeleteClip = useCallback(
		(clipId: string) => {
			if (clips.length <= 1) return;
			const remaining = clips.filter((c) => c.id !== clipId);
			setClips(remaining);
			setClipRegions((prev) => prev.filter((c) => c.id !== clipId));
			if (selectedClipId === clipId) {
				if (remaining[0]) {
					handleSelectClip(remaining[0].id);
				} else {
					setSelectedClipId(null);
				}
			}
			recordEditorHistorySnapshot(editorHistoryRef.current, buildHistorySnapshot());
			syncHistoryButtons();
			toast.success("Take removed");
		},
		[clips, selectedClipId, handleSelectClip, buildHistorySnapshot, syncHistoryButtons],
	);

	const handleReorderClip = useCallback(
		(clipId: string, direction: "left" | "right") => {
			const updatedClips = reorderClips(clips, clipId, direction);
			if (updatedClips === clips) return;
			setClips(updatedClips);

			setClipRegions((prev) => buildSceneClipRegions(updatedClips, prev));

			recordEditorHistorySnapshot(editorHistoryRef.current, buildHistorySnapshot());
			syncHistoryButtons();
			toast.success("Takes reordered");
		},
		[clips, buildHistorySnapshot, syncHistoryButtons],
	);

	

	

	

	

	

	

	const saveProject = useCallback(
		async (forceSaveAs: boolean, options?: SaveProjectOptions) => {
			clearPendingProjectAutosave();
			return queueProjectSave(async () => {
				if (!currentSourcePath) {
					if (!options?.silent) {
						toast.error("No video loaded");
					}
					return false;
				}

				const shouldCaptureThumbnail = options?.captureThumbnail ?? true;
				const shouldRefreshLibrary = options?.refreshLibraryAfterSave ?? true;
				const shouldRemountPreview = options?.remountPreviewAfterSave ?? true;

				try {
					const projectData =
						currentProjectSnapshot?.videoPath === currentSourcePath && !forceSaveAs
							? currentProjectSnapshot
							: createProjectData(
									currentSourcePath,
									currentPersistedEditorState,
									forceSaveAs ? null : (lastSavedSnapshot?.projectId ?? null),
									clips,
								);

					const fileNameBase =
						currentSourcePath
							.split(/[\\/]/)
							.pop()
							?.replace(/\.[^.]+$/, "") || `project-${Date.now()}`;
					let targetProjectPath = forceSaveAs
						? undefined
						: (currentProjectPath ?? undefined);

					if (!forceSaveAs && !targetProjectPath) {
						const activeProjectResult =
							await window.electronAPI.loadCurrentProjectFile();
						if (activeProjectResult.success && activeProjectResult.path) {
							targetProjectPath = activeProjectResult.path;
							setCurrentProjectPath(activeProjectResult.path);
						}
					}

					const thumbnailDataUrl = shouldCaptureThumbnail
						? await captureProjectThumbnail()
						: undefined;

					const result = await window.electronAPI.saveProjectFile(
						projectData,
						fileNameBase,
						targetProjectPath,
						thumbnailDataUrl,
					);

					if (result.canceled) {
						if (!options?.silent) {
							toast.info("Project save canceled");
						}
						return false;
					}

					if (!result.success) {
						if (!options?.silent) {
							toast.error(result.message || "Failed to save project");
						}
						return false;
					}

					if (result.path) {
						setCurrentProjectPath(result.path);
					}
					setLastSavedSnapshot(
						cloneStructured(
							createProjectData(
								projectData.videoPath,
								projectData.editor,
								result.projectId ?? projectData.projectId ?? null,
								projectData.clips,
							),
						),
					);
					if (shouldRefreshLibrary) {
						await refreshProjectLibrary();
					}

					if (!options?.silent) {
						toast.success(`Project saved to ${result.path}`);
					}
					return true;
				} finally {
					if (shouldRemountPreview) {
						remountPreview();
					}
				}
			});
		},
		[
			captureProjectThumbnail,
			clearPendingProjectAutosave,
			currentSourcePath,
			currentProjectPath,
			currentProjectSnapshot,
			currentPersistedEditorState,
			lastSavedSnapshot?.projectId,
			queueProjectSave,
			refreshProjectLibrary,
			remountPreview,
		],
	);

	useEffect(() => {
		window.electronAPI.setHasUnsavedChanges(hasUnsavedChanges);
	}, [hasUnsavedChanges]);

	useEffect(() => {
		const cleanup = window.electronAPI.onRequestSaveBeforeClose(async () => {
			return saveProject(false);
		});

		return () => cleanup?.();
	}, [saveProject]);

	const handleSaveProject = useCallback(async () => {
		await saveProject(false);
	}, [saveProject]);

	const handleSaveProjectAs = useCallback(async () => {
		const saved = await saveProject(true);
		if (saved) {
			setProjectBrowserOpen(false);
		}
	}, [saveProject]);

	useEffect(() => {
		if (!currentProjectPath || !hasUnsavedChanges) {
			clearPendingProjectAutosave();
			return;
		}

		projectAutosaveTimeoutRef.current = window.setTimeout(() => {
			projectAutosaveTimeoutRef.current = null;
			void saveProject(false, {
				silent: true,
				remountPreviewAfterSave: false,
				refreshLibraryAfterSave: false,
				captureThumbnail: false,
			});
		}, PROJECT_AUTOSAVE_DELAY_MS);

		return () => {
			clearPendingProjectAutosave();
		};
	}, [clearPendingProjectAutosave, currentProjectPath, hasUnsavedChanges, saveProject]);

	/**
	 * Saves the current project directly into the projects library under a chosen name.
	 */
	const saveProjectWithName = useCallback(
		async (projectName: string) => {
			const trimmedProjectName = projectName.trim();
			if (!trimmedProjectName) {
				toast.error("Project name is required");
				return false;
			}

			if (!currentSourcePath) {
				toast.error("No video loaded");
				return false;
			}

			try {
				const projectData =
					currentProjectSnapshot?.videoPath === currentSourcePath
						? currentProjectSnapshot
						: createProjectData(
								currentSourcePath,
								currentPersistedEditorState,
								lastSavedSnapshot?.projectId ?? null,
								clips,
							);
				const thumbnailDataUrl = await captureProjectThumbnail();
				const result = await window.electronAPI.saveProjectFileNamed(
					projectData,
					trimmedProjectName,
					thumbnailDataUrl,
				);

				if (result.canceled) {
					toast.info("Project save canceled");
					return false;
				}

				if (!result.success) {
					toast.error(result.message || "Failed to save project");
					return false;
				}

				if (result.path) {
					setCurrentProjectPath(result.path);
				}
				setLastSavedSnapshot(
					cloneStructured(
						createProjectData(
							projectData.videoPath,
							projectData.editor,
							result.projectId ?? projectData.projectId ?? null,
							projectData.clips,
						),
					),
				);
				await refreshProjectLibrary();
				toast.success(result.path ? `Project saved to ${result.path}` : "Project saved");
				return true;
			} finally {
				remountPreview();
			}
		},
		[
			captureProjectThumbnail,
			currentPersistedEditorState,
			currentProjectSnapshot,
			currentSourcePath,
			lastSavedSnapshot?.projectId,
			refreshProjectLibrary,
			remountPreview,
		],
	);

	/**
	 * Resets the inline project-name editor back to the current saved display name.
	 */
	const closeProjectNameEditor = useCallback(() => {
		setProjectNameDraft(projectDisplayName);
		setIsEditingProjectName(false);
	}, [projectDisplayName]);

	/**
	 * Commits the inline project-name editor and persists the project under that name.
	 */
	const handleProjectNameSubmit = useCallback(
		async (event?: React.FormEvent<HTMLFormElement>) => {
			event?.preventDefault();
			const trimmedProjectName = projectNameDraft.trim();
			if (!trimmedProjectName) {
				closeProjectNameEditor();
				return;
			}

			setIsSavingProjectName(true);
			let saved = false;
			try {
				saved = await saveProjectWithName(trimmedProjectName);
			} catch (error) {
				toast.error(getErrorMessage(error));
			} finally {
				setIsSavingProjectName(false);
			}

			if (saved) {
				setIsEditingProjectName(false);
				return;
			}

			projectNameInputRef.current?.focus();
			projectNameInputRef.current?.select();
		},
		[closeProjectNameEditor, projectNameDraft, saveProjectWithName],
	);

	const handleOpenProjectFromLibrary = useCallback(
		async (projectPath: string) => {
			if (hasUnsavedChanges) {
				if (currentProjectPath) {
					await saveProject(false, { silent: true });
				} else {
					const confirmSave = window.confirm(
						"You have unsaved changes in the current project. Would you like to save them first?",
					);
					if (confirmSave) {
						const saved = await saveProject(false);
						if (!saved) return;
					}
				}
			}

			const result = await window.electronAPI.openProjectFileAtPath(projectPath);

			if (result.canceled) {
				return;
			}

			if (!result.success) {
				toast.error(result.message || "Failed to load project");
				return;
			}

			const restored = await applyLoadedProject(result.project, result.path ?? null);
			if (!restored) {
				toast.error("Invalid project file format");
				return;
			}

			setViewMode("editor");
			setProjectBrowserOpen(false);
			await refreshProjectLibrary();
			toast.success(result.path ? `Project loaded from ${result.path}` : "Project loaded");
		},
		[applyLoadedProject, currentProjectPath, hasUnsavedChanges, refreshProjectLibrary, saveProject],
	);

	const handleLoadProjectFile = useCallback(async () => {
		if (hasUnsavedChanges) {
			if (currentProjectPath) {
				await saveProject(false, { silent: true });
			} else {
				const confirmSave = window.confirm(
					"You have unsaved changes in the current project. Would you like to save them first?",
				);
				if (confirmSave) {
					const saved = await saveProject(false);
					if (!saved) return;
				}
			}
		}

		if (!window.electronAPI?.loadProjectFile) {
			toast.error("Project file loading is not supported on this platform.");
			return;
		}

		const result = await window.electronAPI.loadProjectFile();
		if (result?.canceled) {
			return;
		}

		if (!result?.success || !result.project) {
			if (result?.message) {
				toast.error(result.message);
			}
			return;
		}

		const restored = await applyLoadedProject(result.project, result.path ?? null);
		if (!restored) {
			toast.error("Invalid project file format");
			return;
		}

		setViewMode("editor");
		await refreshProjectLibrary();
		toast.success(result.path ? `Project loaded from ${result.path}` : "Project loaded");
	}, [applyLoadedProject, currentProjectPath, hasUnsavedChanges, refreshProjectLibrary, saveProject]);

	const handleNewProject = useCallback(
		async (chosenAspectRatio?: AspectRatio | string) => {
			if (hasUnsavedChanges) {
				if (currentProjectPath) {
					await saveProject(false, { silent: true });
				} else {
					const confirmSave = window.confirm(
						"You have unsaved changes in the current project. Would you like to save them first?",
					);
					if (confirmSave) {
						const saved = await saveProject(false);
						if (!saved) return;
					}
				}
			}

			const targetRatio: AspectRatio =
				chosenAspectRatio === "9:16" ||
				chosenAspectRatio === "1:1" ||
				chosenAspectRatio === "4:5" ||
				chosenAspectRatio === "21:9"
					? (chosenAspectRatio as AspectRatio)
					: "16:9";

			await window.electronAPI.clearCurrentVideoPath?.();
			setClips([]);
			setClipRegions([]);
			setSelectedClipId(null);
			setVideoSourcePath(null);
			setVideoPath(null);
			setCurrentProjectPath(null);
			setLastSavedSnapshot(null);
			setAspectRatio(targetRatio);
			setProjectNameDraft("Untitled Project");
			setIsEditingProjectName(false);
			setViewMode("editor");
			toast.info("Created new project");
		},
		[currentProjectPath, hasUnsavedChanges, saveProject],
	);

	const handleNavigateToWelcome = useCallback(async () => {
		if (hasUnsavedChanges) {
			if (currentProjectPath) {
				await saveProject(false, { silent: true });
			} else {
				const confirmSave = window.confirm(
					"You have unsaved changes in the current project. Would you like to save them first?",
				);
				if (confirmSave) {
					const saved = await saveProject(false);
					if (!saved) return;
				}
			}
		}
		await window.electronAPI.clearCurrentVideoPath?.();
		await refreshProjectLibrary();
		setViewMode("welcome");
	}, [currentProjectPath, hasUnsavedChanges, refreshProjectLibrary, saveProject]);

	const handleOpenSettings = useCallback((tab = "general") => {
		setSettingsDefaultTab(tab);
		setIsSettingsOpen(true);
	}, []);

	const handleOpenProjectBrowser = useCallback(async () => {
		if (projectBrowserOpen) {
			setProjectBrowserOpen(false);
			return;
		}

		await refreshProjectLibrary();
		setProjectBrowserOpen(true);
	}, [projectBrowserOpen, refreshProjectLibrary]);

	useEffect(() => {
		const removeLoadListener = window.electronAPI.onMenuLoadProject(() => {
			void handleOpenProjectBrowser();
		});
		const removeSaveListener = window.electronAPI.onMenuSaveProject(handleSaveProject);
		const removeSaveAsListener = window.electronAPI.onMenuSaveProjectAs(handleSaveProjectAs);

		return () => {
			removeLoadListener?.();
			removeSaveListener?.();
			removeSaveAsListener?.();
		};
	}, [handleOpenProjectBrowser, handleSaveProject, handleSaveProjectAs]);

	useEffect(() => {
		let mounted = true;
		let retryAttempts = 0;

		async function loadCursorTelemetry() {
			if (!videoPath || !videoSourcePath) {
				if (mounted) {
					setCursorTelemetry([]);
					setCursorTelemetrySourcePath(null);
				}
				return;
			}

			try {
				const result = await window.electronAPI.getCursorTelemetry(videoSourcePath);
				if (mounted) {
					const samples = result.success ? result.samples : [];
					setCursorTelemetry(samples);
					setCursorTelemetrySourcePath(videoSourcePath);

					const shouldRetryFreshRecordingTelemetry =
						pendingFreshRecordingAutoZoomPathRef.current === videoPath &&
						autoSuggestedVideoPathRef.current !== videoPath &&
						retryAttempts < 12;

					if (shouldRetryFreshRecordingTelemetry) {
						retryAttempts += 1;
						pendingTelemetryRetryTimeoutRef.current = window.setTimeout(() => {
							pendingTelemetryRetryTimeoutRef.current = null;
							if (mounted) {
								void loadCursorTelemetry();
							}
						}, 350);
					}
				}
			} catch (telemetryError) {
				console.warn("Unable to load cursor telemetry:", telemetryError);
				if (mounted) {
					setCursorTelemetry([]);
					setCursorTelemetrySourcePath(videoSourcePath);
					if (
						pendingFreshRecordingAutoZoomPathRef.current === videoPath &&
						autoSuggestedVideoPathRef.current !== videoPath &&
						retryAttempts < 12
					) {
						retryAttempts += 1;
						pendingTelemetryRetryTimeoutRef.current = window.setTimeout(() => {
							pendingTelemetryRetryTimeoutRef.current = null;
							if (mounted) {
								void loadCursorTelemetry();
							}
						}, 350);
					}
				}
			}
		}

		if (pendingTelemetryRetryTimeoutRef.current !== null) {
			window.clearTimeout(pendingTelemetryRetryTimeoutRef.current);
			pendingTelemetryRetryTimeoutRef.current = null;
		}

		loadCursorTelemetry();

		return () => {
			mounted = false;
			if (pendingTelemetryRetryTimeoutRef.current !== null) {
				window.clearTimeout(pendingTelemetryRetryTimeoutRef.current);
				pendingTelemetryRetryTimeoutRef.current = null;
			}
		};
	}, [videoPath, videoSourcePath]);

	const normalizedCursorTelemetry = useMemo(() => {
		if (cursorTelemetry.length === 0) {
			return [] as CursorTelemetryPoint[];
		}

		const totalMs = Math.max(0, Math.round(duration * 1000));
		return normalizeCursorTelemetry(
			cursorTelemetry,
			totalMs > 0 ? totalMs : Number.MAX_SAFE_INTEGER,
		);
	}, [cursorTelemetry, duration]);

	const displayedTimelineWindow = useMemo(() => {
		const totalMs = Math.max(0, Math.round(duration * 1000));
		return getDisplayedTimelineWindowMs(totalMs, trimRegions);
	}, [duration, trimRegions]);

	const effectiveCursorTelemetry = useMemo(() => {
		if (!loopCursor) {
			return normalizedCursorTelemetry;
		}

		if (
			normalizedCursorTelemetry.length < 2 ||
			displayedTimelineWindow.endMs <= displayedTimelineWindow.startMs
		) {
			return normalizedCursorTelemetry;
		}

		return buildLoopedCursorTelemetry(
			normalizedCursorTelemetry,
			displayedTimelineWindow.endMs,
			displayedTimelineWindow.startMs,
		);
	}, [loopCursor, normalizedCursorTelemetry, displayedTimelineWindow]);

	// Initialize a full-track clip when duration is first known
	const clipInitializedRef = useRef(false);
	const autoFullTrackClipIdRef = useRef<string | null>(null);
	const autoFullTrackClipEndMsRef = useRef<number | null>(null);
	useEffect(() => {
		const totalMs = Math.round(duration * 1000);
		if (totalMs <= 0) return;
		if (!clipInitializedRef.current) {
			if (clipRegions.length === 0) {
				const nextClipRegions =
					trimRegions.length > 0
						? trimsToClips(trimRegions, totalMs)
						: (() => {
								const id = `clip-${nextClipIdRef.current++}`;
								autoFullTrackClipIdRef.current = id;
								autoFullTrackClipEndMsRef.current = totalMs;
								return [{ id, startMs: 0, endMs: totalMs, speed: 1 }];
							})();

				if (trimRegions.length > 0) {
					nextClipIdRef.current = deriveNextId(
						"clip",
						nextClipRegions.map((region) => region.id),
					);
				}

				setClipRegions(nextClipRegions);
				if (speedRegions.length > 0) {
					// Legacy speed regions no longer have dedicated editing surfaces.
					// Clear them during clip bootstrap so old projects do not keep
					// hidden playback changes that users cannot inspect or edit.
					setSpeedRegions([]);
				}
			}
			clipInitializedRef.current = true;
			return;
		}

		const extendedClipRegions = extendAutoFullTrackClip(
			clipRegions,
			autoFullTrackClipIdRef.current,
			autoFullTrackClipEndMsRef.current,
			totalMs,
		);
		if (!extendedClipRegions) return;

		autoFullTrackClipEndMsRef.current = totalMs;
		setClipRegions(extendedClipRegions);
	}, [duration, clipRegions, trimRegions, speedRegions]);

	// Derive trimRegions from clipRegions so export/playback pipelines stay unchanged
	useEffect(() => {
		const totalMs = Math.round(duration * 1000);
		if (totalMs <= 0 || clipRegions.length === 0) return;
		setTrimRegions(clipsToTrims(clipRegions, totalMs));
	}, [clipRegions, duration]);

	const mapTimelineTimeToSourceTime = useCallback(
		(timeMs: number) => resolveTimelineTimeToSourceTime(timeMs, clipRegions),
		[clipRegions],
	);

	const mapSourceTimeToTimelineTime = useCallback(
		(timeMs: number) => resolveSourceTimeToTimelineTime(timeMs, clipRegions),
		[clipRegions],
	);

	const effectiveZoomRegions = useMemo<ZoomRegion[]>(
		() =>
			zoomRegions.map((region) => ({
				...region,
				startMs: mapTimelineTimeToSourceTime(region.startMs),
				endMs: mapTimelineTimeToSourceTime(region.endMs),
			})),
		[zoomRegions, mapTimelineTimeToSourceTime],
	);

	const timelinePlayheadTime = useMemo(() => {
		if (clips.length > 1 && selectedClipId) {
			const currentClip = clips.find((c) => c.id === selectedClipId);
			if (currentClip) {
				return (currentClip.startMsOffset + currentTime * 1000) / 1000;
			}
		}
		return mapSourceTimeToTimelineTime(currentTime * 1000) / 1000;
	}, [clips, selectedClipId, currentTime, mapSourceTimeToTimelineTime]);

	const timelineDuration = useMemo(() => {
		if (clips.length > 0) {
			const totalClipsMs = clips.reduce((acc, c) => acc + c.durationMs, 0);
			return Math.max(totalClipsMs, getTimelineDurationMs(clipRegions, duration * 1000)) / 1000;
		}
		return getTimelineDurationMs(clipRegions, duration * 1000) / 1000;
	}, [clips, clipRegions, duration]);

	const slideDurationSec = useMemo(() => {
		if (activeSlide && activeSlide.durationMs > 0) {
			return activeSlide.durationMs / 1000;
		}
		return Math.max(1, duration);
	}, [activeSlide, duration]);

	const slideLocalClipRegions = useMemo<ClipRegion[]>(() => {
		const durMs = activeSlide ? activeSlide.durationMs : Math.round(duration * 1000);
		const id = activeSlide ? activeSlide.id : "slide-1";
		return [
			{
				id,
				startMs: 0,
				endMs: Math.max(100, durMs),
				speed: activeSlide?.speed ?? 1,
				showSourceAudio: true,
				transitionIn: activeSlide?.transitionIn?.type ?? "none",
				transitionInDurationMs: activeSlide?.transitionIn?.durationMs ?? 400,
			},
		];
	}, [activeSlide, duration]);

	// Merge clip speeds into speed regions so playback + export respect per-clip speed
	const effectiveSpeedRegions = useMemo<SpeedRegion[]>(() => {
		const clipDerived: SpeedRegion[] = clipRegions
			.filter((clip) => clip.speed !== 1)
			.map((clip) => ({
				id: `clip-speed-${clip.id}`,
				startMs: clip.startMs,
				endMs: getClipSourceEndMs(clip),
				speed: clip.speed as SpeedRegion["speed"],
			}));
		if (clipDerived.length === 0) return speedRegions;
		const result = [...speedRegions];
		for (const cs of clipDerived) {
			const overlaps = speedRegions.some(
				(sr) => sr.endMs > cs.startMs && sr.startMs < cs.endMs,
			);
			if (!overlaps) {
				result.push(cs);
			}
		}
		return result;
	}, [clipRegions, speedRegions]);
	const audio = useVideoEditorAudio({
		currentSourcePath,
		selectedClipId,
		clipRegions,
		audioRegions,
		effectiveSpeedRegions,
		sourceAudioTrackSettingsByClip,
		setSourceAudioTrackSettingsByClip,
		defaultSourceAudioTrackSettings,
		setDefaultSourceAudioTrackSettings,
		currentTime,
		timelineTime: timelinePlayheadTime,
		duration,
		isPlaying,
		previewVolume,
		audioReloadTrigger: previewVersion,
		summarizeErrorMessage,
		onSourceFallbackLoadError: (error) => {
			toast.warning(
				`Could not load companion audio source: ${summarizeErrorMessage(getErrorMessage(error))}`,
				{ duration: 10000 },
			);
		},
	});

	function togglePlayPause() {
		const playback = videoPlaybackRef.current;
		const video = playback?.video;
		if (!playback || !video) return;

		if (!video.paused && !video.ended) {
			playback.pause();
		} else {
			playback.play().catch((err) => console.error("Video play failed:", err));
		}
	}

	const handleAutoSuggestZoomsConsumed = useCallback(() => {
		setAutoSuggestZoomsTrigger(0);
	}, []);

	const handleSeek = useCallback(
		(time: number, options: { pause?: boolean } = {}) => {
			const playback = videoPlaybackRef.current;
			const video = playback?.video;
			if (!video) return;

			if (options.pause && !video.paused) {
				playback?.pause();
			}

			if (clips.length > 1) {
				const timeMs = Math.round(time * 1000);
				const hit = findClipAtTimelineTime(clips, timeMs);
				if (hit) {
					if (hit.clip.id !== selectedClipId) {
						handleSelectClip(hit.clip.id);
					}
					const localTimeSec = hit.localTimeMs / 1000;
					if (Math.abs(video.currentTime - localTimeSec) > 0.05) {
						video.currentTime = localTimeSec;
					}
					return;
				}
			}

			video.currentTime = mapTimelineTimeToSourceTime(time * 1000) / 1000;
		},
		[clips, selectedClipId, handleSelectClip, mapTimelineTimeToSourceTime],
	);

	const handleTimelineSeek = useCallback(
		(time: number) => {
			const playback = videoPlaybackRef.current;
			const video = playback?.video;
			if (!video) return;
			if (!video.paused) {
				playback?.pause();
			}
			const maxDuration =
				activeSlide && activeSlide.durationMs > 0
					? activeSlide.durationMs / 1000
					: duration;
			const targetTime = Math.max(0, Math.min(time, maxDuration));
			video.currentTime = targetTime;
			setCurrentTime(targetTime);
		},
		[activeSlide, duration],
	);

	// Auto-advance across clips during playback
	useEffect(() => {
		if (!isPlaying || clips.length <= 1 || !selectedClipId) return;

		const currentClipIndex = clips.findIndex((c) => c.id === selectedClipId);
		if (currentClipIndex < 0) return;
		const currentClip = clips[currentClipIndex];
		const clipDurationSec = currentClip.durationMs / 1000;

		if (currentTime >= clipDurationSec - 0.05 && currentClipIndex < clips.length - 1) {
			const nextClip = clips[currentClipIndex + 1];
			handleSelectClip(nextClip.id);
			setTimeout(() => {
				videoPlaybackRef.current?.play().catch(() => undefined);
			}, 100);
		}
	}, [isPlaying, clips, selectedClipId, currentTime, handleSelectClip]);

	const handleAnalyzeSilence = useCallback(
		async (minDuration = silenceMinDurationMs, threshold = silenceThresholdDb) => {
			const targetSourcePath = videoSourcePath || videoPath;
			if (!targetSourcePath) {
				toast.error(t("editor.silence.noVideo", "No video loaded to analyze silence"));
				return;
			}

			setIsAnalyzingSilence(true);
			try {
				const mediaUrl =
					videoPath?.startsWith("http") ||
					videoPath?.startsWith("blob:") ||
					videoPath?.startsWith("file:")
						? videoPath
						: await resolveVideoUrl(targetSourcePath);

				const result = await detectSilenceFromAudioUrl(mediaUrl, {
					minDurationMs: minDuration,
					thresholdDb: threshold,
					speechPaddingMs: 150,
					windowMs: 50,
				});

				setDetectedSilences(result.silences);
				setSilenceTotalSavedMs(result.totalSavedMs);
				setSilenceModalOpen(true);

				if (result.silences.length === 0) {
					toast.info(
						t(
							"editor.silence.noneFound",
							"No dead-air pauses detected. Audio is already dense.",
						),
					);
				}
			} catch (err) {
				console.error("[SilenceDetector] Failed to analyze audio:", err);
				toast.error(t("editor.silence.error", "Failed to analyze audio for silences"));
			} finally {
				setIsAnalyzingSilence(false);
			}
		},
		[videoPath, videoSourcePath, silenceMinDurationMs, silenceThresholdDb, t],
	);

	const handleApplySilenceRemoval = useCallback(() => {
		if (detectedSilences.length === 0) {
			setSilenceModalOpen(false);
			return;
		}

		const totalDurationMs = Math.round(timelineDuration * 1000);
		recordEditorHistorySnapshot(editorHistoryRef.current, buildHistorySnapshot());

		const result = applySilenceRemovalToTimeline({
			silences: detectedSilences,
			clipRegions,
			zoomRegions,
			annotationRegions,
			layoutRegions,
			audioRegions,
			totalDurationMs,
		});

		setClipRegions(result.clipRegions);
		setZoomRegions(result.zoomRegions);
		setAnnotationRegions(result.annotationRegions);
		setLayoutRegions(result.layoutRegions);
		setAudioRegions(result.audioRegions);

		setSilenceModalOpen(false);
		handleSeek(0);
		syncHistoryButtons();

		const savedSec = (silenceTotalSavedMs / 1000).toFixed(1);
		toast.success(
			t(
				"editor.silence.appliedSuccess",
				`Cut ${detectedSilences.length} pauses (${savedSec}s saved). Timeline ripple compressed.`,
				{ count: detectedSilences.length, savedSec },
			),
		);
	}, [
		detectedSilences,
		timelineDuration,
		buildHistorySnapshot,
		clipRegions,
		zoomRegions,
		annotationRegions,
		layoutRegions,
		audioRegions,
		handleSeek,
		syncHistoryButtons,
		silenceTotalSavedMs,
		t,
	]);

	const handleSelectZoom = useCallback((id: string | null) => {
		setSelectedZoomId(id);
		if (id) {
			setActiveEffectSection("zoom");
			setSelectedAnnotationId(null);
			setSelectedAudioId(null);
			setSelectedLayoutId(null);
		} else {
			setActiveEffectSection((s) => (s === "zoom" ? "scene" : s));
		}
	}, []);

	const handleSelectAnnotation = useCallback((id: string | null) => {
		setSelectedAnnotationId(id);
		if (id) {
			setSelectedZoomId(null);
			setSelectedLayoutId(null);
			setSelectedAudioId(null);
		}
	}, []);

	const handleZoomAdded = useCallback(
		(span: Span) => {
			const id = `zoom-${nextZoomIdRef.current++}`;
			const defaultDepth: ZoomDepth = 2;
			const newRegion: ZoomRegion = {
				id,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
				depth: defaultDepth,
				focus: clampFocusToDepth({ cx: 0.5, cy: 0.5 }, defaultDepth),
				mode: "auto",
			};
			if (videoPath && pendingFreshRecordingAutoZoomPathRef.current === videoPath) {
				autoSuggestedVideoPathRef.current = videoPath;
				pendingFreshRecordingAutoZoomPathRef.current = null;
			}
			setZoomRegions((prev) => [...prev, newRegion]);
			setSelectedZoomId(id);
			setSelectedAnnotationId(null);
			extensionHost.emitEvent({
				type: "timeline:region-added",
				data: { id, startMs: newRegion.startMs, endMs: newRegion.endMs },
			});
		},
		[videoPath],
	);

	const handleZoomSuggested = useCallback(
		(span: Span, focus: ZoomFocus, depth?: ZoomDepth) => {
			const id = `zoom-${nextZoomIdRef.current++}`;
			const targetDepth = depth ?? DEFAULT_AUTO_ZOOM_DEPTH;
			const newRegion: ZoomRegion = {
				id,
				startMs: Math.round(span.start),
				endMs: Math.round(span.end),
				depth: targetDepth,
				focus: clampFocusToDepth(focus, targetDepth),
				mode: "auto",
			};
			if (videoPath && pendingFreshRecordingAutoZoomPathRef.current === videoPath) {
				autoSuggestedVideoPathRef.current = videoPath;
				pendingFreshRecordingAutoZoomPathRef.current = null;
			}
			setZoomRegions((prev) => [...prev, newRegion]);
			// Don't auto-select suggested zooms — they follow cursor and don't need user interaction
			extensionHost.emitEvent({
				type: "timeline:region-added",
				data: { id, startMs: newRegion.startMs, endMs: newRegion.endMs },
			});
		},
		[videoPath],
	);

	const handleAutoReframe = useCallback(() => {
		if (!normalizedCursorTelemetry.length || duration <= 0) return;
		const videoWidth = videoPlaybackRef.current?.video?.videoWidth ?? 1920;
		const videoHeight = videoPlaybackRef.current?.video?.videoHeight ?? 1080;
		const sourceAspectRatio = videoHeight > 0 ? videoWidth / videoHeight : 16 / 9;
		const result = buildAutoReframeSuggestions({
			cursorTelemetry: normalizedCursorTelemetry,
			totalMs: duration * 1000,
			targetAspectRatio: aspectRatio,
			sourceAspectRatio,
			reservedSpans: zoomRegions.map((r) => ({ start: r.startMs, end: r.endMs })),
		});
		if (result.status !== "ok" || result.suggestions.length === 0) {
			toast.error("No auto-reframe suggestions found for this video.");
			return;
		}
		for (const s of result.suggestions) {
			handleZoomSuggested({ start: s.start, end: s.end }, s.focus, s.depth);
		}
		toast.success(`Auto-reframed ${result.suggestions.length} scene(s) for ${aspectRatio}`);
	}, [normalizedCursorTelemetry, duration, aspectRatio, zoomRegions, handleZoomSuggested]);

	useEffect(() => {
		if (
			!videoPath ||
			loading ||
			!isPreviewReady ||
			duration <= 0 ||
			zoomRegions.length > 0 ||
			normalizedCursorTelemetry.length < 2
		) {
			if (pendingFreshRecordingAutoSuggestTimeoutRef.current !== null) {
				window.clearTimeout(pendingFreshRecordingAutoSuggestTimeoutRef.current);
				pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
			}
			return;
		}

		if (pendingFreshRecordingAutoZoomPathRef.current !== videoPath) {
			return;
		}

		if (autoSuggestedVideoPathRef.current === videoPath) {
			pendingFreshRecordingAutoZoomPathRef.current = null;
			return;
		}

		const telemetryPointCount = cursorTelemetry.length;
		if (pendingFreshRecordingAutoSuggestTelemetryCountRef.current === telemetryPointCount) {
			return;
		}

		pendingFreshRecordingAutoSuggestTelemetryCountRef.current = telemetryPointCount;

		if (pendingFreshRecordingAutoSuggestTimeoutRef.current !== null) {
			window.clearTimeout(pendingFreshRecordingAutoSuggestTimeoutRef.current);
			pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
		}

		pendingFreshRecordingAutoSuggestTimeoutRef.current = window.setTimeout(() => {
			pendingFreshRecordingAutoSuggestTimeoutRef.current = null;
			if (
				pendingFreshRecordingAutoZoomPathRef.current !== videoPath ||
				autoSuggestedVideoPathRef.current === videoPath ||
				zoomRegions.length > 0
			) {
				return;
			}

			setAutoSuggestZoomsTrigger((value) => value + 1);
		}, 500);
	}, [
		videoPath,
		loading,
		isPreviewReady,
		duration,
		cursorTelemetry.length,
		normalizedCursorTelemetry,
		zoomRegions,
	]);

	const handleZoomSpanChange = useCallback((id: string, span: Span) => {
		setZoomRegions((prev) =>
			prev.map((region) =>
				region.id === id
					? {
							...region,
							startMs: Math.round(span.start),
							endMs: Math.round(span.end),
						}
					: region,
			),
		);
	}, []);

	const handleZoomFocusChange = useCallback((id: string, focus: ZoomFocus) => {
		setZoomRegions((prev) =>
			prev.map((region) =>
				region.id === id
					? {
							...region,
							focus: clampFocusToDepth(focus, region.depth),
						}
					: region,
			),
		);
	}, []);

	const handleZoomDepthChange = useCallback(
		(depth: ZoomDepth) => {
			if (!selectedZoomId) return;
			setZoomRegions((prev) =>
				prev.map((region) =>
					region.id === selectedZoomId
						? {
								...region,
								depth,
								focus: clampFocusToDepth(region.focus, depth),
							}
						: region,
				),
			);
		},
		[selectedZoomId],
	);

	const handleZoomModeChange = useCallback(
		(mode: ZoomMode) => {
			if (!selectedZoomId) return;
			setZoomRegions((prev) =>
				prev.map((region) => (region.id === selectedZoomId ? { ...region, mode } : region)),
			);
		},
		[selectedZoomId],
	);

	const handleZoomDelete = useCallback(
		(id: string) => {
			setZoomRegions((prev) => prev.filter((region) => region.id !== id));
			if (selectedZoomId === id) {
				setSelectedZoomId(null);
			}
			extensionHost.emitEvent({ type: "timeline:region-removed", data: { id } });
		},
		[selectedZoomId],
	);


	// Sync active clip properties when changed
	useEffect(() => {
		if (!selectedClipId || isSwitchingClipRef.current) return;
		setClips((prev) =>
			prev.map((c) =>
				c.id === selectedClipId
					? {
							...c,
							wallpaper,
							cropRegion,
							layoutRegions,
							webcam,
							webcamPath: webcam.sourcePath ?? c.webcamPath ?? null,
							zoomRegions,
						}
					: c,
			),
		);
	}, [selectedClipId, wallpaper, cropRegion, layoutRegions, webcam, zoomRegions]);

	const handleSelectLayout = useCallback((id: string | null) => {
		setSelectedLayoutId(id);
		if (id) {
			setActiveEffectSection("layout");
			setSelectedZoomId(null);
			setSelectedClipId(null);
			setSelectedAnnotationId(null);
			setSelectedAudioId(null);
		} else {
			setActiveEffectSection((s) => (s === "layout" ? "scene" : s));
		}
	}, []);

	const handleClipSplit = useCallback(
		(splitMs: number) => {
			setClipRegions((prev) => {
				const target = prev.find((c) => splitMs > c.startMs && splitMs < c.endMs);
				if (!target) return prev;
				const leftId = `clip-${nextClipIdRef.current++}`;
				const rightId = `clip-${nextClipIdRef.current++}`;
				const left: ClipRegion = {
					id: leftId,
					startMs: target.startMs,
					endMs: Math.round(splitMs),
					speed: target.speed,
					muted: target.muted,
				};
				const right: ClipRegion = {
					id: rightId,
					startMs: Math.round(splitMs),
					endMs: target.endMs,
					speed: target.speed,
					muted: target.muted,
				};
				if (selectedClipId === target.id) {
					setSelectedClipId(leftId);
				}
				toast.success(t("editor.clip.splitSuccess", "Clip split at playhead"));
				return prev.flatMap((c) => (c.id === target.id ? [left, right] : [c]));
			});
		},
		[selectedClipId, t],
	);

	const handleSplitSlide = useCallback(
		(slideId: string) => {
			if (selectedClipId !== slideId) {
				handleSelectClip(slideId);
			}
			handleClipSplit(currentTime * 1000);
		},
		[selectedClipId, currentTime, handleSelectClip, handleClipSplit],
	);

	const handleClipSpanChange = useCallback(
		(id: string, span: Span) => {
			const oldClip = clipRegions.find((c) => c.id === id);
			const newStart = Math.round(span.start);
			const newEnd = Math.round(span.end);
			const removedSegments = oldClip
				? [
						...(newStart > oldClip.startMs
							? [{ startMs: oldClip.startMs, endMs: newStart }]
							: []),
						...(newEnd < oldClip.endMs
							? [{ startMs: newEnd, endMs: oldClip.endMs }]
							: []),
					]
				: [];

			if (oldClip) {
				const startDelta = newStart - oldClip.startMs;
				const endDelta = newEnd - oldClip.endMs;
				const isMove = Math.abs(startDelta - endDelta) < 1 && Math.abs(startDelta) > 0;

				if (isMove) {
					const delta = startDelta;
					setZoomRegions((prev) =>
						prev.map((zoom) => {
							const overlaps =
								zoom.startMs < oldClip.endMs && zoom.endMs > oldClip.startMs;
							if (overlaps) {
								return {
									...zoom,
									startMs: zoom.startMs + delta,
									endMs: zoom.endMs + delta,
								};
							}
							return zoom;
						}),
					);
				}
			}

			if (removedSegments.length > 0) {
				const removeTrimmedRegions = <T extends { startMs: number; endMs: number }>(
					regions: T[],
				): T[] =>
					regions.filter(
						(region) =>
							!removedSegments.some(
								(segment) =>
									region.startMs < segment.endMs &&
									region.endMs > segment.startMs,
							),
					);
				setZoomRegions((prev) => removeTrimmedRegions(prev));
				setAnnotationRegions((prev) => removeTrimmedRegions(prev));
				setSpeedRegions((prev) => removeTrimmedRegions(prev));
				setAudioRegions((prev) => removeTrimmedRegions(prev));
			}

			setClipRegions((prev) =>
				prev.map((clip) =>
					clip.id === id ? { ...clip, startMs: newStart, endMs: newEnd } : clip,
				),
			);
		},
		[clipRegions],
	);

	const handleClipSpeedChange = useCallback(
		(speed: number) => {
			if (!selectedClipId) return;
			if (!Number.isFinite(speed) || speed <= 0) {
				return;
			}
			const clip = clipRegions.find((c) => c.id === selectedClipId);
			if (!clip) return;
			const oldSpeed = Number.isFinite(clip.speed) && clip.speed > 0 ? clip.speed : 1;
			const sourceDurationMs = (clip.endMs - clip.startMs) * oldSpeed;
			const newEndMs = Math.round(clip.startMs + sourceDurationMs / speed);
			const scaleFactor = oldSpeed / speed;
			const oldEndMs = clip.endMs;
			const deltaMs = newEndMs - oldEndMs;

			setClipRegions((prev) =>
				prev.map((c) => {
					if (c.id === selectedClipId) {
						return { ...c, speed, endMs: newEndMs };
					}
					if (c.startMs >= oldEndMs) {
						return {
							...c,
							startMs: c.startMs + deltaMs,
							endMs: c.endMs + deltaMs,
						};
					}
					return c;
				}),
			);

			// Scale sub-regions within this clip proportionally, and ripple subsequent sub-regions
			const adjustRegion = <T extends { startMs: number; endMs: number }>(region: T): T => {
				if (region.startMs >= clip.startMs && region.endMs <= oldEndMs) {
					return {
						...region,
						startMs: Math.round(
							clip.startMs + (region.startMs - clip.startMs) * scaleFactor,
						),
						endMs: Math.round(
							clip.startMs + (region.endMs - clip.startMs) * scaleFactor,
						),
					};
				}
				if (region.startMs >= oldEndMs) {
					return {
						...region,
						startMs: region.startMs + deltaMs,
						endMs: region.endMs + deltaMs,
					};
				}
				return region;
			};

			setZoomRegions((prev) => prev.map(adjustRegion));
			setAnnotationRegions((prev) => prev.map(adjustRegion));
			setLayoutRegions((prev) => prev.map(adjustRegion));
			setAudioRegions((prev) => prev.map(adjustRegion));
			setSpeedRegions((prev) => prev.map(adjustRegion));
		},
		[selectedClipId, clipRegions],
	);

	const handleClipMutedChange = useCallback(
		(muted: boolean) => {
			if (!selectedClipId) return;
			setClipRegions((prev) =>
				prev.map((clip) => (clip.id === selectedClipId ? { ...clip, muted } : clip)),
			);
		},
		[selectedClipId],
	);

	const handleClipShowSourceAudioChange = useCallback(
		(showSourceAudio: boolean) => {
			if (!selectedClipId) return;
			setClipRegions((prev) =>
				prev.map((clip) =>
					clip.id === selectedClipId ? { ...clip, showSourceAudio } : clip,
				),
			);
		},
		[selectedClipId],
	);

	const handleClipTransitionInChange = useCallback(
		(transitionIn: ClipTransitionType) => {
			if (!selectedClipId) return;
			setClipRegions((prev) =>
				prev.map((clip) => (clip.id === selectedClipId ? { ...clip, transitionIn } : clip)),
			);
		},
		[selectedClipId],
	);

	const handleClipTransitionInDurationChange = useCallback(
		(transitionInDurationMs: number) => {
			if (!selectedClipId) return;
			setClipRegions((prev) =>
				prev.map((clip) =>
					clip.id === selectedClipId ? { ...clip, transitionInDurationMs } : clip,
				),
			);
		},
		[selectedClipId],
	);

	const handleClipDelete = useCallback(
		(id: string, ripple = false) => {
			const deletedClip = clipRegions.find((clip) => clip.id === id);
			if (!deletedClip) return;
			const { startMs, endMs } = deletedClip;
			const gapMs = endMs - startMs;

			if (ripple && gapMs > 0) {
				setClipRegions((prev) =>
					prev
						.filter((clip) => clip.id !== id)
						.map((clip) =>
							clip.startMs >= endMs
								? {
										...clip,
										startMs: Math.max(0, clip.startMs - gapMs),
										endMs: Math.max(0, clip.endMs - gapMs),
									}
								: clip,
						),
				);
				setZoomRegions((prev) =>
					prev
						.filter((region) => !(region.startMs >= startMs && region.endMs <= endMs))
						.map((region) =>
							region.startMs >= endMs
								? {
										...region,
										startMs: Math.max(0, region.startMs - gapMs),
										endMs: Math.max(0, region.endMs - gapMs),
									}
								: region,
						),
				);
				setAnnotationRegions((prev) =>
					prev
						.filter((region) => !(region.startMs >= startMs && region.endMs <= endMs))
						.map((region) =>
							region.startMs >= endMs
								? {
										...region,
										startMs: Math.max(0, region.startMs - gapMs),
										endMs: Math.max(0, region.endMs - gapMs),
									}
								: region,
						),
				);
				setLayoutRegions((prev) =>
					prev
						.filter((region) => !(region.startMs >= startMs && region.endMs <= endMs))
						.map((region) =>
							region.startMs >= endMs
								? {
										...region,
										startMs: Math.max(0, region.startMs - gapMs),
										endMs: Math.max(0, region.endMs - gapMs),
									}
								: region,
						),
				);
				setAudioRegions((prev) =>
					prev
						.filter((region) => !(region.startMs >= startMs && region.endMs <= endMs))
						.map((region) =>
							region.startMs >= endMs
								? {
										...region,
										startMs: Math.max(0, region.startMs - gapMs),
										endMs: Math.max(0, region.endMs - gapMs),
									}
								: region,
						),
				);
				toast.success(t("editor.clip.rippleDeleted", "Clip ripple deleted (gap closed)"));
			} else {
				setClipRegions((prev) => prev.filter((clip) => clip.id !== id));
				setZoomRegions((prev) =>
					prev.filter((region) => region.endMs <= startMs || region.startMs >= endMs),
				);
				setAnnotationRegions((prev) =>
					prev.filter((region) => region.endMs <= startMs || region.startMs >= endMs),
				);
				setLayoutRegions((prev) =>
					prev.filter((region) => region.endMs <= startMs || region.startMs >= endMs),
				);
				setAudioRegions((prev) =>
					prev.filter((region) => region.endMs <= startMs || region.startMs >= endMs),
				);
				toast.info(t("editor.clip.deleted", "Clip removed"));
			}

			if (selectedClipId === id) {
				setSelectedClipId(null);
			}
		},
		[clipRegions, selectedClipId, t],
	);

	const handleLayoutAdded = useCallback(
		(span: Span) => {
			const totalMs = Math.max(0, Math.round(duration * 1000));
			const requestedDuration = Math.max(
				1,
				Math.round(span.end - span.start) || DEFAULT_LAYOUT_SCENE_DURATION_MS,
			);
			const durationMs = Math.min(requestedDuration, Math.max(1, totalMs));
			const requestedStart = Math.max(
				0,
				Math.min(Math.round(span.start), Math.max(0, totalMs - durationMs)),
			);
			const sorted = [...layoutRegions].sort((left, right) => left.startMs - right.startMs);
			const candidates = [
				requestedStart,
				...sorted.map((region) => Math.max(0, region.endMs)),
				0,
			];
			const startMs =
				candidates.find((candidate) => {
					const candidateStart = Math.max(
						0,
						Math.min(candidate, Math.max(0, totalMs - durationMs)),
					);
					const candidateEnd = Math.min(totalMs, candidateStart + durationMs);
					return (
						candidateEnd > candidateStart &&
						!sorted.some(
							(region) =>
								candidateStart < region.endMs && candidateEnd > region.startMs,
						)
					);
				}) ?? null;

			if (startMs === null) {
				toast.warning("No free layout slot available at the current timeline position.");
				return;
			}

			const clampedStartMs = Math.max(
				0,
				Math.min(startMs, Math.max(0, totalMs - durationMs)),
			);
			const id = `layout-${nextLayoutIdRef.current++}`;
			const newRegion: LayoutRegion = {
				id,
				startMs: clampedStartMs,
				endMs: Math.min(totalMs, clampedStartMs + durationMs),
				preset: DEFAULT_LAYOUT_SCENE_PRESET,
				transitionMs: DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
				easing: DEFAULT_LAYOUT_SCENE_EASING,
			};
			setLayoutRegions(
				[...sorted, newRegion].sort((left, right) => left.startMs - right.startMs),
			);
			setSelectedLayoutId(id);
			setSelectedZoomId(null);
			setSelectedClipId(null);
			setSelectedAnnotationId(null);
			setSelectedAudioId(null);
			setActiveEffectSection("layout");
		},
		[duration, layoutRegions],
	);

	const handleLayoutSpanChange = useCallback((id: string, span: Span) => {
		setLayoutRegions((prev) =>
			prev
				.map((region) =>
					region.id === id
						? {
								...region,
								startMs: Math.round(span.start),
								endMs: Math.round(span.end),
							}
						: region,
				)
				.sort((left, right) => left.startMs - right.startMs),
		);
	}, []);

	const handleLayoutPresetChange = useCallback(
		(preset: LayoutScenePreset) => {
			if (!selectedLayoutId) return;
			setLayoutRegions((prev) =>
				prev.map((region) =>
					region.id === selectedLayoutId ? { ...region, preset } : region,
				),
			);
		},
		[selectedLayoutId],
	);

	const handleLayoutTransitionChange = useCallback(
		(transitionMs: number) => {
			if (!selectedLayoutId || !Number.isFinite(transitionMs)) return;
			const nextTransitionMs = Math.max(0, Math.min(4000, Math.round(transitionMs)));
			setLayoutRegions((prev) =>
				prev.map((region) =>
					region.id === selectedLayoutId
						? { ...region, transitionMs: nextTransitionMs }
						: region,
				),
			);
		},
		[selectedLayoutId],
	);

	const handleLayoutEasingChange = useCallback(
		(easing: LayoutSceneEasing) => {
			if (!selectedLayoutId) return;
			setLayoutRegions((prev) =>
				prev.map((region) =>
					region.id === selectedLayoutId ? { ...region, easing } : region,
				),
			);
		},
		[selectedLayoutId],
	);

	const handleLayoutDelete = useCallback(
		(id: string) => {
			setLayoutRegions((prev) => prev.filter((region) => region.id !== id));
			if (selectedLayoutId === id) {
				setSelectedLayoutId(null);
			}
		},
		[selectedLayoutId],
	);

	const handleSelectAudio = useCallback((id: string | null) => {
		setSelectedAudioId(id);
		if (id) {
			setSelectedZoomId(null);
			setSelectedLayoutId(null);
			setSelectedAnnotationId(null);
			setActiveEffectSection("audio");
		}
	}, []);

	const handleAudioAdded = useCallback((span: Span, audioPath: string, trackIndex?: number) => {
		const id = `audio-${nextAudioIdRef.current++}`;
		const newRegion: AudioRegion = {
			id,
			startMs: Math.round(span.start),
			endMs: Math.round(span.end),
			audioPath,
			volume: 1,
			normalize: false,
			trackIndex,
		};
		setAudioRegions((prev) => [...prev, newRegion]);
		setSelectedAudioId(id);
		setSelectedZoomId(null);
		setSelectedAnnotationId(null);
		setActiveEffectSection("audio");
	}, []);

	const handleAudioSpanChange = useCallback((id: string, span: Span, trackIndex?: number) => {
		const normalizedTrackIndex =
			typeof trackIndex === "number" && Number.isFinite(trackIndex)
				? Math.max(0, Math.floor(trackIndex))
				: undefined;

		setAudioRegions((prev) =>
			prev.map((region) =>
				region.id === id
					? {
							...region,
							startMs: Math.round(span.start),
							endMs: Math.round(span.end),
							...(normalizedTrackIndex === undefined
								? {}
								: { trackIndex: normalizedTrackIndex }),
						}
					: region,
			),
		);
	}, []);

	const handleAudioVolumeChange = useCallback(
		(volume: number) => {
			if (!selectedAudioId) {
				return;
			}

			if (!Number.isFinite(volume)) {
				return;
			}

			const nextVolume = Math.max(0, Math.min(1, volume));
			setAudioRegions((prev) =>
				prev.map((region) =>
					region.id === selectedAudioId ? { ...region, volume: nextVolume } : region,
				),
			);
		},
		[selectedAudioId],
	);

	const handleAudioDelete = useCallback(
		(id: string) => {
			setAudioRegions((prev) => prev.filter((region) => region.id !== id));
			if (selectedAudioId === id) {
				setSelectedAudioId(null);
			}
		},
		[selectedAudioId],
	);

	const handleAudioNormalizeChange = useCallback(
		(normalize: boolean) => {
			if (!selectedAudioId) {
				return;
			}
			setAudioRegions((prev) =>
				prev.map((region) =>
					region.id === selectedAudioId ? { ...region, normalize } : region,
				),
			);
		},
		[selectedAudioId],
	);

	const handleAudioDuckingChange = useCallback(
		(ducking: boolean) => {
			if (!selectedAudioId) {
				return;
			}
			setAudioRegions((prev) =>
				prev.map((region) =>
					region.id === selectedAudioId ? { ...region, ducking } : region,
				),
			);
		},
		[selectedAudioId],
	);

	const handleAnnotationAdded = useCallback((span: Span, trackIndex = 0) => {
		const id = `annotation-${nextAnnotationIdRef.current++}`;
		const zIndex = nextAnnotationZIndexRef.current++; // Assign z-index based on creation order
		const newRegion: AnnotationRegion = {
			id,
			startMs: Math.round(span.start),
			endMs: Math.round(span.end),
			type: "text",
			content: "Enter text...",
			position: { ...DEFAULT_ANNOTATION_POSITION },
			size: { ...DEFAULT_ANNOTATION_SIZE },
			style: { ...DEFAULT_ANNOTATION_STYLE },
			zIndex,
			trackIndex,
		};
		setAnnotationRegions((prev) => [...prev, newRegion]);
		setSelectedAnnotationId(id);
		setSelectedZoomId(null);
	}, []);

	const handleAddGifAnnotation = useCallback(async () => {
		const result = await window.electronAPI.showOpenDialog({
			filters: [{ name: "GIF", extensions: ["gif"] }],
		});
		if (!result || result.canceled || result.filePaths.length === 0) return;
		const filePath = result.filePaths[0];
		const dataUrl = await window.electronAPI.readFileAsDataUrl(filePath);
		if (!dataUrl) return;

		const id = `annotation-${nextAnnotationIdRef.current++}`;
		const zIndex = nextAnnotationZIndexRef.current++;
		const trackIndex =
			annotationRegions.length > 0
				? Math.max(...annotationRegions.map((r) => r.trackIndex ?? 0)) + 1
				: 0;

		const startMs = currentTime * 1000;
		const endMs = Math.min(duration * 1000, startMs + 3000);

		const newRegion: AnnotationRegion = {
			id,
			startMs,
			endMs,
			type: "gif",
			content: "",
			gifPath: filePath,
			gifDataUrl: dataUrl as string,
			position: { ...DEFAULT_ANNOTATION_POSITION },
			size: { ...DEFAULT_ANNOTATION_SIZE },
			style: { ...DEFAULT_ANNOTATION_STYLE },
			zIndex,
			trackIndex,
		};
		setAnnotationRegions((prev) => [...prev, newRegion]);
		setSelectedAnnotationId(id);
		setSelectedZoomId(null);
	}, [annotationRegions, duration, currentTime]);

	const handleAddAudioTrack = useCallback(async () => {
		const result = await window.electronAPI.showOpenDialog({
			title: "Select Audio File",
			filters: [
				{ name: "Audio Files", extensions: ["mp3", "wav", "aac", "m4a", "ogg", "flac"] },
			],
			properties: ["openFile"],
		});
		if (!result || result.canceled || result.filePaths.length === 0) return;
		const filePath = result.filePaths[0];

		// Detect duration using temporary HTMLAudioElement
		const fileUrl = toFileUrl(filePath);
		let audioDurationMs = 10000; // default fallback 10s
		try {
			const tempAudio = new Audio(fileUrl);
			await new Promise<void>((resolve) => {
				tempAudio.onloadedmetadata = () => {
					if (Number.isFinite(tempAudio.duration) && tempAudio.duration > 0) {
						audioDurationMs = Math.round(tempAudio.duration * 1000);
					}
					resolve();
				};
				tempAudio.onerror = () => resolve();
				setTimeout(resolve, 2000); // 2s timeout
			});
		} catch {
			// ignore, fallback duration used
		}

		const currentMs = Math.round(
			(videoPlaybackRef.current?.video?.currentTime ?? currentTime) * 1000,
		);
		const startMs = currentMs;
		const endMs = startMs + audioDurationMs;

		handleAudioAdded({ start: startMs, end: endMs }, filePath);
		toast.success("Audio track added");
	}, [currentTime, handleAudioAdded]);

	const handleAddStickerAnnotation = useCallback(async () => {
		const result = await window.electronAPI.showOpenDialog({
			filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "svg"] }],
			properties: ["openFile"],
		});
		if (!result || result.canceled || result.filePaths.length === 0) return;
		const filePath = result.filePaths[0];

		const dataUrl = await window.electronAPI.readFileAsDataUrl(filePath);
		if (!dataUrl) return;

		const currentMs = Math.round(currentTime * 1000);
		const durationMs = Math.round(duration * 1000);

		const id = `annotation-${nextAnnotationIdRef.current++}`;
		const zIndex = nextAnnotationZIndexRef.current++;
		const trackIndex =
			annotationRegions.length > 0
				? Math.max(...annotationRegions.map((r) => r.trackIndex ?? 0)) + 1
				: 0;

		const newRegion: AnnotationRegion = {
			id,
			type: "image",
			content: dataUrl,
			imageContent: dataUrl,
			imageFilePath: filePath,
			startMs: currentMs,
			endMs: Math.min(currentMs + 5000, durationMs),
			position: { ...DEFAULT_ANNOTATION_POSITION },
			size: { ...DEFAULT_ANNOTATION_SIZE, width: 20, height: 20 },
			style: {
				...DEFAULT_ANNOTATION_STYLE,
				backgroundColor: "transparent",
				opacity: 1,
				dropShadow: false,
			},
			zIndex,
			trackIndex,
		};
		setAnnotationRegions((prev) => [...prev, newRegion]);
		setSelectedAnnotationId(id);
		setSelectedZoomId(null);
	}, [annotationRegions.length, currentTime, duration]);

	const handleAnnotationSpanChange = useCallback(
		(id: string, span: Span, trackIndex?: number) => {
			const normalizedTrackIndex =
				typeof trackIndex === "number" && Number.isFinite(trackIndex)
					? Math.max(0, Math.floor(trackIndex))
					: undefined;

			setAnnotationRegions((prev) =>
				prev.map((region) =>
					region.id === id
						? {
								...region,
								startMs: Math.round(span.start),
								endMs: Math.round(span.end),
								...(normalizedTrackIndex === undefined
									? {}
									: { trackIndex: normalizedTrackIndex }),
							}
						: region,
				),
			);
		},
		[],
	);

	const handleAnnotationDelete = useCallback(
		(id: string) => {
			setAnnotationRegions((prev) => prev.filter((region) => region.id !== id));
			if (selectedAnnotationId === id) {
				setSelectedAnnotationId(null);
			}
		},
		[selectedAnnotationId],
	);

	const handleAnnotationContentChange = useCallback((id: string, content: string) => {
		setAnnotationRegions((prev) => {
			const updated = prev.map((region) => {
				if (region.id !== id) return region;

				// Store content in type-specific fields
				if (region.type === "text") {
					return { ...region, content, textContent: content };
				} else if (region.type === "image") {
					return { ...region, content, imageContent: content };
				} else {
					return { ...region, content };
				}
			});
			return updated;
		});
	}, []);

	const handleAnnotationTypeChange = useCallback((id: string, type: AnnotationRegion["type"]) => {
		setAnnotationRegions((prev) => {
			const updated = prev.map((region) => {
				if (region.id !== id) return region;

				const updatedRegion = { ...region, type };

				// Restore content from type-specific storage
				if (type === "text") {
					updatedRegion.content = region.textContent || "Enter text...";
				} else if (type === "image") {
					updatedRegion.content = region.imageContent || "";
				} else if (type === "figure") {
					updatedRegion.content = "";
					if (!region.figureData) {
						updatedRegion.figureData = { ...DEFAULT_FIGURE_DATA };
					}
				} else if (type === "blur") {
					updatedRegion.content = "";
					if (region.blurIntensity === undefined) {
						updatedRegion.blurIntensity = 20;
					}
				}

				return updatedRegion;
			});
			return updated;
		});
	}, []);

	const handleAnnotationStyleChange = useCallback(
		(id: string, style: Partial<AnnotationRegion["style"]>) => {
			setAnnotationRegions((prev) =>
				prev.map((region) =>
					region.id === id ? { ...region, style: { ...region.style, ...style } } : region,
				),
			);
		},
		[],
	);

	const handleAnnotationFigureDataChange = useCallback((id: string, figureData: FigureData) => {
		setAnnotationRegions((prev) =>
			prev.map((region) => (region.id === id ? { ...region, figureData } : region)),
		);
	}, []);

	const handleAnnotationBlurIntensityChange = useCallback((id: string, blurIntensity: number) => {
		setAnnotationRegions((prev) =>
			prev.map((region) => (region.id === id ? { ...region, blurIntensity } : region)),
		);
	}, []);

	const handleAnnotationBlurColorChange = useCallback((id: string, blurColor: string) => {
		setAnnotationRegions((prev) =>
			prev.map((region) => (region.id === id ? { ...region, blurColor } : region)),
		);
	}, []);

	const handleAnnotationAnimationChange = useCallback(
		(
			id: string,
			anim: {
				animationIn?: "none" | "fade" | "slide-up";
				animationOut?: "none" | "fade";
				animationDurationMs?: number;
			},
		) => {
			setAnnotationRegions((prev) =>
				prev.map((region) => (region.id === id ? { ...region, ...anim } : region)),
			);
		},
		[],
	);

	const handleAnnotationLayerChange = useCallback(
		(id: string, changes: Partial<AnnotationRegion>) => {
			setAnnotationRegions((prev) =>
				prev.map((region) => (region.id === id ? { ...region, ...changes } : region)),
			);
		},
		[],
	);

	const handleAnnotationPositionChange = useCallback(
		(id: string, position: { x: number; y: number }) => {
			setAnnotationRegions((prev) =>
				prev.map((region) => (region.id === id ? { ...region, position } : region)),
			);
		},
		[],
	);

	const handleAnnotationSizeChange = useCallback(
		(id: string, size: { width: number; height: number }) => {
			setAnnotationRegions((prev) =>
				prev.map((region) => (region.id === id ? { ...region, size } : region)),
			);
		},
		[],
	);

	// Global Tab prevention
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const isEditableTarget =
				target instanceof HTMLInputElement ||
				target instanceof HTMLTextAreaElement ||
				target?.isContentEditable;

			const usesPrimaryModifier = isMac ? e.metaKey : e.ctrlKey;
			const key = e.key.toLowerCase();

			if (usesPrimaryModifier && !e.altKey && key === "z") {
				if (!isEditableTarget) {
					e.preventDefault();
					if (e.shiftKey) {
						handleRedo();
					} else {
						handleUndo();
					}
				}
				return;
			}

			if (!isMac && e.ctrlKey && !e.metaKey && !e.altKey && key === "y") {
				if (!isEditableTarget) {
					e.preventDefault();
					handleRedo();
				}
				return;
			}

			if (e.key === "Tab") {
				// Allow tab only in inputs/textareas
				if (isEditableTarget) {
					return;
				}
				e.preventDefault();
			}

			if (matchesShortcut(e, shortcuts.playPause, isMac)) {
				// Allow space only in inputs/textareas
				if (isEditableTarget) {
					return;
				}
				e.preventDefault();

				const playback = videoPlaybackRef.current;
				if (playback?.video) {
					if (playback.video.paused) {
						playback.play().catch(console.error);
					} else {
						playback.pause();
					}
				}
				return;
			}

			const isSplitShortcut =
				matchesShortcut(e, shortcuts.splitClip, isMac) ||
				(usesPrimaryModifier && !e.altKey && !e.shiftKey && key === "b");

			if (isSplitShortcut && !isEditableTarget) {
				e.preventDefault();
				timelineRef.current?.splitClip();
				return;
			}

			const isRippleDeleteShortcut =
				e.shiftKey && (e.key === "Delete" || e.key === "Backspace");

			if (isRippleDeleteShortcut && !isEditableTarget && selectedClipId) {
				e.preventDefault();
				handleClipDelete(selectedClipId, true);
				return;
			}

			if (usesPrimaryModifier && !e.altKey && !e.shiftKey && key === "n") {
				if (!isEditableTarget) {
					e.preventDefault();
					void handleNewProject();
				}
				return;
			}

			if (usesPrimaryModifier && !e.altKey && !e.shiftKey && key === "o") {
				if (!isEditableTarget) {
					e.preventDefault();
					void handleLoadProjectFile();
				}
				return;
			}

			if (usesPrimaryModifier && !e.altKey && !e.shiftKey && key === "s") {
				if (!isEditableTarget) {
					e.preventDefault();
					void saveProject(false);
				}
				return;
			}

			if (usesPrimaryModifier && !e.altKey && e.shiftKey && key === "s") {
				if (!isEditableTarget) {
					e.preventDefault();
					void saveProject(true);
				}
				return;
			}

			if (usesPrimaryModifier && !e.altKey && !e.shiftKey && key === ",") {
				if (!isEditableTarget) {
					e.preventDefault();
					handleOpenSettings("general");
				}
				return;
			}

			if (e.altKey && key === "home") {
				if (!isEditableTarget) {
					e.preventDefault();
					void handleNavigateToWelcome();
				}
				return;
			}
		};

		window.addEventListener("keydown", handleKeyDown, { capture: true });
		return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
	}, [
		shortcuts,
		isMac,
		handleUndo,
		handleRedo,
		handleClipDelete,
		selectedClipId,
		handleNewProject,
		handleLoadProjectFile,
		saveProject,
		handleNavigateToWelcome,
		handleOpenSettings,
	]);

	useEffect(() => {
		if (selectedZoomId && !zoomRegions.some((region) => region.id === selectedZoomId)) {
			setSelectedZoomId(null);
		}
	}, [selectedZoomId, zoomRegions]);

	useEffect(() => {
		if (
			selectedAnnotationId &&
			!annotationRegions.some((region) => region.id === selectedAnnotationId)
		) {
			setSelectedAnnotationId(null);
		}
	}, [selectedAnnotationId, annotationRegions]);

	useEffect(() => {
		if (selectedAudioId && !audioRegions.some((region) => region.id === selectedAudioId)) {
			setSelectedAudioId(null);
		}
	}, [selectedAudioId, audioRegions]);

	useEffect(() => {
		if (selectedLayoutId && !layoutRegions.some((region) => region.id === selectedLayoutId)) {
			setSelectedLayoutId(null);
		}
	}, [selectedLayoutId, layoutRegions]);

	const showExportSuccessToast = useCallback((filePath: string) => {
		toast.success(`Exported successfully to ${filePath}`, {
			action: {
				label: "Show in Folder",
				onClick: async () => {
					try {
						const result = await window.electronAPI.revealInFolder(filePath);
						if (!result.success) {
							const errorMessage =
								result.error ||
								result.message ||
								"Failed to reveal item in folder.";
							toast.error(errorMessage);
						}
					} catch (err) {
						toast.error(`Error revealing in folder: ${String(err)}`);
					}
				},
			},
		});
	}, []);

	const handleExport = useCallback(
		async (settings: ExportSettings) => {
			if (!videoPath) {
				toast.error("No video loaded");
				return;
			}

			const video = videoPlaybackRef.current?.video;
			if (!video) {
				toast.error("Video not ready");
				return;
			}

			setIsExporting(true);
			setExportProgress(null);
			setExportError(null);
			clearPendingExportSave();
			extensionHost.emitEvent({ type: "export:start" });
			const smokeExportStartedAt = smokeExportConfig.enabled ? performance.now() : null;

			let keepExportDialogOpen = false;

			try {
				const wasPlaying = isPlaying;
				const restoreTime = video.currentTime;
				if (wasPlaying) {
					videoPlaybackRef.current?.pause();
				}

				// Get preview CONTAINER dimensions for scaling
				const playbackRef = videoPlaybackRef.current;
				const containerElement = playbackRef?.containerRef?.current;
				const previewWidth = containerElement?.clientWidth || 1920;
				const previewHeight = containerElement?.clientHeight || 1080;
				const effectiveShadowIntensity =
					smokeExportConfig.enabled && smokeExportConfig.shadowIntensity !== undefined
						? smokeExportConfig.shadowIntensity
						: shadowIntensity;
				const smokeProgressSampler = createSmokeExportProgressSampler({
					enabled: smokeExportConfig.enabled,
					startedAtMs: smokeExportStartedAt,
				});
				const smokeProgressSamples = smokeProgressSampler.samples;
				const recordSmokeProgress = smokeProgressSampler.record;

				if (settings.format === "gif" && settings.gifConfig) {
					// GIF Export
					const gifExporter = new GifExporter({
						videoUrl: videoPath,
						width: settings.gifConfig.width,
						height: settings.gifConfig.height,
						frameRate: settings.gifConfig.frameRate,
						loop: settings.gifConfig.loop,
						sizePreset: settings.gifConfig.sizePreset,
						wallpaper,
						trimRegions,
						speedRegions: effectiveSpeedRegions,
						showShadow: effectiveShadowIntensity > 0,
						shadowIntensity: effectiveShadowIntensity,
						backgroundBlur,
						zoomMotionBlur,
						zoomMotionBlurTuning,
						zoomTemporalMotionBlur,
						zoomMotionBlurSampleCount,
						zoomMotionBlurShutterFraction,
						connectZooms,
						zoomInDurationMs,
						zoomInOverlapMs,
						zoomOutDurationMs,
						connectedZoomGapMs,
						connectedZoomDurationMs,
						zoomInEasing,
						zoomOutEasing,
						connectedZoomEasing,
						borderRadius,
						padding,
						videoPadding: padding,
						cropRegion,
						webcam,
						layoutRegions,
						webcamUrl:
							resolvedWebcamVideoUrl ??
							(webcam.sourcePath ? toFileUrl(webcam.sourcePath) : null),
						annotationRegions,
						zoomRegions: effectiveZoomRegions,
						cursorTelemetry: effectiveCursorTelemetry,
						showCursor: effectiveShowCursor,
						cursorStyle,
						cursorSize,
						cursorSmoothing,
						cursorSpringStiffnessMultiplier,
						cursorSpringDampingMultiplier,
						cursorSpringMassMultiplier,
						cameraSpringStiffnessMultiplier,
						cameraSpringDampingMultiplier,
						cameraSpringMassMultiplier,
						zoomSmoothness,
						zoomClassicMode,
						cursorMotionBlur,
						cursorClickBounce,
						cursorClickBounceDuration,
						cursorSway,
						cameraPerspectiveTilt,
						frame,
						previewWidth,
						previewHeight,
						maxDecodeQueue: smokeExportConfig.maxDecodeQueue,
						maxPendingFrames: smokeExportConfig.maxPendingFrames,
						onProgress: (progress: ExportProgress) => {
							recordSmokeProgress(progress);
							setExportProgress(progress);
						},
					});

					exporterRef.current = gifExporter as unknown as VideoExporter;
					const result = await gifExporter.export();

					if (result.success && result.blob) {
						const timestamp = Date.now();
						const fileName = `export-${timestamp}.gif`;
						markExportAsSaving();

						const { saveResult, pendingSave } = await saveBlobExport(
							result.blob,
							fileName,
							smokeExportConfig.enabled ? smokeExportConfig.outputPath : null,
						);

						if (saveResult.canceled) {
							pendingExportSaveRef.current = pendingSave;
							setHasPendingExportSave(true);
							setExportError(
								"Save dialog canceled. Click Save Again to save without re-rendering.",
							);
							toast.info("Save canceled. You can save again without re-exporting.");
							keepExportDialogOpen = true;
						} else if (saveResult.success && saveResult.path) {
							if (smokeExportStartedAt !== null) {
								console.log(
									`[smoke-export] Completed in ${Math.round(performance.now() - smokeExportStartedAt)}ms (${saveResult.path})`,
								);
							}
							showExportSuccessToast(saveResult.path);
							setExportedFilePath(saveResult.path);
							if (smokeExportConfig.enabled) {
								window.close();
								return;
							}
						} else {
							setExportError(saveResult.message || "Failed to save GIF");
							toast.error(saveResult.message || "Failed to save GIF");
							if (smokeExportConfig.enabled) {
								window.close();
								return;
							}
						}
					} else {
						setExportError(result.error || "GIF export failed");
						toast.error(result.error || "GIF export failed");
						if (smokeExportConfig.enabled) {
							window.close();
							return;
						}
					}
				} else {
					// MP4 Export
					const { quality, encodingMode, selectedMp4FrameRate } =
						resolveMp4ExportSettings({
							smokeExportConfig: {
								enabled: smokeExportConfig.enabled,
								quality: smokeExportConfig.quality,
								encodingMode: smokeExportConfig.encodingMode,
								fps: smokeExportConfig.fps,
							},
							settings,
							exportQuality,
							exportEncodingMode,
							mp4FrameRate,
						});
					const {
						pipelineModel,
						useExperimentalNativeExport,
						useExperimentalNvidiaCudaExport,
						backendPreference,
					} = resolveMp4ExportRouting({
						smokeExportConfig: {
							enabled: smokeExportConfig.enabled,
							pipelineModel: smokeExportConfig.pipelineModel,
							useNativeExport: smokeExportConfig.useNativeExport,
							backendPreference: smokeExportConfig.backendPreference,
						},
						settings,
						exportPipelineModel,
						exportBackendPreference,
						experimentalNvidiaCudaExport,
						nvidiaCudaExportAvailable,
					});
					const supportedSourceDimensions =
						await ensureSupportedMp4SourceDimensions(selectedMp4FrameRate);
					const { width: exportWidth, height: exportHeight } =
						calculateMp4ExportDimensions(
							supportedSourceDimensions.width,
							supportedSourceDimensions.height,
							quality,
						);
					const bitrate = getMp4ExportBitrate({
						width: exportWidth,
						height: exportHeight,
						frameRate: selectedMp4FrameRate,
						quality,
						encodingMode,
						useModernNativeStaticLayout: useExperimentalNativeExport,
					});
					const sourceAudioTrackSettingsForExport =
						selectedClipId !== null
							? audio.selectedClipSourceAudioTrackSettings
							: audio.activeSourceAudioTrackSettings;

					const exporterConfig = {
						videoUrl: videoPath,
						width: exportWidth,
						height: exportHeight,
						frameRate: selectedMp4FrameRate,
						bitrate,
						codec: DEFAULT_MP4_CODEC,
						encodingMode,
						preferredEncoderPath: supportedSourceDimensions.encoderPath,
						preferredRenderBackend: smokeExportConfig.renderBackend,
						experimentalNativeExport: useExperimentalNativeExport,
						experimentalNvidiaCudaExport: useExperimentalNvidiaCudaExport,
						maxEncodeQueue: smokeExportConfig.maxEncodeQueue,
						maxDecodeQueue: smokeExportConfig.maxDecodeQueue,
						maxPendingFrames: smokeExportConfig.maxPendingFrames,
						wallpaper,
						trimRegions,
						speedRegions: effectiveSpeedRegions,
						showShadow: effectiveShadowIntensity > 0,
						shadowIntensity: effectiveShadowIntensity,
						backgroundBlur,
						zoomMotionBlur,
						zoomMotionBlurTuning,
						zoomTemporalMotionBlur,
						zoomMotionBlurSampleCount,
						zoomMotionBlurShutterFraction,
						connectZooms,
						zoomInDurationMs,
						zoomInOverlapMs,
						zoomOutDurationMs,
						connectedZoomGapMs,
						connectedZoomDurationMs,
						zoomInEasing,
						zoomOutEasing,
						connectedZoomEasing,
						borderRadius,
						colorGrading,
						padding,
						cropRegion,
						webcam,
						webcamUrl:
							resolvedWebcamVideoUrl ??
							(webcam.sourcePath ? toFileUrl(webcam.sourcePath) : null),
						annotationRegions,
						zoomRegions: effectiveZoomRegions,
						cursorTelemetry: effectiveCursorTelemetry,
						showCursor: effectiveShowCursor,
						cursorStyle,
						cursorSize,
						cursorSmoothing,
						cursorSpringStiffnessMultiplier,
						cursorSpringDampingMultiplier,
						cursorSpringMassMultiplier,
						cameraSpringStiffnessMultiplier,
						cameraSpringDampingMultiplier,
						cameraSpringMassMultiplier,
						zoomSmoothness,
						zoomClassicMode,
						cursorMotionBlur,
						cursorClickBounce,
						cursorClickBounceDuration,
						cursorSway,
						cameraPerspectiveTilt,
						frame,
						audioRegions,
						audioDuckingSettings,
						clipRegions,
						sourceAudioFallbackPaths: audio.sourceAudioFallbackPaths,
						sourceAudioFallbackStartDelayMsByPath:
							audio.sourceAudioFallbackStartDelayMsByPath,
						sourceAudioTrackSettings: sourceAudioTrackSettingsForExport,
						previewWidth,
						previewHeight,
						onProgress: (progress: ExportProgress) => {
							recordSmokeProgress(progress);
							setExportProgress(progress);
						},
					};

					let result: ExportResult;

					if (clips.length > 1) {
						const renderedClipPaths: string[] = [];
						const totalClips = clips.length;

						for (let i = 0; i < clips.length; i++) {
							const clip = clips[i];
							const isRecorded = isRecordedClip(clip);
							const clipVideoUrl = await resolveVideoUrl(clip.videoPath);

							// Isolated webcam handling
							const hasClipWebcam = Boolean(clip.webcamPath && clip.webcam?.enabled !== false);
							const clipWebcamUrl = hasClipWebcam && clip.webcamPath ? await resolveVideoUrl(clip.webcamPath) : null;
							const clipWebcamSettings: WebcamOverlaySettings = hasClipWebcam
								? {
										...(clip.webcam ?? DEFAULT_WEBCAM_OVERLAY),
										enabled: true,
										sourcePath: clip.webcamPath ?? null,
								  }
								: {
										...DEFAULT_WEBCAM_OVERLAY,
										enabled: false,
										sourcePath: null,
								  };

							// Isolated cursor and telemetry handling
							let clipCursorTelemetry: CursorTelemetryPoint[] = [];
							let clipShowCursor = false;
							if (isRecorded) {
								clipShowCursor = typeof clip.showCursor === "boolean" ? clip.showCursor : true;
								if (clip.cursorTelemetry && clip.cursorTelemetry.length > 0) {
									clipCursorTelemetry = clip.cursorTelemetry;
								} else if (window.electronAPI?.getCursorTelemetry) {
									try {
										const res = await window.electronAPI.getCursorTelemetry(clip.videoPath);
										if (res.success && res.samples) {
											clipCursorTelemetry = res.samples;
										}
									} catch {
										clipCursorTelemetry = [];
									}
								}
							}

							const clipExporterConfig = {
								...exporterConfig,
								videoUrl: clipVideoUrl,
								wallpaper: clip.wallpaper ?? wallpaper,
								cropRegion: clip.cropRegion ?? cropRegion,
								layoutRegions: clip.layoutRegions ?? layoutRegions,
								webcam: clipWebcamSettings,
								webcamUrl: clipWebcamUrl,
								zoomRegions: clip.zoomRegions ?? [],
								showCursor: clipShowCursor,
								cursorTelemetry: clipCursorTelemetry,
								onProgress: (progress: ExportProgress) => {
									const aggregateProgress: ExportProgress = {
										...progress,
										percentage: Math.round(((i + progress.percentage / 100) / totalClips) * 100),
										phase: "extracting",
									};
									recordSmokeProgress(aggregateProgress);
									setExportProgress(aggregateProgress);
								},
							};

							const clipExporter =
								pipelineModel === "modern"
									? new ModernVideoExporter({
											...clipExporterConfig,
											backendPreference,
									  })
									: new VideoExporter(clipExporterConfig);

							exporterRef.current = clipExporter;
							const clipResult = await clipExporter.export();
							if (!clipResult.success || !clipResult.tempFilePath) {
								throw new Error(clipResult.error || `Failed to export Take ${i + 1}`);
							}
							renderedClipPaths.push(clipResult.tempFilePath);
						}

						setExportProgress((prev) =>
							prev
								? {
										...prev,
										percentage: 99,
										phase: "finalizing",
									}
								: {
										currentFrame: 99,
										totalFrames: 100,
										percentage: 99,
										estimatedTimeRemaining: 1,
										phase: "finalizing",
									},
						);
						const stitchRes = await window.electronAPI.stitchVideoClips(renderedClipPaths);
						if (!stitchRes.success || !stitchRes.outputPath) {
							throw new Error(stitchRes.error || "Failed to assemble multi-clip export");
						}

						result = {
							success: true,
							tempFilePath: stitchRes.outputPath,
						};
					} else {
						const exporter =
							pipelineModel === "modern"
								? new ModernVideoExporter({
										...exporterConfig,
										backendPreference,
									})
								: new VideoExporter(exporterConfig);

						exporterRef.current = exporter;
						result = await exporter.export();
					}
					const smokeExportElapsedMs =
						smokeExportStartedAt !== null
							? Math.round(performance.now() - smokeExportStartedAt)
							: undefined;

					if (result.success && (result.blob || result.tempFilePath)) {
						const timestamp = Date.now();
						const fileName = `export-${timestamp}.mp4`;
						markExportAsSaving();

						let saveResult: {
							success: boolean;
							path?: string;
							message?: string;
							canceled?: boolean;
						};
						let pendingOnCancel: PendingExportSave;

						if (result.tempFilePath) {
							// Preferred path: main process already holds the finished MP4 on
							// disk, so we just ask it to move the temp file into place. This
							// avoids ever allocating a multi-GiB ArrayBuffer in the renderer.
							saveResult = await window.electronAPI.finalizeExportedVideo({
								tempPath: result.tempFilePath,
								fileName,
								outputPath:
									smokeExportConfig.enabled && smokeExportConfig.outputPath
										? smokeExportConfig.outputPath
										: null,
							});
							pendingOnCancel = { fileName, tempFilePath: result.tempFilePath };
						} else if (result.blob) {
							// Legacy fallback: some export paths still surface a Blob, but in
							// Electron we stream it into a temp file first so save/finalize
							// never requires a giant renderer ArrayBuffer.
							const blobSave = await saveBlobExport(
								result.blob,
								fileName,
								smokeExportConfig.enabled ? smokeExportConfig.outputPath : null,
							);
							saveResult = blobSave.saveResult;
							pendingOnCancel = blobSave.pendingSave;
						} else {
							saveResult = { success: false, message: "Export produced no output" };
							pendingOnCancel = { fileName };
						}

						if (saveResult.canceled) {
							if (smokeExportConfig.enabled) {
								await writeSmokeExportReport(smokeExportConfig.outputPath, {
									success: false,
									phase: "save",
									format: "mp4",
									pipelineModel,
									backendPreference,
									encodingMode,
									shadowIntensity: effectiveShadowIntensity,
									elapsedMs: smokeExportElapsedMs,
									error: "Save canceled",
									progressSamples: smokeProgressSamples,
									metrics: result.metrics,
								});
							}
							pendingExportSaveRef.current = pendingOnCancel;
							setHasPendingExportSave(true);
							setExportError(
								"Save dialog canceled. Click Save Again to save without re-rendering.",
							);
							toast.info("Save canceled. You can save again without re-exporting.");
							keepExportDialogOpen = true;
						} else if (saveResult.success && saveResult.path) {
							if (smokeExportConfig.enabled) {
								await writeSmokeExportReport(smokeExportConfig.outputPath, {
									success: true,
									phase: "saved",
									format: "mp4",
									pipelineModel,
									backendPreference,
									encodingMode,
									shadowIntensity: effectiveShadowIntensity,
									elapsedMs: smokeExportElapsedMs,
									outputPath: saveResult.path,
									progressSamples: smokeProgressSamples,
									metrics: result.metrics,
								});
							}
							if (smokeExportStartedAt !== null) {
								console.log(
									`[smoke-export] Completed in ${Math.round(performance.now() - smokeExportStartedAt)}ms (${saveResult.path})`,
								);
							}
							showExportSuccessToast(saveResult.path);
							setExportedFilePath(saveResult.path);
							if (smokeExportConfig.enabled) {
								window.close();
								return;
							}
						} else {
							if (smokeExportConfig.enabled) {
								await writeSmokeExportReport(smokeExportConfig.outputPath, {
									success: false,
									phase: "save",
									format: "mp4",
									pipelineModel,
									backendPreference,
									encodingMode,
									shadowIntensity: effectiveShadowIntensity,
									elapsedMs: smokeExportElapsedMs,
									error: saveResult.message || "Failed to save video",
									progressSamples: smokeProgressSamples,
									metrics: result.metrics,
								});
							}
							setExportError(saveResult.message || "Failed to save video");
							showExportErrorToast(saveResult.message || "Failed to save video");
							// Keep the pending-save entry so the user can retry without
							// re-rendering. The temp file is still on disk (the main
							// process only moves/deletes it on success) and the
							// ArrayBuffer fallback still references its in-memory blob.
							if (pendingOnCancel.tempFilePath || pendingOnCancel.arrayBuffer) {
								pendingExportSaveRef.current = pendingOnCancel;
								setHasPendingExportSave(true);
								keepExportDialogOpen = true;
							}
							if (smokeExportConfig.enabled) {
								window.close();
								return;
							}
						}
					} else {
						if (smokeExportConfig.enabled) {
							await writeSmokeExportReport(smokeExportConfig.outputPath, {
								success: false,
								phase: "export",
								format: "mp4",
								pipelineModel,
								backendPreference,
								encodingMode,
								shadowIntensity: effectiveShadowIntensity,
								elapsedMs: smokeExportElapsedMs,
								error: result.error || "Export failed",
								progressSamples: smokeProgressSamples,
								metrics: result.metrics,
							});
						}
						setExportError(result.error || "Export failed");
						showExportErrorToast(result.error || "Export failed");
						keepExportDialogOpen = true;
						if (smokeExportConfig.enabled) {
							window.close();
							return;
						}
					}
				}

				if (wasPlaying) {
					videoPlaybackRef.current?.play();
				} else {
					video.currentTime = restoreTime;
				}
			} catch (error) {
				console.error("Export error:", error);
				const errorMessage = error instanceof Error ? error.message : "Unknown error";
				if (smokeExportConfig.enabled) {
					await writeSmokeExportReport(smokeExportConfig.outputPath, {
						success: false,
						phase: "exception",
						format: settings.format,
						elapsedMs:
							smokeExportStartedAt !== null
								? Math.round(performance.now() - smokeExportStartedAt)
								: undefined,
						error: errorMessage,
					});
				}
				setExportError(errorMessage);
				showExportErrorToast(`Export failed: ${errorMessage}`);
				keepExportDialogOpen = true;
				if (smokeExportConfig.enabled) {
					window.close();
				}
			} finally {
				extensionHost.emitEvent({ type: "export:complete" });
				setIsExporting(false);
				exporterRef.current = null;
				setShowExportDropdown(keepExportDialogOpen);
				remountPreview();
			}
		},
		[
			clearPendingExportSave,
			videoPath,
			wallpaper,
			trimRegions,
			shadowIntensity,
			backgroundBlur,
			zoomMotionBlur,
			zoomMotionBlurTuning,
			zoomTemporalMotionBlur,
			zoomMotionBlurSampleCount,
			zoomMotionBlurShutterFraction,
			connectZooms,
			zoomInDurationMs,
			zoomInOverlapMs,
			zoomOutDurationMs,
			connectedZoomGapMs,
			connectedZoomDurationMs,
			zoomInEasing,
			zoomOutEasing,
			connectedZoomEasing,
			effectiveShowCursor,
			cursorStyle,
			effectiveCursorTelemetry,
			cursorSize,
			cursorSmoothing,
			cursorSpringStiffnessMultiplier,
			cursorSpringDampingMultiplier,
			cursorSpringMassMultiplier,
			cameraSpringStiffnessMultiplier,
			cameraSpringDampingMultiplier,
			cameraSpringMassMultiplier,
			zoomSmoothness,
			zoomClassicMode,
			cursorMotionBlur,
			cursorClickBounce,
			cursorClickBounceDuration,
			cursorSway,
			cameraPerspectiveTilt,
			audioRegions,
			audioDuckingSettings,
			clipRegions,
			audio.sourceAudioFallbackPaths,
			audio.sourceAudioFallbackStartDelayMsByPath,
			audio.activeSourceAudioTrackSettings,
			audio.selectedClipSourceAudioTrackSettings,
			exportEncodingMode,
			exportBackendPreference,
			exportPipelineModel,
			experimentalNvidiaCudaExport,
			nvidiaCudaExportAvailable,
			borderRadius,
			padding,
			cropRegion,
			webcam,
			layoutRegions,
			resolvedWebcamVideoUrl,
			annotationRegions,
			isPlaying,
			exportQuality,
			effectiveZoomRegions,
			ensureSupportedMp4SourceDimensions,
			markExportAsSaving,
			mp4FrameRate,
			remountPreview,
			showExportSuccessToast,
			smokeExportConfig.backendPreference,
			smokeExportConfig.renderBackend,
			smokeExportConfig.enabled,
			smokeExportConfig.useNativeExport,
			smokeExportConfig.maxDecodeQueue,
			smokeExportConfig.maxEncodeQueue,
			smokeExportConfig.maxPendingFrames,
			smokeExportConfig.outputPath,
			smokeExportConfig.pipelineModel,
			smokeExportConfig.shadowIntensity,
			effectiveSpeedRegions,
			frame,
			selectedClipId,
			smokeExportConfig.encodingMode,
			smokeExportConfig.fps,
			smokeExportConfig.quality,
			saveBlobExport,
		],
	);

	useEffect(() => {
		smokeExportReadyStateRef.current = {
			cursorTelemetrySourcePath,
			duration,
			hasVideoPath: Boolean(videoPath),
			isPreviewReady,
			loading,
			projectPath: smokeExportConfig.projectPath ?? null,
			videoSourcePath,
		};
	}, [
		cursorTelemetrySourcePath,
		duration,
		isPreviewReady,
		loading,
		smokeExportConfig.projectPath,
		videoPath,
		videoSourcePath,
	]);

	useEffect(() => {
		if (!smokeExportConfig.enabled) {
			return;
		}

		const timeoutId = window.setTimeout(() => {
			if (smokeExportStartedRef.current) {
				return;
			}

			smokeExportStartedRef.current = true;
			void writeSmokeExportReport(smokeExportConfig.outputPath, {
				success: false,
				phase: "ready",
				error: `Smoke export did not become ready within ${SMOKE_EXPORT_READY_TIMEOUT_MS}ms.`,
				readyState: smokeExportReadyStateRef.current,
			}).finally(() => window.close());
		}, SMOKE_EXPORT_READY_TIMEOUT_MS);

		return () => window.clearTimeout(timeoutId);
	}, [smokeExportConfig.enabled, smokeExportConfig.outputPath]);

	useEffect(() => {
		if (!smokeExportConfig.enabled || smokeExportStartedRef.current) {
			return;
		}

		if (error) {
			smokeExportStartedRef.current = true;
			console.error(`[smoke-export] ${error}`);
			void writeSmokeExportReport(smokeExportConfig.outputPath, {
				success: false,
				phase: "load",
				error,
				readyState: smokeExportReadyStateRef.current,
			}).finally(() => window.close());
			return;
		}

		if (!videoPath || loading || !isPreviewReady || duration <= 0) {
			return;
		}

		// When smoke-export opens a .recordly project, the cursor telemetry
		// sidecar is loaded asynchronously after the editor state applies.
		// Without this gate the auto-export fires before telemetry arrives and
		// produces a video with no cursor/zoom animations.
		if (
			smokeExportConfig.projectPath &&
			videoSourcePath &&
			cursorTelemetrySourcePath !== videoSourcePath
		) {
			return;
		}

		smokeExportStartedRef.current = true;
		void handleExport({
			format: "mp4",
			quality: "good",
			encodingMode: smokeExportConfig.encodingMode ?? "balanced",
		});
	}, [
		cursorTelemetrySourcePath,
		error,
		handleExport,
		isPreviewReady,
		loading,
		duration,
		smokeExportConfig.enabled,
		smokeExportConfig.encodingMode,
		smokeExportConfig.outputPath,
		smokeExportConfig.projectPath,
		videoPath,
		videoSourcePath,
	]);

	const handleOpenExportDropdown = useCallback(() => {
		if (!videoPath) {
			toast.error("No video loaded");
			return;
		}

		if (hasPendingExportSave) {
			setShowExportDropdown(true);
			setExportError("Save dialog canceled. Click Save Again to save without re-rendering.");
			return;
		}
		setShowExportDropdown(true);
		setExportProgress(null);
		setExportError(null);
	}, [videoPath, hasPendingExportSave]);

	const handleStartExportFromDropdown = useCallback(() => {
		const video = videoPlaybackRef.current?.video;
		if (!videoPath) {
			toast.error("No video loaded");
			return;
		}
		if (!video) {
			toast.error("Video not ready");
			return;
		}

		const sourceWidth = video.videoWidth || 1920;
		const sourceHeight = video.videoHeight || 1080;
		const settings = resolveExportStartSettings({
			sourceWidth,
			sourceHeight,
			exportFormat,
			exportEncodingMode,
			exportQuality,
			mp4FrameRate,
			exportBackendPreference,
			exportPipelineModel,
			gifFrameRate,
			gifLoop,
			gifSizePreset,
		});

		setExportError(null);
		setExportedFilePath(undefined);
		setShowExportDropdown(true);
		handleExport(settings);
	}, [
		videoPath,
		exportFormat,
		exportEncodingMode,
		exportQuality,
		mp4FrameRate,
		gifFrameRate,
		gifLoop,
		gifSizePreset,
		exportBackendPreference,
		exportPipelineModel,
		handleExport,
	]);

	const handleCancelExport = useCallback(() => {
		if (exporterRef.current) {
			exporterRef.current.cancel();
			toast.info("Export canceled");
			clearPendingExportSave();
			setShowExportDropdown(false);
			setIsExporting(false);
			setExportProgress(null);
			setExportError(null);
			setExportedFilePath(undefined);
		}
	}, [clearPendingExportSave]);

	const handleExportDropdownClose = useCallback(() => {
		clearPendingExportSave();
		setShowExportDropdown(false);
		setExportProgress(null);
		setExportError(null);
		setExportedFilePath(undefined);
	}, [clearPendingExportSave]);

	const handleRetrySaveExport = useCallback(async () => {
		const pendingSave = pendingExportSaveRef.current;
		if (!pendingSave) {
			return;
		}

		let saveResult: {
			success: boolean;
			path?: string;
			message?: string;
			canceled?: boolean;
		};

		if (pendingSave.tempFilePath) {
			saveResult = await window.electronAPI.finalizeExportedVideo({
				tempPath: pendingSave.tempFilePath,
				fileName: pendingSave.fileName,
				outputPath: null,
			});
		} else if (pendingSave.arrayBuffer) {
			saveResult = await window.electronAPI.saveExportedVideo(
				pendingSave.arrayBuffer,
				pendingSave.fileName,
			);
		} else {
			saveResult = { success: false, message: "No pending export to save" };
		}

		if (saveResult.canceled) {
			setExportError("Save dialog canceled. Click Save Again to save without re-rendering.");
			toast.info("Save canceled. You can try again.");
			return;
		}

		if (saveResult.success && saveResult.path) {
			// finalizeExportedVideo already moved the temp file into place, so the
			// pending-save entry no longer refers to a file on disk. Flip the flag
			// directly to avoid clearPendingExportSave issuing a spurious discard.
			pendingExportSaveRef.current = null;
			setHasPendingExportSave(false);
			setExportError(null);
			setExportedFilePath(saveResult.path);
			showExportSuccessToast(saveResult.path);
			setShowExportDropdown(true);
			return;
		}

		const errorMessage = saveResult.message || "Failed to save video";
		setExportError(errorMessage);
		toast.error(errorMessage);
	}, [showExportSuccessToast]);

	const handleOpenCropEditor = useCallback(() => {
		cropSnapshotRef.current = { ...cropRegion };
		setShowCropModal(true);
	}, [cropRegion]);

	const handleCloseCropEditor = useCallback(() => {
		setShowCropModal(false);
	}, []);

	const handleCancelCropEditor = useCallback(() => {
		if (cropSnapshotRef.current) {
			setCropRegion(cropSnapshotRef.current);
		}
		setShowCropModal(false);
	}, []);

	const isCropped = useMemo(() => {
		const top = Math.round(cropRegion.y * 100);
		const left = Math.round(cropRegion.x * 100);
		const bottom = Math.round((1 - cropRegion.y - cropRegion.height) * 100);
		const right = Math.round((1 - cropRegion.x - cropRegion.width) * 100);
		return top > 0 || left > 0 || bottom > 0 || right > 0;
	}, [cropRegion]);

	const revealExportedFile = useCallback(async () => {
		if (!exportedFilePath) return;

		try {
			const result = await window.electronAPI.revealInFolder(exportedFilePath);
			if (!result.success) {
				toast.error(result.error || result.message || "Failed to reveal item in folder.");
			}
		} catch (error) {
			toast.error(`Failed to reveal item in folder: ${String(error)}`);
		}
	}, [exportedFilePath]);

	const handleOpenExportedVideo = useCallback(async () => {
		if (!exportedFilePath) return;
		try {
			const result = await window.electronAPI.openPath(exportedFilePath);
			if (!result.success) {
				toast.error(result.error || "Failed to open exported file.");
			}
		} catch (error) {
			toast.error(`Failed to open exported file: ${String(error)}`);
		}
	}, [exportedFilePath]);

	const handleCopyExportedPath = useCallback(async () => {
		if (!exportedFilePath) return;
		try {
			await navigator.clipboard.writeText(exportedFilePath);
			toast.success(t("editor.exportStatus.pathCopied", "File path copied to clipboard!"));
		} catch (error) {
			toast.error(`Failed to copy path: ${String(error)}`);
		}
	}, [exportedFilePath, t]);

	const handleSelectQuickPreset = useCallback((preset: ExportQuickPreset) => {
		setExportFormat(preset.format);
		if (preset.format === "mp4") {
			if (preset.quality) setExportQuality(preset.quality);
			if (preset.mp4FrameRate) setMp4FrameRate(preset.mp4FrameRate);
			if (preset.encodingMode) setExportEncodingMode(preset.encodingMode);
		} else if (preset.format === "gif" && preset.gifConfig) {
			setGifFrameRate(preset.gifConfig.frameRate);
			setGifSizePreset(preset.gifConfig.sizePreset);
			setGifLoop(preset.gifConfig.loop);
		}
		toast.success(`Preset applied: ${preset.name}`);
	}, []);

	const openLightningIssues = useCallback(async () => {
		await openExternalLink(
			RECORDLY_ISSUES_URL,
			t("editor.feedback.openFailed", "Failed to open link."),
		);
	}, [t]);

	const {
		isExportSaving,
		isExportPreparing,
		isExportFinalizing,
		isRenderingAudio,
		exportFinalizingProgress,
		exportFinalizingPercent,
		isExportFinalSaveIndeterminate,
		isLightningExportInProgress,
		shouldSuspendPreviewRendering,
		isLegacyExportInProgress,
		renderSpeedFps,
		runtimeLabel: exportRuntimeLabel,
		nativeSkipLabel: exportNativeSkipLabel,
	} = resolveExportStatusModel({
		isExporting,
		exportProgress,
		exportFormat,
		exportPipelineModel,
	});
	const exportRenderSpeedLabel = renderSpeedFps
		? t("editor.exportStatus.renderSpeed", "Render speed {{fps}} FPS", {
				fps: renderSpeedFps,
			})
		: null;
	const exportPercentLabel = exportProgress
		? isExportPreparing
			? t("editor.exportStatus.preparing", "Preparing export...")
			: isExportSaving
				? t("editor.exportStatus.saving", "Opening save dialog...")
				: isRenderingAudio
					? t("editor.exportStatus.renderingAudio", "Rendering audio {{percent}}%", {
							percent: Math.round((exportProgress.audioProgress ?? 0) * 100),
						})
					: isExportFinalizing
						? exportFormat === "mp4" && exportPipelineModel === "modern"
							? isExportFinalSaveIndeterminate
								? t(
										"editor.exportStatus.muxingAndSaving",
										"Muxing audio and saving file...",
									)
								: t(
										"editor.exportStatus.muxingAndSavingPercent",
										"Muxing and saving {{percent}}%",
										{
											percent: exportFinalizingPercent ?? 100,
										},
									)
							: t(
									"editor.exportStatus.finalizingPercent",
									"Finalizing {{percent}}%",
									{
										percent: exportFinalizingPercent ?? 100,
									},
								)
						: t("editor.exportStatus.completePercent", "{{percent}}% complete", {
								percent: Math.round(exportProgress.percentage),
							})
		: t("editor.exportStatus.preparing", "Preparing export...");

	const projectBrowser = (
		<ProjectBrowserDialog
			open={projectBrowserOpen}
			onOpenChange={setProjectBrowserOpen}
			entries={projectLibraryEntries}
			anchorRef={error ? projectBrowserFallbackTriggerRef : projectBrowserTriggerRef}
			onOpenProject={(projectPath) => {
				void handleOpenProjectFromLibrary(projectPath);
			}}
		/>
	);
	const nativeCaptureUnavailableDialog = (
		<Dialog
			open={nativeCaptureUnavailableModalOpen}
			onOpenChange={setNativeCaptureUnavailableModalOpen}
		>
			<DialogContent className="max-w-md bg-editor-dialog border-foreground/10 text-foreground">
				<DialogHeader>
					<DialogTitle>
						{t(
							"editor.nativeCaptureUnavailable.title",
							"Nothing’s broken, but we won’t be able to render an animated cursor overlay.",
						)}
					</DialogTitle>
					<DialogDescription className="text-muted-foreground">
						{t(
							"editor.nativeCaptureUnavailable.description",
							"Your device does not support native capture. This could be for a variety of reasons we haven’t figured out yet. This doesn’t break Captr Studio, but it does make cursor smoothing impossible.",
						)}
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button onClick={() => setNativeCaptureUnavailableModalOpen(false)}>
						{t("editor.nativeCaptureUnavailable.confirm", "Okay")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);

	if (loading) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<div className="text-foreground">Loading video...</div>
				{projectBrowser}
				{nativeCaptureUnavailableDialog}
				<Toaster className="pointer-events-auto" />
			</div>
		);
	}
	if (error) {
		return (
			<div className="flex h-screen items-center justify-center bg-background">
				<div className="flex flex-col items-center gap-3">
					<div className="text-destructive">{error}</div>
					<button
						ref={projectBrowserFallbackTriggerRef}
						type="button"
						onClick={handleOpenProjectBrowser}
						className="rounded-[5px] bg-neutral-800 px-3 py-1.5 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(0,0,0,0.18)] transition-colors hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-white/90"
					>
						Open Projects
					</button>
				</div>
				{projectBrowser}
				{nativeCaptureUnavailableDialog}
				<Toaster className="pointer-events-auto" />
			</div>
		);
	}

	if (viewMode === "welcome" && !loading && !error) {
		const hasActiveProject = Boolean(videoPath || clips.length > 0 || currentProjectPath);
		return (
			<div className="relative flex h-screen w-screen flex-col bg-editor-bg text-foreground overflow-hidden selection:bg-[#2563EB]/30">
				<WelcomeScreen
					onNewProject={(aspectRatio) => void handleNewProject(aspectRatio)}
					onOpenProjectFile={() => void handleLoadProjectFile()}
					onOpenRecentProject={(path) => void handleOpenProjectFromLibrary(path)}
					onOpenRecorderHud={() => void handleOpenRecorderHud()}
					recentProjects={projectLibraryEntries}
					onRefreshProjects={refreshProjectLibrary}
					onOpenSettings={handleOpenSettings}
					onOpenShortcuts={openConfig}
					isMac={isMac}
					onClose={hasActiveProject ? () => setViewMode("editor") : undefined}
				/>
				<AppSettingsDialog
					open={isSettingsOpen}
					onOpenChange={setIsSettingsOpen}
					defaultTab={settingsDefaultTab}
					onOpenShortcuts={openConfig}
				/>
				{nativeCaptureUnavailableDialog}
				<Toaster className="pointer-events-auto" />
			</div>
		);
	}

	return (
		<div className="flex flex-col h-screen bg-editor-bg text-foreground overflow-hidden selection:bg-[#2563EB]/30">
			<div
				className="relative flex h-11 flex-shrink-0 items-center justify-between bg-editor-header/88 px-5 backdrop-blur-md border-b border-foreground/10 z-50"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			>
				<div
					className={`flex items-center gap-1.5 justify-self-start ${headerLeftControlsPaddingClass}`}
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					<button
						type="button"
						onClick={() => void handleNavigateToWelcome()}
						className="flex items-center pl-0.5 pr-1 cursor-pointer transition-transform hover:scale-105 outline-none"
						title="Return to Welcome Screen (Alt+Home)"
					>
						<CaptrLogo
							variant="icon"
							size={24}
							className="rounded-lg drop-shadow-sm"
						/>
					</button>

					{/* Windows Menu Bar */}
					<EditorMenuBar
						onNewProject={() => void handleNewProject()}
						onOpenProjectFile={() => void handleLoadProjectFile()}
						onOpenRecentProject={(path) => void handleOpenProjectFromLibrary(path)}
						recentProjects={projectLibraryEntries}
						onSaveProject={() => void saveProject(false)}
						onSaveAsProject={() => void saveProject(true)}
						onImportMedia={() => void handleImportVideoClip()}
						onExportVideo={() => setShowExportDropdown(true)}
						onNavigateToWelcome={() => void handleNavigateToWelcome()}
						canUndo={canUndo}
						canRedo={canRedo}
						onUndo={handleUndo}
						onRedo={handleRedo}
						onSplitClip={() => {
							if (selectedClipId) {
								handleClipSplit(currentTime * 1000);
							}
						}}
						onDeleteClip={() => {
							if (selectedClipId) {
								handleClipDelete(selectedClipId);
							}
						}}
						onSelectAllClips={() => {
							if (clips.length > 0) {
								handleSelectClip(clips[0].id);
							}
						}}
						showSocialSafeZone={showSocialSafeZone}
						onToggleSocialSafeZone={() => setShowSocialSafeZone(!showSocialSafeZone)}
						onOpenSettings={handleOpenSettings}
						onOpenShortcuts={openConfig}
						onOpenProjectsFolder={() => void window.electronAPI?.openProjectsDirectory?.()}
						onOpenRecordingsFolder={() => void window.electronAPI?.openRecordingsFolder?.()}
						isMac={isMac}
					/>

					<div className="ml-1 h-4 w-px bg-foreground/10" />

					<Button
						ref={projectBrowserTriggerRef}
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleOpenProjectBrowser}
						className={APP_HEADER_ICON_BUTTON_CLASS}
						title={t("editor.project.projects", "Open projects")}
						aria-label={t("editor.project.projects", "Open projects")}
					>
						<FolderOpen className="h-4 w-4" />
					</Button>
					<DiscordLinkButton />
					<FeedbackDialog />
					<div className="ml-1 h-5 w-px bg-foreground/10" />
					<Button
						type="button"
						variant="ghost"
						onClick={handleUndo}
						disabled={!canUndo}
						className="inline-flex h-8 w-8 items-center justify-center rounded-[5px] border border-foreground/10 bg-foreground/5 p-0 text-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
						title={t("common.actions.undo", "Undo")}
						aria-label={t("common.actions.undo", "Undo")}
					>
						<Undo2 className="h-4 w-4" />
					</Button>
					<Button
						type="button"
						variant="ghost"
						onClick={handleRedo}
						disabled={!canRedo}
						className="inline-flex h-8 w-8 items-center justify-center rounded-[5px] border border-foreground/10 bg-foreground/5 p-0 text-foreground transition-colors hover:bg-foreground/10 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
						title={t("common.actions.redo", "Redo")}
						aria-label={t("common.actions.redo", "Redo")}
					>
						<Redo2 className="h-4 w-4" />
					</Button>
				</div>
				<div
					className="absolute left-1/2 flex min-w-0 -translate-x-1/2 items-center justify-center"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					{isEditingProjectName ? (
						<form
							onSubmit={(event) => void handleProjectNameSubmit(event)}
							className="flex max-w-[min(52vw,460px)] items-baseline gap-1 rounded-[7px] border border-foreground/10 bg-editor-panel/[0.88] px-2.5 py-1 shadow-[0_10px_28px_rgba(0,0,0,0.18)]"
						>
							{hasUnsavedChanges ? (
								<span className="mt-[1px] size-2 shrink-0 rounded-full bg-[#2563EB]" />
							) : null}
							<input
								ref={projectNameInputRef}
								type="text"
								value={projectNameDraft}
								onChange={(event) => setProjectNameDraft(event.target.value)}
								onBlur={() => {
									if (!isSavingProjectName) {
										closeProjectNameEditor();
									}
								}}
								onKeyDown={(event) => {
									if (event.key === "Escape") {
										event.preventDefault();
										closeProjectNameEditor();
									}
								}}
								disabled={isSavingProjectName}
								className="min-w-[10ch] max-w-[min(40vw,360px)] bg-transparent text-sm font-semibold tracking-tight text-foreground/95 outline-none placeholder:text-muted-foreground/60 disabled:cursor-wait"
								style={{ width: `${Math.max(projectNameDraft.length, 10)}ch` }}
								aria-label={t("editor.project.renameInput", "Project name")}
							/>
							<span className="shrink-0 text-xs font-medium tracking-tight text-muted-foreground/70">
								.captr
							</span>
						</form>
					) : (
						<button
							type="button"
							onClick={() => setIsEditingProjectName(true)}
							className="inline-flex max-w-[min(52vw,460px)] items-baseline gap-1 rounded-[7px] px-2.5 py-1 transition-colors hover:bg-foreground/5"
							title={t("editor.project.renameTitle", "Rename project")}
							aria-label={t("editor.project.renameTitle", "Rename project")}
						>
							{hasUnsavedChanges ? (
								<span className="mt-[1px] size-2 shrink-0 rounded-full bg-[#2563EB]" />
							) : null}
							<span className="truncate text-sm font-semibold tracking-tight text-foreground/90">
								{projectDisplayName}
							</span>
							<span className="shrink-0 text-xs font-medium tracking-tight text-muted-foreground/70">
								.captr
							</span>
						</button>
					)}
				</div>
				<div
					className="flex items-center justify-self-end pr-3"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					<Popover open={presetPopoverOpen} onOpenChange={setPresetPopoverOpen}>
						<PopoverTrigger asChild>
							<button
								type="button"
								title={t("editor.presets.open", "Open presets")}
								aria-label={t("editor.presets.open", "Open presets")}
								className="inline-flex items-center gap-1.5 bg-transparent p-0 text-sm font-medium tracking-tight text-foreground outline-none transition-opacity hover:opacity-80"
							>
								<span className="flex items-center gap-1.5">
									<BookmarkSimple weight="fill" className="h-4 w-4" />
									<span>
										{currentEditorPreset?.name ??
											t("editor.presets.label", "Presets")}
									</span>
								</span>
								<ChevronDown className="h-3.5 w-3.5 text-foreground" />
							</button>
						</PopoverTrigger>
						<PopoverContent
							align="end"
							sideOffset={10}
							className="w-[300px] rounded-2xl border border-foreground/10 bg-editor-surface-alt p-3 shadow-xl"
						>
							<div className="space-y-3">
								<form
									onSubmit={(event) => {
										event.preventDefault();
										handleSavePresetSubmit();
									}}
									className="space-y-2"
								>
									<p className="text-[11px] font-medium text-foreground">
										{t(
											"editor.presets.saveCurrentAs",
											"Save current preset as",
										)}
									</p>
									<div className="flex items-center gap-2">
										<Input
											value={presetNameDraft}
											onChange={(event) =>
												setPresetNameDraft(event.target.value)
											}
											className="h-9 rounded-xl border-foreground/10 bg-background/70 text-sm"
											placeholder={t(
												"editor.presets.namePlaceholder",
												"Preset name",
											)}
											aria-label={t(
												"editor.presets.namePlaceholder",
												"Preset name",
											)}
										/>
										<Button
											type="submit"
											size="sm"
											className="h-9 rounded-xl bg-[#2563EB] px-3 text-white hover:bg-[#1d4ed8]"
										>
											{t("common.actions.save", "Save")}
										</Button>
									</div>
								</form>

								<div className="space-y-2">
									<p className="text-[11px] font-medium text-foreground">
										{t("editor.presets.savedList", "Saved presets")}
									</p>
									<div className="max-h-56 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
										{editorPresets.length === 0 ? (
											<div className="rounded-xl border border-dashed border-foreground/10 px-3 py-4 text-center text-[11px] text-muted-foreground">
												{t("editor.presets.empty", "No presets yet.")}
											</div>
										) : (
											editorPresets.map((preset) => {
												const isActive =
													preset.id === currentEditorPreset?.id;
												return (
													<div
														key={preset.id}
														className={cn(
															"flex items-center gap-2 rounded-xl border px-2 py-2 text-sm transition-colors",
															isActive
																? "border-[#2563EB]/20 bg-[#2563EB]/10 text-foreground"
																: "border-foreground/8 bg-foreground/[0.03] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
														)}
													>
														<button
															type="button"
															onClick={() =>
																handleApplyEditorPreset(preset.id)
															}
															className="flex min-w-0 flex-1 items-center justify-between text-left"
														>
															<span className="truncate pr-3">
																{preset.name}
															</span>
															{isActive ? (
																<Check className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" />
															) : null}
														</button>
														<button
															type="button"
															onClick={() =>
																handleDeleteEditorPreset(preset.id)
															}
															className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/8 hover:text-foreground"
															aria-label={t(
																"editor.presets.deleteAriaLabel",
																"Delete preset {{name}}",
																{ name: preset.name },
															)}
															title={t(
																"editor.presets.deleteAriaLabel",
																"Delete preset {{name}}",
																{ name: preset.name },
															)}
														>
															<X className="h-3.5 w-3.5" />
														</button>
													</div>
												);
											})
										)}
									</div>
								</div>
							</div>
						</PopoverContent>
					</Popover>

					<div aria-hidden="true" className="mx-2 h-4 w-px shrink-0 bg-foreground/10" />
					<DropdownMenu
						open={showExportDropdown}
						onOpenChange={setShowExportDropdown}
						modal={false}
					>
						<DropdownMenuTrigger asChild>
							<Button
								type="button"
								onClick={handleOpenExportDropdown}
								className="inline-flex h-8 min-w-[112px] items-center justify-center gap-2 rounded-[5px] bg-[#2563EB] px-4.5 text-white transition-colors hover:bg-[#2563EB]/92"
							>
								<Download className="h-4 w-4" />
								<span className="text-sm font-semibold tracking-tight">
									{t("common.actions.export", "Export")}
								</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							sideOffset={10}
							className="w-[360px] border-none bg-transparent p-0 shadow-none"
						>
							{isExporting ? (
								<div className="rounded-2xl border border-foreground/10 bg-editor-surface p-4 text-foreground shadow-2xl">
									<div className="mb-3 flex items-center justify-between gap-3">
										<div>
											<p className="text-sm font-semibold text-foreground">
												{t("editor.exportStatus.exporting", "Exporting")}
											</p>
											<p className="text-xs text-muted-foreground">
												{t(
													"editor.exportStatus.renderingFile",
													"Rendering your file.",
												)}
											</p>
											{isLightningExportInProgress ? (
												<p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground/70">
													PLEASE
													<button
														type="button"
														onClick={() => void openLightningIssues()}
														className="underline decoration-slate-500/70 underline-offset-2 transition-colors hover:text-foreground"
													>
														report bugs
													</button>
													with Lightning export
													<span aria-hidden="true">{"\u{1F64F}"}</span>
												</p>
											) : null}
											{isLegacyExportInProgress ? (
												<p className="mt-1 text-[11px] text-muted-foreground/70">
													Export too slow? Cancel and try Lightning
													export!
												</p>
											) : null}
										</div>
										<Button
											type="button"
											variant="outline"
											onClick={handleCancelExport}
											className="h-8 border-red-500/20 bg-red-500/10 px-3 text-xs text-red-400 hover:bg-red-500/20"
										>
											{t("common.actions.cancel")}
										</Button>
									</div>
									<div className="h-2 overflow-hidden rounded-full border border-foreground/5 bg-foreground/5">
										{isExportPreparing ||
										isExportSaving ||
										isExportFinalSaveIndeterminate ? (
											<div className="indeterminate-progress h-full rounded-full bg-transparent" />
										) : (
											<div
												className="h-full bg-[#2563EB] transition-all duration-300 ease-out"
												style={{
													width: `${Math.min(isRenderingAudio ? (exportProgress?.audioProgress ?? 0) * 100 : (exportFinalizingProgress ?? exportProgress?.percentage ?? 8), 100)}%`,
												}}
											/>
										)}
									</div>
									<p className="mt-2 text-xs text-muted-foreground">
										{exportPercentLabel}
									</p>
									{isRenderingAudio ? (
										<p className="mt-1 text-[11px] text-muted-foreground/70">
											{t(
												"editor.export.processingAudioEdits",
												"Processing audio with speed/overlay edits",
											)}
										</p>
									) : exportRenderSpeedLabel ? (
										<p className="mt-1 text-[11px] text-muted-foreground/70">
											{exportRenderSpeedLabel}
										</p>
									) : null}
									{exportRuntimeLabel ? (
										<p className="mt-1 text-[11px] text-muted-foreground/70">
											Path: {exportRuntimeLabel}
										</p>
									) : null}
									{exportNativeSkipLabel ? (
										<p className="mt-1 text-[11px] text-amber-500/80">
											{exportNativeSkipLabel}
										</p>
									) : null}
								</div>
							) : exportError ? (
								<div className="rounded-2xl border border-foreground/10 bg-editor-surface p-4 text-foreground shadow-2xl">
									<p className="text-sm font-semibold text-foreground">
										{t("editor.exportStatus.issue", "Export issue")}
									</p>
									{exportRuntimeLabel ? (
										<p className="mt-1 text-[11px] text-muted-foreground/70">
											Path: {exportRuntimeLabel}
										</p>
									) : null}
									<p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
										{exportError}
									</p>
									<div className="mt-4 flex gap-2">
										{hasPendingExportSave ? (
											<Button
												type="button"
												onClick={handleRetrySaveExport}
												className="h-8 flex-1 rounded-[5px] bg-[#2563EB] text-xs font-semibold text-white hover:bg-[#2563EB]/92"
											>
												{t("editor.actions.saveAgain", "Save Again")}
											</Button>
										) : null}
										<Button
											type="button"
											variant="outline"
											onClick={handleExportDropdownClose}
											className="h-8 flex-1 border-foreground/10 bg-foreground/5 text-xs text-muted-foreground hover:bg-foreground/10"
										>
											{t("common.actions.close", "Close")}
										</Button>
									</div>
								</div>
							) : exportedFilePath ? (
								<div className="rounded-2xl border border-foreground/10 bg-editor-surface p-4 text-foreground shadow-2xl">
									<p className="text-sm font-semibold text-foreground">
										{t("editor.exportStatus.complete", "Export complete")}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{t(
											"editor.exportStatus.savedSuccessfully",
											"Your file was saved successfully.",
										)}
									</p>
									{exportRuntimeLabel ? (
										<p className="mt-1 text-[11px] text-muted-foreground/70">
											Path: {exportRuntimeLabel}
										</p>
									) : null}
									<p className="mt-3 truncate text-xs text-muted-foreground/70">
										{exportedFilePath.split("/").pop()}
									</p>
									<div className="mt-4 grid grid-cols-2 gap-2">
										<Button
											type="button"
											onClick={handleOpenExportedVideo}
											className="h-8 rounded-[5px] bg-[#2563EB] text-xs font-semibold text-white hover:bg-[#2563EB]/92"
										>
											<Play className="mr-1.5 h-3.5 w-3.5" weight="bold" />
											{t("editor.actions.openVideo", "Open Video")}
										</Button>
										<Button
											type="button"
											variant="outline"
											onClick={revealExportedFile}
											className="h-8 border-foreground/10 bg-foreground/5 text-xs font-medium text-foreground hover:bg-foreground/10"
										>
											<FolderOpen className="mr-1.5 h-3.5 w-3.5" />
											{t("editor.actions.showInFolder", "Show In Folder")}
										</Button>
										<Button
											type="button"
											variant="outline"
											onClick={handleCopyExportedPath}
											className="h-8 border-foreground/10 bg-foreground/5 text-xs font-medium text-foreground hover:bg-foreground/10"
										>
											<Copy className="mr-1.5 h-3.5 w-3.5" />
											{t("editor.actions.copyPath", "Copy Path")}
										</Button>
										<Button
											type="button"
											variant="outline"
											onClick={handleExportDropdownClose}
											className="h-8 border-foreground/10 bg-foreground/5 text-xs text-muted-foreground hover:bg-foreground/10"
										>
											{t("common.actions.done", "Done")}
										</Button>
									</div>
								</div>
							) : (
								<ExportSettingsMenu
									exportFormat={exportFormat}
									onExportFormatChange={setExportFormat}
									exportEncodingMode={exportEncodingMode}
									onExportEncodingModeChange={setExportEncodingMode}
									mp4FrameRate={mp4FrameRate}
									onMp4FrameRateChange={setMp4FrameRate}
									exportPipelineModel={exportPipelineModel}
									onExportPipelineModelChange={setExportPipelineModel}
									experimentalNvidiaCudaExport={
										experimentalNvidiaCudaExport && nvidiaCudaExportAvailable
									}
									onExperimentalNvidiaCudaExportChange={
										setExperimentalNvidiaCudaExport
									}
									nvidiaCudaExportAvailable={nvidiaCudaExportAvailable}
									gpuEncoders={gpuEncoders}
									exportQuality={exportQuality}
									onExportQualityChange={setExportQuality}
									gifFrameRate={gifFrameRate}
									onGifFrameRateChange={setGifFrameRate}
									gifLoop={gifLoop}
									onGifLoopChange={setGifLoop}
									gifSizePreset={gifSizePreset}
									onGifSizePresetChange={setGifSizePreset}
									mp4OutputDimensions={mp4OutputDimensions}
									gifOutputDimensions={gifOutputDimensions}
									onSelectQuickPreset={handleSelectQuickPreset}
									onExport={handleStartExportFromDropdown}
									className="shadow-2xl"
								/>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
					{!isMac && (
						<>
							<div aria-hidden="true" className="mx-2 h-4 w-px shrink-0 bg-foreground/10" />
							<div className="flex items-center gap-1">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => void window.electronAPI?.minimizeWindow?.()}
									className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-lg transition-colors"
									title="Minimize"
									aria-label="Minimize"
								>
									<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2">
										<line x1="1" y1="5.5" x2="10" y2="5.5" />
									</svg>
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={async () => {
										const res = await window.electronAPI?.maximizeWindow?.();
										if (res && typeof res.isMaximized === "boolean") {
											setIsEditorMaximized(res.isMaximized);
										}
									}}
									className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-lg transition-colors"
									title={isEditorMaximized ? "Restore" : "Maximize"}
									aria-label={isEditorMaximized ? "Restore" : "Maximize"}
								>
									{isEditorMaximized ? (
										<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2">
											<rect x="1.5" y="3.5" width="6.5" height="6.5" rx="1" />
											<path d="M3.5 3.5V2C3.5 1.45 3.95 1 4.5 1H9C9.55 1 10 1.45 10 2V6.5C10 7.05 9.55 7.5 9 7.5H7.5" />
										</svg>
									) : (
										<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2">
											<rect x="1" y="1" width="9" height="9" rx="1" />
										</svg>
									)}
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => void window.electronAPI?.closeWindow?.()}
									className="h-7 w-7 p-0 text-muted-foreground hover:text-white hover:bg-red-500 rounded-lg transition-colors"
									title="Close"
									aria-label="Close"
								>
									<svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
										<line x1="1.5" y1="1.5" x2="9.5" y2="9.5" />
										<line x1="9.5" y1="1.5" x2="1.5" y2="9.5" />
									</svg>
								</Button>
							</div>
						</>
					)}
				</div>
			</div>

			<div className="relative flex min-h-0 flex-1 flex-col gap-3 p-4">
				<div className="flex min-h-0 flex-1 gap-3 relative z-10">
					{/* Left Column: Editor Function List (Top) + Function Panel (Middle) */}
					<div
						className="flex flex-col flex-shrink-0 rounded-2xl border border-foreground/10 bg-editor-surface/60 overflow-hidden shadow-lg backdrop-blur-md"
						style={{ width: sidebarWidth, minWidth: 260, maxWidth: 560 }}
					>
						{/* Editor Function List (Top Bar) */}
						<div className="flex items-center gap-1 border-b border-foreground/10 bg-editor-surface/90 px-2 py-2 overflow-x-auto custom-scrollbar flex-shrink-0">
							{editorSectionButtons.map((section) => {
								const isActive = activeEffectSection === section.id;
								return (
									<button
										key={section.id}
										type="button"
										onClick={() => setActiveEffectSection(section.id)}
										title={section.label}
										className={cn(
											"flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
											isActive
												? "bg-[#2563EB] text-white shadow-sm font-semibold"
												: "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
										)}
									>
										<section.icon className="h-3.5 w-3.5" weight={isActive ? "fill" : "regular"} />
										<span className="text-[11px]">{section.label}</span>
									</button>
								);
							})}
						</div>

						{/* Function Panel (Middle Inspector) */}
						<div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
							<SettingsPanel
								panelMode="editor"
								className="w-full h-full border-none rounded-none shadow-none bg-transparent"
								activeEffectSection={activeEffectSection}
								slides={clips}
								onAddAsSlide={(filePath, label) => {
									void handleImportVideoClip(filePath, label);
								}}
								onImportMedia={() => void handleImportVideoClip()}
								onAudioAdded={handleAudioAdded}
								currentTime={currentTime}
								selected={wallpaper}
							onWallpaperChange={setWallpaper}
							selectedZoomDepth={
								selectedZoomId
									? zoomRegions.find((z) => z.id === selectedZoomId)?.depth
									: null
							}
							onZoomDepthChange={(depth) =>
								selectedZoomId && handleZoomDepthChange(depth)
							}
							selectedZoomId={selectedZoomId}
							selectedZoomMode={
								selectedZoomId
									? (zoomRegions.find((z) => z.id === selectedZoomId)?.mode ??
										"auto")
									: null
							}
							onZoomModeChange={(mode) =>
								selectedZoomId && handleZoomModeChange(mode)
							}
							onZoomDelete={handleZoomDelete}
							selectedClipId={selectedClipId}
							selectedClipSpeed={
								selectedClipId
									? (clipRegions.find((c) => c.id === selectedClipId)?.speed ?? 1)
									: null
							}
							selectedClipMuted={
								selectedClipId
									? (clipRegions.find((c) => c.id === selectedClipId)?.muted ??
										false)
									: null
							}
							selectedClipShowSourceAudio={
								selectedClipId
									? (clipRegions.find((c) => c.id === selectedClipId)
											?.showSourceAudio ?? false)
									: null
							}
							onClipSpeedChange={handleClipSpeedChange}
							onClipMutedChange={handleClipMutedChange}
							onClipShowSourceAudioChange={handleClipShowSourceAudioChange}
							onClipDelete={handleClipDelete}
							onClipRippleDelete={(id) => handleClipDelete(id, true)}
							selectedClipTransitionIn={
								selectedClipId
									? (clipRegions.find((c) => c.id === selectedClipId)
											?.transitionIn ?? "none")
									: "none"
							}
							selectedClipTransitionInDurationMs={
								selectedClipId
									? (clipRegions.find((c) => c.id === selectedClipId)
											?.transitionInDurationMs ?? 400)
									: 400
							}
							onClipTransitionInChange={handleClipTransitionInChange}
							onClipTransitionInDurationChange={handleClipTransitionInDurationChange}
							selectedLayoutId={selectedLayoutId}
							selectedLayoutPreset={
								selectedLayoutId
									? (layoutRegions.find(
											(region) => region.id === selectedLayoutId,
										)?.preset ?? null)
									: null
							}
							selectedLayoutTransitionMs={
								selectedLayoutId
									? (layoutRegions.find(
											(region) => region.id === selectedLayoutId,
										)?.transitionMs ?? null)
									: null
							}
							selectedLayoutEasing={
								selectedLayoutId
									? (layoutRegions.find(
											(region) => region.id === selectedLayoutId,
										)?.easing ?? null)
									: null
							}
							onLayoutPresetChange={handleLayoutPresetChange}
							onLayoutTransitionChange={handleLayoutTransitionChange}
							onLayoutEasingChange={handleLayoutEasingChange}
							onLayoutDelete={handleLayoutDelete}
							hasClipSourceAudio={hasClipSourceAudio}
							sourceAudioTrackMeta={audio.sourceAudioTrackMeta}
							sourceAudioTrackSettings={audio.selectedClipSourceAudioTrackSettings}
							onSourceAudioTrackVolumeChange={
								audio.onSelectedClipSourceAudioTrackVolumeChange
							}
							onSourceAudioTrackNormalizeChange={
								audio.onSelectedClipSourceAudioTrackNormalizeChange
							}
							selectedAudioId={selectedAudioId}
							selectedAudioVolume={
								selectedAudioId
									? (audioRegions.find((r) => r.id === selectedAudioId)?.volume ??
										null)
									: null
							}
							selectedAudioNormalize={
								selectedAudioId
									? (audioRegions.find((r) => r.id === selectedAudioId)
											?.normalize ?? false)
									: null
							}
							selectedAudioDucking={
								selectedAudioId
									? (audioRegions.find((r) => r.id === selectedAudioId)
											?.ducking ?? true)
									: null
							}
							onAudioVolumeChange={handleAudioVolumeChange}
							onAudioNormalizeChange={handleAudioNormalizeChange}
							onAudioDuckingChange={handleAudioDuckingChange}
							onAudioDelete={handleAudioDelete}
							audioDuckingSettings={audioDuckingSettings}
							onAudioDuckingSettingsChange={setAudioDuckingSettings}
							colorGrading={colorGrading}
							onColorGradingChange={setColorGrading}
							shadowIntensity={shadowIntensity}
							onShadowChange={setShadowIntensity}
							backgroundBlur={backgroundBlur}
							onBackgroundBlurChange={setBackgroundBlur}
							zoomMotionBlurTuning={zoomMotionBlurTuning}
							onZoomMotionBlurTuningChange={setZoomMotionBlurTuning}
							zoomTemporalMotionBlur={zoomTemporalMotionBlur}
							onZoomTemporalMotionBlurChange={setZoomTemporalMotionBlur}
							zoomMotionBlurSampleCount={zoomMotionBlurSampleCount}
							onZoomMotionBlurSampleCountChange={setZoomMotionBlurSampleCount}
							zoomMotionBlurShutterFraction={zoomMotionBlurShutterFraction}
							onZoomMotionBlurShutterFractionChange={setZoomMotionBlurShutterFraction}
							autoApplyFreshRecordingAutoZooms={autoApplyFreshRecordingAutoZooms}
							onAutoApplyFreshRecordingAutoZoomsChange={
								setAutoApplyFreshRecordingAutoZooms
							}
							connectZooms={connectZooms}
							onConnectZoomsChange={setConnectZooms}
							zoomInDurationMs={zoomInDurationMs}
							onZoomInDurationMsChange={setZoomInDurationMs}
							zoomInOverlapMs={zoomInOverlapMs}
							onZoomInOverlapMsChange={setZoomInOverlapMs}
							zoomOutDurationMs={zoomOutDurationMs}
							onZoomOutDurationMsChange={setZoomOutDurationMs}
							connectedZoomGapMs={connectedZoomGapMs}
							onConnectedZoomGapMsChange={setConnectedZoomGapMs}
							connectedZoomDurationMs={connectedZoomDurationMs}
							onConnectedZoomDurationMsChange={setConnectedZoomDurationMs}
							zoomInEasing={zoomInEasing}
							onZoomInEasingChange={setZoomInEasing}
							zoomOutEasing={zoomOutEasing}
							onZoomOutEasingChange={setZoomOutEasing}
							connectedZoomEasing={connectedZoomEasing}
							onConnectedZoomEasingChange={setConnectedZoomEasing}
							showCursor={effectiveShowCursor}
							onShowCursorChange={handleShowCursorChange}
							loopCursor={loopCursor}
							onLoopCursorChange={setLoopCursor}
							cursorStyle={cursorStyle}
							onCursorStyleChange={setCursorStyle}
							cursorSize={cursorSize}
							onCursorSizeChange={setCursorSize}
							cursorSmoothing={cursorSmoothing}
							onCursorSmoothingChange={setCursorSmoothing}
							cursorSpringStiffnessMultiplier={cursorSpringStiffnessMultiplier}
							onCursorSpringStiffnessMultiplierChange={
								setCursorSpringStiffnessMultiplier
							}
							cursorSpringDampingMultiplier={cursorSpringDampingMultiplier}
							onCursorSpringDampingMultiplierChange={setCursorSpringDampingMultiplier}
							cursorSpringMassMultiplier={cursorSpringMassMultiplier}
							onCursorSpringMassMultiplierChange={setCursorSpringMassMultiplier}
							cameraSpringStiffnessMultiplier={cameraSpringStiffnessMultiplier}
							onCameraSpringStiffnessMultiplierChange={
								setCameraSpringStiffnessMultiplier
							}
							cameraSpringDampingMultiplier={cameraSpringDampingMultiplier}
							onCameraSpringDampingMultiplierChange={setCameraSpringDampingMultiplier}
							cameraSpringMassMultiplier={cameraSpringMassMultiplier}
							onCameraSpringMassMultiplierChange={setCameraSpringMassMultiplier}
							zoomClassicMode={zoomClassicMode}
							onZoomClassicModeChange={setZoomClassicMode}
							cursorMotionBlur={cursorMotionBlur}
							onCursorMotionBlurChange={setCursorMotionBlur}
							cursorClickBounce={cursorClickBounce}
							onCursorClickBounceChange={setCursorClickBounce}
							cursorClickBounceDuration={cursorClickBounceDuration}
							onCursorClickBounceDurationChange={setCursorClickBounceDuration}
							cursorSway={cursorSway}
							onCursorSwayChange={setCursorSway}
							cameraPerspectiveTilt={cameraPerspectiveTilt}
							onCameraPerspectiveTiltChange={setCameraPerspectiveTilt}
							borderRadius={borderRadius}
							onBorderRadiusChange={setBorderRadius}
							webcam={webcam}
							webcamPreviewSrc={webcam.sourcePath ? resolvedWebcamVideoUrl : null}
							webcamPreviewCurrentTime={currentTime}
							webcamPreviewPlaying={isPlaying}
							onWebcamChange={setWebcam}
							onUploadWebcam={handleUploadWebcam}
							onClearWebcam={handleClearWebcam}
							padding={padding}
							onPaddingChange={setPadding}
							frame={frame}
							onFrameChange={setFrame}
							cropRegion={cropRegion}
							onCropChange={setCropRegion}
							aspectRatio={aspectRatio}
							onAspectRatioChange={setAspectRatio}
							selectedAnnotationId={selectedAnnotationId}
							annotationRegions={annotationRegions}
							nativeCaptureUnavailableSession={sessionNativeCaptureUnavailable}
							onOpenNativeCaptureUnavailableModal={() =>
								setNativeCaptureUnavailableModalOpen(true)
							}
							onAnnotationContentChange={handleAnnotationContentChange}
							onAnnotationTypeChange={handleAnnotationTypeChange}
							onAnnotationStyleChange={handleAnnotationStyleChange}
							onAnnotationFigureDataChange={handleAnnotationFigureDataChange}
							onAnnotationBlurIntensityChange={handleAnnotationBlurIntensityChange}
							onAnnotationBlurColorChange={handleAnnotationBlurColorChange}
							onAnnotationAnimationChange={handleAnnotationAnimationChange}
							onAnnotationLayerChange={handleAnnotationLayerChange}
							onAnnotationDelete={handleAnnotationDelete} 
						/>
						</div>

					</div>

					{/* Sidebar Horizontal Drag Splitter (VS Code style) */}
					<div
						role="separator"
						aria-orientation="vertical"
						tabIndex={0}
						title="Drag to resize sidebar (Double-click to reset)"
						onPointerDown={handleSidebarResizeStart}
						onDoubleClick={handleResetSidebarWidth}
						className={cn(
							"relative z-20 flex w-2 -mx-1 cursor-col-resize items-center justify-center group select-none transition-colors",
							isDraggingSidebar && "bg-transparent",
						)}
					>
						<div
							className={cn(
								"h-full w-[2px] rounded-full transition-all duration-150",
								isDraggingSidebar
									? "bg-[#2563EB] w-[3px] shadow-[0_0_8px_rgba(37,99,235,0.6)]"
									: "bg-foreground/[0.06] group-hover:bg-[#2563EB]/80 group-hover:w-[3px]",
							)}
						/>
					</div>

					{/* Right column: preview + toolbar */}
					<div className="flex min-h-0 flex-1 flex-col gap-3">
						{/* Preview */}
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="relative flex flex-1 min-h-0 flex-col overflow-hidden">
								{/* Aspect ratio + crop controls above preview */}
								<div className="flex items-center justify-center gap-2 py-1.5 flex-shrink-0">
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												variant="ghost"
												size="sm"
												className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all gap-1"
											>
												<span className="font-medium">
													{getAspectRatioLabel(aspectRatio)}
												</span>
												<ChevronDown className="w-3 h-3" />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent
											align="center"
											className="bg-editor-surface-alt border-foreground/10 min-w-[200px]"
										>
											{SOCIAL_ASPECT_RATIO_PRESETS.map((preset) => (
												<DropdownMenuItem
													key={preset.id}
													onClick={() => setAspectRatio(preset.id)}
													className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 cursor-pointer flex items-center justify-between gap-3"
												>
													<div className="flex flex-col gap-0.5">
														<span className="text-xs font-medium text-foreground/90">
															{preset.name}
														</span>
														<span className="text-[10px] text-muted-foreground/70">
															{preset.platformLabel}
														</span>
													</div>
													<div className="flex items-center gap-2">
														<span className="text-[10px] font-mono text-muted-foreground/60 bg-foreground/5 px-1.5 py-0.5 rounded">
															{preset.ratioLabel}
														</span>
														{aspectRatio === preset.id && (
															<Check className="w-3 h-3 text-[#2563EB]" />
														)}
													</div>
												</DropdownMenuItem>
											))}
										</DropdownMenuContent>
									</DropdownMenu>
									<div className="w-[1px] h-4 bg-foreground/20" />
									<Button
										variant="ghost"
										size="sm"
										onClick={handleAutoReframe}
										disabled={
											!normalizedCursorTelemetry.length || duration <= 0
										}
										className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all gap-1.5"
										title="Auto-Reframe: detect activity clusters and create zoom regions optimised for the selected aspect ratio"
									>
										<WandSparkles className="w-3.5 h-3.5" />
										<span className="font-medium">Auto-Reframe</span>
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setShowSocialSafeZone((v) => !v)}
										className={cn(
											"h-7 px-2 text-xs transition-all gap-1.5",
											showSocialSafeZone
												? "text-[#2563EB] bg-[#2563EB]/10 hover:bg-[#2563EB]/20"
												: "text-muted-foreground hover:text-foreground hover:bg-foreground/10",
										)}
										title="Toggle safe zone overlay for the selected social platform"
									>
										<LayoutIcon className="w-3.5 h-3.5" />
										<span className="font-medium">Safe Zone</span>
									</Button>
									<div className="w-[1px] h-4 bg-foreground/20" />
									<Button
										variant="ghost"
										size="sm"
										onClick={handleOpenCropEditor}
										className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/10 transition-all gap-1.5"
									>
										<Crop className="w-3.5 h-3.5" />
										<span className="font-medium">
											{t("settings.crop.title")}
										</span>
										{isCropped ? (
											<span className="h-1.5 w-1.5 rounded-full bg-[#2563EB]" />
										) : null}
									</Button>
								</div>
								{/* Video preview */}
								<div
									className="flex w-full min-h-0 flex-1 items-stretch"
									style={{ flex: "1 1 auto", margin: "6px 0 0" }}
								>
									<div className="flex min-w-0 flex-1 items-center justify-center px-1">
										<div
											className="relative overflow-hidden rounded-[30px]"
											style={{
												width: "auto",
												height: "100%",
												aspectRatio: getAspectRatioValue(
													aspectRatio,
													(() => {
														const previewVideo =
															videoPlaybackRef.current?.video;
														if (
															previewVideo &&
															previewVideo.videoHeight > 0
														) {
															return (
																previewVideo.videoWidth /
																previewVideo.videoHeight
															);
														}
														return 16 / 9;
													})(),
												),
												maxWidth: "100%",
												margin: "0 auto",
												boxSizing: "border-box",
											}}
										>
											{clips.length === 0 && !videoPath ? (
												<div className="flex flex-col items-center justify-center h-full w-full max-w-md mx-auto rounded-3xl border border-foreground/10 bg-foreground/[0.02] p-8 text-center backdrop-blur-md shadow-2xl my-auto">
													<div className="p-4 rounded-2xl bg-foreground/5 border border-foreground/10 mb-4 shadow-inner">
														<CaptrLogo variant="icon" size={56} animateGlow={true} />
													</div>
													<h2 className="text-xl font-bold tracking-tight text-foreground mb-1.5">
														Captr Studio
													</h2>
													<p className="text-xs text-muted-foreground mb-6 max-w-xs leading-relaxed">
														Record your screen & camera or import video files to start your project.
													</p>
													<div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
														<Button
															type="button"
															onClick={handleOpenRecorderHud}
															className="w-full sm:w-auto h-9 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold gap-2 shadow-lg shadow-red-600/25 transition-all cursor-pointer"
														>
															<VideoCamera className="w-3.5 h-3.5" weight="fill" />
															<span>Record Video</span>
														</Button>
														<Button
															type="button"
															variant="outline"
															onClick={() => void handleImportVideoClip()}
															className="w-full sm:w-auto h-9 px-5 rounded-xl border-foreground/15 bg-foreground/5 hover:bg-foreground/10 text-xs font-semibold gap-2 transition-all cursor-pointer"
														>
															<UploadSimple className="w-3.5 h-3.5" />
															Import Video
														</Button>
													</div>
												</div>
											) : (
												<VideoPlayback
													key={`${videoPath || "no-video"}:${previewVersion}`}
												aspectRatio={aspectRatio}
												ref={videoPlaybackRef}
												videoPath={videoPath || ""}
												audioRegions={audioRegions}
												audioDuckingSettings={audioDuckingSettings}
												showSocialSafeZone={showSocialSafeZone}
												clipRegions={clipRegions}
												onDurationChange={setDuration}
												onPreviewReadyChange={setIsPreviewReady}
												onTimeUpdate={setCurrentTime}
												currentTime={currentTime}
												onPlayStateChange={setIsPlaying}
												onError={setError}
												wallpaper={wallpaper}
												zoomRegions={effectiveZoomRegions}
												selectedZoomId={selectedZoomId}
												onSelectZoom={handleSelectZoom}
												onZoomFocusChange={handleZoomFocusChange}
												isPlaying={isPlaying}
												showShadow={shadowIntensity > 0}
												shadowIntensity={shadowIntensity}
												backgroundBlur={backgroundBlur}
												connectZooms={connectZooms}
												zoomInDurationMs={zoomInDurationMs}
												zoomInOverlapMs={zoomInOverlapMs}
												zoomOutDurationMs={zoomOutDurationMs}
												connectedZoomGapMs={connectedZoomGapMs}
												connectedZoomDurationMs={connectedZoomDurationMs}
												zoomInEasing={zoomInEasing}
												zoomOutEasing={zoomOutEasing}
												connectedZoomEasing={connectedZoomEasing}
												borderRadius={borderRadius}
												colorGrading={colorGrading}
												padding={padding}
												frame={frame}
												cropRegion={cropRegion}
												webcam={webcam}
												layoutRegions={layoutRegions}
												webcamVideoPath={
													webcam.sourcePath
														? resolvedWebcamVideoUrl
														: null
												}
												trimRegions={trimRegions}
												speedRegions={effectiveSpeedRegions}
												annotationRegions={annotationRegions}
												selectedAnnotationId={selectedAnnotationId}
												onSelectAnnotation={handleSelectAnnotation}
												onAnnotationPositionChange={
													handleAnnotationPositionChange
												}
												onAnnotationSizeChange={handleAnnotationSizeChange}
												cursorTelemetry={effectiveCursorTelemetry}
												showCursor={effectiveShowCursor}
												cursorStyle={cursorStyle}
												cursorSize={cursorSize}
												cursorSmoothing={cursorSmoothing}
												cursorSpringStiffnessMultiplier={
													cursorSpringStiffnessMultiplier
												}
												cursorSpringDampingMultiplier={
													cursorSpringDampingMultiplier
												}
												cursorSpringMassMultiplier={
													cursorSpringMassMultiplier
												}
												cameraSpringStiffnessMultiplier={
													cameraSpringStiffnessMultiplier
												}
												cameraSpringDampingMultiplier={
													cameraSpringDampingMultiplier
												}
												cameraSpringMassMultiplier={
													cameraSpringMassMultiplier
												}
												zoomSmoothness={zoomSmoothness}
												zoomClassicMode={zoomClassicMode}
												zoomMotionBlur={zoomMotionBlur}
												zoomMotionBlurTuning={zoomMotionBlurTuning}
												cursorMotionBlur={cursorMotionBlur}
												cursorClickBounce={cursorClickBounce}
												cursorClickBounceDuration={
													cursorClickBounceDuration
												}
												cursorSway={cursorSway}
												cameraPerspectiveTilt={cameraPerspectiveTilt}
												volume={
													audio.shouldMutePreviewVideo ||
													audio.isCurrentClipMuted
														? 0
														: Math.max(
																0,
																Math.min(
																	1,
																	previewVolume *
																		audio.embeddedSourcePreviewGain,
																),
															)
												}
												suspendRendering={shouldSuspendPreviewRendering}
											/>
										)}
										</div>
									</div>
								</div>
							</div>
						</div>
						{/* Toolbar - sits at bottom of right column, only spans preview width */}
						<div className="relative flex flex-shrink-0 items-center px-1 py-1">
							{/* Left tools */}
							<div className="z-10 flex min-w-0 flex-1 items-center gap-1.5">
								<DropdownMenu>
									<DropdownMenuTrigger asChild>
										<Button
											variant="ghost"
											size="sm"
											className="h-7 gap-1 rounded-full border border-foreground/[0.08] bg-foreground/[0.04] px-2.5 text-[11px] text-foreground/65 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)] transition-all hover:bg-foreground/[0.08] hover:text-foreground"
										>
											<Plus className="w-3.5 h-3.5" />
											<span className="font-medium">
												{t("editor.toolbar.addLayer")}
											</span>
											<ChevronDown className="w-3 h-3" />
										</Button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="start"
										className="bg-editor-surface-alt border-foreground/10"
									>
										<DropdownMenuItem
											onClick={() => timelineRef.current?.addLayout()}
											className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 cursor-pointer"
										>
											Layout scene
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={() => {
												const nextTrackIndex =
													annotationRegions.length > 0
														? Math.max(
																...annotationRegions.map(
																	(r) => r.trackIndex ?? 0,
																),
															) + 1
														: 0;
												timelineRef.current?.addAnnotation(nextTrackIndex);
											}}
											className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 cursor-pointer"
										>
											{t("timeline.annotation.label")}
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={handleAddGifAnnotation}
											className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 cursor-pointer"
										>
											Add GIF
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={handleAddStickerAnnotation}
											className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 cursor-pointer"
										>
											Add Sticker
										</DropdownMenuItem>
										<DropdownMenuItem
											onClick={handleAddAudioTrack}
											className="text-muted-foreground hover:text-foreground hover:bg-foreground/10 cursor-pointer"
										>
											{t("timeline.audio.label")}
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
								<div className="w-[1px] h-4 bg-foreground/10 mx-1" />
								<Button
									onClick={() => timelineRef.current?.addZoom()}
									variant="ghost"
									size="icon"
									className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-[#2563EB]/10 hover:text-[#2563EB]"
									title={t("timeline.zoom.addZoom")}
								>
									<ZoomIn className="w-4 h-4" />
								</Button>
								<Button
									onClick={() => timelineRef.current?.suggestZooms()}
									variant="ghost"
									size="icon"
									className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-[#2563EB]/10 hover:text-[#2563EB]"
									title={t("timeline.zoom.suggestZooms")}
								>
									<WandSparkles className="w-4 h-4" />
								</Button>
								<Button
									onClick={() => timelineRef.current?.splitClip()}
									variant="ghost"
									size="icon"
									className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground"
									title={t("editor.toolbar.splitClip")}
								>
									<Scissors className="w-4 h-4" />
								</Button>
								<Button
									onClick={() => void handleAnalyzeSilence()}
									variant="ghost"
									size="icon"
									disabled={isAnalyzingSilence || !videoPath}
									className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-emerald-500/10 hover:text-emerald-500"
									title={t(
										"editor.toolbar.cleanPauses",
										"Clean Pauses / Auto Cut Dead-Air (Hapus Jeda Diam)",
									)}
								>
									{isAnalyzingSilence ? (
										<Redo2 className="w-4 h-4 animate-spin" />
									) : (
										<VolumeX className="w-4 h-4" />
									)}
								</Button>
							</div>
							{/* Playback controls - centered */}
							<div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
								<div className="flex items-center gap-1.5 pointer-events-auto">
									<span className="mr-1 text-[10px] font-medium tabular-nums text-muted-foreground">
										{formatTime(timelinePlayheadTime)}
									</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground"
										title={t("editor.playback.skipBack")}
										onClick={() => {
											const currentMs = timelinePlayheadTime * 1000;
											const kfs = timelineRef.current?.keyframes ?? [];
											const prev = [...kfs]
												.reverse()
												.find((k) => k.time < currentMs - 50);
											handleSeek(
												prev
													? prev.time / 1000
													: Math.max(0, timelinePlayheadTime - 5),
											);
										}}
									>
										<SkipBack className="w-3.5 h-3.5" weight="fill" />
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className={`h-7 w-7 rounded-full border border-foreground/10 transition-all shadow-[0_8px_18px_rgba(0,0,0,0.18)] ${isPlaying ? "bg-foreground/10 text-foreground hover:bg-foreground/20" : "bg-neutral-800 text-white hover:bg-neutral-700 dark:bg-white dark:text-black dark:hover:bg-white/90"}`}
										onClick={togglePlayPause}
										title={isPlaying ? "Pause" : "Play"}
									>
										{isPlaying ? (
											<Pause className="w-3.5 h-3.5" weight="fill" />
										) : (
											<Play className="w-3.5 h-3.5" weight="fill" />
										)}
									</Button>
									<Button
										variant="ghost"
										size="icon"
										className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground"
										title={t("editor.playback.skipForward")}
										onClick={() => {
											const currentMs = timelinePlayheadTime * 1000;
											const kfs = timelineRef.current?.keyframes ?? [];
											const next = kfs.find((k) => k.time > currentMs + 50);
											handleSeek(
												next
													? next.time / 1000
													: Math.min(
															timelineDuration,
															timelinePlayheadTime + 5,
														),
											);
										}}
									>
										<SkipForward className="w-3.5 h-3.5" weight="fill" />
									</Button>
									<span className="text-[10px] font-medium text-muted-foreground/70 tabular-nums ml-1">
										{formatTime(timelineDuration)}
									</span>
								</div>
							</div>
							{/* Right: collapse + volume */}
							<div className="z-10 ml-auto flex items-center gap-2">
								<Button
									variant="ghost"
									size="icon"
									title={
										timelineCollapsed
											? t("editor.timeline.expand")
											: t("editor.timeline.collapse")
									}
									className="h-7 w-7 rounded-full text-muted-foreground transition-all hover:bg-foreground/10 hover:text-foreground"
									onClick={() => {
										setTimelineCollapsed((p) => !p);
									}}
								>
									{timelineCollapsed ? (
										<ChevronUp className="w-3.5 h-3.5" />
									) : (
										<ChevronDown className="w-3.5 h-3.5" />
									)}
								</Button>
								<div className="flex items-center gap-1.5">
									<button
										type="button"
										className="text-muted-foreground hover:text-foreground transition-colors"
										title={t("editor.playback.muteUnmute")}
										onClick={() =>
											setPreviewVolume(previewVolume <= 0.001 ? 1 : 0)
										}
									>
										{previewVolume <= 0.001 ? (
											<VolumeX className="w-3.5 h-3.5" />
										) : previewVolume < 0.5 ? (
											<Volume1 className="w-3.5 h-3.5" />
										) : (
											<Volume2 className="w-3.5 h-3.5" />
										)}
									</button>
									<div className="relative flex h-7 w-24 select-none items-center overflow-hidden rounded-full border border-foreground/[0.06] bg-editor-bg/80 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.06)]">
										<div
											className="absolute inset-y-[3px] left-[3px] right-auto rounded-[10px] bg-foreground/[0.08]"
											style={{
												width:
													previewVolume > 0
														? `max(calc(${previewVolume * 100}% - 6px), 1.2rem)`
														: 0,
											}}
										/>
										<div
											className="pointer-events-none absolute bottom-[18%] top-[18%] z-10 w-[2px] rounded-full bg-foreground/95 shadow-[0_0_10px_rgba(37,99,235,0.28)]"
											style={{ left: `calc(${previewVolume * 100}% - 8px)` }}
										/>
										<span className="pointer-events-none relative z-10 pl-2 text-[10px] font-medium text-muted-foreground">
											{Math.round(previewVolume * 100)}%
										</span>
										<input
											type="range"
											min="0"
											max="1"
											step="0.01"
											value={previewVolume}
											onChange={(e) =>
												setPreviewVolume(Number(e.target.value))
											}
											className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
										/>
									</div>
								</div>
							</div>
						</div>

						{/* Slide List (Global Timeline) */}
						<div className="flex-shrink-0 rounded-2xl overflow-hidden border border-foreground/10 shadow-sm">
							<SlideList
								slides={clips}
								clipRegions={clipRegions}
								selectedSlideId={selectedClipId}
								onSelectSlide={handleSelectClip}
								onAddSlide={() => void handleImportVideoClip()}
								onAddRecordSlide={handleOpenRecorderHud}
								onAddVideoSlide={() => void handleImportVideoClip()}
								onDeleteSlide={handleDeleteClip}
								onDuplicateSlide={handleDuplicateSlide}
								onSplitSlide={handleSplitSlide}
								onReorderSlide={handleReorderClip}
								onTransitionChange={handleTransitionChange}
								onToggleSlideMode={handleToggleSlideMode}
								currentTimeMs={currentTime * 1000}
							/>
						</div>
					</div>
				</div>

				{/* Timeline Resizer Bar (VS Code style) */}
				<div
					role="separator"
					aria-orientation="horizontal"
					tabIndex={0}
					title="Drag to resize timeline (Double-click to reset, Click expand/collapse)"
					onPointerDown={handleTimelineResizeStart}
					onDoubleClick={handleResetTimelineHeight}
					className={cn(
						"relative z-20 flex h-3.5 -my-1.5 cursor-row-resize items-center justify-center group select-none transition-colors",
						isDraggingTimeline && "bg-transparent",
					)}
				>
					<div
						className={cn(
							"w-full h-[2px] rounded-full transition-all duration-150",
							isDraggingTimeline
								? "bg-[#2563EB] h-[3px] shadow-[0_0_8px_rgba(37,99,235,0.6)]"
								: "bg-foreground/[0.08] group-hover:bg-[#2563EB]/80 group-hover:h-[3px]",
						)}
					/>
					{/* Center Grab Handle Pill */}
					<div
						className={cn(
							"absolute flex items-center justify-center px-3 py-0.5 rounded-full border text-[10px] font-medium transition-all duration-150 shadow-sm",
							isDraggingTimeline
								? "border-[#2563EB]/50 bg-editor-surface text-[#2563EB] shadow-md shadow-[#2563EB]/20"
								: "border-foreground/10 bg-editor-surface/90 text-muted-foreground/80 group-hover:border-[#2563EB]/30 group-hover:text-foreground",
						)}
					>
						<div className="flex items-center gap-1.5">
							<span className="w-1 h-1 rounded-full bg-current opacity-60" />
							<span className="w-1 h-1 rounded-full bg-current opacity-80" />
							<span className="w-1 h-1 rounded-full bg-current opacity-60" />
						</div>
					</div>

					{/* Quick Controls in Splitter (Collapse/Expand & Size Preset) */}
					<div className="absolute right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								setTimelineCollapsed((prev) => !prev);
							}}
							className="px-1.5 py-0.5 rounded text-[10px] bg-foreground/10 hover:bg-foreground/20 text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
							title={timelineCollapsed ? "Expand Timeline" : "Collapse Timeline"}
						>
							{timelineCollapsed ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
							<span>{timelineCollapsed ? "Expand" : "Collapse"}</span>
						</button>
					</div>
				</div>

				<div
					className="flex-shrink-0 flex flex-col transition-[height] duration-75 overflow-hidden"
					style={{
						height: timelineCollapsed ? 42 : timelineHeight,
						minHeight: timelineCollapsed ? 42 : 130,
					}}
				>
					{timelineCollapsed ? (
						<div className="flex items-center justify-between h-[42px] px-4 rounded-xl border border-foreground/10 bg-editor-surface/60 backdrop-blur-md">
							<span className="text-xs font-semibold text-muted-foreground flex items-center gap-2">
								Timeline ({clips.length} {clips.length === 1 ? "clip" : "clips"})
							</span>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={() => setTimelineCollapsed(false)}
								className="h-7 px-2.5 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1.5"
							>
								<ChevronUp className="w-3.5 h-3.5" />
								Expand Timeline
							</Button>
						</div>
					) : (
						<TimelineEditor
							ref={timelineRef}
							videoDuration={slideDurationSec}
							currentTime={currentTime}
							playheadTime={currentTime}
							onSeek={handleTimelineSeek}
								videoPath={activeSlide?.videoPath ?? videoSourcePath ?? videoPath}
								videoSourcePath={activeSlide?.videoPath ?? videoSourcePath}
								webcamPath={
									activeSlide?.webcamPath ??
									activeSlide?.webcam?.sourcePath ??
									(activeSlide?.id === selectedClipId ? (resolvedWebcamVideoUrl ?? webcam.sourcePath) : null) ??
									resolvedWebcamVideoUrl ??
									webcam.sourcePath
								}
								webcamEnabled={
									Boolean(
										(activeSlide?.webcamPath ?? activeSlide?.webcam?.sourcePath ?? webcam.sourcePath) &&
										(activeSlide?.webcam?.enabled ?? webcam.enabled) !== false
									)
								}
								cursorTelemetrySourcePath={cursorTelemetrySourcePath}
								cursorTelemetry={normalizedCursorTelemetry}
								autoSuggestZoomsTrigger={autoSuggestZoomsTrigger}
								onAutoSuggestZoomsConsumed={handleAutoSuggestZoomsConsumed}
								disableSuggestedZooms={!autoApplyFreshRecordingAutoZooms}
								zoomRegions={zoomRegions}
								onZoomAdded={handleZoomAdded}
								onZoomSuggested={handleZoomSuggested}
								onZoomSpanChange={handleZoomSpanChange}
								onZoomDelete={handleZoomDelete}
								selectedZoomId={selectedZoomId}
								onSelectZoom={handleSelectZoom}
								trimRegions={trimRegions}
								clipRegions={slideLocalClipRegions}
								onClipSplit={handleClipSplit}
								onClipSpanChange={handleClipSpanChange}
								onClipDelete={handleClipDelete}
								selectedClipId={selectedClipId}
								onSelectClip={handleSelectClip}
								layoutRegions={layoutRegions}
								onLayoutAdded={handleLayoutAdded}
								onLayoutSpanChange={handleLayoutSpanChange}
								onLayoutDelete={handleLayoutDelete}
								selectedLayoutId={selectedLayoutId}
								onSelectLayout={handleSelectLayout}
								audioRegions={audioRegions}
								onAudioAdded={handleAudioAdded}
								onAudioSpanChange={handleAudioSpanChange}
								onAudioDelete={handleAudioDelete}
								selectedAudioId={selectedAudioId}
								onSelectAudio={handleSelectAudio}
								annotationRegions={annotationRegions}
								onAnnotationAdded={handleAnnotationAdded}
								onAnnotationSpanChange={handleAnnotationSpanChange}
								onAnnotationDelete={handleAnnotationDelete} onAnnotationKeyframesChange={(id, keyframes) => handleAnnotationLayerChange(id, { keyframes })} 
								selectedAnnotationId={selectedAnnotationId}
								onSelectAnnotation={handleSelectAnnotation}
								showSourceAudioTrack={false}
								sourceAudioTrackSettings={audio.activeSourceAudioTrackSettings}
								getSourceAudioTrackSettingsForClip={
									audio.getSourceAudioTrackSettingsForClip
								}
								onSourceAudioAvailabilityChange={(available) => {
									setHasClipSourceAudio(available);
								}}
								onSourceAudioTracksMetaChange={(tracks) => {
									audio.onSourceAudioTracksMetaChange(tracks);
								}}
							/>
					)}
				</div>
			</div>

			{showCropModal ? (
				<>
					<div
						className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
						onClick={handleCancelCropEditor}
					/>
					<div className="fixed left-1/2 top-1/2 z-[60] max-h-[90vh] w-[90vw] max-w-5xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-2xl border border-foreground/10 bg-editor-dialog p-8 shadow-2xl animate-in zoom-in-95 duration-200">
						<div className="mb-6 flex items-center justify-between">
							<div>
								<span className="text-xl font-bold text-foreground">
									{t("settings.crop.title")}
								</span>
								<p className="mt-2 text-sm text-muted-foreground">
									{t("settings.crop.instruction")}
								</p>
							</div>
							<Button
								variant="ghost"
								size="icon"
								onClick={handleCancelCropEditor}
								className="text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
							>
								<X className="h-5 w-5" />
							</Button>
						</div>
						<CropControl
							videoElement={videoPlaybackRef.current?.video || null}
							cropRegion={cropRegion}
							onCropChange={setCropRegion}
							aspectRatio={aspectRatio}
						/>
						<div className="mt-6 flex justify-end">
							<Button
								onClick={handleCloseCropEditor}
								size="lg"
								className="bg-[#2563EB] text-white hover:bg-[#2563EB]/90"
							>
								{t("common.actions.done")}
							</Button>
						</div>
					</div>
				</>
			) : null}

			{projectBrowser}
			{nativeCaptureUnavailableDialog}

			<Dialog open={silenceModalOpen} onOpenChange={setSilenceModalOpen}>
				<DialogContent className="sm:max-w-[480px] border-foreground/10 bg-editor-surface text-foreground shadow-2xl">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2 text-base font-semibold">
							<VolumeX className="w-5 h-5 text-emerald-500" />
							{t(
								"editor.silence.modalTitle",
								"Clean Pauses & Dead-Air (1-Click Cut)",
							)}
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							{t(
								"editor.silence.modalDescription",
								"Automatically cut silent gaps and dead air to keep your video engaging and fast-paced.",
							)}
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						{/* Stats Summary */}
						<div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-foreground/[0.04] border border-foreground/10">
							<div>
								<div className="text-[10px] uppercase font-semibold text-muted-foreground">
									{t("editor.silence.detectedCount", "Pauses Found")}
								</div>
								<div className="text-2xl font-bold text-foreground mt-0.5">
									{detectedSilences.length}
								</div>
							</div>
							<div>
								<div className="text-[10px] uppercase font-semibold text-muted-foreground">
									{t("editor.silence.timeSaved", "Time Saved")}
								</div>
								<div className="text-2xl font-bold text-emerald-500 mt-0.5">
									-{(silenceTotalSavedMs / 1000).toFixed(1)}s
								</div>
							</div>
						</div>

						{/* Settings */}
						<div className="space-y-2.5 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
							<div className="flex items-center justify-between text-xs">
								<span className="font-medium text-foreground">
									{t("editor.silence.minDurationLabel", "Min Pause Duration")}
								</span>
								<span className="font-mono text-muted-foreground">
									{(silenceMinDurationMs / 1000).toFixed(1)}s
								</span>
							</div>
							<input
								type="range"
								min="600"
								max="3000"
								step="100"
								value={silenceMinDurationMs}
								onChange={(e) => {
									const val = Number(e.target.value);
									setSilenceMinDurationMs(val);
								}}
								onMouseUp={() =>
									void handleAnalyzeSilence(
										silenceMinDurationMs,
										silenceThresholdDb,
									)
								}
								className="w-full h-1.5 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
							/>
							<div className="flex justify-between text-[10px] text-muted-foreground/60">
								<span>Aggressive (0.6s)</span>
								<span>Default (1.0s)</span>
								<span>Relaxed (3.0s)</span>
							</div>
						</div>

						<div className="space-y-2.5 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
							<div className="flex items-center justify-between text-xs">
								<span className="font-medium text-foreground">
									{t("editor.silence.thresholdLabel", "Silence Volume Threshold")}
								</span>
								<span className="font-mono text-muted-foreground">
									{silenceThresholdDb} dB
								</span>
							</div>
							<input
								type="range"
								min="-50"
								max="-20"
								step="2"
								value={silenceThresholdDb}
								onChange={(e) => {
									const val = Number(e.target.value);
									setSilenceThresholdDb(val);
								}}
								onMouseUp={() =>
									void handleAnalyzeSilence(
										silenceMinDurationMs,
										silenceThresholdDb,
									)
								}
								className="w-full h-1.5 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-emerald-500"
							/>
							<div className="flex justify-between text-[10px] text-muted-foreground/60">
								<span>Sensitive (-50dB)</span>
								<span>Default (-36dB)</span>
								<span>Aggressive (-20dB)</span>
							</div>
						</div>

						{/* Pause region breakdown list */}
						{detectedSilences.length > 0 ? (
							<div className="space-y-1">
								<div className="text-[11px] font-medium text-muted-foreground">
									{t("editor.silence.previewList", "Detected pauses:")}
								</div>
								<div className="max-h-32 overflow-y-auto space-y-1 pr-1 text-xs font-mono">
									{detectedSilences.slice(0, 8).map((s) => (
										<div
											key={s.id}
											className="flex justify-between items-center px-2.5 py-1 rounded bg-foreground/[0.03] text-muted-foreground"
										>
											<span>
												{formatTime(s.startMs / 1000)} →{" "}
												{formatTime(s.endMs / 1000)}
											</span>
											<span className="text-emerald-500 font-semibold">
												-{(s.durationMs / 1000).toFixed(1)}s
											</span>
										</div>
									))}
									{detectedSilences.length > 8 ? (
										<div className="text-center text-[10px] text-muted-foreground/60 py-0.5">
											+{detectedSilences.length - 8} more pauses
										</div>
									) : null}
								</div>
							</div>
						) : (
							<div className="text-center py-4 text-xs text-muted-foreground">
								{t(
									"editor.silence.noPauses",
									"No dead-air pauses detected matching criteria.",
								)}
							</div>
						)}
					</div>

					<DialogFooter className="gap-2 sm:gap-0">
						<Button
							variant="ghost"
							onClick={() => setSilenceModalOpen(false)}
							className="text-xs"
						>
							{t("common.actions.cancel", "Cancel")}
						</Button>
						<Button
							disabled={detectedSilences.length === 0}
							onClick={handleApplySilenceRemoval}
							className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium gap-1.5"
						>
							<Scissors className="w-3.5 h-3.5" />
							{t("editor.silence.cutAllButton", "Cut All Pauses & Ripple Timeline")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AppSettingsDialog
				open={isSettingsOpen}
				onOpenChange={setIsSettingsOpen}
				defaultTab={settingsDefaultTab}
				onOpenShortcuts={openConfig}
			/>

			<Toaster className="pointer-events-auto" />
		</div>
	);
}
