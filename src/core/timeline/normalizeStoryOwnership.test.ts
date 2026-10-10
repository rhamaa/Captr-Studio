import { describe, expect, it } from "vitest";
import { artboardToStory, extractStoriesFromProject } from "../story/storyUtils";
import { normalizeStoryOwnership } from "./normalizeStoryOwnership";
import { applyStoryCommand, getStoryProject } from "./storyOwnership";
import { fixtureClip, fixtureTrack, ownershipFixture } from "./storyOwnership.fixtures";
import { validateTimelineProject } from "./validation";

describe("normalizeStoryOwnership", () => {
	it.each(
		["root", "artboard"].flatMap((kind) =>
			["localAssets", "clipTransitions"].flatMap((field) =>
				[null, {}, "invalid"].map((invalid) => ({ kind, field, invalid })),
			),
		),
	)("rejects invalid collection $kind.$field=$invalid without changing input", ({
		kind,
		field,
		invalid,
	}) => {
		const input = ownershipFixture();
		input.stories = extractStoriesFromProject(input);
		const owner = kind === "root" ? input : input.repurposeBoard!.artboards[0];
		Object.assign(owner, { [field]: invalid });
		const before = structuredClone(input);
		expect(() => normalizeStoryOwnership(input)).toThrow();
		expect(input).toEqual(before);
	});
	it("materializes inherited canvas settings without a later root-background link", () => {
		const input = ownershipFixture();
		input.canvas.background = "#123456";
		delete input.repurposeBoard!.artboards[0].tracks;
		const result = normalizeStoryOwnership(input);
		result.canvas.background = "#abcdef";
		expect(
			getStoryProject(result, { kind: "artboard", artboardId: "A" }).canvas.background,
		).toBe("#123456");
	});
	it("rejects duplicate placement identities instead of laundering them during snapshot remapping", () => {
		const input = ownershipFixture();
		const b = input.repurposeBoard!.artboards[1];
		b.tracks = [
			fixtureTrack("root", [
				fixtureClip("duplicate"),
				{ ...fixtureClip("duplicate"), startUs: 5_000_000 },
			]),
		];
		expect(() => normalizeStoryOwnership(input)).toThrow(/duplicate/i);
	});
	it.each([
		null,
		{ id: "../bad" },
	])("rejects malformed owner metadata during normalization: %j", (metadata) => {
		const input = ownershipFixture();
		Object.assign(input.repurposeBoard!.artboards[0], { storyMetadata: metadata });
		expect(() => normalizeStoryOwnership(input)).toThrow();
	});
	it("remaps historical explicit shared placements, keeping global sources and templates shared", () => {
		const input = ownershipFixture();
		input.repurposeBoard!.artboards[1].tracks = structuredClone(
			input.repurposeBoard!.artboards[0].tracks!.slice(0, 1),
		);
		const result = normalizeStoryOwnership(input);
		const [a, b] = result.repurposeBoard!.artboards;
		expect(b.tracks![0].id).not.toBe(a.tracks![0].id);
		expect(b.tracks![0].clips[0].compositionId).not.toBe(a.tracks![0].clips[0].compositionId);
		expect(b.tracks![0].clips[0].assetId).toBe("record");
		expect(result.packages).toEqual(input.packages);
		expect(() => validateTimelineProject(result)).not.toThrow();
	});
	it("rejects multiple projections for the same owner", () => {
		const input = ownershipFixture();
		const story = artboardToStory(input.repurposeBoard!.artboards[0]);
		input.stories = [story, { ...story, id: "another-id" }];
		expect(() => normalizeStoryOwnership(input)).toThrow(/ambiguous/i);
	});
	it("materializes inherited tracks once, preserving empty owners and independent Record/private identities", () => {
		const input = ownershipFixture();
		const [a, b] = input.repurposeBoard!.artboards;
		input.tracks = a.tracks!;
		input.localAssets = a.localAssets;
		delete a.tracks;
		delete a.localAssets;
		b.tracks = [];
		const original = structuredClone(input);
		const normalized = normalizeStoryOwnership(input);
		const viewA = getStoryProject(normalized, { kind: "artboard", artboardId: "A" });
		expect(input).toEqual(original);
		expect(normalizeStoryOwnership(normalized)).toEqual(normalized);
		expect(getStoryProject(normalized, { kind: "artboard", artboardId: "B" }).tracks).toEqual(
			[],
		);
		expect(viewA.tracks[0].id).not.toBe(normalized.tracks[0].id);
		expect(viewA.tracks[0].clips[0].id).not.toBe(normalized.tracks[0].clips[0].id);
		expect(viewA.tracks[0].clips[0].compositionId).not.toBe(
			normalized.tracks[0].clips[0].compositionId,
		);
		expect(viewA.tracks[0].clips[0].assetId).toBe("record");
		expect(viewA.localAssets![0].id).not.toBe(normalized.localAssets![0].id);
		expect(viewA.localAssets![0].source).toEqual(normalized.localAssets![0].source);
		expect(viewA.tracks[3].clips[0].assetId).toBe(viewA.localAssets![0].id);
		const edited = applyStoryCommand(normalized, { kind: "root" }, (p) => ({
			...p,
			tracks: [],
		}));
		expect(edited.repurposeBoard!.artboards[0]).toEqual(
			normalized.repurposeBoard!.artboards[0],
		);
		expect(() => validateTimelineProject(normalized)).not.toThrow();
	});
	it("hydrates a standalone Story with its original identity and metadata", () => {
		const input = ownershipFixture();
		const standalone = artboardToStory(input.repurposeBoard!.artboards[0]);
		standalone.id = "standalone-original";
		delete standalone.artboardId;
		standalone.canvas.background = "#123456";
		standalone.canvas.fps = 24;
		input.repurposeBoard!.artboards.shift();
		input.stories = [standalone];
		const result = normalizeStoryOwnership(input);
		const story = extractStoriesFromProject(result).find(
			(s) => s.id === "standalone-original",
		)!;
		expect(story).toMatchObject({
			canvas: standalone.canvas,
			tracks: standalone.tracks,
			localAssets: standalone.localAssets,
		});
		expect(story.artboardId).toBeDefined();
		expect(normalizeStoryOwnership(result)).toEqual(result);
	});
	it("keeps canonical tracks and explicit empty metadata ahead of stale projections", () => {
		const input = ownershipFixture();
		input.stories = extractStoriesFromProject(input);
		input.repurposeBoard!.artboards[0].tracks = [];
		input.repurposeBoard!.artboards[0].localAssets = [];
		input.tracks = [fixtureTrack("new-root", [fixtureClip("new-root-clip")])];
		const result = normalizeStoryOwnership(input);
		expect(result.tracks).toEqual(input.tracks);
		expect(result.repurposeBoard!.artboards[0].tracks).toEqual([]);
		expect(result.repurposeBoard!.artboards[0].localAssets).toEqual([]);
		expect(result.stories![0].tracks).toEqual(input.tracks);
	});
	it("rejects ambiguous prefix mappings without changing input", () => {
		const input = ownershipFixture();
		const a = input.repurposeBoard!.artboards[0];
		input.repurposeBoard!.artboards.push({
			...structuredClone(a),
			id: "story-A",
			tracks: [],
			localAssets: [],
		});
		input.stories = [{ ...artboardToStory(a), artboardId: undefined }];
		const original = structuredClone(input);
		expect(() => normalizeStoryOwnership(input)).toThrow(/ambiguous/i);
		expect(input).toEqual(original);
	});
});
