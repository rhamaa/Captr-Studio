import {
	CaretDown,
	CaretUp,
	Check,
	Eye,
	EyeSlash as EyeOff,
	LockKey as LockKeyhole,
	Sparkle,
	Trash,
	LockKeyOpen as UnlockKeyhole,
	SpeakerHigh as Volume2,
	SpeakerSlash as VolumeX,
	X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentDiffSummary } from "@/core/timeline/agentPayload";
import {
	addTextOverlay,
	removeTrack,
	reorderTrack,
	updateTrack,
} from "@/core/timeline/commands";
import { addClipTransition, getMaxClipTransitionDurationUs } from "@/core/timeline/clipTransitions";
import type { ProjectCommand } from "@/core/timeline/history";
import { createAndPlaceShape } from "@/core/timeline/shapeCommands";
import { clipDurationUs, projectDurationUs, type ShapeDefinition, type TimelineProject } from "@/core/timeline/types";
import { TimelineClipItem } from "./TimelineClipItem";
import { TimelineTransitionItem } from "./TimelineTransitionItem";
import { TimelineToolbar } from "./TimelineToolbar";
import { useProjectMessages } from "./useProjectMessages";
import {
	ASSET_DRAG_TYPE,
	applyTimelineDrop,
	CLIP_DRAG_TYPE,
	getTimelineDrag,
	pixelsToTime,
	snapTimelineTimeWithDetails,
	timelineActionCommand,
	timelineDropDetails,
	timelineDropStartUs,
	resolveTimelineDropTarget,
	timelineTracksInDisplayOrder,
	timeToPixels,
} from "./timelineInteractions";
export interface ProjectTimelineProps {
	project: TimelineProject;
	selection: string[];
	playheadUs: number;
	onCommand: (command: ProjectCommand) => void;
	onSelect: (ids: string[]) => void;
	onSeek: (timeUs: number) => void;
	onOpenRecording: (id: string) => void;
	selectedTransitionId?: string | null;
	onSelectTransition?: (id: string) => void;
	scale?: number;
	onScaleChange?: (scale: number | ((prev: number) => number)) => void;
	playing?: boolean;
	snappingEnabled?: boolean;
	onToggleSnapping?: () => void;
	speculativeProject?: TimelineProject | null;
	speculativeDiff?: AgentDiffSummary | null;
	onAcceptSpeculative?: () => void;
	onRejectSpeculative?: () => void;
}
export function ProjectTimeline({
	project,
	selection,
	playheadUs,
	onCommand,
	onSelect,
	onSeek,
	onOpenRecording,
	selectedTransitionId = null,
	onSelectTransition = () => undefined,
	scale: externalScale,
	onScaleChange,
	playing = false,
	snappingEnabled: externalSnapping,
	onToggleSnapping,
	speculativeProject,
	speculativeDiff,
	onAcceptSpeculative,
	onRejectSpeculative,
}: ProjectTimelineProps) {
	const m = useProjectMessages();
	const [internalScale, setInternalScale] = useState(65);
	const scale = externalScale ?? internalScale;
	const setScale = onScaleChange ?? setInternalScale;
	const [internalSnapping, setInternalSnapping] = useState(true);
	const snappingEnabled = externalSnapping ?? internalSnapping;
	const toggleSnapping = onToggleSnapping ?? (() => setInternalSnapping((v) => !v));
	const [snapGuideUs, setSnapGuideUs] = useState<number | null>(null);

	const scrollRef = useRef<HTMLDivElement>(null);
	const isPlayheadDragging = useRef(false);

	const [dropPreview, setDropPreview] = useState<{
		trackId: string;
		startUs: number;
		durationUs: number;
		mediaKind: "visual" | "audio";
		invalid: boolean;
		willCreateTrack: boolean;
	} | null>(null);
	const specDurationUs = speculativeProject ? projectDurationUs(speculativeProject) : 0;
	const duration = Math.max(
		20_000_000,
		projectDurationUs(project) + 10_000_000,
		specDurationUs + 10_000_000,
	),
		width = timeToPixels(duration, scale);
	const tickSeconds = scale < 20 ? 10 : scale < 50 ? 5 : scale < 110 ? 2 : 1;
	const selectedTrack = project.tracks.find((t) => t.clips.some((c) => selection.includes(c.id)));
	const locked = Boolean(selectedTrack?.locked);
	const displayTracks = timelineTracksInDisplayOrder(project.tracks);

	const speculativeExtraTracks = (speculativeProject?.tracks ?? []).filter(
		(st) => !project.tracks.some((t) => t.id === st.id),
	);
	const extraVisualTracks = speculativeExtraTracks.filter((t) => t.kind === "visual");
	const extraAudioTracks = speculativeExtraTracks.filter((t) => t.kind === "audio");

	const visualTracks = [...displayTracks.filter((track) => track.kind === "visual"), ...extraVisualTracks];
	const audioTracks = [...displayTracks.filter((track) => track.kind === "audio"), ...extraAudioTracks];
	const timelineRows = [...visualTracks, null, ...audioTracks];

	const handleZoomToFit = useCallback(() => {
		const container = scrollRef.current;
		if (!container) return;
		const totalUs = projectDurationUs(project);
		if (totalUs <= 0) return;
		const availableWidth = Math.max(100, container.clientWidth - 190);
		const targetScale = Math.max(8, Math.min(250, availableWidth / (totalUs / 1_000_000)));
		setScale(targetScale);
		requestAnimationFrame(() => {
			if (container) container.scrollLeft = 0;
		});
	}, [project, setScale]);

	useEffect(() => {
		if (!playing || !scrollRef.current) return;
		const container = scrollRef.current;
		const playheadPx = 150 + timeToPixels(playheadUs, scale);
		const visibleLeft = container.scrollLeft;
		const visibleRight = visibleLeft + container.clientWidth;
		if (playheadPx > visibleRight - 80) {
			container.scrollLeft = playheadPx - 100;
		} else if (playheadPx < visibleLeft + 150) {
			container.scrollLeft = Math.max(0, playheadPx - 150);
		}
	}, [playing, playheadUs, scale]);

	const handlePlayheadPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.stopPropagation();
		event.currentTarget.setPointerCapture(event.pointerId);
		isPlayheadDragging.current = true;
	};

	const handlePlayheadPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		if (!isPlayheadDragging.current || event.buttons !== 1) return;
		const container = scrollRef.current;
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const mouseContentX = event.clientX - rect.left + container.scrollLeft - 150;
		const rawTimeUs = Math.max(0, pixelsToTime(mouseContentX, scale));
		if (snappingEnabled && !event.shiftKey) {
			const snap = snapTimelineTimeWithDetails(rawTimeUs, project, playheadUs, scale, {
				includePlayhead: false,
				enabled: true,
			});
			setSnapGuideUs(snap.snapped ? (snap.snapPointUs ?? null) : null);
			onSeek(snap.timeUs);
		} else {
			setSnapGuideUs(null);
			onSeek(rawTimeUs);
		}
	};

	const handlePlayheadPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		if (isPlayheadDragging.current) {
			isPlayheadDragging.current = false;
			setSnapGuideUs(null);
			try {
				event.currentTarget.releasePointerCapture(event.pointerId);
			} catch {
				// Pointer capture already released
			}
		}
	};

	const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
	const [editingTrackName, setEditingTrackName] = useState("");

	const startRenameTrack = (trackId: string, currentName: string) => {
		setEditingTrackId(trackId);
		setEditingTrackName(currentName);
	};

	const commitRenameTrack = (trackId: string, fallbackName: string) => {
		const trimmed = editingTrackName.trim();
		if (trimmed && trimmed !== fallbackName) {
			onCommand((p) => updateTrack(p, trackId, { name: trimmed }));
		}
		setEditingTrackId(null);
	};

	const cancelRenameTrack = () => {
		setEditingTrackId(null);
	};

	const handleMoveTrack = (trackId: string, direction: "up" | "down") => {
		const currentIndex = displayTracks.findIndex((t) => t.id === trackId);
		if (currentIndex < 0) return;
		const target = displayTracks[currentIndex + (direction === "up" ? -1 : 1)];
		if (!target || target.kind !== displayTracks[currentIndex].kind) return;
		const targetIndex = project.tracks.findIndex((track) => track.id === target.id);
		onCommand((p) => reorderTrack(p, trackId, targetIndex));
	};

	const handleDeleteTrack = (track: TimelineProject["tracks"][number]) => {
		if (track.locked || project.tracks.length <= 1) return;
		if (track.clips.length > 0) {
			const confirmed = window.confirm(
				`Delete track "${track.name}" and its ${track.clips.length} clip(s)?`,
			);
			if (!confirmed) return;
		}
		onCommand((p) => removeTrack(p, track.id));
	};

	return (
		<section
			className="project-timeline"
			aria-label="Project timeline"
			tabIndex={0}
			onKeyDown={(event) => {
				if (
					(event.target as HTMLElement).matches(
						"input,textarea,select,[contenteditable=true]",
					)
				)
					return;
				if (
					event.key.toLowerCase() === "n" &&
					!event.ctrlKey &&
					!event.metaKey &&
					!event.altKey
				) {
					event.preventDefault();
					toggleSnapping();
				} else if (
					event.key.toLowerCase() === "z" &&
					event.shiftKey &&
					!event.ctrlKey &&
					!event.metaKey
				) {
					event.preventDefault();
					handleZoomToFit();
				} else if (event.key === "Delete" || event.key === "Backspace") {
					event.preventDefault();
					if (event.shiftKey) {
						onCommand(timelineActionCommand("ripple-delete", selection, playheadUs));
					} else {
						onCommand(timelineActionCommand("delete", selection, playheadUs));
					}
					onSelect([]);
				} else if (
					(!event.ctrlKey &&
						!event.metaKey &&
						(event.key.toLowerCase() === "s" || event.key.toLowerCase() === "c")) ||
					((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "b")
				) {
					event.preventDefault();
					onCommand(timelineActionCommand("split", selection, playheadUs));
				} else if (event.key.toLowerCase() === "d" && (event.ctrlKey || event.metaKey)) {
					event.preventDefault();
					onCommand(timelineActionCommand("duplicate", selection, playheadUs));
				}
			}}
		>
			<TimelineToolbar
				project={project}
				selection={selection}
				playheadUs={playheadUs}
				onCommand={onCommand}
				onAddText={() => {
					const ids = {
						trackId: crypto.randomUUID(),
						clipId: crypto.randomUUID(),
					};
					onCommand((p) => addTextOverlay(p, playheadUs, ids));
					onSelect([ids.clipId]);
				}}
				scale={scale}
				onScale={setScale}
				onZoomToFit={handleZoomToFit}
				locked={locked}
				snappingEnabled={snappingEnabled}
				onToggleSnapping={toggleSnapping}
			/>
			{speculativeProject && (
				<div className="project-timeline-speculative-banner">
					<div className="flex items-center gap-2">
						<Sparkle size={15} weight="fill" className="text-amber-400" />
						<span className="speculative-title">Speculative AI Draft Preview</span>
						{speculativeDiff && (
							<span className="speculative-stats">
								({speculativeDiff.clipsBefore} → {speculativeDiff.clipsAfter} clips,{" "}
								{speculativeDiff.durationDeltaUs >= 0 ? "+" : ""}
								{(speculativeDiff.durationDeltaUs / 1_000_000).toFixed(1)}s)
							</span>
						)}
					</div>
					<div className="project-speculative-actions">
						<button
							type="button"
							className="project-speculative-btn-reject"
							onClick={onRejectSpeculative}
						>
							<X size={12} weight="bold" />
							<span>Reject</span>
						</button>
						<button
							type="button"
							className="project-speculative-btn-accept"
							onClick={onAcceptSpeculative}
						>
							<Check size={12} weight="bold" />
							<span>Accept Changes</span>
						</button>
					</div>
				</div>
			)}
			<div
				ref={scrollRef}
				className="project-timeline-scroll"
				onWheel={(event) => {
					if (event.ctrlKey || event.metaKey) {
						event.preventDefault();
						const container = scrollRef.current;
						if (!container) return;
						const rect = container.getBoundingClientRect();
						const mouseViewportX = event.clientX - rect.left;
						const mouseContentX = mouseViewportX + container.scrollLeft - 150;
						const anchorTimeUs = Math.max(0, pixelsToTime(mouseContentX, scale));
						const zoomFactor = event.deltaY < 0 ? 1.15 : 0.87;
						const nextScale = Math.max(8, Math.min(250, scale * zoomFactor));
						if (Math.abs(nextScale - scale) < 0.1) return;
						setScale(nextScale);
						const newContentX = timeToPixels(anchorTimeUs, nextScale);
						const targetScrollLeft = Math.max(0, newContentX + 150 - mouseViewportX);
						requestAnimationFrame(() => {
							if (container) {
								container.scrollLeft = targetScrollLeft;
							}
						});
					}
				}}
			>
				<div className="project-track-list" style={{ width: width + 150 }}>
					<div className="project-ruler-row">
						<div className="project-track-heading">Timeline</div>
						<div
							className="project-ruler"
							style={{ width }}
							onPointerDown={(event) => {
								event.currentTarget.setPointerCapture(event.pointerId);
								const rect = event.currentTarget.getBoundingClientRect();
								const rawTime = Math.max(
									0,
									pixelsToTime(event.clientX - rect.left, scale),
								);
								if (snappingEnabled && !event.shiftKey) {
									const snap = snapTimelineTimeWithDetails(
										rawTime,
										project,
										playheadUs,
										scale,
										{
											includePlayhead: false,
											enabled: true,
										},
									);
									setSnapGuideUs(
										snap.snapped ? (snap.snapPointUs ?? null) : null,
									);
									onSeek(snap.timeUs);
								} else {
									setSnapGuideUs(null);
									onSeek(rawTime);
								}
							}}
							onPointerMove={(event) => {
								if (event.buttons === 1) {
									const rect = event.currentTarget.getBoundingClientRect();
									const rawTime = Math.max(
										0,
										pixelsToTime(event.clientX - rect.left, scale),
									);
									if (snappingEnabled && !event.shiftKey) {
										const snap = snapTimelineTimeWithDetails(
											rawTime,
											project,
											playheadUs,
											scale,
											{
												includePlayhead: false,
												enabled: true,
											},
										);
										setSnapGuideUs(
											snap.snapped ? (snap.snapPointUs ?? null) : null,
										);
										onSeek(snap.timeUs);
									} else {
										setSnapGuideUs(null);
										onSeek(rawTime);
									}
								}
							}}
							onPointerUp={() => setSnapGuideUs(null)}
							onPointerCancel={() => setSnapGuideUs(null)}
						>
							{Array.from(
								{ length: Math.ceil(duration / 1_000_000 / tickSeconds) },
								(_, i) => (
									<span
										key={i}
										style={{
											left: timeToPixels(i * tickSeconds * 1_000_000, scale),
										}}
									>
										{Math.floor((i * tickSeconds) / 60)}:
										{String((i * tickSeconds) % 60).padStart(2, "0")}
									</span>
								),
							)}
						</div>
					</div>
					{timelineRows.map((track) => {
						if (!track) {
							return (
								<div className="project-track-group-divider" role="separator" aria-label="Audio tracks" key="track-kind-divider">
									<span className="project-track-group-divider-label">AUDIO</span>
									<span className="project-track-group-divider-line" />
								</div>
							);
						}
						const peerTracks = track.kind === "visual" ? visualTracks : audioTracks;
						const peerIndex = peerTracks.findIndex((entry) => entry.id === track.id);
						const isDraftTrack = !project.tracks.some((t) => t.id === track.id);
						return (
						<div
							className={`project-track-row ${track.kind} ${track.locked ? "locked" : ""}`}
							key={track.id}
							data-track-id={track.id}
							data-track-kind={track.kind}
						>
							<div className="project-track-heading">
								<div className="project-track-heading-top">
									{editingTrackId === track.id ? (
										<input
											className="project-track-name-input"
											autoFocus
											value={editingTrackName}
											onChange={(e) => setEditingTrackName(e.target.value)}
											onBlur={() => commitRenameTrack(track.id, track.name)}
											onKeyDown={(e) => {
												if (e.key === "Enter")
													commitRenameTrack(track.id, track.name);
												if (e.key === "Escape") cancelRenameTrack();
											}}
										/>
									) : (
										<span
											className="project-track-title"
											title={isDraftTrack ? "Speculative draft track from AI edits" : "Double-click to rename"}
											onDoubleClick={() =>
												!isDraftTrack &&
												!track.locked &&
												startRenameTrack(track.id, track.name)
											}
										>
											{track.name}
											{isDraftTrack && <span className="project-clip-ghost-badge ml-1.5 inline-flex">✨ Draft</span>}
										</span>
									)}
									<div className="project-track-reorder-group">
										<button
											className="project-track-mini-btn"
											disabled={isDraftTrack || peerIndex === 0}
											title="Move track up"
											aria-label={`Move ${track.name} up`}
											onClick={() => handleMoveTrack(track.id, "up")}
										>
											<CaretUp size={11} />
										</button>
										<button
											className="project-track-mini-btn"
											disabled={isDraftTrack || peerIndex === peerTracks.length - 1}
											title="Move track down"
											aria-label={`Move ${track.name} down`}
											onClick={() => handleMoveTrack(track.id, "down")}
										>
											<CaretDown size={11} />
										</button>
									</div>
								</div>
								<div className="project-track-controls">
									<button
										aria-label={`${track.muted ? "Unmute" : "Mute"} ${track.name}`}
										title={track.muted ? "Unmute track" : "Mute track"}
										className={track.muted ? "active" : ""}
										disabled={isDraftTrack}
										onClick={() =>
											!isDraftTrack &&
											onCommand((p) =>
												updateTrack(p, track.id, { muted: !track.muted }),
											)
										}
									>
										{track.muted ? (
											<VolumeX size={13} />
										) : (
											<Volume2 size={13} />
										)}
									</button>
									{track.kind === "visual" && (
										<button
											aria-label={`${track.hidden ? "Show" : "Hide"} ${track.name}`}
											title={track.hidden ? "Show track" : "Hide track"}
											className={track.hidden ? "active" : ""}
											disabled={isDraftTrack}
											onClick={() =>
												!isDraftTrack &&
												onCommand((p) =>
													updateTrack(p, track.id, {
														hidden: !track.hidden,
													}),
												)
											}
										>
											{track.hidden ? (
												<EyeOff size={13} />
											) : (
												<Eye size={13} />
											)}
										</button>
									)}
									<button
										aria-label={`${track.locked ? "Unlock" : "Lock"} ${track.name}`}
										title={track.locked ? "Unlock track" : "Lock track"}
										className={track.locked ? "active" : ""}
										disabled={isDraftTrack}
										onClick={() =>
											!isDraftTrack &&
											onCommand((p) =>
												updateTrack(p, track.id, { locked: !track.locked }),
											)
										}
									>
										{track.locked ? (
											<LockKeyhole size={13} />
										) : (
											<UnlockKeyhole size={13} />
										)}
									</button>
									<button
										className="project-track-delete-btn"
										disabled={isDraftTrack || track.locked || project.tracks.length <= 1}
										title={
											isDraftTrack
												? "Draft track cannot be deleted directly"
												: project.tracks.length <= 1
													? "Cannot delete the only track"
													: track.locked
														? "Track is locked"
														: "Delete track"
										}
										aria-label={`Delete ${track.name}`}
										onClick={() => !isDraftTrack && handleDeleteTrack(track)}
									>
										<Trash size={13} />
									</button>
								</div>
							</div>
							<div
								className="project-track-lane"
								style={{
									width,
									backgroundSize: `${timeToPixels(tickSeconds * 1_000_000, scale)}px 100%`,
								}}
								onPointerDown={(event) => {
									if (event.target === event.currentTarget) {
										onSelect([]);
										event.currentTarget.setPointerCapture(event.pointerId);
										const rect = event.currentTarget.getBoundingClientRect();
										const rawTime = Math.max(
											0,
											pixelsToTime(event.clientX - rect.left, scale),
										);
										if (snappingEnabled && !event.shiftKey) {
											const snap = snapTimelineTimeWithDetails(
												rawTime,
												project,
												playheadUs,
												scale,
												{
													includePlayhead: false,
													enabled: true,
												},
											);
											setSnapGuideUs(
												snap.snapped ? (snap.snapPointUs ?? null) : null,
											);
											onSeek(snap.timeUs);
										} else {
											setSnapGuideUs(null);
											onSeek(rawTime);
										}
									}
								}}
								onPointerMove={(event) => {
									if (
										event.buttons === 1 &&
										event.target === event.currentTarget
									) {
										const rect = event.currentTarget.getBoundingClientRect();
										const rawTime = Math.max(
											0,
											pixelsToTime(event.clientX - rect.left, scale),
										);
										if (snappingEnabled && !event.shiftKey) {
											const snap = snapTimelineTimeWithDetails(
												rawTime,
												project,
												playheadUs,
												scale,
												{
													includePlayhead: false,
													enabled: true,
												},
											);
											setSnapGuideUs(
												snap.snapped ? (snap.snapPointUs ?? null) : null,
											);
											onSeek(snap.timeUs);
										} else {
											setSnapGuideUs(null);
											onSeek(rawTime);
										}
									}
								}}
								onPointerUp={(event) => {
									if (event.target === event.currentTarget) {
										setSnapGuideUs(null);
										try {
											event.currentTarget.releasePointerCapture(
												event.pointerId,
											);
										} catch {
											// Pointer capture already released
										}
									}
								}}
								onDragOver={(event) => {
									const drag = getTimelineDrag();
									if (!drag) {
										setDropPreview(null);
										setSnapGuideUs(null);
										return;
									}
									event.preventDefault();
									event.dataTransfer.dropEffect =
										drag.type === "clip" ? "move" : "copy";
									const rect = event.currentTarget.getBoundingClientRect();
									const snapDetails = timelineDropDetails(
										event.clientX,
										rect.left,
										drag.pointerOffsetPx,
										project,
										playheadUs,
										scale,
										{
											durationUs: drag.durationUs,
											excludedClipId:
												drag.type === "clip" ? drag.id : undefined,
											enabled: snappingEnabled,
										},
									);
									const startUs = snapDetails.timeUs;
									const request = {
										type: drag.type,
										id: drag.id,
										preferredTrackId: track.id,
										startUs,
										durationUs: drag.durationUs,
									};
									const target = resolveTimelineDropTarget(project, request);
									const previewTrackId = target.trackId ?? track.id;
									setSnapGuideUs(
										snapDetails.snapped
											? (snapDetails.snapPointUs ?? null)
											: null,
									);
									const invalid = target.blocked;
									setDropPreview((current) =>
										current?.trackId === previewTrackId &&
										current.startUs === startUs &&
										current.invalid === invalid &&
										current.willCreateTrack === target.createTrack
											? current
											: {
													trackId: previewTrackId,
													startUs,
													durationUs: drag.durationUs,
													mediaKind: target.kind,
													invalid,
													willCreateTrack: target.createTrack,
												},
									);
								}}
								onDragLeave={(event) => {
									if (
										event.relatedTarget instanceof Node &&
										event.currentTarget.contains(event.relatedTarget)
									)
										return;
									setDropPreview(null);
									setSnapGuideUs(null);
								}}
								onDrop={(event) => {
									event.preventDefault();
									setDropPreview(null);
									setSnapGuideUs(null);
									const clipId = event.dataTransfer.getData(CLIP_DRAG_TYPE),
										assetId = event.dataTransfer.getData(ASSET_DRAG_TYPE),
										drag = getTimelineDrag();
									if (
										!drag ||
										(drag.type === "clip"
											? drag.id !== clipId
											: drag.id !== assetId)
									)
										return;
									const rect = event.currentTarget.getBoundingClientRect(),
										startUs = timelineDropStartUs(
											event.clientX,
											rect.left,
											drag.pointerOffsetPx,
											project,
											playheadUs,
											scale,
											{
												durationUs: drag.durationUs,
												excludedClipId: clipId || undefined,
												enabled: snappingEnabled,
											},
										);
									const request = {
										type: drag.type,
										id: drag.id,
										preferredTrackId: track.id,
										startUs,
										durationUs: drag.durationUs,
									};
									if (resolveTimelineDropTarget(project, request).blocked) return;
									onCommand((p) =>
										applyTimelineDrop(p, request, {
											trackId: crypto.randomUUID(),
											clipId: clipId || crypto.randomUUID(),
											compositionId: crypto.randomUUID(),
										}),
									);
								}}
							>
								{!track.clips.length && (
									<span className="project-track-empty">
										{track.kind === "visual"
											? "Drag video, images, text or recordings here"
											: "Drag audio here"}
									</span>
								)}
								{track.clips.map((clip) => (
									<TimelineClipItem
										key={clip.id}
										project={project}
										clip={clip}
										scale={scale}
										playheadUs={playheadUs}
										selected={selection.includes(clip.id)}
										selection={selection}
										locked={track.locked}
										snappingEnabled={snappingEnabled}
										onSnapChange={setSnapGuideUs}
										onCommand={onCommand}
										onSelect={onSelect}
										onOpenRecording={onOpenRecording}
									/>
								))}
								{(() => {
									const speculativeTrack = speculativeProject?.tracks.find((t) => t.id === track.id);
									if (!speculativeTrack) return null;
									const ghostAddedClips = speculativeTrack.clips.filter(
										(sc) => !track.clips.some((c) => c.id === sc.id),
									);
									const ghostModifiedClips = speculativeTrack.clips.filter((sc) => {
										const orig = track.clips.find((c) => c.id === sc.id);
										return (
											orig &&
											(orig.startUs !== sc.startUs ||
												orig.sourceInUs !== sc.sourceInUs ||
												orig.sourceOutUs !== sc.sourceOutUs)
										);
									});
									const pendingRemovedIds = new Set(
										track.clips
											.filter((c) => !speculativeTrack.clips.some((sc) => sc.id === c.id))
											.map((c) => c.id),
									);
									return (
										<>
											{ghostAddedClips.map((sc) => (
												<div
													key={`ghost-add-${sc.id}`}
													className="project-clip-ghost project-clip-ghost-added"
													style={{
														left: timeToPixels(sc.startUs, scale),
														width: Math.max(20, timeToPixels(clipDurationUs(sc), scale)),
													}}
													title={`Ghost added clip (${(clipDurationUs(sc) / 1_000_000).toFixed(1)}s)`}
												>
													<span className="project-clip-ghost-badge">✨ +Ghost</span>
													<span className="project-clip-ghost-dur">
														{(clipDurationUs(sc) / 1_000_000).toFixed(1)}s
													</span>
												</div>
											))}
											{ghostModifiedClips.map((sc) => (
												<div
													key={`ghost-mod-${sc.id}`}
													className="project-clip-ghost project-clip-ghost-modified"
													style={{
														left: timeToPixels(sc.startUs, scale),
														width: Math.max(20, timeToPixels(clipDurationUs(sc), scale)),
													}}
													title={`Ghost modified (${(clipDurationUs(sc) / 1_000_000).toFixed(1)}s)`}
												>
													<span className="project-clip-ghost-badge">✨ Draft Cut</span>
													<span className="project-clip-ghost-dur">
														{(clipDurationUs(sc) / 1_000_000).toFixed(1)}s
													</span>
												</div>
											))}
											{track.clips
												.filter((c) => pendingRemovedIds.has(c.id))
												.map((c) => (
													<div
														key={`ghost-del-${c.id}`}
														className="project-clip-ghost-pending-removal"
														style={{
															left: timeToPixels(c.startUs, scale),
															width: Math.max(20, timeToPixels(clipDurationUs(c), scale)),
														}}
														title={`Pending removal: ${c.id}`}
													>
														<span>Will Delete</span>
													</div>
												))}
										</>
									);
								})()}
				{eligibleTimelineTransitions(project, track.id).map(({ transition, boundaryUs, maximumDurationUs }) => (
					<TimelineTransitionItem
						key={transition.id}
						transition={transition}
						boundaryUs={boundaryUs}
						maximumDurationUs={maximumDurationUs}
						scale={scale}
						selected={selectedTransitionId === transition.id}
						locked={track.locked || track.kind !== "visual"}
						snappingEnabled={snappingEnabled}
						onSelect={() => onSelectTransition(transition.id)}
						onCommand={onCommand}
					/>
				))}
				{eligibleTransitionBoundaries(project, track.id).map(({ fromClipId, toClipId, boundaryUs }) => (
					<button
						key={`${fromClipId}:${toClipId}`}
						type="button"
						className="project-transition-add"
						style={{ left: timeToPixels(boundaryUs, scale) }}
						aria-label={m("addTransition")}
						title={m("addTransition")}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => {
							event.stopPropagation();
							const id = crypto.randomUUID();
							onCommand(transitionPlacementCommand(fromClipId, toClipId, id));
							onSelectTransition(id);
						}}
					>
						+
					</button>
				))}
								{dropPreview?.trackId === track.id && (
									<div
										className={`project-drop-preview ${dropPreview.mediaKind} ${dropPreview.invalid ? "invalid" : ""} ${dropPreview.willCreateTrack ? "new-track" : ""}`}
										style={{
										left: timeToPixels(dropPreview.startUs, scale),
										width: Math.max(
											8,
											timeToPixels(dropPreview.durationUs, scale),
										),
									}}
										aria-label={
											dropPreview.willCreateTrack
											? `New ${dropPreview.mediaKind} track will be created`
											: `Place on ${dropPreview.mediaKind} track`
										}
									>
										{dropPreview.willCreateTrack && (
											<span className="project-drop-preview-label">New track</span>
										)}
									</div>
								)}
							</div>
						</div>
						);
					})}
					{snapGuideUs !== null && (
						<div
							className="project-snap-guide"
							style={{ left: 150 + timeToPixels(snapGuideUs, scale) }}
							aria-hidden="true"
						/>
					)}
					<div
						className="project-playhead"
						style={{ left: 150 + timeToPixels(playheadUs, scale) }}
						onPointerDown={handlePlayheadPointerDown}
						onPointerMove={handlePlayheadPointerMove}
						onPointerUp={handlePlayheadPointerUp}
						onPointerCancel={handlePlayheadPointerUp}
					>
						<span />
					</div>
				</div>
			</div>
		</section>
	);
}

