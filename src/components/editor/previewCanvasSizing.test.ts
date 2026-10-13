import { describe, expect, it } from "vitest";
import { fitPreviewCanvasToBounds } from "./previewCanvasSizing";

describe("fitPreviewCanvasToBounds", () => {
	it("fits a 4:5 Story canvas inside a wide preview without widening its frame", () => {
		const size = fitPreviewCanvasToBounds(
			{ width: 794, height: 421 },
			{ width: 1080, height: 1350 },
		);
		expect(size.width).toBeCloseTo(336.8);
		expect(size.height).toBeCloseTo(421);
	});

	it("uses the available width when a portrait canvas has a taller viewport", () => {
		expect(
			fitPreviewCanvasToBounds({ width: 400, height: 900 }, { width: 1080, height: 1350 }),
		).toEqual({ width: 400, height: 500 });
	});

	it("returns a zero-sized frame for invalid bounds", () => {
		expect(
			fitPreviewCanvasToBounds({ width: 0, height: 900 }, { width: 1080, height: 1350 }),
		).toEqual({ width: 0, height: 0 });
	});
});
