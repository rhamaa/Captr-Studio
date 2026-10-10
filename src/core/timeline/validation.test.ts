import { describe, expect, it } from "vitest";
import { createTimelineProject, placeAsset, registerMedia } from "./commands";
import type { TimelineClip } from "./types";
import { validateTimelineProject } from "./validation";

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
		expect(validateTimelineProject(project)).toEqual(project);
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
			expect(validateTimelineProject(withTransitions([transition({ preset })]))).toBeDefined();
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
		expect(validateTimelineProject(withShapes(definitions)).assets).toHaveLength(4);
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
			validateTimelineProject(
				withTransitions([transition({ preset: { kind: "wipe" } })]),
			),
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
		expect(() => validateTimelineProject(invalidColor)).toThrow(/color/i);

		const invalidGeometry = withShapes([
			{
				kind: "line",
				from: { x: 10, y: 10 },
				to: { x: 10, y: 10 },
				style: { stroke: { color: "#000000", width: 1 } },
			},
		]);
		expect(() => validateTimelineProject(invalidGeometry)).toThrow(/point|geometry|line/i);
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
		expect(() => validateTimelineProject(withTransitions([first, second]))).toThrow(/duplicate|ID/i);
	});

	it("rejects transitions with invalid track or clip references", () => {
		expect(() =>
			validateTimelineProject(
				withTransitions([transition({ toClipId: "missing-clip" })]),
			),
		).toThrow(/transition|clip|reference/i);
		expect(() =>
			validateTimelineProject(
				withTransitions([transition({ trackId: "audio-1" })]),
			),
		).toThrow(/transition|track|visual/i);
	});

	it("rejects disabled or non-adjacent transition clips", () => {
		const disabled = projectWithThreeClips();
		disabled.tracks[0]!.clips[0]!.enabled = false;
		expect(() => validateTimelineProject({ ...disabled, clipTransitions: [transition()] })).toThrow(
			/transition|enabled|adjacent/i,
		);

		const separated = projectWithThreeClips();
		separated.tracks[0]!.clips[1]!.startUs = 10_500_000;
		separated.tracks[0]!.clips[2]!.startUs = 20_500_000;
		expect(() =>
			validateTimelineProject({ ...separated, clipTransitions: [transition()] }),
		).toThrow(/transition|adjacent/i);
	});

	it("rejects transition durations beyond source handles in saved projects", () => {
		expect(() => validateTimelineProject(withTransitions([transition({ durationUs: 1_000_001 })])))
			.toThrow(/handle|duration/i);
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
				enter: { preset: "slide", durationUs: 300_000, easing: "ease-out", direction: "left" },
				exit: { preset: "fade", durationUs: 300_000, easing: "linear" },
			},
			shapeStyleOverride: { fill: "#aabbcc", stroke: { color: "#112233", width: 1.5 } },
		});
		expect(validateTimelineProject(project)).toEqual(project);
	});

	it("rejects overlapping component animations and invalid shape overrides", () => {
		const overlapping = projectWithShapeClip({
			sourceOutUs: 1_000_000,
			componentAnimation: {
				enter: { preset: "fade", durationUs: 600_000, easing: "linear" },
				exit: { preset: "fade", durationUs: 500_000, easing: "linear" },
			},
		});
		expect(() => validateTimelineProject(overlapping)).toThrow(/animation.*overlap/i);

		const invalidOverride = projectWithShapeClip({
			shapeStyleOverride: { fill: "red", stroke: null },
		});
		expect(() => validateTimelineProject(invalidOverride)).toThrow(/color/i);
	});
});
