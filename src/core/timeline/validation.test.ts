import { describe, expect, it } from "vitest";
import { createTimelineProject, placeAsset, registerMedia } from "./commands";
import { fixtureClip, fixtureText, ownershipFixture } from "./storyOwnership.fixtures";
import type { TimelineClip } from "./types";
import { validateTimelineProject } from "./validation";

describe("canonical Story ownership validation", () => {
	it("defaults to canonical validation for duplicate cross-owner placement IDs", () => {
		const p = ownershipFixture();
		p.repurposeBoard!.artboards[1].tracks![0].clips[0].id = "record-A";
		expect(() => validateTimelineProject(p)).toThrow(/ID/);
	});
	it("defaults to canonical validation for shared cross-owner Record composition ownership", () => {
		const p = ownershipFixture();
		p.repurposeBoard!.artboards[1].tracks![0].clips[0].compositionId = "composition-A";
		expect(() => validateTimelineProject(p)).toThrow(/ownership/);
	});
	it("rejects an A projection referring to B's Record placement and composition", () => {
		const p = ownershipFixture();
		p.stories = [
			{
				id: "story-A",
				artboardId: "A",
				name: "A",
				aspectRatio: "16:9",
				canvas: p.canvas,
				tracks: structuredClone(p.repurposeBoard!.artboards[1].tracks!),
			},
		];
		expect(() => validateTimelineProject(p, { mode: "canonical" })).toThrow(/owner/);
	});
	it("rejects changing A's mirrored Record placement to B's composition", () => {
		const p = ownershipFixture();
		const tracks = structuredClone(p.repurposeBoard!.artboards[0].tracks!);
		tracks[0].clips[0].compositionId = "composition-B";
		p.stories = [
			{
				id: "story-A",
				artboardId: "A",
				name: "A",
				aspectRatio: "16:9",
				canvas: p.canvas,
				tracks,
			},
		];
		expect(() => validateTimelineProject(p, { mode: "canonical" })).toThrow(/owner/);
	});
	it("rejects duplicate entries in a projection's private mirror", () => {
		const p = ownershipFixture();
		const a = p.repurposeBoard!.artboards[0];
		p.stories = [
			{
				id: "story-A",
				artboardId: "A",
				name: "A",
				aspectRatio: "16:9",
				canvas: p.canvas,
				tracks: structuredClone(a.tracks!),
				localAssets: [
					structuredClone(a.localAssets![0]),
					structuredClone(a.localAssets![0]),
				],
			},
		];
		expect(() => validateTimelineProject(p, { mode: "canonical" })).toThrow(/Duplicate/);
	});
	it("accepts equivalent private mirrors regardless of serialized property order", () => {
		const p = ownershipFixture();
		const a = p.repurposeBoard!.artboards[0];
		const media = a.localAssets![0];
		p.stories = [
			{
				id: "story-A",
				artboardId: "A",
				name: "A",
				aspectRatio: "16:9",
				canvas: p.canvas,
				tracks: structuredClone(a.tracks!),
				localAssets: [
					{
						source: media.source,
						height: media.height,
						width: media.width,
						durationUs: media.durationUs,
						kind: media.kind,
						name: media.name,
						id: media.id,
					},
				],
			},
		];
		expect(() => validateTimelineProject(p, { mode: "canonical" })).not.toThrow();
	});
	it("rejects a template default duration beyond its inline source extent", () => {
		const p = ownershipFixture();
		p.designTemplates = [
			{
				id: "template",
				name: "Template",
				kind: "text",
				content: { kind: "text", text: fixtureText, durationUs: 5_000_000 },
				width: 1920,
				height: 1080,
				defaultDurationUs: 5_000_001,
			},
		];
		expect(() => validateTimelineProject(p, { mode: "canonical" })).toThrow(/duration/);
		p.designTemplates[0].defaultDurationUs = 5_000_000;
		expect(() => validateTimelineProject(p, { mode: "canonical" })).not.toThrow();
	});
	it("rejects duplicate private physical IDs across siblings", () => {
		const p = ownershipFixture();
		p.repurposeBoard!.artboards[1].localAssets = structuredClone(
			p.repurposeBoard!.artboards[0].localAssets,
		);
		expect(() => validateTimelineProject(p, { mode: "canonical" })).toThrow(/ID/);
	});
	it("rejects an ambiguous legacy Story alias instead of selecting an arbitrary owner", () => {
		const p = ownershipFixture();
		p.repurposeBoard!.artboards[1].id = "story-A";
		p.stories = [
			{ id: "story-A", name: "Ambiguous", aspectRatio: "16:9", canvas: p.canvas, tracks: [] },
		];
		expect(() => validateTimelineProject(p, { mode: "legacy" })).toThrow(/Ambiguous/);
	});
	it("accepts independent owners and mirrored projections without double-registering IDs", () => {
		const p = ownershipFixture();
		const a = p.repurposeBoard!.artboards[0];
		p.stories = [
			{
				id: "story-A",
				artboardId: "A",
				name: "A",
				aspectRatio: "16:9",
				canvas: p.canvas,
				tracks: structuredClone(a.tracks!),
				localAssets: structuredClone(a.localAssets),
			},
		];
		expect(validateTimelineProject(p, { mode: "canonical" })).toBe(p);
	});
	it.each([
		[
			"both sources",
			(p: any) => {
				p.tracks[0].clips[0].content = {
					kind: "text",
					text: fixtureText,
					durationUs: 5_000_000,
				};
			},
		],
		[
			"neither source",
			(p: any) => {
				delete p.tracks[0].clips[0].assetId;
			},
		],
		[
			"duplicate private ID",
			(p: any) => {
				p.repurposeBoard.artboards[0].localAssets[0].id = "shared";
			},
		],
		[
			"sibling duplicate clip ID",
			(p: any) => {
				p.repurposeBoard.artboards[1].tracks[0].clips[0].id = "record-A";
			},
		],
		[
			"private Recording Asset",
			(p: any) => {
				p.repurposeBoard.artboards[0].localAssets.push(p.assets[1]);
			},
		],
		[
			"dangling private reference",
			(p: any) => {
				p.repurposeBoard.artboards[1].tracks.push({
					...p.repurposeBoard.artboards[0].tracks[3],
					id: "sibling-audio",
					clips: [fixtureClip("sibling-voice", { assetId: "voice-A" })],
				});
			},
		],
		[
			"inline on audio track",
			(p: any) => {
				p.repurposeBoard.artboards[0].tracks[1].kind = "audio";
			},
		],
		[
			"invalid inline extent",
			(p: any) => {
				p.repurposeBoard.artboards[0].tracks[1].clips[0].content.durationUs = 0;
			},
		],
		[
			"invalid inline text",
			(p: any) => {
				p.repurposeBoard.artboards[0].tracks[1].clips[0].content.text.fontSizePx = -1;
			},
		],
		[
			"invalid inline shape",
			(p: any) => {
				p.repurposeBoard.artboards[0].tracks[2].clips[0].content.shapeDefinition.width = -1;
			},
		],
		[
			"shared Record composition",
			(p: any) => {
				p.repurposeBoard.artboards[1].tracks[0].clips[0].compositionId = "composition-A";
			},
		],
		[
			"bad template kind",
			(p: any) => {
				p.designTemplates = [
					{
						id: "template",
						name: "Template",
						kind: "shape",
						content: { kind: "text", text: fixtureText, durationUs: 5_000_000 },
						width: 100,
						height: 100,
						defaultDurationUs: 5_000_000,
					},
				];
			},
		],
		[
			"invalid template content",
			(p: any) => {
				p.designTemplates = [
					{
						id: "template",
						name: "Template",
						kind: "text",
						content: {
							kind: "text",
							text: { ...fixtureText, color: "bad" },
							durationUs: 5_000_000,
						},
						width: 100,
						height: 100,
						defaultDurationUs: 5_000_000,
					},
				];
			},
		],
	])("rejects %s", (_name, mutate) => {
		const p = ownershipFixture();
		mutate(p);
		expect(() => validateTimelineProject(p, { mode: "canonical" })).toThrow();
	});
	it("keeps legacy design validation explicit at the ingress boundary", () => {
		const p = ownershipFixture();
		p.assets.push({
			id: "legacy-text",
			kind: "text",
			name: "Legacy",
			text: fixtureText,
			width: 1920,
			height: 1080,
			durationUs: 5_000_000,
		});
		expect(() => validateTimelineProject(p, { mode: "legacy" })).not.toThrow();
		expect(() => validateTimelineProject(p, { mode: "canonical" })).toThrow();
	});
	it("uses finite inline extents for transition handles inside an Artboard", () => {
		const p = ownershipFixture();
		const a = p.repurposeBoard!.artboards[0];
		const track = a.tracks![2];
		const first = track.clips[0];
		track.clips.push({ ...structuredClone(first), id: "next-shape", startUs: 5_000_000 });
		a.clipTransitions = [
			{
				id: "shape-transition",
				trackId: track.id,
				fromClipId: first.id,
				toClipId: "next-shape",
				durationUs: 500_000,
				easing: "linear",
				preset: { kind: "cross-dissolve" },
			},
		];
		expect(() => validateTimelineProject(p, { mode: "canonical" })).toThrow(/handles/);
	});
	it("validates projection references in their owner scope without trusting a forged private mirror", () => {
		const p = ownershipFixture();
		p.stories = [
			{
				id: "story-B",
				artboardId: "B",
				name: "B",
				aspectRatio: "16:9",
				canvas: p.canvas,
				tracks: [
					{
						id: "projection-audio",
						name: "Audio",
						kind: "audio",
						locked: false,
						muted: false,
						hidden: false,
						clips: [fixtureClip("leaked", { assetId: "voice-A" })],
					},
				],
				localAssets: structuredClone(p.repurposeBoard!.artboards[0].localAssets),
			},
		];
		expect(() => validateTimelineProject(p, { mode: "canonical" })).toThrow();
	});
	it("rejects malformed legacy standalone Story content before normalization", () => {
		const p = ownershipFixture();
		p.stories = [
			{
				id: "standalone",
				name: "Standalone",
				aspectRatio: "16:9",
				canvas: p.canvas,
				tracks: [
					{
						id: "standalone-track",
						name: "Video",
						kind: "visual",
						locked: false,
						muted: false,
						hidden: false,
						clips: [fixtureClip("invalid-story-clip", { assetId: "gone" })],
					},
				],
			},
		];
		expect(() => validateTimelineProject(p, { mode: "legacy" })).toThrow();
	});
	it("keeps empty libraries valid", () => {
		const p = createTimelineProject("empty", "Empty");
		p.localAssets = [];
		expect(() => validateTimelineProject(p, { mode: "canonical" })).not.toThrow();
	});
});

