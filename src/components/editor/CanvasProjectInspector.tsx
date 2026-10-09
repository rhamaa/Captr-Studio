import {
	Crop as AspectRatioIcon,
	FilmStrip,
	Plus,
	SlidersHorizontal,
} from "@phosphor-icons/react";
import { addTrack, updateProjectCanvas } from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";
import { projectDurationUs, type TimelineProject } from "@/core/timeline/types";

interface CanvasProjectInspectorProps {
	project: TimelineProject;
	onCommand: (command: ProjectCommand) => void;
}

const ASPECT_RATIO_PRESETS = [
	{ id: "16:9", label: "16:9 Landscape", width: 1920, height: 1080, sub: "YouTube / Video" },
	{ id: "9:16", label: "9:16 Vertical", width: 1080, height: 1920, sub: "TikTok / Reels" },
	{ id: "1:1", label: "1:1 Square", width: 1080, height: 1080, sub: "Square Post" },
	{ id: "4:5", label: "4:5 Portrait", width: 1080, height: 1350, sub: "Social Feed" },
	{ id: "21:9", label: "21:9 Ultrawide", width: 2560, height: 1080, sub: "Cinematic" },
] as const;

export function CanvasProjectInspector({ project, onCommand }: CanvasProjectInspectorProps) {
	const totalClips = project.tracks.reduce((acc, t) => acc + t.clips.length, 0);
	const durationSec = (projectDurationUs(project) / 1_000_000).toFixed(2);
	const visualTracks = project.tracks.filter((t) => t.kind === "visual").length;
	const audioTracks = project.tracks.filter((t) => t.kind === "audio").length;

	const currentAspect =
		ASPECT_RATIO_PRESETS.find(
			(p) => p.width === project.canvas.width && p.height === project.canvas.height,
		)?.id ?? "custom";

	return (
		<div className="project-canvas-inspector">
			{/* Canvas Header */}
			<div className="project-inspector-title">
				<strong>Story Canvas</strong>
				<span>
					{project.canvas.width} × {project.canvas.height}
				</span>
			</div>

			{/* Aspect Ratio Presets */}
			<div className="project-inspector-section">
				<div className="flex items-center gap-1.5 mb-1 text-white/90 font-medium text-[11px]">
					<AspectRatioIcon size={14} className="text-primary" />
					<span>Aspect Ratio Presets</span>
				</div>
				<div className="grid grid-cols-2 gap-1.5">
					{ASPECT_RATIO_PRESETS.map((preset) => (
						<button
							key={preset.id}
							type="button"
							className={`project-canvas-preset-btn ${currentAspect === preset.id ? "active" : ""}`}
							onClick={() =>
								onCommand((p) =>
									updateProjectCanvas(p, {
										width: preset.width,
										height: preset.height,
									}),
								)
							}
						>
							<span className="font-semibold text-white/95">{preset.label}</span>
							<span className="text-[10px] text-zinc-400 font-mono">
								{preset.width} × {preset.height}
							</span>
						</button>
					))}
				</div>
			</div>

			{/* Resolution & FPS Customization */}
			<div className="project-inspector-section">
				<div className="flex items-center gap-1.5 mb-1 text-white/90 font-medium text-[11px]">
					<FilmStrip size={14} className="text-primary" />
					<span>Resolution & Frame Rate</span>
				</div>
				<div className="grid grid-cols-3 gap-2">
					<div>
						<span className="block text-[10px] text-zinc-400 mb-1">Width</span>
						<input
							type="number"
							aria-label="Canvas width"
							min={200}
							max={7680}
							step={10}
							value={project.canvas.width}
							onChange={(e) => {
								const w = Number(e.target.value);
								if (w > 0) onCommand((p) => updateProjectCanvas(p, { width: w }));
							}}
							className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-primary"
						/>
					</div>
					<div>
						<span className="block text-[10px] text-zinc-400 mb-1">Height</span>
						<input
							type="number"
							aria-label="Canvas height"
							min={200}
							max={4320}
							step={10}
							value={project.canvas.height}
							onChange={(e) => {
								const h = Number(e.target.value);
								if (h > 0) onCommand((p) => updateProjectCanvas(p, { height: h }));
							}}
							className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-primary"
						/>
					</div>
					<div>
						<span className="block text-[10px] text-zinc-400 mb-1">FPS</span>
						<select
							aria-label="Canvas frame rate"
							value={project.canvas.fps}
							onChange={(e) =>
								onCommand((p) =>
									updateProjectCanvas(p, { fps: Number(e.target.value) }),
								)
							}
							className="w-full px-2 py-1.5 rounded-lg bg-[#14161c] border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-primary cursor-pointer"
						>
							<option value={24}>24 fps</option>
							<option value={30}>30 fps</option>
							<option value={60}>60 fps</option>
						</select>
					</div>
				</div>
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
