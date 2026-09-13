import { describe, expect, it } from "vitest";
import {
	EXPORT_QUICK_PRESETS,
	type ExportQuickPreset,
	isMatchingQuickPreset,
} from "./exportPresetUtils";

describe("EXPORT_QUICK_PRESETS", () => {
	it("defines 4 standard quick export presets", () => {
		expect(EXPORT_QUICK_PRESETS).toHaveLength(4);
		const ids = EXPORT_QUICK_PRESETS.map((p) => p.id);
		expect(ids).toContain("4k-ultra");
		expect(ids).toContain("1080p-web");
		expect(ids).toContain("720p-draft");
		expect(ids).toContain("gif-social");
	});

	it("has complete configuration for MP4 presets", () => {
		const mp4Presets = EXPORT_QUICK_PRESETS.filter((p) => p.format === "mp4");
		expect(mp4Presets.length).toBe(3);

		for (const preset of mp4Presets) {
			expect(preset.quality).toBeDefined();
			expect(preset.mp4FrameRate).toBeDefined();
			expect(preset.encodingMode).toBeDefined();
			expect(preset.shortLabel).toBeDefined();
			expect(preset.badge).toBeDefined();
		}
	});

	it("has complete configuration for GIF preset", () => {
		const gifPreset = EXPORT_QUICK_PRESETS.find((p) => p.format === "gif");
		expect(gifPreset).toBeDefined();
		expect(gifPreset?.gifConfig).toBeDefined();
		expect(gifPreset?.gifConfig?.frameRate).toBe(30);
		expect(gifPreset?.gifConfig?.sizePreset).toBe("medium");
		expect(gifPreset?.gifConfig?.loop).toBe(true);
	});
});

describe("isMatchingQuickPreset", () => {
	const current4kState = {
		format: "mp4" as const,
		quality: "source" as const,
		mp4FrameRate: 60 as const,
		encodingMode: "quality" as const,
		gifFrameRate: 30 as const,
		gifSizePreset: "medium" as const,
		gifLoop: true,
	};

	const current1080pState = {
		format: "mp4" as const,
		quality: "high" as const,
		mp4FrameRate: 60 as const,
		encodingMode: "balanced" as const,
		gifFrameRate: 30 as const,
		gifSizePreset: "medium" as const,
		gifLoop: true,
	};

	const currentGifState = {
		format: "gif" as const,
		quality: "high" as const,
		mp4FrameRate: 60 as const,
		encodingMode: "balanced" as const,
		gifFrameRate: 30 as const,
		gifSizePreset: "medium" as const,
		gifLoop: true,
	};

	it("identifies 4K Ultra preset match", () => {
		const preset4k = EXPORT_QUICK_PRESETS.find((p) => p.id === "4k-ultra")!;
		expect(isMatchingQuickPreset(preset4k, current4kState)).toBe(true);
		expect(isMatchingQuickPreset(preset4k, current1080pState)).toBe(false);
	});

	it("identifies 1080p Web preset match", () => {
		const preset1080p = EXPORT_QUICK_PRESETS.find((p) => p.id === "1080p-web")!;
		expect(isMatchingQuickPreset(preset1080p, current1080pState)).toBe(true);
		expect(isMatchingQuickPreset(preset1080p, current4kState)).toBe(false);
	});

	it("identifies Social GIF preset match", () => {
		const presetGif = EXPORT_QUICK_PRESETS.find((p) => p.id === "gif-social")!;
		expect(isMatchingQuickPreset(presetGif, currentGifState)).toBe(true);
		expect(isMatchingQuickPreset(presetGif, current1080pState)).toBe(false);
	});

	it("returns false if parameter differs", () => {
		const preset1080p = EXPORT_QUICK_PRESETS.find((p) => p.id === "1080p-web")!;
		expect(
			isMatchingQuickPreset(preset1080p, {
				...current1080pState,
				mp4FrameRate: 30 as const, // Different fps
			}),
		).toBe(false);
	});
});
