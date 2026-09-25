import { Palette, Trash as Trash2 } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import React, { useEffect, useMemo, useState } from "react";
import minimalCursorUrl from "@/assets/cursors/custom/minimal-cursor.svg";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/ThemeContext";
import {
	getAssetPath,
	getRenderableAssetUrl,
	getRenderableVideoUrl,
	getWallpaperThumbnailUrl,
} from "@/lib/assetPath";
import type { FrameInstance } from "@/lib/extensions";
import { extensionHost } from "@/lib/extensions";
import { cn } from "@/lib/utils";
import type { BuiltInWallpaper } from "@/lib/wallpapers";
import {
	BUILT_IN_WALLPAPERS,
	getAvailableWallpapers,
	isVideoWallpaperSource,
} from "@/lib/wallpapers";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { useI18n, useScopedT } from "../../contexts/I18nContext";
import { AnnotationSettingsPanel } from "./AnnotationSettingsPanel";
import {
	CURSOR_MOTION_PRESETS,
	type CursorMotionPresetId,
	getMatchingCursorMotionPresetId,
} from "./cursorMotionPresets";
import { loadEditorPreferences } from "./editorPreferences";
import { ExtensionSettingsSection } from "./settings/components/ExtensionSettingsSection";
import { SectionLabel } from "./settings/components/SettingsSectionLabel";
import { AudioRecordSection } from "./settings/sections/AudioRecordSection";
import { AudioTrackSection } from "./settings/sections/AudioTrackSection";
import { ClipItemSection } from "./settings/sections/ClipItemSection";
import { CursorSection } from "./settings/sections/CursorSection";
import { GeneralPreferencesSection } from "./settings/sections/GeneralPreferencesSection";
import { LayoutItemSection } from "./settings/sections/LayoutItemSection";
import { MediaSection } from "./settings/sections/MediaSection";
import { SceneSection } from "./settings/sections/SceneSection";
import { TransitionsSection } from "./settings/sections/TransitionsSection";
import { VideoAdjustSection } from "./settings/sections/VideoAdjustSection";
import { WebcamSection } from "./settings/sections/WebcamSection";
import { ZoomItemSection } from "./settings/sections/ZoomItemSection";
import {
	BUILTIN_CURSOR_STYLE_OPTIONS,
	type CursorStyleOption,
	createInvertedPreview,
	createTrimmedSvgPreview,
	tahoeCursorUrl,
} from "./settings/utils/cursorPreviewUtils";
import type {
	AnnotationRegion,
	AnnotationType,
	AudioDuckingSettings,
	ClipEntry,
	ClipTransitionType,
	ColorGradingSettings,
	CropRegion,
	CursorStyle,
	EditorEffectSection,
	FigureData,
	LayoutSceneEasing,
	LayoutScenePreset,
	Padding,
	WebcamOverlaySettings,
	WebcamPositionPreset,
	ZoomDepth,
	ZoomMode,
	ZoomMotionBlurTuning,
	ZoomTransitionEasing,
} from "./types";
import {
	DEFAULT_CAMERA_PERSPECTIVE_TILT,
	DEFAULT_CURSOR_CLICK_BOUNCE_DURATION,
	DEFAULT_CURSOR_MOTION_BLUR,
	DEFAULT_CURSOR_STYLE,
	DEFAULT_CURSOR_SWAY,
	DEFAULT_PADDING,
	DEFAULT_WEBCAM_POSITION_PRESET,
	DEFAULT_WEBCAM_POSITION_X,
	DEFAULT_WEBCAM_POSITION_Y,
	DEFAULT_ZOOM_IN_DURATION_MS,
	DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	DEFAULT_ZOOM_OUT_DURATION_MS,
} from "./types";
import { cursorSetAssets } from "./videoPlayback/uploadedCursorAssets";
import {
	getWebcamPositionForPreset,
	normalizeWebcamCropRegion,
	resolveWebcamCorner,
} from "./webcamOverlay";

interface SettingsPanelProps {
	className?: string;
	style?: React.CSSProperties;
	panelMode?: "editor" | "background";
	activeEffectSection?: EditorEffectSection;
	recordToolsEnabled?: boolean;
	slides?: ClipEntry[];
	onAddAsSlide?: (filePath: string, label?: string) => void;
	onImportMedia?: (subfolder?: string) => void;
	onUseAsset?: (
		asset: import("./types").SlideAssetFile,
		action: "set-main" | "add-video-layer" | "add-audio" | "add-overlay",
	) => void;
	onRemoveAsset?: (assetId: string) => void;
	onAudioAdded?: (span: { start: number; end: number }, audioPath: string) => void;
	currentTime?: number;
	selected: string;
	onWallpaperChange: (path: string) => void;
	selectedZoomDepth?: ZoomDepth | null;
	onZoomDepthChange?: (depth: ZoomDepth) => void;
	selectedZoomId?: string | null;
	selectedZoomMode?: ZoomMode | null;
	onZoomModeChange?: (mode: ZoomMode) => void;
	onZoomDelete?: (id: string) => void;
	selectedClipId?: string | null;
	selectedClipSpeed?: number | null;
	selectedClipMuted?: boolean | null;
	selectedClipShowSourceAudio?: boolean | null;
	hasClipSourceAudio?: boolean;
	onClipSpeedChange?: (speed: number) => void;
	onClipMutedChange?: (muted: boolean) => void;
	onClipShowSourceAudioChange?: (show: boolean) => void;
	sourceAudioTrackMeta?: Array<{ id: string; label: string }>;
	sourceAudioTrackSettings?: Record<string, { volume: number; normalize: boolean }>;
	onSourceAudioTrackVolumeChange?: (id: string, volume: number) => void;
	onSourceAudioTrackNormalizeChange?: (id: string, normalize: boolean) => void;
	onClipDelete?: (id: string) => void;
	onClipRippleDelete?: (id: string) => void;
	selectedClipTransitionIn?: ClipTransitionType | null;
	selectedClipTransitionInDurationMs?: number | null;
	onClipTransitionInChange?: (transition: ClipTransitionType) => void;
	onClipTransitionInDurationChange?: (durationMs: number) => void;
	selectedLayoutId?: string | null;
	selectedLayoutPreset?: LayoutScenePreset | null;
	selectedLayoutTransitionMs?: number | null;
	selectedLayoutEasing?: LayoutSceneEasing | null;
	onLayoutPresetChange?: (preset: LayoutScenePreset) => void;
	onLayoutTransitionChange?: (transitionMs: number) => void;
	onLayoutEasingChange?: (easing: LayoutSceneEasing) => void;
	onLayoutDelete?: (id: string) => void;
	selectedAudioId?: string | null;
	selectedAudioVolume?: number | null;
	selectedAudioNormalize?: boolean | null;
	selectedAudioDucking?: boolean | null;
	onAudioVolumeChange?: (volume: number) => void;
	onAudioNormalizeChange?: (normalize: boolean) => void;
	onAudioDuckingChange?: (ducking: boolean) => void;
	onAudioDelete?: (id: string) => void;
	audioDuckingSettings?: AudioDuckingSettings;
	onAudioDuckingSettingsChange?: (settings: AudioDuckingSettings) => void;
	colorGrading?: ColorGradingSettings;
	onColorGradingChange?: (colorGrading: ColorGradingSettings) => void;

