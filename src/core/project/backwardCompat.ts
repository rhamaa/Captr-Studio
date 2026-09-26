import type { LegacyEditorProjectData } from "@/components/video-editor/projectPersistence";
import {
	DEFAULT_LAYOUT_SCENE_EASING,
	DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
	type LegacyClipEntry,
} from "@/components/video-editor/types";
import { createDefaultMotionMeta, type MotionSlideMeta } from "@/slides/motion/schema";
import { createDefaultRecordMeta, type RecordSlideMeta } from "@/slides/record/schema";
import { createDefaultVideoMeta, type VideoSlideMeta } from "@/slides/video/schema";
import type { ProjectV2Data, SlideData, SlideTransition, TransitionType } from "../slides/types";
import { isProjectV2Data } from "./projectValidation";

function migrateRecordMeta(
	clip: LegacyClipEntry,
	editor: LegacyEditorProjectData["editor"],
	useEditorState = false,
): RecordSlideMeta {
	const defaults = createDefaultRecordMeta();
	const editorSettings = useEditorState ? editor : undefined;
	const trimRegions = editorSettings?.trimRegions?.length
		? editorSettings.trimRegions
		: clip.trimStartMs !== undefined && clip.trimEndMs !== undefined
			? [{ id: `trim-${clip.id}`, startMs: clip.trimStartMs, endMs: clip.trimEndMs }]
			: defaults.trimRegions;
	const speedRegions = editorSettings?.speedRegions?.length
		? editorSettings.speedRegions
		: clip.speed !== undefined && clip.speed !== 1
			? [
					{
						id: `speed-${clip.id}`,
						startMs: clip.trimStartMs ?? 0,
						endMs: clip.trimEndMs ?? clip.durationMs,
						speed: clip.speed,
					},
				]
			: defaults.speedRegions;

	return {
		...defaults,
		videoPath: clip.videoPath || undefined,
		webcamPath: clip.webcamPath ?? null,
		microphoneAudioPath: clip.microphoneAudioPath ?? null,
		systemAudioPath: clip.systemAudioPath ?? null,
		cursorTelemetryPath: clip.cursorTelemetryPath ?? null,
		cursorTelemetry: clip.cursorTelemetry ?? null,
		wallpaper: clip.wallpaper || editor.wallpaper || defaults.wallpaper,
		shadowIntensity:
			clip.sceneSettings?.shadowIntensity ??
			editorSettings?.shadowIntensity ??
			defaults.shadowIntensity,
		backgroundBlur:
			clip.sceneSettings?.backgroundBlur ??
			editorSettings?.backgroundBlur ??
			defaults.backgroundBlur,
		borderRadius:
			clip.sceneSettings?.borderRadius ??
			editorSettings?.borderRadius ??
			defaults.borderRadius,
		padding: clip.sceneSettings?.padding ?? editorSettings?.padding ?? defaults.padding,
		cropRegion: clip.cropRegion ?? editor.cropRegion,
		zoomRegions: clip.zoomRegions ?? editorSettings?.zoomRegions ?? defaults.zoomRegions,
		clipRegions: editorSettings?.clipRegions ?? defaults.clipRegions,
		trimRegions,
		speedRegions,
		layoutRegions: clip.layoutRegions?.length
			? clip.layoutRegions
			: clip.layoutPreset
				? [
						{
							id: `layout-${clip.id}`,
							startMs: 0,
							endMs: Math.max(1, clip.durationMs),
							preset: clip.layoutPreset,
							transitionMs: DEFAULT_LAYOUT_SCENE_TRANSITION_MS,
							easing: DEFAULT_LAYOUT_SCENE_EASING,
						},
					]
				: (editorSettings?.layoutRegions ?? defaults.layoutRegions),
		annotationRegions:
			clip.annotationRegions ??
			editorSettings?.annotationRegions ??
			defaults.annotationRegions,
		audioRegions: clip.audioRegions ?? editorSettings?.audioRegions ?? defaults.audioRegions,
		webcam: clip.webcam ?? editor.webcam ?? defaults.webcam,
		showCursor: clip.showCursor ?? editorSettings?.showCursor ?? defaults.showCursor,
		cursorSmoothing: editorSettings?.cursorSmoothing ?? defaults.cursorSmoothing,
		cursorStyle: editorSettings?.cursorStyle ?? defaults.cursorStyle,
		cursorSize: editorSettings?.cursorSize ?? defaults.cursorSize,
		cursorClickBounce: editorSettings?.cursorClickBounce ?? defaults.cursorClickBounce,
		cursorSway: editorSettings?.cursorSway ?? defaults.cursorSway,
		cameraPerspectiveTilt:
			editorSettings?.cameraPerspectiveTilt ?? defaults.cameraPerspectiveTilt,
		zoomMotionBlur: editorSettings?.zoomMotionBlur ?? defaults.zoomMotionBlur,
		connectZooms: editorSettings?.connectZooms ?? defaults.connectZooms,
		zoomInDurationMs: editorSettings?.zoomInDurationMs ?? defaults.zoomInDurationMs,
		zoomOutDurationMs: editorSettings?.zoomOutDurationMs ?? defaults.zoomOutDurationMs,
		frame: clip.sceneSettings?.frame ?? editorSettings?.frame ?? defaults.frame,
	};
}

