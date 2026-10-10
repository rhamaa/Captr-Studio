import { expect, it } from "vitest";
import { audioAtTime, buildProjectAudioPlan } from "./audioPlan";
import { resolveClipSource } from "./clipSource";
import { addClipTransition, setComponentAnimation } from "./clipTransitions";
import {
	addTrack,
	createTimelineProject,
	placeAsset,
	registerMedia,
	registerRecording,
	setClipRate,
	updateComposition
} from "./commands";
import { evaluateProject } from "./evaluation";
import { fixtureClip, fixtureText, fixtureTrack } from "./storyOwnership.fixtures";

it.each([0.5, 2])("schedules private Story audio and silent inline content at rate %s", (rate) => {
	const project = createTimelineProject("scoped-audio", "Scoped audio");
	project.tracks = [fixtureTrack("design", [fixtureClip("title", {
		content: { kind: "text", text: fixtureText, durationUs: 5_000_000 },
	})])];
	expect(buildProjectAudioPlan(project)).toHaveLength(0);
	project.localAssets = [{ id: "private-audio", kind: "audio", name: "Voice", width: 0, height: 0,
		durationUs: 5_000_000, source: { path: "voice.wav", durationUs: 4_000_000, offsetUs: 1_000_000 } }];
	const clip = fixtureClip("voice", { assetId: "private-audio" });
	clip.rate = rate;
	project.tracks.push(fixtureTrack("voice-track", [clip], "audio"));
	expect(buildProjectAudioPlan(project)).toHaveLength(1);
	expect(buildProjectAudioPlan(project)[0]).toMatchObject({ startUs: 1_000_000 / rate, endUs: 5_000_000 / rate, rate });
	for (const sourceUs of [1_000_000, 3_000_000, 4_999_999])
		expect(evaluateProject(project, sourceUs / rate).audio[0]).toMatchObject({ path: "voice.wav", sourceUs: sourceUs - 1_000_000, rate });
	expect(evaluateProject(project, 5_000_000 / rate).audio).toEqual([]);
	const sibling = { ...project, localAssets: [] };
	expect(() => resolveClipSource(sibling, clip)).toThrow(/Story scope/);
	expect(() => buildProjectAudioPlan(sibling)).toThrow(/Story scope/);
});

