import { describe, expect, it } from "vitest";
import {
	buildSceneClipRegions,
	createRecordedClip,
	createUploadedClip,
	findClipAtTimelineTime,
	formatClipDuration,
	getClipLocalTimeMs,
	getEffectiveClipSettings,
	isRecordedClip,
	type ProjectDefaultSettings,
	recalculateClipOffsets,
	reorderClips,
} from "./clipsUtils";
import type { ClipEntry, CropRegion, WebcamOverlaySettings } from "./types";

describe("clipsUtils", () => {
	it("preserves transition and audio edits when scenes are reordered", () => {
		const clips: ClipEntry[] = [
			{ id: "a", videoPath: "a.mp4", startMsOffset: 0, durationMs: 1000 },
			{
				id: "b",
				videoPath: "b.mp4",
				startMsOffset: 1000,
				durationMs: 2000,
				transitionIn: { type: "slide-left", durationMs: 300 },
			},
		];
		const reordered = reorderClips(clips, "b", "left");
		const regions = buildSceneClipRegions(reordered, [
			{
				id: "a",
				startMs: 0,
				endMs: 1000,
				speed: 2,
				muted: true,
				showSourceAudio: true,
				transitionIn: "fade-white",
				transitionInDurationMs: 500,
			},
		]);
		expect(regions[0]).toMatchObject({
			id: "b",
			startMs: 0,
			endMs: 2000,
			transitionIn: "slide-left",
		});
		expect(regions[1]).toMatchObject({
			id: "a",
			startMs: 2000,
			endMs: 3000,
			speed: 2,
			muted: true,
			showSourceAudio: true,
			transitionIn: "fade-white",
			transitionInDurationMs: 500,
		});
	});

	const defaultSettings: ProjectDefaultSettings = {
		wallpaper: "linear-gradient(to right, #000, #111)",
		cropRegion: { x: 0, y: 0, width: 1, height: 1 },
		layoutRegions: [],
		webcam: {
			enabled: false,
			position: "bottom-right",
			size: "medium",
			shape: "circle",
			mirrored: false,
			shadow: true,
			sourcePath: null,
			timeOffsetMs: 0,
		},
		zoomRegions: [],
	};

	const testClips: ClipEntry[] = [
		{
			id: "clip-1",
			videoPath: "C:/vids/take1.mp4",
			startMsOffset: 0,
			durationMs: 10000,
			label: "Take 1",
			wallpaper: "#ff0000",
		},
		{
			id: "clip-2",
			videoPath: "C:/vids/take2.mp4",
			startMsOffset: 10000,
			durationMs: 25000,
			label: "Take 2",
		},
		{
			id: "clip-3",
			videoPath: "C:/vids/take3.mp4",
			startMsOffset: 35000,
			durationMs: 15000,
			label: "Take 3",
		},
	];

	describe("formatClipDuration", () => {
		it("formats milliseconds correctly", () => {
			expect(formatClipDuration(0)).toBe("0:00");
			expect(formatClipDuration(9500)).toBe("0:09");
			expect(formatClipDuration(65000)).toBe("1:05");
			expect(formatClipDuration(3600000)).toBe("60:00");
		});
	});

	describe("reorderClips", () => {
		it("moves a clip to the left and updates sequential offsets", () => {
			const reordered = reorderClips(testClips, "clip-2", "left");
			expect(reordered[0].id).toBe("clip-2");
			expect(reordered[0].startMsOffset).toBe(0);
			expect(reordered[1].id).toBe("clip-1");
			expect(reordered[1].startMsOffset).toBe(25000);
			expect(reordered[2].id).toBe("clip-3");
			expect(reordered[2].startMsOffset).toBe(35000);
		});

		it("moves a clip to the right and updates sequential offsets", () => {
			const reordered = reorderClips(testClips, "clip-1", "right");
			expect(reordered[0].id).toBe("clip-2");
			expect(reordered[0].startMsOffset).toBe(0);
			expect(reordered[1].id).toBe("clip-1");
			expect(reordered[1].startMsOffset).toBe(25000);
			expect(reordered[2].id).toBe("clip-3");
			expect(reordered[2].startMsOffset).toBe(35000);
		});

		it("does nothing when moving leftmost clip left", () => {
			const reordered = reorderClips(testClips, "clip-1", "left");
			expect(reordered).toEqual(testClips);
		});

		it("does nothing when moving rightmost clip right", () => {
			const reordered = reorderClips(testClips, "clip-3", "right");
			expect(reordered).toEqual(testClips);
		});
	});

	describe("findClipAtTimelineTime", () => {
		it("locates the active clip and local time offset", () => {
			const hit1 = findClipAtTimelineTime(testClips, 5000);
			expect(hit1?.clip.id).toBe("clip-1");
			expect(hit1?.localTimeMs).toBe(5000);
			expect(hit1?.index).toBe(0);

			const hit2 = findClipAtTimelineTime(testClips, 12500);
			expect(hit2?.clip.id).toBe("clip-2");
			expect(hit2?.localTimeMs).toBe(2500);
			expect(hit2?.index).toBe(1);

			const hit3 = findClipAtTimelineTime(testClips, 40000);
			expect(hit3?.clip.id).toBe("clip-3");
			expect(hit3?.localTimeMs).toBe(5000);
			expect(hit3?.index).toBe(2);

			// Exact start boundary
			const hitStart = findClipAtTimelineTime(testClips, 0);
			expect(hitStart?.clip.id).toBe("clip-1");
			expect(hitStart?.localTimeMs).toBe(0);

			// Exact boundary between clip 1 and clip 2 (10000ms)
			const hitBoundary = findClipAtTimelineTime(testClips, 10000);
			expect(hitBoundary?.clip.id).toBe("clip-2");
			expect(hitBoundary?.localTimeMs).toBe(0);

			// Beyond the end of the last clip clamps to last clip
			const hitBeyond = findClipAtTimelineTime(testClips, 999999);
			expect(hitBeyond?.clip.id).toBe("clip-3");
			expect(hitBeyond?.localTimeMs).toBe(999999 - 35000);
		});
	});

	describe("getEffectiveClipSettings", () => {
		it("uses clip override when defined", () => {
			const settings = getEffectiveClipSettings(testClips[0], defaultSettings);
			expect(settings.wallpaper).toBe("#ff0000"); // overridden
			expect(settings.cropRegion).toEqual(defaultSettings.cropRegion); // inherited
		});

		it("inherits project defaults when clip has no overrides", () => {
			const settings = getEffectiveClipSettings(testClips[1], defaultSettings);
			expect(settings.wallpaper).toBe(defaultSettings.wallpaper);
			expect(settings.cropRegion).toEqual(defaultSettings.cropRegion);
		});
	});

	describe("Clip Isolation and Origin Factories", () => {
		it("creates recorded clip with webcam and audio sidecars", () => {
			const recClip = createRecordedClip({
				id: "take-1",
				videoPath: "C:/recordings/screen.mp4",
				webcamPath: "C:/recordings/webcam.mp4",
				microphoneAudioPath: "C:/recordings/mic.wav",
				systemAudioPath: "C:/recordings/sys.wav",
				startMsOffset: 0,
				durationMs: 12000,
				label: "Take 1",
			});
			expect(recClip.origin).toBe("recorded");
			expect(isRecordedClip(recClip)).toBe(true);
			expect(recClip.webcamPath).toBe("C:/recordings/webcam.mp4");
			expect(recClip.microphoneAudioPath).toBe("C:/recordings/mic.wav");
			expect(recClip.showCursor).toBe(true);
		});

		it("creates uploaded clip strictly isolated from webcam and cursor sidecars", () => {
			const upClip = createUploadedClip({
				id: "clip-file-1",
				videoPath: "C:/downloads/external.mp4",
				startMsOffset: 12000,
				durationMs: 8000,
				label: "Video 1",
			});
			expect(upClip.origin).toBe("uploaded");
			expect(isRecordedClip(upClip)).toBe(false);
			expect(upClip.webcamPath).toBeNull();
			expect(upClip.webcam?.enabled).toBe(false);
			expect(upClip.webcam?.sourcePath).toBeNull();
			expect(upClip.cursorTelemetry).toBeNull();
			expect(upClip.showCursor).toBe(false);
		});

		it("calculates local time within clip boundary correctly", () => {
			const clip: ClipEntry = {
				id: "c2",
				videoPath: "test.mp4",
				startMsOffset: 10000,
				durationMs: 5000,
			};
			expect(getClipLocalTimeMs(clip, 12000)).toBe(2000);
			expect(getClipLocalTimeMs(clip, 8000)).toBe(0); // clamped to 0
			expect(getClipLocalTimeMs(clip, 16000)).toBe(5000); // clamped to duration
		});
	});
});
