import type { ClipVisualSettings } from "@/core/timeline/types";

export function drawStyledMedia(
	ctx: CanvasRenderingContext2D,
	source: CanvasImageSource,
	sourceWidth: number,
	sourceHeight: number,
	width: number,
	height: number,
	settings?: ClipVisualSettings,
) {
	const crop = settings?.crop ?? { left: 0, right: 0, top: 0, bottom: 0 };
	const sx = sourceWidth * crop.left,
		sy = sourceHeight * crop.top,
		sw = sourceWidth * (1 - crop.left - crop.right),
		sh = sourceHeight * (1 - crop.top - crop.bottom);
	const ratio = Math.min(width / sw, height / sh),
		w = sw * ratio,
		h = sh * ratio;
	if (settings) {
		ctx.filter = `brightness(${settings.brightness ?? 1}) contrast(${settings.contrast ?? 1}) saturate(${settings.saturation ?? 1})`;
		if (settings.mask) {
			const inset = settings.maskInset ?? 0,
				mw = w * (1 - 2 * inset),
				mh = h * (1 - 2 * inset);
			ctx.beginPath();
			if (settings.mask === "ellipse") ctx.ellipse(0, 0, mw / 2, mh / 2, 0, 0, Math.PI * 2);
			else ctx.rect(-mw / 2, -mh / 2, mw, mh);
			ctx.clip();
		}
	}
	if (settings?.crop) ctx.drawImage(source, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
	else ctx.drawImage(source, -w / 2, -h / 2, w, h);
}
