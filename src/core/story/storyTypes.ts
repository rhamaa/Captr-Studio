import type { RepurposeAspectRatio, RepurposeArtboardFraming } from "../timeline/repurposeTypes";
import type { ClipTransition, TimelineTrack } from "../timeline/types";

export interface StoryCanvasSettings {
	width: number;
	height: number;
	fps: number;
	background?: string;
}

export interface StorySubtitleSettings {
	enabled: boolean;
	style?: string;
	primaryColor?: string;
	secondaryColor?: string;
	fontSize?: number;
}

/**
 * An authoritative, self-contained Story composition.
 * Represents an individual video deliverable (e.g. YouTube 16:9 master, TikTok 9:16 hook, etc.)
 * sharing the parent project's asset library.
 */
export interface StoryComposition {
	id: string;
	name: string;
	aspectRatio: RepurposeAspectRatio;
	canvas: StoryCanvasSettings;
	framing?: RepurposeArtboardFraming;
	tracks: TimelineTrack[];
	clipTransitions?: ClipTransition[];
	subtitles?: StorySubtitleSettings;
	durationUs?: number;
	createdAt?: string;
	updatedAt?: string;
}

/**
 * Manifest entry for an individual Story in project.json.
 */
export interface StoryManifestItem {
	id: string;
	name: string;
	file: string; // Relative path, e.g. "Story/story-main.json"
	aspectRatio: RepurposeAspectRatio;
	durationUs: number;
	thumbnailPath?: string;
}

export interface HyperframeVersionSnapshot {
	id: string; // e.g. "v1", "v2"
	versionNumber: number; // 1, 2, ...
	timestamp: number;
	label: string;
	htmlContent: string;
	durationUs?: number;
	agentId?: string;
	agentName?: string;
	prompt?: string;
	taggedAssetNames?: string[];
	logs?: string[];
}

/**
 * A code-driven motion graphics or programmatic video composition.
 * Driven by HTML5, Web Canvas, CSS, and GSAP timeline scripts.
 */
export interface HyperframeComposition {
	id: string;
	name: string;
	entryHtml: string; // Relative path inside bundle, e.g. "hyperframe/hyperframe-kinetic-intro.html"
	specJson?: string; // Relative path, e.g. "hyperframe/hyperframe-kinetic-intro.json"
	htmlContent?: string; // Inlined HTML source for editing or standalone rendering
	targetStoryId?: string; // Optional parent Story this hyperframe is designed for
	durationUs: number;
	width: number;
	height: number;
	aspectRatio?: RepurposeAspectRatio;
	fps?: number;
	createdAt?: string;
	updatedAt?: string;
	versions?: HyperframeVersionSnapshot[];
}

/**
 * Manifest entry for an individual Hyperframe in project.json.
 */
export interface HyperframeManifestItem {
	id: string;
	name: string;
	entryHtml: string;
	specJson?: string;
	targetStoryId?: string;
	durationUs: number;
	aspectRatio?: RepurposeAspectRatio;
}
