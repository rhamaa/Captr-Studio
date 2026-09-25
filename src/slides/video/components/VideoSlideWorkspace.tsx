import {
	FilmSlate,
	MusicNote,
	Pause,
	Play,
	Plus,
	Rewind,
	Scissors,
	SpeakerHigh,
	SpeakerSimpleSlash,
	TextT,
	Trash,
	UploadSimple,
	Waveform,
} from "@phosphor-icons/react";
import React, { useEffect, useRef, useState } from "react";
import { SlideVoiceoverBar } from "@/core/audio/SlideVoiceoverBar";
import { useSlideAudioRecorder } from "@/core/audio/useSlideAudioRecorder";
import type { SlideWorkspaceProps } from "@/core/slides/types";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";
import type { AudioTrackItem, VideoClipItem, VideoSlideMeta } from "../schema";

function formatTime(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	const tenths = Math.floor((ms % 1000) / 100);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

export const VideoSlideWorkspace: React.FC<SlideWorkspaceProps<VideoSlideMeta>> = ({
	slide,
	onUpdateMeta,
	onUpdateTitle,
	onUpdateDuration,
	canvasDimensions,
}) => {
	const meta = slide.meta;
	const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
	const [currentTimeMs, setCurrentTimeMs] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isAudioMuted, setIsAudioMuted] = useState(false);

	const videoRef = useRef<HTMLVideoElement | null>(null);
	const playheadRafRef = useRef<number | null>(null);
	const lastEpochRef = useRef<number>(0);
	const timelineTrackRef = useRef<HTMLDivElement | null>(null);

	// Find first video clip source for the preview monitor
	const primaryVideoClip = meta.videoTracks?.[0]?.clips?.[0];
	const previewVideoSrc = primaryVideoClip?.sourcePath || meta.mediaPool?.[0]?.path || "";

	// Audio Recorder Hook: Synchronizes playback with voiceover recording
	const recorder = useSlideAudioRecorder({
		slideId: slide.id,
		getCurrentTimeMs: () => currentTimeMs,
		onStartPlayback: () => {
			setIsPlaying(true);
			if (videoRef.current) {
				videoRef.current.currentTime = currentTimeMs / 1000;
				videoRef.current.play().catch(() => undefined);
			}
		},
		onPausePlayback: () => {
			setIsPlaying(false);
			if (videoRef.current) {
				videoRef.current.pause();
			}
		},
		onAudioClipRecorded: (clip) => {
			const newAudioTrackItem: AudioTrackItem = {
				id: `vo-${Date.now()}`,
				name: `Voiceover ${(clip.durationMs / 1000).toFixed(1)}s`,
				sourcePath: clip.filePath,
				startOffsetMs: clip.startOffsetMs,
				durationMs: clip.durationMs,
				volume: 1,
			};

			// Automatically expand slide duration if voiceover extends beyond current slide length
			const endMs = clip.startOffsetMs + clip.durationMs;
			if (endMs > slide.durationMs) {
				onUpdateDuration?.(endMs + 500);
			}

			onUpdateMeta((prev) => ({
				...prev,
				audioTracks: [...(prev.audioTracks || []), newAudioTrackItem],
			}));
		},
	});

	// Synchronize audio element instances with meta.audioTracks
	const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

	useEffect(() => {
		const existingMap = audioElementsRef.current;
		const tracks = meta.audioTracks || [];
		const currentIds = new Set(tracks.map((t) => t.id));

		for (const [id, audio] of existingMap.entries()) {
			if (!currentIds.has(id)) {
				audio.pause();
				audio.src = "";
				existingMap.delete(id);
			}
		}

		for (const track of tracks) {
			let audio = existingMap.get(track.id);
			if (!audio) {
				audio = new Audio();
				audio.preload = "auto";
				existingMap.set(track.id, audio);
				resolveMediaElementSource(track.sourcePath)
					.then((resolved) => {
						if (audio && resolved?.src) {
							audio.src = resolved.src;
						}
					})
					.catch(() => undefined);
			}
			audio.volume = isAudioMuted ? 0 : Math.max(0, Math.min(1, track.volume ?? 1));
		}
	}, [meta.audioTracks, isAudioMuted]);

	// Playback time sync for audio tracks
	useEffect(() => {
		const tracks = meta.audioTracks || [];
		const map = audioElementsRef.current;

		if (!isPlaying) {
			for (const audio of map.values()) {
				if (!audio.paused) {
					audio.pause();
				}
			}
			return;
		}

		for (const track of tracks) {
			const audio = map.get(track.id);
			if (!audio) continue;

			const startMs = track.startOffsetMs;
			const endMs = startMs + track.durationMs;

			if (currentTimeMs >= startMs && currentTimeMs < endMs) {
				const expectedTrackTimeSec = (currentTimeMs - startMs) / 1000;
				if (Math.abs(audio.currentTime - expectedTrackTimeSec) > 0.15) {
					audio.currentTime = expectedTrackTimeSec;
				}
				if (audio.paused) {
					audio.play().catch(() => undefined);
				}
			} else {
				if (!audio.paused) {
					audio.pause();
				}
			}
		}
	}, [isPlaying, currentTimeMs, meta.audioTracks]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			for (const audio of audioElementsRef.current.values()) {
				audio.pause();
				audio.src = "";
			}
			audioElementsRef.current.clear();
		};
	}, []);

	// Playhead tick when playing
	useEffect(() => {
		if (!isPlaying) {
			if (playheadRafRef.current) cancelAnimationFrame(playheadRafRef.current);
			return;
		}

		lastEpochRef.current = performance.now();
		const tick = (now: number) => {
			const delta = now - lastEpochRef.current;
			lastEpochRef.current = now;

			setCurrentTimeMs((prev) => {
				const next = prev + delta;
				if (next >= slide.durationMs) {
					if (recorder.isRecording) {
						recorder.stopRecording();
					}
					setIsPlaying(false);
					if (videoRef.current) videoRef.current.pause();
					return slide.durationMs;
				}
				return next;
			});

			playheadRafRef.current = requestAnimationFrame(tick);
		};

		playheadRafRef.current = requestAnimationFrame(tick);
		return () => {
			if (playheadRafRef.current) cancelAnimationFrame(playheadRafRef.current);
		};
	}, [isPlaying, slide.durationMs, recorder]);

	const togglePlayPause = () => {
		if (isPlaying) {
			setIsPlaying(false);
			if (videoRef.current) videoRef.current.pause();
		} else {
			if (currentTimeMs >= slide.durationMs) {
				setCurrentTimeMs(0);
				if (videoRef.current) videoRef.current.currentTime = 0;
			}
			setIsPlaying(true);
			if (videoRef.current) {
				videoRef.current.currentTime =
					(currentTimeMs >= slide.durationMs ? 0 : currentTimeMs) / 1000;
				videoRef.current.play().catch(() => undefined);
			}
		}
	};

	const handleRewind = () => {
		setCurrentTimeMs(0);
		if (videoRef.current) videoRef.current.currentTime = 0;
		for (const audio of audioElementsRef.current.values()) {
			audio.currentTime = 0;
		}
	};

	const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!timelineTrackRef.current || recorder.isRecording) return;
		const rect = timelineTrackRef.current.getBoundingClientRect();
		const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
		const ratio = clickX / rect.width;
		const targetMs = Math.round(ratio * slide.durationMs);
		setCurrentTimeMs(targetMs);
		if (videoRef.current) {
			videoRef.current.currentTime = targetMs / 1000;
		}
		for (const track of meta.audioTracks || []) {
			const audio = audioElementsRef.current.get(track.id);
			if (!audio) continue;
			const startMs = track.startOffsetMs;
			const endMs = startMs + track.durationMs;
			if (targetMs >= startMs && targetMs < endMs) {
				audio.currentTime = (targetMs - startMs) / 1000;
			} else {
				audio.pause();
			}
		}
	};

	const handleAddSampleClip = (trackId: string) => {
		const newClip: VideoClipItem = {
			id: `clip-${Date.now()}`,
			title: "Sample B-Roll Clip",
			sourcePath: previewVideoSrc,
			startOffsetMs: currentTimeMs,
			durationMs: 4000,
			speedMultiplier: 1,
			volume: 1,
		};

		onUpdateMeta((prev) => ({
			...prev,
			videoTracks: prev.videoTracks.map((track) =>
				track.id === trackId ? { ...track, clips: [...track.clips, newClip] } : track,
			),
		}));
	};

	const handleDeleteClip = (trackId: string, clipId: string) => {
		onUpdateMeta((prev) => ({
			...prev,
			videoTracks: prev.videoTracks.map((track) =>
				track.id === trackId
					? { ...track, clips: track.clips.filter((c) => c.id !== clipId) }
					: track,
			),
		}));
		if (selectedClipId === clipId) setSelectedClipId(null);
	};

	const handleDeleteAudioClip = (audioId: string) => {
		onUpdateMeta((prev) => ({
			...prev,
			audioTracks: (prev.audioTracks || []).filter((a) => a.id !== audioId),
		}));
	};

	const playheadPercent = Math.min(
		100,
		Math.max(0, (currentTimeMs / (slide.durationMs || 1000)) * 100),
	);

	return (
		<div className="flex h-full w-full flex-col bg-slate-950 text-slate-200 select-none">
			{/* Top Panel: Media Pool + Preview Monitor + Inspector */}
			<div className="flex flex-1 overflow-hidden border-b border-slate-800">
				{/* Left: Media Pool / Asset Pool */}
				<div className="flex w-72 flex-col border-r border-slate-800 bg-slate-900/60 p-3 backdrop-blur">
					<div className="flex items-center justify-between pb-2 border-b border-slate-800">
						<div className="flex items-center gap-1.5 text-xs font-semibold text-white">
							<FilmSlate size={16} className="text-blue-400" />
							<span>Media Pool</span>
						</div>
						<button
							type="button"
							className="flex items-center gap-1 rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400 hover:bg-blue-500/30"
						>
							<UploadSimple size={12} />
							<span>Import</span>
						</button>
					</div>

					{/* Asset list */}
					<div className="flex-1 overflow-y-auto py-2">
						{meta.mediaPool.length === 0 ? (
							<div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 p-4 text-center">
								<FilmSlate size={24} className="text-slate-600 mb-1" />
								<p className="text-[11px] text-slate-400">
									Tarik video atau audio ke sini
								</p>
							</div>
						) : (
							<div className="space-y-1.5">
								{meta.mediaPool.map((asset) => (
									<div
										key={asset.id}
										className="flex items-center justify-between rounded bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300"
									>
										<span className="truncate">{asset.name}</span>
										<span className="text-[10px] text-slate-500">
											{asset.type}
										</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Center: Synchronized Video Preview Monitor */}
				<div className="flex flex-1 flex-col items-center justify-center p-6 bg-slate-950/60 relative">
					<div
						className={`relative flex items-center justify-center overflow-hidden rounded-lg bg-black shadow-2xl border transition-colors ${
							recorder.isRecording
								? "border-rose-500 ring-2 ring-rose-500/40"
								: "border-slate-800"
						}`}
						style={{
							aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}`,
							maxHeight: "45vh",
							maxWidth: "65vw",
						}}
					>
						{previewVideoSrc ? (
							<video
								ref={videoRef}
								src={previewVideoSrc}
								className="h-full w-full object-contain"
								muted={isAudioMuted}
							/>
						) : (
							<div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
								<FilmSlate size={36} className="text-blue-400 opacity-60" />
								<span className="text-xs text-slate-400">
									Preview Video NLE ({canvasDimensions.width}x
									{canvasDimensions.height} @ {canvasDimensions.fps}fps)
								</span>
							</div>
						)}

						{/* Recording Banner Overlay */}
						{recorder.isRecording && (
							<div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-rose-950/90 border border-rose-500/60 px-3 py-1 shadow-lg backdrop-blur">
								<span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
								<span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">
									Recording Audio · {formatTime(currentTimeMs)}
								</span>
							</div>
						)}

						{/* Current Time Badge */}
						<div className="absolute bottom-3 right-3 rounded bg-slate-950/80 px-2 py-0.5 font-mono text-[11px] text-slate-300 border border-slate-800">
							{formatTime(currentTimeMs)} / {formatTime(slide.durationMs)}
						</div>
					</div>
				</div>

				{/* Right: Clip Inspector */}
				<div className="w-72 border-l border-slate-800 bg-slate-900/60 p-3 backdrop-blur">
					<div className="text-[10px] font-bold tracking-wider text-blue-400 uppercase mb-2">
						Slide & Clip Inspector
					</div>
					<input
						type="text"
						value={slide.title}
						onChange={(e) => onUpdateTitle?.(e.target.value)}
						className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-semibold text-white focus:border-blue-500 focus:outline-none mb-4"
					/>

					<div className="space-y-3">
						<div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
							<div className="text-[11px] font-semibold text-slate-300 mb-1">
								Durasi Slide
							</div>
							<div className="text-xs text-slate-400">
								{(slide.durationMs / 1000).toFixed(1)} detik
							</div>
						</div>
						<div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
							<div className="text-[11px] font-semibold text-slate-300 mb-1">
								Audio Voiceovers
							</div>
							<div className="text-xs text-slate-400">
								{(meta.audioTracks || []).length} audio clip aktif
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Middle: Integrated Voiceover Bar */}
			<div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950">
				<SlideVoiceoverBar
					isRecording={recorder.isRecording}
					countdown={recorder.countdown}
					audioLevel={recorder.audioLevel}
					recordingDurationMs={recorder.recordingDurationMs}
					startPlayheadMs={recorder.startPlayheadMs}
					currentTimeMs={currentTimeMs}
					availableDevices={recorder.availableDevices}
					selectedDeviceId={recorder.selectedDeviceId}
					onSelectDeviceId={recorder.setSelectedDeviceId}
					onStartRecord={() => recorder.startRecording(true)}
					onStopRecord={recorder.stopRecording}
					onCancelRecord={recorder.cancelRecording}
				/>
			</div>

			{/* Bottom Panel: CapCut Style Multi-Track Timeline */}
			<div className="flex h-60 flex-col bg-slate-900/90 backdrop-blur">
				{/* Timeline Action Header */}
				<div className="flex items-center justify-between border-b border-slate-800 px-4 py-1.5">
					{/* Left: Playback controls */}
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleRewind}
							title="Rewind ke awal"
							className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
						>
							<Rewind size={15} />
						</button>
						<button
							type="button"
							onClick={togglePlayPause}
							disabled={recorder.isRecording}
							className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
						>
							{isPlaying ? (
								<Pause size={13} weight="fill" />
							) : (
								<Play size={13} weight="fill" className="ml-0.5" />
							)}
						</button>
						<span className="font-mono text-xs font-semibold text-slate-200">
							{formatTime(currentTimeMs)}
						</span>
						<span className="text-[10px] text-slate-500 font-mono">
							/ {formatTime(slide.durationMs)}
						</span>
					</div>

					{/* Right: Timeline tools */}
					<div className="flex items-center gap-1.5">
						<button
							type="button"
							title="Split Clip at Playhead"
							className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700"
						>
							<Scissors size={13} />
							<span>Split</span>
						</button>
						<button
							type="button"
							onClick={() => handleAddSampleClip("track-v1")}
							className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-500"
						>
							<Plus size={13} weight="bold" />
							<span>+ Clip</span>
						</button>
					</div>
				</div>

				{/* Tracks Area with Interactive Scrubber & Needle */}
				<div className="relative flex-1 overflow-y-auto p-3 space-y-2">
					{/* Timeline Ruler */}
					<div
						ref={timelineTrackRef}
						onClick={handleTimelineClick}
						className="relative ml-40 h-4 w-auto cursor-pointer rounded bg-slate-950/40 border-b border-slate-800/80 flex items-center"
					>
						{[...Array(6)].map((_, i) => {
							const markerRatio = i / 5;
							const markerSec = ((markerRatio * slide.durationMs) / 1000).toFixed(0);
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
					{meta.videoTracks.map((track) => (
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
									onClick={() => handleAddSampleClip(track.id)}
									className="text-slate-400 hover:text-white"
									title="Add clip to track"
								>
									<Plus size={12} />
								</button>
							</div>

							{/* Track Lane */}
							<div
								onClick={handleTimelineClick}
								className="relative flex flex-1 items-center h-9 rounded bg-slate-950/80 px-2 border border-slate-800/80 overflow-hidden cursor-pointer"
							>
								{track.clips.length === 0 ? (
									<span className="text-[10px] text-slate-600 italic">
										Track kosong
									</span>
								) : (
									track.clips.map((clip) => {
										const isSelected = selectedClipId === clip.id;
										const leftPct =
											(clip.startOffsetMs / slide.durationMs) * 100;
										const widthPct = Math.max(
											8,
											(clip.durationMs / slide.durationMs) * 100,
										);

										return (
											<div
												key={clip.id}
												onClick={(e) => {
													e.stopPropagation();
													setSelectedClipId(clip.id);
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
														handleDeleteClip(track.id, clip.id);
													}}
													className="text-slate-400 hover:text-rose-400 ml-1"
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

					{/* Audio Track Lane (A1) with Recorded Voiceover Clips */}
					<div className="flex items-center gap-2">
						{/* Track Header */}
						<div className="flex w-36 items-center justify-between rounded bg-slate-800/90 px-2 py-2 text-xs font-medium text-slate-300 border border-slate-750 shrink-0">
							<div className="flex items-center gap-1.5 truncate">
								<MusicNote size={13} className="text-emerald-400 shrink-0" />
								<span className="truncate text-[11px]">Audio Track (A1)</span>
							</div>
							<button
								type="button"
								onClick={() => setIsAudioMuted(!isAudioMuted)}
								className="text-slate-400 hover:text-white"
								title={isAudioMuted ? "Unmute" : "Mute"}
							>
								{isAudioMuted ? (
									<SpeakerSimpleSlash size={12} className="text-rose-400" />
								) : (
									<SpeakerHigh size={12} />
								)}
							</button>
						</div>

						{/* Track Lane */}
						<div
							onClick={handleTimelineClick}
							className="relative flex flex-1 items-center h-9 rounded bg-slate-950/80 px-2 border border-slate-800/80 overflow-hidden cursor-pointer"
						>
							{(meta.audioTracks || []).length === 0 ? (
								<span className="text-[10px] text-slate-600 italic">
									Gunakan tombol &quot;Record Audio&quot; di atas untuk merekam
									voiceover tersinkronisasi
								</span>
							) : (
								meta.audioTracks.map((audio) => {
									const leftPct = (audio.startOffsetMs / slide.durationMs) * 100;
									const widthPct = Math.max(
										8,
										(audio.durationMs / slide.durationMs) * 100,
									);

									return (
										<div
											key={audio.id}
											onClick={(e) => e.stopPropagation()}
											className="absolute top-1 bottom-1 flex items-center justify-between rounded bg-emerald-950/90 text-emerald-200 border border-emerald-700/60 px-2 text-xs hover:bg-emerald-900/90 transition"
											style={{
												left: `${leftPct}%`,
												width: `${widthPct}%`,
											}}
										>
											<div className="flex items-center gap-1 truncate">
												<Waveform
													size={12}
													className="text-emerald-400 shrink-0"
												/>
												<span className="truncate text-[10px] font-medium">
													{audio.name}
												</span>
											</div>
											<button
												type="button"
												onClick={() => handleDeleteAudioClip(audio.id)}
												className="text-slate-400 hover:text-rose-400 ml-1"
												title="Hapus voiceover"
											>
												<Trash size={11} />
											</button>
										</div>
									);
								})
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
