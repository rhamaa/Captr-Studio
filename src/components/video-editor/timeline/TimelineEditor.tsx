import * as React from "react";
import {
	RecordSlideTimeline,
	type RecordSlideTimelineHandle,
	type RecordSlideTimelineProps,
} from "@/slides/record/components/RecordSlideTimeline";
export type SlideTimelineMode = "record";
export type TimelineEditorHandle = RecordSlideTimelineHandle;
export interface TimelineEditorGlobalProps {
	mode?: SlideTimelineMode;
	recordProps?: RecordSlideTimelineProps;
	className?: string;
}
export type TimelineEditorProps = Partial<RecordSlideTimelineProps> & TimelineEditorGlobalProps;
export const TimelineEditor = React.forwardRef<RecordSlideTimelineHandle, TimelineEditorProps>(
	function TimelineEditor(props, ref) {
		const recordProps = props.recordProps ?? (props as RecordSlideTimelineProps);
		return <RecordSlideTimeline ref={ref} {...recordProps} />;
	},
);
TimelineEditor.displayName = "TimelineEditor";
export default TimelineEditor;
