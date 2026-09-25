import React, { useEffect, useRef, useState } from "react";
import { SlideVoiceoverBar } from "@/core/audio/SlideVoiceoverBar";
import { useSlideAudioRecorder } from "@/core/audio/useSlideAudioRecorder";
import type { SlideWorkspaceProps } from "@/core/slides/types";
import type { AudioTrackItem, VideoClipItem, VideoSlideMeta } from "../schema";
import { VideoClipInspector } from "./VideoClipInspector";
import { VideoMediaPool } from "./VideoMediaPool";
import { VideoPlaybackControls } from "./VideoPlaybackControls";
import { VideoPreviewMonitor } from "./VideoPreviewMonitor";
import { VideoTimelineTracks } from "./VideoTimelineTracks";

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
				audio = new Audio(track.sourcePath);
				audio.preload = "auto";
				existingMap.set(track.id, audio);
			} else if (audio.src !== track.sourcePath) {
				audio.src = track.sourcePath;
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

	// Playhead loop for synchronized multi-track playback
	useEffect(() => {
		if (!isPlaying) {
			if (playheadRafRef.current) {
				cancelAnimationFrame(playheadRafRef.current);
				playheadRafRef.current = null;
			}
			return;
		}

		lastEpochRef.current = performance.now();

		const step = (now: number) => {
			const delta = now - lastEpochRef.current;
			lastEpochRef.current = now;

			setCurrentTimeMs((prev) => {
				const next = prev + delta;
				if (next >= slide.durationMs) {
					setIsPlaying(false);
					return slide.durationMs;
				}
				return next;
			});

			playheadRafRef.current = requestAnimationFrame(step);
		};

		playheadRafRef.current = requestAnimationFrame(step);

		return () => {
			if (playheadRafRef.current) {
				cancelAnimationFrame(playheadRafRef.current);
				playheadRafRef.current = null;
			}
		};
	}, [isPlaying, slide.durationMs]);

	const togglePlayPause = () => {
		if (isPlaying) {
			setIsPlaying(false);
			if (videoRef.current) {
				videoRef.current.pause();
			}
		} else {
			if (currentTimeMs >= slide.durationMs) {
				setCurrentTimeMs(0);
				if (videoRef.current) {
					videoRef.current.currentTime = 0;
				}
			}
			setIsPlaying(true);
			if (videoRef.current) {
				videoRef.current.play().catch(() => undefined);
			}
		}
	};

	const handleRewind = () => {
		setCurrentTimeMs(0);
		if (videoRef.current) {
			videoRef.current.currentTime = 0;
		}
	};

	const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
		const trackEl = timelineTrackRef.current;
		if (!trackEl) return;

		const rect = trackEl.getBoundingClientRect();
		const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
		const ratio = clickX / rect.width;
		const targetMs = Math.round(ratio * slide.durationMs);

		setCurrentTimeMs(targetMs);
		if (videoRef.current) {
			videoRef.current.currentTime = targetMs / 1000;
		}
	};

	const handleAddSampleClip = (trackId: string) => {
		const newClip: VideoClipItem = {
			id: `clip-${Date.now()}`,
			title: `Clip ${meta.videoTracks.flatMap((t) => t.clips).length + 1}`,
			sourcePath: "",
			startOffsetMs: currentTimeMs,
			durationMs: Math.min(3000, slide.durationMs - currentTimeMs),
			inPointMs: 0,
			outPointMs: 3000,
			speed: 1,
			volume: 1,
			opacity: 1,
		};

		onUpdateMeta((prev) => ({
			...prev,
			videoTracks: prev.videoTracks.map((tr) =>
				tr.id === trackId ? { ...tr, clips: [...tr.clips, newClip] } : tr,
			),
		}));
	};

	const handleDeleteClip = (trackId: string, clipId: string) => {
		onUpdateMeta((prev) => ({
			...prev,
			videoTracks: prev.videoTracks.map((tr) =>
				tr.id === trackId ? { ...tr, clips: tr.clips.filter((c) => c.id !== clipId) } : tr,
			),
		}));
		if (selectedClipId === clipId) {
			setSelectedClipId(null);
		}
	};

	const handleDeleteAudioTrack = (trackId: string) => {
		onUpdateMeta((prev) => ({
			...prev,
			audioTracks: (prev.audioTracks || []).filter((a) => a.id !== trackId),
		}));
	};

	return (
		<div className="flex h-full w-full flex-col bg-slate-950 text-slate-200 select-none overflow-hidden">
			{/* Top Panel: Media Pool + Preview Monitor + Inspector */}
			<div className="flex flex-1 overflow-hidden border-b border-slate-800">
				<VideoMediaPool mediaPool={meta.mediaPool} />

				<VideoPreviewMonitor
					videoRef={videoRef}
					previewVideoSrc={previewVideoSrc}
					isAudioMuted={isAudioMuted}
					isRecording={recorder.isRecording}
					currentTimeMs={currentTimeMs}
					durationMs={slide.durationMs}
					canvasDimensions={canvasDimensions}
				/>

				<VideoClipInspector
					title={slide.title}
					durationMs={slide.durationMs}
					audioTracksCount={(meta.audioTracks || []).length}
					onUpdateTitle={onUpdateTitle}
				/>
			</div>

			{/* Middle: Integrated Voiceover Bar */}
			<div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950 shrink-0">
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
			<div className="flex h-60 flex-col bg-slate-900/90 backdrop-blur shrink-0">
				<VideoPlaybackControls
					isPlaying={isPlaying}
					isRecording={recorder.isRecording}
					isAudioMuted={isAudioMuted}
					currentTimeMs={currentTimeMs}
					slideDurationMs={slide.durationMs}
					onTogglePlay={togglePlayPause}
					onRewind={handleRewind}
					onToggleMute={() => setIsAudioMuted((m) => !m)}
					onAddClip={() => handleAddSampleClip("track-v1")}
				/>

				<VideoTimelineTracks
					videoTracks={meta.videoTracks}
					audioTracks={meta.audioTracks || []}
					slideDurationMs={slide.durationMs}
					currentTimeMs={currentTimeMs}
					selectedClipId={selectedClipId}
					timelineTrackRef={timelineTrackRef}
					onTimelineClick={handleTimelineClick}
					onSelectClip={setSelectedClipId}
					onDeleteClip={handleDeleteClip}
					onAddSampleClip={handleAddSampleClip}
					onDeleteAudioTrack={handleDeleteAudioTrack}
				/>
			</div>
		</div>
	);
};
