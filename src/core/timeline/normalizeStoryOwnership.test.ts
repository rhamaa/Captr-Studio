import { describe, expect, it } from "vitest";
import { artboardToStory, extractStoriesFromProject } from "../story/storyUtils";
import { evaluateProject } from "./evaluation";
import { normalizeStoryOwnership } from "./normalizeStoryOwnership";
import { applyStoryCommand, getStoryProject } from "./storyOwnership";
import {
	fixtureClip,
	fixtureText,
	fixtureTrack,
	ownershipFixture,
} from "./storyOwnership.fixtures";
import { validateTimelineProject } from "./validation";

describe("normalizeStoryOwnership", () => {
	it("preserves untrimmed legacy Shape transitions by adding finite static source handles", () => {
		const input = ownershipFixture();
		input.assets.push({
			id: "static-rectangle",
			kind: "shape",
			name: "Rectangle",
			width: 100,
			height: 50,
			durationUs: 5_000_000,
			shapeDefinition: {
				kind: "rectangle",
				width: 100,
				height: 50,
				style: { fill: "#ffffff", stroke: null },
			},
		});
		input.tracks = [
			fixtureTrack("static-track", [
				fixtureClip("out-shape", {
					assetId: "static-rectangle",
					keyframes: [
						{
							id: "out-key",
							timeMs: 0,
							property: "opacity",
							value: 0.5,
							easing: "linear",
						},
					],
				}),
				fixtureClip("in-shape", {
					assetId: "static-rectangle",
					startUs: 5_000_000,
					componentAnimation: {
						enter: { preset: "fade", durationUs: 1_000_000, easing: "linear" },
					},
					shapeStyleOverride: { fill: "#123456", stroke: null },
				}),
			]),
		];
		input.clipTransitions = [
			{
				id: "static-transition",
				trackId: "static-track",
				fromClipId: "out-shape",
				toClipId: "in-shape",
				durationUs: 500_000,
				preset: { kind: "cross-dissolve" },
				easing: "linear",
			},
		];
		const before = structuredClone(input);
		const legacyVisual = evaluateProject(input, 5_500_000).visuals[0];
		const migrated = normalizeStoryOwnership(input);
		const [outgoing, incoming] = migrated.tracks[0].clips;
		expect(outgoing).toMatchObject({
			id: "out-shape",
			startUs: 0,
			sourceInUs: 0,
			sourceOutUs: 5_000_000,
			rate: 1,
			content: { durationUs: 5_250_000 },
		});
		expect(incoming).toMatchObject({
			id: "in-shape",
			startUs: 5_000_000,
			sourceInUs: 250_000,
			sourceOutUs: 5_250_000,
			rate: 1,
			content: { durationUs: 5_250_000 },
		});
		expect(migrated.clipTransitions).toEqual(input.clipTransitions);
		expect(incoming.componentAnimation).toEqual(before.tracks[0].clips[1].componentAnimation);
		expect(outgoing.keyframes).toEqual(before.tracks[0].clips[0].keyframes);
		expect(incoming.shapeStyleOverride).toEqual(before.tracks[0].clips[1].shapeStyleOverride);
		const canonicalVisual = evaluateProject(migrated, 5_500_000).visuals[0];
		expect(canonicalVisual.asset.shapeDefinition).toEqual(legacyVisual.asset.shapeDefinition);
		expect(canonicalVisual.transform).toEqual(legacyVisual.transform);
		expect(canonicalVisual.componentAnimations).toEqual(legacyVisual.componentAnimations);
		expect(input).toEqual(before);
		expect(normalizeStoryOwnership(migrated)).toEqual(migrated);
		expect(() => validateTimelineProject(migrated)).not.toThrow();
	});
	it("keeps sufficient legacy Shape source handles and non-default ranges and rates exact", () => {
		const input = ownershipFixture();
		input.assets.push({
			id: "handled-shape",
			kind: "shape",
			name: "Rectangle",
			width: 100,
			height: 50,
			durationUs: 5_000_000,
			shapeDefinition: {
				kind: "rectangle",
				width: 100,
				height: 50,
				style: { fill: "#ffffff", stroke: null },
			},
		});
		input.tracks = [
			fixtureTrack("handled-track", [
				fixtureClip("handled-out", {
					assetId: "handled-shape",
					sourceInUs: 500_000,
					sourceOutUs: 4_500_000,
					rate: 2,
				}),
				fixtureClip("handled-in", {
					assetId: "handled-shape",
					startUs: 2_000_000,
					sourceInUs: 500_000,
					sourceOutUs: 4_500_000,
					rate: 2,
				}),
			]),
		];
		input.clipTransitions = [
			{
				id: "handled-transition",
				trackId: "handled-track",
				fromClipId: "handled-out",
				toClipId: "handled-in",
				durationUs: 500_000,
				preset: { kind: "cross-dissolve" },
				easing: "linear",
			},
		];
		const migrated = normalizeStoryOwnership(input);
		for (const clip of migrated.tracks[0].clips)
			expect(clip).toMatchObject({
				sourceInUs: 500_000,
				sourceOutUs: 4_500_000,
				rate: 2,
				content: { durationUs: 5_000_000 },
			});
		expect(migrated.clipTransitions).toEqual(input.clipTransitions);
	});
	it("migrates placed designs inline in every canonical owner and preserves unused designs as Templates", () => {
		const input = ownershipFixture();
		input.assets.push(
			{
				id: "legacy-text",
				kind: "text",
				name: "Legacy title",
				width: 1920,
				height: 1080,
				durationUs: 10_000_000,
				text: { ...fixtureText },
			},
			{
				id: "legacy-shape",
				kind: "shape",
				name: "Legacy rectangle",
				width: 100,
				height: 50,
				durationUs: 5_000_000,
				shapeDefinition: {
					kind: "rectangle",
					width: 100,
					height: 50,
					style: { fill: "#ffffff", stroke: null },
				},
			},
			{
				id: "unused-shape",
				kind: "shape",
				name: "Unused rectangle",
				width: 100,
				height: 50,
				durationUs: 5_000_000,
				shapeDefinition: {
					kind: "rectangle",
					width: 100,
					height: 50,
					style: { fill: "#123456", stroke: null },
				},
			},
		);
		const text = fixtureClip("legacy-title", {
			assetId: "legacy-text",
			text: { ...fixtureText, content: "Placement wins" },
			sourceInUs: 2_000_000,
			sourceOutUs: 8_000_000,
			rate: 2,
			keyframes: [
				{ id: "opacity-key", property: "opacity", timeMs: 0, value: 0.5, easing: "linear" },
			],
			componentAnimation: {
				enter: { preset: "fade", durationUs: 100_000, easing: "linear" },
			},
		});
		input.tracks = [fixtureTrack("legacy-track", [text])];
		const a = input.repurposeBoard!.artboards[0];
		a.tracks!.push(
			fixtureTrack("legacy-shape-track", [
				fixtureClip("legacy-rectangle", {
					assetId: "legacy-shape",
					shapeStyleOverride: { fill: "#ff0000", stroke: null },
				}),
			]),
		);
		const before = structuredClone(input);
		const migrated = normalizeStoryOwnership(input);
		const textClip = migrated.tracks[0].clips[0];
		const expected = {
			...text,
			content: {
				kind: "text",
				text: { ...fixtureText, content: "Placement wins" },
				durationUs: 10_000_000,
			},
		};
		delete expected.assetId;
		delete expected.text;
		expect(textClip).toEqual(expected);
		expect(migrated.repurposeBoard!.artboards[0].tracks!.at(-1)!.clips[0]).toMatchObject({
			id: "legacy-rectangle",
			content: { kind: "shape" },
			shapeStyleOverride: { fill: "#ff0000", stroke: null },
		});
		expect(migrated.designTemplates?.some((t) => t.id === "unused-shape")).toBe(true);
		expect(migrated.assets.some((a) => a.kind === "text" || a.kind === "shape")).toBe(false);
		expect(input).toEqual(before);
		expect(normalizeStoryOwnership(migrated)).toEqual(migrated);
		expect(() => validateTimelineProject(migrated)).not.toThrow();
	});
	it("rejects malformed legacy definitions and conflicting inline/media input without changing the source", () => {
		const input = ownershipFixture();
		input.assets.push({
			id: "bad-design",
			kind: "text",
			name: "Bad",
			width: 1920,
			height: 1080,
			durationUs: 5_000_000,
			text: { ...fixtureText, fontSizePx: -1 },
		});
		const before = structuredClone(input);
		expect(() => normalizeStoryOwnership(input)).toThrow(/text/i);
		expect(input).toEqual(before);
		input.assets.at(-1)!.text = { ...fixtureText };
		input.tracks[0].clips[0] = fixtureClip("conflict", {
			assetId: "bad-design",
			content: { kind: "text", text: { ...fixtureText }, durationUs: 5_000_000 },
		});
		const conflicting = structuredClone(input);
		expect(() => normalizeStoryOwnership(input)).toThrow();
		expect(input).toEqual(conflicting);
	});
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