export function shapePlacementCommand(
	kind: ShapeDefinition["kind"],
	startUs: number,
	ids: { assetId?: string; clipId: string; trackId: string },
): ProjectCommand {
	const definitions: Record<ShapeDefinition["kind"], ShapeDefinition> = {
		rectangle: { kind: "rectangle", width: 360, height: 220, style: { fill: "#6387ff", stroke: null } },
		ellipse: { kind: "ellipse", width: 260, height: 180, style: { fill: "#6387ff", stroke: null } },
		line: { kind: "line", from: { x: 0, y: 0 }, to: { x: 360, y: 220 }, style: { stroke: { color: "#6387ff", width: 8 } } },
		arrow: { kind: "arrow", from: { x: 0, y: 110 }, to: { x: 360, y: 110 }, headLength: 32, style: { stroke: { color: "#6387ff", width: 8 } } },
	};
	const definition = structuredClone(definitions[kind]);
	return (project) => createAndPlaceShape(project, definition, startUs, ids);
}

export function transitionPlacementCommand(
	fromClipId: string,
	toClipId: string,
	transitionId: string,
): ProjectCommand {
	return (project) => {
		const track = project.tracks.find((item) => item.clips.some((clip) => clip.id === fromClipId));
		if (!track) throw new Error("Transition clip not found");
		return addClipTransition(project, {
			trackId: track.id,
			fromClipId,
			toClipId,
			preset: { kind: "cross-dissolve" },
			easing: "ease-in-out",
		}, transitionId);
	};
}

