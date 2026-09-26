import TimelineEditor, {
	type SlideTimelineMode,
	type TimelineEditorGlobalProps,
	type TimelineEditorHandle,
	type TimelineEditorProps,
} from "./timeline/TimelineEditor";

export type {
	SlideTimelineMode,
	TimelineEditorHandle,
	TimelineEditorProps,
	TimelineEditorGlobalProps,
};

export type SlideTimelineHostProps = TimelineEditorProps;
export const SlideTimelineHost = TimelineEditor;
export default SlideTimelineHost;
