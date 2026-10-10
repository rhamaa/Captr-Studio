import { describe, expect, it } from "vitest";
import { extractStoriesFromProject } from "../story/storyUtils";
import { removeClip, splitClip } from "./commands";
import { applyStoryCommand, getStoryProject, listStoryScopes } from "./storyOwnership";
import { fixtureText, ownershipFixture } from "./storyOwnership.fixtures";
import type { StoryScope, TimelineProject } from "./types";
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
	const scopes: StoryScope[] = [{ kind: "root" }, { kind: "artboard", artboardId: "A" }];
	describe.each(scopes)("shared-library boundary in %j", (scope) => {
		const cases: { name: string; mutate: (p: TimelineProject) => void }[] = [
			{
				name: "asset mutation",
				mutate: (p) => {
					p.assets[0].name = "Changed shared asset";
				},
			},
			{
				name: "asset removal",
				mutate: (p) => {
					p.assets = p.assets.filter((a) => a.id !== "unused");
				},
			},
			{
				name: "package mutation",
				mutate: (p) => {
					p.packages[0].settings = { changed: true };
				},
			},
			{
				name: "package removal",
				mutate: (p) => {
					p.packages = p.packages.filter((a) => a.id !== "unused-package");
				},
			},
			{
				name: "template mutation",
				mutate: (p) => {
					p.designTemplates![0].name = "Changed shared template";
				},
			},
			{
				name: "template removal",
				mutate: (p) => {
					p.designTemplates = [];
				},
			},
		];
		it.each(cases)("rejects $name atomically", ({ mutate }) => {
			const input = ownershipFixture();
			input.assets.push({ ...structuredClone(input.assets[0]), id: "unused" });
			input.packages.push({
				...structuredClone(input.packages[0]),
				id: "unused-package",
				captureId: "unused-capture",
			});
			input.designTemplates = [
				{
					id: "template",
					name: "Title",
					kind: "text",
					width: 1920,
					height: 1080,
					defaultDurationUs: 5_000_000,
					content: { kind: "text", text: fixtureText, durationUs: 5_000_000 },
				},
			];
			const before = structuredClone(input);
			expect(() =>
				applyStoryCommand(input, scope, (p) => {
					mutate(p);
					return p;
				}),
			).toThrow(/shared/i);
			expect(input).toEqual(before);
		});
	});
	it.each(scopes)("allows shared imports and unchanged private publication in %j", (scope) => {
		const input = ownershipFixture();
		const owner = scope.kind === "root" ? input : input.repurposeBoard!.artboards[0];
		if (scope.kind === "root")
			owner.localAssets = [
				{
					...structuredClone(input.repurposeBoard!.artboards[0].localAssets![0]),
					id: "root-private",
				},
			];
		const privateAsset = structuredClone(owner.localAssets![0]);
		const result = applyStoryCommand(input, scope, (p) => {
			p.assets.push(privateAsset, { ...structuredClone(p.assets[0]), id: "imported-video" });
			p.localAssets = p.localAssets!.filter((a) => a.id !== privateAsset.id);
			return p;
		});
		expect(result.assets.find((a) => a.id === privateAsset.id)).toEqual(privateAsset);
		expect(result.assets.some((a) => a.id === "imported-video")).toBe(true);
		expect(result.assets.slice(0, input.assets.length)).toEqual(input.assets);
		expect(getStoryProject(result, scope).localAssets).toEqual([]);
	});
	it("rejects uncorrelated package imports and altered publications, while accepting a new Recording source/package pair", () => {
		const input = ownershipFixture();
		const scope = { kind: "artboard", artboardId: "A" } as const;
		const newPackage = {
			...structuredClone(input.packages[0]),
			id: "imported-package",
			captureId: "new-capture",
		};
		expect(() =>
			applyStoryCommand(input, scope, (p) => ({
				...p,
				packages: [...p.packages, newPackage],
			})),
		).toThrow(/package/i);
		expect(() =>
			applyStoryCommand(input, scope, (p) => {
				p.assets.push({
					...p.localAssets![0],
					source: { ...p.localAssets![0].source!, path: "different.wav" },
				});
				p.localAssets = [];
				return p;
			}),
		).toThrow(/publication/i);
		const result = applyStoryCommand(input, scope, (p) => ({
			...p,
			packages: [...p.packages, newPackage],
			assets: [
				...p.assets,
				{ ...p.assets[1], id: "imported-record", packageId: newPackage.id },
			],
		}));
		expect(result.packages).toHaveLength(2);
		expect(result.assets.find((a) => a.id === "imported-record")!.packageId).toBe(
			"imported-package",
		);
	});
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
