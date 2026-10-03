import { describe, expect, it } from "vitest";
import {
	createTimelineProject,
	registerRecording,
	placeAsset,
	splitClip,
	removeClip,
	removeAsset,
	setClipRate,
	moveClip,
	updateComposition,
} from "./commands";
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
});
