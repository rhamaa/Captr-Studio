import { describe, expect, it } from "vitest";
import { addTextOverlay, createTimelineProject, duplicateClip, placeAsset, updateTextOverlay } from "./commands";
import { evaluateProject } from "./evaluation";
import { validateTimelineProject } from "./validation";

describe("project text overlays", () => {
	it("adds an editable overlay at the playhead and exposes it to project evaluation", () => {
		const project = createTimelineProject("project-1", "Text test");
		const next = addTextOverlay(project, 2_000_000, {
			assetId: "title-asset",
			trackId: "title-track",
			clipId: "title-clip",
		});

		expect(next.tracks.find((track) => track.id === "title-track")?.clips[0]).toMatchObject({
			id: "title-clip",
			assetId: "title-asset",
			startUs: 2_000_000,
			sourceInUs: 0,
			sourceOutUs: 5_000_000,
			text: { content: "Your text" },
		});
		expect(evaluateProject(next, 2_000_000).visuals[0]?.asset.kind).toBe("text");
		expect(evaluateProject(next, 7_000_000).visuals).toEqual([]);
		expect(validateTimelineProject(JSON.parse(JSON.stringify(next)))).toEqual(next);
	});

	it("keeps edits to a duplicated overlay independent", () => {
		const project = addTextOverlay(createTimelineProject("project-1", "Text test"), 0, {
			assetId: "title-asset",
			trackId: "title-track",
			clipId: "title-clip",
		});
		const duplicated = duplicateClip(project, "title-clip", 5_000_000, { clipId: "copy" });
		const edited = updateTextOverlay(duplicated, "title-clip", { content: "Edited title" });
		const clips = edited.tracks.find((track) => track.id === "title-track")?.clips ?? [];

		expect(clips.find((clip) => clip.id === "title-clip")?.text?.content).toBe("Edited title");
		expect(clips.find((clip) => clip.id === "copy")?.text?.content).toBe("Your text");
		expect(edited.assets[0].text?.content).toBe("Your text");
	});

	it("copies text settings when a library text asset is placed on another track", () => {
		const project = addTextOverlay(createTimelineProject("project-1", "Text test"), 0, {
			assetId: "title-asset",
			trackId: "title-track",
			clipId: "title-clip",
		});
		const placed = placeAsset(project, "title-asset", "visual-1", 5_000_000, {
			clipId: "library-placement",
		});
		const edited = updateTextOverlay(placed, "library-placement", { content: "Placed copy" });

		expect(edited.tracks.find((track) => track.id === "visual-1")?.clips[0].text?.content).toBe(
			"Placed copy",
		);
		expect(edited.tracks.find((track) => track.id === "title-track")?.clips[0].text?.content).toBe(
			"Your text",
		);
		expect(edited.assets[0].text?.content).toBe("Your text");
	});

	it("rejects malformed text asset metadata", () => {
		const project = addTextOverlay(createTimelineProject("project-1", "Text test"), 0, {
			assetId: "title-asset",
			trackId: "title-track",
			clipId: "title-clip",
		});
		delete project.assets[0].text;

		expect(() => validateTimelineProject(project)).toThrow(/text/i);
	});
});
