import { describe, expect, it } from "vitest";
import { buildActiveCaptionLayout } from "./captionLayout";
import { getCaptionWordHighlightInfo } from "./captionStyle";
import {
	type AutoCaptionSettings,
	type CaptionCue,
	DEFAULT_AUTO_CAPTION_SETTINGS,
} from "./types";

describe("captionStyle - getCaptionWordHighlightInfo", () => {
	it("returns karaoke-pop highlight info with scale 1.15 and custom color for active word", () => {
		const settings: AutoCaptionSettings = {
			...DEFAULT_AUTO_CAPTION_SETTINGS,
			highlightStyle: "karaoke-pop",
			highlightColor: "#FFE600",
		};

		const activeInfo = getCaptionWordHighlightInfo(settings, "active", 30);
		expect(activeInfo.scale).toBe(1.15);
		expect(activeInfo.color).toBe("#FFE600");
		expect(activeInfo.isBold).toBe(true);
		expect(activeInfo.glow).toBe(true);
		expect(activeInfo.backgroundColor).toBeUndefined();

		const spokenInfo = getCaptionWordHighlightInfo(settings, "spoken", 30);
		expect(spokenInfo.scale).toBe(1);
		expect(spokenInfo.color).toBe(settings.textColor);

		const upcomingInfo = getCaptionWordHighlightInfo(settings, "upcoming", 30);
		expect(upcomingInfo.scale).toBe(1);
		expect(upcomingInfo.color).toBe(settings.inactiveTextColor);
	});

	it("returns hormozi style with high-contrast text and dark shadow glow", () => {
		const settings: AutoCaptionSettings = {
			...DEFAULT_AUTO_CAPTION_SETTINGS,
			highlightStyle: "hormozi",
			highlightColor: "#00FF00",
		};

		const activeInfo = getCaptionWordHighlightInfo(settings, "active", 32);
		expect(activeInfo.scale).toBe(1.12);
		expect(activeInfo.color).toBe("#00FF00");
		expect(activeInfo.isBold).toBe(true);
		expect(activeInfo.glowColor).toBe("rgba(0, 0, 0, 0.85)");
	});

	it("returns neon-glow style with glowing halo shadow", () => {
		const settings: AutoCaptionSettings = {
			...DEFAULT_AUTO_CAPTION_SETTINGS,
			highlightStyle: "neon-glow",
			highlightColor: "#06B6D4",
		};

		const activeInfo = getCaptionWordHighlightInfo(settings, "active", 28);
		expect(activeInfo.scale).toBe(1.08);
		expect(activeInfo.glow).toBe(true);
		expect(activeInfo.glowColor).toBe("#06B6D4");
	});

	it("returns box-highlight style with rounded pill background", () => {
		const settings: AutoCaptionSettings = {
			...DEFAULT_AUTO_CAPTION_SETTINGS,
			highlightStyle: "box-highlight",
			highlightColor: "#FFE600",
			highlightTextColor: "#000000",
		};

		const activeInfo = getCaptionWordHighlightInfo(settings, "active", 30);
		expect(activeInfo.scale).toBe(1.05);
		expect(activeInfo.color).toBe("#000000");
		expect(activeInfo.backgroundColor).toBe("#FFE600");
		expect(activeInfo.borderRadiusPx).toBeGreaterThan(0);
	});

	it("returns classic style without scaling", () => {
		const settings: AutoCaptionSettings = {
			...DEFAULT_AUTO_CAPTION_SETTINGS,
			highlightStyle: "classic",
			highlightColor: "#EC4899",
		};

		const activeInfo = getCaptionWordHighlightInfo(settings, "active", 30);
		expect(activeInfo.scale).toBe(1);
		expect(activeInfo.color).toBe("#EC4899");
		expect(activeInfo.glow).toBe(false);
	});
});

describe("captionLayout - buildActiveCaptionLayout", () => {
	const mockCue: CaptionCue = {
		id: "cue-1",
		startMs: 1000,
		endMs: 4000,
		text: "Halo teman teman semua",
		words: [
			{ text: "Halo", startMs: 1000, endMs: 1500 },
			{ text: "teman", startMs: 1600, endMs: 2200 },
			{ text: "teman", startMs: 2300, endMs: 3000 },
			{ text: "semua", startMs: 3100, endMs: 3900 },
		],
	};

	it("converts text to UPPERCASE when settings.uppercase is true", () => {
		const settings: AutoCaptionSettings = {
			...DEFAULT_AUTO_CAPTION_SETTINGS,
			enabled: true,
			uppercase: true,
			maxRows: 2,
		};

		const layout = buildActiveCaptionLayout({
			cues: [mockCue],
			timeMs: 1800,
			maxWidthPx: 1000,
			settings,
			measureText: (text) => text.length * 15,
		});

		expect(layout).not.toBeNull();
		const words = layout!.visibleLines.flatMap((line) => line.words);
		expect(words.map((w) => w.text)).toEqual(["HALO", "TEMAN", "TEMAN", "SEMUA"]);

		// Word at 1800ms is "teman" (index 1) -> active
		expect(layout!.activeWordIndex).toBe(1);
		expect(words[1].state).toBe("active");
		expect(words[0].state).toBe("spoken");
		expect(words[2].state).toBe("upcoming");
	});

	it("preserves original case when settings.uppercase is false or undefined", () => {
		const settings: AutoCaptionSettings = {
			...DEFAULT_AUTO_CAPTION_SETTINGS,
			enabled: true,
			uppercase: false,
			maxRows: 2,
		};

		const layout = buildActiveCaptionLayout({
			cues: [mockCue],
			timeMs: 1200,
			maxWidthPx: 1000,
			settings,
			measureText: (text) => text.length * 15,
		});

		expect(layout).not.toBeNull();
		const words = layout!.visibleLines.flatMap((line) => line.words);
		expect(words.map((w) => w.text)).toEqual(["Halo", "teman", "teman", "semua"]);
		expect(words[0].state).toBe("active");
	});
});
