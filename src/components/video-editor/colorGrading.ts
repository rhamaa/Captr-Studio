import { type ColorMatrixFilter, Texture } from "pixi.js";
import {
	type ColorFilterPreset,
	type ColorGradingSettings,
	DEFAULT_COLOR_GRADING,
} from "./types";

export interface ColorFilterPresetOption {
	id: ColorFilterPreset;
	name: string;
	description: string;
	previewGradient: string;
}

export const COLOR_FILTER_PRESETS: ColorFilterPresetOption[] = [
	{
		id: "none",
		name: "Original",
		description: "Natural untouched video color",
		previewGradient: "linear-gradient(135deg, #374151 0%, #111827 100%)",
	},
	{
		id: "clean-studio",
		name: "Clean Studio",
		description: "Crisp clarity, balanced contrast & clean whites",
		previewGradient: "linear-gradient(135deg, #60a5fa 0%, #1e40af 100%)",
	},
	{
		id: "cyber-glow",
		name: "Cyber Glow",
		description: "Vibrant saturation with punchy cyan & magenta contrast",
		previewGradient: "linear-gradient(135deg, #06b6d4 0%, #ec4899 100%)",
	},
	{
		id: "warm-editorial",
		name: "Warm Editorial",
		description: "Cinematic golden-hour warmth and filmic skin tones",
		previewGradient: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
	},
	{
		id: "cool-minimalist",
		name: "Cool Minimalist",
		description: "Slight desaturation with cool Nordic shadows",
		previewGradient: "linear-gradient(135deg, #94a3b8 0%, #475569 100%)",
	},
	{
		id: "black-white",
		name: "Black & White",
		description: "High-contrast monochrome with deep rich blacks",
		previewGradient: "linear-gradient(135deg, #e5e7eb 0%, #000000 100%)",
	},
];

export function normalizeColorGrading(
	input?: Partial<ColorGradingSettings> | null,
): ColorGradingSettings {
	if (!input) return { ...DEFAULT_COLOR_GRADING };
	return {
		preset: input.preset ?? DEFAULT_COLOR_GRADING.preset,
		exposure: Number.isFinite(input.exposure) ? Math.max(-100, Math.min(100, input.exposure!)) : 0,
		contrast: Number.isFinite(input.contrast) ? Math.max(-100, Math.min(100, input.contrast!)) : 0,
		saturation: Number.isFinite(input.saturation)
			? Math.max(-100, Math.min(100, input.saturation!))
			: 0,
		vignette: Number.isFinite(input.vignette) ? Math.max(0, Math.min(100, input.vignette!)) : 0,
	};
}

/**
 * Apply color grading preset and manual parameters to a PixiJS ColorMatrixFilter.
 * Returns true if the filter is active with non-identity changes, false if it can be bypassed.
 */
export function applyColorGradingToFilter(
	filter: ColorMatrixFilter,
	settings?: ColorGradingSettings | null,
): boolean {
	const current = normalizeColorGrading(settings);
	const { preset, exposure, contrast, saturation } = current;

	const isDefault =
		preset === "none" &&
		exposure === 0 &&
		contrast === 0 &&
		saturation === 0;

	if (isDefault) {
		filter.reset();
		return false;
	}

	filter.reset();

	// Step 1: Base preset transformation
	switch (preset) {
		case "clean-studio":
			filter.contrast(0.12, true);
			filter.saturate(0.08, true);
			filter.brightness(1.04, true);
			break;
		case "cyber-glow":
			filter.contrast(0.24, true);
			filter.saturate(0.35, true);
			filter.hue(6, true);
			break;
		case "warm-editorial":
			filter.contrast(0.1, true);
			filter.saturate(0.06, true);
			filter.brightness(1.03, true);
			filter.tint(0xfff6ec, true);
			break;
		case "cool-minimalist":
			filter.contrast(0.14, true);
			filter.saturate(-0.18, true);
			filter.brightness(1.02, true);
			filter.tint(0xf0f6ff, true);
			break;
		case "black-white":
			filter.blackAndWhite(false);
			filter.contrast(0.25, true);
			filter.brightness(1.04, true);
			break;
		case "none":
		default:
			break;
	}

	// Step 2: Manual adjustments stacked on top
	if (exposure !== 0) {
		// exposure: -100 to +100 -> brightness 0 to 2
		const b = Math.max(0, 1 + exposure / 100);
		filter.brightness(b, true);
	}

	if (contrast !== 0) {
		// contrast: -100 to +100 -> contrast -1 to 1
		const c = contrast / 100;
		filter.contrast(c, true);
	}

	if (saturation !== 0 && preset !== "black-white") {
		// saturation: -100 to +100 -> saturate -1 to 1
		const s = saturation / 100;
		filter.saturate(s, true);
	}

	return true;
}

let cachedVignetteTexture: Texture | null = null;

/**
 * Creates or retrieves a smooth radial vignette texture.
 */
export function getVignetteTexture(): Texture {
	if (cachedVignetteTexture) {
		return cachedVignetteTexture;
	}

	if (typeof document === "undefined") {
		return Texture.WHITE;
	}

	const width = 512;
	const height = 512;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");

	if (ctx) {
		const cx = width / 2;
		const cy = height / 2;
		const r0 = Math.min(width, height) * 0.32;
		const r1 = Math.max(width, height) * 0.72;
		const gradient = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
		gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
		gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.35)");
		gradient.addColorStop(1, "rgba(0, 0, 0, 0.95)");

		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, width, height);
	}

	cachedVignetteTexture = Texture.from(canvas);
	return cachedVignetteTexture;
}
