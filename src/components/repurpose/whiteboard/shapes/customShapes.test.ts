import { describe, it, expect } from "vitest";
import {
	customShapeUtils,
	ARTBOARD_CARD_SHAPE_TYPE,
	HYPERFRAME_CARD_SHAPE_TYPE,
	createArtboardShapeProps,
	createHyperframeShapeProps,
} from "./customShapes";

describe("Custom Tldraw Shapes", () => {
	it("registers artboard-card and hyperframe-card shape utils", () => {
		expect(customShapeUtils.length).toBeGreaterThanOrEqual(2);
		const types = customShapeUtils.map((util) => util.type);
		expect(types).toContain(ARTBOARD_CARD_SHAPE_TYPE);
		expect(types).toContain(HYPERFRAME_CARD_SHAPE_TYPE);
	});

	it("creates valid default shape props with calculated dimensions", () => {
		const artboardProps = createArtboardShapeProps("ab-1", 1080, 1920, 360);
		expect(artboardProps.artboardId).toBe("ab-1");
		expect(artboardProps.w).toBe(Math.round(360 * (1080 / 1920)));
		expect(artboardProps.h).toBe(360 + 88);

		const hyperframeProps = createHyperframeShapeProps("hf-1", 1920, 1080, 360);
		expect(hyperframeProps.hyperframeId).toBe("hf-1");
		expect(hyperframeProps.w).toBe(Math.round(360 * (1920 / 1080)));
		expect(hyperframeProps.h).toBe(360 + 88);
	});
});