const clipIds = ["clip-a", "clip-b", "clip-c"];

function projectWithThreeClips() {
	let project = registerMedia(createTimelineProject("visual-test", "Visual effects"), {
		id: "video",
		kind: "video",
		name: "Video",
		durationUs: 10_000_000,
		width: 1920,
		height: 1080,
		source: { path: "media/video.mp4", durationUs: 30_000_000, offsetUs: 0 },
	});
	for (let index = 0; index < clipIds.length; index++)
		project = placeAsset(project, "video", "visual-1", index * 10_000_000, {
			clipId: clipIds[index],
		});
	return project;
}

function transition(overrides: Record<string, unknown> = {}) {
	return {
		id: "transition-a",
		trackId: "visual-1",
		fromClipId: clipIds[0],
		toClipId: clipIds[1],
		preset: { kind: "cross-dissolve" },
		durationUs: 500_000,
		easing: "linear",
		...overrides,
	};
}

function withTransitions(transitions: unknown[]) {
	const project = projectWithThreeClips();
	const [outgoing, incoming, following] = project.tracks[0]!.clips;
	outgoing!.sourceOutUs = 9_500_000;
	incoming!.sourceInUs = 500_000;
	incoming!.startUs = 9_500_000;
	following!.startUs = 19_000_000;
	return { ...project, clipTransitions: transitions } as never;
}

