import type React from "react";

import type { MotionSlideMeta } from "@/slides/motion/schema";
import type { RecordSlideMeta } from "@/slides/record/schema";
import type { VideoSlideMeta } from "@/slides/video/schema";

export interface SlideMetaByType {
	record: RecordSlideMeta;
	video: VideoSlideMeta;
	/** Compatibility slot for externally registered keyframe modules. */
	keyframe: Record<string, unknown>;
	motion: MotionSlideMeta;
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

export interface SlideWorkspaceProps<TType extends SlideType = SlideType> {
	slide: SlideData<TType>;
	onUpdateMeta: (updater: (prev: SlideMetaByType[TType]) => SlideMetaByType[TType]) => void;
	onUpdateTitle?: (title: string) => void;
	onUpdateDuration?: (durationMs: number) => void;
	canvasDimensions: CanvasDimensions;
}

export interface SlideChunkExportOptions {
	outputPath?: string;
	fps: number;
	width: number;
	height: number;
	onProgress?: (progressPercent: number) => void;
}

export interface SlideModule<TType extends SlideType = SlideType> {
	type: TType;
	displayName: string;
	description: string;
	icon: React.ComponentType<{ className?: string }>;

	// Workspace component mounted when slide is active
	WorkspaceComponent: React.ComponentType<SlideWorkspaceProps<TType>>;

	// Thumbnail generator for Slide Deck Bar
	generateThumbnail?: (slide: SlideData<TType>, timeMs: number) => Promise<string | null>;

	// Frame renderer for export pipeline
	renderFrame?: (
		slide: SlideData<TType>,
		timeMs: number,
		targetCanvas: HTMLCanvasElement | OffscreenCanvas,
	) => Promise<void>;

	// Audio renderer for export pipeline
	renderAudioTrack?: (
		slide: SlideData<TType>,
		offlineAudioContext: OfflineAudioContext,
	) => Promise<AudioBuffer | null>;

	// Direct chunk exporter if the module produces an MP4 chunk directly
	exportChunk?: (
		slide: SlideData<TType>,
		options: SlideChunkExportOptions,
	) => Promise<{ filePath: string; durationSec: number; audioPaths?: string[] }>;

	// Create default metadata for a newly added slide
	createDefaultMeta: () => SlideMetaByType[TType];
}
