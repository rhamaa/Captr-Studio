import type { AnnotationRegion } from "./types";

/** Presentation envelope shared by preview and export, independent of media type. */
export function sampleLayerAnimation(layer: AnnotationRegion, timeMs: number) {
	const duration = layer.animationDurationMs ?? 500;
	let opacity = 1;
	let translateY = 0;
	if (duration > 0) {
		const progress = Math.max(0, Math.min(1, (timeMs - layer.startMs) / duration));
		if (layer.animationIn === "fade" || layer.animationIn === "slide-up") opacity *= progress;
		if (layer.animationIn === "slide-up") translateY = (1 - progress) * 20;
		if (layer.animationOut === "fade") opacity *= Math.max(0, Math.min(1, (layer.endMs - timeMs) / duration));
	}
	return { opacity, translateY };
}
