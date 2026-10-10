import { describe, expect, it } from "vitest";
import { addClipTransition } from "./clipTransitions";
import { createTimelineProject, placeAsset, registerMedia, registerRecording } from "./commands";
import { evaluateProject } from "./evaluation";
import { fixtureClip, fixtureText, fixtureTrack } from "./storyOwnership.fixtures";
import { type ComponentAnimation, clipDurationUs } from "./types";
import { sampleClipTransition, sampleComponentAnimation } from "./visualAnimation";

it("retains a resolved inline descriptor without registering a media asset", () => {
	const project = createTimelineProject("inline-sample", "Inline");
	project.tracks = [fixtureTrack("design", [fixtureClip("title", {
		content: { kind: "text", text: fixtureText, durationUs: 5_000_000 },
	})])];
	const visual = evaluateProject(project, 1_000_000).visuals[0];
	expect(visual.source).toMatchObject({ kind: "text", width: 1920, height: 1080, durationUs: 5_000_000, content: { text: fixtureText } });
	expect(visual.source.media).toBeUndefined();
	expect(project.assets).toEqual([]);
});

function projectWithTransition(fromRate = 1, toRate = 1) {
	let project = createTimelineProject("sample-project", "Sampling");
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
	const outgoing = project.tracks[0]!.clips[0]!,
		incoming = project.tracks[0]!.clips[1]!;
	outgoing.sourceOutUs = 6_000_000;
	outgoing.rate = fromRate;
	incoming.sourceInUs = 2_000_000;
	incoming.rate = toRate;
	incoming.startUs = outgoing.startUs + clipDurationUs(outgoing);
	project = addClipTransition(
		project,
		{
			trackId: "visual-1",
			fromClipId: "out",
			toClipId: "in",
			preset: { kind: "cross-dissolve" },
			easing: "linear",
			durationUs: 1_000_000,
		},
		"transition",
	);
	return project;
}

const animation: ComponentAnimation = {
	preset: "fade",
	durationUs: 1_000_000,
	easing: "ease-in",
};

describe("deterministic visual animation sampling", () => {
	it("sampleClipTransition_returnsNullOutsideHalfOpenInterval", () => {
		const project = projectWithTransition();
		expect(sampleClipTransition(project, project.clipTransitions![0]!, 5_499_999)).toBeNull();
		expect(sampleClipTransition(project, project.clipTransitions![0]!, 6_500_000)).toBeNull();
		expect(sampleClipTransition(project, project.clipTransitions![0]!, 5_500_000)).not.toBeNull();
	});

	it("sampleClipTransition_isCorrectAtStartMiddleAndEnd", () => {
		const project = projectWithTransition(), transition = project.clipTransitions![0]!;
		expect(sampleClipTransition(project, transition, 5_500_000)?.progress).toBe(0);
		expect(sampleClipTransition(project, transition, 6_000_000)?.progress).toBe(0.5);
		expect(sampleClipTransition(project, transition, 6_499_999)?.progress).toBeCloseTo(0.999999);
		expect(sampleClipTransition(project, transition, 6_500_000)).toBeNull();
	});

	it("sampleClipTransition_mapsBothHandleSamplesThroughRate", () => {
		const project = projectWithTransition(2, 0.5), transition = project.clipTransitions![0]!;
		const sample = sampleClipTransition(project, transition, 2_750_000)!;
		expect(sample.outgoing.compositionUs).toBe(5_500_000);
		expect(sample.incoming.compositionUs).toBe(1_875_000);
		expect(sample.outgoing.sourceUs).toBe(5_500_000);
		expect(sample.incoming.sourceUs).toBe(1_875_000);
	});

	it("maps Record transition samples through the composition source clock", () => {
		let project = registerRecording(createTimelineProject("record-transition", "Record"), {
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
				{ outputStartUs: 0, outputEndUs: 4_000_000, sourceStartUs: 0, rate: 2 },
				{ outputStartUs: 4_000_000, outputEndUs: 8_000_000, sourceStartUs: 8_000_000, rate: 0.5 },
			];
		}
		const outgoing = project.tracks[0]!.clips[0]!, incoming = project.tracks[0]!.clips[1]!;
		outgoing.sourceOutUs = 6_000_000;
		outgoing.rate = 2;
		incoming.sourceInUs = 1_000_000;
		incoming.sourceOutUs = 8_000_000;
		incoming.rate = 0.5;
		incoming.startUs = 3_000_000;
		project = addClipTransition(
			project,
			{
				trackId: "visual-1",
				fromClipId: "out",
				toClipId: "in",
				preset: { kind: "cross-dissolve" },
				easing: "linear",
				durationUs: 500_000,
			},
			"record-transition",
		);
		const sample = sampleClipTransition(project, project.clipTransitions![0]!, 3_000_000)!;
		expect(sample.outgoing.compositionUs).toBe(6_000_000);
		expect(sample.outgoing.sourceUs).toBe(9_000_000);
		expect(sample.incoming.compositionUs).toBe(1_000_000);
		expect(sample.incoming.sourceUs).toBe(2_000_000);
	});

	it("sampleComponentAnimation_returnsStableProgressAtRandomSeek", () => {
		const samples = [5_000_000, 2_500_000, 2_000_000, 3_000_000, 2_500_000].map((timeUs) =>
			sampleComponentAnimation(animation, "enter", 2_000_000, 8_000_000, timeUs),
		);
		expect(samples[1]?.progress).toBe(0.25);
		expect(samples[4]).toEqual(samples[1]);
		expect(samples[0]).toBeNull();
		expect(samples[2]?.progress).toBe(0);
		expect(samples[3]).toBeNull();
	});

	it("sampleComponentAnimation_usesProjectClockAtRateChanges", () => {
		const enter = sampleComponentAnimation(animation, "enter", 0, 5_000_000, 500_000);
		const exit = sampleComponentAnimation(animation, "exit", 0, 5_000_000, 4_500_000);
		expect(enter?.progress).toBe(0.25);
		expect(exit?.progress).toBe(0.25);
	});
});
