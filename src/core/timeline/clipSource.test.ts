import { describe, expect, it } from "vitest";
import { resolveClipSource, resolveMediaAsset } from "./clipSource";
import { getStoryProject } from "./storyOwnership";
import { fixtureClip, ownershipFixture } from "./storyOwnership.fixtures";

describe("Story source resolution", () => {
	it("resolves inline extent and dimensions without a backing Asset", () => {
		const view = getStoryProject(ownershipFixture(), { kind: "artboard", artboardId: "A" });
		const source = resolveClipSource(view, view.tracks[1].clips[0]);
		expect(source).toMatchObject({
			kind: "text",
			durationUs: 5_000_000,
			width: 1920,
			height: 1080,
		});
		expect(source.media).toBeUndefined();
		expect(resolveClipSource(view, view.tracks[2].clips[0])).toMatchObject({
			kind: "shape",
			width: 100,
			height: 50,
		});
	});
	it("resolves shared media but rejects sibling-private and missing sources", () => {
		const viewA = getStoryProject(ownershipFixture(), { kind: "artboard", artboardId: "A" });
		const viewB = getStoryProject(ownershipFixture(), { kind: "artboard", artboardId: "B" });
		expect(resolveMediaAsset(viewA, "shared").id).toBe("shared");
		expect(resolveMediaAsset(viewA, "voice-A").id).toBe("voice-A");
		expect(() => resolveMediaAsset(viewB, "voice-A")).toThrow();
		expect(() =>
			resolveClipSource(viewA, fixtureClip("missing", { assetId: "gone" })),
		).toThrow();
	});
});
