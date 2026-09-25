import {
	FilmSlate,
	MusicNote,
	Plus,
	Scissors,
	SpeakerHigh,
	SpeakerSimpleSlash,
	TextT,
	Trash,
	Waveform,
} from "@phosphor-icons/react";
import React from "react";
import type { AudioTrackItem, VideoSlideMeta, VideoTrackItem } from "../schema";

interface VideoTimelineTracksProps {
	videoTracks: VideoTrackItem[];
	audioTracks: AudioTrackItem[];
	slideDurationMs: number;
	currentTimeMs: number;
	selectedClipId: string | null;
	timelineTrackRef: React.RefObject<HTMLDivElement | null>;
	onTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void;
	onSelectClip: (clipId: string) => void;
	onDeleteClip: (trackId: string, clipId: string) => void;
	onAddSampleClip: (trackId: string) => void;
	onDeleteAudioTrack: (trackId: string) => void;
}

export const VideoTimelineTracks: React.FC<VideoTimelineTracksProps> = ({
	videoTracks,
	audioTracks,
	slideDurationMs,
	currentTimeMs,
	selectedClipId,
	timelineTrackRef,
	onTimelineClick,
	onSelectClip,
	onDeleteClip,
	onAddSampleClip,
	onDeleteAudioTrack,
}) => {
	const playheadPercent = Math.min(
		100,
		Math.max(0, (currentTimeMs / Math.max(1, slideDurationMs)) * 100),
	);

	return (
		<div className="relative flex-1 overflow-y-auto p-3 space-y-2 select-none">
			{/* Timeline Ruler */}
			<div
				ref={timelineTrackRef}
				onClick={onTimelineClick}
				className="relative ml-40 h-4 w-auto cursor-pointer rounded bg-slate-950/40 border-b border-slate-800/80 flex items-center"
			>
				{[...Array(6)].map((_, i) => {
					const markerRatio = i / 5;
					const markerSec = ((markerRatio * slideDurationMs) / 1000).toFixed(0);
					return (
						<div
							key={i}
							className="absolute top-0 bottom-0 flex flex-col justify-end text-[9px] font-mono text-slate-500"
							style={{ left: `${markerRatio * 100}%` }}
						>
							<span>{markerSec}s</span>
						</div>
					);
				})}

				{/* Playhead Scrubber Needle */}
				<div
					className="absolute top-0 bottom-[-160px] z-30 w-0.5 bg-rose-500 pointer-events-none"
					style={{ left: `${playheadPercent}%` }}
				>
					<div className="absolute -top-1 -left-1.5 h-3 w-3 rotate-45 bg-rose-500 rounded-sm shadow-md" />
				</div>
			</div>

			{/* Video Tracks */}
			{videoTracks.map((track) => (
				<div key={track.id} className="flex items-center gap-2">
					{/* Track Header */}
					<div className="flex w-36 items-center justify-between rounded bg-slate-800/90 px-2 py-2 text-xs font-medium text-slate-300 border border-slate-750 shrink-0">
						<div className="flex items-center gap-1.5 truncate">
							{track.type === "overlay" ? (
								<TextT size={13} className="text-purple-400 shrink-0" />
							) : (
								<FilmSlate size={13} className="text-blue-400 shrink-0" />
							)}
							<span className="truncate text-[11px]">{track.name}</span>
						</div>
						<button
							type="button"
							onClick={() => onAddSampleClip(track.id)}
							className="text-slate-400 hover:text-white cursor-pointer"
							title="Add clip to track"
						>
							<Plus size={12} />
						</button>
					</div>

					{/* Track Lane */}
					<div
						onClick={onTimelineClick}
						className="relative flex flex-1 items-center h-9 rounded bg-slate-950/80 px-2 border border-slate-800/80 overflow-hidden cursor-pointer"
					>
						{track.clips.length === 0 ? (
							<span className="text-[10px] text-slate-600 italic">Track kosong</span>
						) : (
							track.clips.map((clip) => {
								const isSelected = selectedClipId === clip.id;
								const leftPct =
									(clip.startOffsetMs / Math.max(1, slideDurationMs)) * 100;
								const widthPct = Math.max(
									8,
									(clip.durationMs / Math.max(1, slideDurationMs)) * 100,
								);

								return (
									<div
										key={clip.id}
										onClick={(e) => {
											e.stopPropagation();
											onSelectClip(clip.id);
										}}
										className={`absolute top-1 bottom-1 flex items-center justify-between rounded px-2 text-xs transition cursor-pointer ${
											isSelected
												? "bg-blue-600 text-white ring-1 ring-white/50"
												: "bg-blue-950/90 text-blue-200 border border-blue-800/60 hover:bg-blue-900/80"
										}`}
										style={{
											left: `${leftPct}%`,
											width: `${widthPct}%`,
										}}
									>
										<span className="truncate text-[10px] font-medium">
											{clip.title}
										</span>
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												onDeleteClip(track.id, clip.id);
											}}
											className="text-slate-400 hover:text-red-400 cursor-pointer ml-1"
											title="Delete clip"
										>
											<Trash size={11} />
										</button>
									</div>
								);
							})
						)}
					</div>
				</div>
			))}

			{/* Audio Tracks (Recorded Voiceover + BGM) */}
			{audioTracks.map((audio) => {
				const leftPct = (audio.startOffsetMs / Math.max(1, slideDurationMs)) * 100;
				const widthPct = Math.max(
					8,
					(audio.durationMs / Math.max(1, slideDurationMs)) * 100,
				);

				return (
					<div key={audio.id} className="flex items-center gap-2">
						{/* Track Header */}
						<div className="flex w-36 items-center justify-between rounded bg-emerald-950/40 border border-emerald-800/40 px-2 py-1.5 text-xs text-emerald-300 shrink-0">
							<div className="flex items-center gap-1.5 truncate">
								<Waveform size={13} className="text-emerald-400 shrink-0" />
								<span className="truncate text-[10px] font-medium">
									{audio.name}
								</span>
							</div>
							<button
								type="button"
								onClick={() => onDeleteAudioTrack(audio.id)}
								className="text-slate-500 hover:text-red-400 cursor-pointer"
								title="Delete audio track"
							>
								<Trash size={11} />
							</button>
						</div>

						{/* Audio Track Lane */}
						<div
							onClick={onTimelineClick}
							className="relative flex flex-1 items-center h-8 rounded bg-slate-950/80 px-2 border border-slate-800/60 overflow-hidden cursor-pointer"
						>
							<div
								className="absolute top-1 bottom-1 flex items-center justify-between rounded bg-emerald-900/60 border border-emerald-500/40 px-2 text-emerald-200"
								style={{
									left: `${leftPct}%`,
									width: `${widthPct}%`,
								}}
							>
								<div className="flex items-center gap-1 truncate text-[10px]">
									<MusicNote size={10} />
									<span className="truncate">{audio.name}</span>
								</div>
								<span className="text-[9px] font-mono text-emerald-400 shrink-0">
									{(audio.durationMs / 1000).toFixed(1)}s
								</span>
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
};
