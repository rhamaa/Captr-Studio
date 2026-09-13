export const ASPECT_RATIOS = [
	"native",
	"16:9",
	"9:16",
	"1:1",
	"4:3",
	"4:5",
	"16:10",
	"10:16",
] as const;

type PresetAspectRatio = (typeof ASPECT_RATIOS)[number];
type CustomAspectRatio = `${number}:${number}`;

export type AspectRatio = PresetAspectRatio | CustomAspectRatio;

const CUSTOM_ASPECT_RATIO_REGEX = /^(\d+):(\d+)$/;

export function isCustomAspectRatio(aspectRatio: string): aspectRatio is CustomAspectRatio {
	if ((ASPECT_RATIOS as readonly string[]).includes(aspectRatio)) {
		return false;
	}
	const match = aspectRatio.match(CUSTOM_ASPECT_RATIO_REGEX);
	if (!match) {
		return false;
	}
	const width = Number(match[1]);
	const height = Number(match[2]);
	return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}

function parseCustomAspectRatioValue(aspectRatio: string): number | null {
	if (!isCustomAspectRatio(aspectRatio)) {
		return null;
	}
	const [widthText, heightText] = aspectRatio.split(":");
	const width = Number(widthText);
	const height = Number(heightText);
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
		return null;
	}
	return width / height;
}

/**
 * Returns the numeric value of an aspect ratio.
 * Uses exhaustive type checking to ensure all AspectRatio cases are handled.
 * If TypeScript errors here, a new ratio was added to the type but not handled.
 */
export function getAspectRatioValue(aspectRatio: AspectRatio, nativeAspectRatio = 16 / 9): number {
	switch (aspectRatio) {
		case "native":
			return nativeAspectRatio > 0 ? nativeAspectRatio : 16 / 9;
		case "16:9":
			return 16 / 9;
		case "9:16":
			return 9 / 16;
		case "1:1":
			return 1;
		case "4:3":
			return 4 / 3;
		case "4:5":
			return 4 / 5;
		case "16:10":
			return 16 / 10;
		case "10:16":
			return 10 / 16;
		default:
			return parseCustomAspectRatioValue(aspectRatio) ?? 16 / 9;
	}
}

export function getAspectRatioDimensions(
	aspectRatio: AspectRatio,
	baseWidth: number,
	nativeAspectRatio?: number,
): { width: number; height: number } {
	const ratio = getAspectRatioValue(aspectRatio, nativeAspectRatio);
	return {
		width: baseWidth,
		height: baseWidth / ratio,
	};
}

export function getAspectRatioLabel(aspectRatio: AspectRatio): string {
	if (aspectRatio === "native") {
		return "Native";
	}
	if (isCustomAspectRatio(aspectRatio)) {
		return `Custom ${aspectRatio}`;
	}
	return aspectRatio;
}

export function formatAspectRatioForCSS(
	aspectRatio: AspectRatio,
	nativeAspectRatio = 16 / 9,
): string {
	if (aspectRatio === "native") {
		return `${nativeAspectRatio > 0 ? nativeAspectRatio : 16 / 9}`;
	}
	return aspectRatio.replace(":", "/");
}

export interface SocialAspectRatioPreset {
	id: AspectRatio;
	name: string;
	ratioLabel: string;
	platform: "youtube" | "tiktok" | "instagram" | "linkedin" | "general";
	platformLabel: string;
	description: string;
	isSocial: boolean;
	iconName: "video" | "device-mobile" | "square" | "instagram" | "monitor" | "sliders";
}

export const SOCIAL_ASPECT_RATIO_PRESETS: readonly SocialAspectRatioPreset[] = [
	{
		id: "16:9",
		name: "YouTube & Desktop",
		ratioLabel: "16:9",
		platform: "youtube",
		platformLabel: "YouTube / TV",
		description: "Widescreen landscape for YouTube, monitors, and web videos",
		isSocial: true,
		iconName: "video",
	},
	{
		id: "9:16",
		name: "Shorts / TikTok / Reels",
		ratioLabel: "9:16",
		platform: "tiktok",
		platformLabel: "TikTok / Shorts / Reels",
		description: "Full-screen vertical video for mobile feeds and stories",
		isSocial: true,
		iconName: "device-mobile",
	},
	{
		id: "1:1",
		name: "Instagram Post / Square",
		ratioLabel: "1:1",
		platform: "instagram",
		platformLabel: "Instagram / LinkedIn",
		description: "Square format for feed carousels, posts, and social ads",
		isSocial: true,
		iconName: "square",
	},
	{
		id: "4:5",
		name: "Instagram Portrait",
		ratioLabel: "4:5",
		platform: "instagram",
		platformLabel: "Instagram / Facebook",
		description: "Vertical portrait maximizing mobile feed screen estate",
		isSocial: true,
		iconName: "instagram",
	},
	{
		id: "4:3",
		name: "Classic / Presentation",
		ratioLabel: "4:3",
		platform: "general",
		platformLabel: "Presentation / iPad",
		description: "Standard ratio for presentation slides and tablet displays",
		isSocial: false,
		iconName: "monitor",
	},
	{
		id: "native",
		name: "Native Screen",
		ratioLabel: "Native",
		platform: "general",
		platformLabel: "Original Display",
		description: "Preserve original recording dimensions and resolution",
		isSocial: false,
		iconName: "monitor",
	},
] as const;

export function getSocialPresetByAspectRatio(
	aspectRatio: AspectRatio,
): SocialAspectRatioPreset | null {
	return SOCIAL_ASPECT_RATIO_PRESETS.find((p) => p.id === aspectRatio) ?? null;
}
