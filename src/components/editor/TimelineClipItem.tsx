import type { PointerEvent } from "react";
import { useRef, useState } from "react";
import { TimelineAudioPreview, TimelineFilmstrip } from "./TimelineSourcePreview";
import { resolveClipSource } from "@/core/timeline/clipSource";
import { relatedClipIds } from "@/core/timeline/editingCommands";
import type { ProjectCommand } from "@/core/timeline/history";
import { clipDurationUs, type TimelineClip, type TimelineProject } from "@/core/timeline/types";
import {
	applyClipGesture,
	beginTimelineDrag,
	CLIP_DRAG_TYPE,
	type ClipGesture,
	endTimelineDrag,
	pixelsToTime,
	snapTimelineTimeWithDetails,
	timeToPixels,
} from "./timelineInteractions";

interface Props {
	project: TimelineProject;
	clip: TimelineClip;
	selected: boolean;
	selection?: string[];
	scale: number;
	playheadUs: number;
	locked: boolean;
	onCommand: (command: ProjectCommand) => void;
	onSelect: (ids: string[]) => void;
	onOpenRecording: (id: string) => void;
	snappingEnabled?: boolean;
	onSnapChange?: (timeUs: number | null) => void;
}
export function TimelineClipItem({
	project,
	clip,
	selected,
	selection,
	scale,
	playheadUs,
	locked,
	onCommand,
	onSelect,
	onOpenRecording,
	snappingEnabled = true,
	onSnapChange,
}: Props) {
	const asset = resolveClipSource(project, clip),
		label = asset.name;
	const [preview, setPreview] = useState<TimelineClip | null>(null);
	const gesture = useRef<{ startX: number; kind: ClipGesture["kind"]; deltaUs: number } | null>(
		null,
	);
	const shown = preview ?? clip;
	const begin = (event: PointerEvent<HTMLSpanElement>, kind: ClipGesture["kind"]) => {
		event.preventDefault();
		event.stopPropagation();
		if (locked) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		onSelect(relatedClipIds(project,[clip.id]));
		gesture.current = { startX: event.clientX, kind, deltaUs: 0 };
	};
	const move = (event: PointerEvent<HTMLSpanElement>) => {
		const current = gesture.current;
		if (!current) return;
		const isTrimOut = current.kind === "trim-out";
		const edge = isTrimOut ? clip.startUs + clipDurationUs(clip) : clip.startUs;
		const rawTargetTime = edge + pixelsToTime(event.clientX - current.startX, scale);
		const snapDetails = snapTimelineTimeWithDetails(rawTargetTime, project, playheadUs, scale, {
			excludedClipId: clip.id,
			enabled: snappingEnabled,
		});
		current.deltaUs = snapDetails.timeUs - edge;
		onSnapChange?.(snapDetails.snapped ? (snapDetails.snapPointUs ?? null) : null);
		try {
			const p = applyClipGesture(project, clip.id, current);
			setPreview(p.tracks.flatMap((t) => t.clips).find((c) => c.id === clip.id)!);
		} catch {
			setPreview(null);
		}
	};
	const end = (event: PointerEvent<HTMLSpanElement>) => {
		event.stopPropagation();
		const current = gesture.current;
		gesture.current = null;
		setPreview(null);
		onSnapChange?.(null);
		if (current?.deltaUs) onCommand((p) => applyClipGesture(p, clip.id, current));
	};
	const clipWidthPx = Math.max(2, timeToPixels(clipDurationUs(shown), scale));
	return (
		<div
			role="button"
			tabIndex={0}
			aria-label={`${label}, ${(shown.startUs / 1_000_000).toFixed(2)} seconds`}
			aria-pressed={selected}
			className={`project-clip ${asset.kind} ${selected ? "selected" : ""} ${locked ? "locked" : ""}`}
			style={{
				left: timeToPixels(shown.startUs, scale),
				width: clipWidthPx,
			}}
			draggable={!locked}
			onDragStart={(event) => {
				const rect = event.currentTarget.getBoundingClientRect(),
					pointerOffsetPx = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
				beginTimelineDrag({
					type: "clip",
					id: clip.id,
					durationUs: clipDurationUs(clip),
					mediaKind: asset.kind === "audio" || clip.audioOnly ? "audio" : "visual",
					pointerOffsetPx,
				});
				event.currentTarget.classList.add("dragging");
				event.dataTransfer.setData(CLIP_DRAG_TYPE, clip.id);
				event.dataTransfer.effectAllowed = "move";
			}}
			onDragEnd={(event) => {
				event.currentTarget.classList.remove("dragging");
				endTimelineDrag(clip.id);
			}}
			onClick={(event) => {
				event.stopPropagation();
				if (event.shiftKey || event.ctrlKey || event.metaKey) {
					const currentSelection = selection ?? (selected ? [clip.id] : []);
					const related = relatedClipIds(project,[clip.id]);
					if (currentSelection.includes(clip.id)) {
						onSelect(currentSelection.filter((id) => !related.includes(id)));
					} else {
						onSelect([...new Set([...currentSelection, ...related])]);
					}
				} else {
					onSelect(relatedClipIds(project,[clip.id]));
				}
			}}
			onKeyDown={(event) => {
				if (event.key === "Enter") {
					event.stopPropagation();
					onSelect([clip.id]);
					if (asset.kind === "recording") onOpenRecording(clip.id);
				}
			}}
			onDoubleClick={() => {
				if (asset.kind === "recording") onOpenRecording(clip.id);
			}}
		>
			{asset.kind === "audio" && asset.media?.source?.path && <TimelineAudioPreview path={asset.media.source.path} clip={shown} scale={scale} width={clipWidthPx}/>}
			{!clip.audioOnly && (asset.kind === "video" || asset.kind === "recording") && <TimelineFilmstrip project={project} clip={shown} width={clipWidthPx}/>}
			{clip.audioOnly && asset.media?.source?.path && <TimelineAudioPreview path={asset.media.source.path} clip={shown} scale={scale} width={clipWidthPx}/>}
			<span
				className="project-trim-handle left"
				role="slider"
				aria-label="Trim clip start"
				aria-valuemin={0}
				aria-valuemax={clip.sourceOutUs / 1_000_000}
				aria-valuenow={clip.sourceInUs / 1_000_000}
				onPointerDown={(e) => begin(e, "trim-in")}
				onPointerMove={move}
				onPointerUp={end}
				onPointerCancel={() => {
					gesture.current = null;
					setPreview(null);
					onSnapChange?.(null);
				}}
			/>
			<span className="project-clip-label">
				{asset.kind === "recording" ? <span className="project-record-dot" /> : null}
				{label}
			</span>
			<span className="project-clip-details">
				{(clipDurationUs(shown) / 1_000_000).toFixed(1)}s
				{shown.rate !== 1 ? ` · ${shown.rate}×` : ""}
			</span>
			{shown.keyframes && shown.keyframes.length > 0 && (
				<div className="project-clip-keyframes" aria-hidden="true">
					{shown.keyframes.map((kf) => (
						<span
							key={kf.id}
							className="project-clip-kf-marker"
							style={{ left: timeToPixels((kf.timeMs * 1000) / shown.rate, scale) }}
							title={`${kf.property} at ${(kf.timeMs / 1000).toFixed(2)}s`}
						/>
					))}
				</div>
			)}
			<span
				className="project-trim-handle right"
				role="slider"
				aria-label="Trim clip end"
				aria-valuemin={clip.sourceInUs / 1_000_000}
				aria-valuemax={
					(project.compositions.find((c) => c.id === clip.compositionId)?.durationUs ??
						asset.durationUs) / 1_000_000
				}
				aria-valuenow={clip.sourceOutUs / 1_000_000}
				onPointerDown={(e) => begin(e, "trim-out")}
				onPointerMove={move}
				onPointerUp={end}
				onPointerCancel={() => {
					gesture.current = null;
					setPreview(null);
					onSnapChange?.(null);
				}}
			/>
		</div>
	);
}
