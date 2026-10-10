import { describe, expect, it } from "vitest";
import { addTrack, placeAsset, removeAsset, removeClip } from "./commands";
import { ProjectHistory } from "./history";
import { applyStoryCommand, getStoryProject } from "./storyOwnership";
import { ownershipFixture } from "./storyOwnership.fixtures";
import type { PrivateMediaAsset } from "./types";

const audio: PrivateMediaAsset = {
	id: "new-voice",
	kind: "audio",
	name: "Private voice",
	width: 1,
	height: 1,
	durationUs: 5_000_000,
	source: { path: "voice.wav", durationUs: 5_000_000, offsetUs: 0 },
};
const scope = { kind: "artboard", artboardId: "A" } as const;

describe("Story private media commands", () => {
	it("registers unplaced media only in the captured Story and records placement separately", async () => {
		const { registerStoryMedia } = await import("./storyMediaCommands");
		const before = ownershipFixture();
		const history = new ProjectHistory(before);
		const registered = history.execute((p) => registerStoryMedia(p, scope, audio));
		expect(registered.assets).toEqual(before.assets);
		expect(registered.tracks).toEqual(before.tracks);
		expect(getStoryProject(registered, scope).localAssets).toContainEqual(audio);
		expect(registered.repurposeBoard!.artboards[1]).toEqual(
			before.repurposeBoard!.artboards[1],
		);
		const placed = history.execute((p) =>
			applyStoryCommand(p, scope, (view) =>
				placeAsset(addTrack(view, "voice-track", "audio"), audio.id, "voice-track", 0, {
					clipId: "voice-placement",
				}),
			),
		);
		expect(
			getStoryProject(placed, scope).tracks.find((t) => t.id === "voice-track")?.clips[0]
				.assetId,
		).toBe(audio.id);
		expect(history.undo()).toEqual(registered);
		expect(history.undo()).toEqual(before);
		history.redo();
		expect(history.redo()).toEqual(placed);
	});
	it("rejects source removal while referenced, but clip deletion retains private media", async () => {
		const { registerStoryMedia, removeStoryMedia } = await import("./storyMediaCommands");
		const registered = registerStoryMedia(ownershipFixture(), scope, audio);
		const placed = applyStoryCommand(registered, scope, (view) =>
			placeAsset(addTrack(view, "voice-track", "audio"), audio.id, "voice-track", 0, {
				clipId: "voice-placement",
			}),
		);
		expect(() => removeStoryMedia(placed, scope, audio.id)).toThrow(/referenced/i);
		const deleted = applyStoryCommand(placed, scope, (view) =>
			removeClip(view, "voice-placement"),
		);
		expect(getStoryProject(deleted, scope).localAssets).toContainEqual(audio);
		expect(
			getStoryProject(removeStoryMedia(deleted, scope, audio.id), scope).localAssets,
		).not.toContainEqual(audio);
	});
	it("rejects invalid ownership and duplicate identities without redirecting to root", async () => {
		const { registerStoryMedia, removeStoryMedia } = await import("./storyMediaCommands");
		const before = ownershipFixture();
		expect(() =>
			registerStoryMedia(before, { kind: "artboard", artboardId: "missing" }, audio),
		).toThrow(/owner/i);
		expect(() => registerStoryMedia(before, scope, { ...audio, id: "shared" })).toThrow(
			/duplicate/i,
		);
		expect(() =>
			registerStoryMedia(before, scope, {
				...audio,
				kind: "recording",
			} as unknown as PrivateMediaAsset),
		).toThrow();
		expect(() => removeStoryMedia(before, { kind: "root" }, "voice-A")).toThrow();
	});
	it("checks all canonical owners before global source deletion and keeps existing global voiceover global", () => {
		const before = ownershipFixture();
		before.tracks = [];
		before.repurposeBoard!.artboards[1].tracks![0].clips[0].assetId = "shared";
		delete before.repurposeBoard!.artboards[1].tracks![0].clips[0].compositionId;
		expect(() => removeAsset(before, "shared")).toThrow(/referenced/i);
		before.assets.push({ ...audio, id: "global-voice" });
		const history = new ProjectHistory(before);
		expect(history.project.assets.some((a) => a.id === "global-voice")).toBe(true);
		expect(history.project.localAssets).toBeUndefined();
	});
});
