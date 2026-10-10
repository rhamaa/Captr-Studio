import {
	CaretLeft,
	CaretRight,
	CornersOut,
	GridFour,
	MagnifyingGlassMinus,
	MagnifyingGlassPlus,
	Pause,
	Play,
	Repeat,
	SkipBack,
	SkipForward,
	SquaresFour,
	Terminal as TerminalIcon,
	X,
} from "@phosphor-icons/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AgentDiffSummary } from "@/core/timeline/agentPayload";
import {
	placeAsset,
	removeAsset,
	updateClip,
	updateProjectCanvas,
	updateProjectTerminalConfig,
} from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";
import {
	clipDurationUs,
	projectDurationUs,
	type ShapeDefinition,
	type TimelineProject,
} from "@/core/timeline/types";
import type { AssetTranscript } from "@/core/timeline/transcriptTypes";
import { ProjectTerminal } from "../terminal/ProjectTerminal";
import { AssetLibrary } from "./AssetLibrary";
import { AssetSourcePreview } from "./AssetSourcePreview";
import { CopilotSidebar, type EditPlan } from "./CopilotSidebar";
import { ProjectInspector } from "./ProjectInspector";
import { ProjectPreview } from "./ProjectPreview";
import { ProjectTimeline, shapePlacementCommand } from "./ProjectTimeline";
import { ProjectToolRail } from "./ProjectToolRail";
import { ProjectWelcome } from "./ProjectWelcome";
import { timelineActionCommand } from "./timelineInteractions";
import type { ProjectController } from "./useProjectController";
import { useProjectMessages } from "./useProjectMessages";

export interface StoryEditorProps {
	storyProject: TimelineProject;
	rootProject: TimelineProject;
	storyId: string | null;
	storyName?: string;
	controller: ProjectController;
	transcripts: Record<string, AssetTranscript>;
	copilotOpen: boolean;
	onCloseCopilot: () => void;
	speculativeDraft: {
		project: TimelineProject;
		diff: AgentDiffSummary;
	} | null;
	editPlan: EditPlan | null;
	onApplyDraft: (project: TimelineProject) => void;
	onDiscardDraft: () => void;
	onDraftReady: (draft: { project: TimelineProject; diff: AgentDiffSummary }) => void;
	onBackToBoard?: () => void;
	onImportMedia?: (paths?: string[]) => void;
	onStartRecord?: () => void;
	onOpenAudioRecorder?: () => void;
	onOpenRecording?: (clipId: string) => void;
	playing: boolean;
	setPlaying: (playing: boolean | ((v: boolean) => boolean)) => void;
	editingClipId: string | null;
	setEditingClipId: (clipId: string | null) => void;
	onCommand: (command: ProjectCommand, selection?: string[]) => void;
	onError: (error: string | null) => void;
	busy?: boolean;
	previewStageRef?: React.RefObject<HTMLDivElement>;
	scale?: number;
	onScaleChange?: (scale: number | ((s: number) => number)) => void;
	snappingEnabled?: boolean;
	onToggleSnapping?: () => void;
}

export function formatTimecode(timeUs: number, fps = 30): string {
	const totalSecs = Math.max(0, timeUs / 1_000_000);
	const mins = Math.floor(totalSecs / 60);
	const secs = Math.floor(totalSecs % 60);
	const frames = Math.floor((totalSecs % 1) * (fps || 30));
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}

