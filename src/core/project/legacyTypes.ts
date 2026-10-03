/** Read-only V2 compatibility types for explicit conversion. */
import type { RecordingEffectSettings } from "@/recording/schema";

export interface SlideMetaByType {
	record: RecordingEffectSettings;
	/** Compatibility slot for externally registered keyframe modules. */
	keyframe: Record<string, unknown>;
}

export type SlideType = keyof SlideMetaByType;

interface SlideDataFields {
	id: string;
	title: string;
	durationMs: number;
	order: number;
	dirName?: string;
}

export type SlideData<TType extends SlideType = SlideType> = {
	[Type in TType]: SlideDataFields & {
		type: Type;
		meta: SlideMetaByType[Type];
	};
}[TType];

export type ProjectSlideData = SlideData;

export type TransitionType =
	| "none"
	| "crossfade"
	| "fade-black"
	| "wipe-left"
	| "wipe-right"
	| "slide-left"
	| "slide-right"
	| "zoom-in";

export interface SlideTransition {
	id: string;
	fromSlideId: string;
	toSlideId: string;
	type: TransitionType;
	durationMs: number;
}

export interface GlobalAudioTrack {
	id: string;
	name: string;
	path: string;
	volume: number;
	startMsOffset: number;
	durationMs?: number;
	trimStartMs?: number;
	trimEndMs?: number;
	fadeInMs?: number;
	fadeOutMs?: number;
	loop?: boolean;
}

export interface CanvasDimensions {
	width: number;
	height: number;
	fps: number;
	aspectRatio?: string;
}

export interface ProjectV2Data {
	version: 2;
	projectId: string;
	title: string;
	canvas: CanvasDimensions;
	slides: ProjectSlideData[];
	transitions: SlideTransition[];
	globalAudioTracks: GlobalAudioTrack[];
	createdAt?: number;
	updatedAt?: number;
}