export function eligibleTransitionBoundaries(project: TimelineProject, trackId: string) {
	const track = project.tracks.find((item) => item.id === trackId);
	if (!track || track.kind !== "visual" || track.locked || track.hidden) return [];
	const clips = [...track.clips].sort((left, right) => left.startUs - right.startUs);
	return clips.slice(0, -1).flatMap((from, index) => {
		const to = clips[index + 1]!;
		if (from.startUs + clipDurationUs(from) !== to.startUs) return [];
		if ((project.clipTransitions ?? []).some((item) => item.trackId === track.id && item.fromClipId === from.id && item.toClipId === to.id)) return [];
		try {
			const maximumDurationUs = getMaxClipTransitionDurationUs(project, from.id, to.id);
			return maximumDurationUs > 0
				? [{ trackId: track.id, fromClipId: from.id, toClipId: to.id, boundaryUs: to.startUs, maximumDurationUs }]
				: [];
		} catch {
			return [];
		}
	});
}

export function eligibleTimelineTransitions(project: TimelineProject, trackId: string) {
	const track = project.tracks.find((item) => item.id === trackId);
	if (!track || track.kind !== "visual") return [];
	const clips = [...track.clips].sort((left, right) => left.startUs - right.startUs);
	return (project.clipTransitions ?? []).flatMap((transition) => {
		if (transition.trackId !== track.id) return [];
		const index = clips.findIndex((clip) => clip.id === transition.fromClipId);
		const from = clips[index], to = clips[index + 1];
		if (!from || !to || to.id !== transition.toClipId || from.startUs + clipDurationUs(from) !== to.startUs) return [];
		try {
			const maximumDurationUs = getMaxClipTransitionDurationUs(project, from.id, to.id, transition.id);
			if (transition.durationUs > maximumDurationUs) return [];
			return [{ transition, boundaryUs: to.startUs, maximumDurationUs }];
		} catch {
			return [];
		}
	});
}
