import { expect, it } from "vitest";
import { moveBezierHandle } from "./KeyframeCurveEditor";
import { calculateEasingProgress } from "../video-editor/keyframeInterpolation";
it("bounds handle coordinates while retaining editable overshoot", () => {
	expect(moveBezierHandle([0.42, 0, 0.58, 1], 0, 2, -2)).toEqual([1, -1, 0.58, 1]);
});
it("changes the actual easing used by frame evaluation without mutating the input", () => {
	const curve: [number, number, number, number] = [0.42, 0, 0.2, 1];
	const next = moveBezierHandle(curve, 0, 0.1, 0.9);
	expect(calculateEasingProgress(0.5, "cubic-bezier", next)).toBeGreaterThan(0.8);
	expect(curve).toEqual([0.42, 0, 0.2, 1]);
});
