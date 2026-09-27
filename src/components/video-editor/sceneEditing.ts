import { normalizeRecordClipSettings } from "./projectNormalization";
import {
	normalizeProjectEditor,
	normalizeSceneVisualSettings,
	type ProjectEditorState,
} from "./projectPersistence";
import { type ClipEntry, DEFAULT_CROP_REGION, DEFAULT_WEBCAM_OVERLAY } from "./types";

export const VALID_RECORD_SECTIONS = [
	"scene",
	"cursor",
	"webcam",
	"layout",
	"zoom",
	"settings",
	"audio-record",
	"transitions",
	"clip",
	"audio",
	"frame",
	"crop",
] as const;

export const VALID_VIDEO_SECTIONS = ["media", "audio-record", "settings", "clip", "audio"] as const;

export const VALID_MOTION_SECTIONS = ["motion", "settings", "clip"] as const;

export function isRecordSlide(clip: ClipEntry | null | undefined): boolean {
	return (clip?.slideMode ?? (clip?.origin === "uploaded" ? "video" : "record")) === "record";
}

export function isMotionSlide(clip: ClipEntry | null | undefined): boolean {
	return clip?.slideMode === "motion";
}

export function sanitizeSectionForSlideMode(
	mode: "record" | "video" | "motion",
	section: string,
): string {
	if (mode === "motion") {
		return (VALID_MOTION_SECTIONS as readonly string[]).includes(section) ? section : "motion";
	}
	if (mode === "video") {
		return (VALID_VIDEO_SECTIONS as readonly string[]).includes(section) ? section : "media";
	}
	return (VALID_RECORD_SECTIONS as readonly string[]).includes(section) ? section : "scene";
}

/** A scene is restored from its own values or neutral defaults, never the previous scene. */
export function resolveSceneEditingState(
	clip: ClipEntry,
	fallbackSettings?: Partial<ProjectEditorState>,
) {
	const record = isRecordSlide(clip);
	const legacy = normalizeProjectEditor(fallbackSettings ?? {});
	return {
		wallpaper: clip.wallpaper ?? legacy.wallpaper,
		cropRegion: clip.cropRegion ?? (record ? legacy.cropRegion : DEFAULT_CROP_REGION),
		layoutRegions: record ? (clip.layoutRegions ?? legacy.layoutRegions) : [],
		zoomRegions: record ? (clip.zoomRegions ?? legacy.zoomRegions) : [],
		webcam: record
			? {
					...DEFAULT_WEBCAM_OVERLAY,
					...legacy.webcam,
					...clip.webcam,
					sourcePath:
						clip.webcamPath ??
						clip.webcam?.sourcePath ??
						legacy.webcam.sourcePath ??
						null,
				}
			: { ...DEFAULT_WEBCAM_OVERLAY, enabled: false, sourcePath: null },
		showCursor: record ? (clip.showCursor ?? legacy.showCursor) : false,
		recordSettings: record
			? normalizeRecordClipSettings(clip.recordSettings, fallbackSettings)
			: undefined,
		sceneSettings: normalizeSceneVisualSettings(
			clip.sceneSettings ??
				(record
					? legacy
					: {
							padding: { top: 0, right: 0, bottom: 0, left: 0 },
							borderRadius: 0,
							shadowIntensity: 0,
							backgroundBlur: 0,
							frame: null,
						}),
		),
	};
}
