import { describe, expect, it } from "vitest";
import { createUploadedClip, getEffectiveClipSettings } from "./clipsUtils";
import { normalizeClipEntries, normalizeSceneVisualSettings } from "./projectPersistence";
import {
	resolveSceneEditingState,
	sanitizeSectionForSlideMode,
	VALID_RECORD_SECTIONS,
	VALID_VIDEO_SECTIONS,
} from "./sceneEditing";
import type { ClipEntry, LayoutRegion } from "./types";

const record: ClipEntry = {
	id: "rec",
	origin: "recorded",
	videoPath: "rec.mp4",
	startMsOffset: 0,
	durationMs: 4000,
	zoomRegions: [{ id: "z", startMs: 0, endMs: 1000, depth: 2, focus: { cx: 0.5, cy: 0.5 } }],
	layoutRegions: [
		{
			id: "layout",
			startMs: 0,
			endMs: 1000,
			preset: "webcam-only",
			screen: { x: 0, y: 0, width: 1, height: 1 },
			webcam: { x: 0, y: 0, width: 1, height: 1 },
		},
	],
	webcamPath: "cam.mp4",
	showCursor: true,
	sceneSettings: normalizeSceneVisualSettings({ borderRadius: 30, shadowIntensity: 0.8 }),
};

const video = createUploadedClip({
	id: "vid",
	videoPath: "video.mp4",
	startMsOffset: 4000,
	durationMs: 2000,
	label: "Video",
});

