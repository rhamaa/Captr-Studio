import { FilmSlate, MusicNote, Plus, TextT, Trash, Waveform } from "@phosphor-icons/react";
import React, { useCallback, useRef } from "react";
import type { AudioTrackItem, VideoClipItem, VideoTrack } from "../schema";

export interface VideoTimelineTracksProps {
	videoTracks: VideoTrack[];
	audioTracks: AudioTrackItem[];
	slideDurationMs: number;
	currentTimeMs: number;
	selectedClipId: string | null;
	timelineTrackRef?: React.RefObject<HTMLDivElement>;
	onTimelineClick: (e: React.MouseEvent<HTMLDivElement>) => void;
	onSeek?: (timeMs: number) => void;
	onSelectClip: (clipId: string | null) => void;
	onDeleteClip: (trackId: string, clipId: string) => void;
	onAddSampleClip?: (trackId: string) => void;
	onDeleteAudioTrack?: (trackId: string) => void;
	onTrimClip?: (
		trackId: string,
		clipId: string,
		newStartOffsetMs: number,
		newDurationMs: number,
	) => void;
}

export const VideoTimelineTracks: React.FC<VideoTimelineTracksProps> = ({
	videoTracks,
	audioTracks,
	slideDurationMs,
	currentTimeMs,
	selectedClipId,
	timelineTrackRef,
	onTimelineClick,
	onSeek,
	onSelectClip,
	onDeleteClip,
	onAddSampleClip,
	onDeleteAudioTrack,
	onTrimClip,
}) => {
	const localRulerRef = useRef<HTMLDivElement | null>(null);
	const activeRulerRef = timelineTrackRef || localRulerRef;
	const isScrubbingRef = useRef(false);

	const safeDurationMs = Math.max(100, slideDurationMs);
	const playheadPercent = Math.min(100, Math.max(0, (currentTimeMs / safeDurationMs) * 100));

	// Ruler scrubbing handler (smooth drag & seek)
	const handlePointerDownRuler = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const el = activeRulerRef.current;
			if (!el) return;
			isScrubbingRef.current = true;
			el.setPointerCapture(e.pointerId);

			const rect = el.getBoundingClientRect();
			const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
			const ratio = x / rect.width;
			const targetMs = Math.round(ratio * safeDurationMs);
			onSeek?.(targetMs);
		},
		[activeRulerRef, safeDurationMs, onSeek],
	);

	const handlePointerMoveRuler = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!isScrubbingRef.current) return;
			const el = activeRulerRef.current;
			if (!el) return;
			const rect = el.getBoundingClientRect();
			const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
			const ratio = x / rect.width;
			const targetMs = Math.round(ratio * safeDurationMs);
			onSeek?.(targetMs);
		},
		[activeRulerRef, safeDurationMs, onSeek],
	);

	const handlePointerUpRuler = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			if (!isScrubbingRef.current) return;
			isScrubbingRef.current = false;
			try {
				activeRulerRef.current?.releasePointerCapture(e.pointerId);
			} catch {
				// ignore
			}
		},
		[activeRulerRef],
	);

	// Trimming handle dragging
	const handleTrimDrag = useCallback(
		(
			e: React.PointerEvent<HTMLDivElement>,
			edge: "left" | "right",
			trackId: string,
			clip: VideoClipItem,
		) => {
			e.stopPropagation();
			e.preventDefault();
			const startX = e.clientX;
			const originalStart = clip.startOffsetMs;
			const originalDuration = clip.durationMs;
			const rulerEl = activeRulerRef.current;
			if (!rulerEl) return;
			const rulerWidth = rulerEl.getBoundingClientRect().width || 600;
			const msPerPx = safeDurationMs / rulerWidth;

			const onPointerMove = (moveEvt: PointerEvent) => {
				const deltaPx = moveEvt.clientX - startX;
				const deltaMs = Math.round(deltaPx * msPerPx);

				if (edge === "left") {
					const newStart = Math.max(
						0,
						Math.min(originalStart + originalDuration - 300, originalStart + deltaMs),
					);
					const newDuration = originalDuration - (newStart - originalStart);
					onTrimClip?.(trackId, clip.id, newStart, Math.max(300, newDuration));
				} else {
					const maxAllowedDuration = safeDurationMs - originalStart;
					const newDuration = Math.max(
						300,
						Math.min(maxAllowedDuration, originalDuration + deltaMs),
					);
					onTrimClip?.(trackId, clip.id, originalStart, newDuration);
				}
			};

			const onPointerUp = () => {
				window.removeEventListener("pointermove", onPointerMove);
				window.removeEventListener("pointerup", onPointerUp);
			};

			window.addEventListener("pointermove", onPointerMove);
			window.addEventListener("pointerup", onPointerUp);
		},
		[activeRulerRef, safeDurationMs, onTrimClip],
	);

	return (
		<div className="relative flex-1 overflow-y-auto p-3 space-y-2 select-none">
			{/* Timeline Ruler */}
			<div
				ref={activeRulerRef}
				onClick={onTimelineClick}
				onPointerDown={handlePointerDownRuler}
				onPointerMove={handlePointerMoveRuler}
				onPointerUp={handlePointerUpRuler}
				className="relative ml-40 h-5 w-auto cursor-col-resize rounded bg-slate-950/60 border-b border-slate-800 flex items-center shadow-inner"
			>
				{[...Array(6)].map((_, i) => {
					const markerRatio = i / 5;
					const markerSec = ((markerRatio * safeDurationMs) / 1000).toFixed(1);
					return (
						<div
							key={i}
							className="absolute top-0 bottom-0 flex flex-col justify-end text-[9px] font-mono text-slate-500 pointer-events-none"
							style={{ left: `${markerRatio * 100}%` }}
						>
							<div className="h-1.5 w-px bg-slate-700" />
							<span>{markerSec}s</span>
						</div>
					);
				})}

				{/* Playhead Scrubber Needle */}
				<div
					className="absolute top-0 bottom-[-220px] z-30 w-0.5 bg-rose-500 pointer-events-none"
					style={{ left: `${playheadPercent}%` }}
				>
					<div className="absolute -top-1 -left-1.5 h-3.5 w-3.5 rotate-45 bg-rose-500 rounded-sm shadow-md" />
				</div>
			</div>

			{/* Video Tracks */}
			{videoTracks.map((track) => (
				<div key={track.id} className="flex items-center gap-2">
					{/* Track Header */}
					<div className="flex w-36 items-center justify-between rounded bg-slate-900 px-2 py-2 text-xs font-medium text-slate-300 border border-slate-800 shrink-0 shadow-sm">
						<div className="flex items-center gap-1.5 truncate">
							{track.type === "overlay" ? (
								<TextT size={13} className="text-purple-400 shrink-0" />
							) : (
								<FilmSlate size={13} className="text-blue-400 shrink-0" />
							)}
							<span className="truncate text-[11px] font-semibold">{track.name}</span>
						</div>
						{onAddSampleClip && (
							<button
								type="button"
								onClick={() => onAddSampleClip(track.id)}
								className="text-slate-400 hover:text-white cursor-pointer rounded p-0.5 hover:bg-slate-800 transition"
								title="Add clip to track"
							>
								<Plus size={12} />
							</button>
						)}
					</div>

					{/* Track Lane */}
					<div
						onClick={onTimelineClick}
						className="relative flex flex-1 items-center h-10 rounded bg-slate-950/90 px-1 border border-slate-800/80 overflow-hidden cursor-pointer"
					>
						{track.clips.length === 0 ? (
							<span className="text-[10px] text-slate-600 italic px-2">
								Track kosong
							</span>
						) : (
							track.clips.map((clip) => {
								const isSelected = selectedClipId === clip.id;
								const leftPct =
									(clip.startOffsetMs / Math.max(1, safeDurationMs)) * 100;
								const widthPct = Math.max(
									4,
									(clip.durationMs / Math.max(1, safeDurationMs)) * 100,
								);

								return (
									<div
										key={clip.id}
										onClick={(e) => {
											e.stopPropagation();
											onSelectClip(clip.id);
										}}
										className={`group absolute top-1 bottom-1 flex items-center justify-between rounded px-1.5 text-xs transition cursor-pointer select-none shadow-sm ${
											isSelected
												? "bg-blue-600 text-white ring-2 ring-blue-300 z-20 shadow-blue-500/20"
												: "bg-blue-950/90 text-blue-200 border border-blue-800/60 hover:bg-blue-900/80 z-10"
										}`}
										style={{
											left: `${leftPct}%`,
											width: `${widthPct}%`,
										}}
									>
										{/* Left Trim Handle */}
										{onTrimClip && (
											<div
												onPointerDown={(e) =>
													handleTrimDrag(e, "left", track.id, clip)
												}
												className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 hover:bg-white/80 rounded-l transition-opacity"
												title="Drag to trim start"
											/>
										)}

										<span className="truncate text-[10px] font-semibold pl-1">
											{clip.title}
										</span>

										<div className="flex items-center gap-1">
											{clip.speedMultiplier && clip.speedMultiplier !== 1 && (
												<span className="text-[8px] bg-black/40 px-1 rounded font-mono text-blue-200">
													{clip.speedMultiplier}x
												</span>
											)}
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													onDeleteClip(track.id, clip.id);
												}}
												className="text-slate-400 hover:text-red-400 cursor-pointer ml-1 p-0.5 hover:bg-black/30 rounded"
												title="Delete clip"
											>
												<Trash size={11} />
											</button>
										</div>

										{/* Right Trim Handle */}
										{onTrimClip && (
											<div
												onPointerDown={(e) =>
													handleTrimDrag(e, "right", track.id, clip)
												}
												className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 bg-white/40 hover:bg-white/80 rounded-r transition-opacity"
												title="Drag to trim end"
											/>
										)}
									</div>
								);
							})
						)}
					</div>
				</div>
			))}

			{/* Audio Tracks (Recorded Voiceover + BGM) */}
			{audioTracks.map((audio) => {
				const leftPct = (audio.startOffsetMs / Math.max(1, safeDurationMs)) * 100;
				const widthPct = Math.max(
					4,
					(audio.durationMs / Math.max(1, safeDurationMs)) * 100,
				);

				return (
					<div key={audio.id} className="flex items-center gap-2">
						{/* Track Header */}
						<div className="flex w-36 items-center justify-between rounded bg-emerald-950/50 border border-emerald-800/40 px-2 py-1.5 text-xs text-emerald-300 shrink-0">
							<div className="flex items-center gap-1.5 truncate">
								<Waveform size={13} className="text-emerald-400 shrink-0" />
								<span className="truncate text-[10px] font-medium">
									{audio.name}
								</span>
							</div>
							{onDeleteAudioTrack && (
								<button
									type="button"
									onClick={() => onDeleteAudioTrack(audio.id)}
									className="text-slate-500 hover:text-red-400 cursor-pointer rounded p-0.5 hover:bg-emerald-900/40"
									title="Delete audio track"
								>
									<Trash size={11} />
								</button>
							)}
						</div>

						{/* Audio Track Lane */}
						<div
							onClick={onTimelineClick}
							className="relative flex flex-1 items-center h-8 rounded bg-slate-950/80 px-1 border border-slate-800/60 overflow-hidden cursor-pointer"
						>
							<div
								className="absolute top-1 bottom-1 flex items-center justify-between rounded bg-emerald-900/70 border border-emerald-500/50 px-2 text-emerald-200 shadow-sm"
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
