import React from "react";
import type { SlideWorkspaceProps } from "@/core/slides/types";
import { useVideoSlideAudioRecorder } from "../hooks/useVideoSlideAudioRecorder";
import { useVideoSlideTimeline } from "../hooks/useVideoSlideTimeline";
import { VideoClipInspector } from "./VideoClipInspector";
import { VideoMediaPool } from "./VideoMediaPool";
import { VideoPreviewMonitor } from "./VideoPreviewMonitor";
import { VideoSlideTimeline } from "./VideoSlideTimeline";
import { VideoSlideVoiceoverBar } from "./VideoSlideVoiceoverBar";

export const VideoSlideWorkspace: React.FC<SlideWorkspaceProps<"video">> = ({
	slide,
	onUpdateMeta,
	onUpdateTitle,
	onUpdateDuration,
	canvasDimensions,
}) => {
	const meta = slide.meta;
	const timeline = useVideoSlideTimeline({
		slideDurationMs: slide.durationMs,
		meta,
		onUpdateMeta,
	});
	const {
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
	} = timeline;

	const primaryVideoClip = meta.videoTracks?.[0]?.clips?.[0];
	const previewVideoSrc = primaryVideoClip?.sourcePath || meta.mediaPool?.[0]?.path || "";

	const recorder = useVideoSlideAudioRecorder({
		slideId: slide.id,
		getCurrentTimeMs: () => currentTimeMs,
		onStartPlayback: startPlayback,
		onPausePlayback: pausePlayback,
		onAudioClipRecorded: (clip) => {
			const newAudioTrackItem = {
				id: "vo-" + Date.now(),
				name: "Voiceover " + (clip.durationMs / 1000).toFixed(1) + "s",
				sourcePath: clip.filePath,
				startOffsetMs: clip.startOffsetMs,
				durationMs: clip.durationMs,
				volume: 1,
			};

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

	return (
		<div className="flex h-full w-full flex-col bg-slate-950 text-slate-200 select-none overflow-hidden">
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

			<div className="px-4 py-2 border-b border-slate-800/80 bg-slate-950 shrink-0">
				<VideoSlideVoiceoverBar
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

			<div className="flex h-60 flex-col bg-slate-900/90 backdrop-blur shrink-0">
				<VideoSlideTimeline
					videoTracks={meta.videoTracks}
					audioTracks={meta.audioTracks || []}
					slideDurationMs={slide.durationMs}
					currentTimeMs={currentTimeMs}
					isPlaying={isPlaying}
					isAudioMuted={isAudioMuted}
					selectedClipId={selectedClipId}
					onSeek={seek}
					onTogglePlay={togglePlayPause}
					onRewind={rewind}
					onToggleMute={toggleMute}
					onSelectClip={setSelectedClipId}
					onDeleteClip={deleteClip}
					onSplitClip={splitClip}
					onTrimClip={trimClip}
					onAddClip={addSampleClip}
					onDeleteAudioTrack={deleteAudioTrack}
					onChangeClipSpeed={changeClipSpeed}
				/>
			</div>
		</div>
	);
};
