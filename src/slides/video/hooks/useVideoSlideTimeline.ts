import { useEffect, useRef, useState } from "react";
import type { VideoSlideMeta } from "../schema";

interface UseVideoSlideTimelineOptions {
	slideDurationMs: number;
	meta: VideoSlideMeta;
	onUpdateMeta: (updater: (prev: VideoSlideMeta) => VideoSlideMeta) => void;
}

export function useVideoSlideTimeline({
	slideDurationMs,
	meta,
	onUpdateMeta,
}: UseVideoSlideTimelineOptions) {
	const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
	const [currentTimeMs, setCurrentTimeMs] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isAudioMuted, setIsAudioMuted] = useState(false);

	const videoRef = useRef<HTMLVideoElement>(null);
	const playheadRafRef = useRef<number | null>(null);
	const lastEpochRef = useRef<number>(0);
	const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

	useEffect(() => {
		const existingMap = audioElementsRef.current;
		const tracks = meta.audioTracks || [];
		const currentIds = new Set(tracks.map((track) => track.id));

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

	useEffect(() => {
		const tracks = meta.audioTracks || [];
		const audioElements = audioElementsRef.current;

		if (!isPlaying) {
			for (const audio of audioElements.values()) {
				if (!audio.paused) audio.pause();
			}
			return;
		}

		for (const track of tracks) {
			const audio = audioElements.get(track.id);
			if (!audio) continue;

			const endMs = track.startOffsetMs + track.durationMs;
			if (currentTimeMs >= track.startOffsetMs && currentTimeMs < endMs) {
				const expectedTrackTimeSec = (currentTimeMs - track.startOffsetMs) / 1000;
				if (Math.abs(audio.currentTime - expectedTrackTimeSec) > 0.15) {
					audio.currentTime = expectedTrackTimeSec;
				}
				if (audio.paused) audio.play().catch(() => undefined);
			} else if (!audio.paused) {
				audio.pause();
			}
		}
	}, [isPlaying, currentTimeMs, meta.audioTracks]);

	useEffect(
		() => () => {
			for (const audio of audioElementsRef.current.values()) {
				audio.pause();
				audio.src = "";
			}
			audioElementsRef.current.clear();
		},
		[],
	);

	useEffect(() => {
		if (!isPlaying) {
			if (playheadRafRef.current !== null) {
				cancelAnimationFrame(playheadRafRef.current);
				playheadRafRef.current = null;
			}
			return;
		}

		lastEpochRef.current = performance.now();

		const step = (now: number) => {
			const delta = now - lastEpochRef.current;
			lastEpochRef.current = now;

			setCurrentTimeMs((previousTimeMs) => {
				const nextTimeMs = previousTimeMs + delta;
				if (nextTimeMs >= slideDurationMs) {
					setIsPlaying(false);
					return slideDurationMs;
				}
				return nextTimeMs;
			});

			playheadRafRef.current = requestAnimationFrame(step);
		};

		playheadRafRef.current = requestAnimationFrame(step);

		return () => {
			if (playheadRafRef.current !== null) {
				cancelAnimationFrame(playheadRafRef.current);
				playheadRafRef.current = null;
			}
		};
	}, [isPlaying, slideDurationMs]);

	const startPlayback = () => {
		setIsPlaying(true);
		if (videoRef.current) {
			videoRef.current.currentTime = currentTimeMs / 1000;
			videoRef.current.play().catch(() => undefined);
		}
	};

	const pausePlayback = () => {
		setIsPlaying(false);
		videoRef.current?.pause();
	};

	const seek = (timeMs: number) => {
		setCurrentTimeMs(timeMs);
		if (videoRef.current) videoRef.current.currentTime = timeMs / 1000;
	};

	const togglePlayPause = () => {
		if (isPlaying) {
			pausePlayback();
			return;
		}

		if (currentTimeMs >= slideDurationMs) {
			setCurrentTimeMs(0);
			if (videoRef.current) videoRef.current.currentTime = 0;
		}

		setIsPlaying(true);
		videoRef.current?.play().catch(() => undefined);
	};

	const rewind = () => {
		setCurrentTimeMs(0);
		if (videoRef.current) videoRef.current.currentTime = 0;
	};

	const toggleMute = () => setIsAudioMuted((muted) => !muted);

	const addSampleClip = (trackId?: string) => {
		if (!trackId) return;

		const newClip = {
			id: `clip-${Date.now()}`,
			title: `Clip ${meta.videoTracks.flatMap((track) => track.clips).length + 1}`,
			sourcePath: "",
			startOffsetMs: currentTimeMs,
			durationMs: Math.min(3000, slideDurationMs - currentTimeMs),
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

	const deleteClip = (trackId: string, clipId: string) => {
		onUpdateMeta((prev) => ({
			...prev,
			videoTracks: prev.videoTracks.map((track) =>
				track.id === trackId
					? { ...track, clips: track.clips.filter((clip) => clip.id !== clipId) }
					: track,
			),
		}));
		if (selectedClipId === clipId) setSelectedClipId(null);
	};

	const deleteAudioTrack = (trackId: string) => {
		onUpdateMeta((prev) => ({
			...prev,
			audioTracks: (prev.audioTracks || []).filter((track) => track.id !== trackId),
		}));
	};

	const trimClip = (
		trackId: string,
		clipId: string,
		newStartOffsetMs: number,
		newDurationMs: number,
	) => {
		onUpdateMeta((prev) => ({
			...prev,
			videoTracks: prev.videoTracks.map((track) =>
				track.id === trackId
					? {
							...track,
							clips: track.clips.map((clip) =>
								clip.id === clipId
									? {
											...clip,
											startOffsetMs: newStartOffsetMs,
											durationMs: newDurationMs,
										}
									: clip,
							),
						}
					: track,
			),
		}));
	};

	const splitClip = (trackId: string, clipId: string, splitMs: number) => {
		const track = meta.videoTracks.find((candidate) => candidate.id === trackId);
		const clip = track?.clips.find((candidate) => candidate.id === clipId);
		if (!clip) return;

		const leftDuration = splitMs - clip.startOffsetMs;
		const rightDuration = clip.durationMs - leftDuration;
		if (leftDuration <= 200 || rightDuration <= 200) return;

		const leftClip = { ...clip, durationMs: leftDuration };
		const rightClip = {
			...clip,
			id: `clip-${Date.now()}`,
			title: `${clip.title} (Part 2)`,
			startOffsetMs: splitMs,
			durationMs: rightDuration,
		};

		onUpdateMeta((prev) => ({
			...prev,
			videoTracks: prev.videoTracks.map((candidate) =>
				candidate.id === trackId
					? {
							...candidate,
							clips: candidate.clips.flatMap((item) =>
								item.id === clipId ? [leftClip, rightClip] : [item],
							),
						}
					: candidate,
			),
		}));
	};

	const changeClipSpeed = (trackId: string, clipId: string, speed: number) => {
		onUpdateMeta((prev) => ({
			...prev,
			videoTracks: prev.videoTracks.map((track) =>
				track.id === trackId
					? {
							...track,
							clips: track.clips.map((clip) =>
								clip.id === clipId ? { ...clip, speedMultiplier: speed } : clip,
							),
						}
					: track,
			),
		}));
	};

	return {
		selectedClipId,
		setSelectedClipId,
		currentTimeMs,
		isPlaying,
		isAudioMuted,
		videoRef,
		startPlayback,
		pausePlayback,
		seek,
		togglePlayPause,
		rewind,
		toggleMute,
		addSampleClip,
		deleteClip,
		deleteAudioTrack,
		trimClip,
		splitClip,
		changeClipSpeed,
	};
}
