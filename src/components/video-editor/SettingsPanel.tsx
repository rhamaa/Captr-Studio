import {
	ArrowsLeftRight,
	Check,
	CursorClick,
	SquaresFour as LayoutIcon,
	Microphone,
	Palette,
	Pause,
	Play,
	PresentationChart,
	Sparkle,
	Trash as Trash2,
	UploadSimple as Upload,
	X,
} from "@phosphor-icons/react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import minimalCursorUrl from "@/assets/cursors/custom/minimal-cursor.svg";
import { Button } from "@/components/ui/button";
import { AssetExplorer } from "./assets/AssetExplorer";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useTheme } from "@/contexts/ThemeContext";
import {
	getAssetPath,
	getRenderableAssetUrl,
	getRenderableVideoUrl,
	getWallpaperThumbnailUrl,
} from "@/lib/assetPath";
import {
	TEMPORAL_MOTION_BLUR_DEFAULT_SAMPLE_COUNT,
	TEMPORAL_MOTION_BLUR_DEFAULT_SHUTTER_FRACTION,
} from "@/lib/exporter/temporalMotionBlur";
import type { ExtensionSettingField } from "@/lib/extensions";
import { extensionHost, type FrameInstance } from "@/lib/extensions";
import { cn } from "@/lib/utils";
import type { BuiltInWallpaper } from "@/lib/wallpapers";
import {
	BUILT_IN_WALLPAPERS,
	getAvailableWallpapers,
	isVideoWallpaperSource,
} from "@/lib/wallpapers";
import { type AspectRatio } from "@/utils/aspectRatioUtils";
import { useI18n, useScopedT } from "../../contexts/I18nContext";
import type { AppLocale } from "../../i18n/config";
import { SUPPORTED_LOCALES } from "../../i18n/config";
import { AnnotationSettingsPanel } from "./AnnotationSettingsPanel";
import { COLOR_FILTER_PRESETS } from "./colorGrading";
import {
	CURSOR_MOTION_PRESETS,
	type CursorMotionPresetId,
	getMatchingCursorMotionPresetId,
} from "./cursorMotionPresets";
import { loadEditorPreferences, saveEditorPreferences } from "./editorPreferences";
import {
	getLayoutSceneCategory,
	LAYOUT_SCENE_CATEGORIES,
	LAYOUT_SCENE_CATEGORY_DETAILS,
} from "./layoutScenes";
import { SliderControl } from "./SliderControl";
import { KeyboardShortcutsDialog } from "./TutorialHelp";
import type {
	AnnotationRegion,
	AnnotationType,
	AudioDuckingSettings,
	AutoCaptionAnimation,
	AutoCaptionSettings,
	CaptionCue,
	CaptionHighlightStyle,
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
	DEFAULT_AUTO_CAPTION_SETTINGS,
	DEFAULT_CAMERA_PERSPECTIVE_TILT,
	DEFAULT_COLOR_GRADING,
	DEFAULT_CROP_REGION,
	DEFAULT_CURSOR_CLICK_BOUNCE,
	DEFAULT_CURSOR_CLICK_BOUNCE_DURATION,
	DEFAULT_CURSOR_MOTION_BLUR,
	DEFAULT_CURSOR_SIZE,
	DEFAULT_CURSOR_STYLE,
	DEFAULT_CURSOR_SWAY,
	DEFAULT_PADDING,
	DEFAULT_WEBCAM_CORNER_RADIUS,
	DEFAULT_WEBCAM_MARGIN,
	DEFAULT_WEBCAM_POSITION_PRESET,
	DEFAULT_WEBCAM_POSITION_X,
	DEFAULT_WEBCAM_POSITION_Y,
	DEFAULT_WEBCAM_REACT_TO_ZOOM,
	DEFAULT_WEBCAM_SHADOW,
	DEFAULT_WEBCAM_SIZE,
	DEFAULT_ZOOM_IN_DURATION_MS,
	DEFAULT_ZOOM_MOTION_BLUR_TUNING,
	DEFAULT_ZOOM_OUT_DURATION_MS,
} from "./types";
import { fromCursorSwaySliderValue, toCursorSwaySliderValue } from "./videoPlayback/cursorSway";
import { isZeroPadding } from "./videoPlayback/layoutUtils";
import {
	cursorSetAssets,
	getCursorStyleSizeMultiplier,
} from "./videoPlayback/uploadedCursorAssets";
import { WebcamCropControl } from "./WebcamCropControl";
import {
	getWebcamPositionForPreset,
	normalizeWebcamCropRegion,
	resolveWebcamCorner,
} from "./webcamOverlay";

const tahoeCursorUrl = cursorSetAssets.tahoe.arrow.url;
const BUILTIN_CURSOR_PREVIEW_SIZE = 28;
const BUILTIN_CURSOR_PREVIEW_FRAME_SIZE = 48;

function getStepPrecision(step: number): number {
	if (!Number.isFinite(step) || step <= 0) return 0;
	const [mantissa = "0", exponentPart = "0"] = step.toExponential().split("e");
	const exponent = Number.parseInt(exponentPart, 10);
	const mantissaDecimals = (mantissa.split(".")[1] ?? "").replace(/0+$/, "").length;
	const precision = exponent < 0 ? Math.max(0, -exponent + mantissaDecimals) : mantissaDecimals;
	return Math.min(12, precision);
}

const GRADIENTS = [
	"linear-gradient( 111.6deg,  rgba(114,167,232,1) 9.4%, rgba(253,129,82,1) 43.9%, rgba(253,129,82,1) 54.8%, rgba(249,202,86,1) 86.3% )",
	"linear-gradient(120deg, #d4fc79 0%, #96e6a1 100%)",
	"radial-gradient( circle farthest-corner at 3.2% 49.6%,  rgba(80,12,139,0.87) 0%, rgba(161,10,144,0.72) 83.6% )",
	"linear-gradient( 111.6deg,  rgba(0,56,68,1) 0%, rgba(163,217,185,1) 51.5%, rgba(231, 148, 6, 1) 88.6% )",
	"linear-gradient( 107.7deg,  rgba(235,230,44,0.55) 8.4%, rgba(252,152,15,1) 90.3% )",
	"linear-gradient( 91deg,  rgba(72,154,78,1) 5.2%, rgba(251,206,70,1) 95.9% )",
	"radial-gradient( circle farthest-corner at 10% 20%,  rgba(2,37,78,1) 0%, rgba(4,56,126,1) 19.7%, rgba(85,245,221,1) 100.2% )",
	"linear-gradient( 109.6deg,  rgba(15,2,2,1) 11.2%, rgba(36,163,190,1) 91.1% )",
	"linear-gradient(135deg, #FBC8B4, #2447B1)",
	"linear-gradient(109.6deg, #F635A6, #36D860)",
	"linear-gradient(90deg, #FF0101, #4DFF01)",
	"linear-gradient(315deg, #EC0101, #5044A9)",
	"linear-gradient(45deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%)",
	"linear-gradient(to top, #a18cd1 0%, #fbc2eb 100%)",
	"linear-gradient(to right, #ff8177 0%, #ff867a 0%, #ff8c7f 21%, #f99185 52%, #cf556c 78%, #b12a5b 100%)",
	"linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)",
	"linear-gradient(to right, #4facfe 0%, #00f2fe 100%)",
	"linear-gradient(to top, #fcc5e4 0%, #fda34b 15%, #ff7882 35%, #c8699e 52%, #7046aa 71%, #0c1db8 87%, #020f75 100%)",
	"linear-gradient(to right, #fa709a 0%, #fee140 100%)",
	"linear-gradient(to top, #30cfd0 0%, #330867 100%)",
	"linear-gradient(to top, #c471f5 0%, #fa71cd 100%)",
	"linear-gradient(to right, #f78ca0 0%, #f9748f 19%, #fd868c 60%, #fe9a8b 100%)",
	"linear-gradient(to top, #48c6ef 0%, #6f86d6 100%)",
	"linear-gradient(to right, #0acffe 0%, #495aff 100%)",
];

const CAPTION_ANIMATION_OPTIONS: Array<{ value: AutoCaptionAnimation; label: string }> = [
	{ value: "none", label: "Off" },
	{ value: "fade", label: "Fade" },
	{ value: "rise", label: "Rise" },
	{ value: "pop", label: "Pop" },
];

const CAPTION_HIGHLIGHT_STYLE_OPTIONS: Array<{ value: CaptionHighlightStyle; label: string }> = [
	{ value: "karaoke-pop", label: "Karaoke Pop (Zoom & Highlight)" },
	{ value: "hormozi", label: "Alex Hormozi (Bold Contrast)" },
	{ value: "neon-glow", label: "Neon Glow (Cyberpunk)" },
	{ value: "box-highlight", label: "Box Pill (Filled Pill)" },
	{ value: "classic", label: "Classic (Color Transition)" },
];

const CAPTION_HIGHLIGHT_COLOR_PRESETS = [
	{ name: "Neon Yellow", value: "#FFE600" },
	{ name: "Lime Green", value: "#22C55E" },
	{ name: "Electric Cyan", value: "#06B6D4" },
	{ name: "Hot Pink", value: "#EC4899" },
	{ name: "Flame Orange", value: "#F97316" },
];

type BackgroundTab = "image" | "video" | "color" | "gradient";
function isHexWallpaper(value: string): boolean {
	return /^#(?:[0-9a-f]{3}){1,2}$/i.test(value);
}

function getBackgroundTabForWallpaper(value: string): BackgroundTab {
	if (GRADIENTS.includes(value)) {
		return "gradient";
	}

	if (isHexWallpaper(value)) {
		return "color";
	}

	if (isVideoWallpaperSource(value)) {
		return "video";
	}

	return "image";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
			{children}
		</p>
	);
}

