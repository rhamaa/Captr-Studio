import { describe, expect, it } from "vitest";
import { applyStoryCommand, getStoryProject, listStoryScopes } from "./storyOwnership";
import { ownershipFixture } from "./storyOwnership.fixtures";
import { extractStoriesFromProject } from "../story/storyUtils";
import { removeClip, splitClip } from "./commands";
import { validateTimelineProject } from "./validation";

describe("Story ownership views", () => {
	it("enumerates canonical owners and exposes only the selected private library", () => {
		const project = ownershipFixture();
		expect(listStoryScopes(project)).toEqual([
			{ kind: "root" },
			{ kind: "artboard", artboardId: "A" },
			{ kind: "artboard", artboardId: "B" },
		]);
		const view = getStoryProject(project, { kind: "artboard", artboardId: "A" });
		expect(view.assets.some((a) => a.id === "voice-A")).toBe(false);
		expect(view.localAssets?.map((a) => a.id)).toEqual(["voice-A"]);
		expect(getStoryProject(project, { kind: "root" }).tracks[0].id).toBe("root");
	});
	it("never redirects a missing or unmaterialized owner to root", () => {
		const project = ownershipFixture();
		expect(() => getStoryProject(project, { kind: "artboard", artboardId: "gone" })).toThrow();
		delete project.repurposeBoard!.artboards[0].tracks;
		expect(() => getStoryProject(project, { kind: "artboard", artboardId: "A" })).toThrow();
	});
});

describe("scoped Story commands", () => {
	it("does not expose sibling Record compositions to scoped commands", () => {
		const project = ownershipFixture();
		let visible: string[] = [];
		const result = applyStoryCommand(project, { kind: "artboard", artboardId: "A" }, (p) => {
			visible = p.compositions.map((c) => c.id);
			p.compositions[0].revision = 7;
			return p;
		});
		expect(visible).toEqual(["composition-A"]);
		expect(result.compositions.find((c) => c.id === "composition-B")).toEqual(
			project.compositions[1],
		);
		expect(result.compositions.find((c) => c.id === "composition-A")!.revision).toBe(7);
	});
	it.each([
		{ canvas: { width: 100, height: 100, fps: 0 } },
		{ canvas: { width: 100, height: 100, fps: 24, background: 123 } },
		{ storyMetadata: { id: "../bad" } },
		{ storyMetadata: { framing: { scale: -1, offsetX: 0, offsetY: 0, fitMode: "cover" } } },
	])("rejects malformed canonical presentation metadata: %j", (patch) => {
		const project = ownershipFixture();
		Object.assign(project.repurposeBoard!.artboards[0], patch);
		expect(() => validateTimelineProject(project)).toThrow();
	});
	it("writes private media, captions and canvas only to the captured owner", () => {
		const project = ownershipFixture();
		const original = structuredClone(project);
		const result = applyStoryCommand(
			project,
			{ kind: "artboard", artboardId: "A" },
			(view) => ({
				...view,
				localAssets: [...view.localAssets!, { ...view.localAssets![0], id: "new-voice" }],
				canvas: { ...view.canvas, width: 1080 },
				subtitles: { enabled: false },
			}),
		);
		expect(project).toEqual(original);
		expect(result.localAssets).toBeUndefined();
		expect(result.assets).toEqual(project.assets);
		expect(result.tracks).toEqual(project.tracks);
		expect(result.repurposeBoard!.artboards[1]).toEqual(project.repurposeBoard!.artboards[1]);
		expect(result.repurposeBoard!.artboards[0]).toMatchObject({
			width: 1080,
			subtitles: { enabled: false },
		});
		expect(result.repurposeBoard!.artboards[0].localAssets).toHaveLength(2);
	});
	it("refreshes Record projections after deleting or splitting their canonical placement", () => {
		const project = ownershipFixture();
		project.stories = extractStoriesFromProject(project);
		const scope = { kind: "artboard", artboardId: "A" } as const;
		const deleted = applyStoryCommand(project, scope, (view) => removeClip(view, "record-A"));
		expect(deleted.stories!.find((s) => s.artboardId === "A")!.tracks[0].clips).toEqual([]);
		const split = applyStoryCommand(project, scope, (view) =>
			splitClip(view, "record-A", 2_000_000, {
				rightClipId: "right",
				rightCompositionId: "right-comp",
			}),
		);
		expect(split.stories!.find((s) => s.artboardId === "A")!.tracks[0].clips).toHaveLength(2);
	});
	it("rejects sibling media and missing owners atomically", () => {
		const project = ownershipFixture();
		const before = structuredClone(project);
		expect(() =>
			applyStoryCommand(project, { kind: "artboard", artboardId: "missing" }, (p) => p),
		).toThrow();
		expect(() =>
			applyStoryCommand(project, { kind: "artboard", artboardId: "B" }, (p) => {
				p.tracks[0].clips[0] = {
					...p.tracks[0].clips[0],
					assetId: "voice-A",
					compositionId: undefined,
				};
				return p;
			}),
		).toThrow();
		expect(project).toEqual(before);
	});
});
