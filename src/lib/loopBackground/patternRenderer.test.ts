import { describe, expect, it } from "vitest";
import { buildPatternFrame, type PatternRenderSettings } from "./patternRenderer";

const createSettings = (
	pattern: PatternRenderSettings["pattern"],
	phase: number,
): PatternRenderSettings => ({
	pattern,
	width: 1280,
	height: 720,
	phase,
	seed: 42,
	backgroundColor: "#101820",
	accentColor: "#72d6ff",
	density: 0.4,
	scale: 1,
	speed: 2,
});

describe("buildPatternFrame", () => {
	it.each([
		"dot-noise",
		"film-grain",
		"orbit",
	] as const)("produces deterministic %s frames for the same settings and phase", (pattern) => {
		const settings = createSettings(pattern, 0.37);

		expect(buildPatternFrame(settings)).toEqual(buildPatternFrame(settings));
	});

	it.each([
		"dot-noise",
		"film-grain",
		"orbit",
	] as const)("joins the %s loop at phase one without a duplicate endpoint frame", (pattern) => {
		expect(buildPatternFrame(createSettings(pattern, 0))).toEqual(
			buildPatternFrame(createSettings(pattern, 1)),
		);
	});

	it("wraps negative and over-one phases into the same cycle", () => {
		expect(buildPatternFrame(createSettings("orbit", -0.25))).toEqual(
			buildPatternFrame(createSettings("orbit", 0.75)),
		);
	});
});
