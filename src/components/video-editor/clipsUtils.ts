import { isRecordSlide } from "./sceneEditing";
import {
	type AudioRegion,
	type ClipEntry,
	type ClipRegion,
	type CropRegion,
	DEFAULT_WEBCAM_OVERLAY,
	type LayoutRegion,
	type WebcamOverlaySettings,
	type ZoomRegion,
} from "./types";

/** Rebuild scene placement without discarding mute, audio, or transition edits. */
export function buildSceneClipRegions(
	clips: ClipEntry[],
	previous: ClipRegion[] = [],
): ClipRegion[] {
	const byId = new Map(previous.map((region) => [region.id, region]));
	return clips.map((clip) => {
		const existing = byId.get(clip.id);
		return {
			...existing,
			id: clip.id,
			startMs: clip.startMsOffset,
			endMs: clip.startMsOffset + clip.durationMs,
			speed: existing?.speed ?? clip.speed ?? 1,
			transitionIn: existing?.transitionIn ?? clip.transitionIn?.type,
			transitionInDurationMs:
				existing?.transitionInDurationMs ?? clip.transitionIn?.durationMs,
		};
	});
}

export interface ProjectDefaultSettings {
	wallpaper: string;
	cropRegion: CropRegion;
	layoutRegions: LayoutRegion[];
	webcam: WebcamOverlaySettings;
	zoomRegions: ZoomRegion[];
}

export interface EffectiveClipSettings {
	wallpaper: string;
	cropRegion: CropRegion;
	layoutRegions: LayoutRegion[];
	webcam: WebcamOverlaySettings;
	zoomRegions: ZoomRegion[];
}

/**
 * Format milliseconds into MM:SS display format
 */
