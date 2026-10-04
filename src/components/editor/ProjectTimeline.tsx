import {
	CaretDown,
	CaretUp,
	Eye,
	EyeSlash as EyeOff,
	LockKey as LockKeyhole,
	Trash,
	LockKeyOpen as UnlockKeyhole,
	SpeakerHigh as Volume2,
	SpeakerSlash as VolumeX,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	addTextOverlay,
	moveClip,
	removeTrack,
	reorderTrack,
	updateTrack,
} from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";
import { clipDurationUs, projectDurationUs, type TimelineProject } from "@/core/timeline/types";
import { TimelineClipItem } from "./TimelineClipItem";
import { TimelineToolbar } from "./TimelineToolbar";
import {
	ASSET_DRAG_TYPE,
	assetDropCommand,
	CLIP_DRAG_TYPE,
	getTimelineDrag,
	pixelsToTime,
	snapTimelineTimeWithDetails,
	timelineActionCommand,
	timelineDropDetails,
	timelineDropStartUs,
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
	scale?: number;
	onScaleChange?: (scale: number | ((prev: number) => number)) => void;
	playing?: boolean;
	snappingEnabled?: boolean;
	onToggleSnapping?: () => void;
}
export function ProjectTimeline({
	project,
	selection,
	playheadUs,
	onCommand,
	onSelect,
	onSeek,
	onOpenRecording,
	scale: externalScale,
	onScaleChange,
	playing = false,
	snappingEnabled: externalSnapping,
	onToggleSnapping,
}: ProjectTimelineProps) {
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
	} | null>(null);
	const duration = Math.max(20_000_000, projectDurationUs(project) + 10_000_000),
		width = timeToPixels(duration, scale);
	const tickSeconds = scale < 20 ? 10 : scale < 50 ? 5 : scale < 110 ? 2 : 1;
	const selectedTrack = project.tracks.find((t) => t.clips.some((c) => selection.includes(c.id)));
	const locked = Boolean(selectedTrack?.locked);

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
		const currentIndex = project.tracks.findIndex((t) => t.id === trackId);
		if (currentIndex < 0) return;
		const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
		if (targetIndex >= 0 && targetIndex < project.tracks.length) {
			onCommand((p) => reorderTrack(p, trackId, targetIndex));
		}
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
				selection={selection}
				playheadUs={playheadUs}
				onCommand={onCommand}
				onAddText={() => {
					const ids = {
						assetId: crypto.randomUUID(),
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
					{project.tracks.map((track, trackIndex) => (
						<div
							className={`project-track-row ${track.locked ? "locked" : ""}`}
							key={track.id}
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
											title="Double-click to rename"
											onDoubleClick={() =>
												!track.locked &&
												startRenameTrack(track.id, track.name)
											}
										>
											{track.name}
										</span>
									)}
									<div className="project-track-reorder-group">
										<button
											className="project-track-mini-btn"
											disabled={trackIndex === 0}
											title="Move track up"
											aria-label={`Move ${track.name} up`}
											onClick={() => handleMoveTrack(track.id, "up")}
										>
											<CaretUp size={11} />
										</button>
										<button
											className="project-track-mini-btn"
											disabled={trackIndex === project.tracks.length - 1}
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
										onClick={() =>
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
											onClick={() =>
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
										onClick={() =>
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
										disabled={track.locked || project.tracks.length <= 1}
										title={
											project.tracks.length <= 1
												? "Cannot delete the only track"
												: track.locked
													? "Track is locked"
													: "Delete track"
										}
										aria-label={`Delete ${track.name}`}
										onClick={() => handleDeleteTrack(track)}
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
									if (track.locked || !drag || drag.mediaKind !== track.kind) {
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
									setSnapGuideUs(
										snapDetails.snapped
											? (snapDetails.snapPointUs ?? null)
											: null,
									);
									const endUs = startUs + drag.durationUs;
									const invalid = track.clips.some(
										(clip) =>
											clip.id !== drag.id &&
											startUs < clip.startUs + clipDurationUs(clip) &&
											endUs > clip.startUs,
									);
									setDropPreview((current) =>
										current?.trackId === track.id &&
										current.startUs === startUs &&
										current.invalid === invalid
											? current
											: {
													trackId: track.id,
													startUs,
													durationUs: drag.durationUs,
													mediaKind: drag.mediaKind,
													invalid,
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
									if (track.locked) return;
									const clipId = event.dataTransfer.getData(CLIP_DRAG_TYPE),
										assetId = event.dataTransfer.getData(ASSET_DRAG_TYPE),
										drag = getTimelineDrag();
									if (
										!drag ||
										drag.mediaKind !== track.kind ||
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
									if (clipId)
										onCommand((p) => moveClip(p, clipId, track.id, startUs));
									else if (assetId)
										onCommand(
											assetDropCommand(assetId, track.id, startUs, {
												clipId: crypto.randomUUID(),
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
								{dropPreview?.trackId === track.id && (
									<div
										className={`project-drop-preview ${dropPreview.mediaKind} ${dropPreview.invalid ? "invalid" : ""}`}
										style={{
											left: timeToPixels(dropPreview.startUs, scale),
											width: Math.max(
												8,
												timeToPixels(dropPreview.durationUs, scale),
											),
										}}
										aria-hidden="true"
									/>
								)}
							</div>
						</div>
					))}
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
