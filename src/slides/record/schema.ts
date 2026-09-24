export interface Padding {
	top: number;
	bottom: number;
	left: number;
	right: number;
}

export interface ZoomRegion {
	id: string;
	startMs: number;
	endMs: number;
	depth: number;
	focus: { x: number; y: number };
}

export interface WebcamOverlaySettings {
	enabled: boolean;
	sourcePath: string | null;
	positionPreset?: string;
	size?: number;
	cornerRadius?: number;
	shadow?: number;
}

export interface RecordSlideMeta {
	videoPath?: string;
	webcamPath?: string | null;
	microphoneAudioPath?: string | null;
	systemAudioPath?: string | null;
	cursorTelemetryPath?: string | null;
	cursorTelemetry?: Array<{ x: number; y: number; timeMs: number }> | null;
	wallpaper: string;
	shadowIntensity: number;
	backgroundBlur: number;
	borderRadius: number;
	padding: Padding;
	cropRegion?: { x: number; y: number; width: number; height: number };
	zoomRegions: ZoomRegion[];
	trimRegions: Array<{ id: string; startMs: number; endMs: number }>;
	speedRegions: Array<{ id: string; startMs: number; endMs: number; speed: number }>;
	layoutRegions: Array<{ id: string; startMs: number; endMs: number; preset: string }>;
	annotationRegions: Array<{ id: string; startMs: number; endMs: number; type: string }>;
	audioRegions: Array<{ id: string; startMs: number; endMs: number; volume: number }>;
	webcam: WebcamOverlaySettings;
	showCursor: boolean;
	cursorSmoothing: number;
}

export function createDefaultRecordMeta(): RecordSlideMeta {
	return {
		wallpaper: "wallpapers/tahoe-light.jpg",
		shadowIntensity: 0.4,
		backgroundBlur: 0,
		borderRadius: 12,
		padding: { top: 0.05, bottom: 0.05, left: 0.05, right: 0.05 },
		zoomRegions: [],
		trimRegions: [],
		speedRegions: [],
		layoutRegions: [],
		annotationRegions: [],
		audioRegions: [],
		webcam: { enabled: false, sourcePath: null, size: 0.25, cornerRadius: 50 },
		showCursor: true,
		cursorSmoothing: 0.5,
	};
}
