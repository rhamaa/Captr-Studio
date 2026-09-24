import type { EditorProjectData } from "@/components/video-editor/projectPersistence";
import type {
	ProjectV2Data,
	SlideData,
	SlideTransition,
	SlideType,
	TransitionType,
} from "../slides/types";

/**
 * Checks whether an incoming project object is in V2 slide-based format.
 */
export function isProjectV2(data: unknown): data is ProjectV2Data {
	if (!data || typeof data !== "object") return false;
	const candidate = data as Partial<ProjectV2Data>;
	return candidate.version === 2 && Array.isArray(candidate.slides);
}

/**
 * Migrates a legacy V1 monolithic project data structure to the V2 Slide-Based format.
 */
export function migrateV1ProjectToV2(v1: EditorProjectData): ProjectV2Data {
	const projectId = v1.projectId || `proj-${Date.now()}`;
	const title = (v1 as any).title || "Untitled Project";

	const editor = v1.editor as (Record<string, unknown> & Partial<EditorProjectData["editor"]>) | undefined;
	const width = (editor?.exportWidth as number) || 1920;
	const height = (editor?.exportHeight as number) || 1080;
	const fps = (v1.editor?.mp4FrameRate as number) || (editor?.exportFps as number) || 60;
	const aspectRatio = (v1.editor?.aspectRatio as string) || "16:9";

	const slides: SlideData[] = [];
	const transitions: SlideTransition[] = [];

	// Case A: Project has multiple clips
	if (Array.isArray(v1.clips) && v1.clips.length > 0) {
		v1.clips.forEach((clip, index) => {
			const slideId = clip.id || `slide-${index + 1}-${Date.now()}`;
			const slideType: SlideType =
				clip.slideMode === "video" || clip.slideMode === "record"
					? clip.slideMode
					: clip.origin === "uploaded"
						? "video"
						: "record";

			const slideTitle = clip.label || `Slide ${index + 1}`;
			const durationMs = Math.max(0, clip.durationMs || 5000);

			// Extract transition if present
			if (index > 0 && clip.transitionIn && clip.transitionIn.type !== "none") {
				const prevSlideId = slides[index - 1].id;
				transitions.push({
					id: `trans-${prevSlideId}-${slideId}`,
					fromSlideId: prevSlideId,
					toSlideId: slideId,
					type: (clip.transitionIn.type as TransitionType) || "crossfade",
					durationMs: clip.transitionIn.durationMs || 500,
				});
			}

			slides.push({
				id: slideId,
				type: slideType,
				title: slideTitle,
				durationMs,
				order: index,
				dirName: `slide_${String(index + 1).padStart(2, "0")}_${slideType}`,
				meta: {
					videoPath: clip.videoPath,
					webcamPath: clip.webcamPath ?? null,
					microphoneAudioPath: clip.microphoneAudioPath ?? null,
					systemAudioPath: clip.systemAudioPath ?? null,
					cursorTelemetryPath: clip.cursorTelemetryPath ?? null,
					wallpaper: clip.wallpaper || v1.editor?.wallpaper,
					zoomRegions: clip.zoomRegions || [],
					cropRegion: clip.cropRegion || v1.editor?.cropRegion,
					layoutPreset: clip.layoutPreset,
					layoutRegions: clip.layoutRegions || [],
					webcam: clip.webcam || v1.editor?.webcam,
					annotationRegions: clip.annotationRegions || [],
					audioRegions: clip.audioRegions || [],
					trimStartMs: clip.trimStartMs,
					trimEndMs: clip.trimEndMs,
					speed: clip.speed ?? 1,
					showCursor: clip.showCursor ?? true,
					assetFiles: clip.assetFiles || [],
					sceneSettings: clip.sceneSettings,
				},
			});
		});
	} else {
		// Case B: Single video project without explicit clips array
		const slideId = `slide-1-${Date.now()}`;
		const durationMs = (editor?.totalTimelineMs as number) || 10000;
		const rawV1 = v1 as unknown as Record<string, unknown>;

		slides.push({
			id: slideId,
			type: "record",
			title: "Main Recording",
			durationMs,
			order: 0,
			dirName: "slide_01_record",
			meta: {
				videoPath: v1.videoPath,
				webcamPath: (rawV1.webcamPath as string | null) ?? v1.editor?.webcam?.sourcePath ?? null,
				microphoneAudioPath: (rawV1.microphoneAudioPath as string | null) ?? null,
				systemAudioPath: (rawV1.systemAudioPath as string | null) ?? null,
				cursorTelemetryPath: (rawV1.cursorTelemetryPath as string | null) ?? null,
				wallpaper: v1.editor?.wallpaper,
				zoomRegions: v1.editor?.zoomRegions || [],
				cropRegion: v1.editor?.cropRegion,
				webcam: v1.editor?.webcam,
				layoutPreset: (editor?.layoutPreset as string) || v1.editor?.layoutRegions?.[0]?.preset,
				layoutRegions: v1.editor?.layoutRegions || [],
				annotationRegions: v1.editor?.annotationRegions || [],
				audioRegions: v1.editor?.audioRegions || [],
				speedRegions: v1.editor?.speedRegions || [],
				trimRegions: v1.editor?.trimRegions || [],
				showCursor: true,
			},
		});
	}

	return {
		version: 2,
		projectId,
		title,
		canvas: {
			width,
			height,
			fps,
			aspectRatio,
		},
		slides,
		transitions,
		globalAudioTracks: [],
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
}
