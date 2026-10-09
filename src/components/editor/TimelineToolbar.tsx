import {
	ArrowLineLeft,
	ArrowsInLineHorizontal,
	Copy,
	Eye,
	LockKey as LockKeyhole,
	Magnet,
	Plus,
	Scissors,
	TextT,
	Trash as Trash2,
	MagnifyingGlassPlus as ZoomIn,
	MagnifyingGlassMinus as ZoomOut,
} from "@phosphor-icons/react";
import { addTrack, toggleClipEnabled } from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";
import type { TimelineProject } from "@/core/timeline/types";
import { findClipsAtPlayhead, timelineActionCommand } from "./timelineInteractions";

interface Props {
	project?: TimelineProject;
	selection: string[];
	playheadUs: number;
	onCommand: (command: ProjectCommand) => void;
	onAddText: () => void;
	scale: number;
	onScale: (scale: number) => void;
	onZoomToFit?: () => void;
	locked: boolean;
	snappingEnabled?: boolean;
	onToggleSnapping?: () => void;
}
export function TimelineToolbar({
	project,
	selection,
	playheadUs,
	onCommand,
	onAddText,
	scale,
	onScale,
	onZoomToFit,
	locked,
	snappingEnabled = true,
	onToggleSnapping,
}: Props) {
	const hasClipsUnderPlayhead = project
		? findClipsAtPlayhead(project, playheadUs).length > 0
		: false;
	const canSplit = !locked && (selection.length > 0 || hasClipsUnderPlayhead);
	const selectionDisabled = !selection.length || locked;
	return (
		<div className="project-timeline-toolbar">
			<button
				title={
					canSplit
						? selection.length > 0
							? "Split selected clip at playhead (S / C)"
							: "Split clip under playhead (S / C)"
						: "No clip under playhead to split"
				}
				aria-label="Split at playhead"
				disabled={!canSplit}
				onClick={() => onCommand(timelineActionCommand("split", selection, playheadUs))}
			>
				<Scissors size={17} />
			</button>
			<button
				title="Duplicate (Ctrl+D)"
				aria-label="Duplicate clip"
				disabled={selectionDisabled}
				onClick={() => onCommand(timelineActionCommand("duplicate", selection, playheadUs))}
			>
				<Copy size={17} />
			</button>
			<button
				title="Toggle clip enable / mute"
				aria-label="Toggle clip enable"
				disabled={selectionDisabled}
				onClick={() => {
					if (!selection.length) return;
					onCommand((p) =>
						selection.reduce((acc, id) => toggleClipEnabled(acc, id), p),
					);
				}}
			>
				<Eye size={17} />
			</button>
			<button
				title="Delete clip (Del / Backspace)"
				aria-label="Delete clip"
				disabled={selectionDisabled}
				onClick={() => onCommand(timelineActionCommand("delete", selection, playheadUs))}
			>
				<Trash2 size={17} />
			</button>
			<button
				title="Ripple delete (Shift+Del / Shift+Backspace)"
				aria-label="Ripple delete clip"
				disabled={selectionDisabled}
				onClick={() =>
					onCommand(timelineActionCommand("ripple-delete", selection, playheadUs))
				}
			>
				<ArrowLineLeft size={17} />
			</button>
			<span className="project-toolbar-separator" />
			<button
				title="Add video track"
				onClick={() => onCommand((p) => addTrack(p, crypto.randomUUID(), "visual"))}
			>
				<Plus size={15} />
				Video
			</button>
			<button title="Add text overlay (T)" aria-label="Add text overlay" onClick={onAddText}>
				<Plus size={15} />
				<TextT size={15} />
				Text
			</button>
			<button
				title="Add audio track"
				onClick={() => onCommand((p) => addTrack(p, crypto.randomUUID(), "audio"))}
			>
				<Plus size={15} />
				Audio
			</button>
			{locked && (
				<span className="project-muted">
					<LockKeyhole size={14} />
					Track locked
				</span>
			)}
			<span style={{ flex: 1 }} />
			{onToggleSnapping && (
				<button
					title={
						snappingEnabled
							? "Snap to clips & playhead: ON (N)"
							: "Snap to clips & playhead: OFF (N)"
					}
					aria-label="Toggle magnetic snapping"
					aria-pressed={snappingEnabled}
					className={snappingEnabled ? "active" : ""}
					onClick={onToggleSnapping}
				>
					<Magnet size={17} weight={snappingEnabled ? "fill" : "regular"} />
				</button>
			)}
			{onZoomToFit && (
				<button
					title="Zoom to fit timeline (Shift+Z)"
					aria-label="Zoom to fit timeline"
					onClick={onZoomToFit}
				>
					<ArrowsInLineHorizontal size={17} />
				</button>
			)}
			<button
				title="Zoom out timeline (Ctrl + -)"
				aria-label="Zoom out timeline"
				onClick={() => onScale(Math.max(8, scale / 1.3))}
			>
				<ZoomOut size={17} />
			</button>
			<input
				aria-label="Timeline zoom"
				type="range"
				min={8}
				max={250}
				value={scale}
				onChange={(e) => onScale(Number(e.target.value))}
			/>
			<button
				title="Zoom in timeline (Ctrl + =)"
				aria-label="Zoom in timeline"
				onClick={() => onScale(Math.min(250, scale * 1.3))}
			>
				<ZoomIn size={17} />
			</button>
		</div>
	);
}
