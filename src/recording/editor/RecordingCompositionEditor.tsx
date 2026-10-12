import {
	ArrowLeft,
	CursorClick,
	MagnifyingGlassPlus,
	Palette,
	Pause,
	Play,
	Plus,
	Scissors,
	SkipBack,
	SkipForward,
	Sparkle,
	SquaresFour,
} from "@phosphor-icons/react";
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ProjectPreview } from "@/components/editor/ProjectPreview";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { setAnnotationPositionKeyframe } from "@/components/video-editor/annotationKeyframes";
import { SettingsPanel } from "@/components/video-editor/SettingsPanel";
import { ZOOM_DEPTH_OPTIONS } from "@/components/video-editor/settings/sections/ZoomItemSection";
import {
	buildAutoReframeSuggestions,
	buildInteractionZoomSuggestions,
} from "@/components/video-editor/timeline/zoomSuggestionUtils";
import {
	type AspectRatio,
	getAspectRatioValue,
	resolveAspectRatioCanvas,
} from "@/utils/aspectRatioUtils";
import { RecordingFrameAppearancePanel } from "./RecordingFrameAppearancePanel";

function formatTimecode(seconds: number): string {
	const totalSecs = Math.max(0, seconds);
	const mins = Math.floor(totalSecs / 60);
	const secs = Math.floor(totalSecs % 60);
	const centis = Math.floor((totalSecs % 1) * 100);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

import type {
	AnnotationPosition,
	AnnotationRegion,
	AnnotationType,
	EditorEffectSection,
	LayoutRegion,
	PlaybackSpeed,
	ZoomRegion,
} from "@/components/video-editor/types";
import { mapCompositionTime } from "@/core/timeline/timeMapping";
import { RecordingTimeline, type RecordingTimelineHandle } from "../components/RecordingTimeline";
import { recordingPreviewProject, sourceToCompositionTime } from "../evaluation";
import { localMediaUrl } from "../mediaProbe";
import type { RecordComposition, RecordingPackage, RecordingSettings } from "../types";
import { changeRecordingSettings, resolveRecordingSettings } from "./compositionAdapter";
import { playbackOutputTimeUs } from "./playbackClock";
import { RecordingOverlayHandles } from "./RecordingOverlayHandles";

export interface RecordingCompositionEditorProps {
	package: RecordingPackage;
	composition: RecordComposition;
	projectTitle?: string;
	canvas?: { width: number; height: number; fps?: number };
	aspectRatio?: AspectRatio;
	clipTransform?: { x: number; y: number; scale: number; rotation: number; opacity: number };
	onClipTransformChange?: (transform: {
		x: number;
		y: number;
		scale: number;
		rotation: number;
		opacity: number;
	}) => void;
	onAspectRatioChange?: (ratio: AspectRatio) => void;
	onChange: (next: RecordComposition) => void;
	onClose: () => void;
}
type PanelProps = ComponentProps<typeof SettingsPanel>;
const RECORDING_OVERLAY_TYPES = [
	{ label: "Text", type: "text" },
	{ label: "Image", type: "image" },
	{ label: "Arrow", type: "figure" },
	{ label: "Blur", type: "blur" },
] as const satisfies { label: string; type: AnnotationType }[];

const settingCallbacks: Partial<Record<keyof RecordingSettings, keyof PanelProps>> = {
	wallpaper: "onWallpaperChange",
	shadowIntensity: "onShadowChange",
	backgroundBlur: "onBackgroundBlurChange",
	borderRadius: "onBorderRadiusChange",
	padding: "onPaddingChange",
	cropRegion: "onCropChange",
	frame: "onFrameChange",
	webcam: "onWebcamChange",
	showCursor: "onShowCursorChange",
	loopCursor: "onLoopCursorChange",
	cursorStyle: "onCursorStyleChange",
	cursorSize: "onCursorSizeChange",
	cursorSmoothing: "onCursorSmoothingChange",
	cursorSpringStiffnessMultiplier: "onCursorSpringStiffnessMultiplierChange",
	cursorSpringDampingMultiplier: "onCursorSpringDampingMultiplierChange",
	cursorSpringMassMultiplier: "onCursorSpringMassMultiplierChange",
	cameraSpringStiffnessMultiplier: "onCameraSpringStiffnessMultiplierChange",
	cameraSpringDampingMultiplier: "onCameraSpringDampingMultiplierChange",
	cameraSpringMassMultiplier: "onCameraSpringMassMultiplierChange",
	zoomClassicMode: "onZoomClassicModeChange",
	cursorMotionBlur: "onCursorMotionBlurChange",
	cursorClickBounce: "onCursorClickBounceChange",
	cursorClickBounceDuration: "onCursorClickBounceDurationChange",
	cursorSway: "onCursorSwayChange",
	zoomMotionBlurTuning: "onZoomMotionBlurTuningChange",
	zoomTemporalMotionBlur: "onZoomTemporalMotionBlurChange",
	zoomMotionBlurSampleCount: "onZoomMotionBlurSampleCountChange",
	zoomMotionBlurShutterFraction: "onZoomMotionBlurShutterFractionChange",
	connectZooms: "onConnectZoomsChange",
	zoomInDurationMs: "onZoomInDurationMsChange",
	zoomInOverlapMs: "onZoomInOverlapMsChange",
	zoomOutDurationMs: "onZoomOutDurationMsChange",
	connectedZoomGapMs: "onConnectedZoomGapMsChange",
	connectedZoomDurationMs: "onConnectedZoomDurationMsChange",
	zoomInEasing: "onZoomInEasingChange",
	zoomOutEasing: "onZoomOutEasingChange",
	connectedZoomEasing: "onConnectedZoomEasingChange",
};

type RecordingSection = Extract<EditorEffectSection, "scene" | "cursor" | "layout"> | "appearance";

const RECORDING_TABS: {
	id: RecordingSection;
	label: string;
	icon: typeof Palette;
}[] = [
	{ id: "scene", label: "Scene", icon: Palette },
	{ id: "cursor", label: "Cursor", icon: CursorClick },
	{ id: "layout", label: "Layout", icon: SquaresFour },
	{ id: "appearance", label: "Appearance", icon: Palette },
];

/** Controlled effect editor. Project library, recording, persistence and export live outside. */
export function RecordingCompositionEditor({
	package: pkg,
	composition,
	projectTitle,
	canvas: propCanvas,
	aspectRatio: propAspectRatio,
	clipTransform,
	onClipTransformChange,
	onAspectRatioChange,
	onChange,
	onClose,
}: RecordingCompositionEditorProps) {
	const [currentTransform, setCurrentTransform] = useState(
		clipTransform ?? { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
	);

	useEffect(() => {
		if (clipTransform) {
			setCurrentTransform(clipTransform);
		}
	}, [clipTransform]);

	const settings = useMemo(() => resolveRecordingSettings(pkg, composition), [pkg, composition]);

	const initialAspectRatio: AspectRatio = useMemo(() => {
		if (propAspectRatio) {
			return propAspectRatio;
		}
		if (composition.settings?.aspectRatio) {
			return composition.settings.aspectRatio as AspectRatio;
		}
		if (propCanvas) {
			const { width, height } = propCanvas;
			if (width === 1080 && height === 1920) return "9:16";
			if (width === 1080 && height === 1080) return "1:1";
			if (width === 1080 && height === 1350) return "4:5";
			if (width === 1920 && height === 1080) return "16:9";
			if (width === 1440 && height === 1080) return "4:3";
			if (width === 1728 && height === 1080) return "16:10";
			if (width === 1080 && height === 1728) return "10:16";
		}
		return "16:9";
	}, [propAspectRatio, composition.settings?.aspectRatio, propCanvas]);

	const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialAspectRatio);

	useEffect(() => {
		if (propAspectRatio) {
			setAspectRatio(propAspectRatio);
		}
	}, [propAspectRatio]);

	const previewCanvas = useMemo(
		() =>
			resolveAspectRatioCanvas(aspectRatio, propCanvas, {
				width: pkg.width,
				height: pkg.height,
			}),
		[aspectRatio, propCanvas, pkg.width, pkg.height],
	);

	const [sourceUrl, setSourceUrl] = useState(""),
		[playing, setPlaying] = useState(false),
		[sourceSeconds, setSourceSeconds] = useState(0),
		[overlayPositionPreview, setOverlayPositionPreview] = useState<{
			id: string;
			position: AnnotationPosition;
			keyframeId: string;
		} | null>(null),
		[section, setSection] = useState<RecordingSection>("scene"),
		[selectedZoomId, setSelectedZoomId] = useState<string | null>(null),
		[selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null),
		[selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null),
		[error, setError] = useState<string | null>(null);
	const [appearanceTarget, setAppearanceTarget] = useState<"window" | "webcam">("window");
	const webcamPath = pkg.webcam?.path;
	const [webcamPreview, setWebcamPreview] = useState<{ path: string; url: string } | null>(null);
	const timeline = useRef<RecordingTimelineHandle>(null);
	const pendingOverlayType = useRef<AnnotationType | null>(null);
	const currentMs = Math.round(sourceSeconds * 1000),
		durationMs = pkg.durationUs / 1000;
	useEffect(() => {
		let active = true;
		void localMediaUrl(pkg.screen.path)
			.then((url) => {
				if (active) setSourceUrl(url);
			})
			.catch((e) => {
				if (active) setError(String(e));
			});
		return () => {
			active = false;
		};
	}, [pkg.screen.path]);
	useEffect(() => {
		let active = true;
		setWebcamPreview(null);
		if (webcamPath) {
			void localMediaUrl(webcamPath)
				.then((url) => {
					if (active) setWebcamPreview({ path: webcamPath, url });
				})
				.catch((e) => {
					if (active) setError(`Webcam preview: ${String(e)}`);
				});
		}
		return () => {
			active = false;
		};
	}, [webcamPath]);
	const previewComposition = useMemo(() => {
		if (!overlayPositionPreview) return composition;
		const active = settings.annotationRegions.find(
			(annotation) => annotation.id === overlayPositionPreview.id,
		);
		if (!active) return composition;
		const keyframes = setAnnotationPositionKeyframe(
			active,
			overlayPositionPreview.position,
			currentMs,
			overlayPositionPreview.keyframeId,
		);
		return changeRecordingSettings(pkg, composition, {
			annotationRegions: settings.annotationRegions.map((annotation) =>
				annotation.id === active.id ? { ...annotation, keyframes } : annotation,
			),
		});
	}, [composition, currentMs, overlayPositionPreview, pkg, settings.annotationRegions]);
	const previewProject = useMemo(
		() => recordingPreviewProject(pkg, previewComposition, previewCanvas, currentTransform),
		[pkg, previewComposition, previewCanvas, currentTransform],
	);
	const timelineAnnotations = useMemo(
		() =>
			settings.annotationRegions.map((annotation, index) =>
				annotation.name?.trim()
					? annotation
					: { ...annotation, name: `Overlay ${index + 1}` },
			),
		[settings.annotationRegions],
	);
	const clipName = useMemo(() => {
		const p = pkg.screen.path;
		if (!p) return "Screen Recording";
		const parts = p.split(/[/\\]/);
		return parts[parts.length - 1] || "Screen Recording";
	}, [pkg.screen.path]);
	const outputUs = sourceToCompositionTime(composition, sourceSeconds * 1_000_000);
	useEffect(() => {
		if (!playing) return;
		const base = outputUs,
			start = performance.now();
		let frame = 0;
		const tick = () => {
			const output = playbackOutputTimeUs(
				base,
				performance.now() - start,
				composition.durationUs,
			);
			if (output === null) {
				setPlaying(false);
				return;
			}
			setSourceSeconds(mapCompositionTime(composition, output) / 1_000_000);
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [playing, composition]);
	const update = useCallback(
		(patch: Partial<RecordingSettings>) => {
			try {
				onChange(changeRecordingSettings(pkg, composition, patch));
				setError(null);
			} catch (e) {
				setError(e instanceof Error ? e.message : String(e));
			}
		},
		[pkg, composition, onChange],
	);
	const callbacks = Object.fromEntries(
		Object.entries(settingCallbacks).map(([key, callback]) => [
			callback,
			(value: unknown) => update({ [key]: value }),
		]),
	) as Partial<PanelProps>;
	const updateZoom = (id: string, patch: Partial<ZoomRegion>) =>
		update({
			zoomRegions: settings.zoomRegions.map((z) => (z.id === id ? { ...z, ...patch } : z)),
		});
	const updateAnnotation = (id: string, patch: Partial<AnnotationRegion>) =>
		update({
			annotationRegions: settings.annotationRegions.map((a) =>
				a.id === id ? { ...a, ...patch } : a,
			),
		});
	const updateLayout = (id: string, patch: Partial<LayoutRegion>) =>
		update({
			layoutRegions: settings.layoutRegions.map((a) =>
				a.id === id ? { ...a, ...patch } : a,
			),
		});
	const selectedZoom = settings.zoomRegions.find((z) => z.id === selectedZoomId),
		selectedLayout = settings.layoutRegions.find((l) => l.id === selectedLayoutId);
	const selectedAnnotation = settings.annotationRegions.find(
		(a) => a.id === selectedAnnotationId,
	);
	const handleAspectRatioChange = useCallback(
		(nextRatio: AspectRatio) => {
			setAspectRatio(nextRatio);
			update({ aspectRatio: nextRatio });
			onAspectRatioChange?.(nextRatio);
		},
		[update, onAspectRatioChange],
	);

	const suggestZooms = () => {
		const sourceAspectRatio = pkg.height > 0 ? pkg.width / pkg.height : 16 / 9;
		const targetRatioValue = getAspectRatioValue(aspectRatio, sourceAspectRatio);
		const suggestions =
			targetRatioValue < 1.1
				? buildAutoReframeSuggestions({
						cursorTelemetry: settings.cursorTelemetry ?? [],
						totalMs: pkg.durationUs / 1000,
						targetAspectRatio: aspectRatio,
						sourceAspectRatio,
					})
				: buildInteractionZoomSuggestions({
						cursorTelemetry: settings.cursorTelemetry ?? [],
						totalMs: pkg.durationUs / 1000,
						defaultDurationMs: 2500,
					});
		update({
			zoomRegions: suggestions.suggestions.map((z) => ({
				id: crypto.randomUUID(),
				startMs: z.start,
				endMs: z.end,
				depth: z.depth ?? 2,
				focus: z.focus,
				mode: "auto" as const,
			})),
		});
	};
	const addAnnotation = (
		startMs: number,
		endMs: number,
		trackIndex = 0,
		type: AnnotationType = "text",
	) => {
		const id = crypto.randomUUID();
		const number = settings.annotationRegions.length + 1;
		const textContent = type === "text" ? "Text" : "";
		update({
			annotationRegions: [
				...settings.annotationRegions,
				{
					id,
					name: `Overlay ${number}`,
					startMs,
					endMs,
					type,
					content: textContent,
					textContent: type === "text" ? textContent : undefined,
					position: { x: 50, y: 50 },
					size: type === "text" ? { width: 40, height: 15 } : { width: 25, height: 25 },
					style: {
						fontSize: 48,
						fontFamily: "Inter",
						color: "#ffffff",
						backgroundColor: "transparent",
						fontWeight: "bold",
						fontStyle: "normal",
						textDecoration: "none",
						borderRadius: 0,
						textAlign: "center",
					},
					figureData:
						type === "figure"
							? { arrowDirection: "right", color: "#ff4d6d", strokeWidth: 6 }
							: undefined,
					blurIntensity: type === "blur" ? 16 : undefined,
					zIndex: settings.annotationRegions.length + 1,
					trackIndex,
				},
			],
		});
		setSelectedAnnotationId(id);
	};
	const addOverlayAtTimelineSelection = useCallback((type: AnnotationType) => {
		pendingOverlayType.current = type;
		timeline.current?.addAnnotation();
	}, []);

	const handleCutAtPlayhead = useCallback(() => {
		const startMs = Math.max(0, currentMs);
		const endMs = Math.min(durationMs, startMs + 1000);
		if (endMs > startMs) {
			update({
				trimRegions: [...settings.trimRegions, { id: crypto.randomUUID(), startMs, endMs }],
			});
		}
	}, [currentMs, durationMs, settings.trimRegions, update]);

	const handleAddZoomAtCurrent = useCallback(() => {
		const id = crypto.randomUUID();
		const startMs = Math.max(0, currentMs);
		const endMs = Math.min(durationMs, startMs + 2500);
		update({
			zoomRegions: [
				...settings.zoomRegions,
				{
					id,
					startMs,
					endMs,
					depth: 2,
					focus: { cx: 0.5, cy: 0.5 },
					mode: "manual",
				},
			],
		});
		setSelectedZoomId(id);
	}, [currentMs, durationMs, settings.zoomRegions, update]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target;
			if (
				target instanceof HTMLElement &&
				(target.matches("input,textarea,select,[contenteditable=true]") ||
					target.isContentEditable)
			) {
				return;
			}

			if (e.key === " ") {
				e.preventDefault();
				setPlaying((v) => !v);
				return;
			}

			if (e.key === "Escape") {
				e.preventDefault();
				if (selectedZoomId || selectedAnnotationId || selectedLayoutId) {
					setSelectedZoomId(null);
					setSelectedAnnotationId(null);
					setSelectedLayoutId(null);
				} else {
					onClose();
				}
				return;
			}

			if (e.key === "Delete" || e.key === "Backspace") {
				if (selectedZoomId) {
					e.preventDefault();
					update({
						zoomRegions: settings.zoomRegions.filter((z) => z.id !== selectedZoomId),
					});
					setSelectedZoomId(null);
				} else if (selectedAnnotationId) {
					e.preventDefault();
					update({
						annotationRegions: settings.annotationRegions.filter(
							(a) => a.id !== selectedAnnotationId,
						),
					});
					setSelectedAnnotationId(null);
				} else if (selectedLayoutId) {
					e.preventDefault();
					update({
						layoutRegions: settings.layoutRegions.filter(
							(l) => l.id !== selectedLayoutId,
						),
					});
					setSelectedLayoutId(null);
				}
				return;
			}

			if (
				(e.key.toLowerCase() === "s" || e.key.toLowerCase() === "c") &&
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey
			) {
				e.preventDefault();
				handleCutAtPlayhead();
				return;
			}

			if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey && !e.altKey) {
				e.preventDefault();
				addOverlayAtTimelineSelection("text");
				return;
			}

			if (e.key.toLowerCase() === "z" && !e.ctrlKey && !e.metaKey && !e.altKey) {
				e.preventDefault();
				handleAddZoomAtCurrent();
				return;
			}

			if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				e.preventDefault();
				setPlaying(false);
				const stepSeconds = e.shiftKey ? 1 : 1 / 60;
				const dir = e.key === "ArrowLeft" ? -1 : 1;
				const durationSec = pkg.durationUs / 1_000_000;
				setSourceSeconds((curr) =>
					Math.max(0, Math.min(durationSec, curr + dir * stepSeconds)),
				);
				return;
			}

			if (e.key === "Home") {
				e.preventDefault();
				setPlaying(false);
				setSourceSeconds(0);
				return;
			}

			if (e.key === "End") {
				e.preventDefault();
				setPlaying(false);
				setSourceSeconds(pkg.durationUs / 1_000_000);
				return;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		pkg.durationUs,
		onClose,
		selectedZoomId,
		selectedAnnotationId,
		selectedLayoutId,
		settings,
		update,
		handleAddZoomAtCurrent,
		handleCutAtPlayhead,
		addOverlayAtTimelineSelection,
	]);
	const addSpeed = (speed: PlaybackSpeed) => {
		const startMs = Math.max(0, currentMs),
			endMs = Math.min(durationMs, startMs + 3000);
		if (endMs > startMs)
			update({
				speedRegions: [
					...settings.speedRegions.filter(
						(s) => s.endMs <= startMs || s.startMs >= endMs,
					),
					{ id: crypto.randomUUID(), startMs, endMs, speed },
				],
			});
	};
	return (
		<section className="recording-composition-editor">
			<header className="recording-editor-header">
				<div className="recording-header-left">
					<button
						type="button"
						className="recording-back-button"
						onClick={onClose}
						title="Return to project timeline (Esc)"
					>
						<ArrowLeft size={13} weight="bold" />
						<span>Timeline</span>
						<kbd className="recording-kbd">Esc</kbd>
					</button>
					<span className="recording-header-sep">/</span>
					{projectTitle ? (
						<>
							<span className="recording-breadcrumb-project" title={projectTitle}>
								{projectTitle}
							</span>
							<span className="recording-header-sep">/</span>
						</>
					) : null}
					<div className="recording-header-title">
						<span className="recording-header-label">Clip Effects</span>
						<span className="recording-clip-badge" title={clipName}>
							{clipName}
						</span>
					</div>
				</div>
				<div className="recording-header-right">
					<div className="recording-aspect-select-wrapper">
						<select
							className="recording-aspect-select"
							value={aspectRatio}
							onChange={(e) => handleAspectRatioChange(e.target.value as AspectRatio)}
							title="Preview Aspect Ratio"
							aria-label="Preview aspect ratio"
						>
							<option value="16:9">16:9 Landscape</option>
							<option value="9:16">9:16 Shorts / Reels</option>
							<option value="1:1">1:1 Square</option>
							<option value="4:5">4:5 Portrait</option>
							<option value="4:3">4:3 Standard</option>
							<option value="16:10">16:10 Widescreen</option>
							<option value="native">
								Native ({pkg.width}×{pkg.height})
							</option>
						</select>
					</div>
					<span className="recording-badge-meta">{(durationMs / 1000).toFixed(1)}s</span>
				</div>
			</header>
			{error && (
				<div role="alert" className="project-error">
					{error}
				</div>
			)}
			<div className="recording-editor-body">
				<div className="recording-editor-monitor">
					<div className="recording-preview-wrapper">
						<div
							className="recording-preview-stage"
							style={{
								aspectRatio: `${previewCanvas.width} / ${previewCanvas.height}`,
							}}
						>
							<ProjectPreview
								project={previewProject}
								timeUs={outputUs}
								playing={playing}
								onError={setError}
								selectedClipId="preview-clip"
								canTransformClip={(_clipId, assetKind) =>
									assetKind === "text" ||
									assetKind === "shape" ||
									assetKind === "image"
								}
								onUpdateClipTransform={(_, nextTransform) => {
									setCurrentTransform(nextTransform);
									onClipTransformChange?.(nextTransform);
								}}
							/>
							<RecordingOverlayHandles
								annotations={settings.annotationRegions}
								currentMs={currentMs}
								playing={playing}
								selectedAnnotationId={selectedAnnotationId}
								onSelect={setSelectedAnnotationId}
								onPreviewPosition={setOverlayPositionPreview}
								onCommitPosition={(id, position, keyframeId) => {
									const annotation = settings.annotationRegions.find(
										(candidate) => candidate.id === id,
									);
									if (!annotation) return;
									updateAnnotation(id, {
										keyframes: setAnnotationPositionKeyframe(
											annotation,
											position,
											currentMs,
											keyframeId,
										),
									});
								}}
							/>
						</div>
					</div>
					<div className="recording-editor-transport">
						<div className="recording-transport-center">
							<button
								type="button"
								className="recording-step-button"
								aria-label="Step back 1s (Left Arrow)"
								title="Step back 1s (←)"
								onClick={() => {
									setPlaying(false);
									setSourceSeconds((curr) => Math.max(0, curr - 1));
								}}
							>
								<SkipBack size={13} weight="bold" />
							</button>
							<button
								type="button"
								className="recording-play-button"
								aria-label={
									playing ? "Pause recording (Space)" : "Play recording (Space)"
								}
								title={playing ? "Pause (Space)" : "Play (Space)"}
								onClick={() => setPlaying((v) => !v)}
							>
								{playing ? (
									<Pause size={15} weight="fill" />
								) : (
									<Play size={15} weight="fill" />
								)}
							</button>
							<button
								type="button"
								className="recording-step-button"
								aria-label="Step forward 1s (Right Arrow)"
								title="Step forward 1s (→)"
								onClick={() => {
									setPlaying(false);
									setSourceSeconds((curr) =>
										Math.min(pkg.durationUs / 1_000_000, curr + 1),
									);
								}}
							>
								<SkipForward size={13} weight="bold" />
							</button>
							<div className="recording-timecode">
								<span className="recording-time-current">
									{formatTimecode(sourceSeconds)}
								</span>
								<span className="recording-time-sep">/</span>
								<span className="recording-time-total">
									{formatTimecode(durationMs / 1000)}
								</span>
							</div>
						</div>
					</div>
				</div>

				<aside className="recording-editor-settings">
					<nav className="recording-section-tabs" aria-label="Recording effect sections">
						{RECORDING_TABS.map((tab) => {
							const Icon = tab.icon;
							const isActive = section === tab.id;
							return (
								<button
									key={tab.id}
									type="button"
									className={`recording-section-tab-btn ${isActive ? "active" : ""}`}
									aria-pressed={isActive}
									onClick={() => {
										setSelectedAnnotationId(null);
										setSection(tab.id);
									}}
									title={tab.label}
								>
									<Icon size={14} weight={isActive ? "fill" : "regular"} />
									<span>{tab.label}</span>
								</button>
							);
						})}
					</nav>
					<div className="recording-settings-scroll">
						{section !== "appearance" && selectedAnnotation && (
							<div className="recording-motion-control">
								<span>Layer position</span>
								{(["x", "y"] as const).map((axis) => (
									<label key={axis}>
										<span>{axis.toUpperCase()}</span>
										<input
											type="range"
											min={0}
											max={100}
											step={1}
											value={selectedAnnotation.position[axis]}
											onChange={(event) =>
												updateAnnotation(selectedAnnotation.id, {
													position: {
														...selectedAnnotation.position,
														[axis]: Number(event.target.value),
													},
												})
											}
										/>
									</label>
								))}
								{(["width", "height"] as const).map((axis) => (
									<label key={axis}>
										<span>{axis}</span>
										<input
											type="range"
											min={1}
											max={100}
											step={1}
											value={selectedAnnotation.size[axis]}
											onChange={(event) =>
												updateAnnotation(selectedAnnotation.id, {
													size: {
														...selectedAnnotation.size,
														[axis]: Number(event.target.value),
													},
												})
											}
										/>
									</label>
								))}
							</div>
						)}
						{section === "appearance" && (
							<RecordingFrameAppearancePanel
								target={appearanceTarget}
								appearance={settings.frameAppearances[appearanceTarget]}
								onTargetChange={setAppearanceTarget}
								onChange={(target, appearance) =>
									update({
										frameAppearances: {
											...settings.frameAppearances,
											[target]: appearance,
										},
									})
								}
								presetLibrary={window.electronAPI.recordFramePresets}
							/>
						)}
						<SettingsPanel
							className={section === "appearance" ? "hidden" : undefined}
							{...settings}
							{...callbacks}
							selected={settings.wallpaper}
							onWallpaperChange={(path) => update({ wallpaper: path })}
							activeEffectSection={section === "appearance" ? "scene" : section}
							aspectRatio={aspectRatio}
							onAspectRatioChange={handleAspectRatioChange}
							webcamPreviewSrc={
								webcamPreview && webcamPreview.path === webcamPath
									? webcamPreview.url
									: null
							}
							webcamPreviewCurrentTime={sourceSeconds}
							webcamPreviewPlaying={playing}
							selectedZoomId={selectedZoomId}
							selectedZoomDepth={selectedZoom?.depth}
							selectedZoomMode={selectedZoom?.mode}
							onZoomDepthChange={(depth) => {
								if (selectedZoomId) updateZoom(selectedZoomId, { depth });
							}}
							onZoomModeChange={(mode) => {
								if (selectedZoomId) updateZoom(selectedZoomId, { mode });
							}}
							onZoomDelete={(id) =>
								update({
									zoomRegions: settings.zoomRegions.filter((z) => z.id !== id),
								})
							}
							selectedLayoutId={selectedLayoutId}
							selectedLayoutPreset={selectedLayout?.preset}
							selectedLayoutTransitionMs={selectedLayout?.transitionMs}
							selectedLayoutEasing={selectedLayout?.easing}
							selectedLayoutCameraSettings={
								selectedLayout
									? {
											position: "bottom-right",
											size: 25,
											...selectedLayout.cameraSettings,
										}
									: undefined
							}
							onLayoutPresetChange={(preset) => {
								if (selectedLayoutId) updateLayout(selectedLayoutId, { preset });
							}}
							onLayoutCameraSettingsChange={(patch) => {
								if (selectedLayoutId)
									updateLayout(selectedLayoutId, {
										cameraSettings: {
											...selectedLayout?.cameraSettings,
											...patch,
										},
									});
							}}
							onLayoutTransitionChange={(transitionMs) => {
								if (selectedLayoutId)
									updateLayout(selectedLayoutId, { transitionMs });
							}}
							onLayoutEasingChange={(easing) => {
								if (selectedLayoutId) updateLayout(selectedLayoutId, { easing });
							}}
							onLayoutDelete={(id) =>
								update({
									layoutRegions: settings.layoutRegions.filter(
										(l) => l.id !== id,
									),
								})
							}
							selectedAnnotationId={selectedAnnotationId}
							onAnnotationContentChange={(id, content) =>
								updateAnnotation(id, { content, textContent: content })
							}
							onAnnotationTypeChange={(id, type) => updateAnnotation(id, { type })}
							onAnnotationStyleChange={(id, style) => {
								const a = settings.annotationRegions.find((a) => a.id === id);
								if (a) updateAnnotation(id, { style: { ...a.style, ...style } });
							}}
							onAnnotationFigureDataChange={(id, figureData) =>
								updateAnnotation(id, { figureData })
							}
							onAnnotationBlurIntensityChange={(id, blurIntensity) =>
								updateAnnotation(id, { blurIntensity })
							}
							onAnnotationBlurColorChange={(id, blurColor) =>
								updateAnnotation(id, { blurColor })
							}
							onAnnotationAnimationChange={updateAnnotation}
							onAnnotationLayerChange={updateAnnotation}
							onAnnotationDelete={(id) =>
								update({
									annotationRegions: settings.annotationRegions.filter(
										(a) => a.id !== id,
									),
								})
							}
						/>
					</div>
				</aside>
			</div>
			<div className="recording-timeline-container">
				<div className="recording-timeline-toolbar">
					<div className="recording-timeline-tools-left">
						<button
							type="button"
							className="recording-tb-btn recording-tb-btn-cut"
							title="Cut / trim 1s at playhead (S / C)"
							onClick={handleCutAtPlayhead}
						>
							<Scissors size={13} />
							<span>Cut</span>
							<kbd className="recording-tb-kbd">S</kbd>
						</button>
						<span className="recording-tb-separator" />
						<button
							type="button"
							className="recording-tb-btn"
							onClick={suggestZooms}
							title="Auto-detect zooms based on mouse clicks"
						>
							<Sparkle size={13} weight="fill" />
							<span>Auto zoom</span>
						</button>
						<button
							type="button"
							className="recording-tb-btn"
							onClick={handleAddZoomAtCurrent}
							title="Add zoom region at playhead (Z)"
						>
							<MagnifyingGlassPlus size={13} />
							<span>Zoom</span>
							<kbd className="recording-tb-kbd">Z</kbd>
						</button>
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<button
									type="button"
									className="recording-tb-btn"
									aria-label="Add overlay"
									title="Add overlay · T adds text"
								>
									<Plus size={13} weight="bold" />
									<span>Overlay</span>
									<kbd className="recording-tb-kbd">T</kbd>
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" aria-label="Overlay types">
								{RECORDING_OVERLAY_TYPES.map(({ label, type }) => (
									<DropdownMenuItem
										key={type}
										onSelect={() => addOverlayAtTimelineSelection(type)}
									>
										{label}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
						<button
							type="button"
							className="recording-tb-btn"
							onClick={() => timeline.current?.addLayout()}
							title="Add camera layout region"
						>
							<SquaresFour size={13} />
							<span>Layout</span>
						</button>
						<span className="recording-tb-separator" />
						<div className="recording-speed-wrapper">
							<select
								aria-label="Add internal speed region"
								value=""
								onChange={(event) =>
									addSpeed(Number(event.target.value) as PlaybackSpeed)
								}
								className="recording-speed-select"
							>
								<option value="" disabled>
									Speed
								</option>
								<option value="0.5">0.5×</option>
								<option value="2">2×</option>
							</select>
						</div>
					</div>
					<div className="recording-timeline-tools-right">
						<span className="recording-tb-hint">
							<kbd>Space</kbd> Play · <kbd>S</kbd> Cut · <kbd>Z</kbd> Zoom ·{" "}
							<kbd>T</kbd> Text overlay · <kbd>Esc</kbd> Back
						</span>
					</div>
				</div>
				{selectedZoom && (
					<div
						className="flex flex-wrap items-center gap-3 px-4 py-2 text-xs"
						aria-label="Selected zoom settings"
					>
						<label className="flex items-center gap-2">
							Depth
							<select
								aria-label="Zoom depth"
								value={selectedZoom.depth}
								className="rounded border border-foreground/10 bg-editor-surface px-2 py-1"
								onChange={(event) =>
									updateZoom(selectedZoom.id, {
										depth: Number(event.target.value) as ZoomRegion["depth"],
									})
								}
							>
								{ZOOM_DEPTH_OPTIONS.map(({ depth, label }) => (
									<option key={depth} value={depth}>
										{label}
									</option>
								))}
							</select>
						</label>
						<select
							aria-label="Zoom mode"
							value={selectedZoom.mode}
							className="rounded border border-foreground/10 bg-editor-surface px-2 py-1"
							onChange={(event) =>
								updateZoom(selectedZoom.id, {
									mode: event.target.value as ZoomRegion["mode"],
								})
							}
						>
							<option value="auto">Auto focus</option>
							<option value="manual">Manual focus</option>
						</select>
						{selectedZoom.mode === "manual" &&
							(["cx", "cy"] as const).map((axis) => (
								<label key={axis} className="flex items-center gap-2">
									Focus {axis === "cx" ? "X" : "Y"}
									<input
										type="number"
										aria-label={`Zoom focus ${axis === "cx" ? "X" : "Y"}`}
										min={0}
										max={1}
										step={0.01}
										value={selectedZoom.focus[axis]}
										className="w-16 rounded border border-foreground/10 bg-editor-surface px-2 py-1"
										onChange={(event) => {
											const value = Number(event.target.value);
											if (Number.isFinite(value) && value >= 0 && value <= 1)
												updateZoom(selectedZoom.id, {
													focus: { ...selectedZoom.focus, [axis]: value },
												});
										}}
									/>
								</label>
							))}
					</div>
				)}
				<RecordingTimeline
					ref={timeline}
					showClipRow={false}
					showSourceAudioTrack
					videoDuration={durationMs / 1000}
					currentTime={sourceSeconds}
					onSeek={setSourceSeconds}
					videoPath={sourceUrl}
					videoSourcePath={pkg.screen.path}
					microphoneAudioPath={settings.microphoneAudioPath}
					microphoneAudioOffsetMs={(pkg.microphone?.offsetUs ?? 0) / 1000}
					microphoneAudioDurationMs={
						pkg.microphone?.durationUs === undefined
							? undefined
							: pkg.microphone.durationUs / 1000
					}
					systemAudioPath={settings.systemAudioPath}
					systemAudioOffsetMs={(pkg.system?.offsetUs ?? 0) / 1000}
					systemAudioDurationMs={
						pkg.system?.durationUs === undefined
							? undefined
							: pkg.system.durationUs / 1000
					}
					webcamPath={pkg.webcam?.path}
					webcamEnabled={settings.webcam.enabled}
					cursorTelemetry={settings.cursorTelemetry ?? []}
					zoomRegions={settings.zoomRegions}
					selectedZoomId={selectedZoomId}
					onSelectZoom={setSelectedZoomId}
					onZoomAdded={(span) => {
						const id = crypto.randomUUID();
						update({
							zoomRegions: [
								...settings.zoomRegions,
								{
									id,
									startMs: span.start,
									endMs: span.end,
									depth: 2,
									focus: { cx: 0.5, cy: 0.5 },
									mode: "manual",
								},
							],
						});
						setSelectedZoomId(id);
					}}
					onZoomSuggested={(span, focus) =>
						update({
							zoomRegions: [
								...settings.zoomRegions,
								{
									id: crypto.randomUUID(),
									startMs: span.start,
									endMs: span.end,
									depth: 2,
									focus,
									mode: "auto",
								},
							],
						})
					}
					onZoomSpanChange={(id, span) =>
						updateZoom(id, { startMs: span.start, endMs: span.end })
					}
					onZoomDelete={(id) =>
						update({ zoomRegions: settings.zoomRegions.filter((z) => z.id !== id) })
					}
					trimRegions={settings.trimRegions}
					onTrimDelete={(id) =>
						update({
							trimRegions: settings.trimRegions.filter((trim) => trim.id !== id),
						})
					}
					onTrimSpanChange={(id, span) =>
						update({
							trimRegions: settings.trimRegions.map((t) =>
								t.id === id ? { ...t, startMs: span.start, endMs: span.end } : t,
							),
						})
					}
					speedRegions={settings.speedRegions}
					onSpeedSpanChange={(id, span) =>
						update({
							speedRegions: settings.speedRegions.map((t) =>
								t.id === id ? { ...t, startMs: span.start, endMs: span.end } : t,
							),
						})
					}
					layoutRegions={settings.layoutRegions}
					selectedLayoutId={selectedLayoutId}
					onSelectLayout={(id) => {
						setSelectedLayoutId(id);
						if (id) {
							setSelectedAnnotationId(null);
							setSection("layout");
						}
					}}
					onLayoutAdded={(span) => {
						const id = crypto.randomUUID();
						update({
							layoutRegions: [
								...settings.layoutRegions,
								{
									id,
									startMs: span.start,
									endMs: span.end,
									preset: "screen-only",
									transitionMs: 300,
									easing: "smooth",
								},
							],
						});
						setSelectedLayoutId(id);
						setSelectedAnnotationId(null);
						setSection("layout");
					}}
					onLayoutSpanChange={(id, span) =>
						updateLayout(id, { startMs: span.start, endMs: span.end })
					}
					onLayoutDelete={(id) =>
						update({ layoutRegions: settings.layoutRegions.filter((l) => l.id !== id) })
					}
					annotationRegions={timelineAnnotations}
					selectedAnnotationId={selectedAnnotationId}
					onSelectAnnotation={setSelectedAnnotationId}
					onAnnotationAdded={(span, track) => {
						const type = pendingOverlayType.current ?? "text";
						pendingOverlayType.current = null;
						addAnnotation(span.start, span.end, track, type);
					}}
					onAnnotationSpanChange={(id, span, trackIndex) =>
						updateAnnotation(id, { startMs: span.start, endMs: span.end, trackIndex })
					}
					onAnnotationKeyframesChange={(id, keyframes) =>
						updateAnnotation(id, { keyframes })
					}
					onAnnotationDelete={(id) =>
						update({
							annotationRegions: settings.annotationRegions.filter(
								(a) => a.id !== id,
							),
						})
					}
				/>
			</div>
			<footer className="recording-editor-footer">
				<span>{clipName}</span>
				<span>{(durationMs / 1000).toFixed(2)}s duration</span>
				<span>{settings.zoomRegions.length} zoom regions</span>
				<span>{settings.annotationRegions.length} overlays</span>
			</footer>
		</section>
	);
}
