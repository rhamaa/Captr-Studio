import type { PointerEvent } from "react";
import { useMemo, useRef, useState } from "react";
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

function generateWaveformPath(
	seedStr: string,
	sourceInUs: number,
	rate: number,
	scale: number,
	widthPx: number,
	heightPx: number,
): string {
	let seed = 0;
	for (let i = 0; i < seedStr.length; i++) {
		seed = (seed * 31 + seedStr.charCodeAt(i)) & 0xffffffff;
	}
	const seedNorm = (Math.abs(seed) % 1000) / 1000;

	const barWidth = 2;
	const barGap = 1.5;
	const step = barWidth + barGap;
	const barCount = Math.floor(widthPx / step);
	if (barCount <= 0) return "";

	const centerY = heightPx / 2;
	const maxBarHeight = heightPx - 14;
	let path = "";

	for (let i = 0; i < barCount; i++) {
		const x = i * step;
		const clipTimeUs = (x / scale) * 1_000_000;
		const sourceTimeSec = (sourceInUs + clipTimeUs * rate) / 1_000_000;

		const f1 = Math.sin(sourceTimeSec * 14.3 + seedNorm * 10);
		const f2 = Math.sin(sourceTimeSec * 31.7 + seedNorm * 23);
		const f3 = Math.sin(sourceTimeSec * 6.9 + seedNorm * 5);
		const rhythm = (Math.sin(sourceTimeSec * 2.5) + 1) * 0.5;

		const rawAmp =
			(Math.abs(f1 * 0.5 + f2 * 0.3 + f3 * 0.2) * 0.8 + 0.15) * (0.35 + 0.65 * rhythm);
		const amp = Math.min(1, Math.max(0.1, rawAmp));
		const h = Math.max(3, Math.round(amp * maxBarHeight));
		const y = Math.round(centerY - h / 2);

		path += `M${x},${y}h${barWidth}v${h}h-${barWidth}Z `;
	}

	return path;
}

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
	const asset = project.assets.find((a) => a.id === clip.assetId)!,
		label =
			asset.kind === "text" ? (clip.text ?? asset.text)?.content || asset.name : asset.name;
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
		onSelect([clip.id]);
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
	const waveformPath = useMemo(() => {
		if (asset.kind !== "audio") return null;
		return generateWaveformPath(
			clip.assetId,
			shown.sourceInUs,
			shown.rate,
			scale,
			clipWidthPx,
			51,
		);
	}, [asset.kind, clip.assetId, shown.sourceInUs, shown.rate, scale, clipWidthPx]);
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
					mediaKind: asset.kind === "audio" ? "audio" : "visual",
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
					if (currentSelection.includes(clip.id)) {
						onSelect(currentSelection.filter((id) => id !== clip.id));
					} else {
						onSelect([...currentSelection, clip.id]);
					}
				} else {
					onSelect([clip.id]);
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
			{waveformPath && (
				<svg className="project-clip-waveform" aria-hidden="true">
					<path d={waveformPath} fill="currentColor" />
				</svg>
			)}
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
