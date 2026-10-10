import { describe, expect, it } from "vitest";
import { buildTrimRangeSummary, formatTrimTime } from "./trimRanges";

describe("recording trim ranges", () => {
	it("shows sorted cut ranges and the retained gaps for overlapping cuts", () => {
		const summary = buildTrimRangeSummary(10_000, [
			{ id: "later", startMs: 4_000, endMs: 7_000 },
			{ id: "overlap", startMs: 2_000, endMs: 5_000 },
			{ id: "before", startMs: -500, endMs: 500 },
		]);

		expect(summary.cutRanges).toEqual([
			{ id: "before", startMs: 0, endMs: 500 },
			{ id: "overlap", startMs: 2_000, endMs: 5_000 },
			{ id: "later", startMs: 4_000, endMs: 7_000 },
		]);
		expect(summary.keptRanges).toEqual([
			{ startMs: 500, endMs: 2_000 },
			{ startMs: 7_000, endMs: 10_000 },
		]);
	});

	it("formats source positions with millisecond precision", () => {
		expect(formatTrimTime(1_234)).toBe("0:01.234");
		expect(formatTrimTime(90_061)).toBe("1:30.061");
	});
});