export function StoryEditor({
	storyProject,
	rootProject,
	storyId,
	storyName,
	controller,
	transcripts,
	copilotOpen,
	onCloseCopilot,
	speculativeDraft,
	editPlan,
	onApplyDraft,
	onDiscardDraft,
	onDraftReady,
	onBackToBoard,
	onImportMedia,
	onStartRecord,
	onOpenAudioRecorder,
	onOpenRecording,
	playing,
	setPlaying,
	editingClipId,
	setEditingClipId,
	onCommand,
	onError,
	busy,
	previewStageRef,
	scale: externalScale,
	onScaleChange: externalOnScaleChange,
	snappingEnabled: externalSnappingEnabled,
	onToggleSnapping: externalOnToggleSnapping,
}: StoryEditorProps) {
	const m = useProjectMessages();
	const internalPreviewStage = useRef<HTMLDivElement>(null);
	const previewStage = previewStageRef ?? internalPreviewStage;

	const selection = controller.snapshot.selection;
	const playheadUs = controller.snapshot.playheadUs;
	const selectedAssetId = controller.snapshot.selectedAssetId;
	const openingKey = controller.snapshot.openingKey;
	const durationUs = projectDurationUs(storyProject);

	const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
	const [terminalOpen, setTerminalOpen] = useState(false);
	const [loopPlayback, setLoopPlayback] = useState(false);
	const [showGridGuide, setShowGridGuide] = useState(false);
	const [fullscreenPreview, setFullscreenPreview] = useState(false);

	const ZOOM_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0] as const;
	const [previewZoom, setPreviewZoom] = useState<"fit" | number>("fit");
	const [previewPan, setPreviewPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
	const [isPanning, setIsPanning] = useState(false);
	const panDragRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number } | null>(null);

	const handleStageWheel = (e: React.WheelEvent<HTMLDivElement>) => {
		if (e.ctrlKey || e.metaKey) {
			e.preventDefault();
			const delta = e.deltaY < 0 ? 0.1 : -0.1;
			setPreviewZoom((current) => {
				const cur = current === "fit" ? 1.0 : current;
				const next = Math.max(0.25, Math.min(4.0, Math.round((cur + delta) * 10) / 10));
				return next;
			});
		}
	};

	const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.button === 1 || (e.button === 0 && e.shiftKey && previewZoom !== "fit")) {
			e.preventDefault();
			panDragRef.current = {
				startX: e.clientX,
				startY: e.clientY,
				initialPanX: previewPan.x,
				initialPanY: previewPan.y,
			};
			setIsPanning(true);

			const onPointerMove = (ev: PointerEvent) => {
				if (!panDragRef.current) return;
				const dx = ev.clientX - panDragRef.current.startX;
				const dy = ev.clientY - panDragRef.current.startY;
				setPreviewPan({
					x: panDragRef.current.initialPanX + dx,
					y: panDragRef.current.initialPanY + dy,
				});
			};

			const onPointerUp = () => {
				window.removeEventListener("pointermove", onPointerMove);
				window.removeEventListener("pointerup", onPointerUp);
				panDragRef.current = null;
				setIsPanning(false);
			};

			window.addEventListener("pointermove", onPointerMove);
			window.addEventListener("pointerup", onPointerUp);
		}
	};

	const handleDropAssetOnCanvas = (assetId: string, canvasX: number, canvasY: number) => {
		try {
			const asset = rootProject.assets.find((a) => a.id === assetId);
			if (!asset) return;

			const visualTracks = storyProject.tracks.filter((t) => t.kind === "visual");
			const track = visualTracks.find((t) => !t.locked) ?? visualTracks[0];
			if (!track) return;

			const clipId = crypto.randomUUID();
			const transformX = Math.round(canvasX - storyProject.canvas.width / 2);
			const transformY = Math.round(canvasY - storyProject.canvas.height / 2);

			onCommand(
				(p: TimelineProject) =>
					placeAsset(p, assetId, track.id, playheadUs, {
						clipId,
						compositionId: crypto.randomUUID(),
						transform: { x: transformX, y: transformY },
					}),
				[clipId],
			);
			controller.select([clipId]);
		} catch (e) {
			onError(e instanceof Error ? e.message : String(e));
		}
	};

	useEffect(() => {
		if (playing && loopPlayback && durationUs > 0 && playheadUs >= durationUs) {
			controller.seek(0, durationUs);
		}
	}, [playing, loopPlayback, durationUs, playheadUs, controller]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.target as HTMLElement).matches("input,textarea,select,[contenteditable=true]")) {
				return;
			}
			if ((e.ctrlKey || e.metaKey) && e.key === "`") {
				e.preventDefault();
				setTerminalOpen((prev) => !prev);
				return;
			}
			if (e.key === " " && !e.ctrlKey && !e.metaKey && !e.altKey) {
				e.preventDefault();
				if (!durationUs) return;
				controller.preview(null);
				if (playheadUs >= durationUs) {
					controller.seek(0, durationUs);
				}
				setPlaying((v) => !v);
				return;
			}
			if (e.key === "ArrowLeft") {
				e.preventDefault();
				controller.preview(null);
				const stepUs = e.shiftKey
					? 1_000_000
					: Math.round(1_000_000 / (storyProject.canvas.fps || 30));
				controller.seek(Math.max(0, playheadUs - stepUs), durationUs);
				return;
			}
			if (e.key === "ArrowRight") {
				e.preventDefault();
				controller.preview(null);
				const stepUs = e.shiftKey
					? 1_000_000
					: Math.round(1_000_000 / (storyProject.canvas.fps || 30));
				controller.seek(Math.min(durationUs, playheadUs + stepUs), durationUs);
				return;
			}
			if (e.key === "Home") {
				e.preventDefault();
				controller.preview(null);
				controller.seek(0, durationUs);
				return;
			}
			if (e.key === "End") {
				e.preventDefault();
				controller.preview(null);
				controller.seek(durationUs, durationUs);
				return;
			}
			if (
				!e.ctrlKey &&
				!e.metaKey &&
				(e.key.toLowerCase() === "s" || e.key.toLowerCase() === "c")
			) {
				e.preventDefault();
				onCommand(timelineActionCommand("split", selection, playheadUs));
				return;
			}
			if (e.key.toLowerCase() === "d" && (e.ctrlKey || e.metaKey)) {
				e.preventDefault();
				if (selection.length > 0) {
					onCommand(timelineActionCommand("duplicate", selection, playheadUs));
				}
				return;
			}
			if (e.key === "Delete" || e.key === "Backspace") {
				if (selection.length > 0) {
					e.preventDefault();
					if (e.shiftKey) {
						onCommand(timelineActionCommand("ripple-delete", selection, playheadUs));
					} else {
						onCommand(timelineActionCommand("delete", selection, playheadUs));
					}
					controller.select([]);
				}
				return;
			}
			if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey) {
				e.preventDefault();
				setFullscreenPreview((v) => !v);
				return;
			}
			if (e.key.toLowerCase() === "l" && !e.ctrlKey && !e.metaKey) {
				e.preventDefault();
				setLoopPlayback((v) => !v);
				return;
			}
			if (e.key === "Escape" && fullscreenPreview) {
				e.preventDefault();
				setFullscreenPreview(false);
				return;
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [
		durationUs,
		playheadUs,
		playing,
		selection,
		storyProject.canvas.fps,
		fullscreenPreview,
		controller,
		onCommand,
		setPlaying,
	]);

	useEffect(() => {
		if (
			selectedTransitionId &&
			!storyProject.clipTransitions?.some((item) => item.id === selectedTransitionId)
		) {
			setSelectedTransitionId(null);
		}
	}, [selectedTransitionId, storyProject.clipTransitions]);

	const [internalScale, setInternalScale] = useState(65);
	const scale = externalScale ?? internalScale;
	const setScale = externalOnScaleChange ?? setInternalScale;

	const [internalSnappingEnabled, setInternalSnappingEnabled] = useState(true);
	const snappingEnabled = externalSnappingEnabled ?? internalSnappingEnabled;
	const toggleSnapping = externalOnToggleSnapping ?? (() => setInternalSnappingEnabled((v) => !v));

	const sourceAsset = useMemo(() => {
		if (!selectedAssetId) return null;
		return rootProject.assets.find((a) => a.id === selectedAssetId) ?? null;
	}, [rootProject.assets, selectedAssetId]);

	const sourcePath = useMemo(() => {
		if (!sourceAsset) return null;
		return (
			sourceAsset.source?.path ??
			rootProject.packages.find((p) => p.id === sourceAsset.packageId)?.screen.path ??
			null
		);
	}, [rootProject.packages, sourceAsset]);

	const addShape = (kind: ShapeDefinition["kind"]) => {
		const ids = {
			assetId: crypto.randomUUID(),
			clipId: crypto.randomUUID(),
			trackId: crypto.randomUUID(),
		};
		onCommand(shapePlacementCommand(kind, playheadUs, ids), [ids.clipId]);
	};

	const addToTimeline = (assetId: string) => {
		const asset = rootProject.assets.find((a) => a.id === assetId);
		if (!asset) return;
		const track = storyProject.tracks.find(
			(t) => !t.locked && t.kind === (asset.kind === "audio" ? "audio" : "visual"),
		);
		if (!track) {
			onError("Add an unlocked compatible track first");
			return;
		}
		const startUs = Math.max(
			playheadUs,
			...track.clips.map((c) => c.startUs + clipDurationUs(c)),
		);
		const clipId = crypto.randomUUID();
		try {
			onCommand(
				(p: TimelineProject) =>
					placeAsset(p, assetId, track.id, startUs, {
						clipId,
						compositionId: crypto.randomUUID(),
					}),
				[clipId],
			);
		} catch (e) {
			onError(e instanceof Error ? e.message : String(e));
		}
	};

	return (
		<>
			<div className={`project-workspace ${copilotOpen ? "with-copilot" : ""}`}>
				<ProjectToolRail onAddShape={addShape} />
				<AssetLibrary
					assets={rootProject.assets}
					packages={rootProject.packages}
					selectedAssetId={selectedAssetId}
					onImport={(paths) => onImportMedia?.(paths)}
					onRecord={() => onStartRecord?.()}
					onRecordAudio={() => onOpenAudioRecorder?.()}
					onPreview={(id) => {
						setPlaying(false);
						controller.preview(id);
					}}
					onPlace={addToTimeline}
					onRemove={(id) => onCommand((p: TimelineProject) => removeAsset(p, id))}
				/>
				<section className="project-preview-panel">
					<header className="project-panel-header">
						<h2>
							{sourceAsset
								? m("sourcePreview")
								: storyName
									? `${storyName} (${m("preview")})`
									: m("preview")}
						</h2>
						<div className="flex items-center gap-2">
							<select
								aria-label="Canvas Aspect Ratio"
								value={
									[
										{ w: 1920, h: 1080, id: "16:9" },
										{ w: 1080, h: 1920, id: "9:16" },
										{ w: 1080, h: 1080, id: "1:1" },
										{ w: 1080, h: 1350, id: "4:5" },
										{ w: 2560, h: 1080, id: "21:9" },
									].find(
										(p) =>
											p.w === storyProject.canvas.width &&
											p.h === storyProject.canvas.height,
									)?.id ?? "custom"
								}
								onChange={(e) => {
									const map: Record<string, [number, number]> = {
										"16:9": [1920, 1080],
										"9:16": [1080, 1920],
										"1:1": [1080, 1080],
										"4:5": [1080, 1350],
										"21:9": [2560, 1080],
									};
									const val = map[e.target.value];
									if (val) {
										onCommand((p) =>
											updateProjectCanvas(p, { width: val[0], height: val[1] }),
										);
									}
								}}
								className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/90 font-medium focus:outline-none cursor-pointer"
							>
								<option value="16:9" className="bg-[#12141a]">16:9 Landscape</option>
								<option value="9:16" className="bg-[#12141a]">9:16 Shorts/Reels</option>
								<option value="1:1" className="bg-[#12141a]">1:1 Square</option>
								<option value="4:5" className="bg-[#12141a]">4:5 Portrait</option>
								<option value="21:9" className="bg-[#12141a]">21:9 Ultrawide</option>
								<option value="custom" className="bg-[#12141a]">Custom</option>
							</select>
							<div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px]">
								<button
									type="button"
									title="Zoom Out"
									aria-label="Zoom Out"
									className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
									onClick={() => {
										setPreviewZoom((current) => {
											const cur = current === "fit" ? 1.0 : current;
											const lower = [...ZOOM_PRESETS].reverse().find((p) => p < cur);
											return lower ?? ZOOM_PRESETS[0];
										});
									}}
								>
									<MagnifyingGlassMinus size={12} />
								</button>
								<select
									aria-label="Preview Zoom"
									value={typeof previewZoom === "number" ? String(previewZoom) : "fit"}
									onChange={(e) => {
										const val = e.target.value;
										if (val === "fit") {
											setPreviewZoom("fit");
											setPreviewPan({ x: 0, y: 0 });
										} else {
											setPreviewZoom(Number(val));
										}
									}}
									className="bg-transparent text-white/90 font-medium focus:outline-none cursor-pointer text-[10px]"
								>
									<option value="fit" className="bg-[#12141a]">Fit</option>
									<option value="0.25" className="bg-[#12141a]">25%</option>
									<option value="0.5" className="bg-[#12141a]">50%</option>
									<option value="0.75" className="bg-[#12141a]">75%</option>
									<option value="1" className="bg-[#12141a]">100%</option>
									<option value="1.25" className="bg-[#12141a]">125%</option>
									<option value="1.5" className="bg-[#12141a]">150%</option>
									<option value="2" className="bg-[#12141a]">200%</option>
									<option value="3" className="bg-[#12141a]">300%</option>
								</select>
								<button
									type="button"
									title="Zoom In"
									aria-label="Zoom In"
									className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
									onClick={() => {
										setPreviewZoom((current) => {
											const cur = current === "fit" ? 1.0 : current;
											const higher = ZOOM_PRESETS.find((p) => p > cur);
											return higher ?? ZOOM_PRESETS[ZOOM_PRESETS.length - 1];
										});
									}}
								>
									<MagnifyingGlassPlus size={12} />
								</button>
								{previewZoom !== "fit" && (
									<button
										type="button"
										title="Reset Zoom to Fit"
										aria-label="Reset Zoom to Fit"
										className="text-primary hover:underline ml-1 font-semibold"
										onClick={() => {
											setPreviewZoom("fit");
											setPreviewPan({ x: 0, y: 0 });
										}}
									>
										Reset
									</button>
								)}
							</div>
							<span>
								{storyProject.canvas.width} × {storyProject.canvas.height}
							</span>
						</div>
						{!sourceAsset && onBackToBoard && storyId && (
							<button
								type="button"
								className="project-stage-repurpose-btn"
								title="Return to Multi-Artboard Whiteboard"
								onClick={onBackToBoard}
							>
								<SquaresFour size={14} weight="bold" />
								All Stories
							</button>
						)}
						{sourceAsset && (
							<button onClick={() => controller.preview(null)}>
								{m("backTimeline")}
							</button>
						)}
					</header>
					<div
						className={`project-preview-stage ${isPanning ? "panning" : previewZoom !== "fit" ? "zoomed" : ""}`}
						ref={previewStage}
						onWheel={handleStageWheel}
						onPointerDown={handleStagePointerDown}
					>
						<div
							className="project-preview-zoom-wrapper"
							style={{
								transform:
									previewZoom === "fit"
										? "none"
										: `translate3d(${previewPan.x}px, ${previewPan.y}px, 0) scale(${previewZoom})`,
								transformOrigin: "center center",
								aspectRatio: `${storyProject.canvas.width} / ${storyProject.canvas.height}`,
								maxHeight: previewZoom === "fit" ? "100%" : undefined,
								maxWidth: previewZoom === "fit" ? "100%" : undefined,
								width: previewZoom === "fit" ? "100%" : `${storyProject.canvas.width}px`,
								height: previewZoom === "fit" ? "100%" : `${storyProject.canvas.height}px`,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								position: "relative",
							}}
						>
							{sourceAsset ? (
								<AssetSourcePreview
									key={sourceAsset.id}
									asset={sourceAsset}
									path={sourcePath ?? ""}
									onError={onError}
								/>
							) : durationUs > 0 ? (
								<ProjectPreview
									key={`${openingKey}-${storyId ?? "root"}`}
									project={storyProject}
									timeUs={Math.min(playheadUs, Math.max(0, durationUs - 1))}
									playing={playing && !editingClipId}
									onError={onError}
									selectedClipId={selection[0] ?? null}
									onSelectClip={(clipId) => {
										const currentSelected = selection[0] ?? "";
										if (currentSelected !== (clipId ?? "")) {
											controller.select(clipId ? [clipId] : []);
										}
									}}
									onUpdateClipTransform={(clipId, transform) => {
										onCommand((p: TimelineProject) => updateClip(p, clipId, { transform }));
									}}
									onDropAsset={handleDropAssetOnCanvas}
								/>
							) : (
								<ProjectWelcome
									hasAssets={Boolean(rootProject.assets.length)}
									onImport={() => onImportMedia?.()}
									onRecord={() => onStartRecord?.()}
								/>
							)}
							{showGridGuide && (
								<div className="project-grid-guide-overlay pointer-events-none">
									<div className="project-grid-guide-cell" />
									<div className="project-grid-guide-cell" />
									<div className="project-grid-guide-cell" />
									<div className="project-grid-guide-cell" />
									<div className="project-grid-guide-cell" />
									<div className="project-grid-guide-cell" />
									<div className="project-grid-guide-cell" />
									<div className="project-grid-guide-cell" />
									<div className="project-grid-guide-cell" />
									<div className="project-safe-zone-overlay">
										<span className="project-safe-zone-label">Safe Zone</span>
									</div>
								</div>
							)}
						</div>
					</div>
					<div className="project-preview-transport">
						<div className="project-transport-timecode">
							<span className="text-white/95 font-semibold">
								{formatTimecode(playheadUs, storyProject.canvas.fps)}
							</span>
							<span className="text-white/40">/</span>
							<span className="text-white/50">
								{formatTimecode(durationUs, storyProject.canvas.fps)}
							</span>
						</div>
						<div className="project-transport-controls">
							<button
								type="button"
								className="project-transport-btn"
								title="Jump to Start (Home)"
								disabled={!durationUs}
								onClick={() => {
									controller.preview(null);
									controller.seek(0, durationUs);
								}}
							>
								<SkipBack size={14} weight="fill" />
							</button>
							<button
								type="button"
								className="project-transport-btn"
								title="Step Back 1 Frame (Left Arrow)"
								disabled={!durationUs}
								onClick={() => {
									controller.preview(null);
									const frameUs = Math.round(1_000_000 / (storyProject.canvas.fps || 30));
									controller.seek(Math.max(0, playheadUs - frameUs), durationUs);
								}}
							>
								<CaretLeft size={15} weight="bold" />
							</button>
							<button
								type="button"
								className="project-transport-play-btn"
								aria-label={playing ? "Pause timeline" : "Play timeline"}
								title={playing ? "Pause timeline (Space)" : "Play timeline (Space)"}
								disabled={!durationUs}
								onClick={() => {
									controller.preview(null);
									if (playheadUs >= durationUs) {
										controller.seek(0, durationUs);
									}
									setPlaying((v) => !v);
								}}
							>
								{playing ? (
									<Pause size={18} weight="fill" />
								) : (
									<Play size={18} weight="fill" className="ml-0.5" />
								)}
							</button>
							<button
								type="button"
								className="project-transport-btn"
								title="Step Forward 1 Frame (Right Arrow)"
								disabled={!durationUs}
								onClick={() => {
									controller.preview(null);
									const frameUs = Math.round(1_000_000 / (storyProject.canvas.fps || 30));
									controller.seek(Math.min(durationUs, playheadUs + frameUs), durationUs);
								}}
							>
								<CaretRight size={15} weight="bold" />
							</button>
							<button
								type="button"
								className="project-transport-btn"
								title="Jump to End (End)"
								disabled={!durationUs}
								onClick={() => {
									controller.preview(null);
									controller.seek(durationUs, durationUs);
								}}
							>
								<SkipForward size={14} weight="fill" />
							</button>
						</div>
						<div className="project-transport-extras">
							<button
								type="button"
								className={`project-transport-extra-btn ${loopPlayback ? "active" : ""}`}
								title={loopPlayback ? "Loop Playback: ON (L)" : "Loop Playback: OFF (L)"}
								onClick={() => setLoopPlayback((v) => !v)}
							>
								<Repeat size={14} weight={loopPlayback ? "bold" : "regular"} />
							</button>
							<button
								type="button"
								className={`project-transport-extra-btn ${showGridGuide ? "active" : ""}`}
								title={showGridGuide ? "Grid & Safe Zones: ON" : "Grid & Safe Zones: OFF"}
								onClick={() => setShowGridGuide((v) => !v)}
							>
								<GridFour size={14} weight={showGridGuide ? "fill" : "regular"} />
							</button>
							<button
								type="button"
								className={`project-transport-extra-btn ${fullscreenPreview ? "active" : ""}`}
								title="Fullscreen Preview (F)"
								onClick={() => setFullscreenPreview((v) => !v)}
							>
								<CornersOut size={14} weight="bold" />
							</button>
						</div>
					</div>
				</section>
				<ProjectInspector
					project={storyProject}
					selection={selection}
					selectedTransitionId={selectedTransitionId}
					playheadUs={playheadUs}
					onCommand={onCommand}
					onOpenRecording={setEditingClipId}
				/>
				{copilotOpen && (
					<CopilotSidebar
						project={storyProject}
						transcripts={transcripts}
						playheadUs={playheadUs}
						selection={selection}
						activeArtboardId={storyId}
						speculativeDraft={speculativeDraft}
						editPlan={editPlan}
						onClose={onCloseCopilot}
						onApplyDraft={onApplyDraft}
						onDiscardDraft={onDiscardDraft}
						onDraftReady={onDraftReady}
						onSeekTo={(timeUs) => controller.seek(timeUs, durationUs)}
					/>
				)}
			</div>
			<ProjectTimeline
				project={storyProject}
				selection={selection}
				selectedTransitionId={selectedTransitionId}
				playheadUs={playheadUs}
				onCommand={onCommand}
				onSelect={(ids) => {
					setSelectedTransitionId(null);
					controller.select(ids);
				}}
				onSelectTransition={(id) => {
					controller.select([]);
					setSelectedTransitionId(id);
				}}
				onSeek={(time) => {
					setPlaying(false);
					controller.preview(null);
					controller.seek(time, durationUs);
				}}
				onOpenRecording={(id) => {
					setPlaying(false);
					onOpenRecording?.(id);
				}}
				scale={scale}
				onScaleChange={setScale}
				playing={playing}
				snappingEnabled={snappingEnabled}
				onToggleSnapping={toggleSnapping}
				speculativeProject={speculativeDraft?.project ?? null}
				speculativeDiff={speculativeDraft?.diff ?? null}
				onAcceptSpeculative={() =>
					speculativeDraft && onApplyDraft(speculativeDraft.project)
				}
				onRejectSpeculative={onDiscardDraft}
			/>
			{terminalOpen && (
				<div className="border-t border-white/10 bg-[#090a0d] shadow-2xl relative z-40">
					<ProjectTerminal
						className="h-[300px] rounded-none border-x-0 border-b-0"
						terminalConfig={storyProject.terminalConfig}
						onUpdateTerminalConfig={(cfg) =>
							onCommand((p) => updateProjectTerminalConfig(p, cfg))
						}
						onClose={() => setTerminalOpen(false)}
					/>
				</div>
			)}
			<footer className="project-footer justify-between">
				<div className="flex items-center gap-4">
					<span>
						{busy ? "Importing media…" : `${rootProject.assets.length} assets`}
					</span>
					<span>{storyProject.canvas.fps} fps</span>
				</div>
				<button
					type="button"
					onClick={() => setTerminalOpen((v) => !v)}
					className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] transition-colors cursor-pointer ${
						terminalOpen
							? "bg-primary text-primary-foreground font-semibold"
							: "text-zinc-400 hover:text-white hover:bg-white/10"
					}`}
					title="Toggle Project Terminal (Ctrl + `)"
				>
					<TerminalIcon size={12} weight="bold" />
					<span>Terminal</span>
				</button>
			</footer>
			{fullscreenPreview && (
				<div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-4 animate-in fade-in duration-150">
					<div className="flex items-center justify-between pb-3 border-b border-white/10 text-white">
						<span className="font-semibold text-sm">
							{storyName || "Story Preview"} ({storyProject.canvas.width} × {storyProject.canvas.height})
						</span>
						<button
							type="button"
							onClick={() => setFullscreenPreview(false)}
							className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
							title="Exit Fullscreen (Esc / F)"
						>
							<X size={18} />
						</button>
					</div>
					<div className="flex-1 flex items-center justify-center p-4 min-h-0">
						<ProjectPreview
							key={`fullscreen-${openingKey}-${storyId ?? "root"}`}
							project={storyProject}
							timeUs={Math.min(playheadUs, Math.max(0, durationUs - 1))}
							playing={playing && !editingClipId}
							onError={onError}
						/>
					</div>
				</div>
			)}
		</>
	);
}