function WallpaperVideoPreview({ src }: { src: string }) {
	const [resolvedSrc, setResolvedSrc] = useState(src);

	useEffect(() => {
		let cancelled = false;
		setResolvedSrc(src);

		void (async () => {
			try {
				const nextSrc = await getRenderableVideoUrl(src);
				if (!cancelled) {
					setResolvedSrc(nextSrc);
				}
			} catch {
				if (!cancelled) {
					setResolvedSrc(src);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [src]);

	return (
		<video
			src={resolvedSrc}
			muted
			playsInline
			preload="metadata"
			className="h-full w-full select-none object-cover [transform:translateZ(0)]"
			draggable={false}
			onMouseEnter={(e) => e.currentTarget.play().catch(() => undefined)}
			onMouseLeave={(e) => {
				e.currentTarget.pause();
				e.currentTarget.currentTime = 0;
			}}
		/>
	);
}

/**
 * Renders extension-contributed settings fields (toggle, slider, select, color, text).
 */
function ExtensionSettingsSection({
	extensionId,
	label,
	fields,
}: {
	extensionId: string;
	label: string;
	fields: ExtensionSettingField[];
}) {
	const [, forceUpdate] = useState(0);

	return (
		<div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-foreground/[0.06]">
			<p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
				{label}
			</p>
			{fields.map((field) => {
				const value =
					extensionHost.getExtensionSetting(extensionId, field.id) ?? field.defaultValue;

				if (field.type === "toggle") {
					return (
						<div
							key={field.id}
							className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5"
						>
							<span className="text-[11px] text-muted-foreground">{field.label}</span>
							<Switch
								checked={Boolean(value)}
								onCheckedChange={(checked) => {
									extensionHost.setExtensionSetting(
										extensionId,
										field.id,
										checked,
									);
									forceUpdate((n) => n + 1);
								}}
								className="data-[state=checked]:bg-[#2563EB] scale-75"
							/>
						</div>
					);
				}

				if (field.type === "slider") {
					const step = field.step ?? 0.01;
					const precision = getStepPrecision(step);
					return (
						<div key={field.id} className="mt-1">
							<SliderControl
								label={field.label}
								value={
									typeof value === "number"
										? value
										: (field.defaultValue as number)
								}
								defaultValue={field.defaultValue as number}
								min={field.min ?? 0}
								max={field.max ?? 1}
								step={step}
								onChange={(v) => {
									extensionHost.setExtensionSetting(extensionId, field.id, v);
									forceUpdate((n) => n + 1);
								}}
								formatValue={(v) => v.toFixed(precision)}
								parseInput={(text) => parseFloat(text)}
							/>
						</div>
					);
				}

				if (field.type === "select" && field.options) {
					return (
						<div
							key={field.id}
							className="flex items-center justify-between gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-1.5"
						>
							<span className="text-[11px] text-muted-foreground flex-shrink-0">
								{field.label}
							</span>
							<Select
								value={String(value)}
								onValueChange={(v) => {
									extensionHost.setExtensionSetting(extensionId, field.id, v);
									forceUpdate((n) => n + 1);
								}}
							>
								<SelectTrigger className="h-6 w-24 text-[10px] border-foreground/10 bg-foreground/[0.03]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{field.options.map((opt) => (
										<SelectItem
											key={opt.value}
											value={opt.value}
											className="text-[10px]"
										>
											{opt.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					);
				}

				if (field.type === "color") {
					return (
						<div
							key={field.id}
							className="flex items-center justify-between gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-1.5"
						>
							<span className="text-[11px] text-muted-foreground flex-shrink-0">
								{field.label}
							</span>
							<input
								type="color"
								value={String(value)}
								onChange={(e) => {
									extensionHost.setExtensionSetting(
										extensionId,
										field.id,
										e.target.value,
									);
									forceUpdate((n) => n + 1);
								}}
								className="w-7 h-5 rounded border border-foreground/10 cursor-pointer bg-transparent"
							/>
						</div>
					);
				}

				if (field.type === "text") {
					return (
						<div
							key={field.id}
							className="flex items-center justify-between gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-1.5"
						>
							<span className="text-[11px] text-muted-foreground flex-shrink-0">
								{field.label}
							</span>
							<input
								type="text"
								value={String(value)}
								onChange={(e) => {
									extensionHost.setExtensionSetting(
										extensionId,
										field.id,
										e.target.value,
									);
									forceUpdate((n) => n + 1);
								}}
								className="w-24 h-6 rounded bg-foreground/[0.06] border border-foreground/10 px-1.5 text-[10px] text-foreground"
							/>
						</div>
					);
				}

				return null;
			})}
		</div>
	);
}

const MOTION_PRESET_ORDER: CursorMotionPresetId[] = ["focused", "smooth"];

function MotionPresetCards({
	title,
	activePresetId,
	onApply,
	tSettings,
}: {
	title: string;
	activePresetId: CursorMotionPresetId | null;
	onApply: (presetId: CursorMotionPresetId) => void;
	tSettings: (key: string, fallback?: string) => string;
}) {
	return (
		<div className="flex flex-col gap-2">
			<div className="text-[10px] text-muted-foreground">{title}</div>
			<div className="grid grid-cols-2 gap-2">
				{MOTION_PRESET_ORDER.map((presetId) => {
					const Icon = presetId === "focused" ? CursorClick : PresentationChart;
					const isActive = activePresetId === presetId;

					return (
						<button
							key={presetId}
							type="button"
							onClick={() => onApply(presetId)}
							className={cn(
								"rounded-xl border px-3 py-3 text-left transition-all",
								"border-foreground/10 bg-foreground/[0.03] hover:border-foreground/20 hover:bg-foreground/[0.06]",
								isActive &&
									"border-[#2563EB]/70 bg-[#2563EB]/12 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.15)]",
							)}
						>
							<div className="flex items-start gap-3">
								<div
									className={cn(
										"mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-foreground/10 bg-black/10 text-muted-foreground",
										isActive &&
											"border-[#2563EB]/30 bg-[#2563EB]/10 text-[#75A6FF]",
									)}
								>
									<Icon className="h-4 w-4" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="text-[12px] font-medium text-foreground">
										{tSettings(`effects.motionPresets.${presetId}.label`)}
									</div>
								</div>
							</div>
							<div className="mt-2 text-[10px] leading-4 text-muted-foreground">
								{tSettings(`effects.motionPresets.${presetId}.description`)}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}

function VoiceoverRecorder({
	onAudioRecorded,
	currentTime = 0,
}: {
	onAudioRecorded?: (span: { start: number; end: number }, audioPath: string) => void;
	currentTime?: number;
}) {
	const [isRecording, setIsRecording] = useState(false);
	const [recordingDuration, setRecordingDuration] = useState(0);
	const [audioLevel, setAudioLevel] = useState(0);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<number | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	const recordStartPlayheadRef = useRef<number>(0);

	const startRecording = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			audioChunksRef.current = [];
			recordStartPlayheadRef.current = currentTime * 1000;

			const audioCtx = new AudioContext();
			audioContextRef.current = audioCtx;
			const source = audioCtx.createMediaStreamSource(stream);
			const analyser = audioCtx.createAnalyser();
			analyser.fftSize = 256;
			source.connect(analyser);
			analyserRef.current = analyser;

			const dataArray = new Uint8Array(analyser.frequencyBinCount);
			const updateMeter = () => {
				if (!analyserRef.current) return;
				analyserRef.current.getByteFrequencyData(dataArray);
				let sum = 0;
				for (let i = 0; i < dataArray.length; i++) {
					sum += dataArray[i];
				}
				const avg = sum / dataArray.length;
				setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
				animationFrameRef.current = requestAnimationFrame(updateMeter);
			};
			updateMeter();

			const recorder = new MediaRecorder(stream);
			mediaRecorderRef.current = recorder;

			recorder.ondataavailable = (e) => {
				if (e.data && e.data.size > 0) {
					audioChunksRef.current.push(e.data);
				}
			};

			recorder.onstop = () => {
				stream.getTracks().forEach((track) => track.stop());
				if (audioContextRef.current) {
					audioContextRef.current.close().catch(() => {});
					audioContextRef.current = null;
				}
				if (animationFrameRef.current) {
					cancelAnimationFrame(animationFrameRef.current);
					animationFrameRef.current = null;
				}
				setAudioLevel(0);

				const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
				const audioUrl = URL.createObjectURL(blob);
				const durationMs = recordingDuration * 1000;
				const startMs = recordStartPlayheadRef.current;
				const endMs = startMs + Math.max(1000, durationMs);

				if (onAudioRecorded && durationMs > 200) {
					onAudioRecorded({ start: startMs, end: endMs }, audioUrl);
					toast.success("Voiceover added to timeline");
				}
			};

			recorder.start(100);
			setIsRecording(true);
			setRecordingDuration(0);

			const startEpoch = Date.now();
			timerRef.current = window.setInterval(() => {
				setRecordingDuration(Math.round((Date.now() - startEpoch) / 1000));
			}, 200);
		} catch (err) {
			console.error("Microphone access failed:", err);
			toast.error("Failed to access microphone. Please check system permissions.");
		}
	};

	const stopRecording = () => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
			mediaRecorderRef.current.stop();
		}
		setIsRecording(false);
	};

	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
			if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
				mediaRecorderRef.current.stop();
			}
		};
	}, []);

	const minutes = Math.floor(recordingDuration / 60);
	const seconds = recordingDuration % 60;
	const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

	return (
		<div className="flex flex-col gap-2 p-3 rounded-xl border border-foreground/10 bg-foreground/[0.02]">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-1.5">
					<Microphone className="w-3.5 h-3.5 text-primary" weight="bold" />
					<span className="text-[11px] font-semibold text-foreground">Record Voiceover</span>
				</div>
				{isRecording && (
					<span className="flex items-center gap-1 text-[10px] font-mono font-bold text-rose-500 animate-pulse">
						<span className="w-2 h-2 rounded-full bg-rose-500" />
						{timeStr}
					</span>
				)}
			</div>

			<div className="h-1.5 w-full rounded-full bg-foreground/10 overflow-hidden">
				<div
					className="h-full bg-emerald-500 transition-all duration-75"
					style={{ width: `${isRecording ? audioLevel : 0}%` }}
				/>
			</div>

			<Button
				type="button"
				onClick={isRecording ? stopRecording : startRecording}
				variant={isRecording ? "destructive" : "default"}
				size="sm"
				className={cn(
					"h-8 w-full gap-2 text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer",
					isRecording
						? "bg-rose-600 hover:bg-rose-700 text-white"
						: "bg-primary hover:bg-primary/90 text-white",
				)}
			>
				{isRecording ? (
					<>
						<Pause className="w-3.5 h-3.5" weight="fill" />
						<span>Stop Recording</span>
					</>
				) : (
					<>
						<Play className="w-3.5 h-3.5" weight="fill" />
						<span>Start Voiceover</span>
					</>
				)}
			</Button>
			<p className="text-[9.5px] text-muted-foreground/70 leading-tight">
				{isRecording
					? "Recording microphone into timeline at current playhead..."
					: "Click to record voice narration directly into the timeline."}
			</p>
		</div>
	);
}

interface SettingsPanelProps {
	className?: string;
	style?: React.CSSProperties;
	panelMode?: "editor" | "background";
	activeEffectSection?: EditorEffectSection;
	slides?: ClipEntry[];
	onAddAsSlide?: (filePath: string, label?: string) => void;
	onImportMedia?: () => void;
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
	onAnnotationDelete?: (id: string) => void;
	autoCaptions?: CaptionCue[];
	autoCaptionSettings?: AutoCaptionSettings;
	whisperExecutablePath?: string | null;
	whisperModelPath?: string | null;
	whisperModelDownloadStatus?: "idle" | "downloading" | "downloaded" | "error";
	whisperModelDownloadProgress?: number;
	isGeneratingCaptions?: boolean;
	onAutoCaptionSettingsChange?: (settings: AutoCaptionSettings) => void;
	onPickWhisperExecutable?: () => void;
	onPickWhisperModel?: () => void;
	onGenerateAutoCaptions?: () => void;
	onClearAutoCaptions?: () => void;
	onDownloadWhisperSmallModel?: () => void;
	onDeleteWhisperSmallModel?: () => void;
	nativeCaptureUnavailableSession?: boolean;
	onOpenNativeCaptureUnavailableModal?: () => void;
}

const ZOOM_DEPTH_OPTIONS: Array<{ depth: ZoomDepth; label: string }> = [
	{ depth: 1, label: "1.25×" },
	{ depth: 2, label: "1.5×" },
	{ depth: 3, label: "1.8×" },
	{ depth: 4, label: "2.2×" },
	{ depth: 5, label: "3.5×" },
	{ depth: 6, label: "5×" },
];

const WEBCAM_POSITION_PRESETS: Array<{
	preset: Exclude<WebcamPositionPreset, "custom">;
	label: string;
}> = [
	{ preset: "top-left", label: "↖" },
	{ preset: "top-center", label: "↑" },
	{ preset: "top-right", label: "↗" },
	{ preset: "center-left", label: "←" },
	{ preset: "center", label: "•" },
	{ preset: "center-right", label: "→" },
	{ preset: "bottom-left", label: "↙" },
	{ preset: "bottom-center", label: "↓" },
	{ preset: "bottom-right", label: "↘" },
];

type CursorStyleOption = { value: CursorStyle; label: string };

type WallpaperTile = {
	key: string;
	label: string;
	value: string;
	previewUrl: string;
};

const BUILTIN_CURSOR_STYLE_OPTIONS: CursorStyleOption[] = [
	{ value: "macos", label: "macOS" },
	{ value: "tahoe", label: "Tahoe" },
	{ value: "tahoe-inverted", label: "Tahoe Inverted" },
	{ value: "dot", label: "Dot" },
	{ value: "figma", label: "Minimal" },
];

const CAPTION_LANGUAGE_OPTIONS = [
	{ value: "auto", label: "Auto Detect" },
	{ value: "id", label: "Indonesian (Bahasa Indonesia)" },
	{ value: "en", label: "English" },
	{ value: "es", label: "Spanish" },
	{ value: "fr", label: "French" },
	{ value: "de", label: "German" },
	{ value: "it", label: "Italian" },
	{ value: "pt", label: "Portuguese" },
	{ value: "zh", label: "Chinese (Simplified)" },
	{ value: "ja", label: "Japanese" },
	{ value: "ko", label: "Korean" },
] as const;

const APP_LANGUAGE_LABELS: Record<AppLocale, string> = {
	en: "English",
	es: "Español",
	fr: "Français",
	it: "Italiano",
	nl: "Nederlands",
	ko: "한국어",
	"pt-BR": "Português",
	"zh-CN": "簡體中文",
	"zh-TW": "繁體中文",
};

function loadPreviewImage(url: string) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error(`Failed to load preview asset: ${url}`));
		image.src = url;
	});
}

function trimCanvasToAlpha(canvas: HTMLCanvasElement, hotspot?: { x: number; y: number }) {
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		return {
			dataUrl: canvas.toDataURL("image/png"),
			width: canvas.width,
			height: canvas.height,
			hotspot,
		};
	}

	const { width, height } = canvas;
	const imageData = ctx.getImageData(0, 0, width, height);
	const { data } = imageData;
	let minX = width;
	let minY = height;
	let maxX = -1;
	let maxY = -1;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const alpha = data[(y * width + x) * 4 + 3];
			if (alpha === 0) {
				continue;
			}

			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}

	if (maxX < minX || maxY < minY) {
		return {
			dataUrl: canvas.toDataURL("image/png"),
			width,
			height,
			hotspot,
		};
	}

	const croppedWidth = maxX - minX + 1;
	const croppedHeight = maxY - minY + 1;
	const croppedCanvas = document.createElement("canvas");
	croppedCanvas.width = croppedWidth;
	croppedCanvas.height = croppedHeight;
	const croppedCtx = croppedCanvas.getContext("2d")!;
	croppedCtx.drawImage(
		canvas,
		minX,
		minY,
		croppedWidth,
		croppedHeight,
		0,
		0,
		croppedWidth,
		croppedHeight,
	);

	return {
		dataUrl: croppedCanvas.toDataURL("image/png"),
		width: croppedWidth,
		height: croppedHeight,
		hotspot: hotspot
			? {
					x: hotspot.x - minX,
					y: hotspot.y - minY,
				}
			: undefined,
	};
}

async function createTrimmedSvgPreview(
	url: string,
	sampleSize: number,
	trim?: { x: number; y: number; width: number; height: number },
) {
	const image = await loadPreviewImage(url);
	const sourceCanvas = document.createElement("canvas");
	sourceCanvas.width = sampleSize;
	sourceCanvas.height = sampleSize;
	const sourceCtx = sourceCanvas.getContext("2d")!;
	sourceCtx.drawImage(image, 0, 0, sampleSize, sampleSize);

	if (trim) {
		const croppedCanvas = document.createElement("canvas");
		croppedCanvas.width = trim.width;
		croppedCanvas.height = trim.height;
		const croppedCtx = croppedCanvas.getContext("2d")!;
		croppedCtx.drawImage(
			sourceCanvas,
			trim.x,
			trim.y,
			trim.width,
			trim.height,
			0,
			0,
			trim.width,
			trim.height,
		);
		return croppedCanvas.toDataURL("image/png");
	}

	return trimCanvasToAlpha(sourceCanvas).dataUrl;
}

async function createInvertedPreview(url: string) {
	const image = await loadPreviewImage(url);
	const canvas = document.createElement("canvas");
	canvas.width = image.naturalWidth;
	canvas.height = image.naturalHeight;
	const ctx = canvas.getContext("2d")!;
	ctx.drawImage(image, 0, 0);
	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const { data } = imageData;
	for (let index = 0; index < data.length; index += 4) {
		if (data[index + 3] === 0) {
			continue;
		}
		data[index] = 255 - data[index];
		data[index + 1] = 255 - data[index + 1];
		data[index + 2] = 255 - data[index + 2];
	}
	ctx.putImageData(imageData, 0, 0);
	return canvas.toDataURL("image/png");
}

function CursorStylePreview({
	style,
	previewUrls,
}: {
	style: CursorStyle;
	previewUrls: Partial<Record<string, string>>;
}) {
	const previewSrc =
		style === "macos"
			? (previewUrls.macos ?? tahoeCursorUrl)
			: style === "tahoe"
				? (previewUrls.tahoe ?? tahoeCursorUrl)
				: style === "figma"
					? (previewUrls.figma ?? minimalCursorUrl)
					: style === "tahoe-inverted"
						? (previewUrls["tahoe-inverted"] ?? tahoeCursorUrl)
						: previewUrls[style];

	if (style === "macos" || style === "tahoe" || style === "tahoe-inverted") {
		const previewSize = BUILTIN_CURSOR_PREVIEW_SIZE * getCursorStyleSizeMultiplier(style);
		return (
			<div
				className="flex items-center justify-center"
				style={{
					width: `${BUILTIN_CURSOR_PREVIEW_FRAME_SIZE}px`,
					height: `${BUILTIN_CURSOR_PREVIEW_FRAME_SIZE}px`,
				}}
			>
				<img
					src={previewSrc ?? tahoeCursorUrl}
					alt=""
					className="max-w-none object-contain drop-shadow-[0_8px_12px_rgba(15,23,42,0.18)]"
					draggable={false}
					style={{
						width: `${previewSize}px`,
						height: `${previewSize}px`,
					}}
				/>
			</div>
		);
	}

	if (style === "figma") {
		return <img src={previewSrc} alt="" className="h-7 w-7 object-contain" draggable={false} />;
	}

	if (style === "dot") {
		return (
			<span className="h-[14px] w-[14px] rounded-full border-[2.5px] border-neutral-800 bg-white shadow-[0_8px_12px_rgba(15,23,42,0.16)]" />
		);
	}

	return (
		<img
			src={previewSrc ?? tahoeCursorUrl}
			alt=""
			className="h-7 w-7 object-contain"
			draggable={false}
		/>
	);
}

