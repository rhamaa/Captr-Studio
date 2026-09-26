import * as React from "react";
import {
	MotionSlideTimeline,
	type MotionSlideTimelineProps,
} from "@/slides/motion/components/MotionSlideTimeline";
import {
	RecordSlideTimeline,
	type RecordSlideTimelineHandle,
	type RecordSlideTimelineProps,
} from "@/slides/record/components/RecordSlideTimeline";
import {
	VideoSlideTimeline,
	type VideoSlideTimelineProps,
} from "@/slides/video/components/VideoSlideTimeline";

export type SlideTimelineMode = "record" | "video" | "motion";
export type TimelineEditorHandle = RecordSlideTimelineHandle;

export interface TimelineEditorGlobalProps {
	mode?: SlideTimelineMode;
	recordProps?: RecordSlideTimelineProps;
	motionProps?: Partial<MotionSlideTimelineProps> & {
		currentTimeMs: number;
		durationMs: number;
		isPlaying: boolean;
		onSeek: (timeMs: number) => void;
		onTogglePlay: () => void;
		onRewind: () => void;
	};
	videoProps?: Partial<VideoSlideTimelineProps> & {
		slideDurationMs: number;
		currentTimeMs: number;
		isPlaying: boolean;
		onSeek: (timeMs: number) => void;
		onTogglePlay: () => void;
		onRewind: () => void;
	};
	className?: string;
}

/**
 * The record timeline's props are optional here because record props may also be
 * supplied as a group through `recordProps` (motion/video modes return earlier and
 * never touch them). `TimelineEditor` falls back to the flat props for record mode.
 */
export type TimelineEditorProps = Partial<RecordSlideTimelineProps> & TimelineEditorGlobalProps;

/**
 * TimelineEditor (Global Timeline Host)
 * High-level global timeline component living in src/components/video-editor/.
 * Dispatches to specialized slide timelines:
 * - "record" => RecordSlideTimeline (src/slides/record/)
 * - "video"  => VideoSlideTimeline (src/slides/video/)
 * - "motion" => MotionSlideTimeline (src/slides/motion/)
 */
export const TimelineEditor = React.forwardRef<RecordSlideTimelineHandle, TimelineEditorProps>(
	function TimelineEditor(props, ref) {
		const mode = props.mode ?? "record";
		const recordRef = React.useRef<RecordSlideTimelineHandle | null>(null);

		React.useImperativeHandle(ref, () => {
			if (mode === "record" && recordRef.current) {
				return recordRef.current;
			}
			return {
				addZoom: () => {
					recordRef.current?.addZoom();
				},
				suggestZooms: () => {
					recordRef.current?.suggestZooms();
				},
				splitClip: () => {
					if (mode === "video" && props.videoProps?.selectedClipId) {
						const trackId = props.videoProps.videoTracks?.[0]?.id || "track-v1";
						props.videoProps.onSplitClip?.(
							trackId,
							props.videoProps.selectedClipId,
							props.videoProps.currentTimeMs,
						);
					} else {
						recordRef.current?.splitClip();
					}
				},
				addLayout: () => {
					recordRef.current?.addLayout();
				},
				addAnnotation: (trackIndex?: number) => {
					recordRef.current?.addAnnotation(trackIndex);
				},
				addAudio: async (trackIndex?: number) => {
					await recordRef.current?.addAudio(trackIndex);
				},
				keyframes: recordRef.current?.keyframes ?? [],
			};
		}, [mode, props.videoProps]);

		if (mode === "motion" && props.motionProps) {
			return (
				<MotionSlideTimeline
					currentTimeMs={props.motionProps.currentTimeMs}
					durationMs={props.motionProps.durationMs}
					isPlaying={props.motionProps.isPlaying}
					isLoop={props.motionProps.isLoop ?? true}
					playbackRate={props.motionProps.playbackRate ?? 1}
					onSeek={props.motionProps.onSeek}
					onTogglePlay={props.motionProps.onTogglePlay}
					onRewind={props.motionProps.onRewind}
					onToggleLoop={props.motionProps.onToggleLoop}
					onChangePlaybackRate={props.motionProps.onChangePlaybackRate}
					onChangeDuration={props.motionProps.onChangeDuration}
					className={props.className}
				/>
			);
		}

		if (mode === "video" && props.videoProps) {
			return (
				<VideoSlideTimeline
					videoTracks={props.videoProps.videoTracks || []}
					audioTracks={props.videoProps.audioTracks || []}
					slideDurationMs={props.videoProps.slideDurationMs}
					currentTimeMs={props.videoProps.currentTimeMs}
					isPlaying={props.videoProps.isPlaying}
					isAudioMuted={props.videoProps.isAudioMuted}
					selectedClipId={props.videoProps.selectedClipId}
					onSeek={props.videoProps.onSeek}
					onTogglePlay={props.videoProps.onTogglePlay}
					onRewind={props.videoProps.onRewind}
					onToggleMute={props.videoProps.onToggleMute}
					onSelectClip={props.videoProps.onSelectClip}
					onDeleteClip={props.videoProps.onDeleteClip}
					onSplitClip={props.videoProps.onSplitClip}
					onTrimClip={props.videoProps.onTrimClip}
					onAddClip={props.videoProps.onAddClip}
					onDeleteAudioTrack={props.videoProps.onDeleteAudioTrack}
					onChangeClipSpeed={props.videoProps.onChangeClipSpeed}
					onChangeClipVolume={props.videoProps.onChangeClipVolume}
					className={props.className}
				/>
			);
		}

		// Default: Record mode (delegates to RecordSlideTimeline from src/slides/record/)
		// Record props may be passed flat as well as through `recordProps`; motion/video
		// modes returned above, so this cast cannot leak an incomplete record prop set.
		const effectiveRecordProps = props.recordProps ?? (props as RecordSlideTimelineProps);
		return <RecordSlideTimeline ref={recordRef} {...effectiveRecordProps} />;
	},
);

TimelineEditor.displayName = "TimelineEditor";
export default TimelineEditor;
