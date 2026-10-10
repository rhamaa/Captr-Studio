import { describe, expect, it } from "vitest";
import {
	addClipTransition,
	getMaxClipTransitionDurationUs,
	removeClipTransition,
	setComponentAnimation,
	updateClipTransition,
} from "./clipTransitions";
import {
	addTrack,
	createTimelineProject,
	moveClip,
	placeAsset,
	registerMedia,
	registerRecording,
} from "./commands";
import { fixtureClip, fixtureText, fixtureTrack } from "./storyOwnership.fixtures";
import { type ComponentAnimation, clipDurationUs } from "./types";

it.each([0.5, 2])("uses finite inline shape and text handles at rate %s", (rate) => {
	const project = createTimelineProject("inline-handles", "Inline");
	const from = fixtureClip("out", { content: { kind: "shape", durationUs: 5_000_000,
		shapeDefinition: { kind: "rectangle", width: 100, height: 50, style: { fill: "#ffffff", stroke: null } } } });
	const to = fixtureClip("in", { content: { kind: "text", durationUs: 5_000_000, text: fixtureText } });
	from.sourceOutUs = 4_000_000; from.rate = rate;
	to.sourceInUs = 1_000_000; to.rate = rate; to.startUs = clipDurationUs(from);
	project.tracks = [fixtureTrack("visual-1", [from, to])];
	expect(getMaxClipTransitionDurationUs(project, "out", "in")).toBe(2_000_000 / rate);
	const withTransition = addClipTransition(project, { ...transitionInput, durationUs: 500_000 }, "inline-transition");
	expect(() => updateClipTransition(withTransition, "inline-transition", { durationUs: 2_000_000 / rate + 1 })).toThrow(/handle/);
	expect(moveClip(withTransition, "in", "visual-1", to.startUs + 1_000_000).clipTransitions).toEqual([]);
	expect(removeClipTransition(withTransition, "inline-transition").clipTransitions).toEqual([]);
});

function videoPair({ tailUs = 2_000_000, headUs = 2_000_000, fromRate = 1, toRate = 1 } = {}) {
	let project = createTimelineProject("transition-test", "Transitions");
	for (const id of ["outgoing", "incoming"])
		project = registerMedia(project, {
			id,
			kind: "video",
			name: id,
			durationUs: 8_000_000,
			width: 1920,
			height: 1080,
			source: { path: `${id}.mp4`, durationUs: 8_000_000, offsetUs: 0 },
		});
	project = placeAsset(project, "outgoing", "visual-1", 0, { clipId: "out" });
	project = placeAsset(project, "incoming", "visual-1", 8_000_000, { clipId: "in" });
	const outgoing = project.tracks[0]!.clips[0]!;
	const incoming = project.tracks[0]!.clips[1]!;
	outgoing.sourceOutUs = 8_000_000 - tailUs;
	outgoing.rate = fromRate;
	incoming.sourceInUs = headUs;
	incoming.rate = toRate;
	incoming.startUs = outgoing.startUs + clipDurationUs(outgoing);
	return project;
}

function recordingPair() {
	let project = registerRecording(createTimelineProject("recording-transition", "Record"), {
		captureId: "take",
		name: "Take",
		durationUs: 10_000_000,
		width: 1920,
		height: 1080,
		screen: { path: "take.mp4", durationUs: 10_000_000, offsetUs: 0 },
		settings: {},
	}, { assetId: "recording", packageId: "package" });
	project = placeAsset(project, "recording", "visual-1", 0, {
		clipId: "out",
		compositionId: "out-composition",
	});
	project = placeAsset(project, "recording", "visual-1", 10_000_000, {
		clipId: "in",
		compositionId: "in-composition",
	});
	for (const composition of project.compositions) {
		composition.durationUs = 8_000_000;
		composition.timeMap = [
			{ outputStartUs: 0, outputEndUs: 3_000_000, sourceStartUs: 0, rate: 2 },
			{ outputStartUs: 3_000_000, outputEndUs: 8_000_000, sourceStartUs: 6_000_000, rate: 0.4 },
		];
	}
	const outgoing = project.tracks[0]!.clips[0]!;
	const incoming = project.tracks[0]!.clips[1]!;
	outgoing.sourceOutUs = 6_000_000;
	outgoing.rate = 2;
	incoming.sourceInUs = 1_000_000;
	incoming.rate = 0.5;
	incoming.startUs = outgoing.startUs + clipDurationUs(outgoing);
	return project;
}

const transitionInput = {
	trackId: "visual-1",
	fromClipId: "out",
	toClipId: "in",
	preset: { kind: "cross-dissolve" } as const,
	easing: "ease-in-out" as const,
};

