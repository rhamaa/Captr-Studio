import { expect, it } from "vitest";
import {
	sourceTimesForFilmstrip,
	waveformPath,
	timelineAudioSegments,
} from "./timelineMediaPreview";
import { ownershipFixture } from "@/core/timeline/storyOwnership.fixtures";
import { getStoryProject } from "@/core/timeline/storyOwnership";
it("draws silence flat and selects real source peaks after trim and rate", () => {
	const peaks = { peaks: new Float32Array([0, 0, 1, 0]), durationMs: 4000 };
	expect(waveformPath(peaks, 0, 1, 1, 8, 20)).not.toContain("NaN");
	expect(waveformPath({ peaks: new Float32Array([0]), durationMs: 1000 }, 0, 1, 20, 20, 20)).toBe(
		"",
	);
	expect(waveformPath(peaks, 2_000_000, 1, 1, 1, 20)).toContain("v20");
});
it("bounds filmstrip work and avoids the exclusive source endpoint", () => {
	expect(sourceTimesForFilmstrip(1_000_000, 2_000_000, 2, 3)).toEqual([
		1_000_000, 1_333_333, 1_666_667,
	]);
	expect(sourceTimesForFilmstrip(0, 1_000_000, 1, 10_000)).toHaveLength(12);
});
it("resolves detached Record waveforms through package offsets, composition cuts and playback rate", () => {
	const p = getStoryProject(ownershipFixture(), { kind: "artboard", artboardId: "A" });
	const clip = { ...p.tracks[0].clips[0], audioOnly: true, rate: 2, sourceOutUs: 2_000_000 };
	p.packages[0].microphone = { path: "mic.wav", durationUs: 5_000_000, offsetUs: 500_000 };
	p.packages[0].system = { path: "system.wav", durationUs: 5_000_000, offsetUs: 0 };
	p.compositions[0].timeMap = [
		{ outputStartUs: 0, outputEndUs: 1_000_000, sourceStartUs: 0, rate: 1 },
		{ outputStartUs: 1_000_000, outputEndUs: 2_000_000, sourceStartUs: 3_000_000, rate: 1 },
	];
	expect(
		timelineAudioSegments(p, clip).map((s) => [
			s.path,
			s.startUs,
			s.endUs,
			s.sourceStartUs,
			s.rate,
		]),
	).toEqual([
		["mic.wav", 250_000, 500_000, 0, 2],
		["mic.wav", 500_000, 1_000_000, 2_500_000, 2],
		["system.wav", 0, 500_000, 0, 2],
		["system.wav", 500_000, 1_000_000, 3_000_000, 2],
	]);
});
