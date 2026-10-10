import { describe, expect, it } from "vitest";
import {
	applyAddBRollOrOverlay,
	applyRemoveSilence,
	applySplitClip,
	applyTrimClip,
	formatProjectContext,
} from "./agentTools";
import { createTimelineProject, placeAsset, registerMedia } from "./commands";
import { getStoryEditProject } from "./storyOwnership";
import { ownershipFixture } from "./storyOwnership.fixtures";
import type { AssetTranscript } from "./transcriptTypes";
import type { MediaAsset } from "./types";

describe("agentTools", () => {
	it("creates scoped Shape output inline with no media allocation", () => {
		const view = getStoryEditProject(ownershipFixture(), { kind: "artboard", artboardId: "A" });
		const result = applyAddBRollOrOverlay(view, {
			type: "shape",
			shapeDefinition: {
				kind: "ellipse",
				width: 100,
				height: 60,
				style: { fill: "#ffffff", stroke: null },
			},
			startUs: 0,
			durationUs: 2_000_000,
		});
		const clip = result.project.tracks
			.flatMap((t) => t.clips)
			.find((c) => c.id === result.clipId)!;
		expect(clip.content).toMatchObject({ kind: "shape", shapeDefinition: { kind: "ellipse" } });
		expect(clip.assetId).toBeUndefined();
		expect(clip.sourceOutUs).toBe(2_000_000);
		expect(result.project.assets).toEqual(view.assets);
	});
	function buildTestProject() {
		let project = createTimelineProject("proj-1", "Test Project");
		const videoAsset: MediaAsset = {
			id: "asset-v1",
			kind: "video",
			name: "Demo Video",
			durationUs: 10_000_000,
			width: 1920,
			height: 1080,
			source: {
				path: "assets/asset-v1/video.mp4",
				durationUs: 10_000_000,
				offsetUs: 0,
			},
		};
		project = registerMedia(project, videoAsset);
		project = placeAsset(project, "asset-v1", "visual-1", 0, {
			clipId: "clip-1",
		});
		return { project, videoAsset };
	}

	it("formats project context including transcripts and artboards", () => {
		const { project } = buildTestProject();
		const transcripts: Record<string, AssetTranscript> = {
			"asset-v1": {
				assetId: "asset-v1",
				language: "en",
				durationUs: 10_000_000,
				segments: [
					{
						id: 1,
						startUs: 0,
						endUs: 3_000_000,
						text: "Hello world this is a test",
						words: [
							{ word: "Hello", startUs: 0, endUs: 500_000 },
							{ word: "world", startUs: 600_000, endUs: 1_200_000 },
							{ word: "test", startUs: 2_500_000, endUs: 3_000_000 },
						],
					},
				],
				createdAt: "",
			},
		};

		const context = formatProjectContext(project, transcripts, {
			playheadUs: 1_000_000,
			selection: ["clip-1"],
		});

		expect(context.title).toBe("Test Project");
		expect(context.tracks.length).toBeGreaterThan(0);
		expect(context.tracks[0].clips.length).toBe(1);
		expect(context.tracks[0].clips[0].id).toBe("clip-1");
		expect(context.transcripts["asset-v1"].fullText).toBe("Hello world this is a test");
		expect(context.playhead.playheadUs).toBe(1_000_000);
		expect(context.selection.selectedClipIds).toContain("clip-1");
		expect(context.cursorTelemetry).toBeDefined();
		expect(Array.isArray(context.cursorTelemetry)).toBe(true);
	});

	it("splits clip atomically into two contiguous clips", () => {
		const { project } = buildTestProject();
		const result = applySplitClip(project, "clip-1", 4_000_000);

		const track = result.project.tracks.find((t) => t.id === "visual-1")!;
		expect(track.clips.length).toBe(2);

		const left = track.clips.find((c) => c.id === "clip-1")!;
		const right = track.clips.find((c) => c.id === result.rightClipId)!;

		expect(left.startUs).toBe(0);
		expect(left.sourceOutUs).toBe(4_000_000);
		expect(right.startUs).toBe(4_000_000);
		expect(right.sourceInUs).toBe(4_000_000);
	});

	it("trims clip in/out/start atomically", () => {
		const { project } = buildTestProject();
		const trimmed = applyTrimClip(project, "clip-1", {
			sourceInUs: 1_000_000,
			sourceOutUs: 7_000_000,
			startUs: 500_000,
		});

		const clip = trimmed.tracks[0].clips[0];
		expect(clip.sourceInUs).toBe(1_000_000);
		expect(clip.sourceOutUs).toBe(7_000_000);
		expect(clip.startUs).toBe(500_000);
	});

	it("removes silence gaps from transcript and ripples remaining timeline", () => {
		const { project } = buildTestProject();
		const transcripts: Record<string, AssetTranscript> = {
			"asset-v1": {
				assetId: "asset-v1",
				language: "en",
				durationUs: 10_000_000,
				segments: [
					{
						id: 1,
						startUs: 0,
						endUs: 8_000_000,
						text: "Part one part two part three",
						words: [
							{ word: "Part", startUs: 0, endUs: 500_000 },
							{ word: "one", startUs: 600_000, endUs: 1_000_000 },
							// Pause 1: 2.0s between 1.0s and 3.0s (> 800ms)
							{ word: "part", startUs: 3_000_000, endUs: 3_500_000 },
							{ word: "two", startUs: 3_600_000, endUs: 4_000_000 },
							// Pause 2: 1.5s between 4.0s and 5.5s (> 800ms)
							{ word: "part", startUs: 5_500_000, endUs: 6_000_000 },
							{ word: "three", startUs: 6_100_000, endUs: 7_000_000 },
						],
					},
				],
				createdAt: "",
			},
		};

		const res = applyRemoveSilence(project, transcripts, { minDurationMs: 800 });
		expect(res.cutsCount).toBeGreaterThanOrEqual(2);
		expect(res.savedDurationUs).toBeGreaterThanOrEqual(3_500_000);
		expect(res.project.tracks[0].clips.length).toBeGreaterThanOrEqual(3);
	});

	it("adds text overlay or B-Roll onto visual track", () => {
		const { project } = buildTestProject();
		const res = applyAddBRollOrOverlay(project, {
			type: "text",
			text: "Highlight Key Topic",
			startUs: 1_000_000,
			durationUs: 3_000_000,
		});

		expect(res.clipId).toBeTruthy();
		const hasTextTrack = res.project.tracks.some((t) =>
			t.clips.some((c) => c.id === res.clipId),
		);
		expect(hasTextTrack).toBe(true);
		const clip = res.project.tracks.flatMap((t) => t.clips).find((c) => c.id === res.clipId)!;
		expect(clip.content).toMatchObject({
			kind: "text",
			text: { content: "Highlight Key Topic" },
		});
		expect(clip.assetId).toBeUndefined();
		expect(clip.sourceOutUs).toBe(3_000_000);
		expect(res.project.assets).toEqual(project.assets);
	});
});
