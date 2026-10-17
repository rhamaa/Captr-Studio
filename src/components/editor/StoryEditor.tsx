import {
	CaretLeft,
	CaretRight,
	CornersOut,
	GridFour,
	Hand,
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
import { resolveMediaAsset } from "@/core/timeline/clipSource";
import {
	addTextOverlay,
	placeAsset,
	removeAsset,
	updateClip,
	updateProjectTerminalConfig,
} from "@/core/timeline/commands";
import { applyDesignTemplate } from "@/core/timeline/designTemplateCommands";
import type { ProjectCommand } from "@/core/timeline/history";
import { publishStoryMedia, removeStoryMedia } from "@/core/timeline/storyMediaCommands";
import type { StoryEditContext } from "@/core/timeline/storyOwnership";
import type { AssetTranscript } from "@/core/timeline/transcriptTypes";
import {
	clipDurationUs,
	projectDurationUs,
	type ShapeDefinition,
	type TimelineProject,
} from "@/core/timeline/types";
import { ProjectTerminal } from "../terminal/ProjectTerminal";
import { AssetLibrary } from "./AssetLibrary";
import { AssetSourcePreview } from "./AssetSourcePreview";
import { CopilotSidebar, type EditPlan } from "./CopilotSidebar";
import { ProjectInspector } from "./ProjectInspector";
import { ProjectPreview } from "./ProjectPreview";
import { ProjectTimeline, shapePlacementCommand } from "./ProjectTimeline";
import { ProjectToolRail } from "./ProjectToolRail";
import { StoryCaptionPanel } from "./StoryCaptionPanel";
import { StoryEditingToolbar } from "./StoryEditingToolbar";
import { ProjectWelcome } from "./ProjectWelcome";
import {
	fitPreviewCanvasToBounds,
	type PreviewCanvasBounds,
} from "./previewCanvasSizing";
import { timelineActionCommand } from "./timelineInteractions";
import type { ProjectController } from "./useProjectController";
import { useProjectMessages } from "./useProjectMessages";

const MIN_STORY_PREVIEW_ZOOM = 0.25;
const MAX_STORY_PREVIEW_ZOOM = 5;
const STORY_PREVIEW_ZOOM_STEP = 1.2;

interface StoryPreviewViewport {
	zoom: number;
	x: number;
	y: number;
}

interface StoryPreviewPanStart {
	pointerId: number;
	startX: number;
	startY: number;
	originX: number;
	originY: number;
}

function observePreviewFrameSize(
	stage: HTMLDivElement,
	canvas: PreviewCanvasBounds,
	onResize: (size: PreviewCanvasBounds) => void,
): () => void {
	const measure = (contentBounds?: PreviewCanvasBounds) => {
		const style = window.getComputedStyle(stage);
		const bounds = contentBounds ?? {
			width:
				stage.clientWidth -
				Number.parseFloat(style.paddingLeft || "0") -
				Number.parseFloat(style.paddingRight || "0"),
			height:
				stage.clientHeight -
				Number.parseFloat(style.paddingTop || "0") -
				Number.parseFloat(style.paddingBottom || "0"),
		};
		onResize(fitPreviewCanvasToBounds(bounds, canvas));
	};

	measure();
	if (typeof ResizeObserver !== "undefined") {
		const observer = new ResizeObserver(([entry]) => {
			if (entry) {
				measure({ width: entry.contentRect.width, height: entry.contentRect.height });
			}
		});
		observer.observe(stage);
		return () => observer.disconnect();
	}

	const handleWindowResize = () => measure();
	window.addEventListener("resize", handleWindowResize);
	return () => window.removeEventListener("resize", handleWindowResize);
}

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
		context: StoryEditContext;
	} | null;
	editPlan: EditPlan | null;
	onApplyDraft: (project: TimelineProject) => void;
	onDiscardDraft: () => void;
	onDraftReady: (draft: {
		project: TimelineProject;
		diff: AgentDiffSummary;
		context: StoryEditContext;
	}) => void;
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
	onProjectCommand?: (command: ProjectCommand) => void;
	editContext?: StoryEditContext;
	onError: (error: string | null) => void;
	busy?: boolean;
	previewStageRef?: React.RefObject<HTMLDivElement>;
	scale?: number;
	onScaleChange?: (scale: number | ((s: number) => number)) => void;
	snappingEnabled?: boolean;
	onToggleSnapping?: () => void;
}