function withShapes(shapeDefinitions: unknown[]) {
	const project = createTimelineProject("shapes-test", "Shapes");
	(project.assets as unknown[]).push(
		...shapeDefinitions.map((shapeDefinition, index) => ({
			id: `shape-${index}`,
			kind: "shape",
			name: `Shape ${index}`,
			durationUs: 5_000_000,
			width: 100,
			height: 50,
			shapeDefinition,
		})),
	);
	return project;
}

function projectWithShapeClip(overrides: Partial<TimelineClip> = {}) {
	const project = withShapes([
		{
			kind: "rectangle",
			width: 100,
			height: 50,
			style: { fill: "#ffffff", stroke: null },
		},
	]);
	project.tracks[0]!.clips.push({
		id: "shape-placement",
		assetId: "shape-0",
		startUs: 0,
		sourceInUs: 0,
		sourceOutUs: 5_000_000,
		rate: 1,
		transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
		gain: 1,
		enabled: true,
		...overrides,
	});
	return project;
}

describe("V3 visual effects and shape validation", () => {
	it("accepts existing V3 projects without optional visual-effect fields", () => {
		const project = createTimelineProject("legacy-v3", "Existing V3");
		expect(validateTimelineProject(project, { mode: "legacy" })).toEqual(project);
	});

	it("accepts every clip transition preset", () => {
		const presets = [
			{ kind: "cross-dissolve" },
			{ kind: "fade-through", color: "black" },
			{ kind: "fade-through", color: "white" },
			...(["left", "right", "up", "down"] as const).map((direction) => ({
				kind: "wipe",
				direction,
			})),
			...(["left", "right", "up", "down"] as const).map((direction) => ({
				kind: "push",
				direction,
			})),
		];
		for (const preset of presets)
			expect(
				validateTimelineProject(withTransitions([transition({ preset })])),
			).toBeDefined();
	});

	it("accepts four pathless shape definitions", () => {
		const style = { fill: "#ffffff", stroke: { color: "#111111", width: 2 } };
		const strokeStyle = { stroke: { color: "#111111", width: 2 } };
		const definitions = [
			{ kind: "rectangle", width: 100, height: 50, style },
			{ kind: "ellipse", width: 100, height: 50, style },
			{ kind: "line", from: { x: 0, y: 25 }, to: { x: 100, y: 25 }, style: strokeStyle },
			{
				kind: "arrow",
				from: { x: 0, y: 25 },
				to: { x: 100, y: 25 },
				headLength: 12,
				style: strokeStyle,
			},
		];
		expect(
			validateTimelineProject(withShapes(definitions), { mode: "legacy" }).assets,
		).toHaveLength(4);
	});

	it("rejects unknown transition presets and easing values", () => {
		expect(() =>
			validateTimelineProject(withTransitions([transition({ preset: { kind: "spin" } })])),
		).toThrow(/transition|preset/i);
		expect(() =>
			validateTimelineProject(withTransitions([transition({ easing: "bounce" })])),
		).toThrow(/transition|easing/i);
	});

	it("requires direction for directional transition presets", () => {
		expect(() =>
			validateTimelineProject(withTransitions([transition({ preset: { kind: "wipe" } })])),
		).toThrow(/direction/i);
	});

	it("rejects invalid colors and shape geometry", () => {
		const invalidColor = withShapes([
			{
				kind: "rectangle",
				width: 100,
				height: 50,
				style: { fill: "#fff", stroke: null },
			},
		]);
		expect(() => validateTimelineProject(invalidColor, { mode: "legacy" })).toThrow(/color/i);

		const invalidGeometry = withShapes([
			{
				kind: "line",
				from: { x: 10, y: 10 },
				to: { x: 10, y: 10 },
				style: { stroke: { color: "#000000", width: 1 } },
			},
		]);
		expect(() => validateTimelineProject(invalidGeometry, { mode: "legacy" })).toThrow(
			/point|geometry|line/i,
		);
	});

	it("rejects unsafe transition durations", () => {
		expect(() =>
			validateTimelineProject(
				withTransitions([transition({ durationUs: Number.MAX_SAFE_INTEGER + 1 })]),
			),
		).toThrow(/transition|duration/i);
	});

	it("rejects duplicate transition IDs", () => {
		const first = transition();
		const second = transition({ fromClipId: clipIds[1], toClipId: clipIds[2] });
		expect(() => validateTimelineProject(withTransitions([first, second]))).toThrow(
			/duplicate|ID/i,
		);
	});

	it("rejects transitions with invalid track or clip references", () => {
		expect(() =>
			validateTimelineProject(withTransitions([transition({ toClipId: "missing-clip" })])),
		).toThrow(/transition|clip|reference/i);
		expect(() =>
			validateTimelineProject(withTransitions([transition({ trackId: "audio-1" })])),
		).toThrow(/transition|track|visual/i);
	});

	it("rejects disabled or non-adjacent transition clips", () => {
		const disabled = projectWithThreeClips();
		disabled.tracks[0]!.clips[0]!.enabled = false;
		expect(() =>
			validateTimelineProject({ ...disabled, clipTransitions: [transition()] }),
		).toThrow(/transition|enabled|adjacent/i);

		const separated = projectWithThreeClips();
		separated.tracks[0]!.clips[1]!.startUs = 10_500_000;
		separated.tracks[0]!.clips[2]!.startUs = 20_500_000;
		expect(() =>
			validateTimelineProject({ ...separated, clipTransitions: [transition()] }),
		).toThrow(/transition|adjacent/i);
	});

	it("rejects transition durations beyond source handles in saved projects", () => {
		expect(() =>
			validateTimelineProject(withTransitions([transition({ durationUs: 1_000_001 })])),
		).toThrow(/handle|duration/i);
	});

	it("rejects overlapping neighboring transition intervals in saved projects", () => {
		const project = projectWithThreeClips();
		const [outgoing, middle, incoming] = project.tracks[0]!.clips;
		outgoing!.sourceOutUs = 9_500_000;
		middle!.startUs = 9_500_000;
		middle!.sourceInUs = 500_000;
		middle!.sourceOutUs = 900_000;
		incoming!.startUs = 9_900_000;
		incoming!.sourceInUs = 500_000;
		const overlapping = {
			...project,
			clipTransitions: [
				transition({ durationUs: 600_000 }),
				transition({
					id: "transition-b",
					fromClipId: clipIds[1],
					toClipId: clipIds[2],
					durationUs: 600_000,
				}),
			],
		};
		expect(() => validateTimelineProject(overlapping)).toThrow(/overlap|handle/i);
	});

	it("accepts component animations and per-placement shape style overrides", () => {
		const project = projectWithShapeClip({
			componentAnimation: {
				enter: {
					preset: "slide",
					durationUs: 300_000,
					easing: "ease-out",
					direction: "left",
				},
				exit: { preset: "fade", durationUs: 300_000, easing: "linear" },
			},
			shapeStyleOverride: { fill: "#aabbcc", stroke: { color: "#112233", width: 1.5 } },
		});
		expect(validateTimelineProject(project, { mode: "legacy" })).toEqual(project);
	});

	it("rejects overlapping component animations and invalid shape overrides", () => {
		const overlapping = projectWithShapeClip({
			sourceOutUs: 1_000_000,
			componentAnimation: {
				enter: { preset: "fade", durationUs: 600_000, easing: "linear" },
				exit: { preset: "fade", durationUs: 500_000, easing: "linear" },
			},
		});
		expect(() => validateTimelineProject(overlapping, { mode: "legacy" })).toThrow(
			/animation.*overlap/i,
		);

		const invalidOverride = projectWithShapeClip({
			shapeStyleOverride: { fill: "red", stroke: null },
		});
		expect(() => validateTimelineProject(invalidOverride, { mode: "legacy" })).toThrow(
			/color/i,
		);
	});
});
