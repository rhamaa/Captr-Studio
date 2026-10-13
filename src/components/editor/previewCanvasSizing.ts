export interface PreviewCanvasBounds {
	width: number;
	height: number;
}

export function fitPreviewCanvasToBounds(
	bounds: PreviewCanvasBounds,
	canvas: PreviewCanvasBounds,
): PreviewCanvasBounds {
	if (
		!Number.isFinite(bounds.width) ||
		!Number.isFinite(bounds.height) ||
		!Number.isFinite(canvas.width) ||
		!Number.isFinite(canvas.height) ||
		bounds.width <= 0 ||
		bounds.height <= 0 ||
		canvas.width <= 0 ||
		canvas.height <= 0
	) {
		return { width: 0, height: 0 };
	}

	const scale = Math.min(bounds.width / canvas.width, bounds.height / canvas.height);
	return {
		width: canvas.width * scale,
		height: canvas.height * scale,
	};
}
