import { describe, expect, it } from "vitest";
import {
	getDynamicBackgroundFrameSettings,
	getDynamicBackgroundPhase,
	parseDynamicBackgroundSettings,
	serializeDynamicBackgroundSettings,
} from "./settings";

describe("dynamic background settings", () => {
	it("round-trips a selected pattern and its controls in the wallpaper setting", () => {
		const encoded = serializeDynamicBackgroundSettings({
			pattern: "orbit",
			backgroundColor: "#102030",
			accentColor: "#f0c020",
			density: 0.8,
			scale: 1.25,
			speed: 3,
			durationSeconds: 6,
			seed: 17,
		});

		expect(parseDynamicBackgroundSettings(encoded)).toEqual({
			pattern: "orbit",
			backgroundColor: "#102030",
			accentColor: "#f0c020",
			density: 0.8,
			scale: 1.25,
			speed: 3,
			durationSeconds: 6,
			seed: 17,
		});
	});

	it("wraps the loop phase to zero at every configured duration", () => {
		expect(getDynamicBackgroundPhase(4, 4)).toBe(0);
		expect(getDynamicBackgroundPhase(4.5, 4)).toBe(0.125);
	});

	it("uses the same loop phase when building a renderer frame", () => {
		expect(
			getDynamicBackgroundFrameSettings(
				{
					pattern: "film-grain",
					backgroundColor: "#11151d",
					accentColor: "#8ab4ff",
					density: 0.4,
					scale: 1,
					speed: 2,
					durationSeconds: 4,
					seed: 42,
				},
				1280,
				720,
				2,
			),
		).toMatchObject({ width: 1280, height: 720, phase: 0.5, pattern: "film-grain" });
	});
});
