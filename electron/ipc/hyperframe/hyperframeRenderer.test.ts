import { describe, expect, it } from "vitest";
import type { BRollSpec } from "../../../src/core/timeline/brollTypes";
import {
	buildFfmpegFilterForSpec,
	escapeDrawtext,
	formatFontFileForFfmpeg,
} from "./hyperframeRenderer";

describe("hyperframeRenderer", () => {
	it("escapes special characters for FFmpeg drawtext filter", () => {
		const raw = "Title: 'Hello' & 100% test \\ path";
		const escaped = escapeDrawtext(raw);
		expect(escaped).toBe("Title\\: \\'Hello\\' & 100\\% test \\\\ path");
	});

	it("formats font file paths for FFmpeg on Windows", () => {
		const formatted = formatFontFileForFfmpeg("C:\\Windows\\Fonts\\segoeui.ttf");
		if (process.platform === "win32") {
			expect(formatted).toBe("C\\:/Windows/Fonts/segoeui.ttf");
		} else {
			expect(formatted).toBeTruthy();
		}
	});

	it("builds correct filter for kinetic typography animation", () => {
		const spec: BRollSpec = {
			id: "spec-1",
			timelineStartUs: 1_000_000,
			durationUs: 3_000_000,
			type: "kinetic_typography",
			title: "Core Feature",
			subtitle: "Super Fast",
			theme: "dark_modern",
		};

		const filter = buildFfmpegFilterForSpec(
			spec,
			{ width: 1920, height: 1080, fps: 30 },
			"C:/Fonts/test.ttf",
		);

		expect(filter).toContain("Core Feature");
		expect(filter).toContain("Super Fast");
		expect(filter).toContain("alpha='min(1,t*2)'");
	});

	it("builds correct filter for stat counter", () => {
		const spec: BRollSpec = {
			id: "spec-2",
			timelineStartUs: 2_000_000,
			durationUs: 2_500_000,
			type: "stat_counter",
			title: "10x Faster",
			subtitle: "Compared to manual",
			theme: "neon_gradient",
		};

		const filter = buildFfmpegFilterForSpec(
			spec,
			{ width: 1080, height: 1920, fps: 30 },
			null,
		);

		expect(filter).toContain("10x Faster");
		expect(filter).toContain("Compared to manual");
		expect(filter).toContain("fontsize=80");
	});
});
