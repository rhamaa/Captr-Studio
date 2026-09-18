import type { AnnotationRegion } from "./types";

export function mediaLayerSourceTime(
	layer: Pick<AnnotationRegion, "startMs" | "sourceOffsetMs" | "playbackRate">,
	timelineMs: number,
): number {
	return (
		Math.max(
			0,
			(layer.sourceOffsetMs ?? 0) +
				Math.max(0, timelineMs - layer.startMs) * (layer.playbackRate ?? 1),
		) / 1000
	);
}

export function isMediaLayerActive(
	layer: Pick<AnnotationRegion, "startMs" | "endMs" | "visible">,
	timeMs: number,
): boolean {
	return layer.visible !== false && timeMs >= layer.startMs && timeMs < layer.endMs;
}
