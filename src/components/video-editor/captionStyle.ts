import { drawSquircleOnCanvas } from "@/lib/geometry/squircle";
import type { CaptionWordState } from "./captionLayout";
import { DEFAULT_AUTO_CAPTION_SETTINGS } from "./types";

export const CAPTION_FONT_WEIGHT = 400;
export const CAPTION_LINE_HEIGHT = 1.32;

const DEFAULT_CAPTION_REFERENCE_WIDTH = 1920 * (DEFAULT_AUTO_CAPTION_SETTINGS.maxWidth / 100);

export function getCaptionTargetWidth(containerWidth: number, maxWidthPercent: number) {
	return Math.max(1, containerWidth * (maxWidthPercent / 100));
}

export function getCaptionScaledFontSize(
	fontSize: number,
	containerWidth: number,
	maxWidthPercent: number,
) {
	return Math.max(
		14,
		fontSize *
			(getCaptionTargetWidth(containerWidth, maxWidthPercent) /
				DEFAULT_CAPTION_REFERENCE_WIDTH),
	);
}

export function getCaptionPadding(fontSize: number) {
	return {
		x: fontSize * 1.1,
		y: fontSize * 0.78,
	};
}

export function getCaptionScaledRadius(radius: number, fontSize: number) {
	const baseline = Math.max(1, DEFAULT_AUTO_CAPTION_SETTINGS.fontSize);
	return Math.max(0, radius * (fontSize / baseline));
}

export function getCaptionTextMaxWidth(
	containerWidth: number,
	maxWidthPercent: number,
	fontSize: number,
) {
	const padding = getCaptionPadding(fontSize);
	return Math.max(
		fontSize * 4,
		getCaptionTargetWidth(containerWidth, maxWidthPercent) - padding.x * 2,
	);
}

export function getCaptionWordVisualState(hasWordTimings: boolean, state: CaptionWordState) {
	if (!hasWordTimings) {
		return {
			isInactive: false,
			opacity: 1,
		};
	}

	switch (state) {
		case "upcoming":
			return {
				isInactive: true,
				opacity: 0.82,
			};
		case "spoken":
			return {
				isInactive: false,
				opacity: 0.72,
			};
		case "active":
		default:
			return {
				isInactive: false,
				opacity: 1,
			};
	}
}

export interface CaptionWordHighlightInfo {
	color: string;
	backgroundColor?: string;
	scale: number;
	glow: boolean;
	glowColor?: string;
	isBold: boolean;
	borderRadiusPx?: number;
	paddingPx?: { x: number; y: number };
}

export function getCaptionWordHighlightInfo(
	settings: Partial<import("./types").AutoCaptionSettings> | undefined,
	state: CaptionWordState,
	fontSize: number,
): CaptionWordHighlightInfo {
	const highlightStyle = settings?.highlightStyle ?? "karaoke-pop";
	const highlightColor = settings?.highlightColor ?? "#FFE600";
	const highlightTextColor = settings?.highlightTextColor ?? "#000000";
	const normalColor = settings?.textColor ?? "#FFFFFF";
	const inactiveColor = settings?.inactiveTextColor ?? "#A3A3A3";

	if (state !== "active") {
		return {
			color: state === "upcoming" ? inactiveColor : normalColor,
			scale: 1,
			glow: false,
			isBold: highlightStyle === "hormozi",
		};
	}

	switch (highlightStyle) {
		case "karaoke-pop":
			return {
				color: highlightColor,
				scale: 1.15,
				glow: true,
				glowColor: `${highlightColor}99`,
				isBold: true,
			};
		case "hormozi":
			return {
				color: highlightColor,
				scale: 1.12,
				glow: true,
				glowColor: "rgba(0, 0, 0, 0.85)",
				isBold: true,
			};
		case "neon-glow":
			return {
				color: "#FFFFFF",
				scale: 1.08,
				glow: true,
				glowColor: highlightColor,
				isBold: true,
			};
		case "box-highlight":
			return {
				color: highlightTextColor,
				backgroundColor: highlightColor,
				scale: 1.05,
				glow: false,
				isBold: true,
				borderRadiusPx: Math.max(4, fontSize * 0.2),
				paddingPx: { x: fontSize * 0.25, y: fontSize * 0.1 },
			};
		case "classic":
		default:
			return {
				color: highlightColor,
				scale: 1,
				glow: false,
				isBold: false,
			};
	}
}

export function drawCaptionWordOnCanvas(options: {
	ctx: CanvasRenderingContext2D;
	word: { text: string; leadingSpace?: boolean; state: CaptionWordState };
	settings: import("./types").AutoCaptionSettings;
	fontSize: number;
	fontFamily: string;
	cursorX: number;
	lineY: number;
	opacity: number;
	measureText: (text: string) => number;
}): number {
	const { ctx, word, settings, fontSize, fontFamily, cursorX, lineY, opacity } = options;
	const segmentText = `${word.leadingSpace ? " " : ""}${word.text}`;
	const segmentWidth = options.measureText(segmentText);
	const highlight = getCaptionWordHighlightInfo(settings, word.state, fontSize);

	ctx.save();
	ctx.translate(cursorX, lineY);

	// Render pill box if box-highlight
	if (highlight.backgroundColor && word.state === "active") {
		const pillPaddingX = highlight.paddingPx?.x ?? fontSize * 0.25;
		const pillPaddingY = highlight.paddingPx?.y ?? fontSize * 0.1;
		const pillRadius = highlight.borderRadiusPx ?? 4;
		const pillWidth = segmentWidth + pillPaddingX * 2;
		const pillHeight = fontSize * 1.25 + pillPaddingY * 2;

		ctx.save();
		ctx.fillStyle = highlight.backgroundColor;
		drawSquircleOnCanvas(ctx, {
			x: -pillPaddingX,
			y: -pillHeight / 2,
			width: pillWidth,
			height: pillHeight,
			radius: pillRadius,
		});
		ctx.fill();
		ctx.restore();
	}

	// Scale word around its center if scale != 1
	if (highlight.scale !== 1) {
		const wordCenterX = segmentWidth / 2;
		ctx.translate(wordCenterX, 0);
		ctx.scale(highlight.scale, highlight.scale);
		ctx.translate(-wordCenterX, 0);
	}

	// Apply glow if active
	if (highlight.glow && highlight.glowColor) {
		ctx.shadowColor = highlight.glowColor;
		ctx.shadowBlur = 14 * (fontSize / 30);
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
	}

	ctx.font = `${highlight.isBold ? 700 : CAPTION_FONT_WEIGHT} ${fontSize}px ${fontFamily}`;
	ctx.fillStyle = highlight.color;
	ctx.globalAlpha = opacity;
	ctx.fillText(segmentText, 0, 0);
	ctx.restore();

	return segmentWidth;
}