const recording = {
	captureId: "capture",
	name: "Screen",
	durationUs: 10_000_000,
	width: 1280,
	height: 720,
	screen: { path: "screen.mp4", durationUs: 10_000_000, offsetUs: 0 },
	microphone: { path: "mic.wav", durationUs: 9_000_000, offsetUs: 1_000_000 },
	system: { path: "system.wav", durationUs: 10_000_000, offsetUs: 0 },
	webcam: { path: "webcam.mp4", durationUs: 9_000_000, offsetUs: 1_000_000 },
	settings: {},
};
function fixture() {
	return placeAsset(
		registerRecording(createTimelineProject("p", "P"), recording, {
			assetId: "a",
			packageId: "r",
		}),
		"a",
		"visual-1",
		0,
		{ clipId: "c", compositionId: "e" },
	);
}
it("maps half-open recording clocks, offsets and one canonical source per audio stream", () => {
	const p = setClipRate(fixture(), "c", 2);
	const e = evaluateProject(p, 1_000_000);
	expect(e.visuals[0].sourceUs).toBe(2_000_000);
	expect(e.visuals[0].recording?.webcamUs).toBe(1_000_000);
	expect(e.audio.map((a) => [a.kind, a.path, a.sourceUs, a.rate])).toEqual([
		["microphone", "mic.wav", 1_000_000, 2],
		["system", "system.wav", 2_000_000, 2],
	]);
	expect(e.audio.some((a) => a.path === "screen.mp4")).toBe(false);
	expect(evaluateProject(p, 5_000_000).visuals).toEqual([]);
	const plan = buildProjectAudioPlan(p);
	expect(plan.filter((a) => a.kind === "microphone")[0]).toMatchObject({
		startUs: 500_000,
		endUs: 5_000_000,
		sourceStartUs: 0,
		rate: 2,
	});
});
it("stacked tracks and random seek sample independent compositions identically", () => {
	let p = addTrack(fixture(), "top", "visual");
	p = placeAsset(p, "a", "top", 0, { clipId: "second", compositionId: "second-edit" });
	p = updateComposition(p, "second-edit", {
		...p.compositions[1],
		settings: { speedRegions: [{ id: "s", startMs: 0, endMs: 10_000, speed: 0.5 }] },
	});
	p = setClipRate(p, "c", 0.5);
	for (const t of [3_000_000, 0, 1_000_000, 4_000_000, 1_000_000]) {
		const e = evaluateProject(p, t);
		expect(e.visuals.map((v) => v.clipId)).toEqual(["c", "second"]);
		expect(e.visuals.map((v) => v.sourceUs)).toEqual([t * 0.5, t * 0.5]);
	}
	expect(
		buildProjectAudioPlan(p)
			.filter((a) => a.kind === "system")
			.map((a) => a.rate),
	).toEqual([0.5, 0.5]);
});
it("required screen source is reported before rendering or export", () => {
	const p = fixture();
	p.packages[0].screen.path = "";
	expect(evaluateProject(p, 0).issues).toContain("Missing screen source for c");
});
it("preserves additional audio offsets, playback rates and audible video layers", () => {
	const p = fixture();
	p.compositions[0].settings = {
		audioRegions: [
			{
				id: "music",
				audioPath: "music.wav",
				startMs: 1000,
				endMs: 3000,
				sourceOffsetMs: 500,
				playbackRate: 2,
				volume: 0.4,
				ducking: true,
			},
		],
		annotationRegions: [
			{
				id: "video",
				type: "video",
				videoFilePath: "layer.mp4",
				startMs: 2000,
				endMs: 4000,
				sourceOffsetMs: 200,
				playbackRate: 0.5,
				visible: true,
			},
		] as never,
	};
	const audio = evaluateProject(p, 2_500_000).audio;
	expect(audio.find((s) => s.path === "music.wav")).toMatchObject({
		sourceUs: 3_500_000,
		rate: 2,
		gain: 0.4,
	});
	expect(audio.find((s) => s.path === "layer.mp4")).toMatchObject({
		sourceUs: 450_000,
		rate: 0.5,
	});
});

it("evaluateProject_keepsAudioPlanUnchanged", () => {
	let project = fixture();
	project = setComponentAnimation(project, "c", "enter", {
		preset: "fade",
		durationUs: 250_000,
		easing: "ease-in-out",
	});
	const timeUs = 1_000_000;
	const expectedAudio = audioAtTime(buildProjectAudioPlan(project), timeUs);
	const evaluated = evaluateProject(project, timeUs);
	expect(evaluated.audio).toEqual(expectedAudio);
	expect(evaluated.componentAnimations).toHaveLength(1);
	expect(evaluated.componentAnimations[0]).toMatchObject({
		clipId: "c",
		enter: null,
	});
});

it("evaluates transition and component samples in stable visual-track order", () => {
	let project = createTimelineProject("evaluation-transition", "Transitions");
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
	project.tracks[0]!.clips[0]!.sourceOutUs = 6_000_000;
	project.tracks[0]!.clips[1]!.sourceInUs = 2_000_000;
	project.tracks[0]!.clips[1]!.startUs = 6_000_000;
	project = setComponentAnimation(project, "in", "enter", {
		preset: "slide",
		direction: "left",
		durationUs: 500_000,
		easing: "linear",
	});
	project = addClipTransition(
		project,
		{
			trackId: "visual-1",
			fromClipId: "out",
			toClipId: "in",
			preset: { kind: "push", direction: "left" },
			easing: "ease-in-out",
			durationUs: 1_000_000,
		},
		"transition",
	);
	const evaluated = evaluateProject(project, 6_000_000);
	expect(evaluated.visualTransitions).toHaveLength(1);
	expect(evaluated.visualTransitions[0]).toMatchObject({
		fromClipId: "out",
		toClipId: "in",
		progress: 0.5,
	});
	expect(evaluated.componentAnimations.map((sample) => sample.clipId)).toEqual(["in"]);
});
