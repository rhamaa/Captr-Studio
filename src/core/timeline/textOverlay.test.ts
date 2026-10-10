import { describe, expect, it } from "vitest";
import { resolveClipSource } from "./clipSource";
import {
	addTextOverlay,
	createTimelineProject,
	duplicateClip,
	splitClip,
	updateTextOverlay,
} from "./commands";
import { evaluateProject } from "./evaluation";
import { ProjectHistory } from "./history";
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
			startUs: 2_000_000,
			sourceInUs: 0,
			sourceOutUs: 5_000_000,
			content: { kind: "text", text: { content: "Your text" }, durationUs: 5_000_000 },
		});
		const textClip = next.tracks.find((track) => track.id === "title-track")!.clips[0];
		expect(next.assets).toEqual(project.assets);
		expect(next.localAssets).toEqual(project.localAssets);
		expect(textClip.assetId).toBeUndefined();
		expect(resolveClipSource(next, textClip).kind).toBe("text");
		expect(evaluateProject(next, 2_000_000).visuals[0]?.asset).toMatchObject({
			kind: "text",
			text: { content: "Your text" },
		});
		expect(evaluateProject(next, 7_000_000).visuals).toEqual([]);
		expect(next.assets).toEqual(project.assets);
		expect(next.localAssets).toEqual(project.localAssets);
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

		expect(clips.find((clip) => clip.id === "title-clip")?.content).toMatchObject({
			text: { content: "Edited title" },
		});
		expect(clips.find((clip) => clip.id === "copy")?.content).toMatchObject({
			text: { content: "Your text" },
		});
		expect(clips[1].content).not.toBe(clips[0].content);
		expect(edited.assets).toEqual([]);
	});

	it("splits inline text with independent content and restores IDs and edits through history", () => {
		const project = addTextOverlay(createTimelineProject("project-1", "Text test"), 0, {
			assetId: "title-asset",
			trackId: "title-track",
			clipId: "title-clip",
		});
		const history = new ProjectHistory(project);
		history.execute((p) => splitClip(p, "title-clip", 2_000_000, { rightClipId: "right" }));
		const split = structuredClone(history.project);
		const clips = history.project.tracks.find((t) => t.id === "title-track")!.clips;
		expect(clips[1].content).not.toBe(clips[0].content);
		history.execute((p) => updateTextOverlay(p, "right", { content: "Right title" }));
		expect(history.undo()).toEqual(split);
		expect(history.undo()).toEqual(project);
		history.redo();
		const restored = history.redo().tracks.find((t) => t.id === "title-track")!.clips;
		expect(restored.map((c) => c.id)).toEqual(["title-clip", "right"]);
		expect(restored[0].content).toMatchObject({ text: { content: "Your text" } });
		expect(restored[1].content).toMatchObject({ text: { content: "Right title" } });
	});

	it("rejects malformed inline text metadata", () => {
		const project = addTextOverlay(createTimelineProject("project-1", "Text test"), 0, {
			assetId: "title-asset",
			trackId: "title-track",
			clipId: "title-clip",
		});
		const clip = project.tracks.find((t) => t.id === "title-track")!.clips[0];
		Object.assign(clip, { content: { kind: "text", durationUs: 5_000_000, text: {} } });

		expect(() => validateTimelineProject(project, { mode: "legacy" })).toThrow(/text/i);
	});
});
