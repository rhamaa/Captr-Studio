import { Pause, Play, Plus, Rewind, SpeakerHigh, SpeakerSimpleSlash } from "@phosphor-icons/react";
import React from "react";

function formatTime(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	const tenths = Math.floor((ms % 1000) / 100);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

interface VideoPlaybackControlsProps {
	isPlaying: boolean;
	isRecording: boolean;
	isAudioMuted: boolean;
	currentTimeMs: number;
	slideDurationMs: number;
	onTogglePlay: () => void;
	onRewind: () => void;
	onToggleMute: () => void;
	onAddClip: () => void;
}

export const VideoPlaybackControls: React.FC<VideoPlaybackControlsProps> = ({
	isPlaying,
	isRecording,
	isAudioMuted,
	currentTimeMs,
	slideDurationMs,
	onTogglePlay,
	onRewind,
	onToggleMute,
	onAddClip,
}) => {
	return (
		<div className="flex items-center justify-between border-b border-slate-800 px-4 py-1.5 select-none">
			{/* Left: Playback controls */}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={onRewind}
					title="Rewind ke awal"
					className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
				>
					<Rewind size={15} />
				</button>
				<button
					type="button"
					onClick={onTogglePlay}
					disabled={isRecording}
					className="flex h-7 w-7 items-center justify-center rounded-full bg-[#A879F5] text-white shadow-sm hover:bg-[#b88ff8] disabled:opacity-50 transition cursor-pointer"
				>
					{isPlaying ? (
						<Pause size={13} weight="fill" />
					) : (
						<Play size={13} weight="fill" className="ml-0.5" />
					)}
				</button>
				<button
					type="button"
					onClick={onToggleMute}
					title={isAudioMuted ? "Unmute Audio" : "Mute Audio"}
					className={`rounded p-1 cursor-pointer transition ${
						isAudioMuted
							? "text-[#FF6B81] bg-[#FF6B81]/15"
							: "text-slate-400 hover:bg-slate-800 hover:text-white"
					}`}
				>
					{isAudioMuted ? <SpeakerSimpleSlash size={15} /> : <SpeakerHigh size={15} />}
				</button>
				<span className="font-mono text-xs font-semibold text-slate-200">
					{formatTime(currentTimeMs)}
				</span>
				<span className="text-[10px] text-slate-500 font-mono">
					/ {formatTime(slideDurationMs)}
				</span>
			</div>

			{/* Right: Timeline tools */}
			<div className="flex items-center gap-1.5">
				<button
					type="button"
					onClick={onAddClip}
					className="flex items-center gap-1 rounded bg-[#A879F5] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#b88ff8] transition cursor-pointer"
				>
					<Plus size={13} weight="bold" />
					<span>+ Clip</span>
				</button>
			</div>
		</div>
	);
};
