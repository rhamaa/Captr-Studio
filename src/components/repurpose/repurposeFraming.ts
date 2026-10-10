import type { RepurposeArtboard, RepurposeArtboardFraming } from "@/core/timeline/repurposeTypes";

export interface SourceCropRect {
	sx: number;
	sy: number;
	sw: number;
	sh: number;
	dx: number;
	dy: number;
	dw: number;
	dh: number;
}

/**
 * Calculates source and destination rectangles for rendering a source frame
 * into an artboard with user-defined scale, pan offset, and fitMode.
 */
export function calculateFramingCrop(
	sourceWidth: number,
	sourceHeight: number,
	artboardWidth: number,
	artboardHeight: number,
	framing: RepurposeArtboardFraming,
): SourceCropRect {
	const srcAspect = sourceWidth / Math.max(1, sourceHeight);
	const dstAspect = artboardWidth / Math.max(1, artboardHeight);
	const scale = Math.max(0.5, Math.min(3.0, framing.scale || 1.0));
	const offsetX = Math.max(-0.5, Math.min(0.5, framing.offsetX || 0));
	const offsetY = Math.max(-0.5, Math.min(0.5, framing.offsetY || 0));

	if (framing.fitMode === "contain") {
		// Fit entire source within the artboard with letterbox/pillarbox
		let dw: number;
		let dh: number;
		let dx: number;
		let dy: number;

		if (srcAspect > dstAspect) {
			// Source is wider than destination -> letterbox top/bottom
			dw = artboardWidth * scale;
			dh = (artboardWidth / srcAspect) * scale;
			dx = (artboardWidth - dw) / 2 + offsetX * (artboardWidth * 0.5);
			dy = (artboardHeight - dh) / 2 + offsetY * (artboardHeight * 0.5);
		} else {
			// Source is taller than destination -> pillarbox left/right
			dh = artboardHeight * scale;
			dw = artboardHeight * srcAspect * scale;
			dx = (artboardWidth - dw) / 2 + offsetX * (artboardWidth * 0.5);
			dy = (artboardHeight - dh) / 2 + offsetY * (artboardHeight * 0.5);
		}

		return {
			sx: 0,
			sy: 0,
			sw: sourceWidth,
			sh: sourceHeight,
			dx: Math.round(dx),
			dy: Math.round(dy),
			dw: Math.round(dw),
			dh: Math.round(dh),
		};
	}

	// Default: "cover" -> Fill the artboard, crop excess
	let baseCropW: number;
	let baseCropH: number;

	if (srcAspect > dstAspect) {
		// Source is wider -> match height, crop width
		baseCropH = sourceHeight;
		baseCropW = sourceHeight * dstAspect;
	} else {
		// Source is taller -> match width, crop height
		baseCropW = sourceWidth;
		baseCropH = sourceWidth / dstAspect;
	}

	// Apply scale (zoom in = smaller source window)
	const sw = Math.max(1, baseCropW / scale);
	const sh = Math.max(1, baseCropH / scale);

	// Pan margins in source coordinates
	const maxPanX = Math.max(0, sourceWidth - sw);
	const maxPanY = Math.max(0, sourceHeight - sh);

	const centerX = (sourceWidth - sw) / 2;
	const centerY = (sourceHeight - sh) / 2;

	// Offset is in [-0.5, 0.5] mapped across maxPan
	const sx = Math.max(0, Math.min(sourceWidth - sw, centerX + offsetX * maxPanX));
	const sy = Math.max(0, Math.min(sourceHeight - sh, centerY + offsetY * maxPanY));

	return {
		sx: Math.round(sx),
		sy: Math.round(sy),
		sw: Math.round(sw),
		sh: Math.round(sh),
		dx: 0,
		dy: 0,
		dw: artboardWidth,
		dh: artboardHeight,
	};
}

/**
 * Draws the source master canvas onto the destination canvas context
 * according to artboard dimensions and framing settings.
 */
export function drawArtboardFrame(
	ctx: CanvasRenderingContext2D,
	sourceCanvas: HTMLCanvasElement,
	artboard: RepurposeArtboard,
	targetWidth: number,
	targetHeight: number,
): void {
	if (!sourceCanvas.width || !sourceCanvas.height) return;

	// Fill background (matte studio dark)
	ctx.fillStyle = "#121214";
	ctx.fillRect(0, 0, targetWidth, targetHeight);

	const crop = calculateFramingCrop(
		sourceCanvas.width,
		sourceCanvas.height,
		artboard.width,
		artboard.height,
		artboard.framing,
	);

	// Scale crop.dx, crop.dy, crop.dw, crop.dh to target display dimensions
	const scaleX = targetWidth / artboard.width;
	const scaleY = targetHeight / artboard.height;

	const dx = Math.round(crop.dx * scaleX);
	const dy = Math.round(crop.dy * scaleY);
	const dw = Math.round(crop.dw * scaleX);
	const dh = Math.round(crop.dh * scaleY);

	ctx.drawImage(sourceCanvas, crop.sx, crop.sy, crop.sw, crop.sh, dx, dy, dw, dh);
}