/** Terminal settings belong to the project, including when opened from a Story. */
export function StoryProjectTerminal({
	rootProject,
	onProjectCommand,
	onClose,
}: {
	rootProject: TimelineProject;
	onProjectCommand: (command: ProjectCommand) => void;
	onClose: () => void;
}) {
	return (
		<ProjectTerminal
			className="h-[300px] rounded-none border-x-0 border-b-0"
			terminalConfig={rootProject.terminalConfig}
			onUpdateTerminalConfig={(config) =>
				onProjectCommand((p) => updateProjectTerminalConfig(p, config))
			}
			onClose={onClose}
		/>
	);
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
	onProjectCommand,
	editContext,
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
	const fullscreenPreviewStage = useRef<HTMLDivElement>(null);
	const previewStage = previewStageRef ?? internalPreviewStage;

	const selection = controller.snapshot.selection;
	const playheadUs = controller.snapshot.playheadUs;
	const selectedAssetId = controller.snapshot.selectedAssetId;
	const openingKey = controller.snapshot.openingKey;
	const durationUs = projectDurationUs(storyProject);
	const canvasAspectRatioLabel = useMemo(() => {
		let width = Math.round(storyProject.canvas.width);
		let height = Math.round(storyProject.canvas.height);
		let a = width;
		let b = height;
		while (b !== 0) [a, b] = [b, a % b];
		const divisor = Math.max(1, a);
		const ratio = `${width / divisor}:${height / divisor}`;
		const presets: Record<string, string> = {
			"16:9": "16:9 Landscape",
			"9:16": "9:16 Shorts/Reels",
			"1:1": "1:1 Square",
			"4:5": "4:5 Portrait",
			"4:3": "4:3 Standard",
			"16:10": "16:10 Widescreen",
			"10:16": "10:16 Portrait",
			"21:9": "21:9 Ultrawide",
		};
		return presets[ratio] ?? `${ratio} Custom`;
	}, [storyProject.canvas.height, storyProject.canvas.width]);

	const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
	const [terminalOpen, setTerminalOpen] = useState(false);
	const [captionsOpen, setCaptionsOpen] = useState(false);
	const [loopPlayback, setLoopPlayback] = useState(false);
	const [showGridGuide, setShowGridGuide] = useState(false);
	const [fullscreenPreview, setFullscreenPreview] = useState(false);
	const [previewFrameSize, setPreviewFrameSize] = useState<PreviewCanvasBounds>({
		width: 0,
		height: 0,
	});
	const [fullscreenFrameSize, setFullscreenFrameSize] = useState<PreviewCanvasBounds>({
		width: 0,
		height: 0,
	});
	const [previewViewport, setPreviewViewport] = useState<StoryPreviewViewport>({
		zoom: 1,
		x: 0,
		y: 0,
	});
	const [previewPanMode, setPreviewPanMode] = useState(false);
	const [previewPanning, setPreviewPanning] = useState(false);
	const previewPanStartRef = useRef<StoryPreviewPanStart | null>(null);
	const previewZoomed =
		Math.abs(previewViewport.zoom - 1) > 0.001 ||
		Math.abs(previewViewport.x) > 0.5 ||
		Math.abs(previewViewport.y) > 0.5;
	const previewTransformStyle: React.CSSProperties = {
		transform: `translate3d(${previewViewport.x}px, ${previewViewport.y}px, 0) scale(${previewViewport.zoom})`,
		transformOrigin: "center center",
		willChange: "transform",
		transition: previewPanning ? "none" : "transform 120ms ease-out",
	};
	const canvasWidth = storyProject.canvas.width;
	const canvasHeight = storyProject.canvas.height;

	useEffect(() => {
		const stage = previewStage.current;
		if (!stage) return;
		return observePreviewFrameSize(
			stage,
			{ width: canvasWidth, height: canvasHeight },
			(size) =>
				setPreviewFrameSize((current) =>
					current.width === size.width && current.height === size.height
						? current
						: size,
				),
		);
	}, [canvasHeight, canvasWidth, previewStage]);

	useEffect(() => {
		if (!fullscreenPreview) return;
		const stage = fullscreenPreviewStage.current;
		if (!stage) return;
		return observePreviewFrameSize(
			stage,
			{ width: canvasWidth, height: canvasHeight },
			(size) =>
				setFullscreenFrameSize((current) =>
					current.width === size.width && current.height === size.height
						? current
						: size,
				),
		);
	}, [canvasHeight, canvasWidth, fullscreenPreview]);

	useEffect(() => {
		setPreviewViewport({ zoom: 1, x: 0, y: 0 });
		setPreviewPanMode(false);
		setPreviewPanning(false);
		previewPanStartRef.current = null;
	}, [storyId, storyProject.canvas.height, storyProject.canvas.width, storyProject.projectId]);

	const changePreviewZoom = (
		factor: number,
		anchor?: { x: number; y: number },
	) => {
		setPreviewViewport((current) => {
			const zoom = Math.min(
				MAX_STORY_PREVIEW_ZOOM,
				Math.max(MIN_STORY_PREVIEW_ZOOM, current.zoom * factor),
			);
			const zoomFactor = zoom / current.zoom;
			const anchorX = anchor?.x ?? 0;
			const anchorY = anchor?.y ?? 0;
			return {
				zoom,
				x: anchorX - (anchorX - current.x) * zoomFactor,
				y: anchorY - (anchorY - current.y) * zoomFactor,
			};
		});
	};

	const handlePreviewWheel = (event: React.WheelEvent<HTMLDivElement>) => {
		event.preventDefault();
		const rect = event.currentTarget.getBoundingClientRect();
		changePreviewZoom(Math.exp(-event.deltaY * 0.001), {
			x: event.clientX - (rect.left + rect.width / 2),
			y: event.clientY - (rect.top + rect.height / 2),
		});
	};

	const handlePreviewPanPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		event.preventDefault();
		previewPanStartRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originX: previewViewport.x,
			originY: previewViewport.y,
		};
		event.currentTarget.setPointerCapture(event.pointerId);
		setPreviewPanning(true);
	};

	const handlePreviewPanPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const panStart = previewPanStartRef.current;
		if (!panStart || panStart.pointerId !== event.pointerId) return;
		setPreviewViewport((current) => ({
			...current,
			x: panStart.originX + event.clientX - panStart.startX,
			y: panStart.originY + event.clientY - panStart.startY,
		}));
	};

	const stopPreviewPan = (event: React.PointerEvent<HTMLDivElement>) => {
		if (previewPanStartRef.current?.pointerId !== event.pointerId) return;
		previewPanStartRef.current = null;
		setPreviewPanning(false);
	};

	const renderPreviewZoomControls = () => (
		<div
			className="story-preview-zoom-controls"
			role="group"
			aria-label="Preview zoom controls"
		>
			<button
				type="button"
				className="project-transport-extra-btn"
				aria-label="Zoom out preview"
				title="Zoom out preview"
				disabled={previewViewport.zoom <= MIN_STORY_PREVIEW_ZOOM}
				onClick={() => changePreviewZoom(1 / STORY_PREVIEW_ZOOM_STEP)}
			>
				<MagnifyingGlassMinus size={14} />
			</button>
			<button
				type="button"
				className="project-transport-extra-btn story-preview-zoom-level"
				aria-label="Reset preview zoom"
				title="Reset preview zoom and position"
				onClick={() => setPreviewViewport({ zoom: 1, x: 0, y: 0 })}
			>
				{Math.round(previewViewport.zoom * 100)}%
			</button>
			<button
				type="button"
				className="project-transport-extra-btn"
				aria-label="Zoom in preview"
				title="Zoom in preview"
				disabled={previewViewport.zoom >= MAX_STORY_PREVIEW_ZOOM}
				onClick={() => changePreviewZoom(STORY_PREVIEW_ZOOM_STEP)}
			>
				<MagnifyingGlassPlus size={14} />
			</button>
			<button
				type="button"
				className={`project-transport-extra-btn ${previewPanMode ? "active" : ""}`}
				aria-label="Pan preview"
				aria-pressed={previewPanMode}
				title={previewPanMode ? "Pan mode enabled: drag preview to move" : "Pan preview"}
				onClick={() => {
					setPreviewPanMode((enabled) => !enabled);
					setPreviewPanning(false);
					previewPanStartRef.current = null;
				}}
			>
				<Hand size={14} />
			</button>
		</div>
	);

	const handleDropAssetOnCanvas = (assetId: string, canvasX: number, canvasY: number) => {
		try {
			resolveMediaAsset(storyProject, assetId);

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
	const toggleSnapping =
		externalOnToggleSnapping ?? (() => setInternalSnappingEnabled((v) => !v));

	const sourceAsset = useMemo(() => {
		if (!selectedAssetId) return null;
		return (
			[...storyProject.assets, ...(storyProject.localAssets ?? [])].find(
				(a) => a.id === selectedAssetId,
			) ?? null
		);
	}, [storyProject.assets, storyProject.localAssets, selectedAssetId]);

	const sourcePath = useMemo(() => {
		if (!sourceAsset) return null;
		return (
			sourceAsset.source?.path ??
			rootProject.packages.find((p) => p.id === sourceAsset.packageId)?.screen.path ??
			null
		);
	}, [rootProject.packages, sourceAsset]);

	const sourcePackage = useMemo(() => {
		if (!sourceAsset?.packageId) return null;
		return rootProject.packages.find((pkg) => pkg.id === sourceAsset.packageId) ?? null;
	}, [rootProject.packages, sourceAsset]);

	const addShape = (kind: ShapeDefinition["kind"]) => {
		const ids = {
			clipId: crypto.randomUUID(),
			trackId: crypto.randomUUID(),
		};
		onCommand(shapePlacementCommand(kind, playheadUs, ids), [ids.clipId]);
	};

	const addToTimeline = (assetId: string) => {
		const asset = resolveMediaAsset(storyProject, assetId);
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
				<ProjectToolRail
					onAddShape={addShape}
					templates={rootProject.designTemplates ?? []}
					onAddText={() => {
						const clipId = crypto.randomUUID();
						onCommand(
							(p) =>
								addTextOverlay(p, playheadUs, {
									clipId,
									trackId: crypto.randomUUID(),
								}),
							[clipId],
						);
					}}
					onApplyTemplate={(id) => {
						const clipId = crypto.randomUUID();
						onCommand(
							(p) =>
								applyDesignTemplate(p, id, playheadUs, {
									clipId,
									trackId: crypto.randomUUID(),
								}),
							[clipId],
						);
					}}
				/>
				<AssetLibrary
					storyAssets={storyProject.localAssets ?? []}
					onPublish={(id) =>
						onProjectCommand?.((root) =>
							publishStoryMedia(
								root,
								storyId
									? { kind: "artboard", artboardId: storyId }
									: { kind: "root" },
								id,
							),
						)
					}
					onRemoveStoryMedia={(id) =>
						onProjectCommand?.((root) =>
							removeStoryMedia(
								root,
								storyId
									? { kind: "artboard", artboardId: storyId }
									: { kind: "root" },
								id,
							),
						)
					}
					assets={rootProject.assets}
					packages={rootProject.packages}
					selectedAssetId={selectedAssetId}
					onImport={(paths) => onImportMedia?.(paths)}
					onRecord={() => onStartRecord?.()}
					onRecordAudio={() => onOpenAudioRecorder?.()}
					onPreview={(id) => {
						setPlaying(false);
						controller.preview(
							id,
							storyId ? { kind: "artboard", artboardId: storyId } : { kind: "root" },
						);
					}}
					onPlace={addToTimeline}
					onRemove={(id) => onProjectCommand?.((root) => removeAsset(root, id))}
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
							<span
								aria-label="Canvas aspect ratio, fixed"
								title="Canvas dimensions are fixed by the current project"
								className="bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-[10px] text-white/90 font-medium select-none"
							>
								{canvasAspectRatioLabel}
							</span>
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
						className={`project-preview-stage${previewZoomed ? " zoomed" : ""}${previewPanning ? " panning" : ""}`}
						ref={previewStage}
						role="region"
						aria-label="Story video preview canvas"
						title="Scroll to zoom; use Pan preview to drag the canvas"
						onWheel={handlePreviewWheel}
					>
						<div
							className="project-preview-zoom-wrapper"
							style={{
								aspectRatio: `${storyProject.canvas.width} / ${storyProject.canvas.height}`,
								maxHeight: "100%",
								maxWidth: "100%",
								width:
									previewFrameSize.width > 0
										? `${previewFrameSize.width}px`
										: "100%",
								height:
									previewFrameSize.height > 0
										? `${previewFrameSize.height}px`
										: "100%",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								position: "relative",
								...previewTransformStyle,
							}}
						>
							{sourceAsset ? (
								<AssetSourcePreview
									key={sourceAsset.id}
									asset={sourceAsset}
									path={sourcePath ?? ""}
									recordingPackage={sourcePackage ?? undefined}
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
									canTransformClip={(_clipId, assetKind) =>
									assetKind === "text" ||
									assetKind === "shape" ||
									assetKind === "image"
								}
									onSelectClip={(clipId) => {
										const currentSelected = selection[0] ?? "";
										if (currentSelected !== (clipId ?? "")) {
											controller.select(clipId ? [clipId] : []);
										}
									}}
									onUpdateClipTransform={(clipId, transform) => {
										onCommand((p: TimelineProject) =>
											updateClip(p, clipId, { transform }),
										);
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
						{previewPanMode && (
							<div
								className={`story-preview-pan-surface${previewPanning ? " panning" : ""}`}
								aria-hidden="true"
								onPointerDown={handlePreviewPanPointerDown}
								onPointerMove={handlePreviewPanPointerMove}
								onPointerUp={stopPreviewPan}
								onPointerCancel={stopPreviewPan}
							/>
						)}
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
									const frameUs = Math.round(
										1_000_000 / (storyProject.canvas.fps || 30),
									);
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
									const frameUs = Math.round(
										1_000_000 / (storyProject.canvas.fps || 30),
									);
									controller.seek(
										Math.min(durationUs, playheadUs + frameUs),
										durationUs,
									);
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
							{renderPreviewZoomControls()}
							<button
								type="button"
								className={`project-transport-extra-btn ${loopPlayback ? "active" : ""}`}
								title={
									loopPlayback
										? "Loop Playback: ON (L)"
										: "Loop Playback: OFF (L)"
								}
								onClick={() => setLoopPlayback((v) => !v)}
							>
								<Repeat size={14} weight={loopPlayback ? "bold" : "regular"} />
							</button>
							<button
								type="button"
								className={`project-transport-extra-btn ${showGridGuide ? "active" : ""}`}
								title={
									showGridGuide
										? "Grid & Safe Zones: ON"
										: "Grid & Safe Zones: OFF"
								}
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
				{captionsOpen ? <StoryCaptionPanel key={`${openingKey}-${storyId ?? "root"}`} project={storyProject} transcripts={transcripts} playheadUs={playheadUs} onCommand={onCommand} onSeek={time=>controller.seek(time,durationUs)} onClose={()=>setCaptionsOpen(false)}/> : <ProjectInspector
					project={storyProject}
					selection={selection}
					selectedTransitionId={selectedTransitionId}
					playheadUs={playheadUs}
					onCommand={onCommand}
					onOpenRecording={setEditingClipId}
				/>}
				{copilotOpen && (
					<CopilotSidebar
						editContext={editContext}
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
			<StoryEditingToolbar key={`tools-${openingKey}-${storyId ?? "root"}`} project={storyProject} selection={selection} playheadUs={playheadUs} onCommand={onCommand}/>
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
					<StoryProjectTerminal
						rootProject={rootProject}
						onProjectCommand={onProjectCommand ?? onCommand}
						onClose={() => setTerminalOpen(false)}
					/>
				</div>
			)}
			<footer className="project-footer justify-between">
				<div className="flex items-center gap-4">
					<span>{busy ? "Importing media…" : `${rootProject.assets.length} assets`}</span>
					<span>{storyProject.canvas.fps} fps</span>
					<button type="button" onClick={()=>setCaptionsOpen(v=>!v)} aria-pressed={captionsOpen}>Captions</button>
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
							{storyName || "Story Preview"} ({storyProject.canvas.width} ×{" "}
							{storyProject.canvas.height})
						</span>
						<div className="flex items-center gap-2">
							{renderPreviewZoomControls()}
							<button
								type="button"
								onClick={() => setFullscreenPreview(false)}
								className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
								title="Exit Fullscreen (Esc / F)"
						>
							<X size={18} />
						</button>
						</div>
					</div>
					<div
						className={`story-preview-fullscreen-stage${previewZoomed ? " zoomed" : ""}${previewPanning ? " panning" : ""}`}
						ref={fullscreenPreviewStage}
						role="region"
						aria-label="Fullscreen story video preview canvas"
						onWheel={handlePreviewWheel}
					>
						<div
							className="story-preview-fullscreen-viewport"
							style={{
								aspectRatio: `${storyProject.canvas.width} / ${storyProject.canvas.height}`,
								width:
									fullscreenFrameSize.width > 0
										? `${fullscreenFrameSize.width}px`
										: "100%",
								height:
									fullscreenFrameSize.height > 0
										? `${fullscreenFrameSize.height}px`
										: "100%",
								...previewTransformStyle,
							}}
						>
							<ProjectPreview
								key={`fullscreen-${openingKey}-${storyId ?? "root"}`}
								project={storyProject}
								timeUs={Math.min(playheadUs, Math.max(0, durationUs - 1))}
								playing={playing && !editingClipId}
								onError={onError}
							/>
						</div>
						{previewPanMode && (
							<div
								className={`story-preview-pan-surface${previewPanning ? " panning" : ""}`}
								aria-hidden="true"
								onPointerDown={handlePreviewPanPointerDown}
								onPointerMove={handlePreviewPanPointerMove}
								onPointerUp={stopPreviewPan}
								onPointerCancel={stopPreviewPan}
							/>
						)}
					</div>
				</div>
			)}
		</>
	);
}
