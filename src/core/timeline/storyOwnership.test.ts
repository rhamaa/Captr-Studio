import { describe, expect, it } from "vitest";
import { getStoryProject, listStoryScopes } from "./storyOwnership";
import { ownershipFixture } from "./storyOwnership.fixtures";

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