	shadowIntensity?: number;
	onShadowChange?: (intensity: number) => void;
	backgroundBlur?: number;
	onBackgroundBlurChange?: (amount: number) => void;
	zoomMotionBlurTuning?: ZoomMotionBlurTuning;
	onZoomMotionBlurTuningChange?: (tuning: ZoomMotionBlurTuning) => void;
	zoomTemporalMotionBlur?: number;
	onZoomTemporalMotionBlurChange?: (amount: number) => void;
	zoomMotionBlurSampleCount?: number | null;
	onZoomMotionBlurSampleCountChange?: (count: number | null) => void;
	zoomMotionBlurShutterFraction?: number | null;
	onZoomMotionBlurShutterFractionChange?: (fraction: number | null) => void;
	connectZooms?: boolean;
	onConnectZoomsChange?: (enabled: boolean) => void;
	autoApplyFreshRecordingAutoZooms?: boolean;
	onAutoApplyFreshRecordingAutoZoomsChange?: (enabled: boolean) => void;
	zoomInDurationMs?: number;
	onZoomInDurationMsChange?: (duration: number) => void;
	zoomInOverlapMs?: number;
	onZoomInOverlapMsChange?: (duration: number) => void;
	zoomOutDurationMs?: number;
	onZoomOutDurationMsChange?: (duration: number) => void;
	connectedZoomGapMs?: number;
	onConnectedZoomGapMsChange?: (duration: number) => void;
	connectedZoomDurationMs?: number;
	onConnectedZoomDurationMsChange?: (duration: number) => void;
	zoomInEasing?: ZoomTransitionEasing;
	onZoomInEasingChange?: (easing: ZoomTransitionEasing) => void;
	zoomOutEasing?: ZoomTransitionEasing;
	onZoomOutEasingChange?: (easing: ZoomTransitionEasing) => void;
	connectedZoomEasing?: ZoomTransitionEasing;
	onConnectedZoomEasingChange?: (easing: ZoomTransitionEasing) => void;
	showCursor?: boolean;
	onShowCursorChange?: (enabled: boolean) => void;
	loopCursor?: boolean;
	onLoopCursorChange?: (enabled: boolean) => void;
	cursorStyle?: CursorStyle;
	onCursorStyleChange?: (style: CursorStyle) => void;
	cursorSize?: number;
	onCursorSizeChange?: (size: number) => void;
	cursorSmoothing?: number;
	onCursorSmoothingChange?: (smoothing: number) => void;
	cursorSpringStiffnessMultiplier?: number;
	onCursorSpringStiffnessMultiplierChange?: (multiplier: number) => void;
	cursorSpringDampingMultiplier?: number;
	onCursorSpringDampingMultiplierChange?: (multiplier: number) => void;
	cursorSpringMassMultiplier?: number;
	onCursorSpringMassMultiplierChange?: (multiplier: number) => void;
	cameraSpringStiffnessMultiplier?: number;
	onCameraSpringStiffnessMultiplierChange?: (multiplier: number) => void;
	cameraSpringDampingMultiplier?: number;
	onCameraSpringDampingMultiplierChange?: (multiplier: number) => void;
	cameraSpringMassMultiplier?: number;
	onCameraSpringMassMultiplierChange?: (multiplier: number) => void;
	zoomClassicMode?: boolean;
	onZoomClassicModeChange?: (enabled: boolean) => void;
	cursorMotionBlur?: number;
	onCursorMotionBlurChange?: (amount: number) => void;
	cursorClickBounce?: number;
	onCursorClickBounceChange?: (amount: number) => void;
	cursorClickBounceDuration?: number;
	onCursorClickBounceDurationChange?: (duration: number) => void;
	cursorSway?: number;
	onCursorSwayChange?: (amount: number) => void;
	cameraPerspectiveTilt?: number;
	onCameraPerspectiveTiltChange?: (tilt: number) => void;
	borderRadius?: number;
	onBorderRadiusChange?: (radius: number) => void;
	webcam?: WebcamOverlaySettings;
	webcamPreviewSrc?: string | null;
	webcamPreviewCurrentTime?: number;
	webcamPreviewPlaying?: boolean;
	onWebcamChange?: (webcam: WebcamOverlaySettings) => void;
	onUploadWebcam?: () => void;
	onClearWebcam?: () => void;
	padding?: Padding;
	onPaddingChange?: (padding: Padding) => void;
	frame?: string | null;
	onFrameChange?: (frameId: string | null) => void;
	cropRegion?: CropRegion;
	onCropChange?: (region: CropRegion) => void;
	aspectRatio: AspectRatio;
	onAspectRatioChange?: (ratio: AspectRatio) => void;
	selectedAnnotationId?: string | null;
	annotationRegions?: AnnotationRegion[];
	onAnnotationContentChange?: (id: string, content: string) => void;
	onAnnotationTypeChange?: (id: string, type: AnnotationType) => void;
	onAnnotationStyleChange?: (id: string, style: Partial<AnnotationRegion["style"]>) => void;
	onAnnotationFigureDataChange?: (id: string, figureData: FigureData) => void;
	onAnnotationBlurIntensityChange?: (id: string, intensity: number) => void;
	onAnnotationBlurColorChange?: (id: string, color: string) => void;
	onAnnotationAnimationChange?: (
		id: string,
		anim: {
			animationIn?: "none" | "fade" | "slide-up";
			animationOut?: "none" | "fade";
			animationDurationMs?: number;
		},
	) => void;
	onAnnotationLayerChange?: (id: string, changes: Partial<AnnotationRegion>) => void;
	onAnnotationDelete?: (id: string) => void;
	nativeCaptureUnavailableSession?: boolean;
	onOpenNativeCaptureUnavailableModal?: () => void;
}

