import type { ShortcutBinding } from "@/lib/shortcuts";
import type { Span } from "dnd-timeline";
import type { ZoomMode } from "../../types";

export interface TimelineRegionSpan {
	id: string;
	start: number;
	end: number;
	rowId: string;
}

export interface TimelineRegion {
	id: string;
	startMs: number;
	endMs: number;
}

export interface TimelineAudioRegion extends TimelineRegion {
	trackIndex?: number;
}

export interface TimelineShortcutBindings {
	addKeyframe: ShortcutBinding;
	addZoom: ShortcutBinding;
	splitClip: ShortcutBinding;
	addAnnotation: ShortcutBinding;
	deleteSelected: ShortcutBinding;
}

export interface SlideMedia4in1 {
	videoPath?: string | null;
	webcamPath?: string | null;
	webcamEnabled?: boolean;
	micPeaks?: AudioPeaksData | null;
	systemPeaks?: AudioPeaksData | null;
	micMuted?: boolean;
	systemMuted?: boolean;
}

export interface TimelineRenderItem {
	id: string;
	rowId: string;
	span: Span;
	sourceSpan?: Span;
	label: string;
	audioPath?: string;
	audioGain?: number;
	audioNormalize?: boolean;
	zoomDepth?: number;
	zoomMode?: ZoomMode;
	speedValue?: number;
	layoutPreset?: string;
	showSourceAudio?: boolean;
	muted?: boolean;
	transitionIn?: import("../../types").ClipTransitionType;
	media4in1?: SlideMedia4in1;
	variant: "zoom" | "trim" | "clip" | "annotation" | "speed" | "audio" | "layout";
}

export interface AudioPeaksData {
	durationMs: number;
	peaks: Float32Array;
}
