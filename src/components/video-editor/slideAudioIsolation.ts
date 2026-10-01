import type { AudioRegion, SlideMode } from "./types";

export interface SlideAudioSourceParams {
	/** The active slide/take, or null when nothing is loaded yet. */
	activeSlide: { videoPath: string } | null;
	/** Effective mode of the active Record take. */
	activeSlideMode: SlideMode;
	/** Editor-global source path (last loaded video / active take). */
	currentSourcePath: string | null;
}

/** Resolves source audio from the active take, with the legacy Record fallback. */
export function resolveSlideAudioSourcePath({
	activeSlide,
	currentSourcePath,
}: SlideAudioSourceParams): string | null {
	if (!activeSlide) return currentSourcePath;
	if (activeSlide.videoPath) return activeSlide.videoPath;
	return currentSourcePath;
}

export interface LoadedSlideAudioRegionsParams {
	/** `audioRegions` stored on the slide that will become active, if any. */
	persistedClipAudioRegions: AudioRegion[] | undefined;
	/** Legacy top-level `editor.audioRegions` of the saved project. */
	editorAudioRegions: AudioRegion[];
	/** Number of slides in the saved project. */
	clipCount: number;
}

/**
 * Picks the audio regions to restore into the editor for the slide being opened.
 *
 * The saved top-level `editor.audioRegions` mirror the slide that was active when
 * the project was written, so adopting it blindly after a load throws that
 * slide's audio onto whichever slide is restored first. Slide-level data wins;
 * the legacy top-level is only adopted when a single slide exists (then it can
 * only belong to that slide). New projects always fold the active slide's audio
 * into its clip before saving, so this fallback only covers older files.
 */
export function resolveLoadedSlideAudioRegions({
	persistedClipAudioRegions,
	editorAudioRegions,
	clipCount,
}: LoadedSlideAudioRegionsParams): AudioRegion[] {
	if (Array.isArray(persistedClipAudioRegions)) return persistedClipAudioRegions;
	if (clipCount <= 1) return editorAudioRegions;
	return [];
}
