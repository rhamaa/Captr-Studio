import type {
	AnnotationRegion,
	AudioRegion,
	ClipRegion,
	CursorStyle,
	CursorTelemetryPoint,
	LayoutRegion,
	Padding,
	WebcamOverlaySettings,
	ZoomDepth,
	ZoomFocus,
	ZoomMode,
	ZoomRegion,
	ZoomTransitionEasing,
} from "@/components/video-editor/types";
import type { AspectRatio } from "@/utils/aspectRatioUtils";

export type {
	AnnotationRegion,
	AspectRatio,
	AudioRegion,
	ClipRegion,
	CursorStyle,
	CursorTelemetryPoint,
	LayoutRegion,
	Padding,
	WebcamOverlaySettings,
	ZoomDepth,
	ZoomFocus,
	ZoomMode,
	ZoomRegion,
	ZoomTransitionEasing,
};

export interface RecordSlideMeta {
	videoPath?: string;
	webcamPath?: string | null;
	microphoneAudioPath?: string | null;
	systemAudioPath?: string | null;
	cursorTelemetryPath?: string | null;
	cursorTelemetry?: CursorTelemetryPoint[] | null;
	wallpaper: string;
	shadowIntensity: number;
	backgroundBlur: number;
	borderRadius: number;
	padding: Padding;
	cropRegion?: { x: number; y: number; width: number; height: number };
	zoomRegions: ZoomRegion[];
	clipRegions?: ClipRegion[];
	trimRegions: Array<{ id: string; startMs: number; endMs: number }>;
	speedRegions: Array<{ id: string; startMs: number; endMs: number; speed: number }>;
	layoutRegions: LayoutRegion[];
	annotationRegions: AnnotationRegion[];
	audioRegions: AudioRegion[];
	webcam: WebcamOverlaySettings;
	showCursor: boolean;
	cursorSmoothing: number;
	cursorStyle?: CursorStyle;
	cursorSize?: number;
	cursorClickBounce?: number;
	cursorSway?: number;
	cameraPerspectiveTilt?: number;
	zoomMotionBlur?: number;
	connectZooms?: boolean;
	zoomInDurationMs?: number;
	zoomOutDurationMs?: number;
	frame?: string | null;
}

export function createDefaultRecordMeta(): RecordSlideMeta {
	return {
		wallpaper: "wallpapers/tahoe-light.jpg",
		shadowIntensity: 0.67,
		backgroundBlur: 0,
		borderRadius: 12.5,
		padding: { top: 20, bottom: 20, left: 20, right: 20, linked: true },
		zoomRegions: [],
		clipRegions: [],
		trimRegions: [],
		speedRegions: [],
		layoutRegions: [],
		annotationRegions: [],
		audioRegions: [],
		webcam: {
			enabled: false,
			sourcePath: null,
			timeOffsetMs: 0,
			mirror: true,
			cropRegion: { x: 0, y: 0, width: 1, height: 1 },
			corner: "bottom-right",
			positionPreset: "bottom-right",
			positionX: 1,
			positionY: 1,
			size: 25,
			reactToZoom: true,
			cornerRadius: 50,
			shadow: 0.5,
			margin: 20,
		},
		showCursor: true,
		cursorSmoothing: 0.67,
		cursorStyle: "macos",
		cursorSize: 2.5,
		cursorClickBounce: 2.5,
		cursorSway: 0.4,
		cameraPerspectiveTilt: 0,
		zoomMotionBlur: 0.35,
		connectZooms: true,
		zoomInDurationMs: 200,
		zoomOutDurationMs: 200,
	};
}
