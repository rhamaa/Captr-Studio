import {
	Plus,
	SlidersHorizontal,
} from "@phosphor-icons/react";
import { addTrack } from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";
import { projectDurationUs, type TimelineProject } from "@/core/timeline/types";

interface CanvasProjectInspectorProps {
	project: TimelineProject;
	onCommand: (command: ProjectCommand) => void;
}

export function CanvasProjectInspector({ project, onCommand }: CanvasProjectInspectorProps) {
	const totalClips = project.tracks.reduce((acc, t) => acc + t.clips.length, 0);
	const durationSec = (projectDurationUs(project) / 1_000_000).toFixed(2);
	const visualTracks = project.tracks.filter((t) => t.kind === "visual").length;
	const audioTracks = project.tracks.filter((t) => t.kind === "audio").length;

	return (
		<div className="project-canvas-inspector">
			{/* Canvas Header */}
			<div className="project-inspector-title">
				<strong>Story Canvas</strong>
				<span>
					{project.canvas.width} × {project.canvas.height}
				</span>
			</div>

			{/* Story Statistics */}
			<div className="project-inspector-section">
				<div className="flex items-center gap-1.5 mb-1 text-white/90 font-medium text-[11px]">
					<SlidersHorizontal size={14} className="text-primary" />
					<span>Story Statistics</span>
				</div>
				<div className="grid grid-cols-2 gap-2">
					<div className="project-stat-badge">
						<span>Duration</span>
						<span>{durationSec}s</span>
					</div>
					<div className="project-stat-badge">
						<span>Total Clips</span>
						<span>{totalClips}</span>
					</div>
					<div className="project-stat-badge">
						<span>Video Tracks</span>
						<span>{visualTracks}</span>
					</div>
					<div className="project-stat-badge">
						<span>Audio Tracks</span>
						<span>{audioTracks}</span>
					</div>
				</div>
			</div>

			{/* Quick Track Actions */}
			<div className="project-inspector-section border-b-0">
				<span className="block text-[11px] text-zinc-400 mb-2">Quick Track Actions</span>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => onCommand((p) => addTrack(p, crypto.randomUUID(), "visual"))}
						className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/5 text-xs font-medium transition-colors"
					>
						<Plus size={13} />
						<span>+ Video Track</span>
					</button>
					<button
						type="button"
						onClick={() => onCommand((p) => addTrack(p, crypto.randomUUID(), "audio"))}
						className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/5 text-xs font-medium transition-colors"
					>
						<Plus size={13} />
						<span>+ Audio Track</span>
					</button>
				</div>
			</div>
		</div>
	);
}