function migrateVideoMeta(clip: LegacyClipEntry): VideoSlideMeta {
	if (clip.videoMeta) {
		return {
			...clip.videoMeta,
			videoTracks: clip.videoMeta.videoTracks.map((track) => ({
				...track,
				clips: track.clips.map((item) => ({ ...item })),
			})),
			audioTracks: clip.videoMeta.audioTracks.map((track) => ({ ...track })),
			textOverlays: clip.videoMeta.textOverlays.map((overlay) => ({
				...overlay,
				position: { ...overlay.position },
			})),
			mediaPool: clip.videoMeta.mediaPool.map((asset) => ({ ...asset })),
		};
	}

	const defaults = createDefaultVideoMeta();
	const videoClip = {
		id: clip.id,
		title: clip.label || "Video",
		sourcePath: clip.videoPath,
		startOffsetMs: 0,
		durationMs: clip.durationMs,
		...(clip.trimStartMs !== undefined ? { trimStartMs: clip.trimStartMs } : {}),
		...(clip.trimEndMs !== undefined ? { trimEndMs: clip.trimEndMs } : {}),
		speedMultiplier: clip.speed ?? 1,
		volume: 1,
	};
	const audioTracks = (clip.audioRegions ?? []).map((region) => ({
		id: region.id,
		name: `Audio ${region.id}`,
		sourcePath: region.audioPath,
		startOffsetMs: region.startMs,
		durationMs: Math.max(0, region.endMs - region.startMs),
		volume: region.volume,
	}));
	if (clip.microphoneAudioPath) {
		audioTracks.push({
			id: `mic-${clip.id}`,
			name: "Microphone",
			sourcePath: clip.microphoneAudioPath,
			startOffsetMs: 0,
			durationMs: clip.durationMs,
			volume: 1,
		});
	}
	if (clip.systemAudioPath) {
		audioTracks.push({
			id: `system-${clip.id}`,
			name: "System Audio",
			sourcePath: clip.systemAudioPath,
			startOffsetMs: 0,
			durationMs: clip.durationMs,
			volume: 1,
		});
	}

	return {
		...defaults,
		videoTracks: defaults.videoTracks.map((track, index) =>
			index === 0 ? { ...track, clips: [videoClip] } : track,
		),
		audioTracks,
		textOverlays: (clip.annotationRegions ?? [])
			.filter((region) => region.type === "text")
			.map((region) => ({
				id: region.id,
				text: region.textContent ?? region.content,
				startOffsetMs: region.startMs,
				durationMs: Math.max(0, region.endMs - region.startMs),
				position: { x: region.position.x, y: region.position.y },
				fontSize: region.style.fontSize,
				color: region.style.color,
			})),
		mediaPool: (clip.assetFiles ?? []).map(({ id, name, path, type }) => ({
			id,
			name,
			path,
			type,
		})),
	};
}

function migrateMotionMeta(clip: LegacyClipEntry): MotionSlideMeta {
	return { ...(clip.motionMeta ?? createDefaultMotionMeta()) };
}

/**
 * Checks whether an incoming project object is in V2 slide-based format.
 */
export function isProjectV2(data: unknown): data is ProjectV2Data {
	return isProjectV2Data(data);
}

/**
 * Migrates a legacy V1 monolithic project data structure to the V2 Slide-Based format.
 */
export function migrateV1ProjectToV2(v1: LegacyEditorProjectData): ProjectV2Data {
	const projectId = v1.projectId || `proj-${Date.now()}`;
	const title = (v1 as unknown as { title?: string }).title || "Untitled Project";

	const editor = v1.editor as
		| (Record<string, unknown> & Partial<LegacyEditorProjectData["editor"]>)
		| undefined;
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
			let slideType: "record" | "video" | "motion";
			if (clip.slideMode === "motion") {
				slideType = "motion";
			} else if (clip.slideMode === "video" || clip.slideMode === "record") {
				slideType = clip.slideMode;
			} else {
				slideType = clip.origin === "uploaded" ? "video" : "record";
			}

			const slideTitle = clip.label || `Slide ${index + 1}`;
			const durationMs = Math.max(0, clip.durationMs || 5000);
			const slideFields = {
				id: slideId,
				title: slideTitle,
				durationMs,
				order: index,
				dirName: `slide_${String(index + 1).padStart(2, "0")}_${slideType}`,
			};

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

			if (slideType === "motion") {
				slides.push({ ...slideFields, type: "motion", meta: migrateMotionMeta(clip) });
			} else if (slideType === "video") {
				slides.push({ ...slideFields, type: "video", meta: migrateVideoMeta(clip) });
			} else {
				slides.push({
					...slideFields,
					type: "record",
					meta: migrateRecordMeta(clip, v1.editor),
				});
			}
		});
	} else {
		// Case B: Single video project without explicit clips array
		const slideId = `slide-1-${Date.now()}`;
		const durationMs = (editor?.totalTimelineMs as number) || 10000;
		const rawV1 = v1 as unknown as Record<string, unknown>;
		const legacyClip: LegacyClipEntry = {
			id: slideId,
			videoPath: v1.videoPath,
			webcamPath:
				(rawV1.webcamPath as string | null) ?? v1.editor?.webcam?.sourcePath ?? null,
			microphoneAudioPath: (rawV1.microphoneAudioPath as string | null) ?? null,
			systemAudioPath: (rawV1.systemAudioPath as string | null) ?? null,
			cursorTelemetryPath: (rawV1.cursorTelemetryPath as string | null) ?? null,
			cursorTelemetry: (rawV1.cursorTelemetry as LegacyClipEntry["cursorTelemetry"]) ?? null,
			startMsOffset: 0,
			durationMs,
		};

		slides.push({
			id: slideId,
			type: "record",
			title: "Main Recording",
			durationMs,
			order: 0,
			dirName: "slide_01_record",
			meta: migrateRecordMeta(legacyClip, v1.editor, true),
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
