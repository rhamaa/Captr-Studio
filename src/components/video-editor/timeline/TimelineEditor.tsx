import * as React from "react";
import {
	RecordingTimeline,
	type RecordingTimelineHandle,
	type RecordingTimelineProps,
} from "@/recording/components/RecordingTimeline";
export type SlideTimelineMode = "record";
export type TimelineEditorHandle = RecordingTimelineHandle;
export interface TimelineEditorGlobalProps {
	mode?: SlideTimelineMode;
	recordProps?: RecordingTimelineProps;
	className?: string;
}
export type TimelineEditorProps = Partial<RecordingTimelineProps> & TimelineEditorGlobalProps;
export const TimelineEditor = React.forwardRef<RecordingTimelineHandle, TimelineEditorProps>(
	function TimelineEditor(props, ref) {
		const recordProps = props.recordProps ?? (props as RecordingTimelineProps);
		return <RecordingTimeline ref={ref} {...recordProps} />;
	},
);
TimelineEditor.displayName = "TimelineEditor";
export default TimelineEditor;
