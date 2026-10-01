import { describe, expect, it } from "vitest";

import { normalizeClipEntries, normalizeSceneVisualSettings } from "./projectPersistence";
import {
	resolveSceneEditingState,
	sanitizeSectionForSlideMode,
	VALID_RECORD_SECTIONS,
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

const secondRecord: ClipEntry = {
	...record,
	id: "rec2",
	videoPath: "rec2.mp4",
	webcamPath: null,
	showCursor: false,
	zoomRegions: [],
	layoutRegions: [],
	webcam: { enabled: false, sourcePath: null },
	sceneSettings: normalizeSceneVisualSettings({ borderRadius: 0, shadowIntensity: 0 }),
};

describe("independent Record editors", () => {
	it("keeps Record effects independent between takes", () => {
		const before = structuredClone(record);
		const rec = resolveSceneEditingState(record);
		const vid = resolveSceneEditingState(secondRecord);

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

	it("round-trips independent visual settings and incoming transitions", () => {
		const clips = normalizeClipEntries(
			JSON.parse(
				JSON.stringify([
					record,
					{
						...secondRecord,
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
		// Record mode sanitization
		expect(sanitizeSectionForSlideMode("record", "media")).toBe("scene");
		expect(sanitizeSectionForSlideMode("record", "video-adjust")).toBe("scene");
		expect(sanitizeSectionForSlideMode("record", "scene")).toBe("scene");
		expect(sanitizeSectionForSlideMode("record", "layout")).toBe("layout");
		expect(sanitizeSectionForSlideMode("record", "zoom")).toBe("zoom");
		expect(sanitizeSectionForSlideMode("record", "cursor")).toBe("cursor");
		expect(sanitizeSectionForSlideMode("record", "webcam")).toBe("webcam");
	});

	it("preserves and normalizes assetFiles exclusively per slide without cross-slide leakage", () => {
		const clip1: ClipEntry = {
			...secondRecord,
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
			...secondRecord,
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
