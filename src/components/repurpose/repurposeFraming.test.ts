import { describe, expect, it } from "vitest";
import { calculateFramingCrop } from "./repurposeFraming";

describe("repurposeFraming - calculateFramingCrop", () => {
	it("calculates cover crop for 16:9 source to 9:16 vertical artboard", () => {
		// Source: 1920x1080 (16:9)
		// Artboard: 1080x1920 (9:16)
		const crop = calculateFramingCrop(1920, 1080, 1080, 1920, {
			fitMode: "cover",
			scale: 1,
			offsetX: 0,
			offsetY: 0,
		});

		// For cover fit into vertical, full height (1080) is used, and width is cropped to height * (9/16) = 607.5 => 608
		expect(crop.sh).toBe(1080);
		expect(crop.sw).toBe(608);
		// Centered horizontally: (1920 - 608) / 2 = 656
		expect(crop.sx).toBe(656);
		expect(crop.sy).toBe(0);
	});

	it("calculates cover crop with horizontal pan offset", () => {
		// Moving pan offset to right (offsetX = 0.25)
		const crop = calculateFramingCrop(1920, 1080, 1080, 1920, {
			fitMode: "cover",
			scale: 1,
			offsetX: 0.25,
			offsetY: 0,
		});

		// Base center is 656, pan shifts it right
		expect(crop.sx).toBeGreaterThan(656);
	});

	it("calculates contain fit with pillarbox/letterbox placement", () => {
		// 16:9 source into 1:1 square (1080x1080) in contain mode
		const crop = calculateFramingCrop(1920, 1080, 1080, 1080, {
			fitMode: "contain",
			scale: 1,
			offsetX: 0,
			offsetY: 0,
		});

		// All source is visible
		expect(crop.sx).toBe(0);
		expect(crop.sy).toBe(0);
		expect(crop.sw).toBe(1920);
		expect(crop.sh).toBe(1080);

		// Scaled down to fit width 1080: dw = 1080, dh = 1080 * (9/16) = 608
		expect(crop.dw).toBe(1080);
		expect(crop.dh).toBe(608);
		// Centered vertically in 1080 height: dy = (1080 - 608) / 2 = 236
		expect(crop.dy).toBe(236);
		expect(crop.dx).toBe(0);
	});

	it("handles zoom scale magnification", () => {
		const cropNormal = calculateFramingCrop(1920, 1080, 1080, 1080, {
			fitMode: "cover",
			scale: 1,
			offsetX: 0,
			offsetY: 0,
		});

		const cropZoomed = calculateFramingCrop(1920, 1080, 1080, 1080, {
			fitMode: "cover",
			scale: 2,
			offsetX: 0,
			offsetY: 0,
		});

		// Zooming in takes a smaller sample crop window from source
		expect(cropZoomed.sw).toBeLessThan(cropNormal.sw);
		expect(cropZoomed.sh).toBeLessThan(cropNormal.sh);
	});
});
