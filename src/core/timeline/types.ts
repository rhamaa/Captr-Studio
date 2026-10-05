import type { PropertyKeyframe } from "@/components/video-editor/types";
import type { MediaSource, RecordComposition, RecordingPackage } from "@/recording/types";

export type { PropertyKeyframe } from "@/components/video-editor/types";
export type {
	CompletedRecording,
	MediaSource,
	RecordComposition,
	RecordingPackage,
} from "@/recording/types";
export interface TextOverlay {
	content: string;
	fontFamily: string;
	fontSizePx: number;
	fontWeight: number;
	color: string;
	align: "left" | "center" | "right";
}
export type TransitionEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";
export type ClipTransitionPreset =
	| { kind: "cross-dissolve" }
	| { kind: "fade-through"; color: "black" | "white" }
	| { kind: "wipe" | "push"; direction: "left" | "right" | "up" | "down" };
export interface ClipTransition {
	id: string;
	trackId: string;
	fromClipId: string;
	toClipId: string;
	preset: ClipTransitionPreset;
	durationUs: number;
	easing: TransitionEasing;
}
export interface ComponentAnimation {
	preset: "fade" | "slide" | "scale-pop" | "wipe-reveal";
	durationUs: number;
	easing: TransitionEasing;
	direction?: "left" | "right" | "up" | "down";
}
export interface ShapeStyle {
	fill: string | null;
	stroke: { color: string; width: number } | null;
}
export type ShapeDefinition =
	| { kind: "rectangle"; width: number; height: number; style: ShapeStyle }
	| { kind: "ellipse"; width: number; height: number; style: ShapeStyle }
	| {
			kind: "line";
			from: { x: number; y: number };
			to: { x: number; y: number };
			style: { stroke: { color: string; width: number } };
		}
	| {
			kind: "arrow";
			from: { x: number; y: number };
			to: { x: number; y: number };
			headLength: number;
			style: { stroke: { color: string; width: number } };
		};
export interface MediaAsset {
	id: string;
	kind: "video" | "image" | "audio" | "recording" | "text" | "shape";
	name: string;
	durationUs: number;
	width: number;
	height: number;
	source?: MediaSource;
	packageId?: string;
	thumbnail?: string;
	text?: TextOverlay;
	shapeDefinition?: ShapeDefinition;
}
export interface ClipTransform {
	x: number;
	y: number;
	scale: number;
	rotation: number;
	opacity: number;
}
export interface TimelineClip {
	id: string;
	assetId: string;
	compositionId?: string;
	startUs: number;
	sourceInUs: number;
	sourceOutUs: number;
	rate: number;
	transform: ClipTransform;
	gain: number;
	enabled: boolean;
	text?: TextOverlay;
	keyframes?: PropertyKeyframe[];
	componentAnimation?: { enter?: ComponentAnimation; exit?: ComponentAnimation };
	shapeStyleOverride?: ShapeStyle;
}
export interface TimelineTrack {
	id: string;
	name: string;
	kind: "visual" | "audio";
	locked: boolean;
	muted: boolean;
	hidden: boolean;
	clips: TimelineClip[];
}
export interface TimelineProject {
	version: 3;
	projectId: string;
	title: string;
	canvas: { width: number; height: number; fps: number };
	assets: MediaAsset[];
	packages: RecordingPackage[];
	compositions: RecordComposition[];
	tracks: TimelineTrack[];
	clipTransitions?: ClipTransition[];
	createdAt: string;
	updatedAt: string;
}
export const clipDurationUs = (clip: TimelineClip) =>
	Math.round((clip.sourceOutUs - clip.sourceInUs) / clip.rate);
export const projectDurationUs = (project: TimelineProject) =>
	Math.max(
		0,
		...project.tracks.flatMap((t) =>
			t.clips.filter((c) => c.enabled).map((c) => c.startUs + clipDurationUs(c)),
		),
	);
