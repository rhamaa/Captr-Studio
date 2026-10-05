import { describe, expect, it } from "vitest";
import {
	addTrack,
	createTimelineProject,
	moveClip,
	placeAsset,
	registerRecording,
	registerMedia,
	removeAsset,
	removeClip,
	removeTrack,
	reorderTrack,
	rippleRemoveClip,
	rippleRemoveClips,
	setClipRate,
	splitClip,
	trimClip,
	updateComposition,
} from "./commands";
import { addClipTransition, setComponentAnimation } from "./clipTransitions";
import { ProjectHistory } from "./history";
import { mapClipTime, mapCompositionTime, mapStreamTime } from "./timeMapping";
import { validateTimelineProject } from "./validation";

export const capture = {
	captureId: "capture-1",
	name: "Recording",
	durationUs: 20_000_000,
	width: 1920,
	height: 1080,
	screen: { path: "C:/capture/screen.mp4", durationUs: 20_000_000, offsetUs: 0 },
	webcam: { path: "C:/capture/camera.mp4", durationUs: 19_000_000, offsetUs: 1_000_000 },
	microphone: { path: "C:/capture/mic.wav", durationUs: 20_000_000, offsetUs: 0 },
	cursorPath: "C:/capture/cursor.json",
	settings: {},
};
export function recorded() {
	return registerRecording(createTimelineProject("p", "Test"), capture, {
		assetId: "a",
		packageId: "r",
	});
}
export function placed() {
	return placeAsset(recorded(), "a", "visual-1", 0, { clipId: "c", compositionId: "e" });
}

function transitionReadyProject() {
	let project = createTimelineProject("transition-commands", "Transition commands");
	for (const id of ["out-asset", "in-asset"])
		project = registerMedia(project, {
			id,
			kind: "video",
			name: id,
			durationUs: 10_000_000,
			width: 1280,
			height: 720,
			source: { path: `${id}.mp4`, durationUs: 10_000_000, offsetUs: 0 },
		});
	project = placeAsset(project, "out-asset", "visual-1", 0, { clipId: "out" });
	project = placeAsset(project, "in-asset", "visual-1", 10_000_000, { clipId: "in" });
	project.tracks[0]!.clips[0]!.sourceOutUs = 8_000_000;
	project.tracks[0]!.clips[1]!.sourceInUs = 2_000_000;
	project.tracks[0]!.clips[1]!.startUs = 8_000_000;
	return project;
}

function transitionReadyProjectWithTransition() {
	return addClipTransition(
		transitionReadyProject(),
		{
			trackId: "visual-1",
			fromClipId: "out",
			toClipId: "in",
			preset: { kind: "cross-dissolve" },
			easing: "linear",
		},
		"between-clips",
	);
}

