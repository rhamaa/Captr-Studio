import {
	FilmSlate,
	Gauge,
	Pause,
	Play,
	Plus,
	Rewind,
	Scissors,
	SpeakerHigh,
	SpeakerSimpleSlash,
	Trash,
} from "@phosphor-icons/react";
import React, { useMemo } from "react";
import type { AudioTrackItem, VideoTrack } from "../schema";
import { VideoTimelineTracks } from "./VideoTimelineTracks";

export interface VideoSlideTimelineProps {
	videoTracks: VideoTrack[];
	audioTracks?: AudioTrackItem[];
	slideDurationMs: number;
	currentTimeMs: number;
	isPlaying: boolean;
	isAudioMuted?: boolean;
	selectedClipId?: string | null;
	onSeek: (timeMs: number) => void;
	onTogglePlay: () => void;
	onRewind: () => void;
	onToggleMute?: () => void;
	onSelectClip?: (clipId: string | null) => void;
	onDeleteClip?: (trackId: string, clipId: string) => void;
	onSplitClip?: (trackId: string, clipId: string, splitTimeMs: number) => void;
	onTrimClip?: (
		trackId: string,
		clipId: string,
		newStartOffsetMs: number,
		newDurationMs: number,
	) => void;
	onAddClip?: (trackId?: string) => void;
	onDeleteAudioTrack?: (trackId: string) => void;
	onChangeClipSpeed?: (trackId: string, clipId: string, speed: number) => void;
	onChangeClipVolume?: (trackId: string, clipId: string, volume: number) => void;
	className?: string;
}

