import { expect, it } from "vitest";
import { normalizeProjectEditor } from "./projectPersistence";
import { sampleLayerAnimation } from "./layerAnimation";

it("samples the same fade and slide envelope for every layer type", () => {
	for (const type of ["text", "video", "image", "gif", "figure"] as const) {
		const layer = normalizeProjectEditor({ annotationRegions: [{ id: type, type, startMs: 1000, endMs: 3000, animationIn: "slide-up", animationOut: "fade", animationDurationMs: 500 }] as any }).annotationRegions[0];
		expect(sampleLayerAnimation(layer, 1250)).toEqual({ opacity: 0.5, translateY: 10 });
		expect(sampleLayerAnimation(layer, 2750)).toEqual({ opacity: 0.5, translateY: 0 });
		expect(sampleLayerAnimation(layer, 3000).opacity).toBe(0);
	}
});
