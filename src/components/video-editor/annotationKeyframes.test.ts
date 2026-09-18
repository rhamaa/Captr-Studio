import { describe, expect, it } from "vitest";
import {
	addAnnotationKeyframe,
	moveAnnotationKeyframe,
	normalizePropertyKeyframes,
	sampleAnnotationTransform,
} from "./annotationKeyframes";
import { DEFAULT_ANNOTATION_STYLE, type AnnotationRegion } from "./types";

const annotation: AnnotationRegion = {
	id: "title",
	type: "text",
	content: "Demo",
	startMs: 5000,
	endMs: 9000,
	zIndex: 0,
	position: { x: 50, y: 50 },
	size: { width: 40, height: 20 },
	style: { ...DEFAULT_ANNOTATION_STYLE },
	keyframes: [
		{ id: "a", property: "opacity", timeMs: 0, value: 0, easing: "linear" },
		{ id: "b", property: "opacity", timeMs: 2000, value: 1, easing: "linear" },
	],
};

describe("annotation keyframe contract", () => {
	it("rejects malformed saved keyframes before interpolation", () => {
		expect(
			normalizePropertyKeyframes([
				null,
				{ id: "bad", property: "position", timeMs: 0, value: 42 },
				{ id: "good", property: "opacity", timeMs: 200, value: 0.5, easing: "unknown" },
				{ id: "good", property: "scale", timeMs: 300, value: 1 },
			]),
		).toEqual([
			{ id: "good", property: "opacity", timeMs: 200, value: 0.5, easing: "ease-in-out" },
		]);
	});
	it("samples relative time identically after a layer is moved on the timeline", () => {
		expect(sampleAnnotationTransform(annotation, 6000).opacity).toBeCloseTo(0.5);
		expect(
			sampleAnnotationTransform({ ...annotation, startMs: 10000, endMs: 14000 }, 11000)
				.opacity,
		).toBeCloseTo(0.5);
	});
	it("adding a scale keyframe preserves the current visual size", () => {
		const keyframes = addAnnotationKeyframe(annotation, "scale", 6000, "scale");
		expect(keyframes.find((frame) => frame.id === "scale")).toMatchObject({
			timeMs: 1000,
			value: 1,
		});
		expect(sampleAnnotationTransform({ ...annotation, keyframes }, 6000).scale).toBe(1);
	});
	it("captures an interpolated value without snapping back to the base property", () => {
		const keyframes = addAnnotationKeyframe(annotation, "opacity", 6000, "middle");
		expect(keyframes.find((frame) => frame.id === "middle")?.value).toBeCloseTo(0.5);
	});
	it("moves stored keyframes using timeline coordinates and clamps to the layer", () => {
		const moved = moveAnnotationKeyframe(annotation, "b", 15000);
		expect(moved.find((frame) => frame.id === "b")?.timeMs).toBe(4000);
		expect(annotation.keyframes?.[1].timeMs).toBe(2000);
	});
	it("resolves same-property collisions when a marker is moved onto another", () => {
		const moved = moveAnnotationKeyframe(annotation, "b", 5000);
		expect(moved).toHaveLength(1);
		expect(moved[0]).toMatchObject({ id: "b", timeMs: 0 });
	});
});