function formatTime(ms: number): string {
	const totalSec = Math.floor(Math.max(0, ms) / 1000);
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	const tenths = Math.floor((Math.max(0, ms) % 1000) / 100);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

export const VideoSlideTimeline: React.FC<VideoSlideTimelineProps> = ({
	videoTracks,
	audioTracks = [],
	slideDurationMs,
	currentTimeMs,
	isPlaying,
	isAudioMuted = false,
	selectedClipId = null,
	onSeek,
	onTogglePlay,
	onRewind,
	onToggleMute,
	onSelectClip,
	onDeleteClip,
	onSplitClip,
	onTrimClip,
	onAddClip,
	onDeleteAudioTrack,
	onChangeClipSpeed,
	className = "",
}) => {
	// Find currently selected clip and its track
	const selectedInfo = useMemo(() => {
		if (!selectedClipId) return null;
		for (const track of videoTracks) {
			const found = track.clips.find((c) => c.id === selectedClipId);
			if (found) return { track, clip: found };
		}
		return null;
	}, [videoTracks, selectedClipId]);

	// Clip under playhead that can be split
	const clipUnderPlayhead = useMemo(() => {
		// Prefer selected clip if under playhead, otherwise any clip under playhead
		if (selectedInfo) {
			const { clip, track } = selectedInfo;
			if (
				currentTimeMs > clip.startOffsetMs &&
				currentTimeMs < clip.startOffsetMs + clip.durationMs
			) {
				return { track, clip };
			}
		}
		for (const track of videoTracks) {
			for (const clip of track.clips) {
				if (
					currentTimeMs > clip.startOffsetMs &&
					currentTimeMs < clip.startOffsetMs + clip.durationMs
				) {
					return { track, clip };
				}
			}
		}
		return null;
	}, [videoTracks, selectedInfo, currentTimeMs]);

	const handleSplit = () => {
		if (!clipUnderPlayhead || !onSplitClip) return;
		onSplitClip(clipUnderPlayhead.track.id, clipUnderPlayhead.clip.id, currentTimeMs);
	};

	const handleDeleteSelected = () => {
		if (!selectedInfo || !onDeleteClip) return;
		onDeleteClip(selectedInfo.track.id, selectedInfo.clip.id);
	};

	return (
		<div
			className={`flex h-full w-full flex-col bg-slate-950/95 text-slate-200 border-t border-slate-800 select-none overflow-hidden ${className}`}
		>
			{/* Top NLE Toolbar */}
			<div className="flex h-10 items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-3 py-1 shrink-0 backdrop-blur">
				{/* Transport Controls */}
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onRewind}
						title="Rewind to start"
						className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
					>
						<Rewind size={15} />
					</button>

					<button
						type="button"
						onClick={onTogglePlay}
						className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-500 transition cursor-pointer"
						title={isPlaying ? "Pause" : "Play"}
					>
						{isPlaying ? (
							<Pause size={13} weight="fill" />
						) : (
							<Play size={13} weight="fill" className="ml-0.5" />
						)}
					</button>

					{onToggleMute && (
						<button
							type="button"
							onClick={onToggleMute}
							title={isAudioMuted ? "Unmute Audio" : "Mute Audio"}
							className={`rounded p-1 cursor-pointer transition ${
								isAudioMuted
									? "text-rose-400 bg-rose-950/40"
									: "text-slate-400 hover:bg-slate-800 hover:text-white"
							}`}
						>
							{isAudioMuted ? (
								<SpeakerSimpleSlash size={15} />
							) : (
								<SpeakerHigh size={15} />
							)}
						</button>
					)}

					<div className="flex items-center font-mono text-xs font-semibold text-slate-200 ml-1">
						<span>{formatTime(currentTimeMs)}</span>
						<span className="text-[10px] text-slate-500 ml-1 font-mono">
							/ {formatTime(slideDurationMs)}
						</span>
					</div>
				</div>

				{/* Editing Tools (Split, Speed, Delete, Add Clip) */}
				<div className="flex items-center gap-2">
					{/* Split Button */}
					<button
						type="button"
						onClick={handleSplit}
						disabled={!clipUnderPlayhead}
						className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
							clipUnderPlayhead
								? "bg-slate-800 text-white hover:bg-slate-700 border border-slate-700"
								: "bg-slate-900 text-slate-600 border border-slate-800 cursor-not-allowed"
						}`}
						title={
							clipUnderPlayhead
								? `Split "${clipUnderPlayhead.clip.title}" at playhead`
								: "Move playhead over a clip to split"
						}
					>
						<Scissors size={13} />
						<span>Split</span>
					</button>

					{/* Selected Clip Operations */}
					{selectedInfo && (
						<>
							<div className="h-4 w-px bg-slate-800" />

							{/* Speed Multiplier Pill */}
							{onChangeClipSpeed && (
								<div className="flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
									<Gauge size={12} className="text-slate-400" />
									<span className="text-slate-400 mr-0.5">Speed:</span>
									{[1, 1.25, 1.5, 2].map((s) => (
										<button
											key={s}
											type="button"
											onClick={() =>
												onChangeClipSpeed(
													selectedInfo.track.id,
													selectedInfo.clip.id,
													s,
												)
											}
											className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition cursor-pointer ${
												(selectedInfo.clip.speedMultiplier || 1) === s
													? "bg-blue-600 text-white font-semibold"
													: "text-slate-400 hover:text-white"
											}`}
										>
											{s}x
										</button>
									))}
								</div>
							)}

							{/* Delete Clip */}
							<button
								type="button"
								onClick={handleDeleteSelected}
								className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 bg-red-950/30 border border-red-900/40 hover:bg-red-900/50 hover:text-red-300 transition cursor-pointer"
								title={`Delete "${selectedInfo.clip.title}"`}
							>
								<Trash size={12} />
								<span>Hapus</span>
							</button>
						</>
					)}

					{/* Add Media / Clip */}
					{onAddClip && (
						<button
							type="button"
							onClick={() => onAddClip("track-v1")}
							className="flex items-center gap-1 rounded bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-500 shadow-sm transition cursor-pointer"
						>
							<Plus size={13} weight="bold" />
							<span>+ Clip</span>
						</button>
					)}
				</div>

				{/* Right Stats */}
				<div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
					<span className="flex items-center gap-1">
						<FilmSlate size={12} className="text-blue-400" />
						{videoTracks.length} Track Video
					</span>
					<span>•</span>
					<span>{audioTracks.length} Audio</span>
				</div>
			</div>

			{/* Multi-Track Lanes & Scrubber */}
			<VideoTimelineTracks
				videoTracks={videoTracks}
				audioTracks={audioTracks}
				slideDurationMs={slideDurationMs}
				currentTimeMs={currentTimeMs}
				selectedClipId={selectedClipId}
				onTimelineClick={() => {
					// Default click on empty lane selects null
					onSelectClip?.(null);
				}}
				onSeek={onSeek}
				onSelectClip={(id) => onSelectClip?.(id)}
				onDeleteClip={(trackId, clipId) => onDeleteClip?.(trackId, clipId)}
				onAddSampleClip={onAddClip}
				onDeleteAudioTrack={onDeleteAudioTrack}
				onTrimClip={onTrimClip}
			/>
		</div>
	);
};