describe("project assets and placements", () => {
	it("rejects shared composition ownership, backwards source clocks and missing transforms", () => {
		const p = placeAsset(placed(), "a", "visual-1", 20_000_000, {
			clipId: "c2",
			compositionId: "e2",
		});
		p.tracks[0].clips[1].compositionId = "e";
		expect(() => validateTimelineProject(p)).toThrow(/composition/i);
		const q = placed();
		q.compositions[0].timeMap = [
			{ outputStartUs: 0, outputEndUs: 10_000_000, sourceStartUs: 5_000_000, rate: 1 },
			{ outputStartUs: 10_000_000, outputEndUs: 20_000_000, sourceStartUs: 0, rate: 1 },
		];
		expect(() => validateTimelineProject(q)).toThrow(/clock/i);
		const r = placed();
		delete (
			r.tracks[0].clips[0].transform as Partial<(typeof r.tracks)[0]["clips"][0]["transform"]>
		).x;
		expect(() => validateTimelineProject(r)).toThrow(/transform/i);
	});
	it("registers capture once without placing anything on timeline", () => {
		const p = recorded();
		expect(p.assets).toHaveLength(1);
		expect(p.tracks.flatMap((t) => t.clips)).toEqual([]);
		expect(registerRecording(p, capture, { assetId: "a2", packageId: "r2" })).toBe(p);
		expect(p.packages[0].cursorPath).toBe(capture.cursorPath);
		expect(validateTimelineProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
	});
	it("reuses media but copies composition edits for each placement", () => {
		const p = placed();
		const q = placeAsset(p, "a", "visual-1", 20_000_000, { clipId: "c2", compositionId: "e2" });
		const next = updateComposition(q, "e", {
			...q.compositions[0],
			settings: { ...q.compositions[0].settings, showCursor: false },
		});
		expect(next.compositions[1].settings.showCursor).not.toBe(false);
		expect(next.packages).toEqual(p.packages);
		expect(q.compositions[0].settings.showCursor).not.toBe(false);
	});
	it("splits sped-up clip with matching source boundaries and independent compositions", () => {
		const p = setClipRate(placed(), "c", 2);
		const q = splitClip(p, "c", 5_000_000, { rightClipId: "right", rightCompositionId: "er" });
		const [l, r] = q.tracks[0].clips;
		expect(l.sourceOutUs).toBe(10_000_000);
		expect(r.sourceInUs).toBe(l.sourceOutUs);
		expect(r.startUs).toBe(5_000_000);
		expect(mapClipTime(r, 6_000_000)).toBe(12_000_000);
		expect(mapClipTime(l, 5_000_000)).toBeNull();
		expect(q.compositions).toHaveLength(2);
	});
	it("clip deletion retains asset; referenced asset cannot be removed", () => {
		expect(() => removeAsset(placed(), "a")).toThrow(/referenced/i);
		const p = removeClip(placed(), "c");
		expect(p.assets).toHaveLength(1);
		expect(removeAsset(p, "a").packages).toEqual([]);
	});
	it("rejects overlaps, negative time, invalid rates and locked edits", () => {
		expect(() =>
			placeAsset(placed(), "a", "visual-1", 1, { clipId: "c2", compositionId: "e2" }),
		).toThrow(/overlap/i);
		expect(() => moveClip(placed(), "c", "visual-1", -1)).toThrow();
		expect(() => setClipRate(placed(), "c", 0)).toThrow();
		const p = placed();
		p.tracks[0].locked = true;
		expect(() => removeClip(p, "c")).toThrow(/locked/i);
	});
	it("validates all references and safe persisted paths", () => {
		const p = placed();
		p.tracks[0].clips[0].assetId = "missing";
		expect(() => validateTimelineProject(p)).toThrow(/asset/i);
		const q = recorded();
		q.packages[0].screen.path = "../outside.mp4";
		expect(() => validateTimelineProject(q)).toThrow(/path/i);
	});
	it("maps three clocks and missing stream boundaries", () => {
		const c = placed().compositions[0];
		c.timeMap = [
			{ outputStartUs: 0, outputEndUs: 5_000_000, sourceStartUs: 2_000_000, rate: 2 },
		];
		c.durationUs = 5_000_000;
		expect(mapCompositionTime(c, 3_000_000)).toBe(8_000_000);
		expect(mapStreamTime(500_000, 1_000_000, 19_000_000)).toBeNull();
		expect(mapStreamTime(2_000_000, 1_000_000, 19_000_000)).toBe(1_000_000);
	});
	it("adapts removed trim intervals and internal speed to composition time", () => {
		const p = registerRecording(
			createTimelineProject("p", "Test"),
			{
				...capture,
				settings: {
					trimRegions: [{ id: "trim", startMs: 0, endMs: 2000 }],
					speedRegions: [{ id: "speed", startMs: 2000, endMs: 12000, speed: 2 }],
				},
			},
			{ assetId: "a", packageId: "r" },
		);
		const q = placeAsset(p, "a", "visual-1", 0, { clipId: "c", compositionId: "e" });
		expect(q.compositions[0].durationUs).toBe(13_000_000);
		expect(mapCompositionTime(q.compositions[0], 5_000_000)).toBe(12_000_000);
	});
	it("ripple removes clip and shifts subsequent clips to close the gap", () => {
		let p = placed();
		// c is at 0 (duration 20s), place c2 at 25s and c3 at 50s
		p = placeAsset(p, "a", "visual-1", 25_000_000, { clipId: "c2", compositionId: "e2" });
		p = placeAsset(p, "a", "visual-1", 50_000_000, { clipId: "c3", compositionId: "e3" });

		// c is 0-20s (dur 20s). c2 is 25-45s (dur 20s). c3 is 50-70s (dur 20s).
		// Ripple delete c:
		const rippled = rippleRemoveClip(p, "c");
		expect(rippled.tracks[0].clips).toHaveLength(2);
		// c2 was at 25s, shifted by 20s -> 5s
		expect(rippled.tracks[0].clips.find((x) => x.id === "c2")?.startUs).toBe(5_000_000);
		// c3 was at 50s, shifted by 20s -> 30s
		expect(rippled.tracks[0].clips.find((x) => x.id === "c3")?.startUs).toBe(30_000_000);
		// Validates without errors
		expect(() => validateTimelineProject(rippled)).not.toThrow();
	});
	it("ripple removes multiple clips across tracks", () => {
		let p = placed();
		p = placeAsset(p, "a", "visual-1", 25_000_000, { clipId: "c2", compositionId: "e2" });
		p = placeAsset(p, "a", "visual-1", 50_000_000, { clipId: "c3", compositionId: "e3" });

		// Ripple delete c (0-20s) and c2 (25-45s) simultaneously:
		const rippled = rippleRemoveClips(p, ["c", "c2"]);
		expect(rippled.tracks[0].clips).toHaveLength(1);
		// Total duration removed before c3 was 20s + 20s = 40s
		// c3 was 50s -> becomes 50s - 40s = 10s
		expect(rippled.tracks[0].clips[0].id).toBe("c3");
		expect(rippled.tracks[0].clips[0].startUs).toBe(10_000_000);
		expect(() => validateTimelineProject(rippled)).not.toThrow();
	});

	it("removes a track and cleans up unreferenced compositions", () => {
		let p = placed();
		p = addTrack(p, "track-extra", "visual");
		expect(p.tracks).toHaveLength(3); // visual-1, audio-1, track-extra

		// Move clip to track-extra
		p = moveClip(p, "c", "track-extra", 0);
		expect(p.compositions).toHaveLength(1);

		// Cannot remove locked track
		p.tracks.find((t) => t.id === "track-extra")!.locked = true;
		expect(() => removeTrack(p, "track-extra")).toThrow(/locked/i);
		p.tracks.find((t) => t.id === "track-extra")!.locked = false;

		// Remove track-extra which holds clip c with composition e
		const removed = removeTrack(p, "track-extra");
		expect(removed.tracks.map((t) => t.id)).not.toContain("track-extra");
		expect(removed.compositions).toHaveLength(0); // composition e cleaned up
		expect(() => validateTimelineProject(removed)).not.toThrow();
	});

	it("prevents removing the last remaining track", () => {
		let p = createTimelineProject("p", "Single Track Test");
		// p has 2 tracks initially (visual-1, audio-1)
		p = removeTrack(p, "audio-1");
		expect(p.tracks).toHaveLength(1);
		expect(() => removeTrack(p, "visual-1")).toThrow(/last remaining track/i);
	});

	it("reorders tracks correctly", () => {
		let p = placed(); // visual-1 (index 0), audio-1 (index 1)
		p = addTrack(p, "track-3", "visual"); // index 2

		expect(p.tracks.map((t) => t.id)).toEqual(["visual-1", "audio-1", "track-3"]);

		// Move track-3 to index 0
		const reordered = reorderTrack(p, "track-3", 0);
		expect(reordered.tracks.map((t) => t.id)).toEqual(["track-3", "visual-1", "audio-1"]);

		// Move track-3 to index 1
		const reordered2 = reorderTrack(reordered, "track-3", 1);
		expect(reordered2.tracks.map((t) => t.id)).toEqual(["visual-1", "track-3", "audio-1"]);

		expect(() => validateTimelineProject(reordered2)).not.toThrow();
	});
});

describe("transition and component animation command cleanup", () => {
	it("removes a transition atomically when moving, trimming, splitting, or deleting a clip", () => {
		const moved = moveClip(transitionReadyProjectWithTransition(), "in", "visual-1", 9_000_000);
		expect(moved.clipTransitions).toEqual([]);

		const trimmed = trimClip(transitionReadyProjectWithTransition(), "out", 0, 7_500_000);
		expect(trimmed.clipTransitions).toEqual([]);

		const split = splitClip(transitionReadyProjectWithTransition(), "out", 4_000_000, {
			rightClipId: "out-right",
		});
		expect(split.clipTransitions).toEqual([]);

		const removed = removeClip(transitionReadyProjectWithTransition(), "in");
		expect(removed.clipTransitions).toEqual([]);
	});

	it("rejects a trim that preserves the cut but removes a required source handle", () => {
		const project = transitionReadyProjectWithTransition();
		const before = structuredClone(project);
		expect(() => trimClip(project, "in", 100_000, 10_000_000)).toThrow(/handle/i);
		expect(project).toEqual(before);
	});

	it("undo restores a transition removed by a clip gesture", () => {
		const history = new ProjectHistory(transitionReadyProjectWithTransition());
		history.execute((project) => moveClip(project, "in", "visual-1", 9_000_000), ["in"]);
		expect(history.project.clipTransitions).toEqual([]);
		history.undo();
		expect(history.project.clipTransitions).toHaveLength(1);
		expect(history.project.tracks[0]!.clips.find((clip) => clip.id === "in")?.startUs)
			.toBe(8_000_000);
	});

	it("clamps or removes edge animations on trim and preserves outer edges on split", () => {
		let project = transitionReadyProject();
		project = setComponentAnimation(project, "out", "enter", {
			preset: "fade",
			durationUs: 1_000_000,
			easing: "linear",
		});
		project = setComponentAnimation(project, "out", "exit", {
			preset: "slide",
			direction: "right",
			durationUs: 1_000_000,
			easing: "ease-out",
		});
		const clamped = trimClip(project, "out", 0, 1_500_000);
		expect(clamped.tracks[0]!.clips[0]!.componentAnimation).toMatchObject({
			enter: { durationUs: 1_000_000 },
			exit: { durationUs: 500_000 },
		});
		const removed = trimClip(project, "out", 0, 1_000_000);
		expect(removed.tracks[0]!.clips[0]!.componentAnimation).toEqual({ enter: {
			preset: "fade", durationUs: 1_000_000, easing: "linear",
		} });

		const split = splitClip(project, "out", 4_000_000, { rightClipId: "animation-right" });
		const left = split.tracks[0]!.clips.find((clip) => clip.id === "out")!;
		const right = split.tracks[0]!.clips.find((clip) => clip.id === "animation-right")!;
		expect(left.componentAnimation).toEqual({ enter: project.tracks[0]!.clips[0]!.componentAnimation!.enter });
		expect(right.componentAnimation).toEqual({ exit: project.tracks[0]!.clips[0]!.componentAnimation!.exit });
	});
});
