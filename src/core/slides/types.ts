import type React from "react";

export type SlideType = "record" | "video" | "keyframe" | "remotion";

export interface SlideData<TMeta = Record<string, unknown>> {
	id: string;
	type: SlideType;
	title: string;
	durationMs: number;
	order: number;
	dirName?: string;
	meta: TMeta;
}

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
	slides: SlideData[];
	transitions: SlideTransition[];
	globalAudioTracks: GlobalAudioTrack[];
	createdAt?: number;
	updatedAt?: number;
}

export interface SlideWorkspaceProps<TMeta = Record<string, unknown>> {
	slide: SlideData<TMeta>;
	onUpdateMeta: (updater: (prev: TMeta) => TMeta) => void;
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

export interface SlideModule<TMeta = Record<string, unknown>> {
	type: SlideType;
	displayName: string;
	description: string;
	icon: React.ComponentType<{ className?: string }>;

	// Workspace component mounted when slide is active
	WorkspaceComponent: React.ComponentType<SlideWorkspaceProps<TMeta>>;

	// Thumbnail generator for Slide Deck Bar
	generateThumbnail?: (slide: SlideData<TMeta>, timeMs: number) => Promise<string | null>;

	// Frame renderer for export pipeline
	renderFrame?: (
		slide: SlideData<TMeta>,
		timeMs: number,
		targetCanvas: HTMLCanvasElement | OffscreenCanvas,
	) => Promise<void>;

	// Audio renderer for export pipeline
	renderAudioTrack?: (
		slide: SlideData<TMeta>,
		offlineAudioContext: OfflineAudioContext,
	) => Promise<AudioBuffer | null>;

	// Direct chunk exporter if the module produces an MP4 chunk directly
	exportChunk?: (
		slide: SlideData<TMeta>,
		options: SlideChunkExportOptions,
	) => Promise<{ filePath: string; durationSec: number }>;

	// Create default metadata for a newly added slide
	createDefaultMeta: () => TMeta;
}