describe("clip transition commands", () => {
	it("requires adjacent visual clips on the same track", () => {
		const separated = moveClip(videoPair(), "in", "visual-1", 9_000_000);
		expect(() => getMaxClipTransitionDurationUs(separated, "out", "in")).toThrow(/adjacent/i);

		let splitTrack = addTrack(videoPair(), "visual-2", "visual");
		splitTrack = moveClip(splitTrack, "in", "visual-2", 6_000_000);
		expect(() => getMaxClipTransitionDurationUs(splitTrack, "out", "in")).toThrow(/same track/i);
	});

	it("maps playback rate and Record composition handles to project time", () => {
		expect(getMaxClipTransitionDurationUs(videoPair({ fromRate: 2, toRate: 0.5 }), "out", "in"))
			.toBe(2_000_000);
		expect(getMaxClipTransitionDurationUs(recordingPair(), "out", "in")).toBe(2_000_000);
	});

	it("defaults to 500 ms or the smaller available maximum", () => {
		const ordinary = addClipTransition(videoPair(), transitionInput, "transition-default");
		expect(ordinary.clipTransitions?.[0]?.durationUs).toBe(500_000);

		const constrained = addClipTransition(
			videoPair({ tailUs: 100_000, headUs: 50_000 }),
			transitionInput,
			"transition-constrained",
		);
		expect(constrained.clipTransitions?.[0]?.durationUs).toBe(100_000);
	});

	it("limits neighboring transitions so their project-time intervals never overlap", () => {
		let project = videoPair();
		const middle = project.tracks[0]!.clips[1]!;
		middle.sourceOutUs = 2_400_000;
		project = registerMedia(project, {
			id: "third",
			kind: "video",
			name: "Third",
			durationUs: 8_000_000,
			width: 1920,
			height: 1080,
			source: { path: "third.mp4", durationUs: 8_000_000, offsetUs: 0 },
		});
		project = placeAsset(project, "third", "visual-1", 6_400_000, { clipId: "third-clip" });
		project.tracks[0]!.clips[2]!.sourceInUs = 2_000_000;
		const first = addClipTransition(project, { ...transitionInput, durationUs: 600_000 }, "first");
		expect(getMaxClipTransitionDurationUs(first, "in", "third-clip")).toBe(200_000);
		const second = addClipTransition(first, {
			...transitionInput,
			fromClipId: "in",
			toClipId: "third-clip",
		}, "second");
		expect(second.clipTransitions?.map((transition) => transition.durationUs)).toEqual([600_000, 200_000]);
		expect(() => updateClipTransition(second, "first", { durationUs: 700_000 })).toThrow(/maximum|overlap|handle/i);
	});

	it("rejects a requested duration above the handle maximum without mutation", () => {
		const project = videoPair({ tailUs: 100_000, headUs: 50_000 });
		const before = structuredClone(project);
		expect(() =>
			addClipTransition(project, { ...transitionInput, durationUs: 100_001 }, "too-long"),
		).toThrow(/maximum|handle/i);
		expect(project).toEqual(before);
	});

	it("updates or removes a transition immutably and rejects an invalid duration", () => {
		const withTransition = addClipTransition(videoPair(), transitionInput, "transition-edit");
		expect(() => updateClipTransition(withTransition, "transition-edit", { durationUs: 9_000_000 }))
			.toThrow(/maximum|handle/i);
		const updated = updateClipTransition(withTransition, "transition-edit", {
			preset: { kind: "fade-through", color: "white" },
			easing: "ease-out",
		});
		expect(updated.clipTransitions?.[0]?.preset).toEqual({ kind: "fade-through", color: "white" });
		expect(withTransition.clipTransitions?.[0]?.preset).toEqual({ kind: "cross-dissolve" });
		expect(removeClipTransition(updated, "transition-edit").clipTransitions).toEqual([]);
	});

	it("requires an unlocked visual track and valid relation IDs", () => {
		const locked = videoPair();
		locked.tracks[0]!.locked = true;
		expect(() => addClipTransition(locked, transitionInput, "locked-transition")).toThrow(/locked/i);
		expect(() => addClipTransition(videoPair(), transitionInput, "bad/id")).toThrow(/ID/i);
	});

	it("rejects component animation overlap and durations over two seconds", () => {
		const project = videoPair({ tailUs: 5_000_000, headUs: 1_000_000 });
		project.tracks[0]!.clips[0]!.sourceOutUs = 2_500_000;
		const incoming = project.tracks[0]!.clips[1]!;
		incoming.sourceOutUs = 3_000_000;
		incoming.startUs = project.tracks[0]!.clips[0]!.startUs + clipDurationUs(project.tracks[0]!.clips[0]!);
		const enter: ComponentAnimation = { preset: "fade", durationUs: 1_500_000, easing: "linear" };
		const exit: ComponentAnimation = { preset: "fade", durationUs: 1_500_000, easing: "ease-out" };
		const withEnter = setComponentAnimation(project, "out", "enter", enter);
		expect(() => setComponentAnimation(withEnter, "out", "exit", exit)).toThrow(/overlap/i);
		expect(() =>
			setComponentAnimation(project, "out", "enter", { ...enter, durationUs: 2_000_001 }),
		).toThrow(/duration/i);
	});
});
