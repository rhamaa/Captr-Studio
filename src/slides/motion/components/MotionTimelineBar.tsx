import { Pause, Play, Repeat, Rewind } from "@phosphor-icons/react";
import React from "react";

function formatTime(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	const tenths = Math.floor((ms % 1000) / 100);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

interface MotionTimelineBarProps {
	currentTimeMs: number;
	durationMs: number;
	isPlaying: boolean;
	isLoop: boolean;
	onSeek: (timeMs: number) => void;
	onTogglePlay: () => void;
	onRewind: () => void;
	onToggleLoop: () => void;
	onChangeDuration: (durationMs: number) => void;
}

export const MotionTimelineBar: React.FC<MotionTimelineBarProps> = ({
	currentTimeMs,
	durationMs,
	isPlaying,
	isLoop,
	onSeek,
	onTogglePlay,
	onRewind,
	onToggleLoop,
	onChangeDuration,
}) => {
	return (
		<div className="flex flex-col gap-2 border-t border-slate-800 bg-slate-900/90 px-4 py-2.5 backdrop-blur select-none">
			{/* Progress Scrubber Slider */}
			<div className="flex items-center gap-3">
				<span className="w-16 text-right font-mono text-xs font-semibold text-amber-400">
					{formatTime(currentTimeMs)}
				</span>
				<input
					type="range"
					min={0}
					max={durationMs}
					value={currentTimeMs}
					onChange={(e) => onSeek(Number(e.target.value))}
					className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-700 accent-amber-500"
				/>
				<span className="w-16 font-mono text-xs text-slate-400">
					{formatTime(durationMs)}
				</span>
			</div>

			{/* Playback Controls & Duration Editor */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onRewind}
						title="Rewind ke awal"
						className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800 text-slate-300 hover:bg-slate-700 transition cursor-pointer"
					>
						<Rewind size={15} weight="bold" />
					</button>

					<button
						type="button"
						onClick={onTogglePlay}
						className="flex h-8 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-xs font-semibold text-slate-950 shadow-md hover:bg-amber-400 transition cursor-pointer"
					>
						{isPlaying ? (
							<>
								<Pause size={14} weight="fill" />
								<span>Pause</span>
							</>
						) : (
							<>
								<Play size={14} weight="fill" />
								<span>Play</span>
							</>
						)}
					</button>

					<button
						type="button"
						onClick={onToggleLoop}
						title={isLoop ? "Loop Aktif" : "Loop Non-aktif"}
						className={`flex h-8 w-8 items-center justify-center rounded-lg border transition cursor-pointer ${
							isLoop
								? "border-amber-500/40 bg-amber-500/10 text-amber-400"
								: "border-slate-700/60 bg-slate-800 text-slate-400 hover:text-slate-200"
						}`}
					>
						<Repeat size={14} weight="bold" />
					</button>
				</div>

				{/* Duration Setting */}
				<div className="flex items-center gap-2 text-xs text-slate-300">
					<span className="text-[11px] text-slate-400">Durasi Slide:</span>
					<select
						value={durationMs}
						onChange={(e) => onChangeDuration(Number(e.target.value))}
						className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-amber-500 focus:outline-none cursor-pointer"
					>
						<option value={3000}>3 Detik</option>
						<option value={5000}>5 Detik (Default)</option>
						<option value={8000}>8 Detik</option>
						<option value={10000}>10 Detik</option>
						<option value={15000}>15 Detik</option>
						<option value={20000}>20 Detik</option>
					</select>
				</div>
			</div>
		</div>
	);
};
