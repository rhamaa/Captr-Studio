import { expect, it } from "vitest";
import { createTimelineProject, moveClip, placeAsset, registerMedia, removeClip } from "./commands";
import { ProjectHistory } from "./history";
import { fixtureText, ownershipFixture } from "./storyOwnership.fixtures";

function setup() {
	return registerMedia(createTimelineProject("p", "P"), {
		id: "a",
		kind: "video",
		name: "Video",
		durationUs: 10_000_000,
		width: 1920,
		height: 1080,
		source: { path: "video.mp4", durationUs: 10_000_000, offsetUs: 0 },
	});
}
it("rejects unmigrated designs before installing editable history or committing a command", () => {
	const legacy = setup();
	legacy.assets.push({
		id: "legacy-title",
		kind: "text",
		name: "Title",
		width: 1920,
		height: 1080,
		durationUs: 5_000_000,
		text: { ...fixtureText },
	});
	expect(() => new ProjectHistory(legacy)).toThrow(/design/i);
	const history = new ProjectHistory(setup());
	expect(() => history.execute(() => legacy)).toThrow(/design/i);
	expect(history.undoCount).toBe(0);
});
it("regenerates stale Story projections after a root clip edit", () => {
	const history = new ProjectHistory(ownershipFixture());
	history.execute((p) => removeClip(p, "root-video"));
	expect(history.project.stories![0].tracks[0].clips).toEqual([]);
	expect(history.undo().tracks[0].clips[0].id).toBe("root-video");
	expect(history.redo().stories![0].tracks[0].clips).toEqual([]);
});
it("commits one history item per gesture and safely restores selection on undo/redo", () => {
	const history = new ProjectHistory(setup());
	history.execute((p) => placeAsset(p, "a", "visual-1", 0, { clipId: "c" }), ["c"]);
	const original = history.project;
	moveClip(original, "c", "visual-1", 1_000_000);
	moveClip(original, "c", "visual-1", 2_000_000);
	expect(history.project).toBe(original);
	expect(history.undoCount).toBe(1);
	history.execute((p) => moveClip(p, "c", "visual-1", 3_000_000), ["c"]);
	expect(history.undoCount).toBe(2);
	history.undo();
	expect(history.project.tracks[0].clips[0].startUs).toBe(0);
	expect(history.selection).toEqual(["c"]);
	history.redo();
	expect(history.project.tracks[0].clips[0].startUs).toBe(3_000_000);
	history.execute((p) => removeClip(p, "c"), ["c"]);
	expect(history.selection).toEqual([]);
	history.undo();
	expect(history.selection).toEqual(["c"]);
	history.redo();
	expect(history.selection).toEqual([]);
	expect(history.project.assets).toHaveLength(1);
	history.undo();
	history.execute((p) => moveClip(p, "c", "visual-1", 4_000_000));
	expect(history.canRedo).toBe(false);
});
