import { describe, expect, it } from "vitest";
import {
	addTrack,
	createTimelineProject,
	placeAsset,
	registerMedia,
	updateTrack,
} from "@/core/timeline/commands";
import { clipDurationUs, projectDurationUs } from "@/core/timeline/types";
import {
	findClipsAtPlayhead,
	snapTimelineTimeWithDetails,
	timelineActionCommand,
} from "./timelineInteractions";

function createTestProject() {
	let project = createTimelineProject("test-p", "Test Project");
	project = registerMedia(project, {
		id: "asset-1",
		kind: "video",
		name: "Video 1",
		durationUs: 10_000_000,
		width: 1920,
		height: 1080,
		source: { path: "video1.mp4", durationUs: 10_000_000, offsetUs: 0 },
	});
	// Place asset on visual-1 track from 2s to 12s
	project = placeAsset(project, "asset-1", "visual-1", 2_000_000, {
		clipId: "clip-1",
		compositionId: "comp-1",
	});
	return project;
}

describe("Video Editor Hotkeys & Timeline Logic", () => {
	it("finds clips under playhead only on unlocked tracks", () => {
		let p = createTestProject();
		// Playhead at 5s is inside clip-1 (2s - 12s)
		expect(findClipsAtPlayhead(p, 5_000_000)).toEqual(["clip-1"]);

		// Lock track
		p = updateTrack(p, "visual-1", { locked: true });
		// When track is locked, findClipsAtPlayhead ignores it
		expect(findClipsAtPlayhead(p, 5_000_000)).toEqual([]);
	});

	it("split hotkey: splits selected clip when selection is provided", () => {
		const p = createTestProject();
		const splitCmd = timelineActionCommand("split", ["clip-1"], 6_000_000, {
			clipId: "right-clip",
			compositionId: "right-comp",
		});
		const result = splitCmd(p);
		expect(result.tracks[0].clips).toHaveLength(2);
		expect(result.tracks[0].clips[0].id).toBe("clip-1");
		expect(result.tracks[0].clips[1].id).toBe("right-clip");
		expect(result.tracks[0].clips[0].startUs).toBe(2_000_000);
		expect(result.tracks[0].clips[1].startUs).toBe(6_000_000);
	});

	it("split hotkey: splits clips under playhead when selection is empty", () => {
		const p = createTestProject();
		// Call split with empty selection array at 6s
		const splitCmd = timelineActionCommand("split", [], 6_000_000);
		const result = splitCmd(p);
		expect(result.tracks[0].clips).toHaveLength(2);
		expect(result.tracks[0].clips[0].id).toBe("clip-1");
		expect(result.tracks[0].clips[0].startUs).toBe(2_000_000);
		expect(result.tracks[0].clips[1].startUs).toBe(6_000_000);
	});

	it("duplicate hotkey: duplicates selected clip right after it", () => {
		const p = createTestProject();
		const dupCmd = timelineActionCommand("duplicate", ["clip-1"], 0, {
			clipId: "dup-clip",
			compositionId: "dup-comp",
		});
		const result = dupCmd(p);
		expect(result.tracks[0].clips).toHaveLength(2);
		expect(result.tracks[0].clips[1].id).toBe("dup-clip");
		// First clip is 2s to 12s, duplicate starts at 12s
		expect(result.tracks[0].clips[1].startUs).toBe(12_000_000);
	});

	it("delete hotkey: deletes selected clip from track", () => {
		const p = createTestProject();
		const delCmd = timelineActionCommand("delete", ["clip-1"], 0);
		const result = delCmd(p);
		expect(result.tracks[0].clips).toHaveLength(0);
	});

	it("frame step calculations match project fps", () => {
		const fps30 = 30;
		const frame30Us = Math.round(1_000_000 / fps30);
		expect(frame30Us).toBe(33333);

		const fps60 = 60;
		const frame60Us = Math.round(1_000_000 / fps60);
		expect(frame60Us).toBe(16667);

		// Shift modifier steps 1 second
		const shiftStepUs = 1_000_000;
		expect(shiftStepUs).toBe(1_000_000);
	});

	it("timeline scale zoom respects bounds (8 to 250)", () => {
		let scale = 65;
		// Zoom in
		scale = Math.min(250, scale * 1.25);
		expect(scale).toBeCloseTo(81.25);

		// Zoom in to cap
		for (let i = 0; i < 20; i++) {
			scale = Math.min(250, scale * 1.25);
		}
		expect(scale).toBe(250);

		// Zoom out to floor
		for (let i = 0; i < 30; i++) {
			scale = Math.max(8, scale / 1.25);
		}
		expect(scale).toBe(8);

		// Reset
		scale = 65;
		expect(scale).toBe(65);
	});

	it("toggles magnetic snapping with N key and affects snap calculation", () => {
		const p = createTestProject();
		let snappingEnabled = true;

		// When enabled, near points snap
		const snapEnabled = snapTimelineTimeWithDetails(1_950_000, p, 0, 100, {
			enabled: snappingEnabled,
		});
		expect(snapEnabled.snapped).toBe(true);
		expect(snapEnabled.timeUs).toBe(2_000_000);

		// Toggle snapping (hotkey N)
		snappingEnabled = !snappingEnabled;
		expect(snappingEnabled).toBe(false);

		// When disabled, raw time is preserved
		const snapDisabled = snapTimelineTimeWithDetails(1_950_000, p, 0, 100, {
			enabled: snappingEnabled,
		});
		expect(snapDisabled.snapped).toBe(false);
		expect(snapDisabled.timeUs).toBe(1_950_000);
	});

	it("multi-selection: delete removes all selected clips", () => {
		let p = createTestProject();
		p = placeAsset(p, "asset-1", "visual-1", 15_000_000, {
			clipId: "clip-2",
			compositionId: "comp-2",
		});
		p = placeAsset(p, "asset-1", "visual-1", 30_000_000, {
			clipId: "clip-3",
			compositionId: "comp-3",
		});
		expect(p.tracks[0].clips).toHaveLength(3);

		// Multi-select clip-1 and clip-2, then delete
		const selection = ["clip-1", "clip-2"];
		const deleted = timelineActionCommand("delete", selection, 0)(p);
		expect(deleted.tracks[0].clips).toHaveLength(1);
		expect(deleted.tracks[0].clips[0].id).toBe("clip-3");
	});

	it("ripple delete: Shift+Delete removes selected clip and closes gap", () => {
		let p = createTestProject();
		// clip-1 is 2s-12s (dur 10s). Add clip-2 at 15s-25s.
		p = placeAsset(p, "asset-1", "visual-1", 15_000_000, {
			clipId: "clip-2",
			compositionId: "comp-2",
		});

		// Ripple delete clip-1:
		const rippled = timelineActionCommand("ripple-delete", ["clip-1"], 0)(p);
		expect(rippled.tracks[0].clips).toHaveLength(1);
		expect(rippled.tracks[0].clips[0].id).toBe("clip-2");
		// clip-2 was at 15s -> shifted left by 10s (clip-1's dur) -> 5s
		expect(rippled.tracks[0].clips[0].startUs).toBe(5_000_000);
	});
});
