import { describe, expect, it } from "vitest";
import { addTextOverlay, createTimelineProject, trimClip, updateTextOverlay } from "./commands";
import { ProjectHistory } from "./history";
import { fixtureText, ownershipFixture } from "./storyOwnership.fixtures";
import type { TimelineProject } from "./types";

function templateProject(): TimelineProject {
	return {
		...createTimelineProject("templates", "Templates"),
		designTemplates: [
			{
				id: "title-template",
				name: "Title",
				kind: "text",
				width: 1920,
				height: 1080,
				defaultDurationUs: 5_000_000,
				content: { kind: "text", text: { ...fixtureText }, durationUs: 8_000_000 },
			},
		],
	};
}

describe("inline design templates", () => {
	it("applies independent instances without registering Assets or modifying their template", async () => {
		const { applyDesignTemplate } = await import("./designTemplateCommands");
		const before = templateProject();
		let created = applyDesignTemplate(before, "title-template", 0, {
			clipId: "first",
			trackId: "first-track",
		});
		expect(created.tracks.flatMap((t) => t.clips)[0]?.content).toMatchObject({
			kind: "text",
			text: fixtureText,
		});
		created = applyDesignTemplate(created, "title-template", 5_000_000, {
			clipId: "second",
			trackId: "second-track",
		});
		const edited = updateTextOverlay(created, "first", { content: "Changed" });
		const clips = edited.tracks.flatMap((t) => t.clips);
		expect(edited.assets).toEqual(before.assets);
		expect(edited.localAssets).toEqual(before.localAssets);
		expect(edited.designTemplates).toEqual(before.designTemplates);
		expect(clips[0].content).not.toBe(clips[1].content);
		expect(clips[0].content).toMatchObject({ text: { content: "Changed" } });
		expect(clips[1].content).toMatchObject({ text: fixtureText });
		expect(clips[1].sourceOutUs).toBe(5_000_000);
	});
	it("extends source extent undoably and keeps extent on subsequent trim", async () => {
		const { extendInlineClip } = await import("./designTemplateCommands");
		const before = addTextOverlay(createTimelineProject("extent", "Extent"), 0, {
			assetId: "obsolete",
			clipId: "text",
			trackId: "text-track",
		});
		const history = new ProjectHistory(before);
		const extended = history.execute((p) => extendInlineClip(p, "text", 8_000_000));
		const extendedClip = extended.tracks.find((t) => t.id === "text-track")!.clips[0];
		expect(extendedClip.content?.durationUs).toBe(8_000_000);
		expect(extendedClip.sourceOutUs).toBe(8_000_000);
		const trimmed = trimClip(extended, "text", 1_000_000, 4_000_000);
		const trimmedClip = trimmed.tracks.find((t) => t.id === "text-track")!.clips[0];
		expect(trimmedClip.content?.durationUs).toBe(8_000_000);
		expect(history.undo()).toEqual(before);
		expect(history.redo()).toEqual(extended);
	});
	it("rejects missing templates, invalid extents, locked clips, and file media extension atomically", async () => {
		const { applyDesignTemplate, extendInlineClip } = await import("./designTemplateCommands");
		const before = templateProject();
		expect(() => extendInlineClip(ownershipFixture(), "root-video", 8_000_000)).toThrow(
			/inline/i,
		);
		expect(() =>
			applyDesignTemplate(before, "missing", 0, { clipId: "first", trackId: "new-track" }),
		).toThrow();
		const created = applyDesignTemplate(before, "title-template", 0, {
			clipId: "first",
			trackId: "new-track",
		});
		for (const extent of [0, -1, 0.5, NaN, Infinity, 4_000_000])
			expect(() => extendInlineClip(created, "first", extent)).toThrow();
		created.tracks.find((t) => t.clips.some((c) => c.id === "first"))!.locked = true;
		const saved = structuredClone(created);
		expect(() => extendInlineClip(created, "first", 9_000_000)).toThrow(/locked/i);
		expect(created).toEqual(saved);
	});
});
