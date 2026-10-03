import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { ArrowLeft, Play, Pause, Scissors, Sparkle, Plus } from "@phosphor-icons/react";
import { SettingsPanel } from "@/components/video-editor/SettingsPanel";
import { ProjectPreview } from "@/components/editor/ProjectPreview";
import { recordingPreviewProject, sourceToCompositionTime } from "../evaluation";
import { mapCompositionTime } from "@/core/timeline/timeMapping";
import { playbackOutputTimeUs } from "./playbackClock";
import type {
	AnnotationRegion,
	EditorEffectSection,
	LayoutRegion,
	PlaybackSpeed,
	ZoomRegion,
} from "@/components/video-editor/types";
import { buildInteractionZoomSuggestions } from "@/components/video-editor/timeline/zoomSuggestionUtils";
import { RecordingTimeline, type RecordingTimelineHandle } from "../components/RecordingTimeline";
import type { RecordComposition, RecordingPackage, RecordingSettings } from "../types";
import { localMediaUrl } from "../mediaProbe";
import { changeRecordingSettings, resolveRecordingSettings } from "./compositionAdapter";

export interface RecordingCompositionEditorProps {
	package: RecordingPackage;
	composition: RecordComposition;
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
	audioDuckingSettings: "onAudioDuckingSettingsChange",
};

