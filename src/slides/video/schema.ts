export interface VideoClipItem {
	id: string;
	title: string;
	sourcePath: string;
	startOffsetMs: number;
	durationMs: number;
	trimStartMs?: number;
	trimEndMs?: number;
	speedMultiplier: number;
	volume: number;
	muted?: boolean;
}

export interface VideoTrack {
	id: string;
	name: string;
	type: "video" | "overlay";
	muted?: boolean;
	locked?: boolean;
	clips: VideoClipItem[];
}

export type VideoTrackItem = VideoTrack;

export interface AudioTrackItem {
	id: string;
	name: string;
	sourcePath: string;
	startOffsetMs: number;
	durationMs: number;
	volume: number;
	muted?: boolean;
}

export interface TextOverlayItem {
	id: string;
	text: string;
	startOffsetMs: number;
	durationMs: number;
	position: { x: number; y: number };
	fontSize: number;
	color: string;
}

export interface VideoSlideMeta {
	videoTracks: VideoTrack[];
	audioTracks: AudioTrackItem[];
	textOverlays: TextOverlayItem[];
	mediaPool: Array<{
		id: string;
		name: string;
		path: string;
		type: "video" | "audio" | "image";
		durationMs?: number;
	}>;
}

export function createDefaultVideoMeta(): VideoSlideMeta {
	return {
		videoTracks: [
			{
				id: "track-v1",
				name: "Main Track (V1)",
				type: "video",
				clips: [],
			},
			{
				id: "track-v2",
				name: "B-Roll Overlay (V2)",
				type: "overlay",
				clips: [],
			},
		],
		audioTracks: [],
		textOverlays: [],
		mediaPool: [],
	};
}
