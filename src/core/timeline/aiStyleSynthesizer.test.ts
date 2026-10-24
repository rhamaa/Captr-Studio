import { describe, expect, it } from "vitest";
import { synthesizeGenerativeFrameStyle } from "./aiStyleSynthesizer";

describe("Generative AI Frame Style Synthesizer", () => {
	it("synthesizes cyberpunk neon theme with electric colors, neon glow, and energy wallpaper", () => {
		const res = synthesizeGenerativeFrameStyle("tema cyberpunk neon dengan warna magenta");
		expect(res.appearance.borderWidth).toBeGreaterThanOrEqual(3);
		expect(res.appearance.borderColor.toLowerCase()).toMatch(/#(?:ff007f|ec4899|ff0055|d946ef)/i);
		expect(res.appearance.shadow.blur).toBeGreaterThanOrEqual(24);
		// Glow shadow matches the neon hue
		expect(res.appearance.shadow.color).toBe(res.appearance.borderColor);
		expect(res.wallpaper).toContain("energy-19");
		expect(res.explanation).toContain("Cyberpunk");
	});

	it("synthesizes minimalist clean theme with subtle borders and smooth corners", () => {
		const res = synthesizeGenerativeFrameStyle("tampilan minimalis modern yang bersih dan elegan");
		expect(res.appearance.borderWidth).toBeLessThanOrEqual(2);
		expect(res.appearance.cornerRadius).toBeGreaterThanOrEqual(14);
		expect(res.appearance.backdropBlur).toBeGreaterThanOrEqual(16);
		expect(res.appearance.shadow.opacity).toBeLessThanOrEqual(0.4);
		expect(res.explanation).toContain("Minimalist");
	});

	it("synthesizes matrix hacker green theme with windows header and sharp accents", () => {
		const res = synthesizeGenerativeFrameStyle("retro terminal hacker hijau matrix dengan header windows");
		expect(res.appearance.borderColor.toLowerCase()).toMatch(/#(?:00ff66|22c55e|10b981|00ff00)/i);
		expect(res.appearance.headerStyle).toBe("windows");
		expect(res.appearance.shadow.color).toBe(res.appearance.borderColor);
		expect(res.wallpaper).toContain("midnight-8");
	});

	it("extracts explicit hex colors and px dimensions from natural language", () => {
		const res = synthesizeGenerativeFrameStyle(
			"buat border #3b82f6 sebesar 8px dengan sudut 28px dan header macos",
		);
		expect(res.appearance.borderColor.toLowerCase()).toBe("#3b82f6");
		expect(res.appearance.borderWidth).toBe(8);
		expect(res.appearance.cornerRadius).toBe(28);
		expect(res.appearance.headerStyle).toBe("macos");
	});

	it("handles sharp brutalist style with zero radius and hard offset shadow", () => {
		const res = synthesizeGenerativeFrameStyle("gaya brutalism tajam kotak border tebal putih");
		expect(res.appearance.cornerRadius).toBe(0);
		expect(res.appearance.borderWidth).toBeGreaterThanOrEqual(4);
		expect(res.appearance.borderColor.toLowerCase()).toBe("#ffffff");
		expect(res.appearance.shadow.blur).toBe(0);
		expect(res.appearance.shadow.offsetX).toBeGreaterThan(0);
	});

	it("synthesizes glassmorphism with high backdrop blur and transparent surface", () => {
		const res = synthesizeGenerativeFrameStyle("efek glass kaca transparan dengan blur");
		expect(res.appearance.backdropBlur).toBeGreaterThanOrEqual(24);
		expect(res.appearance.surfaceOpacity).toBeLessThanOrEqual(0.3);
		expect(res.wallpaper).toContain("glassmorphism");
	});
});