/** Controlled effect editor. Project library, recording, persistence and export live outside. */
export function RecordingCompositionEditor({
	package: pkg,
	composition,
	onChange,
	onClose,
}: RecordingCompositionEditorProps) {
	const settings = useMemo(() => resolveRecordingSettings(pkg, composition), [pkg, composition]);
	const [sourceUrl, setSourceUrl] = useState(""),
		[playing, setPlaying] = useState(false),
		[sourceSeconds, setSourceSeconds] = useState(0),
		[section, setSection] = useState<EditorEffectSection>("scene"),
		[selectedZoomId, setSelectedZoomId] = useState<string | null>(null),
		[selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null),
		[selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null),
		[selectedAudioId, setSelectedAudioId] = useState<string | null>(null),
		[error, setError] = useState<string | null>(null);
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
	const previewProject = useMemo(
		() => recordingPreviewProject(pkg, composition),
		[pkg, composition],
	);
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
	const update = (patch: Partial<RecordingSettings>) => {
		try {
			onChange(changeRecordingSettings(pkg, composition, patch));
			setError(null);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		}
	};
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
		selectedLayout = settings.layoutRegions.find((l) => l.id === selectedLayoutId),
		selectedAudio = settings.audioRegions.find((a) => a.id === selectedAudioId);
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
				if (selectedZoomId || selectedAnnotationId || selectedLayoutId || selectedAudioId) {
					setSelectedZoomId(null);
					setSelectedAnnotationId(null);
					setSelectedLayoutId(null);
					setSelectedAudioId(null);
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
				} else if (selectedAudioId) {
					e.preventDefault();
					update({
						audioRegions: settings.audioRegions.filter((a) => a.id !== selectedAudioId),
					});
					setSelectedAudioId(null);
				}
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
		selectedAudioId,
		settings,
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
				<button onClick={onClose}>
					<ArrowLeft size={17} />
					Back to project
				</button>
				<span>Recording effects</span>
				<span className="project-muted">Edits apply to this clip</span>
			</header>
			{error && (
				<div role="alert" className="project-error">
					{error}
				</div>
			)}
			<div className="recording-editor-body">
				<aside className="recording-editor-settings">
					<nav className="recording-section-tabs">
						{(
							[
								"scene",
								"cursor",
								"webcam",
								"zoom",
								"layout",
								"motion",
								"audio-record",
							] as const
						).map((tab) => (
							<button
								key={tab}
								aria-pressed={section === tab}
								onClick={() => setSection(tab)}
							>
								{tab === "audio-record"
									? "Audio"
									: tab.charAt(0).toUpperCase() + tab.slice(1)}
							</button>
						))}
					</nav>
					{section === "motion" && (
						<label className="recording-motion-control">
							Zoom motion blur
							<input
								type="range"
								min={0}
								max={2}
								step={0.01}
								value={settings.zoomMotionBlur ?? 0.35}
								onChange={(event) =>
									update({ zoomMotionBlur: Number(event.target.value) })
								}
							/>
						</label>
					)}
					{selectedZoom && selectedZoom.mode === "manual" && (
						<div className="recording-motion-control">
							Manual zoom focus
							{(["cx", "cy"] as const).map((axis) => (
								<label key={axis}>
									{axis === "cx" ? "X" : "Y"}
									<input
										type="range"
										min={0}
										max={1}
										step={0.01}
										value={selectedZoom.focus[axis]}
										onChange={(event) =>
											updateZoom(selectedZoom.id, {
												focus: {
													...selectedZoom.focus,
													[axis]: Number(event.target.value),
												},
											})
										}
									/>
								</label>
							))}
						</div>
					)}
					{selectedAnnotation && (
						<div className="recording-motion-control">
							Layer position
							{(["x", "y"] as const).map((axis) => (
								<label key={axis}>
									{axis.toUpperCase()}
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
									{axis}
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
							update({ zoomRegions: settings.zoomRegions.filter((z) => z.id !== id) })
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
									cameraSettings: { ...selectedLayout?.cameraSettings, ...patch },
								});
						}}
						onLayoutTransitionChange={(transitionMs) => {
							if (selectedLayoutId) updateLayout(selectedLayoutId, { transitionMs });
						}}
						onLayoutEasingChange={(easing) => {
							if (selectedLayoutId) updateLayout(selectedLayoutId, { easing });
						}}
						onLayoutDelete={(id) =>
							update({
								layoutRegions: settings.layoutRegions.filter((l) => l.id !== id),
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
						selectedAudioId={selectedAudioId}
						selectedAudioVolume={selectedAudio?.volume}
						selectedAudioNormalize={selectedAudio?.normalize}
						selectedAudioDucking={selectedAudio?.ducking}
						onAudioVolumeChange={(volume) =>
							update({
								audioRegions: settings.audioRegions.map((a) =>
									a.id === selectedAudioId ? { ...a, volume } : a,
								),
							})
						}
						onAudioNormalizeChange={(normalize) =>
							update({
								audioRegions: settings.audioRegions.map((a) =>
									a.id === selectedAudioId ? { ...a, normalize } : a,
								),
							})
						}
						onAudioDuckingChange={(ducking) =>
							update({
								audioRegions: settings.audioRegions.map((a) =>
									a.id === selectedAudioId ? { ...a, ducking } : a,
								),
							})
						}
						onAudioAdded={(span, audioPath) =>
							update({
								audioRegions: [
									...settings.audioRegions,
									{
										id: crypto.randomUUID(),
										startMs: span.start,
										endMs: span.end,
										audioPath,
										volume: 1,
									},
								],
							})
						}
						onAudioDelete={(id) =>
							update({
								audioRegions: settings.audioRegions.filter((a) => a.id !== id),
							})
						}
						sourceAudioTrackMeta={[
							...(pkg.system ? [{ id: "system", label: "System audio" }] : []),
							...(pkg.microphone ? [{ id: "microphone", label: "Microphone" }] : []),
						]}
						sourceAudioTrackSettings={settings.sourceAudioSettings}
						onSourceAudioTrackVolumeChange={(id, volume) =>
							update({
								sourceAudioSettings: {
									...settings.sourceAudioSettings,
									[id]: {
										volume,
										normalize:
											settings.sourceAudioSettings?.[id]?.normalize ?? false,
									},
								},
							})
						}
						onSourceAudioTrackNormalizeChange={(id, normalize) =>
							update({
								sourceAudioSettings: {
									...settings.sourceAudioSettings,
									[id]: {
										volume: settings.sourceAudioSettings?.[id]?.volume ?? 1,
										normalize,
									},
								},
							})
						}
					/>
				</aside>
				<div className="recording-editor-monitor">
					<ProjectPreview
						project={previewProject}
						timeUs={outputUs}
						playing={playing}
						onError={setError}
					/>
					<div className="recording-editor-transport">
						<button
							aria-label={playing ? "Pause recording" : "Play recording"}
							onClick={() => setPlaying((v) => !v)}
						>
							{playing ? <Pause size={20} /> : <Play size={20} />}
						</button>
						<span>
							{sourceSeconds.toFixed(2)}s / {(durationMs / 1000).toFixed(2)}s
						</span>
						<button onClick={suggestZooms}>
							<Sparkle size={16} />
							Auto zoom
						</button>
						<button onClick={() => timeline.current?.addAnnotation()}>
							<Plus size={16} />
							Text
						</button>
						<button onClick={() => timeline.current?.addLayout()}>
							<Plus size={16} />
							Layout
						</button>
						<select
							aria-label="Add internal speed region"
							value=""
							onChange={(event) =>
								addSpeed(Number(event.target.value) as PlaybackSpeed)
							}
						>
							<option value="" disabled>
								Speed
							</option>
							<option value="0.5">0.5×</option>
							<option value="2">2×</option>
						</select>
						<button
							title="Remove a source range from the recording"
							onClick={() => {
								const startMs = Math.max(0, currentMs),
									endMs = Math.min(durationMs, startMs + 1000);
								if (endMs > startMs)
									update({
										trimRegions: [
											...settings.trimRegions,
											{ id: crypto.randomUUID(), startMs, endMs },
										],
									});
							}}
						>
							<Scissors size={16} />
							Cut 1s
						</button>
					</div>
				</div>
			</div>
			<RecordingTimeline
				ref={timeline}
				videoDuration={durationMs / 1000}
				currentTime={sourceSeconds}
				onSeek={setSourceSeconds}
				videoPath={sourceUrl}
				videoSourcePath={pkg.screen.path}
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
				onSelectLayout={setSelectedLayoutId}
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
				onAnnotationKeyframesChange={(id, keyframes) => updateAnnotation(id, { keyframes })}
				onAnnotationDelete={(id) =>
					update({
						annotationRegions: settings.annotationRegions.filter((a) => a.id !== id),
					})
				}
				audioRegions={settings.audioRegions}
				selectedAudioId={selectedAudioId}
				onSelectAudio={setSelectedAudioId}
				onAudioAdded={(span, audioPath, trackIndex) =>
					update({
						audioRegions: [
							...settings.audioRegions,
							{
								id: crypto.randomUUID(),
								startMs: span.start,
								endMs: span.end,
								audioPath,
								volume: 1,
								trackIndex,
							},
						],
					})
				}
				onAudioSpanChange={(id, span, trackIndex) =>
					update({
						audioRegions: settings.audioRegions.map((a) =>
							a.id === id
								? { ...a, startMs: span.start, endMs: span.end, trackIndex }
								: a,
						),
					})
				}
				onAudioDelete={(id) =>
					update({ audioRegions: settings.audioRegions.filter((a) => a.id !== id) })
				}
			/>
		</section>
	);
}