export function formatClipDuration(durationMs: number): string {
	const totalSec = Math.max(0, Math.floor(durationMs / 1000));
	const minutes = Math.floor(totalSec / 60);
	const seconds = totalSec % 60;
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Reorders a clip by ID one step earlier ("left") or later ("right")
 */
export function reorderClips(
	clips: ClipEntry[],
	clipId: string,
	direction: "left" | "right",
): ClipEntry[] {
	const index = clips.findIndex((c) => c.id === clipId);
	if (index < 0) return clips;

	const targetIndex = direction === "left" ? index - 1 : index + 1;
	if (targetIndex < 0 || targetIndex >= clips.length) return clips;

	const result = [...clips];
	const [moved] = result.splice(index, 1);
	result.splice(targetIndex, 0, moved);

	// Recalculate startMsOffset after reorder
	return recalculateClipOffsets(result);
}

/**
 * Recalculates sequential startMsOffset values for a list of clips
 */
export function recalculateClipOffsets(clips: ClipEntry[]): ClipEntry[] {
	let currentOffset = 0;
	return clips.map((clip) => {
		const updated = {
			...clip,
			startMsOffset: currentOffset,
		};
		currentOffset += Math.max(0, clip.durationMs);
		return updated;
	});
}

/**
 * Finds which clip is active at a given timeline millisecond
 */
export function findClipAtTimelineTime(
	clips: ClipEntry[],
	timelineMs: number,
): { clip: ClipEntry; localTimeMs: number; index: number } | null {
	if (clips.length === 0) return null;

	for (let i = 0; i < clips.length; i++) {
		const clip = clips[i];
		const clipEnd = clip.startMsOffset + clip.durationMs;
		if (timelineMs >= clip.startMsOffset && (timelineMs < clipEnd || i === clips.length - 1)) {
			const localTimeMs = Math.max(0, timelineMs - clip.startMsOffset);
			return { clip, localTimeMs, index: i };
		}
	}

	return null;
}

/**
 * Resolves effective visual settings for a clip (uses per-clip overrides if present, otherwise defaults)
 */
export function getEffectiveClipSettings(
	clip: ClipEntry,
	defaults: ProjectDefaultSettings,
): EffectiveClipSettings {
	const record = isRecordSlide(clip);
	return {
		wallpaper: clip.wallpaper ?? defaults.wallpaper,
		cropRegion: clip.cropRegion ?? defaults.cropRegion,
		layoutRegions: record ? (clip.layoutRegions ?? defaults.layoutRegions) : [],
		webcam: record
			? (clip.webcam ?? defaults.webcam)
			: { ...DEFAULT_WEBCAM_OVERLAY, enabled: false, sourcePath: null },
		zoomRegions: record ? (clip.zoomRegions ?? defaults.zoomRegions) : [],
	};
}

/**
 * Checks if a clip was created via internal screen/camera recording
 */
export function isRecordedClip(clip: ClipEntry): boolean {
	if (clip.origin) {
		return clip.origin === "recorded";
	}
	// Fallback heuristic for legacy clips:
	return Boolean(
		clip.webcamPath || clip.cursorTelemetry || clip.videoPath.includes("recording-"),
	);
}

/**
 * Factory for creating an internal recorded take clip
 */
export function createRecordedClip(params: {
	id: string;
	videoPath: string;
	webcamPath?: string | null;
	microphoneAudioPath?: string | null;
	systemAudioPath?: string | null;
	startMsOffset: number;
	durationMs: number;
	label: string;
	webcam?: WebcamOverlaySettings;
}): ClipEntry {
	return {
		id: params.id,
		origin: "recorded",
		videoPath: params.videoPath,
		webcamPath: params.webcamPath ?? null,
		microphoneAudioPath: params.microphoneAudioPath ?? null,
		systemAudioPath: params.systemAudioPath ?? null,
		startMsOffset: params.startMsOffset,
		durationMs: params.durationMs,
		label: params.label,
		webcam: params.webcam,
		showCursor: true, // Native recorded cursor available
	};
}

/**
 * Factory for creating an external uploaded video clip
 */
export function createUploadedClip(params: {
	id: string;
	videoPath: string;
	startMsOffset: number;
	durationMs: number;
	label: string;
}): ClipEntry {
	return {
		id: params.id,
		origin: "uploaded",
		slideMode: "video",
		layoutRegions: [],
		zoomRegions: [],
		annotationRegions: [],
		audioRegions: [],
		videoPath: params.videoPath,
		webcamPath: null, // Strictly no webcam sidecar
		microphoneAudioPath: null,
		systemAudioPath: null,
		cursorTelemetry: null,
		startMsOffset: params.startMsOffset,
		durationMs: params.durationMs,
		label: params.label,
		webcam: {
			...DEFAULT_WEBCAM_OVERLAY,
			enabled: false,
			sourcePath: null,
		},
		showCursor: false, // External uploaded videos don't have synthetic cursor overlay
	};
}

/**
 * Factory for creating a Motion Graphics slide clip
 */
export function createMotionClip(params: {
	id: string;
	startMsOffset: number;
	durationMs?: number;
	label?: string;
	motionMeta?: import("@/slides/motion/schema").MotionSlideMeta;
}): ClipEntry {
	const durationMs = params.durationMs ?? params.motionMeta?.durationMs ?? 5000;
	return {
		id: params.id,
		origin: "uploaded",
		slideMode: "motion",
		layoutRegions: [],
		zoomRegions: [],
		annotationRegions: [],
		audioRegions: [],
		videoPath: "",
		webcamPath: null,
		microphoneAudioPath: null,
		systemAudioPath: null,
		cursorTelemetry: null,
		startMsOffset: params.startMsOffset,
		durationMs,
		label: params.label || "Motion Slide",
		webcam: {
			...DEFAULT_WEBCAM_OVERLAY,
			enabled: false,
			sourcePath: null,
		},
		showCursor: false,
		motionMeta: params.motionMeta,
	};
}

/**
 * Folds the ACTIVE slide's audio regions into its own clip before persisting.
 *
 * Slide-scoped state lives in the editor (top-level `editor.*`) while a slide is
 * open; it is copied back into the clip only when the user leaves that slide.
 * Without this fold, saving right after editing audio persists a *stale* clip
 * copy next to the fresh top-level state, and loading the project then prefers
 * the stale copy — the edit appears to revert, and the audio of one slide can be
 * restored onto another. Returns the same array reference when nothing changes
 * so memoized callers stay stable.
 */
export function foldActiveAudioRegionsIntoClips(
	clips: ClipEntry[],
	activeClipId: string | null,
	audioRegions: AudioRegion[],
): ClipEntry[] {
	if (!activeClipId) return clips;
	const index = clips.findIndex((clip) => clip.id === activeClipId);
	if (index < 0) return clips;
	return clips.map((clip, i) =>
		i === index ? { ...clip, audioRegions: structuredClone(audioRegions) } : clip,
	);
}

/**
 * Gets the local elapsed time within a specific clip from a timeline millisecond
 */
export function getClipLocalTimeMs(clip: ClipEntry, timelineMs: number): number {
	const elapsed = timelineMs - clip.startMsOffset;
	return Math.max(0, Math.min(clip.durationMs, elapsed));
}
