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
import { SettingsPanel } from "@/components/video-editor/SettingsPanel";
import { ZOOM_DEPTH_OPTIONS } from "@/components/video-editor/settings/sections/ZoomItemSection";
import { buildInteractionZoomSuggestions } from "@/components/video-editor/timeline/zoomSuggestionUtils";

function formatTimecode(seconds: number): string {
	const totalSecs = Math.max(0, seconds);
	const mins = Math.floor(totalSecs / 60);
	const secs = Math.floor(totalSecs % 60);
	const centis = Math.floor((totalSecs % 1) * 100);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

import type {
	AnnotationRegion,
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

export interface RecordingCompositionEditorProps {
	package: RecordingPackage;
	composition: RecordComposition;
	projectTitle?: string;
	onChange: (next: RecordComposition) => void;
	onClose: () => void;
}
type PanelProps = ComponentProps<typeof SettingsPanel>;
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

type RecordingSection = Extract<EditorEffectSection, "scene" | "cursor" | "layout">;

const RECORDING_TABS: {
	id: RecordingSection;
	label: string;
	icon: typeof Palette;
}[] = [
	{ id: "scene", label: "Scene", icon: Palette },
	{ id: "cursor", label: "Cursor", icon: CursorClick },
	{ id: "layout", label: "Layout", icon: SquaresFour },
];

/** Controlled effect editor. Project library, recording, persistence and export live outside. */
export function RecordingCompositionEditor({
	package: pkg,
	composition,
	projectTitle,
	onChange,
	onClose,
}: RecordingCompositionEditorProps) {
	const settings = useMemo(() => resolveRecordingSettings(pkg, composition), [pkg, composition]);
	const [sourceUrl, setSourceUrl] = useState(""),
		[playing, setPlaying] = useState(false),
		[sourceSeconds, setSourceSeconds] = useState(0),
		[section, setSection] = useState<RecordingSection>("scene"),
		[selectedZoomId, setSelectedZoomId] = useState<string | null>(null),
		[selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null),
		[selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null),
		[error, setError] = useState<string | null>(null);
	const webcamPath = pkg.webcam?.path;
	const [webcamPreview, setWebcamPreview] = useState<{ path: string; url: string } | null>(null);
	const timeline = useRef<RecordingTimelineHandle>(null);
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
	const previewProject = useMemo(
		() => recordingPreviewProject(pkg, composition),
		[pkg, composition],
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
	const suggestZooms = () => {
		const suggestions = buildInteractionZoomSuggestions({
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
	const addAnnotation = (startMs: number, endMs: number, trackIndex = 0) => {
		const id = crypto.randomUUID();
		update({
			annotationRegions: [
				...settings.annotationRegions,
				{
					id,
					startMs,
					endMs,
					type: "text",
					content: "Text",
					position: { x: 50, y: 50 },
					size: { width: 40, height: 15 },
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
					zIndex: settings.annotationRegions.length + 1,
					trackIndex,
				},
			],
		});
		setSelectedAnnotationId(id);
	};
	const currentMs = Math.round(sourceSeconds * 1000),
		durationMs = pkg.durationUs / 1000;

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
				timeline.current?.addAnnotation();
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
					<span className="recording-badge-meta">16:9</span>
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
						<ProjectPreview
							project={previewProject}
							timeUs={outputUs}
							playing={playing}
							onError={setError}
						/>
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
						{selectedAnnotation && (
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
						<SettingsPanel
							{...settings}
							{...callbacks}
							selected={settings.wallpaper}
							onWallpaperChange={(path) => update({ wallpaper: path })}
							activeEffectSection={section}
							aspectRatio="16:9"
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
						<button
							type="button"
							className="recording-tb-btn"
							onClick={() => timeline.current?.addAnnotation()}
							title="Add text overlay (T)"
						>
							<Plus size={13} weight="bold" />
							<span>Text</span>
							<kbd className="recording-tb-kbd">T</kbd>
						</button>
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
							<kbd>T</kbd> Text · <kbd>Esc</kbd> Back
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
					annotationRegions={settings.annotationRegions}
					selectedAnnotationId={selectedAnnotationId}
					onSelectAnnotation={setSelectedAnnotationId}
					onAnnotationAdded={(span, track) => addAnnotation(span.start, span.end, track)}
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
				<span>{settings.annotationRegions.length} text overlays</span>
			</footer>
		</section>
	);
}
