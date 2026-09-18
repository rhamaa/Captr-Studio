import { describe, expect, it } from "vitest";
import {
	createProjectData,
	normalizeClipEntries,
	validateProjectData,
} from "./projectPersistence";
import { hasUnsavedProjectChanges } from "./projectDirtyState";
import type { ClipEntry } from "./types";
import { CLIP_TRANSITION_TYPES } from "./transitionContract";

describe("projectPersistence - Multi-Clip Persistence", () => {
	it.each(CLIP_TRANSITION_TYPES)("round-trips the supported %s transition through project JSON", (type) => {
		const clips = normalizeClipEntries([{ id: "scene", videoPath: "take.mp4", durationMs: 3000, transitionToNext: { type, durationMs: 650 } }]);
		const project = createProjectData("take.mp4", {}, "test", clips);
		const reopened = normalizeClipEntries(JSON.parse(JSON.stringify(project)).clips);
		expect(reopened[0].transitionIn).toEqual({ type, durationMs: 650 });
		expect(reopened[0].transitionToNext).toBeUndefined();
	});

	it("normalizes empty or non-array clips safely", () => {
		expect(normalizeClipEntries(null)).toEqual([]);
		expect(normalizeClipEntries(undefined)).toEqual([]);
		expect(normalizeClipEntries("not-an-array")).toEqual([]);
		expect(normalizeClipEntries([])).toEqual([]);
	});

	it("normalizes recorded take and uploaded clips with correct defaults", () => {
		const rawClips = [
			{
				id: "clip-1",
				origin: "recorded",
				videoPath: "C:/recordings/take1.mp4",
				webcamPath: "C:/recordings/take1_webcam.mp4",
				microphoneAudioPath: "C:/recordings/take1_mic.wav",
				startMsOffset: 0,
				durationMs: 4500,
				label: "Intro",
				wallpaper: "gradient-mesh",
				showCursor: true,
			},
			{
				id: "clip-2",
				origin: "uploaded",
				videoPath: "D:/videos/external.mp4",
				startMsOffset: 4500,
				durationMs: 12000,
				label: "B-Roll",
				showCursor: false,
				transitionToNext: {
					type: "crossfade",
					durationMs: 400,
				},
			},
		];

		const normalized = normalizeClipEntries(rawClips);
		expect(normalized).toHaveLength(2);

		const take1 = normalized[0];
		expect(take1.id).toBe("clip-1");
		expect(take1.origin).toBe("recorded");
		expect(take1.videoPath).toBe("C:/recordings/take1.mp4");
		expect(take1.webcamPath).toBe("C:/recordings/take1_webcam.mp4");
		expect(take1.microphoneAudioPath).toBe("C:/recordings/take1_mic.wav");
		expect(take1.startMsOffset).toBe(0);
		expect(take1.durationMs).toBe(4500);
		expect(take1.label).toBe("Intro");
		expect(take1.wallpaper).toBe("gradient-mesh");
		expect(take1.showCursor).toBe(true);

		const take2 = normalized[1];
		expect(take2.id).toBe("clip-2");
		expect(take2.origin).toBe("uploaded");
		expect(take2.videoPath).toBe("D:/videos/external.mp4");
		expect(take2.webcamPath).toBeNull();
		expect(take2.showCursor).toBe(false);
		expect(take2.transitionIn).toEqual({
			type: "none",
			durationMs: 400,
		});
	});

	it("validates multi-clip projects correctly even if top-level videoPath is absent", () => {
		const multiClipProject = {
			version: 1,
			projectId: "proj-123",
			videoPath: "",
			clips: [
				{
					id: "clip-1",
					videoPath: "C:/recordings/clip1.mp4",
					startMsOffset: 0,
					durationMs: 3000,
				},
			],
			editor: {
				wallpaper: "default",
			},
		};

		expect(validateProjectData(multiClipProject)).toBe(true);
	});

	it("createProjectData resolves videoPath from clips[0] when omitted", () => {
		const clips: ClipEntry[] = [
			{
				id: "clip-1",
				origin: "recorded",
				videoPath: "C:/recordings/take1.mp4",
				startMsOffset: 0,
				durationMs: 5000,
				label: "Take 1",
			},
			{
				id: "clip-2",
				origin: "uploaded",
				videoPath: "C:/recordings/take2.mp4",
				startMsOffset: 5000,
				durationMs: 6000,
				label: "Video 2",
			},
		];

		const project = createProjectData("", {}, "proj-abc", clips);
		expect(project.videoPath).toBe("C:/recordings/take1.mp4");
		expect(project.clips).toHaveLength(2);
		expect(project.clips?.[1].label).toBe("Video 2");
	});

	it("detects unsaved project changes when multi-clip properties are modified", () => {
		const baseClips: ClipEntry[] = [
			{
				id: "clip-1",
				origin: "recorded",
				videoPath: "C:/take1.mp4",
				startMsOffset: 0,
				durationMs: 5000,
				wallpaper: "wallpaper-1",
			},
		];

		const snapshotA = createProjectData("C:/take1.mp4", {}, "proj-1", baseClips);
		const snapshotIdentical = createProjectData("C:/take1.mp4", {}, "proj-1", [
			{ ...baseClips[0] },
		]);

		expect(hasUnsavedProjectChanges(snapshotA, snapshotIdentical)).toBe(false);

		// Modified wallpaper on clip-1
		const snapshotModified = createProjectData("C:/take1.mp4", {}, "proj-1", [
			{ ...baseClips[0], wallpaper: "wallpaper-2" },
		]);
		expect(hasUnsavedProjectChanges(snapshotModified, snapshotA)).toBe(true);

		// Added new clip
		const snapshotAddedClip = createProjectData("C:/take1.mp4", {}, "proj-1", [
			baseClips[0],
			{
				id: "clip-2",
				origin: "recorded",
				videoPath: "C:/take2.mp4",
				startMsOffset: 5000,
				durationMs: 4000,
			},
		]);
		expect(hasUnsavedProjectChanges(snapshotAddedClip, snapshotA)).toBe(true);
	});
});