export function SettingsPanel({
	className,
	style,
	panelMode = "editor",
	activeEffectSection: activeEffectSectionProp,
	recordToolsEnabled = true,
	slides = [],
	onAddAsSlide,
	onImportMedia,
	onUseAsset,
	onRemoveAsset,
	onAudioAdded,
	currentTime = 0,
	selected,
	onWallpaperChange,
	selectedZoomDepth,
	onZoomDepthChange,
	selectedZoomId,
	selectedZoomMode,
	onZoomModeChange,
	onZoomDelete,
	selectedClipId,
	selectedClipSpeed,
	selectedClipMuted,
	selectedClipShowSourceAudio = false,
	hasClipSourceAudio = false,
	onClipSpeedChange,
	onClipMutedChange,
	onClipShowSourceAudioChange,
	sourceAudioTrackMeta = [],
	sourceAudioTrackSettings = {},
	onSourceAudioTrackVolumeChange,
	onSourceAudioTrackNormalizeChange,
	onClipDelete,
	onClipRippleDelete,
	selectedClipTransitionIn = "none",
	selectedClipTransitionInDurationMs = 400,
	onClipTransitionInChange,
	onClipTransitionInDurationChange,
	selectedLayoutId,
	selectedLayoutPreset,
	selectedLayoutTransitionMs,
	selectedLayoutEasing,
	onLayoutPresetChange,
	onLayoutTransitionChange,
	onLayoutEasingChange,
	onLayoutDelete,
	selectedAudioId,
	selectedAudioVolume,
	selectedAudioNormalize,
	selectedAudioDucking,
	onAudioVolumeChange,
	onAudioNormalizeChange,
	onAudioDuckingChange,
	onAudioDelete,
	audioDuckingSettings,
	onAudioDuckingSettingsChange,
	colorGrading,
	onColorGradingChange,
	shadowIntensity = 0.67,
	onShadowChange,
	backgroundBlur = 0,
	onBackgroundBlurChange,
	zoomMotionBlurTuning = DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	onZoomMotionBlurTuningChange,
	connectZooms = true,
	onConnectZoomsChange,
	autoApplyFreshRecordingAutoZooms = true,
	onAutoApplyFreshRecordingAutoZoomsChange,
	zoomInDurationMs = DEFAULT_ZOOM_IN_DURATION_MS,
	onZoomInDurationMsChange,
	zoomOutDurationMs = DEFAULT_ZOOM_OUT_DURATION_MS,
	onZoomOutDurationMsChange,
	showCursor = false,
	onShowCursorChange,
	loopCursor = false,
	onLoopCursorChange,
	cursorStyle = DEFAULT_CURSOR_STYLE,
	onCursorStyleChange,
	cursorSize = 5,
	onCursorSizeChange,
	cursorSmoothing = 2,
	onCursorSmoothingChange,
	cursorSpringStiffnessMultiplier = 1,
	onCursorSpringStiffnessMultiplierChange,
	cursorSpringDampingMultiplier = 1,
	onCursorSpringDampingMultiplierChange,
	cursorSpringMassMultiplier = 1,
	onCursorSpringMassMultiplierChange,
	cameraSpringStiffnessMultiplier = 1,
	onCameraSpringStiffnessMultiplierChange,
	cameraSpringDampingMultiplier = 1.13,
	onCameraSpringDampingMultiplierChange,
	cameraSpringMassMultiplier = 1.12,
	onCameraSpringMassMultiplierChange,
	zoomClassicMode = false,
	onZoomClassicModeChange,
	cursorMotionBlur = DEFAULT_CURSOR_MOTION_BLUR,
	onCursorMotionBlurChange,
	cursorClickBounce = 1,
	onCursorClickBounceChange,
	cursorClickBounceDuration = DEFAULT_CURSOR_CLICK_BOUNCE_DURATION,
	onCursorClickBounceDurationChange,
	cursorSway = DEFAULT_CURSOR_SWAY,
	onCursorSwayChange,
	cameraPerspectiveTilt = DEFAULT_CAMERA_PERSPECTIVE_TILT,
	onCameraPerspectiveTiltChange,
	borderRadius = 12.5,
	onBorderRadiusChange,
	webcam,
	webcamPreviewSrc = null,
	webcamPreviewCurrentTime = 0,
	webcamPreviewPlaying = false,
	onWebcamChange,
	onUploadWebcam,
	onClearWebcam,
	padding = DEFAULT_PADDING,
	onPaddingChange,
	frame = null,
	onFrameChange,
	cropRegion,
	onCropChange,
	aspectRatio,
	onAspectRatioChange,
	selectedAnnotationId,
	annotationRegions = [],
	onAnnotationContentChange,
	onAnnotationTypeChange,
	onAnnotationStyleChange,
	onAnnotationFigureDataChange,
	onAnnotationBlurIntensityChange,
	onAnnotationBlurColorChange,
	onAnnotationAnimationChange,
	onAnnotationLayerChange,
	onAnnotationDelete,
	nativeCaptureUnavailableSession = false,
	onOpenNativeCaptureUnavailableModal,
}: SettingsPanelProps) {
	const tSettings = useScopedT("settings");
	const { locale, setLocale, t } = useI18n();
	const { preference: themePreference, setPreference: setThemePreference } = useTheme();
	const isBackgroundPanel = panelMode === "background";
	const initialEditorPreferences = useMemo(() => loadEditorPreferences(), []);
	const [builtInWallpapers, setBuiltInWallpapers] =
		useState<BuiltInWallpaper[]>(BUILT_IN_WALLPAPERS);
	const [extensionWallpapers, setExtensionWallpapers] = useState<
		ReturnType<typeof extensionHost.getContributedWallpapers>
	>([]);
	const [wallpaperPreviewPaths, setWallpaperPreviewPaths] = useState<string[]>([]);
	const [extensionWallpaperPreviewUrls, setExtensionWallpaperPreviewUrls] = useState<
		Record<string, string>
	>({});
	const builtInWallpaperPaths = useMemo(
		() => builtInWallpapers.map((wallpaper) => wallpaper.publicPath),
		[builtInWallpapers],
	);
	const extensionWallpaperPaths = useMemo(
		() => extensionWallpapers.map((wallpaper) => wallpaper.resolvedUrl),
		[extensionWallpapers],
	);

	useEffect(() => {
		let mounted = true;
		(async () => {
			try {
				const availableWallpapers = await getAvailableWallpapers();
				const resolved = await Promise.all(
					availableWallpapers.map(async (wallpaper) => {
						const assetUrl = await getAssetPath(wallpaper.relativePath);
						// Use tiny thumbnails for the grid; full-res loads on selection
						if (isVideoWallpaperSource(wallpaper.publicPath)) {
							return getRenderableVideoUrl(assetUrl);
						}
						return getWallpaperThumbnailUrl(assetUrl);
					}),
				);
				if (mounted) {
					setBuiltInWallpapers(availableWallpapers);
					setWallpaperPreviewPaths(resolved);
				}
			} catch {
				if (mounted) {
					setBuiltInWallpapers(BUILT_IN_WALLPAPERS);
					setWallpaperPreviewPaths(
						BUILT_IN_WALLPAPERS.map((wallpaper) => wallpaper.publicPath),
					);
				}
			}
		})();
		return () => {
			mounted = false;
		};
	}, []);

	useEffect(() => {
		let cancelled = false;

		const updateExtensionAssets = async () => {
			const wallpapers = extensionHost.getContributedWallpapers();
			const cursorStyles = extensionHost.getContributedCursorStyles();
			const [wallpaperPreviewEntries, cursorPreviewEntries] = await Promise.all([
				Promise.all(
					wallpapers.map(
						async (wallpaper) =>
							[
								wallpaper.id,
								isVideoWallpaperSource(wallpaper.resolvedThumbnailUrl)
									? wallpaper.resolvedThumbnailUrl
									: await getWallpaperThumbnailUrl(
											wallpaper.resolvedThumbnailUrl,
										),
							] as const,
					),
				),
				Promise.all(
					cursorStyles.map(
						async (cursorStyle) =>
							[
								cursorStyle.id,
								await getRenderableAssetUrl(cursorStyle.resolvedDefaultUrl),
							] as const,
					),
				),
			]);

			if (cancelled) {
				return;
			}

			setExtensionWallpapers(wallpapers);
			setExtensionWallpaperPreviewUrls(Object.fromEntries(wallpaperPreviewEntries));
			setExtensionCursorStyles(cursorStyles);
			setExtensionCursorPreviewUrls(Object.fromEntries(cursorPreviewEntries));
		};

		void updateExtensionAssets();
		const unsubscribe = extensionHost.onChange(() => {
			void updateExtensionAssets();
		});

		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, []);
	const colorPalette = [
		"#FF0000",
		"#FFD700",
		"#00FF00",
		"#FFFFFF",
		"#0000FF",
		"#FF6B00",
		"#9B59B6",
		"#E91E63",
		"#00BCD4",
		"#FF5722",
		"#8BC34A",
		"#FFC107",
		"#2563EB",
		"#000000",
		"#607D8B",
		"#795548",
	];

	// Device frames from extension system
	const [availableFrames, setAvailableFrames] = useState<FrameInstance[]>([]);
	useEffect(() => {
		const update = () => setAvailableFrames(extensionHost.getFrames());
		update();
		return extensionHost.onChange(update);
	}, []);

	// Extension-contributed settings panels
	const [extensionPanels, setExtensionPanels] = useState<
		ReturnType<typeof extensionHost.getSettingsPanels>
	>([]);
	useEffect(() => {
		const update = () => setExtensionPanels(extensionHost.getSettingsPanels());
		update();
		return extensionHost.onChange(update);
	}, []);

	const renderExtensionPanelsForSections = (...sections: string[]) =>
		extensionPanels
			.filter((panel) => {
				const parentSection = panel.panel.parentSection;
				return parentSection ? sections.includes(parentSection) : false;
			})
			.map((panel) => (
				<ExtensionSettingsSection
					key={`${panel.extensionId}/${panel.panel.id}`}
					extensionId={panel.extensionId}
					label={panel.panel.label}
					fields={panel.panel.fields}
				/>
			));

	const defaultWebcam = initialEditorPreferences.webcam;
	const [internalActiveEffectSection] = useState<EditorEffectSection>("scene");
	const rawActiveEffectSection = activeEffectSectionProp ?? internalActiveEffectSection;
	const activeEffectSection: EditorEffectSection =
		!recordToolsEnabled &&
		["scene", "layout", "zoom", "cursor", "webcam", "frame", "crop"].includes(
			rawActiveEffectSection,
		)
			? "media"
			: rawActiveEffectSection;
	const [extensionCursorStyles, setExtensionCursorStyles] = useState<
		ReturnType<typeof extensionHost.getContributedCursorStyles>
	>([]);
	const [builtInCursorPreviewUrls, setBuiltInCursorPreviewUrls] = useState<
		Partial<Record<string, string>>
	>({});
	const [extensionCursorPreviewUrls, setExtensionCursorPreviewUrls] = useState<
		Partial<Record<string, string>>
	>({});
	const cursorPreviewUrls = useMemo(
		() => ({ ...builtInCursorPreviewUrls, ...extensionCursorPreviewUrls }),
		[builtInCursorPreviewUrls, extensionCursorPreviewUrls],
	);
	const showDevMotionControls = import.meta.env.DEV;
	const cursorStyleOptions = useMemo<CursorStyleOption[]>(
		() => [
			...BUILTIN_CURSOR_STYLE_OPTIONS,
			...extensionCursorStyles.map((cursorStyle) => ({
				value: cursorStyle.id as CursorStyle,
				label: cursorStyle.cursorStyle.label,
			})),
		],
		[extensionCursorStyles],
	);

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			try {
				const macosPreview = cursorSetAssets.macos.arrow.url;
				const tahoePreview = cursorSetAssets.tahoe.arrow.url;
				const minimalPreview = await createTrimmedSvgPreview(minimalCursorUrl, 512);
				const invertedPreview = await createInvertedPreview(tahoePreview);

				if (!cancelled) {
					setBuiltInCursorPreviewUrls({
						macos: macosPreview,
						tahoe: tahoePreview,
						figma: minimalPreview,
						"tahoe-inverted": invertedPreview,
					});
				}
			} catch {
				if (!cancelled) {
					setBuiltInCursorPreviewUrls({
						macos: tahoeCursorUrl,
						tahoe: tahoeCursorUrl,
						figma: minimalCursorUrl,
						"tahoe-inverted": tahoeCursorUrl,
					});
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	const webcamPositionPreset = webcam?.positionPreset ?? DEFAULT_WEBCAM_POSITION_PRESET;
	const webcamPositionX = webcam?.positionX ?? DEFAULT_WEBCAM_POSITION_X;
	const webcamPositionY = webcam?.positionY ?? DEFAULT_WEBCAM_POSITION_Y;
	const webcamCrop = normalizeWebcamCropRegion(webcam?.cropRegion);
	const webcamFileName = webcam?.sourcePath?.split(/[\\/]/).pop() ?? null;

	const resetZoomSection = () => {
		onZoomMotionBlurTuningChange?.(initialEditorPreferences.zoomMotionBlurTuning);
		onCameraSpringStiffnessMultiplierChange?.(
			initialEditorPreferences.cameraSpringStiffnessMultiplier,
		);
		onCameraSpringDampingMultiplierChange?.(
			initialEditorPreferences.cameraSpringDampingMultiplier,
		);
		onCameraSpringMassMultiplierChange?.(initialEditorPreferences.cameraSpringMassMultiplier);
		onZoomInDurationMsChange?.(initialEditorPreferences.zoomInDurationMs);
		onZoomOutDurationMsChange?.(initialEditorPreferences.zoomOutDurationMs);
		onZoomClassicModeChange?.(false);
	};

	const resetCursorSection = () => {
		onShowCursorChange?.(initialEditorPreferences.showCursor);
		onLoopCursorChange?.(initialEditorPreferences.loopCursor);
		onCursorStyleChange?.(initialEditorPreferences.cursorStyle);
		onCursorSizeChange?.(initialEditorPreferences.cursorSize);
		onCursorSmoothingChange?.(initialEditorPreferences.cursorSmoothing);
		onCursorSpringStiffnessMultiplierChange?.(
			initialEditorPreferences.cursorSpringStiffnessMultiplier,
		);
		onCursorSpringDampingMultiplierChange?.(
			initialEditorPreferences.cursorSpringDampingMultiplier,
		);
		onCursorSpringMassMultiplierChange?.(initialEditorPreferences.cursorSpringMassMultiplier);
		onCursorMotionBlurChange?.(initialEditorPreferences.cursorMotionBlur);
		onCursorClickBounceChange?.(initialEditorPreferences.cursorClickBounce);
		onCursorClickBounceDurationChange?.(DEFAULT_CURSOR_CLICK_BOUNCE_DURATION);
		onCursorSwayChange?.(initialEditorPreferences.cursorSway);
		onCameraPerspectiveTiltChange?.(
			initialEditorPreferences.cameraPerspectiveTilt ?? DEFAULT_CAMERA_PERSPECTIVE_TILT,
		);
	};

	const activeMotionPresetId = useMemo(() => {
		return (
			getMatchingCursorMotionPresetId({
				zoomInDurationMs,
				zoomOutDurationMs,
				cursorSize,
				cursorSmoothing,
				cursorSpringStiffnessMultiplier,
				cursorSpringDampingMultiplier,
				cursorSpringMassMultiplier,
				cursorMotionBlur,
				cursorClickBounce,
				cursorClickBounceDuration,
			}) ?? "focused"
		);
	}, [
		cursorClickBounce,
		cursorClickBounceDuration,
		cursorMotionBlur,
		cursorSize,
		cursorSmoothing,
		cursorSpringDampingMultiplier,
		cursorSpringMassMultiplier,
		cursorSpringStiffnessMultiplier,
		zoomInDurationMs,
		zoomOutDurationMs,
	]);

	const applyMotionPreset = (presetId: CursorMotionPresetId) => {
		const preset = CURSOR_MOTION_PRESETS[presetId];
		onZoomInDurationMsChange?.(preset.zoomInDurationMs);
		onZoomOutDurationMsChange?.(preset.zoomOutDurationMs);
		onCursorSizeChange?.(preset.cursorSize);
		onCursorSmoothingChange?.(preset.cursorSmoothing);
		onCursorSpringStiffnessMultiplierChange?.(preset.cursorSpringStiffnessMultiplier);
		onCursorSpringDampingMultiplierChange?.(preset.cursorSpringDampingMultiplier);
		onCursorSpringMassMultiplierChange?.(preset.cursorSpringMassMultiplier);
		onCursorMotionBlurChange?.(preset.cursorMotionBlur);
		onCursorClickBounceChange?.(preset.cursorClickBounce);
		onCursorClickBounceDurationChange?.(preset.cursorClickBounceDuration);
	};

	const resetWebcamSection = () => {
		if (!onWebcamChange) return;
		onWebcamChange({ ...defaultWebcam });
	};

	const updateWebcam = (patch: Partial<WebcamOverlaySettings>) => {
		if (!webcam || !onWebcamChange) return;
		onWebcamChange({ ...webcam, ...patch });
	};

	const applyWebcamPositionPreset = (preset: WebcamPositionPreset) => {
		if (!webcam) return;

		if (preset === "custom") {
			updateWebcam({ positionPreset: "custom" });
			return;
		}

		const position = getWebcamPositionForPreset(preset);
		updateWebcam({
			positionPreset: preset,
			positionX: position.x,
			positionY: position.y,
			corner: resolveWebcamCorner(preset, webcam.corner),
		});
	};

	// Find selected annotation
	const selectedAnnotation = selectedAnnotationId
		? annotationRegions.find((a) => a.id === selectedAnnotationId)
		: null;

	// If an annotation is selected, show annotation settings instead
	if (
		!isBackgroundPanel &&
		selectedAnnotation &&
		onAnnotationContentChange &&
		onAnnotationTypeChange &&
		onAnnotationStyleChange &&
		onAnnotationDelete
	) {
		return (
			<AnnotationSettingsPanel
				annotation={selectedAnnotation}
				onContentChange={(content) =>
					onAnnotationContentChange(selectedAnnotation.id, content)
				}
				onTypeChange={(type) => onAnnotationTypeChange(selectedAnnotation.id, type)}
				onStyleChange={(style) => onAnnotationStyleChange(selectedAnnotation.id, style)}
				onFigureDataChange={
					onAnnotationFigureDataChange
						? (figureData) =>
								onAnnotationFigureDataChange(selectedAnnotation.id, figureData)
						: undefined
				}
				onBlurIntensityChange={
					onAnnotationBlurIntensityChange
						? (intensity) =>
								onAnnotationBlurIntensityChange(selectedAnnotation.id, intensity)
						: undefined
				}
				onBlurColorChange={
					onAnnotationBlurColorChange
						? (color) => onAnnotationBlurColorChange(selectedAnnotation.id, color)
						: undefined
				}
				onAnimationChange={
					onAnnotationAnimationChange
						? (anim) => onAnnotationAnimationChange(selectedAnnotation.id, anim)
						: undefined
				}
				onLayerChange={
					onAnnotationLayerChange
						? (changes) => onAnnotationLayerChange(selectedAnnotation.id, changes)
						: undefined
				}
				currentTimeMs={Math.round(currentTime * 1000)}
				onDelete={() => onAnnotationDelete(selectedAnnotation.id)}
			/>
		);
	}

	const sceneSectionContent = (
		<SceneSection
			selected={selected}
			onWallpaperChange={onWallpaperChange}
			backgroundBlur={backgroundBlur}
			onBackgroundBlurChange={onBackgroundBlurChange}
			shadowIntensity={shadowIntensity}
			onShadowChange={onShadowChange}
			borderRadius={borderRadius}
			onBorderRadiusChange={onBorderRadiusChange}
			padding={padding}
			onPaddingChange={onPaddingChange}
			frame={frame}
			onFrameChange={onFrameChange}
			cropRegion={cropRegion}
			onCropChange={onCropChange}
			aspectRatio={aspectRatio}
			onAspectRatioChange={onAspectRatioChange}
			initialEditorPreferences={initialEditorPreferences}
			builtInWallpapers={builtInWallpapers}
			builtInWallpaperPaths={builtInWallpaperPaths}
			wallpaperPreviewPaths={wallpaperPreviewPaths}
			extensionWallpapers={extensionWallpapers}
			extensionWallpaperPaths={extensionWallpaperPaths}
			extensionWallpaperPreviewUrls={extensionWallpaperPreviewUrls}
			colorPalette={colorPalette}
			availableFrames={availableFrames}
			tSettings={tSettings}
			t={t}
			renderExtensionPanels={() =>
				renderExtensionPanelsForSections("scene", "appearance", "frame", "crop")
			}
		/>
	);

	if (isBackgroundPanel) {
		return (
			<div className="flex-[2] w-[332px] min-w-[280px] max-w-[332px] bg-editor-panel rounded-2xl flex flex-col shadow-xl h-full overflow-hidden">
				<div
					className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 pb-0"
					style={{ scrollbarGutter: "stable" }}
				>
					<div className="mb-4 flex items-center gap-2">
						<Palette className="w-4 h-4 text-[#2563EB]" />
						<span className="text-sm font-medium text-foreground">
							{tSettings("background.title")}
						</span>
					</div>
					{sceneSectionContent}
				</div>
			</div>
		);
	}

	const effectSectionContent = (() => {
		switch (activeEffectSection) {
			case "media":
				return (
					<MediaSection
						slides={slides}
						selectedClipId={selectedClipId}
						onAddAsSlide={onAddAsSlide}
						onImportMedia={onImportMedia}
						onUseAsset={onUseAsset}
						onRemoveAsset={onRemoveAsset}
						tSettings={tSettings}
					/>
				);
			case "audio-record":
				return (
					<AudioRecordSection
						currentTime={currentTime}
						activeSlideId={selectedClipId}
						onAudioAdded={onAudioAdded}
						selectedAudioId={selectedAudioId}
						selectedAudioVolume={selectedAudioVolume}
						selectedAudioNormalize={selectedAudioNormalize}
						selectedAudioDucking={selectedAudioDucking}
						onAudioVolumeChange={onAudioVolumeChange}
						onAudioNormalizeChange={onAudioNormalizeChange}
						onAudioDuckingChange={onAudioDuckingChange}
						onAudioDelete={onAudioDelete}
						audioDuckingSettings={audioDuckingSettings}
						onAudioDuckingSettingsChange={onAudioDuckingSettingsChange}
						tSettings={tSettings}
						t={t}
					/>
				);
			case "video-adjust":
				return (
					<VideoAdjustSection
						selectedClipSpeed={selectedClipSpeed}
						onClipSpeedChange={onClipSpeedChange}
						selectedClipMuted={selectedClipMuted}
						onClipMutedChange={onClipMutedChange}
						hasClipSourceAudio={hasClipSourceAudio}
						selectedClipShowSourceAudio={selectedClipShowSourceAudio}
						onClipShowSourceAudioChange={onClipShowSourceAudioChange}
						selectedClipId={selectedClipId}
						sourceAudioTrackMeta={sourceAudioTrackMeta}
						sourceAudioTrackSettings={sourceAudioTrackSettings}
						onSourceAudioTrackVolumeChange={onSourceAudioTrackVolumeChange}
						onSourceAudioTrackNormalizeChange={onSourceAudioTrackNormalizeChange}
						selectedClipTransitionIn={selectedClipTransitionIn}
						selectedClipTransitionInDurationMs={selectedClipTransitionInDurationMs}
						onClipTransitionInChange={onClipTransitionInChange}
						onClipTransitionInDurationChange={onClipTransitionInDurationChange}
						aspectRatio={aspectRatio}
						onAspectRatioChange={onAspectRatioChange}
						padding={padding}
						onPaddingChange={onPaddingChange}
						borderRadius={borderRadius}
						onBorderRadiusChange={onBorderRadiusChange}
						shadowIntensity={shadowIntensity}
						onShadowChange={onShadowChange}
						tSettings={tSettings}
						t={t}
					/>
				);
			case "transitions":
				return (
					<TransitionsSection
						selectedClipTransitionIn={selectedClipTransitionIn}
						selectedClipTransitionInDurationMs={selectedClipTransitionInDurationMs}
						onClipTransitionInChange={onClipTransitionInChange}
						onClipTransitionInDurationChange={onClipTransitionInDurationChange}
						tSettings={tSettings}
					/>
				);
			case "settings":
				return (
					<GeneralPreferencesSection
						themePreference={themePreference}
						setThemePreference={setThemePreference}
						locale={locale}
						setLocale={setLocale}
						autoApplyFreshRecordingAutoZooms={autoApplyFreshRecordingAutoZooms}
						onAutoApplyFreshRecordingAutoZoomsChange={
							onAutoApplyFreshRecordingAutoZoomsChange
						}
						connectZooms={connectZooms}
						onConnectZoomsChange={onConnectZoomsChange}
						activeMotionPresetId={activeMotionPresetId}
						applyMotionPreset={applyMotionPreset}
						showDevMotionControls={showDevMotionControls}
						nativeCaptureUnavailableSession={nativeCaptureUnavailableSession}
						onOpenNativeCaptureUnavailableModal={onOpenNativeCaptureUnavailableModal}
						zoomMotionBlurTuning={zoomMotionBlurTuning}
						onZoomMotionBlurTuningChange={onZoomMotionBlurTuningChange}
						initialEditorPreferences={initialEditorPreferences}
						cameraSpringStiffnessMultiplier={cameraSpringStiffnessMultiplier}
						onCameraSpringStiffnessMultiplierChange={
							onCameraSpringStiffnessMultiplierChange
						}
						cameraSpringDampingMultiplier={cameraSpringDampingMultiplier}
						onCameraSpringDampingMultiplierChange={
							onCameraSpringDampingMultiplierChange
						}
						cameraSpringMassMultiplier={cameraSpringMassMultiplier}
						onCameraSpringMassMultiplierChange={onCameraSpringMassMultiplierChange}
						cursorSpringStiffnessMultiplier={cursorSpringStiffnessMultiplier}
						onCursorSpringStiffnessMultiplierChange={
							onCursorSpringStiffnessMultiplierChange
						}
						cursorSpringDampingMultiplier={cursorSpringDampingMultiplier}
						onCursorSpringDampingMultiplierChange={
							onCursorSpringDampingMultiplierChange
						}
						cursorSpringMassMultiplier={cursorSpringMassMultiplier}
						onCursorSpringMassMultiplierChange={onCursorSpringMassMultiplierChange}
						tSettings={tSettings}
						t={t}
					/>
				);
			case "scene":
				return sceneSectionContent;
			case "zoom":
				return (
					<ZoomItemSection
						selectedZoomId={selectedZoomId}
						selectedZoomDepth={selectedZoomDepth}
						selectedZoomMode={selectedZoomMode}
						onZoomDepthChange={onZoomDepthChange}
						onZoomModeChange={onZoomModeChange}
						onZoomDelete={onZoomDelete}
						zoomClassicMode={zoomClassicMode}
						onZoomClassicModeChange={onZoomClassicModeChange}
						resetZoomSection={resetZoomSection}
						showDevMotionControls={showDevMotionControls}
						renderExtensionPanelsForSections={renderExtensionPanelsForSections}
						tSettings={tSettings}
						t={t}
					/>
				);
			case "clip":
				return (
					<ClipItemSection
						selectedClipSpeed={selectedClipSpeed}
						onClipSpeedChange={onClipSpeedChange}
						selectedClipMuted={selectedClipMuted}
						onClipMutedChange={onClipMutedChange}
						hasClipSourceAudio={hasClipSourceAudio}
						selectedClipShowSourceAudio={selectedClipShowSourceAudio}
						onClipShowSourceAudioChange={onClipShowSourceAudioChange}
						selectedClipId={selectedClipId}
						sourceAudioTrackMeta={sourceAudioTrackMeta}
						sourceAudioTrackSettings={sourceAudioTrackSettings}
						onSourceAudioTrackVolumeChange={onSourceAudioTrackVolumeChange}
						onSourceAudioTrackNormalizeChange={onSourceAudioTrackNormalizeChange}
						selectedClipTransitionIn={selectedClipTransitionIn}
						selectedClipTransitionInDurationMs={selectedClipTransitionInDurationMs}
						onClipTransitionInChange={onClipTransitionInChange}
						onClipTransitionInDurationChange={onClipTransitionInDurationChange}
						tSettings={tSettings}
						t={t}
					/>
				);
			case "layout":
				return (
					<LayoutItemSection
						selectedLayoutId={selectedLayoutId}
						selectedLayoutPreset={selectedLayoutPreset}
						selectedLayoutTransitionMs={selectedLayoutTransitionMs}
						selectedLayoutEasing={selectedLayoutEasing}
						onLayoutPresetChange={onLayoutPresetChange}
						onLayoutTransitionChange={onLayoutTransitionChange}
						onLayoutEasingChange={onLayoutEasingChange}
						tSettings={tSettings}
						t={t}
					/>
				);
			case "audio":
				return (
					<AudioTrackSection
						selectedAudioId={selectedAudioId}
						selectedAudioVolume={selectedAudioVolume}
						selectedAudioNormalize={selectedAudioNormalize}
						selectedAudioDucking={selectedAudioDucking}
						onAudioVolumeChange={onAudioVolumeChange}
						onAudioNormalizeChange={onAudioNormalizeChange}
						onAudioDuckingChange={onAudioDuckingChange}
						onAudioDelete={onAudioDelete}
						audioDuckingSettings={audioDuckingSettings}
						onAudioDuckingSettingsChange={onAudioDuckingSettingsChange}
						tSettings={tSettings}
						t={t}
					/>
				);
			case "frame":
			case "crop":
				return sceneSectionContent;
			case "cursor":
				return (
					<CursorSection
						showCursor={showCursor}
						onShowCursorChange={onShowCursorChange}
						loopCursor={loopCursor}
						onLoopCursorChange={onLoopCursorChange}
						cursorStyle={cursorStyle}
						onCursorStyleChange={onCursorStyleChange}
						cursorStyleOptions={cursorStyleOptions}
						cursorPreviewUrls={cursorPreviewUrls}
						cursorSize={cursorSize}
						onCursorSizeChange={onCursorSizeChange}
						cursorSmoothing={cursorSmoothing}
						onCursorSmoothingChange={onCursorSmoothingChange}
						cursorMotionBlur={cursorMotionBlur}
						onCursorMotionBlurChange={onCursorMotionBlurChange}
						cursorClickBounce={cursorClickBounce}
						onCursorClickBounceChange={onCursorClickBounceChange}
						cursorClickBounceDuration={cursorClickBounceDuration}
						onCursorClickBounceDurationChange={onCursorClickBounceDurationChange}
						cursorSway={cursorSway}
						onCursorSwayChange={onCursorSwayChange}
						cameraPerspectiveTilt={cameraPerspectiveTilt}
						onCameraPerspectiveTiltChange={onCameraPerspectiveTiltChange}
						initialEditorPreferences={initialEditorPreferences}
						resetCursorSection={resetCursorSection}
						renderExtensionPanelsForSections={renderExtensionPanelsForSections}
						tSettings={tSettings}
						t={t}
					/>
				);
			case "webcam":
				return (
					<WebcamSection
						webcam={webcam}
						webcamPreviewSrc={webcamPreviewSrc}
						webcamPreviewCurrentTime={webcamPreviewCurrentTime}
						webcamPreviewPlaying={webcamPreviewPlaying}
						onUploadWebcam={onUploadWebcam}
						onClearWebcam={onClearWebcam}
						resetWebcamSection={resetWebcamSection}
						updateWebcam={updateWebcam}
						applyWebcamPositionPreset={applyWebcamPositionPreset}
						webcamCrop={webcamCrop}
						webcamPositionPreset={webcamPositionPreset}
						webcamPositionX={webcamPositionX}
						webcamPositionY={webcamPositionY}
						webcamFileName={webcamFileName}
						renderExtensionPanelsForSections={renderExtensionPanelsForSections}
						tSettings={tSettings}
						t={t}
					/>
				);
			default: {
				// Handle extension-contributed standalone section pages (ext:extensionId/panelId)
				if (activeEffectSection?.startsWith("ext:")) {
					const panels = extensionPanels.filter(
						(p) =>
							!p.panel.parentSection &&
							`ext:${p.extensionId}/${p.panel.id}` === activeEffectSection,
					);
					if (panels.length > 0) {
						const p = panels[0];
						return (
							<section className="flex flex-col gap-2">
								<SectionLabel>{p.panel.label}</SectionLabel>
								<ExtensionSettingsSection
									extensionId={p.extensionId}
									label={p.panel.label}
									fields={p.panel.fields}
								/>
							</section>
						);
					}
				}
				if (!recordToolsEnabled) {
					return (
						<MediaSection
							slides={slides}
							selectedClipId={selectedClipId}
							onAddAsSlide={onAddAsSlide}
							onImportMedia={onImportMedia}
							onUseAsset={onUseAsset}
							onRemoveAsset={onRemoveAsset}
							tSettings={tSettings}
						/>
					);
				}
				return sceneSectionContent;
			}
		}
	})();

	return (
		<div
			className={cn(
				"bg-editor-panel rounded-2xl flex flex-col shadow-xl h-full overflow-hidden",
				className ?? "flex-[2] w-[332px] min-w-[280px] max-w-[332px]",
			)}
			style={style}
		>
			<div
				className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 pb-0"
				style={{ scrollbarGutter: "stable" }}
			>
				<AnimatePresence mode="wait" initial={false}>
					<motion.div
						key={activeEffectSection}
						initial={{ opacity: 0, y: 8 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -8 }}
						transition={{ duration: 0.18, ease: "easeOut" }}
					>
						{effectSectionContent}
					</motion.div>
				</AnimatePresence>
			</div>

			<div
				className={cn(
					"flex-shrink-0 border-t border-foreground/10 bg-editor-panel p-4 pt-3",
					(() => {
						if (activeEffectSection === "clip" && selectedClipId) return false;
						if (
							recordToolsEnabled &&
							activeEffectSection === "layout" &&
							selectedLayoutId
						)
							return false;
						if (recordToolsEnabled && activeEffectSection === "zoom" && selectedZoomId)
							return false;
						if (activeEffectSection === "audio" && selectedAudioId) return false;
						if (selectedAnnotationId) return false; // Annotation editor handles its own but let's see
						return true;
					})() && "hidden",
				)}
			>
				{activeEffectSection === "clip" && selectedClipId && (
					<div className="flex items-center gap-2 w-full">
						<Button
							onClick={() => {
								if (selectedClipId && onClipRippleDelete) {
									onClipRippleDelete(selectedClipId);
								} else if (selectedClipId && onClipDelete) {
									onClipDelete(selectedClipId);
								}
							}}
							variant="destructive"
							size="sm"
							className="h-8 flex-1 gap-1.5 border border-red-500/20 bg-red-500/10 text-xs text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20"
							title="Delete clip and close gap (Shift+Del)"
						>
							<Trash2 className="h-3 w-3" />
							{tSettings("clip.rippleDelete", "Ripple Delete")}
						</Button>
						<Button
							onClick={() => {
								if (selectedClipId && onClipDelete) onClipDelete(selectedClipId);
							}}
							variant="ghost"
							size="sm"
							className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
							title="Delete clip and leave gap"
						>
							{tSettings("clip.delete", "Delete")}
						</Button>
					</div>
				)}
				{recordToolsEnabled && activeEffectSection === "zoom" && selectedZoomId && (
					<Button
						onClick={() => {
							if (selectedZoomId && onZoomDelete) onZoomDelete(selectedZoomId);
						}}
						variant="destructive"
						size="sm"
						className="h-8 w-full gap-2 border border-red-500/20 bg-red-500/10 text-xs text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20"
					>
						<Trash2 className="h-3 w-3" />
						{tSettings("zoom.deleteZoom", "Delete Zoom")}
					</Button>
				)}
				{recordToolsEnabled && activeEffectSection === "layout" && selectedLayoutId && (
					<Button
						onClick={() => {
							if (selectedLayoutId && onLayoutDelete)
								onLayoutDelete(selectedLayoutId);
						}}
						variant="destructive"
						size="sm"
						className="h-8 w-full gap-2 border border-red-500/20 bg-red-500/10 text-xs text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20"
					>
						<Trash2 className="h-3 w-3" />
						{tSettings("layout.delete", "Delete Layout")}
					</Button>
				)}
				{activeEffectSection === "audio" && selectedAudioId && (
					<Button
						onClick={() => {
							if (selectedAudioId && onAudioDelete) onAudioDelete(selectedAudioId);
						}}
						variant="destructive"
						size="sm"
						className="h-8 w-full gap-2 border border-red-500/20 bg-red-500/10 text-xs text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20"
					>
						<Trash2 className="h-3 w-3" />
						{tSettings("audio.deleteRegion", "Delete Audio")}
					</Button>
				)}
				{selectedAnnotationId && (
					<Button
						onClick={() => {
							if (selectedAnnotationId && onAnnotationDelete)
								onAnnotationDelete(selectedAnnotationId);
						}}
						variant="destructive"
						size="sm"
						className="h-8 w-full gap-2 border border-red-500/20 bg-red-500/10 text-xs text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20"
					>
						<Trash2 className="h-3 w-3" />
						{tSettings("annotation.delete", "Delete Annotation")}
					</Button>
				)}
			</div>
		</div>
	);
}