describe("separate scene editors", () => {
	it("restores video with neutral defaults and leaves recording effects intact", () => {
		const before = structuredClone(record);
		const rec = resolveSceneEditingState(record);
		const vid = resolveSceneEditingState(video);

		expect(rec.zoomRegions).toHaveLength(1);
		expect(rec.layoutRegions).toHaveLength(1);

		expect(vid.zoomRegions).toEqual([]);
		expect(vid.layoutRegions).toEqual([]);
		expect(vid.showCursor).toBe(false);
		expect(vid.webcam.enabled).toBe(false);
		expect(vid.sceneSettings.borderRadius).toBe(0);
		expect(vid.sceneSettings.shadowIntensity).toBe(0);

		expect(resolveSceneEditingState(record).sceneSettings.borderRadius).toBe(30);
		expect(record).toEqual(before);
	});

	it("ignores stale recording metadata on a legacy video-mode scene", () => {
		const result = resolveSceneEditingState({ ...record, slideMode: "video" });
		expect(result.zoomRegions).toEqual([]);
		expect(result.layoutRegions).toEqual([]);
		expect(result.showCursor).toBe(false);
		expect(result.webcam.enabled).toBe(false);
	});

	it("round-trips independent visual settings and incoming transitions", () => {
		const clips = normalizeClipEntries(
			JSON.parse(
				JSON.stringify([
					record,
					{
						...video,
						sceneSettings: normalizeSceneVisualSettings({ borderRadius: 5 }),
						transitionIn: { type: "fade", durationMs: 300 },
					},
				]),
			),
		);
		expect(clips[0].sceneSettings?.borderRadius).toBe(30);
		expect(clips[1].sceneSettings?.borderRadius).toBe(5);
		expect(clips[1].transitionIn?.durationMs).toBe(300);
	});

	it("sanitizes effect sections according to slide mode", () => {
		// Video mode sanitization
		expect(sanitizeSectionForSlideMode("video", "layout")).toBe("media");
		expect(sanitizeSectionForSlideMode("video", "zoom")).toBe("media");
		expect(sanitizeSectionForSlideMode("video", "scene")).toBe("media");
		expect(sanitizeSectionForSlideMode("video", "cursor")).toBe("media");
		expect(sanitizeSectionForSlideMode("video", "webcam")).toBe("media");
		expect(sanitizeSectionForSlideMode("video", "media")).toBe("media");
		expect(sanitizeSectionForSlideMode("video", "video-adjust")).toBe("media");
		expect(sanitizeSectionForSlideMode("video", "transitions")).toBe("transitions");
		expect(sanitizeSectionForSlideMode("video", "unknown" as any)).toBe("media");

		// Record mode sanitization
		expect(sanitizeSectionForSlideMode("record", "media")).toBe("scene");
		expect(sanitizeSectionForSlideMode("record", "video-adjust")).toBe("scene");
		expect(sanitizeSectionForSlideMode("record", "scene")).toBe("scene");
		expect(sanitizeSectionForSlideMode("record", "layout")).toBe("layout");
		expect(sanitizeSectionForSlideMode("record", "zoom")).toBe("zoom");
		expect(sanitizeSectionForSlideMode("record", "cursor")).toBe("cursor");
		expect(sanitizeSectionForSlideMode("record", "webcam")).toBe("webcam");
		expect(sanitizeSectionForSlideMode("record", "transitions")).toBe("transitions");
		expect(sanitizeSectionForSlideMode("record", "unknown" as any)).toBe("scene");
	});

	it("prevents video clips from inheriting global default layout or zoom in getEffectiveClipSettings", () => {
		const globalDefaults = {
			layoutRegions: [
				{
					id: "global-layout",
					startMs: 0,
					endMs: 2000,
					preset: "split-screen" as const,
					screen: { x: 0, y: 0, width: 1, height: 1 },
					webcam: { x: 0, y: 0, width: 1, height: 1 },
				},
			],
			zoomRegions: [
				{
					id: "global-zoom",
					startMs: 0,
					endMs: 1500,
					depth: 1.5,
					focus: { cx: 0.5, cy: 0.5 },
				},
			],
			webcam: { enabled: true, position: "top-right" },
		};

		const effectiveVideo = getEffectiveClipSettings(video, globalDefaults);
		expect(effectiveVideo.layoutRegions).toEqual([]);
		expect(effectiveVideo.zoomRegions).toEqual([]);
		expect(effectiveVideo.webcam.enabled).toBe(false);

		const effectiveRecord = getEffectiveClipSettings(record, globalDefaults);
		expect(effectiveRecord.layoutRegions).toEqual(record.layoutRegions);
		expect(effectiveRecord.zoomRegions).toEqual(record.zoomRegions);
	});

	it("strips recording-specific artifacts from video clips during normalizeClipEntries but preserves transitionIn", () => {
		const dirtyVideoClip = {
			...video,
			layoutRegions: [
				{
					id: "leaked-layout",
					startMs: 0,
					endMs: 1000,
					preset: "split-screen" as const,
					screen: { x: 0, y: 0, width: 1, height: 1 },
					webcam: { x: 0, y: 0, width: 1, height: 1 },
				},
			],
			zoomRegions: [{ id: "leaked-zoom", startMs: 0, endMs: 1000 }],
			webcamPath: "leaked-webcam.mp4",
			cursorTelemetryPath: "leaked-cursor.json",
			showCursor: true,
			transitionIn: { type: "slide-left" as const, durationMs: 500 },
			transitionInDurationMs: 500,
		};

		const normalized = normalizeClipEntries([record, dirtyVideoClip as unknown as ClipEntry]);
		const cleanVideo = normalized[1];

		expect(cleanVideo.layoutRegions).toEqual([]);
		expect(cleanVideo.zoomRegions).toEqual([]);
		expect(cleanVideo.webcamPath).toBeNull();
		expect(cleanVideo.cursorTelemetryPath).toBeNull();
		expect(cleanVideo.showCursor).toBe(false);
		expect(cleanVideo.transitionIn).toEqual({ type: "slide-left", durationMs: 500 });
		expect(cleanVideo.transitionIn?.durationMs).toBe(500);

		// Record clip still retains its artifacts
		expect(normalized[0].layoutRegions).toHaveLength(1);
		expect(normalized[0].zoomRegions).toHaveLength(1);
		expect(normalized[0].showCursor).toBe(true);
	});

	it("preserves and normalizes assetFiles exclusively per slide without cross-slide leakage", () => {
		const clip1: ClipEntry = {
			...video,
			id: "vid-1",
			assetFiles: [
				{
					id: "asset-1",
					name: "b-roll.mp4",
					path: "C:/media/b-roll.mp4",
					size: 1024,
					mtimeMs: 123456789,
					type: "video",
					subfolder: "Video Layers",
				},
			],
		};

		const clip2: ClipEntry = {
			...video,
			id: "vid-2",
			assetFiles: [
				{
					id: "asset-2",
					name: "voiceover.mp3",
					path: "C:/media/voiceover.mp3",
					size: 2048,
					mtimeMs: 987654321,
					type: "audio",
					subfolder: "Audio & Voiceovers",
				},
			],
		};

		const normalized = normalizeClipEntries([clip1, clip2]);

		// Clip 1 should only contain asset-1
		expect(normalized[0].assetFiles).toHaveLength(1);
		expect(normalized[0].assetFiles?.[0].id).toBe("asset-1");
		expect(normalized[0].assetFiles?.[0].subfolder).toBe("Video Layers");

		// Clip 2 should only contain asset-2
		expect(normalized[1].assetFiles).toHaveLength(1);
		expect(normalized[1].assetFiles?.[0].id).toBe("asset-2");
		expect(normalized[1].assetFiles?.[0].subfolder).toBe("Audio & Voiceovers");

		// No shared references or leakage
		expect(normalized[0].assetFiles).not.toBe(normalized[1].assetFiles);
	});
});
