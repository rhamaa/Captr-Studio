import { expect, it } from "vitest";
import { createTimelineProject, registerMedia, updateTrack } from "@/core/timeline/commands";
import {
	applyClipGesture,
	assetDropCommand,
	snapTimelineTime,
	timelineActionCommand,
} from "./timelineInteractions";

const project = () =>
	registerMedia(createTimelineProject("p", "P"), {
		id: "a",
		kind: "video",
		name: "Video",
		durationUs: 10_000_000,
		width: 1920,
		height: 1080,
		source: { path: "video.mp4", durationUs: 10_000_000, offsetUs: 0 },
	});
it("places drag payload by stable asset ID, trims/moves/splits and rejects lock changes", () => {
	const p = assetDropCommand("a", "visual-1", 2_000_000, {
		clipId: "c",
		compositionId: "unused",
	})(project());
	expect(p.tracks[0].clips[0].startUs).toBe(2_000_000);
	const trimmed = applyClipGesture(p, "c", { kind: "trim-in", deltaUs: 1_000_000 });
	expect(trimmed.tracks[0].clips[0]).toMatchObject({ startUs: 3_000_000, sourceInUs: 1_000_000 });
	const moved = applyClipGesture(trimmed, "c", {
		kind: "move",
		deltaUs: 2_000_000,
		trackId: "visual-1",
	});
	expect(moved.tracks[0].clips[0].startUs).toBe(5_000_000);
	const split = timelineActionCommand("split", ["c"], 7_000_000, {
		clipId: "right",
		compositionId: "unused",
	})(moved);
	expect(split.tracks[0].clips).toHaveLength(2);
	expect(split.assets).toHaveLength(1);
	expect(() =>
		applyClipGesture(updateTrack(p, "visual-1", { locked: true }), "c", {
			kind: "move",
			deltaUs: 1_000_000,
		}),
	).toThrow(/locked/);
	expect(() => assetDropCommand("video.mp4", "visual-1", 0, { clipId: "x" })(p)).toThrow(
		/asset/i,
	);
});
it("snaps playhead and clip edges within eight screen pixels at each zoom scale", () => {
	const p = assetDropCommand("a", "visual-1", 5_000_000, { clipId: "c" })(project());
	expect(snapTimelineTime(4_950_000, p, 2_000_000, 100)).toBe(5_000_000);
	expect(snapTimelineTime(4_800_000, p, 2_000_000, 100)).toBe(4_800_000);
	expect(snapTimelineTime(1_800_000, p, 2_000_000, 20)).toBe(2_000_000);
	expect(snapTimelineTime(4_950_000, p, 2_000_000, 100, "c")).toBe(4_950_000);
});
