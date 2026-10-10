import { expect, it } from "vitest";
import { createTimelineProject, registerMedia, updateTrack } from "@/core/timeline/commands";
import {
	applyClipGesture,
	assetDropCommand,
	findClipsAtPlayhead,
	snapTimelineTime,
	snapTimelineTimeWithDetails,
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

	// Detailed snap result
	const detailed = snapTimelineTimeWithDetails(4_950_000, p, 2_000_000, 100);
	expect(detailed).toEqual({
		timeUs: 5_000_000,
		snapped: true,
		snapPointUs: 5_000_000,
	});

	// Disabled snapping returns raw time and snapped: false
	const disabled = snapTimelineTimeWithDetails(4_950_000, p, 2_000_000, 100, {
		enabled: false,
	});
	expect(disabled).toEqual({
		timeUs: 4_950_000,
		snapped: false,
	});

	// Trailing edge snapping
	const trailingSnap = snapTimelineTimeWithDetails(1_950_000, p, 0, 100, {
		durationUs: 3_000_000, // trailing edge candidate = 4_950_000 -> snaps to clip start 5_000_000
	});
	expect(trailingSnap).toEqual({
		timeUs: 2_000_000,
		snapped: true,
		snapPointUs: 5_000_000,
	});
});

it("finds clips under playhead and splits them when selection is empty", () => {
	const p = assetDropCommand("a", "visual-1", 1_000_000, {
		clipId: "clip-1",
		compositionId: "comp-1",
	})(project());

	// At 5s, clip-1 is from 1s to 11s, so it should be found
	expect(findClipsAtPlayhead(p, 5_000_000)).toEqual(["clip-1"]);
	// Before clip (at 0.5s), should not find
	expect(findClipsAtPlayhead(p, 500_000)).toEqual([]);
	// After clip (at 12s), should not find
	expect(findClipsAtPlayhead(p, 12_000_000)).toEqual([]);

	// Splitting with empty selection at 5s splits clip-1 under playhead
	const split = timelineActionCommand("split", [], 5_000_000)(p);
	expect(split.tracks[0].clips).toHaveLength(2);
	expect(split.tracks[0].clips[0].startUs).toBe(1_000_000);
	expect(split.tracks[0].clips[1].startUs).toBe(5_000_000);

	// Splitting when playhead is outside selection does not throw and safely splits clip under playhead
	const safeSplit = timelineActionCommand("split", ["non-existent"], 5_000_000)(p);
	expect(safeSplit.tracks[0].clips).toHaveLength(2);

	// Splitting when playhead is completely outside any clip returns project unchanged without throwing
	const noOpSplit = timelineActionCommand("split", ["clip-1"], 20_000_000)(p);
	expect(noOpSplit).toBe(p);
});

it("clamps clip movement to prevent overlapping adjacent clips", () => {
	let p = project();
	p = assetDropCommand("a", "visual-1", 0, { clipId: "c1" })(p);
	p = assetDropCommand("a", "visual-1", 15_000_000, { clipId: "c2" })(p);

	// c1 is 0 to 10s. c2 is 15s to 25s.
	// Try moving c1 into c2 (e.g. +10s to 10s -> would end at 20s, which overlaps c2).
	// Clamping should constrain c1's startUs so it doesn't exceed c2.startUs - c1.duration = 15s - 10s = 5s.
	const clampedMove = applyClipGesture(p, "c1", {
		kind: "move",
		deltaUs: 10_000_000,
	});
	expect(clampedMove.tracks[0].clips.find((c) => c.id === "c1")?.startUs).toBe(5_000_000);
});

it("ripple-deletes selected clips and pulls subsequent clips left", () => {
	let p = project();
	p = assetDropCommand("a", "visual-1", 0, { clipId: "c1" })(p);
	p = assetDropCommand("a", "visual-1", 15_000_000, { clipId: "c2" })(p);
	p = assetDropCommand("a", "visual-1", 30_000_000, { clipId: "c3" })(p);

	// c1 is 0-10s (dur 10s). c2 is 15-25s (dur 10s). c3 is 30-40s (dur 10s).
	// Ripple delete c1:
	const rippled = timelineActionCommand("ripple-delete", ["c1"], 0)(p);
	expect(rippled.tracks[0].clips).toHaveLength(2);
	// c2 was at 15s -> becomes 15s - 10s = 5s
	expect(rippled.tracks[0].clips.find((c) => c.id === "c2")?.startUs).toBe(5_000_000);
	// c3 was at 30s -> becomes 30s - 10s = 20s
	expect(rippled.tracks[0].clips.find((c) => c.id === "c3")?.startUs).toBe(20_000_000);
});
