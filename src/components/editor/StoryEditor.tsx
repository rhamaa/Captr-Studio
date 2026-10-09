import { Pause, Play, SquaresFour } from "@phosphor-icons/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AgentDiffSummary } from "@/core/timeline/agentPayload";
import { placeAsset, removeAsset, updateClip } from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";
import {
	clipDurationUs,
	projectDurationUs,
	type ShapeDefinition,
	type TimelineProject,
} from "@/core/timeline/types";
import type { AssetTranscript } from "@/core/timeline/transcriptTypes";
import { AssetLibrary } from "./AssetLibrary";
import { AssetSourcePreview } from "./AssetSourcePreview";
import { CopilotSidebar, type EditPlan } from "./CopilotSidebar";
import { ProjectInspector } from "./ProjectInspector";
import { ProjectPreview } from "./ProjectPreview";
import { ProjectTimeline, shapePlacementCommand } from "./ProjectTimeline";
import { ProjectToolRail } from "./ProjectToolRail";
import { ProjectWelcome } from "./ProjectWelcome";
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

	const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
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

	const selection = controller.snapshot.selection;
	const playheadUs = controller.snapshot.playheadUs;
	const selectedAssetId = controller.snapshot.selectedAssetId;
	const openingKey = controller.snapshot.openingKey;

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

	const durationUs = projectDurationUs(storyProject);

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
						<span>
							{storyProject.canvas.width} × {storyProject.canvas.height}
						</span>
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
					<div className="project-preview-stage" ref={previewStage}>
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
								onSelectClip={(clipId) => controller.select(clipId ? [clipId] : [])}
								onUpdateClipTransform={(clipId, transform) => {
									onCommand((p: TimelineProject) => updateClip(p, clipId, { transform }));
								}}
							/>
						) : (
							<ProjectWelcome
								hasAssets={Boolean(rootProject.assets.length)}
								onImport={() => onImportMedia?.()}
								onRecord={() => onStartRecord?.()}
							/>
						)}
					</div>
					<div className="project-preview-transport">
						<span>{(playheadUs / 1_000_000).toFixed(2)}</span>
						<button
							aria-label={playing ? "Pause timeline" : "Play timeline"}
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
								<Pause size={20} weight="fill" />
							) : (
								<Play size={20} weight="fill" />
							)}
						</button>
						<span>{(durationUs / 1_000_000).toFixed(2)}</span>
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
			<footer className="project-footer">
				<span>
					{busy ? "Importing media…" : `${rootProject.assets.length} assets`}
				</span>
				<span>{storyProject.canvas.fps} fps</span>
			</footer>
		</>
	);
}
