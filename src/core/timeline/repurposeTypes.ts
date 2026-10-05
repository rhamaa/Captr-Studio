import type { ClipTransition, TimelineTrack } from "./types";

export type RepurposeAspectRatio = "9:16" | "1:1" | "16:9" | "4:5" | "custom";

export interface RepurposeArtboardFraming {
	scale: number; // Zoom multiplier: 1.0 = normal, up to 3.0
	offsetX: number; // Pan offset horizontal (-0.5 to 0.5 relative to source)
	offsetY: number; // Pan offset vertical (-0.5 to 0.5 relative to source)
	fitMode: "cover" | "contain";
}

export interface RepurposeArtboard {
	id: string;
	name: string;
	aspectRatio: RepurposeAspectRatio;
	width: number;
	height: number;
	framing: RepurposeArtboardFraming;
	tracks?: TimelineTrack[];
	clipTransitions?: ClipTransition[];
}

export interface RepurposeSlice {
	id: string;
	name: string;
	startUs: number;
	endUs: number;
	color?: string;
}

export interface RepurposeBoardSettings {
	artboards: RepurposeArtboard[];
	slices: RepurposeSlice[];
	activeSliceId: string | null;
}

export interface ArtboardPreset {
	aspectRatio: RepurposeAspectRatio;
	name: string;
	width: number;
	height: number;
	defaultFitMode: "cover" | "contain";
}

export const ARTBOARD_PRESETS: ArtboardPreset[] = [
	{
		aspectRatio: "9:16",
		name: "Shorts / Reels / TikTok",
		width: 1080,
		height: 1920,
		defaultFitMode: "cover",
	},
	{
		aspectRatio: "1:1",
		name: "Square Post",
		width: 1080,
		height: 1080,
		defaultFitMode: "cover",
	},
	{
		aspectRatio: "4:5",
		name: "Social Portrait",
		width: 1080,
		height: 1350,
		defaultFitMode: "cover",
	},
	{
		aspectRatio: "16:9",
		name: "Landscape Master",
		width: 1920,
		height: 1080,
		defaultFitMode: "contain",
	},
];

export const SLICE_COLORS = [
	"#3b82f6", // Blue
	"#10b981", // Emerald
	"#f59e0b", // Amber
	"#8b5cf6", // Purple
	"#ec4899", // Pink
	"#06b6d4", // Cyan
	"#f97316", // Orange
];
