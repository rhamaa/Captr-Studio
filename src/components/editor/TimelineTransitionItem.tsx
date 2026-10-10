import { useRef, useState } from "react";
import { updateClipTransition } from "@/core/timeline/clipTransitions";
import type { ClipTransition } from "@/core/timeline/types";
import type { ProjectCommand } from "@/core/timeline/history";
import { useProjectMessages } from "./useProjectMessages";
import { timeToPixels } from "./timelineInteractions";

type ResizeEdge = "left" | "right";

export function transitionDurationFromDrag(
	initialDurationUs: number,
	edge: ResizeEdge,
	pointerDeltaPx: number,
	scalePxPerSecond: number,
	maximumDurationUs: number,
	snappingEnabled: boolean,
) {
	if (!Number.isFinite(scalePxPerSecond) || scalePxPerSecond <= 0) return initialDurationUs;
	const deltaUs = Math.round((pointerDeltaPx / scalePxPerSecond) * 1_000_000);
	let durationUs = initialDurationUs + (edge === "right" ? 2 : -2) * deltaUs;
	if (snappingEnabled) durationUs = Math.round(durationUs / 50_000) * 50_000;
	const minimumUs = Math.min(100_000, maximumDurationUs);
	return Math.max(minimumUs, Math.min(maximumDurationUs, durationUs));
}

export function TimelineTransitionItem({
	transition,
	boundaryUs,
	maximumDurationUs,
	scale,
	selected,
	locked,
	snappingEnabled,
	onSelect,
	onCommand,
}: {
	transition: ClipTransition;
	boundaryUs: number;
	maximumDurationUs: number;
	scale: number;
	selected: boolean;
	locked: boolean;
	snappingEnabled: boolean;
	onSelect: () => void;
	onCommand: (command: ProjectCommand) => void;
}) {
	const m = useProjectMessages();
	const drag = useRef<{ edge: ResizeEdge; startX: number; durationUs: number } | null>(null);
	const [previewDurationUs, setPreviewDurationUs] = useState<number | null>(null);
	const durationUs = previewDurationUs ?? transition.durationUs;
	const presetKey = transition.preset.kind === "fade-through"
		? transition.preset.color === "white" ? "transitionFadeThroughWhite" : "transitionFadeThroughBlack"
		: transition.preset.kind === "wipe" ? "transitionWipe"
			: transition.preset.kind === "push" ? "transitionPush" : "transitionCrossDissolve";
	const begin = (edge: ResizeEdge, event: React.PointerEvent<HTMLSpanElement>) => {
		event.preventDefault();
		event.stopPropagation();
		if (locked) return;
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = { edge, startX: event.clientX, durationUs };
	};
	const move = (event: React.PointerEvent<HTMLSpanElement>) => {
		const active = drag.current;
		if (!active || event.buttons !== 1) return;
		setPreviewDurationUs(transitionDurationFromDrag(
			active.durationUs, active.edge, event.clientX - active.startX, scale,
			maximumDurationUs, snappingEnabled && !event.shiftKey,
		));
	};
	const end = (event: React.PointerEvent<HTMLSpanElement>) => {
		const active = drag.current;
		if (!active) return;
		event.stopPropagation();
		const nextDuration = transitionDurationFromDrag(
			active.durationUs, active.edge, event.clientX - active.startX, scale,
			maximumDurationUs, snappingEnabled && !event.shiftKey,
		);
		drag.current = null;
		setPreviewDurationUs(null);
		if (nextDuration !== transition.durationUs)
			onCommand((project) => updateClipTransition(project, transition.id, { durationUs: nextDuration }));
	};
	const left = timeToPixels(boundaryUs - durationUs / 2, scale);
	const width = Math.max(16, timeToPixels(durationUs, scale));
	return (
		<div
		className={["project-transition-item", selected && "selected", locked && "locked"].filter(Boolean).join(" ")}
			data-transition-id={transition.id}
			style={{ left, width }}
			role="button"
			tabIndex={0}
			aria-pressed={selected}
			aria-label={`${m(presetKey)} ${m("transition").toLowerCase()}`}
			title={`${m(presetKey)} · ${(durationUs / 1_000_000).toFixed(2)}s`}
			onClick={(event) => { event.stopPropagation(); onSelect(); }}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(); }
			}}
		>
			<span
				className="project-transition-handle left"
				aria-hidden="true"
				onPointerDown={(event) => begin("left", event)}
				onPointerMove={move}
				onPointerUp={end}
				onPointerCancel={() => { drag.current = null; setPreviewDurationUs(null); }}
			/>
			<span className="project-transition-label">{m(presetKey)}</span>
			<span className="project-transition-duration">{(durationUs / 1_000_000).toFixed(2)}s</span>
			<span
				className="project-transition-handle right"
				aria-hidden="true"
				onPointerDown={(event) => begin("right", event)}
				onPointerMove={move}
				onPointerUp={end}
				onPointerCancel={() => { drag.current = null; setPreviewDurationUs(null); }}
			/>
		</div>
	);
}