export function SettingsPanel({
	className,
	style,
	panelMode = "editor",
	activeEffectSection: activeEffectSectionProp,
	slides = [],
	onAddAsSlide,
	onImportMedia,
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
	onAnnotationDelete,
	autoCaptions = [],
	autoCaptionSettings = DEFAULT_AUTO_CAPTION_SETTINGS,
	whisperModelPath,
	whisperModelDownloadStatus = "idle",
	whisperModelDownloadProgress = 0,
	isGeneratingCaptions = false,
	onAutoCaptionSettingsChange,
	onPickWhisperModel,
	onGenerateAutoCaptions,
	onClearAutoCaptions,
	onDownloadWhisperSmallModel,
	onDeleteWhisperSmallModel,
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
	const [customImages, setCustomImages] = useState<string[]>(
		initialEditorPreferences.customWallpapers,
	);
	const removeBackgroundStateRef = useRef<{
		aspectRatio: AspectRatio;
		padding: Padding;
	} | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const builtInWallpaperPaths = useMemo(
		() => builtInWallpapers.map((wallpaper) => wallpaper.publicPath),
		[builtInWallpapers],
	);
	const extensionWallpaperPaths = useMemo(
		() => extensionWallpapers.map((wallpaper) => wallpaper.resolvedUrl),
		[extensionWallpapers],
	);
	const captionCueCount = autoCaptions.length;
	const updateAutoCaptionSettings = (partial: Partial<AutoCaptionSettings>) => {
		onAutoCaptionSettingsChange?.({
			...autoCaptionSettings,
			...partial,
		});
	};

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

	const [selectedColor, setSelectedColor] = useState(
		isHexWallpaper(selected) ? selected : "#ADADAD",
	);
	const [gradient, setGradient] = useState<string>(
		GRADIENTS.includes(selected) ? selected : GRADIENTS[0],
	);
	const removeBackgroundEnabled = aspectRatio === "native" && isZeroPadding(padding);

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

	const [backgroundTab, setBackgroundTab] = useState<BackgroundTab>(() =>
		getBackgroundTabForWallpaper(selected),
	);
	const customColorInputRef = useRef<HTMLInputElement | null>(null);
	const defaultWebcam = initialEditorPreferences.webcam;
	const [internalActiveEffectSection] = useState<EditorEffectSection>("scene");
	const activeEffectSection = activeEffectSectionProp ?? internalActiveEffectSection;
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

	useEffect(() => {
		setBackgroundTab(getBackgroundTabForWallpaper(selected));

		if (isHexWallpaper(selected)) {
			setSelectedColor(selected);
		}

		if (GRADIENTS.includes(selected)) {
			setGradient(selected);
		}
	}, [selected]);

	useEffect(() => {
		if (selected.startsWith("data:image")) {
			setCustomImages((prev) => (prev.includes(selected) ? prev : [selected, ...prev]));
			return;
		}

		const isKnownWallpaper =
			builtInWallpaperPaths.includes(selected) ||
			wallpaperPreviewPaths.includes(selected) ||
			extensionWallpaperPaths.includes(selected);

		if (!isKnownWallpaper && isVideoWallpaperSource(selected)) {
			setCustomImages((prev) => (prev.includes(selected) ? prev : [selected, ...prev]));
		}
	}, [builtInWallpaperPaths, extensionWallpaperPaths, selected, wallpaperPreviewPaths]);

	const imageWallpaperTiles = useMemo<WallpaperTile[]>(() => {
		const imageWallpapers = builtInWallpapers.filter(
			(wallpaper) => !isVideoWallpaperSource(wallpaper.publicPath),
		);
		const builtInTiles = (
			wallpaperPreviewPaths.length > 0 ? wallpaperPreviewPaths : builtInWallpaperPaths
		)
			.filter((path) => !isVideoWallpaperSource(path))
			.map((previewPath, index) => {
				const wallpaper = imageWallpapers[index];
				return {
					key: wallpaper ? `builtin/${wallpaper.id}` : previewPath,
					label: wallpaper?.label ?? `Wallpaper ${index + 1}`,
					value: wallpaper?.publicPath ?? previewPath,
					previewUrl: previewPath,
				};
			});

		const extensionTiles = extensionWallpapers
			.filter((wallpaper) => !isVideoWallpaperSource(wallpaper.resolvedUrl))
			.map((wallpaper) => ({
				key: wallpaper.id,
				label: wallpaper.wallpaper.label,
				value: wallpaper.resolvedUrl,
				previewUrl:
					extensionWallpaperPreviewUrls[wallpaper.id] ?? wallpaper.resolvedThumbnailUrl,
			}));

		return [...builtInTiles, ...extensionTiles];
	}, [
		builtInWallpaperPaths,
		builtInWallpapers,
		extensionWallpaperPreviewUrls,
		extensionWallpapers,
		wallpaperPreviewPaths,
	]);

	const videoWallpaperTiles = useMemo<WallpaperTile[]>(() => {
		const builtInTiles = builtInWallpapers
			.filter((wallpaper) => isVideoWallpaperSource(wallpaper.publicPath))
			.map((wallpaper) => ({
				key: `builtin/${wallpaper.id}`,
				label: wallpaper.label,
				value: wallpaper.publicPath,
				previewUrl: wallpaper.publicPath,
			}));

		const extensionTiles = extensionWallpapers
			.filter((wallpaper) => isVideoWallpaperSource(wallpaper.resolvedUrl))
			.map((wallpaper) => ({
				key: wallpaper.id,
				label: wallpaper.wallpaper.label,
				value: wallpaper.resolvedUrl,
				previewUrl:
					extensionWallpaperPreviewUrls[wallpaper.id] ?? wallpaper.resolvedThumbnailUrl,
			}));

		return [...builtInTiles, ...extensionTiles];
	}, [builtInWallpapers, extensionWallpaperPreviewUrls, extensionWallpapers]);

	useEffect(() => {
		saveEditorPreferences({ customWallpapers: customImages });
	}, [customImages]);

	const handleRemoveBackgroundToggle = (checked: boolean) => {
		if (checked) {
			removeBackgroundStateRef.current = {
				aspectRatio,
				padding,
			};
			onAspectRatioChange?.("native");
			onPaddingChange?.({ top: 0, bottom: 0, left: 0, right: 0, linked: padding.linked });
			return;
		}

		const previousState = removeBackgroundStateRef.current;
		if (previousState) {
			onAspectRatioChange?.(previousState.aspectRatio);
			onPaddingChange?.(previousState.padding);
			removeBackgroundStateRef.current = null;
			return;
		}

		// Fallback if the project loaded in a "background removed" state already
		onAspectRatioChange?.(initialEditorPreferences.aspectRatio);
		onPaddingChange?.({ ...DEFAULT_PADDING });
	};

	const togglePaddingLink = () => {
		const isLinked = padding.linked !== false;
		const nextLinked = !isLinked;
		if (nextLinked) {
			// Compute average for relinking to avoid sudden shifts
			const avg = Math.round(
				(padding.top + padding.bottom + padding.left + padding.right) / 4,
			);
			onPaddingChange?.({
				top: avg,
				bottom: avg,
				left: avg,
				right: avg,
				linked: true,
			});
		} else {
			onPaddingChange?.({
				...padding,
				linked: false,
			});
		}
	};

	const handlePaddingSideChange = (side: keyof Padding, value: number) => {
		if (padding.linked !== false) {
			onPaddingChange?.({
				top: value,
				bottom: value,
				left: value,
				right: value,
				linked: true,
			});
		} else {
			onPaddingChange?.({
				...padding,
				[side]: value,
			});
		}
	};

	const webcamFileName = webcam?.sourcePath?.split(/[\\/]/).pop() ?? null;
	const visibleColorPalette = colorPalette.slice(0, 15);
	const webcamPositionPreset = webcam?.positionPreset ?? DEFAULT_WEBCAM_POSITION_PRESET;
	const webcamPositionX = webcam?.positionX ?? DEFAULT_WEBCAM_POSITION_X;
	const webcamPositionY = webcam?.positionY ?? DEFAULT_WEBCAM_POSITION_Y;
	const webcamCrop = normalizeWebcamCropRegion(webcam?.cropRegion);

	const getWallpaperTileState = (candidateValue: string, previewPath?: string) => {
		if (!selected) return false;
		if (selected === candidateValue || (previewPath && selected === previewPath)) return true;
		try {
			const clean = (s: string) => s.replace(/^file:\/\//, "").replace(/^\//, "");
			if (clean(selected).endsWith(clean(candidateValue))) return true;
			if (clean(candidateValue).endsWith(clean(selected))) return true;
			if (previewPath && clean(selected).endsWith(clean(previewPath))) return true;
			if (previewPath && clean(previewPath).endsWith(clean(selected))) return true;
		} catch {
			return false;
		}
		return false;
	};

	const wallpaperTileClass = (isSelected: boolean) =>
		cn(
			"group relative aspect-square w-full overflow-hidden rounded-[10px] border bg-editor-bg transition-colors duration-150",
			isSelected
				? "border-[#2563EB] bg-foreground/[0.08]"
				: "border-foreground/10 bg-foreground/[0.045] hover:border-foreground/20 hover:bg-foreground/[0.07]",
		);

	const renderWallpaperImageTile = (
		wallpaperUrl: string,
		isSelected: boolean,
		props?: {
			key?: string;
			ariaLabel?: string;
			title?: string;
			onClick?: () => void;
			children?: React.ReactNode;
		},
	) => (
		<div
			key={props?.key}
			className={wallpaperTileClass(isSelected)}
			aria-label={props?.ariaLabel}
			title={props?.title}
			onClick={props?.onClick}
			role="button"
		>
			<div className="absolute inset-[1px] overflow-hidden rounded-[8px] bg-editor-dialog">
				{isVideoWallpaperSource(wallpaperUrl) ? (
					<WallpaperVideoPreview src={wallpaperUrl} />
				) : (
					<img
						src={wallpaperUrl}
						alt={
							props?.title ??
							props?.ariaLabel ??
							tSettings("background.wallpaperPreview", "Wallpaper preview")
						}
						className="h-full w-full select-none object-cover [transform:translateZ(0)]"
						draggable={false}
					/>
				)}
			</div>
			{props?.children}
		</div>
	);

	const crop = cropRegion ?? {
		x: 0,
		y: 0,
		width: 1,
		height: 1,
	};
	const cropTop = Math.round(crop.y * 100);
	const cropLeft = Math.round(crop.x * 100);
	const cropBottom = Math.round((1 - crop.y - crop.height) * 100);
	const cropRight = Math.round((1 - crop.x - crop.width) * 100);
	const isCropped = cropTop > 0 || cropLeft > 0 || cropBottom > 0 || cropRight > 0;

	const setCropInset = (side: "top" | "bottom" | "left" | "right", pct: number) => {
		if (!onCropChange) return;

		const v = pct / 100;
		let { x, y, width, height } = crop;

		if (side === "top") {
			const nextY = Math.min(v, 1 - y - height + v);
			y = nextY;
			height = Math.max(0.05, height - (nextY - crop.y));
		}

		if (side === "left") {
			const nextX = Math.min(v, 1 - x - width + v);
			x = nextX;
			width = Math.max(0.05, width - (nextX - crop.x));
		}

		if (side === "bottom") {
			height = Math.max(0.05, 1 - crop.y - v);
		}

		if (side === "right") {
			width = Math.max(0.05, 1 - crop.x - v);
		}

		onCropChange({ x, y, width, height });
	};

	const resetBackgroundSection = () => {
		onBackgroundBlurChange?.(initialEditorPreferences.backgroundBlur);

		const preferredWallpaper = initialEditorPreferences.wallpaper;
		const hasPreferredWallpaper =
			(preferredWallpaper && builtInWallpaperPaths.includes(preferredWallpaper)) ||
			(preferredWallpaper && extensionWallpaperPaths.includes(preferredWallpaper)) ||
			(preferredWallpaper && customImages.includes(preferredWallpaper)) ||
			(preferredWallpaper && isHexWallpaper(preferredWallpaper)) ||
			(preferredWallpaper && GRADIENTS.includes(preferredWallpaper));

		onWallpaperChange(
			(hasPreferredWallpaper ? preferredWallpaper : "") ||
				builtInWallpaperPaths[0] ||
				extensionWallpaperPaths[0] ||
				BUILT_IN_WALLPAPERS[0]?.publicPath ||
				"",
		);
	};

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

	const resetFrameSection = () => {
		const preferredFrame = initialEditorPreferences.frame;
		const resolvedFrame = preferredFrame
			? availableFrames.some((candidate) => candidate.id === preferredFrame)
				? preferredFrame
				: null
			: null;
		onShadowChange?.(initialEditorPreferences.shadowIntensity);
		onBorderRadiusChange?.(initialEditorPreferences.borderRadius);
		onAspectRatioChange?.(initialEditorPreferences.aspectRatio);
		onPaddingChange?.({ ...initialEditorPreferences.padding });
		onFrameChange?.(resolvedFrame);
		removeBackgroundStateRef.current = null;
	};

	const resetWebcamSection = () => {
		if (!onWebcamChange) return;
		onWebcamChange({ ...defaultWebcam });
	};

	const resetCropSection = () => {
		onCropChange?.(DEFAULT_CROP_REGION);
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

	const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
		const files = event.target.files;
		if (!files || files.length === 0) return;

		const file = files[0];

		// Validate file type - only allow JPG/JPEG
		const validTypes = ["image/jpeg", "image/jpg"];
		if (!validTypes.includes(file.type)) {
			toast.error(tSettings("background.uploadError"), {
				description: tSettings("background.uploadErrorDescription"),
			});
			event.target.value = "";
			return;
		}

		const reader = new FileReader();

		reader.onload = (e) => {
			const dataUrl = e.target?.result as string;
			if (dataUrl) {
				setCustomImages((prev) => [...prev, dataUrl]);
				onWallpaperChange(dataUrl);
				toast.success(tSettings("background.uploadSuccess"));
			}
		};

		reader.onerror = () => {
			toast.error(t("common.errors.failedToUploadImage"), {
				description: t("common.errors.fileReadError"),
			});
		};

		reader.readAsDataURL(file);
		// Reset input so the same file can be selected again
		event.target.value = "";
	};

	const handleVideoUpload = async () => {
		try {
			const result = await window.electronAPI.openVideoFilePicker();
			if (!result?.success || !result.path) return;
			const filePath = result.path;
			if (!isVideoWallpaperSource(filePath)) {
				toast.error("Unsupported format", {
					description: "Please select a video file (mp4, webm, mov, etc.)",
				});
				return;
			}
			setCustomImages((prev) => [filePath, ...prev]);
			onWallpaperChange(filePath);
			toast.success("Video background added");
		} catch {
			toast.error("Failed to import video background");
		}
	};

	const handleRemoveCustomImage = (imageUrl: string, event: React.MouseEvent) => {
		event.stopPropagation();
		setCustomImages((prev) => prev.filter((img) => img !== imageUrl));
		// If the removed image was selected, clear selection
		if (selected === imageUrl) {
			onWallpaperChange(
				builtInWallpaperPaths[0] ??
					extensionWallpaperPaths[0] ??
					BUILT_IN_WALLPAPERS[0]?.publicPath ??
					"",
			);
		}
	};

	// Find selected annotation
	const selectedAnnotation = selectedAnnotationId
		? annotationRegions.find((a) => a.id === selectedAnnotationId)
		: null;

	const backgroundSettingsContent = (
		<div className="space-y-4">
			<section className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-3">
					<SectionLabel>{tSettings("background.title")}</SectionLabel>
					<button
						type="button"
						onClick={resetBackgroundSection}
						className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
					>
						{t("common.actions.reset", "Reset")}
					</button>
				</div>
				<SliderControl
					label={tSettings("effects.backgroundBlur")}
					value={backgroundBlur}
					defaultValue={initialEditorPreferences.backgroundBlur}
					min={0}
					max={8}
					step={0.25}
					onChange={(v) => onBackgroundBlurChange?.(v)}
					formatValue={(v) => `${v.toFixed(1)}px`}
					parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
				/>
			</section>

			<div className="w-full">
				<LayoutGroup id="background-picker-switcher">
					<div className="grid h-8 w-full grid-cols-4 rounded-xl border border-foreground/10 bg-foreground/[0.04] p-1">
						{(
							[
								{ value: "image", label: tSettings("background.image") },
								{ value: "video", label: tSettings("background.video", "Video") },
								{ value: "color", label: tSettings("background.color") },
								{ value: "gradient", label: tSettings("background.gradient") },
							] as const
						).map((option) => {
							const isActive = backgroundTab === option.value;
							return (
								<button
									key={option.value}
									type="button"
									onClick={() => setBackgroundTab(option.value)}
									className="relative rounded-lg text-[10px] font-semibold tracking-wide transition-colors"
								>
									{isActive ? (
										<motion.span
											layoutId="background-picker-pill"
											className="absolute inset-0 rounded-lg bg-[#2563EB]"
											transition={{
												type: "spring",
												stiffness: 420,
												damping: 34,
											}}
										/>
									) : null}
									<span
										className={cn(
											"relative z-10",
											isActive
												? "text-white"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										{option.label}
									</span>
								</button>
							);
						})}
					</div>
				</LayoutGroup>

				<div className="pt-2">
					<AnimatePresence mode="wait" initial={false}>
						<motion.div
							key={backgroundTab}
							initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
							animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
							exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
							transition={{ duration: 0.2, ease: "easeOut" }}
						>
							{backgroundTab === "image" ? (
								<div className="mt-0 space-y-2">
									<input
										type="file"
										ref={fileInputRef}
										onChange={handleImageUpload}
										accept=".jpg,.jpeg,image/jpeg"
										className="hidden"
									/>
									<Button
										onClick={() => fileInputRef.current?.click()}
										variant="outline"
										className="w-full gap-2 bg-foreground/5 text-foreground border-foreground/10 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] transition-all h-7 text-[10px]"
									>
										<Upload className="w-3 h-3" />
										{tSettings("background.uploadCustom")}
									</Button>

									<div className="grid grid-cols-8 gap-1.5">
										{customImages.map((imageUrl, idx) => {
											const isSelected = getWallpaperTileState(imageUrl);
											return renderWallpaperImageTile(imageUrl, isSelected, {
												key: `custom-${idx}`,
												ariaLabel: isVideoWallpaperSource(imageUrl)
													? (imageUrl.split(/[\\/]/).pop() ??
														tSettings(
															"background.video",
															"Video background",
														))
													: undefined,
												title: isVideoWallpaperSource(imageUrl)
													? imageUrl.split(/[\\/]/).pop()
													: undefined,
												onClick: () => onWallpaperChange(imageUrl),
												children: (
													<button
														onClick={(e) =>
															handleRemoveCustomImage(imageUrl, e)
														}
														className="absolute top-0.5 right-0.5 w-3 h-3 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
													>
														<X className="w-2 h-2 text-white" />
													</button>
												),
											});
										})}

										{imageWallpaperTiles.map((tile) => {
											const isSelected = getWallpaperTileState(
												tile.value,
												tile.previewUrl,
											);
											return renderWallpaperImageTile(
												tile.previewUrl,
												isSelected,
												{
													key: tile.key,
													ariaLabel: tile.label,
													title: tile.label,
													onClick: () => onWallpaperChange(tile.value),
												},
											);
										})}
									</div>
								</div>
							) : backgroundTab === "video" ? (
								<div className="mt-0 space-y-2">
									<Button
										onClick={handleVideoUpload}
										variant="outline"
										className="w-full gap-2 bg-foreground/5 text-foreground border-foreground/10 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] transition-all h-7 text-[10px]"
									>
										<Upload className="w-3 h-3" />
										{tSettings("background.uploadCustomVideo", "Upload Video")}
									</Button>

									<div className="grid grid-cols-8 gap-1.5">
										{customImages
											.filter(isVideoWallpaperSource)
											.map((videoUrl, idx) => {
												const isSelected = getWallpaperTileState(videoUrl);
												return renderWallpaperImageTile(
													videoUrl,
													isSelected,
													{
														key: `custom-video-${idx}`,
														ariaLabel:
															videoUrl.split(/[\\/]/).pop() ??
															"Video background",
														title: videoUrl.split(/[\\/]/).pop(),
														onClick: () => onWallpaperChange(videoUrl),
														children: (
															<button
																onClick={(e) =>
																	handleRemoveCustomImage(
																		videoUrl,
																		e,
																	)
																}
																className="absolute top-0.5 right-0.5 w-3 h-3 bg-red-500/90 hover:bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
															>
																<X className="w-2 h-2 text-white" />
															</button>
														),
													},
												);
											})}

										{videoWallpaperTiles.map((wallpaper) => {
											const isSelected = getWallpaperTileState(
												wallpaper.value,
												wallpaper.previewUrl,
											);
											return renderWallpaperImageTile(
												wallpaper.previewUrl,
												isSelected,
												{
													key: wallpaper.key,
													ariaLabel: wallpaper.label,
													title: wallpaper.label,
													onClick: () =>
														onWallpaperChange(wallpaper.value),
												},
											);
										})}
									</div>
								</div>
							) : backgroundTab === "color" ? (
								<div className="mt-0 space-y-2">
									<input
										ref={customColorInputRef}
										type="color"
										value={selectedColor}
										onChange={(event) => {
											setSelectedColor(event.target.value);
											onWallpaperChange(event.target.value);
										}}
										className="sr-only"
									/>
									<div className="grid grid-cols-8 gap-1.5">
										{visibleColorPalette.map((color) => {
											const isSelected =
												selected.toLowerCase() === color.toLowerCase();
											return (
												<button
													key={color}
													type="button"
													onClick={() => {
														setSelectedColor(color);
														onWallpaperChange(color);
													}}
													className={wallpaperTileClass(isSelected)}
													style={{ background: color }}
													aria-label={`Color ${color}`}
												/>
											);
										})}
										<button
											type="button"
											onClick={() => customColorInputRef.current?.click()}
											className={wallpaperTileClass(
												isHexWallpaper(selected) &&
													!visibleColorPalette.some(
														(color) =>
															color.toLowerCase() ===
															selected.toLowerCase(),
													),
											)}
											style={{
												background: `linear-gradient(135deg, ${selectedColor} 0%, ${selectedColor} 58%, rgba(255,255,255,0.92) 58%, rgba(255,255,255,0.92) 100%)`,
											}}
											aria-label="Custom color picker"
										>
											<div className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold uppercase tracking-[0.18em] text-foreground/90">
												Pick
											</div>
										</button>
									</div>
								</div>
							) : (
								<div className="mt-0 grid grid-cols-8 gap-1.5">
									{GRADIENTS.map((g, idx) => (
										<div
											key={g}
											className={wallpaperTileClass(gradient === g)}
											aria-label={`Gradient ${idx + 1}`}
											onClick={() => {
												setGradient(g);
												onWallpaperChange(g);
											}}
											role="button"
										>
											<div
												className="absolute inset-[1px] overflow-hidden rounded-[8px]"
												style={{ background: g }}
											/>
										</div>
									))}
								</div>
							)}
						</motion.div>
					</AnimatePresence>
				</div>
			</div>
		</div>
	);

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
				onDelete={() => onAnnotationDelete(selectedAnnotation.id)}
			/>
		);
	}

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
					{backgroundSettingsContent}
				</div>
			</div>
		);
	}

	const frameSectionContent = (
		<section className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<SectionLabel>{tSettings("sections.frame", "Frame")}</SectionLabel>
				<button
					type="button"
					onClick={resetFrameSection}
					className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
				>
					{t("common.actions.reset", "Reset")}
				</button>
			</div>
			<div className="flex flex-col gap-1.5">
				<SliderControl
					label={tSettings("effects.shadow")}
					value={shadowIntensity}
					defaultValue={initialEditorPreferences.shadowIntensity}
					min={0}
					max={1}
					step={0.01}
					onChange={(v) => onShadowChange?.(v)}
					formatValue={(v) => `${Math.round(v * 100)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
				/>
				<SliderControl
					label={tSettings("effects.radius", "Radius")}
					value={borderRadius}
					defaultValue={initialEditorPreferences.borderRadius}
					min={0}
					max={200}
					step={0.5}
					onChange={(v) => onBorderRadiusChange?.(v)}
					formatValue={(v) => `${v}px`}
					parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
				/>
				<div className="flex flex-col gap-1.5 pt-0.5">
					<div className="flex items-center justify-between">
						<SectionLabel>{tSettings("effects.padding")}</SectionLabel>
						<button
							type="button"
							onClick={togglePaddingLink}
							aria-pressed={padding.linked === false}
							className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
							title={
								padding.linked === false
									? tSettings(
											"effects.paddingAdvancedHide",
											"Hide advanced padding controls",
										)
									: tSettings(
											"effects.paddingAdvancedShow",
											"Show advanced padding controls",
										)
							}
						>
							{tSettings("effects.paddingAdvanced", "Advanced")}
						</button>
					</div>

					{padding.linked !== false ? (
						<SliderControl
							label=""
							value={padding.top}
							defaultValue={DEFAULT_PADDING.top}
							min={0}
							max={100}
							step={1}
							onChange={(v) => handlePaddingSideChange("top", v)}
							formatValue={(v) => `${v}%`}
							parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
						/>
					) : (
						<div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
							<SliderControl
								label={tSettings("effects.paddingTop", "Top")}
								value={padding.top}
								defaultValue={DEFAULT_PADDING.top}
								min={0}
								max={100}
								step={1}
								onChange={(v) => handlePaddingSideChange("top", v)}
								formatValue={(v) => `${v}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.paddingBottom", "Bottom")}
								value={padding.bottom}
								defaultValue={DEFAULT_PADDING.bottom}
								min={0}
								max={100}
								step={1}
								onChange={(v) => handlePaddingSideChange("bottom", v)}
								formatValue={(v) => `${v}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.paddingLeft", "Left")}
								value={padding.left}
								defaultValue={DEFAULT_PADDING.left}
								min={0}
								max={100}
								step={1}
								onChange={(v) => handlePaddingSideChange("left", v)}
								formatValue={(v) => `${v}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.paddingRight", "Right")}
								value={padding.right}
								defaultValue={DEFAULT_PADDING.right}
								min={0}
								max={100}
								step={1}
								onChange={(v) => handlePaddingSideChange("right", v)}
								formatValue={(v) => `${v}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
							/>
						</div>
					)}
				</div>
				<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
					<span className="text-[10px] text-muted-foreground">
						{tSettings("effects.removeBackground")}
					</span>
					<Switch
						checked={removeBackgroundEnabled}
						onCheckedChange={handleRemoveBackgroundToggle}
						className="data-[state=checked]:bg-[#2563EB] scale-75"
					/>
				</div>
				{/* Frame Picker */}
				{availableFrames.length > 0 && (
					<div className="flex flex-col gap-1.5 mt-1">
						<div className="flex items-center justify-between">
							<span className="text-[10px] text-muted-foreground">Frame</span>
							{frame && (
								<button
									type="button"
									onClick={() => onFrameChange?.(null)}
									className="text-[9px] text-[#2563EB] hover:opacity-80"
								>
									Remove
								</button>
							)}
						</div>
						<div className="grid grid-cols-3 gap-1.5">
							{availableFrames.map((f) => {
								const isSelected = frame === f.id;
								return (
									<button
										key={f.id}
										type="button"
										onClick={() => onFrameChange?.(isSelected ? null : f.id)}
										className={cn(
											"flex flex-col items-center gap-1 p-1.5 rounded-lg border transition-all text-center",
											isSelected
												? "border-[#2563EB]/50 bg-[#2563EB]/10 ring-1 ring-[#2563EB]/30"
												: "border-foreground/[0.06] bg-white/[0.02] hover:bg-foreground/[0.05]",
										)}
									>
										<div className="w-full aspect-video rounded bg-foreground/10 overflow-hidden flex items-center justify-center">
											<img
												src={f.thumbnailPath}
												alt={f.label}
												className="w-full h-full object-contain"
												draggable={false}
											/>
										</div>
										<span className="text-[8px] text-muted-foreground truncate w-full leading-tight">
											{f.label}
										</span>
									</button>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</section>
	);

	const cropSectionContent = (
		<section className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<SectionLabel>{tSettings("sections.crop", "Crop")}</SectionLabel>
				{isCropped ? (
					<button
						type="button"
						onClick={resetCropSection}
						className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
					>
						{t("common.actions.reset", "Reset")}
					</button>
				) : null}
			</div>
			<div className="flex flex-col gap-1.5">
				<SliderControl
					label={tSettings("crop.top", "Top")}
					value={cropTop}
					defaultValue={0}
					min={0}
					max={50}
					step={1}
					onChange={(v) => setCropInset("top", v)}
					formatValue={(v) => `${Math.round(v)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
				/>
				<SliderControl
					label={tSettings("crop.bottom", "Bottom")}
					value={cropBottom}
					defaultValue={0}
					min={0}
					max={50}
					step={1}
					onChange={(v) => setCropInset("bottom", v)}
					formatValue={(v) => `${Math.round(v)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
				/>
				<SliderControl
					label={tSettings("crop.left", "Left")}
					value={cropLeft}
					defaultValue={0}
					min={0}
					max={50}
					step={1}
					onChange={(v) => setCropInset("left", v)}
					formatValue={(v) => `${Math.round(v)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
				/>
				<SliderControl
					label={tSettings("crop.right", "Right")}
					value={cropRight}
					defaultValue={0}
					min={0}
					max={50}
					step={1}
					onChange={(v) => setCropInset("right", v)}
					formatValue={(v) => `${Math.round(v)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
				/>
			</div>
		</section>
	);

	const captionsSectionContent = (
		<section className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<SectionLabel>{tSettings("sections.captions", "Captions")}</SectionLabel>
					<button
						type="button"
						onClick={() => onAutoCaptionSettingsChange?.(DEFAULT_AUTO_CAPTION_SETTINGS)}
						className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
					>
						{t("common.actions.reset", "Reset")}
					</button>
				</div>
				<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
					<span>{tSettings("captions.enabled", "Show")}</span>
					<Switch
						checked={autoCaptionSettings.enabled}
						onCheckedChange={(enabled) => updateAutoCaptionSettings({ enabled })}
						className="data-[state=checked]:bg-[#2563EB] scale-75"
					/>
				</div>
			</div>

			<div className="rounded-lg bg-foreground/[0.03] px-2.5 py-2 space-y-3">
				<div>
					<Button
						type="button"
						variant="outline"
						onClick={onPickWhisperModel}
						className="h-10 w-full rounded-xl border-foreground/10 bg-foreground/5 px-4 text-sm text-foreground hover:bg-foreground/10 hover:text-foreground"
					>
						{tSettings("captions.selectModel", "Select Model")}
					</Button>
				</div>
				<div className="flex items-center justify-between gap-3">
					<div className="text-sm font-medium text-foreground">
						{tSettings("captions.language", "Language")}
					</div>
					<Select
						value={autoCaptionSettings.language || "auto"}
						onValueChange={(value) => updateAutoCaptionSettings({ language: value })}
					>
						<SelectTrigger className="h-10 w-[180px] rounded-xl border-foreground/10 bg-foreground/5 text-sm text-foreground hover:bg-foreground/10">
							<SelectValue />
						</SelectTrigger>
						<SelectContent className="border-foreground/10 bg-editor-surface-alt text-foreground">
							{CAPTION_LANGUAGE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="grid w-full grid-cols-2 gap-2">
						{whisperModelDownloadStatus === "downloading" ? (
							<Button
								type="button"
								disabled
								className="h-10 w-full rounded-xl bg-foreground/10 px-4 text-sm font-medium text-foreground hover:bg-foreground/10"
							>
								{tSettings("captions.downloading", "Downloading...")}{" "}
								{Math.round(whisperModelDownloadProgress)}%
							</Button>
						) : whisperModelPath ? (
							<Button
								type="button"
								variant="outline"
								onClick={onDeleteWhisperSmallModel}
								className="h-10 w-full rounded-xl border-foreground/10 bg-foreground/5 px-4 text-sm text-foreground hover:bg-foreground/10 hover:text-foreground"
							>
								{tSettings("captions.deleteModel", "Delete Model")}
							</Button>
						) : (
							<Button
								type="button"
								onClick={onDownloadWhisperSmallModel}
								className="h-10 w-full rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white hover:bg-[#2563EB]/90"
							>
								{tSettings("captions.downloadModel", "Download Model")}
							</Button>
						)}
						<Button
							type="button"
							variant="outline"
							onClick={onClearAutoCaptions}
							disabled={captionCueCount === 0}
							className="h-10 w-full rounded-xl border-foreground/10 bg-foreground/5 px-4 text-sm text-foreground hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
						>
							{tSettings("captions.clearFull", "Clear Captions")}
						</Button>
					</div>
					<div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-1 px-0.5">
						<div className="flex items-center gap-1.5 truncate">
							<span
								className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${whisperModelPath ? "bg-emerald-500" : "bg-amber-500"}`}
							/>
							<span className="truncate">
								{whisperModelPath
									? whisperModelPath.split(/[\\/]/).pop()
									: tSettings("captions.noModelLoaded", "Belum ada model aktif")}
							</span>
						</div>
						<span className="shrink-0 text-emerald-400 font-medium">
							ID & Multilingual
						</span>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<Button
						type="button"
						onClick={onGenerateAutoCaptions}
						disabled={isGeneratingCaptions || !whisperModelPath}
						className="h-10 w-full rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white hover:bg-[#2563EB]/90 disabled:opacity-60"
					>
						{isGeneratingCaptions
							? tSettings("captions.generating", "Generating...")
							: captionCueCount > 0
								? tSettings("captions.regenerateFull", "Regenerate Captions")
								: tSettings("captions.generateFull", "Generate Captions")}
					</Button>
					{isGeneratingCaptions ? (
						<div className="space-y-1">
							<div className="text-xs text-muted-foreground">
								{tSettings(
									"captions.generatingStatus",
									"Generating captions. This can take a moment.",
								)}
							</div>
							<div className="indeterminate-progress h-2 rounded-full bg-foreground/5" />
						</div>
					) : null}
				</div>
				{whisperModelDownloadStatus === "downloading" ? (
					<div className="h-2 overflow-hidden rounded-full bg-foreground/5">
						<div
							className="h-full rounded-full bg-[#2196f3] transition-all"
							style={{ width: `${whisperModelDownloadProgress}%` }}
						/>
					</div>
				) : null}
			</div>

			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<div className="text-[10px] text-muted-foreground">
						{tSettings("captions.highlightStyle", "Highlight Style")}
					</div>
					<Select
						value={autoCaptionSettings.highlightStyle || "karaoke-pop"}
						onValueChange={(value) =>
							updateAutoCaptionSettings({
								highlightStyle: value as CaptionHighlightStyle,
							})
						}
					>
						<SelectTrigger className="h-9 w-[170px] rounded-xl border-foreground/10 bg-foreground/5 text-sm text-foreground hover:bg-foreground/10">
							<SelectValue />
						</SelectTrigger>
						<SelectContent className="border-foreground/10 bg-editor-surface-alt text-foreground">
							{CAPTION_HIGHLIGHT_STYLE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<div className="flex items-center justify-between">
						<span className="text-[10px] text-muted-foreground">
							{tSettings("captions.highlightColor", "Active Word Color")}
						</span>
						<div className="flex items-center gap-1.5">
							{CAPTION_HIGHLIGHT_COLOR_PRESETS.map((preset) => {
								const currentActive = (
									autoCaptionSettings.highlightColor ||
									DEFAULT_AUTO_CAPTION_SETTINGS.highlightColor ||
									"#FFE600"
								).toLowerCase();
								const isSelected = currentActive === preset.value.toLowerCase();
								return (
									<button
										key={preset.value}
										type="button"
										title={preset.name}
										onClick={() =>
											updateAutoCaptionSettings({
												highlightColor: preset.value,
											})
										}
										className={cn(
											"h-5 w-5 rounded-full border transition-transform hover:scale-110",
											isSelected
												? "border-white ring-2 ring-blue-500 scale-110"
												: "border-foreground/20",
										)}
										style={{ backgroundColor: preset.value }}
									/>
								);
							})}
							<input
								type="color"
								value={
									autoCaptionSettings.highlightColor ||
									DEFAULT_AUTO_CAPTION_SETTINGS.highlightColor ||
									"#FFE600"
								}
								onChange={(event) =>
									updateAutoCaptionSettings({
										highlightColor: event.target.value,
									})
								}
								className="h-6 w-6 rounded border border-foreground/10 bg-transparent cursor-pointer ml-1"
								title="Custom highlight color"
							/>
						</div>
					</div>
				</div>

				<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<span className="text-[10px] text-muted-foreground">
						{tSettings("captions.uppercase", "Uppercase (ALL CAPS)")}
					</span>
					<Switch
						checked={Boolean(autoCaptionSettings.uppercase)}
						onCheckedChange={(uppercase) => updateAutoCaptionSettings({ uppercase })}
						className="data-[state=checked]:bg-[#2563EB] scale-75"
					/>
				</div>

				<div className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<div className="text-[10px] text-muted-foreground">
						{tSettings("captions.animation", "Animation")}
					</div>
					<Select
						value={autoCaptionSettings.animationStyle}
						onValueChange={(value) =>
							updateAutoCaptionSettings({
								animationStyle: value as AutoCaptionAnimation,
							})
						}
					>
						<SelectTrigger className="h-9 w-[160px] rounded-xl border-foreground/10 bg-foreground/5 text-sm text-foreground hover:bg-foreground/10">
							<SelectValue />
						</SelectTrigger>
						<SelectContent className="border-foreground/10 bg-editor-surface-alt text-foreground">
							{CAPTION_ANIMATION_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<label className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<span className="text-[10px] text-muted-foreground">
						{tSettings("captions.textColor", "Text color")}
					</span>
					<input
						type="color"
						value={autoCaptionSettings.textColor}
						onChange={(event) =>
							updateAutoCaptionSettings({ textColor: event.target.value })
						}
						className="h-7 w-10 rounded border border-foreground/10 bg-transparent"
					/>
				</label>
				<label className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<span className="text-[10px] text-muted-foreground">
						{tSettings("captions.inactiveTextColor", "Inactive word color")}
					</span>
					<input
						type="color"
						value={autoCaptionSettings.inactiveTextColor || "#A3A3A3"}
						onChange={(event) =>
							updateAutoCaptionSettings({ inactiveTextColor: event.target.value })
						}
						className="h-7 w-10 rounded border border-foreground/10 bg-transparent cursor-pointer"
					/>
				</label>
				<div className="mb-1 text-sm font-medium text-foreground">
					{tSettings("captions.fontSettings", "Font Settings")}
				</div>
				<SliderControl
					label={tSettings("captions.fontSize", "Font size")}
					value={autoCaptionSettings.fontSize}
					defaultValue={DEFAULT_AUTO_CAPTION_SETTINGS.fontSize}
					min={16}
					max={72}
					step={1}
					onChange={(value) => updateAutoCaptionSettings({ fontSize: value })}
					formatValue={(value) => `${Math.round(value)}px`}
					parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
				/>
				<SliderControl
					label={tSettings("captions.rowCount", "Rows")}
					value={autoCaptionSettings.maxRows}
					defaultValue={DEFAULT_AUTO_CAPTION_SETTINGS.maxRows}
					min={1}
					max={4}
					step={1}
					onChange={(value) => updateAutoCaptionSettings({ maxRows: Math.round(value) })}
					formatValue={(value) => `${Math.round(value)}`}
					parseInput={(text) => parseFloat(text)}
				/>
				<SliderControl
					label={tSettings("captions.bottomOffset", "Bottom offset")}
					value={autoCaptionSettings.bottomOffset}
					defaultValue={DEFAULT_AUTO_CAPTION_SETTINGS.bottomOffset}
					min={0}
					max={30}
					step={1}
					onChange={(value) => updateAutoCaptionSettings({ bottomOffset: value })}
					formatValue={(value) => `${Math.round(value)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
				/>
				<SliderControl
					label={tSettings("captions.maxWidth", "Max width")}
					value={autoCaptionSettings.maxWidth}
					defaultValue={DEFAULT_AUTO_CAPTION_SETTINGS.maxWidth}
					min={40}
					max={95}
					step={1}
					onChange={(value) => updateAutoCaptionSettings({ maxWidth: value })}
					formatValue={(value) => `${Math.round(value)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
				/>
				<SliderControl
					label={tSettings("captions.boxRadius", "Box radius")}
					value={autoCaptionSettings.boxRadius}
					defaultValue={DEFAULT_AUTO_CAPTION_SETTINGS.boxRadius}
					min={0}
					max={40}
					step={0.5}
					onChange={(value) => updateAutoCaptionSettings({ boxRadius: value })}
					formatValue={(value) =>
						`${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}px`
					}
					parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
				/>
				<SliderControl
					label={tSettings("captions.backgroundOpacity", "Background opacity")}
					value={autoCaptionSettings.backgroundOpacity}
					defaultValue={DEFAULT_AUTO_CAPTION_SETTINGS.backgroundOpacity}
					min={0}
					max={1}
					step={0.01}
					onChange={(value) => updateAutoCaptionSettings({ backgroundOpacity: value })}
					formatValue={(value) => `${Math.round(value * 100)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
				/>
				{renderExtensionPanelsForSections("captions")}
			</div>
		</section>
	);

	const effectSectionContent = (() => {
		const settingsSectionContent = (
			<div className="space-y-4">
				<section className="flex flex-col gap-2">
					<SectionLabel>{t("editor.theme.appearance", "Appearance")}</SectionLabel>
					<div className="flex rounded-lg border border-foreground/10 bg-foreground/5 p-0.5">
						{(
							[
								{ value: "light", label: t("editor.theme.light", "Light") },
								{ value: "dark", label: t("editor.theme.dark", "Dark") },
								{ value: "system", label: t("editor.theme.system", "System") },
							] as const
						).map((option) => (
							<button
								key={option.value}
								type="button"
								onClick={() => setThemePreference(option.value)}
								className={cn(
									"flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
									themePreference === option.value
										? "bg-neutral-800 text-white shadow-sm dark:bg-white dark:text-black"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{option.label}
							</button>
						))}
					</div>
				</section>

				<section className="flex flex-col gap-2">
					<SectionLabel>{t("common.app.language", "Language")}</SectionLabel>
					<Select value={locale} onValueChange={(value) => setLocale(value as AppLocale)}>
						<SelectTrigger className="h-10 w-full rounded-xl border-foreground/10 bg-foreground/5 text-sm text-foreground hover:bg-foreground/10">
							<SelectValue />
						</SelectTrigger>
						<SelectContent className="border-foreground/10 bg-editor-surface-alt text-foreground">
							{SUPPORTED_LOCALES.map((candidateLocale) => (
								<SelectItem key={candidateLocale} value={candidateLocale}>
									{APP_LANGUAGE_LABELS[candidateLocale]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</section>

				<section className="flex flex-col gap-1.5">
					<div className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
						<div>
							<div className="text-[11px] font-medium text-foreground">
								{tSettings(
									"effects.autoApplyFreshRecordingZooms",
									"Auto-apply fresh recording zooms",
								)}
							</div>
							<div className="mt-0.5 text-[10px] text-muted-foreground/70">
								{tSettings(
									"effects.autoApplyFreshRecordingZoomsDescription",
									"Suggest cursor-follow zooms automatically when you open a new recording.",
								)}
							</div>
						</div>
						<Switch
							checked={autoApplyFreshRecordingAutoZooms}
							onCheckedChange={onAutoApplyFreshRecordingAutoZoomsChange}
							className="data-[state=checked]:bg-[#2563EB] scale-75"
						/>
					</div>
					<div className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
						<div>
							<div className="text-[11px] font-medium text-foreground">
								{tSettings("effects.connectZooms", "Connect neighboring zooms")}
							</div>
							<div className="mt-0.5 text-[10px] text-muted-foreground/70">
								{tSettings(
									"effects.connectZoomsDescription",
									"Smooth consecutive zoom regions into a continuous camera move.",
								)}
							</div>
						</div>
						<Switch
							checked={connectZooms}
							onCheckedChange={onConnectZoomsChange}
							className="data-[state=checked]:bg-[#2563EB] scale-75"
						/>
					</div>
				</section>

				<section className="flex flex-col gap-2">
					<MotionPresetCards
						title={tSettings("effects.motionPresetsTitle", "Motion Presets")}
						activePresetId={activeMotionPresetId}
						onApply={applyMotionPreset}
						tSettings={tSettings}
					/>
				</section>

				<section className="flex flex-col gap-2">
					<SectionLabel>{t("editor.keyboardShortcuts.title")}</SectionLabel>
					<KeyboardShortcutsDialog
						triggerLabel={t("editor.keyboardShortcuts.customize")}
						triggerClassName="h-10 w-full justify-start rounded-xl border border-foreground/10 bg-foreground/5 px-3 text-sm text-foreground hover:bg-foreground/10 hover:text-foreground"
					/>
				</section>

				{showDevMotionControls ? (
					<section className="flex flex-col gap-2 rounded-xl border border-[#2563EB]/15 bg-[#2563EB]/5 p-3">
						<div className="flex items-center justify-between gap-3">
							<div>
								<SectionLabel>
									{tSettings("effects.devSection", "Dev")}
								</SectionLabel>
								<div className="mt-0.5 text-[10px] text-muted-foreground">
									{tSettings(
										"effects.devSectionHint",
										"Temporary testing controls for native capture and motion tuning.",
									)}
								</div>
							</div>
							<span className="rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#2563EB]">
								DEV
							</span>
						</div>

						<div className="rounded-lg border border-foreground/10 bg-background/60 px-3 py-3">
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="text-[11px] font-medium text-foreground">
										{tSettings(
											"effects.nativeCaptureWarningTester",
											"Native capture warning",
										)}
									</div>
									<div className="mt-0.5 text-[10px] text-muted-foreground">
										{nativeCaptureUnavailableSession
											? tSettings(
													"effects.nativeCaptureWarningTesterUnavailable",
													"This project is currently marked as native capture unavailable.",
												)
											: tSettings(
													"effects.nativeCaptureWarningTesterAvailable",
													"This project is not marked as unsupported, but you can still open the modal for UI testing.",
												)}
									</div>
								</div>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => onOpenNativeCaptureUnavailableModal?.()}
									className="h-8 shrink-0 border-[#2563EB]/20 bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/15"
								>
									{tSettings("effects.openNativeCaptureWarning", "Open warning")}
								</Button>
							</div>
						</div>

						<div className="space-y-1.5 rounded-lg border border-foreground/10 bg-background/60 px-3 py-3">
							<div>
								<div className="text-[11px] font-medium text-foreground">
									{tSettings("effects.motionBlurDebug", "Motion Blur Debug")}
								</div>
								<div className="mt-0.5 text-[10px] text-muted-foreground">
									{tSettings(
										"effects.motionBlurDebugHint",
										"Development-only tuning for the split move-vs-zoom blur path. Pan controls drive the streak filter, and zoom controls drive the focus-centered zoom filter.",
									)}
								</div>
							</div>
							<SliderControl
								label={tSettings("effects.motionBlurPanThreshold", "Pan threshold")}
								value={zoomMotionBlurTuning.panVelocityThreshold}
								defaultValue={
									initialEditorPreferences.zoomMotionBlurTuning
										.panVelocityThreshold
								}
								min={0}
								max={240}
								step={1}
								onChange={(value) =>
									onZoomMotionBlurTuningChange?.({
										...zoomMotionBlurTuning,
										panVelocityThreshold: value,
									})
								}
								formatValue={(value) => `${Math.round(value)} px/s`}
								parseInput={(text) =>
									parseFloat(text.replace(/px\/s$/i, "").trim())
								}
							/>
							<SliderControl
								label={tSettings("effects.motionBlurPanStrength", "Pan max blur")}
								value={zoomMotionBlurTuning.maxDirectionalBlurPx}
								defaultValue={
									initialEditorPreferences.zoomMotionBlurTuning
										.maxDirectionalBlurPx
								}
								min={0}
								max={96}
								step={0.1}
								onChange={(value) =>
									onZoomMotionBlurTuningChange?.({
										...zoomMotionBlurTuning,
										maxDirectionalBlurPx: value,
									})
								}
								formatValue={(value) => `${value.toFixed(1)} px`}
								parseInput={(text) => parseFloat(text.replace(/px$/i, "").trim())}
							/>
							<SliderControl
								label={tSettings(
									"effects.motionBlurZoomThreshold",
									"Zoom threshold",
								)}
								value={zoomMotionBlurTuning.zoomVelocityThreshold}
								defaultValue={
									initialEditorPreferences.zoomMotionBlurTuning
										.zoomVelocityThreshold
								}
								min={0}
								max={0.4}
								step={0.005}
								onChange={(value) =>
									onZoomMotionBlurTuningChange?.({
										...zoomMotionBlurTuning,
										zoomVelocityThreshold: value,
									})
								}
								formatValue={(value) => value.toFixed(3)}
								parseInput={(text) => parseFloat(text)}
							/>
							<SliderControl
								label={tSettings(
									"effects.motionBlurZoomStrength",
									"Zoom blur strength",
								)}
								value={zoomMotionBlurTuning.maxRadialBlurStrength}
								defaultValue={
									initialEditorPreferences.zoomMotionBlurTuning
										.maxRadialBlurStrength
								}
								min={0}
								max={1.5}
								step={0.005}
								onChange={(value) =>
									onZoomMotionBlurTuningChange?.({
										...zoomMotionBlurTuning,
										maxRadialBlurStrength: value,
									})
								}
								formatValue={(value) => value.toFixed(3)}
								parseInput={(text) => parseFloat(text)}
							/>
						</div>

						<div className="space-y-1.5 rounded-lg border border-foreground/10 bg-background/60 px-3 py-3">
							<div>
								<div className="text-[11px] font-medium text-foreground">
									{tSettings("effects.cameraDebugTuning", "Camera Debug Tuning")}
								</div>
								<div className="mt-0.5 text-[10px] text-muted-foreground">
									{tSettings(
										"effects.cameraDebugTuningHint",
										"Development-only spring tuning controls for camera motion.",
									)}
								</div>
							</div>
							<SliderControl
								label={tSettings(
									"effects.cameraSpringStiffnessMultiplier",
									"Camera stiffness",
								)}
								value={cameraSpringStiffnessMultiplier}
								defaultValue={
									initialEditorPreferences.cameraSpringStiffnessMultiplier
								}
								min={0.25}
								max={3}
								step={0.01}
								onChange={(value) =>
									onCameraSpringStiffnessMultiplierChange?.(value)
								}
								formatValue={(value) => `${value.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings(
									"effects.cameraSpringDampingMultiplier",
									"Camera damping",
								)}
								value={cameraSpringDampingMultiplier}
								defaultValue={
									initialEditorPreferences.cameraSpringDampingMultiplier
								}
								min={0.25}
								max={3}
								step={0.01}
								onChange={(value) => onCameraSpringDampingMultiplierChange?.(value)}
								formatValue={(value) => `${value.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings(
									"effects.cameraSpringMassMultiplier",
									"Camera mass",
								)}
								value={cameraSpringMassMultiplier}
								defaultValue={initialEditorPreferences.cameraSpringMassMultiplier}
								min={0.25}
								max={3}
								step={0.01}
								onChange={(value) => onCameraSpringMassMultiplierChange?.(value)}
								formatValue={(value) => `${value.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
						</div>

						<div className="space-y-1.5 rounded-lg border border-foreground/10 bg-background/60 px-3 py-3">
							<div>
								<div className="text-[11px] font-medium text-foreground">
									{tSettings("effects.cursorDebugTuning", "Cursor Debug Tuning")}
								</div>
								<div className="mt-0.5 text-[10px] text-muted-foreground">
									{tSettings(
										"effects.cursorDebugTuningHint",
										"Development-only spring tuning controls.",
									)}
								</div>
							</div>
							<SliderControl
								label={tSettings(
									"effects.cursorSpringStiffnessMultiplier",
									"Spring stiffness",
								)}
								value={cursorSpringStiffnessMultiplier}
								defaultValue={
									initialEditorPreferences.cursorSpringStiffnessMultiplier
								}
								min={0.25}
								max={3}
								step={0.01}
								onChange={(value) =>
									onCursorSpringStiffnessMultiplierChange?.(value)
								}
								formatValue={(value) => `${value.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings(
									"effects.cursorSpringDampingMultiplier",
									"Spring damping",
								)}
								value={cursorSpringDampingMultiplier}
								defaultValue={
									initialEditorPreferences.cursorSpringDampingMultiplier
								}
								min={0.25}
								max={3}
								step={0.01}
								onChange={(value) => onCursorSpringDampingMultiplierChange?.(value)}
								formatValue={(value) => `${value.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings(
									"effects.cursorSpringMassMultiplier",
									"Spring mass",
								)}
								value={cursorSpringMassMultiplier}
								defaultValue={initialEditorPreferences.cursorSpringMassMultiplier}
								min={0.25}
								max={3}
								step={0.01}
								onChange={(value) => onCursorSpringMassMultiplierChange?.(value)}
								formatValue={(value) => `${value.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
						</div>
					</section>
				) : null}
			</div>
		);

		const sceneSectionContent = (
			<div className="space-y-4">
				{backgroundSettingsContent}
				{frameSectionContent}
				{cropSectionContent}
				{renderExtensionPanelsForSections("scene", "appearance", "frame", "crop")}
			</div>
		);

		const zoomItemSectionContent = (
			<section className="flex flex-col gap-2">
				{selectedZoomId && (
					<>
						<div className="flex items-center justify-between gap-3">
							<SectionLabel>{tSettings("sections.zoom", "Zoom")}</SectionLabel>
							{selectedZoomDepth && (
								<span className="rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#2563EB]">
									{
										ZOOM_DEPTH_OPTIONS.find(
											(o) => o.depth === selectedZoomDepth,
										)?.label
									}
								</span>
							)}
						</div>
						<div className="mb-1">
							<div className="flex rounded-lg border border-foreground/10 bg-foreground/5 p-0.5">
								<button
									type="button"
									onClick={() => onZoomModeChange?.("auto")}
									className={cn(
										"flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
										selectedZoomMode === "auto"
											? "bg-[#2563EB] text-white shadow-sm"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{tSettings("zoom.modeAuto", "Auto")}
								</button>
								<button
									type="button"
									onClick={() => onZoomModeChange?.("manual")}
									className={cn(
										"flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
										selectedZoomMode === "manual"
											? "bg-[#2563EB] text-white shadow-sm"
											: "text-muted-foreground hover:text-foreground",
									)}
								>
									{tSettings("zoom.modeManual", "Manual")}
								</button>
							</div>
							<p className="mt-1.5 text-[10px] text-muted-foreground/70">
								{selectedZoomMode === "manual"
									? tSettings(
											"zoom.modeManualDescription",
											"Set a fixed focus point for this zoom",
										)
									: tSettings(
											"zoom.modeAutoDescription",
											"Camera recenters when the cursor nears the edge of the zoomed view",
										)}
							</p>
						</div>
						<div className="grid grid-cols-6 gap-1.5">
							{ZOOM_DEPTH_OPTIONS.map((option) => {
								const isActive = selectedZoomDepth === option.depth;
								return (
									<Button
										key={option.depth}
										type="button"
										onClick={() => onZoomDepthChange?.(option.depth)}
										className={cn(
											"h-auto w-full rounded-lg border px-1 py-2 text-center shadow-sm transition-all duration-200 ease-out cursor-pointer",
											isActive
												? "border-[#2563EB] bg-[#2563EB] text-white"
												: "border-foreground/5 bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:border-foreground/10 hover:text-foreground",
										)}
									>
										<span className="text-xs font-semibold">
											{option.label}
										</span>
									</Button>
								);
							})}
						</div>
						<div className="h-px bg-foreground/[0.06] my-1" />
					</>
				)}
				<div className="flex items-center justify-between gap-3">
					<SectionLabel>{tSettings("zoom.globalSettings", "Animation")}</SectionLabel>
					<button
						type="button"
						onClick={resetZoomSection}
						className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
					>
						{t("common.actions.reset", "Reset")}
					</button>
				</div>
				<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
					<span className="text-[10px] text-muted-foreground">
						{tSettings("effects.classicZoom", "Classic Animation")}
					</span>
					<Switch
						checked={zoomClassicMode}
						onCheckedChange={(v) => onZoomClassicModeChange?.(v)}
						className="data-[state=checked]:bg-[#2563EB] scale-75"
					/>
				</div>
				{!zoomClassicMode && (
					<div className="text-[10px] text-muted-foreground">
						{tSettings(
							"effects.motionPresetsZoomHint",
							"Zoom motion presets are available in Settings.",
						)}
					</div>
				)}
				<div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-2">
					<div className="text-[10px] text-muted-foreground">
						{showDevMotionControls
							? tSettings(
									"effects.exportBlurMovedToDev",
									"Export blur tuning is available in Settings > Dev.",
								)
							: tSettings(
									"effects.exportBlurLocked",
									"Export blur is fixed for this build.",
								)}
					</div>
					<div className="mt-1 text-[12px] font-medium text-foreground">
						{`${TEMPORAL_MOTION_BLUR_DEFAULT_SAMPLE_COUNT} samples · ${Math.round(TEMPORAL_MOTION_BLUR_DEFAULT_SHUTTER_FRACTION * 100)}% shutter`}
					</div>
				</div>
				{selectedZoomId && (
					<Button
						onClick={() => {
							if (selectedZoomId && onZoomDelete) onZoomDelete(selectedZoomId);
						}}
						variant="destructive"
						size="sm"
						className="mt-1 h-8 w-full gap-2 border border-red-500/20 bg-red-500/10 text-xs text-red-400 transition-all hover:border-red-500/30 hover:bg-red-500/20"
					>
						<Trash2 className="h-3 w-3" />
						{tSettings("zoom.deleteZoom")}
					</Button>
				)}
				{renderExtensionPanelsForSections("zoom", "appearance", "frame", "crop")}
			</section>
		);

		const audioSectionContent = (
			<section className="flex flex-col gap-3">
				<div className="flex items-center justify-between gap-3">
					<SectionLabel>{tSettings("audio.volumeTitle", "Audio")}</SectionLabel>
					<button
						type="button"
						onClick={() => {
							onAudioVolumeChange?.(1);
							onAudioNormalizeChange?.(false);
							onAudioDuckingChange?.(true);
						}}
						className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
					>
						{t("common.actions.reset", "Reset")}
					</button>
				</div>
				<SliderControl
					label={tSettings("audio.volume", "Volume")}
					value={selectedAudioVolume ?? 1}
					defaultValue={1}
					min={0}
					max={1}
					step={0.01}
					onChange={(v) => onAudioVolumeChange?.(v)}
					formatValue={(v) => `${Math.round(v * 100)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
				/>
				<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
					<span className="text-[10px] text-muted-foreground">
						{tSettings("audio.normalize", "Normalize")}
					</span>
					<Switch
						checked={Boolean(selectedAudioNormalize)}
						onCheckedChange={(v) => onAudioNormalizeChange?.(v)}
						className="data-[state=checked]:bg-[#2563EB] scale-75"
					/>
				</div>
				<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
					<div className="flex flex-col">
						<span className="text-[10px] text-muted-foreground">
							{tSettings("audio.ducking", "Auto-Ducking")}
						</span>
						<span className="text-[9px] text-muted-foreground/70">
							{tSettings("audio.duckingDesc", "Lower volume when voice is detected")}
						</span>
					</div>
					<Switch
						checked={Boolean(selectedAudioDucking ?? true)}
						onCheckedChange={(v) => onAudioDuckingChange?.(v)}
						className="data-[state=checked]:bg-[#2563EB] scale-75"
					/>
				</div>
				{audioDuckingSettings && onAudioDuckingSettingsChange && (
					<div className="flex flex-col gap-2 pt-2 border-t border-border/40">
						<div className="flex items-center justify-between">
							<span className="text-[10px] font-medium text-muted-foreground">
								{tSettings("audio.duckingSettings", "Ducking Reduction")}
							</span>
							<span className="text-[10px] text-muted-foreground font-mono">
								{audioDuckingSettings.duckingAmountDb} dB
							</span>
						</div>
						<SliderControl
							label={tSettings("audio.duckingAmount", "Reduction")}
							value={Math.abs(audioDuckingSettings.duckingAmountDb)}
							defaultValue={14}
							min={6}
							max={26}
							step={1}
							onChange={(v) =>
								onAudioDuckingSettingsChange({
									...audioDuckingSettings,
									duckingAmountDb: -Math.abs(v),
								})
							}
							formatValue={(v) => `-${v} dB`}
							parseInput={(text) =>
								parseFloat(text.replace(/^-/, "").replace(/ dB$/, ""))
							}
						/>
					</div>
				)}
				{selectedAudioId && onAudioDelete && (
					<Button
						variant="outline"
						size="sm"
						onClick={() => onAudioDelete(selectedAudioId)}
						className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 text-xs h-8 mt-1"
					>
						<Trash2 className="w-3.5 h-3.5 mr-1.5" />
						{tSettings("audio.deleteRegion", "Delete Audio")}
					</Button>
				)}
			</section>
		);

		const clipSectionContent = (
			<section className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-3">
					<SectionLabel>{tSettings("clip.title", "Clip")}</SectionLabel>
					{selectedClipSpeed != null && selectedClipSpeed !== 1 && (
						<span className="rounded-full bg-[#06b6d4]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#06b6d4]">
							{selectedClipSpeed}×
						</span>
					)}
				</div>

				<div className="flex items-center justify-between gap-3">
					<SectionLabel>{tSettings("speed.label", "Speed")}</SectionLabel>
					{selectedClipSpeed != null && selectedClipSpeed !== 1 && (
						<button
							type="button"
							onClick={() => onClipSpeedChange?.(1)}
							className="text-[10px] text-[#06b6d4] transition-opacity hover:opacity-80 cursor-pointer"
						>
							{t("common.actions.reset", "Reset")}
						</button>
					)}
				</div>
				<SliderControl
					label={tSettings("speed.playbackRate", "Playback Rate")}
					value={selectedClipSpeed ?? 1}
					defaultValue={1}
					min={0.25}
					max={8}
					step={0.05}
					onChange={(v) => onClipSpeedChange?.(Number(v.toFixed(2)))}
					formatValue={(v) => `${v.toFixed(2)}×`}
					parseInput={(text) => {
						const num = parseFloat(text.replace(/×$/, ""));
						return isNaN(num) ? null : num;
					}}
					accentColor="blue"
				/>
				<div className="grid grid-cols-4 gap-1.5">
					{[
						{ speed: 0.25, label: "0.25×" },
						{ speed: 0.5, label: "0.5×" },
						{ speed: 0.75, label: "0.75×" },
						{ speed: 1, label: "1×" },
						{ speed: 1.25, label: "1.25×" },
						{ speed: 1.5, label: "1.5×" },
						{ speed: 2, label: "2×" },
						{ speed: 2.5, label: "2.5×" },
						{ speed: 3, label: "3×" },
						{ speed: 4, label: "4×" },
						{ speed: 5, label: "5×" },
						{ speed: 8, label: "8×" },
						{ speed: 10, label: "10×" },
						{ speed: 15, label: "15×" },
						{ speed: 20, label: "20×" },
						{ speed: 30, label: "30×" },
					].map((option) => {
						const isActive = selectedClipSpeed === option.speed;
						return (
							<Button
								key={option.speed}
								type="button"
								onClick={() => onClipSpeedChange?.(option.speed)}
								className={cn(
									"h-auto w-full rounded-lg border px-0.5 py-2 text-center shadow-sm transition-all duration-200 ease-out cursor-pointer",
									isActive
										? "border-[#06b6d4] bg-[#06b6d4] text-white"
										: "border-foreground/5 bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:border-foreground/10 hover:text-foreground",
								)}
							>
								<span className="text-[10px] font-semibold">{option.label}</span>
							</Button>
						);
					})}
				</div>

				<div className="mt-2 flex flex-col gap-2 border-t border-foreground/5 pt-3">
					<SectionLabel>{tSettings("audio.title", "Audio")}</SectionLabel>

					<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
						<div>
							<span className="text-[10px] text-muted-foreground">
								{tSettings("clip.mute", "Mute")}
							</span>
							<p className="text-[9px] text-muted-foreground/50 mt-0.5">
								{selectedClipMuted
									? tSettings("clip.mutedState", "Audio is muted")
									: tSettings("clip.unmutedState", "Audio is playing")}
							</p>
						</div>
						<Switch
							checked={selectedClipMuted ?? false}
							onCheckedChange={(v) => onClipMutedChange?.(v)}
							className="data-[state=checked]:bg-[#06b6d4] scale-75"
						/>
					</div>
					{hasClipSourceAudio && (
						<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
							<span className="text-[10px] text-muted-foreground">
								{tSettings(
									"clip.separateClipFromAudio",
									"Separate clip from audio",
								)}
							</span>
							<Switch
								checked={selectedClipShowSourceAudio ?? false}
								onCheckedChange={(v) => onClipShowSourceAudioChange?.(v)}
								className="data-[state=checked]:bg-[#06b6d4] scale-75"
							/>
						</div>
					)}
				</div>

				{selectedClipId && hasClipSourceAudio && sourceAudioTrackMeta.length > 0 && (
					<div className="mt-1 flex flex-col gap-3">
						{sourceAudioTrackMeta.map((track) => {
							const settings = sourceAudioTrackSettings[track.id] ?? {
								volume: 1,
								normalize: false,
							};
							return (
								<div
									key={track.id}
									className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-2"
								>
									<div className="mb-2 flex items-center justify-between">
										<span className="text-[11px] font-medium text-foreground">
											{track.label}
										</span>
										<button
											type="button"
											onClick={() => {
												onSourceAudioTrackVolumeChange?.(track.id, 1);
												onSourceAudioTrackNormalizeChange?.(
													track.id,
													false,
												);
											}}
											className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
										>
											{t("common.actions.reset", "Reset")}
										</button>
									</div>
									<div className="mb-2 flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
										<span className="text-[10px] text-muted-foreground">
											{tSettings("audio.normalize", "Normalize")}
										</span>
										<Switch
											checked={settings.normalize}
											onCheckedChange={(v) =>
												onSourceAudioTrackNormalizeChange?.(track.id, v)
											}
											className="data-[state=checked]:bg-[#06b6d4] scale-75"
										/>
									</div>
									<SliderControl
										label={tSettings("audio.volume", "Volume")}
										value={settings.volume}
										defaultValue={1}
										min={0}
										max={1}
										step={0.01}
										onChange={(v) =>
											onSourceAudioTrackVolumeChange?.(track.id, v)
										}
										formatValue={(v) => `${Math.round(v * 100)}%`}
										parseInput={(text) =>
											parseFloat(text.replace(/%$/, "")) / 100
										}
									/>
								</div>
							);
						})}
					</div>
				)}

				<div className="mt-2 flex flex-col gap-2 border-t border-foreground/5 pt-3">
					<SectionLabel>{tSettings("clip.transition", "Transition In")}</SectionLabel>

					<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
						<div>
							<span className="text-[10px] text-muted-foreground">
								{tSettings("clip.transitionType", "Effect")}
							</span>
							<p className="text-[9px] text-muted-foreground/50 mt-0.5">
								{selectedClipTransitionIn && selectedClipTransitionIn !== "none"
									? tSettings("clip.transitionActive", "Transition on clip start")
									: tSettings("clip.transitionNone", "Cut (No transition)")}
							</p>
						</div>
						<Select
							value={selectedClipTransitionIn ?? "none"}
							onValueChange={(val) =>
								onClipTransitionInChange?.(val as ClipTransitionType)
							}
						>
							<SelectTrigger className="h-7 w-32 border-foreground/10 bg-foreground/[0.03] text-[10px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="none">None (Cut)</SelectItem>
								<SelectItem value="fade-black">Dip to Black</SelectItem>
								<SelectItem value="fade-white">Dip to White</SelectItem>
								<SelectItem value="slide-left">Slide Left</SelectItem>
								<SelectItem value="slide-right">Slide Right</SelectItem>
								<SelectItem value="zoom-push">Zoom Push</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{selectedClipTransitionIn && selectedClipTransitionIn !== "none" && (
						<SliderControl
							label={tSettings("clip.transitionDuration", "Duration")}
							value={selectedClipTransitionInDurationMs ?? 400}
							defaultValue={400}
							min={100}
							max={1500}
							step={50}
							onChange={(v) => onClipTransitionInDurationChange?.(v)}
							formatValue={(v) => `${v}ms`}
							parseInput={(text) => parseInt(text.replace(/ms$/, ""), 10) || 400}
						/>
					)}
				</div>
			</section>
		);

		const layoutSectionContent = (
			<section className="flex flex-col gap-3">
				<div className="flex items-center gap-3">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#60A5FA]/20 bg-[#60A5FA]/10 text-[#93C5FD]">
						<LayoutIcon className="h-4 w-4" />
					</div>
					<div>
						<SectionLabel>{tSettings("layout.title", "Layout scene")}</SectionLabel>
						<p className="mt-0.5 text-[10px] text-muted-foreground/70">
							{tSettings("layout.subtitle", "Screen and webcam composition")}
						</p>
					</div>
				</div>

				{selectedLayoutId ? (
					<>
						<div className="flex flex-col gap-3">
							<div className="flex flex-col gap-1.5">
								<SectionLabel>
									{tSettings("layout.category", "Layout")}
								</SectionLabel>
								<div className="grid grid-cols-2 gap-2">
									{LAYOUT_SCENE_CATEGORIES.map((category) => {
										const activeCategory = getLayoutSceneCategory(
											selectedLayoutPreset ?? "bubble",
										);
										const isActive = activeCategory.id === category.id;
										return (
											<button
												key={category.id}
												type="button"
												onClick={() =>
													onLayoutPresetChange?.(category.value)
												}
												className={cn(
													"rounded-xl border px-3 py-2 text-left text-[11px] font-medium transition-all",
													"border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:border-foreground/20 hover:bg-foreground/[0.06] hover:text-foreground",
													isActive &&
														"border-[#60A5FA]/60 bg-[#60A5FA]/12 text-foreground shadow-[inset_0_0_0_1px_rgba(96,165,250,0.12)]",
												)}
											>
												{category.label}
											</button>
										);
									})}
								</div>
							</div>

							{(() => {
								const activeCategory = getLayoutSceneCategory(
									selectedLayoutPreset ?? "bubble",
								);
								const detailOptions =
									LAYOUT_SCENE_CATEGORY_DETAILS[activeCategory.id];
								if (detailOptions.length <= 1) return null;
								return (
									<div className="flex flex-col gap-1.5">
										<SectionLabel>
											{tSettings("layout.details", "Details")}
										</SectionLabel>
										<div className="grid grid-cols-2 gap-2">
											{detailOptions.map((preset) => {
												const isActive =
													selectedLayoutPreset === preset.value;
												return (
													<button
														key={preset.value}
														type="button"
														onClick={() =>
															onLayoutPresetChange?.(preset.value)
														}
														className={cn(
															"rounded-xl border px-3 py-2 text-left text-[11px] font-medium transition-all",
															"border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:border-foreground/20 hover:bg-foreground/[0.06] hover:text-foreground",
															isActive &&
																"border-[#60A5FA]/60 bg-[#60A5FA]/12 text-foreground shadow-[inset_0_0_0_1px_rgba(96,165,250,0.12)]",
														)}
													>
														{preset.label}
													</button>
												);
											})}
										</div>
									</div>
								);
							})()}
						</div>

						<SliderControl
							label={tSettings("layout.transition", "Transition")}
							value={selectedLayoutTransitionMs ?? 600}
							defaultValue={600}
							min={0}
							max={2000}
							step={50}
							onChange={(value) => onLayoutTransitionChange?.(value)}
							formatValue={(value) => `${Math.round(value)}ms`}
							parseInput={(text) => parseFloat(text.replace(/ms$/, ""))}
						/>

						<div className="flex items-center justify-between gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
							<span className="text-[11px] text-muted-foreground">
								{tSettings("layout.easing", "Easing")}
							</span>
							<Select
								value={selectedLayoutEasing ?? "smooth"}
								onValueChange={(value) =>
									onLayoutEasingChange?.(value as LayoutSceneEasing)
								}
							>
								<SelectTrigger className="h-7 w-28 border-foreground/10 bg-foreground/[0.03] text-[10px]">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="smooth">Smooth</SelectItem>
									<SelectItem value="snappy">Snappy</SelectItem>
									<SelectItem value="linear">Linear</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</>
				) : (
					<div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] px-3 py-4 text-center text-[11px] text-muted-foreground">
						{tSettings("layout.empty", "Select or add a layout scene on the timeline.")}
					</div>
				)}
			</section>
		);

		const colorGradingSectionContent = (
			<div className="space-y-4">
				<section className="flex flex-col gap-2">
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-3">
							<SectionLabel>
								{tSettings("colorGrading.title", "Color Grading & Filters")}
							</SectionLabel>
							<button
								type="button"
								onClick={() => onColorGradingChange?.(DEFAULT_COLOR_GRADING)}
								className="text-[10px] text-[#06b6d4] transition-opacity hover:opacity-80 cursor-pointer"
							>
								{t("common.actions.reset", "Reset")}
							</button>
						</div>
					</div>

					{/* Presets Grid */}
					<div className="flex items-center gap-3 mt-1">
						<SectionLabel>
							{tSettings("colorGrading.presets", "Style Presets")}
						</SectionLabel>
					</div>
					<div className="grid grid-cols-2 gap-2">
						{COLOR_FILTER_PRESETS.map((preset) => {
							const isActive = (colorGrading?.preset ?? "none") === preset.id;
							return (
								<button
									key={preset.id}
									type="button"
									onClick={() =>
										onColorGradingChange?.({
											...(colorGrading ?? DEFAULT_COLOR_GRADING),
											preset: preset.id,
										})
									}
									className={cn(
										"group flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden",
										isActive
											? "border-[#06b6d4] bg-[#06b6d4]/10 shadow-sm"
											: "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.06] hover:border-foreground/20",
									)}
								>
									<div className="flex items-center gap-2 w-full mb-1">
										<span
											className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm shrink-0"
											style={{ background: preset.previewGradient }}
										/>
										<span className="text-xs font-semibold truncate text-foreground">
											{preset.name}
										</span>
									</div>
									<span className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
										{preset.description}
									</span>
								</button>
							);
						})}
					</div>
				</section>

				{/* Manual Adjustments */}
				<section className="flex flex-col gap-2 pt-2 border-t border-foreground/10">
					<SectionLabel>
						{tSettings("colorGrading.adjustments", "Manual Adjustments")}
					</SectionLabel>

					<SliderControl
						label={tSettings("colorGrading.exposure", "Exposure")}
						value={colorGrading?.exposure ?? 0}
						defaultValue={0}
						min={-100}
						max={100}
						step={1}
						onChange={(v) =>
							onColorGradingChange?.({
								...(colorGrading ?? DEFAULT_COLOR_GRADING),
								exposure: v,
							})
						}
						formatValue={(v) => (v > 0 ? `+${Math.round(v)}%` : `${Math.round(v)}%`)}
						parseInput={(text) => parseFloat(text.replace(/[%+]/g, ""))}
						accentColor="blue"
					/>

					<SliderControl
						label={tSettings("colorGrading.contrast", "Contrast")}
						value={colorGrading?.contrast ?? 0}
						defaultValue={0}
						min={-100}
						max={100}
						step={1}
						onChange={(v) =>
							onColorGradingChange?.({
								...(colorGrading ?? DEFAULT_COLOR_GRADING),
								contrast: v,
							})
						}
						formatValue={(v) => (v > 0 ? `+${Math.round(v)}%` : `${Math.round(v)}%`)}
						parseInput={(text) => parseFloat(text.replace(/[%+]/g, ""))}
						accentColor="blue"
					/>

					<SliderControl
						label={tSettings("colorGrading.saturation", "Saturation")}
						value={colorGrading?.saturation ?? 0}
						defaultValue={0}
						min={-100}
						max={100}
						step={1}
						onChange={(v) =>
							onColorGradingChange?.({
								...(colorGrading ?? DEFAULT_COLOR_GRADING),
								saturation: v,
							})
						}
						formatValue={(v) => (v > 0 ? `+${Math.round(v)}%` : `${Math.round(v)}%`)}
						parseInput={(text) => parseFloat(text.replace(/[%+]/g, ""))}
						accentColor="blue"
					/>

					<SliderControl
						label={tSettings("colorGrading.vignette", "Vignette")}
						value={colorGrading?.vignette ?? 0}
						defaultValue={0}
						min={0}
						max={100}
						step={1}
						onChange={(v) =>
							onColorGradingChange?.({
								...(colorGrading ?? DEFAULT_COLOR_GRADING),
								vignette: v,
							})
						}
						formatValue={(v) => `${Math.round(v)}%`}
						parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
						accentColor="blue"
					/>

					<SliderControl
						label={tSettings("colorGrading.rounding", "Corner Rounding")}
						value={borderRadius}
						defaultValue={12.5}
						min={0}
						max={50}
						step={0.5}
						onChange={(v) => onBorderRadiusChange?.(v)}
						formatValue={(v) => `${v.toFixed(1)}px`}
						parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
						accentColor="blue"
					/>
				</section>
			</div>
		);

		const mediaSectionContent = (
			<section className="flex flex-col gap-3">
				<div className="flex items-center justify-between">
					<div>
						<SectionLabel>{tSettings("sections.media", "Media & Files")}</SectionLabel>
						<p className="mt-0.5 text-[10px] text-muted-foreground">
							{tSettings("media.description", "Project assets, recordings, and media files")}
						</p>
					</div>
					{onImportMedia && (
						<Button
							type="button"
							size="sm"
							onClick={onImportMedia}
							className="h-7 px-2.5 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-xs cursor-pointer"
						>
							<Upload className="w-3.5 h-3.5" />
							<span>Import</span>
						</Button>
					)}
				</div>
				<div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] overflow-hidden">
					<AssetExplorer
						className="h-[440px]"
						onAddAsSlide={onAddAsSlide ?? (() => {})}
						onImportMedia={onImportMedia}
						currentActivePath={
							selectedClipId
								? slides?.find((c) => c.id === selectedClipId)?.videoPath
								: null
						}
					/>
				</div>
			</section>
		);

		const audioRecordSectionContent = (
			<section className="flex flex-col gap-3">
				<div>
					<SectionLabel>{tSettings("sections.audioRecord", "Voiceover & Audio")}</SectionLabel>
					<p className="mt-0.5 text-[10px] text-muted-foreground">
						{tSettings(
							"audioRecord.description",
							"Record microphone voiceover directly or adjust audio track levels",
						)}
					</p>
				</div>

				<VoiceoverRecorder
					onAudioRecorded={onAudioAdded}
					currentTime={currentTime}
				/>

				<div className="pt-2 border-t border-foreground/10">
					{audioSectionContent}
				</div>
			</section>
		);

		const videoAdjustSectionContent = (
			<section className="flex flex-col gap-3">
				<div>
					<SectionLabel>{tSettings("sections.videoAdjust", "Transform & Adjust")}</SectionLabel>
					<p className="mt-0.5 text-[10px] text-muted-foreground">
						{tSettings(
							"videoAdjust.description",
							"Playback speed, aspect ratio, padding framing & crop",
						)}
					</p>
				</div>

				{/* Speed controls */}
				{clipSectionContent}

				{/* Aspect ratio & Framing */}
				<div className="pt-2 border-t border-foreground/10">
					<div className="flex items-center justify-between mb-2">
						<SectionLabel>{tSettings("scene.aspectRatio", "Canvas Ratio")}</SectionLabel>
					</div>
					<div className="grid grid-cols-3 gap-1.5">
						{[
							{ ratio: "16:9" as const, label: "16:9 (Landscape)" },
							{ ratio: "9:16" as const, label: "9:16 (Portrait / Reel)" },
							{ ratio: "1:1" as const, label: "1:1 (Square)" },
							{ ratio: "4:3" as const, label: "4:3 (Classic)" },
							{ ratio: "4:5" as const, label: "4:5 (Post)" },
							{ ratio: "native" as const, label: "Auto (Source)" },
						].map((opt) => (
							<button
								key={opt.ratio}
								type="button"
								onClick={() => onAspectRatioChange?.(opt.ratio)}
								className={cn(
									"px-2 py-1.5 rounded-lg border text-left text-xs font-semibold transition-all cursor-pointer",
									aspectRatio === opt.ratio
										? "border-primary bg-primary/10 text-primary shadow-xs"
										: "border-foreground/10 bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
								)}
							>
								{opt.label}
							</button>
						))}
					</div>
				</div>

				{/* Padding & Frame Scale */}
				<div className="pt-2 border-t border-foreground/10">
					<SliderControl
						label={tSettings("scene.padding", "Framing Padding")}
						value={padding?.left ?? 20}
						defaultValue={20}
						min={0}
						max={120}
						step={2}
						onChange={(val) =>
							onPaddingChange?.({
								top: val,
								bottom: val,
								left: val,
								right: val,
								linked: true,
							})
						}
						formatValue={(v) => `${v}px`}
						parseInput={(t) => parseInt(t.replace(/px$/, ""), 10) || 0}
					/>
				</div>

				{/* Corner Radius & Shadow */}
				<div className="pt-2 border-t border-foreground/10 space-y-2">
					<SliderControl
						label={tSettings("scene.borderRadius", "Corner Radius")}
						value={borderRadius ?? 12}
						defaultValue={12}
						min={0}
						max={48}
						step={1}
						onChange={(val) => onBorderRadiusChange?.(val)}
						formatValue={(v) => `${v}px`}
						parseInput={(t) => parseInt(t.replace(/px$/, ""), 10) || 0}
					/>
					<SliderControl
						label={tSettings("scene.shadow", "Shadow Intensity")}
						value={shadowIntensity ?? 0.5}
						defaultValue={0.5}
						min={0}
						max={1}
						step={0.02}
						onChange={(val) => onShadowChange?.(val)}
						formatValue={(v) => `${Math.round(v * 100)}%`}
						parseInput={(t) => parseFloat(t.replace(/%$/, "")) / 100}
					/>
				</div>
			</section>
		);

		const transitionsSectionContent = (
			<section className="flex flex-col gap-3">
				<div>
					<SectionLabel>{tSettings("sections.transitions", "Transitions")}</SectionLabel>
					<p className="mt-0.5 text-[10px] text-muted-foreground">
						{tSettings(
							"transitions.description",
							"Choose transition effect and duration for this slide",
						)}
					</p>
				</div>

				{/* Transition Effect Choices */}
				<div className="grid grid-cols-2 gap-2">
					{[
						{ id: "none" as const, label: "Cut (None)", desc: "Instant transition", icon: X },
						{ id: "fade-black" as const, label: "Fade Black", desc: "Cinematic black dip", icon: Sparkle },
						{ id: "fade-white" as const, label: "Fade White", desc: "Luminous flash", icon: Sparkle },
						{ id: "slide-left" as const, label: "Slide Left", desc: "Push left transition", icon: ArrowsLeftRight },
						{ id: "slide-right" as const, label: "Slide Right", desc: "Push right transition", icon: ArrowsLeftRight },
						{ id: "zoom-push" as const, label: "Zoom Push", desc: "Dynamic zoom perspective", icon: Sparkle },
					].map((opt) => {
						const isCurrent = (selectedClipTransitionIn ?? "none") === opt.id;
						const IconComp = opt.icon;
						return (
							<button
								key={opt.id}
								type="button"
								onClick={() => onClipTransitionInChange?.(opt.id)}
								className={cn(
									"flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left transition-all cursor-pointer",
									isCurrent
										? "border-primary/50 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/30"
										: "border-foreground/10 bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
								)}
							>
								<div className="flex items-center justify-between w-full">
									<IconComp className="w-3.5 h-3.5" />
									{isCurrent && <Check className="w-3 h-3 text-primary" />}
								</div>
								<span className="text-xs font-semibold text-foreground mt-1">
									{opt.label}
								</span>
								<span className="text-[9.5px] text-muted-foreground leading-tight">
									{opt.desc}
								</span>
							</button>
						);
					})}
				</div>

				{/* Duration Slider */}
				{(selectedClipTransitionIn ?? "none") !== "none" && (
					<div className="pt-2 border-t border-foreground/10 space-y-2">
						<SliderControl
							label={tSettings("clip.transitionDuration", "Transition Duration")}
							value={selectedClipTransitionInDurationMs ?? 400}
							defaultValue={400}
							min={100}
							max={1500}
							step={50}
							onChange={(v) => onClipTransitionInDurationChange?.(v)}
							formatValue={(v) => `${(v / 1000).toFixed(2)}s`}
							parseInput={(t) => Math.round(parseFloat(t.replace(/s$/, "")) * 1000) || 400}
						/>
						<div className="flex items-center gap-1">
							{[200, 400, 600, 800, 1000].map((dur) => (
								<button
									key={dur}
									type="button"
									onClick={() => onClipTransitionInDurationChange?.(dur)}
									className={cn(
										"flex-1 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer",
										selectedClipTransitionInDurationMs === dur
											? "bg-primary text-white shadow-xs"
											: "bg-foreground/5 text-muted-foreground hover:bg-foreground/10",
									)}
								>
									{dur / 1000}s
								</button>
							))}
						</div>
					</div>
				)}
			</section>
		);

		switch (activeEffectSection) {
			case "media":
				return mediaSectionContent;
			case "audio-record":
				return audioRecordSectionContent;
			case "video-adjust":
				return videoAdjustSectionContent;
			case "transitions":
				return transitionsSectionContent;
			case "settings":
				return settingsSectionContent;
			case "scene":
				return sceneSectionContent;
			case "color-grading":
				return colorGradingSectionContent;
			case "zoom":
				return zoomItemSectionContent;

			case "clip":
				return clipSectionContent;
			case "layout":
				return layoutSectionContent;
			case "audio":
				return audioSectionContent;
			case "frame":
				return sceneSectionContent;
			case "crop":
				return sceneSectionContent;
			case "captions":
				return captionsSectionContent;
			case "cursor":
				return (
					<section className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-3">
							<div className="flex items-center gap-3">
								<SectionLabel>
									{tSettings("sections.cursor", "Cursor")}
								</SectionLabel>
								<button
									type="button"
									onClick={resetCursorSection}
									className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
								>
									{t("common.actions.reset", "Reset")}
								</button>
							</div>
							<div className="flex items-center gap-3">
								<label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
									<span>{tSettings("effects.showCursor")}</span>
									<Switch
										checked={showCursor}
										onCheckedChange={onShowCursorChange}
										className="data-[state=checked]:bg-[#2563EB] scale-75"
									/>
								</label>
								<label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
									<span>{tSettings("effects.loopCursor")}</span>
									<Switch
										checked={loopCursor}
										onCheckedChange={onLoopCursorChange}
										className="data-[state=checked]:bg-[#2563EB] scale-75"
									/>
								</label>
							</div>
						</div>
						<div className="flex flex-col gap-1.5">
							<div className="space-y-1.5">
								<ToggleGroup
									type="single"
									value={cursorStyle}
									onValueChange={(value) => {
										if (value) {
											onCursorStyleChange?.(value as CursorStyle);
										}
									}}
									className="grid grid-cols-4 gap-2"
									aria-label={tSettings("effects.cursorStyle", "Cursor Style")}
								>
									{cursorStyleOptions.map((option) => (
										<ToggleGroupItem
											key={option.value}
											value={option.value}
											title={option.label}
											aria-label={option.label}
											className={cn(
												"group aspect-square h-auto min-w-0 rounded-[10px] border border-foreground/10 bg-foreground/[0.03] p-3 text-left text-foreground shadow-none transition-all hover:border-foreground/20 hover:bg-foreground/[0.06]",
												"data-[state=on]:border-[#2563EB]/70 data-[state=on]:bg-[#2563EB]/12 data-[state=on]:text-foreground",
											)}
										>
											<div className="flex h-full flex-col items-center justify-between gap-3">
												<div className="flex min-h-0 flex-1 items-center justify-center rounded-lg px-2 py-1.5">
													<CursorStylePreview
														style={option.value}
														previewUrls={cursorPreviewUrls}
													/>
												</div>
											</div>
										</ToggleGroupItem>
									))}
								</ToggleGroup>
							</div>
							<SliderControl
								label={tSettings("effects.cursorSize")}
								value={cursorSize}
								defaultValue={DEFAULT_CURSOR_SIZE}
								min={0.5}
								max={10}
								step={0.05}
								onChange={(v) => onCursorSizeChange?.(v)}
								formatValue={(v) => `${v.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.cursorMotionBlur")}
								value={cursorMotionBlur}
								defaultValue={DEFAULT_CURSOR_MOTION_BLUR}
								min={0}
								max={2}
								step={0.05}
								onChange={(v) => onCursorMotionBlurChange?.(v)}
								formatValue={(v) => `${v.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.cursorClickBounce")}
								value={cursorClickBounce}
								defaultValue={DEFAULT_CURSOR_CLICK_BOUNCE}
								min={0}
								max={5}
								step={0.05}
								onChange={(v) => onCursorClickBounceChange?.(v)}
								formatValue={(v) => `${v.toFixed(2)}×`}
								parseInput={(text) => parseFloat(text.replace(/×$/, ""))}
							/>
							<SliderControl
								label={tSettings(
									"effects.cursorClickBounceDuration",
									"Bounce Speed",
								)}
								value={cursorClickBounceDuration}
								defaultValue={DEFAULT_CURSOR_CLICK_BOUNCE_DURATION}
								min={60}
								max={500}
								step={5}
								onChange={(v) => onCursorClickBounceDurationChange?.(v)}
								formatValue={(v) => `${Math.round(v)} ms`}
								parseInput={(text) => parseFloat(text.replace(/ms$/i, "").trim())}
							/>
							<SliderControl
								label={tSettings("effects.cursorSway")}
								value={toCursorSwaySliderValue(cursorSway)}
								defaultValue={toCursorSwaySliderValue(DEFAULT_CURSOR_SWAY)}
								min={0}
								max={toCursorSwaySliderValue(2)}
								step={toCursorSwaySliderValue(0.05)}
								onChange={(v) => onCursorSwayChange?.(fromCursorSwaySliderValue(v))}
								formatValue={(v) =>
									v <= 0 ? tSettings("effects.off") : `${v.toFixed(2)}×`
								}
								parseInput={(text) => {
									const normalized = text.trim().toLowerCase();
									if (normalized === "off") return 0;
									return parseFloat(text.replace(/×$/, ""));
								}}
							/>
							<SliderControl
								label={tSettings("effects.perspectiveTilt", "3D Perspective Tilt")}
								value={Math.round((cameraPerspectiveTilt ?? 0) * 100)}
								defaultValue={Math.round(DEFAULT_CAMERA_PERSPECTIVE_TILT * 100)}
								min={0}
								max={100}
								step={5}
								onChange={(v) => onCameraPerspectiveTiltChange?.(v / 100)}
								formatValue={(v) =>
									v <= 0 ? tSettings("effects.off", "Off") : `${Math.round(v)}%`
								}
								parseInput={(text) => {
									const normalized = text.trim().toLowerCase();
									if (normalized === "off") return 0;
									return parseFloat(text.replace(/%$/, ""));
								}}
							/>
							{showDevMotionControls ? (
								<div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-2">
									<div className="text-[10px] text-muted-foreground">
										{tSettings(
											"effects.cursorDebugMovedToDev",
											"Cursor spring tuning is available in Settings > Dev.",
										)}
									</div>
								</div>
							) : null}
						</div>
						{renderExtensionPanelsForSections("cursor")}
					</section>
				);
			case "webcam":
				return (
					<section className="flex flex-col gap-2">
						<div className="flex items-center justify-between gap-3">
							<SectionLabel>{tSettings("sections.webcam", "Webcam")}</SectionLabel>
							<button
								type="button"
								onClick={resetWebcamSection}
								className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
							>
								{t("common.actions.reset", "Reset")}
							</button>
						</div>
						<div className="flex flex-col gap-1.5">
							<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
								<span className="text-[10px] text-muted-foreground">
									{tSettings("effects.show", "Show")}
								</span>
								<Switch
									checked={webcam?.enabled ?? false}
									onCheckedChange={(enabled) => updateWebcam({ enabled })}
									className="data-[state=checked]:bg-[#2563EB] scale-75"
								/>
							</div>
							<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
								<span className="text-[10px] text-muted-foreground">
									{tSettings("effects.webcamReactToZoom")}
								</span>
								<Switch
									checked={webcam?.reactToZoom ?? DEFAULT_WEBCAM_REACT_TO_ZOOM}
									onCheckedChange={(reactToZoom) => updateWebcam({ reactToZoom })}
									className="data-[state=checked]:bg-[#2563EB] scale-75"
								/>
							</div>
							<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
								<span className="text-[10px] text-muted-foreground">
									{tSettings("effects.webcamMirror", "Mirror webcam")}
								</span>
								<Switch
									checked={webcam?.mirror ?? true}
									onCheckedChange={(mirror) => updateWebcam({ mirror })}
									className="data-[state=checked]:bg-[#2563EB] scale-75"
								/>
							</div>
							<SliderControl
								label={tSettings("effects.webcamSize")}
								value={webcam?.size ?? DEFAULT_WEBCAM_SIZE}
								defaultValue={DEFAULT_WEBCAM_SIZE}
								min={10}
								max={100}
								step={1}
								onChange={(v) => updateWebcam({ size: v })}
								formatValue={(v) => `${Math.round(v)}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
							/>
							<div className="rounded-lg bg-foreground/[0.03] px-2.5 py-2">
								<div className="mb-2 flex items-center justify-between gap-2">
									<div className="text-[10px] text-muted-foreground">
										{tSettings("effects.webcamCrop", "Crop")}
									</div>
									<button
										type="button"
										onClick={() =>
											updateWebcam({ cropRegion: DEFAULT_CROP_REGION })
										}
										className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
									>
										{t("common.actions.reset", "Reset")}
									</button>
								</div>
								<WebcamCropControl
									cropRegion={webcamCrop}
									mirrored={webcam?.mirror ?? true}
									previewSrc={webcamPreviewSrc}
									previewCurrentTime={webcamPreviewCurrentTime}
									previewPlaying={webcamPreviewPlaying}
									previewTimeOffsetMs={webcam?.timeOffsetMs}
									onCropChange={(cropRegion) => updateWebcam({ cropRegion })}
								/>
							</div>
							<div className="rounded-lg bg-foreground/[0.03] px-2.5 py-2">
								<div className="mb-2 text-[10px] text-muted-foreground">
									{tSettings("effects.webcamPosition", "Position")}
								</div>
								<div className="grid grid-cols-3 gap-1.5">
									{WEBCAM_POSITION_PRESETS.map((option) => {
										const isActive = webcamPositionPreset === option.preset;
										return (
											<Button
												key={option.preset}
												type="button"
												onClick={() =>
													applyWebcamPositionPreset(option.preset)
												}
												className={cn(
													"h-8 rounded-lg border px-0 text-sm font-semibold transition-all",
													isActive
														? "border-[#2563EB] bg-[#2563EB] text-white"
														: "border-foreground/10 bg-foreground/5 text-muted-foreground hover:border-foreground/20 hover:bg-foreground/10",
												)}
											>
												{option.label}
											</Button>
										);
									})}
								</div>
								<div className="mt-2 flex items-center justify-between rounded-lg bg-black/10 px-2.5 py-1.5">
									<span className="text-[10px] text-muted-foreground">
										{tSettings(
											"effects.webcamCustomPosition",
											"Custom position",
										)}
									</span>
									<Switch
										checked={webcamPositionPreset === "custom"}
										onCheckedChange={(checked) =>
											applyWebcamPositionPreset(
												checked ? "custom" : DEFAULT_WEBCAM_POSITION_PRESET,
											)
										}
										className="data-[state=checked]:bg-[#2563EB] scale-75"
									/>
								</div>
							</div>
							{webcamPositionPreset === "custom" ? (
								<>
									<SliderControl
										label={tSettings("effects.webcamHorizontal", "Horizontal")}
										value={webcamPositionX * 100}
										defaultValue={DEFAULT_WEBCAM_POSITION_X * 100}
										min={0}
										max={100}
										step={1}
										onChange={(v) =>
											updateWebcam({
												positionPreset: "custom",
												positionX: v / 100,
											})
										}
										formatValue={(v) => `${Math.round(v)}%`}
										parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
									/>
									<SliderControl
										label={tSettings("effects.webcamVertical", "Vertical")}
										value={webcamPositionY * 100}
										defaultValue={DEFAULT_WEBCAM_POSITION_Y * 100}
										min={0}
										max={100}
										step={1}
										onChange={(v) =>
											updateWebcam({
												positionPreset: "custom",
												positionY: v / 100,
											})
										}
										formatValue={(v) => `${Math.round(v)}%`}
										parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
									/>
								</>
							) : null}
							<SliderControl
								label={tSettings("effects.webcamMargin", "Margin")}
								value={webcam?.margin ?? DEFAULT_WEBCAM_MARGIN}
								defaultValue={DEFAULT_WEBCAM_MARGIN}
								min={0}
								max={96}
								step={1}
								onChange={(v) => updateWebcam({ margin: v })}
								formatValue={(v) => `${Math.round(v)}px`}
								parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.webcamRoundness")}
								value={webcam?.cornerRadius ?? DEFAULT_WEBCAM_CORNER_RADIUS}
								defaultValue={DEFAULT_WEBCAM_CORNER_RADIUS}
								min={0}
								max={160}
								step={1}
								onChange={(v) => updateWebcam({ cornerRadius: v })}
								formatValue={(v) => `${Math.round(v)}px`}
								parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
							/>
							<SliderControl
								label={tSettings("effects.webcamShadow")}
								value={webcam?.shadow ?? DEFAULT_WEBCAM_SHADOW}
								defaultValue={DEFAULT_WEBCAM_SHADOW}
								min={0}
								max={1}
								step={0.01}
								onChange={(v) => updateWebcam({ shadow: v })}
								formatValue={(v) => `${Math.round(v * 100)}%`}
								parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
							/>
							<div className="rounded-lg bg-foreground/[0.03] px-2.5 py-2">
								<div className="flex flex-col gap-2">
									<div className="min-w-0">
										<div className="text-[10px] text-muted-foreground">
											{tSettings("effects.webcamFootage")}
										</div>
										<div className="mt-0.5 break-all text-[10px] leading-4 text-muted-foreground/70">
											{webcamFileName ??
												tSettings("effects.webcamFootageDescription")}
										</div>
									</div>
									<div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
										<Button
											type="button"
											variant="outline"
											onClick={onUploadWebcam}
											className="h-7 min-w-0 gap-1.5 border-foreground/10 bg-foreground/5 px-2 text-[10px] text-foreground hover:bg-foreground/10 hover:text-foreground"
										>
											<Upload className="h-3 w-3" />
											<span className="min-w-0 truncate">
												{webcam?.sourcePath
													? tSettings("effects.replaceWebcamFootage")
													: tSettings("effects.uploadWebcamFootage")}
											</span>
										</Button>
										{webcam?.sourcePath ? (
											<Button
												type="button"
												variant="outline"
												onClick={onClearWebcam}
												className="h-7 min-w-0 gap-1.5 border-foreground/10 bg-foreground/5 px-2 text-[10px] text-foreground hover:bg-foreground/10 hover:text-foreground"
											>
												<Trash2 className="h-3 w-3" />
												<span className="min-w-0 truncate">
													{tSettings("effects.removeWebcamFootage")}
												</span>
											</Button>
										) : null}
									</div>
								</div>
							</div>
							{renderExtensionPanelsForSections("webcam")}
						</div>
					</section>
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
						if (activeEffectSection === "layout" && selectedLayoutId) return false;
						if (activeEffectSection === "zoom" && selectedZoomId) return false;
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
				{activeEffectSection === "zoom" && selectedZoomId && (
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
				{activeEffectSection === "layout" && selectedLayoutId && (
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
