import { expect, it } from "vitest";
import { sourceTimesForFilmstrip, waveformPath } from "./timelineMediaPreview";
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
