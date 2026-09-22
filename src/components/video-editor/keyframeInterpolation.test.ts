import { describe, expect, it } from "vitest";
import {
	calculateEasingProgress,
	interpolateNumericKeyframe,
	interpolatePositionKeyframe,
} from "./keyframeInterpolation";
import type { PropertyKeyframe } from "./types";

describe("keyframeInterpolation", () => {
	it("calculates correct easing progress bounds", () => {
		expect(calculateEasingProgress(0, "linear")).toBe(0);
		expect(calculateEasingProgress(1, "linear")).toBe(1);
		expect(calculateEasingProgress(0.5, "linear")).toBe(0.5);

		expect(calculateEasingProgress(0, "ease-in")).toBe(0);
		expect(calculateEasingProgress(1, "ease-in")).toBe(1);
		expect(calculateEasingProgress(0.5, "ease-in")).toBe(0.25);

		expect(calculateEasingProgress(0, "ease-out")).toBe(0);
		expect(calculateEasingProgress(1, "ease-out")).toBe(1);
		expect(calculateEasingProgress(0.5, "ease-out")).toBe(0.75);
	});

	it("interpolates numeric keyframes smoothly", () => {
		const keyframes: PropertyKeyframe[] = [
			{ id: "kf-1", timeMs: 1000, property: "opacity", value: 0, easing: "linear" },
			{ id: "kf-2", timeMs: 3000, property: "opacity", value: 1, easing: "linear" },
		];

		// Before start
		expect(interpolateNumericKeyframe(keyframes, "opacity", 500, 0.5)).toBe(0);
		// Midpoint
		expect(interpolateNumericKeyframe(keyframes, "opacity", 2000, 0.5)).toBeCloseTo(0.5);
		// After end
		expect(interpolateNumericKeyframe(keyframes, "opacity", 4000, 0.5)).toBe(1);
		// Unmatched property returns fallback
		expect(interpolateNumericKeyframe(keyframes, "scale", 2000, 1.5)).toBe(1.5);
	});

	it("interpolates 2D position keyframes accurately", () => {
		const keyframes: PropertyKeyframe[] = [
			{
				id: "kf-1",
				timeMs: 0,
				property: "position",
				value: { x: 10, y: 20 },
				easing: "linear",
			},
			{
				id: "kf-2",
				timeMs: 2000,
				property: "position",
				value: { x: 50, y: 100 },
				easing: "linear",
			},
		];

		const mid = interpolatePositionKeyframe(keyframes, 1000, { x: 0, y: 0 });
		expect(mid.x).toBeCloseTo(30);
		expect(mid.y).toBeCloseTo(60);
	});
});
