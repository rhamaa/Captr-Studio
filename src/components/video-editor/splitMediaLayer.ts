import type { AnnotationRegion } from "./types";

/** Retain the original keyframe curve; the right segment samples it with an offset. */
export function splitMediaLayer(
	layer: AnnotationRegion,
	timeMs: number,
	rightId: string,
): AnnotationRegion[] {
	if (layer.locked || timeMs <= layer.startMs || timeMs >= layer.endMs) return [layer];
	const elapsed = timeMs - layer.startMs;
	return [
		{ ...layer, endMs: timeMs },
		{
			...structuredClone(layer),
			id: rightId,
			startMs: timeMs,
			sourceOffsetMs: (layer.sourceOffsetMs ?? 0) + elapsed * (layer.playbackRate ?? 1),
			keyframeTimeOffsetMs: (layer.keyframeTimeOffsetMs ?? 0) + elapsed,
		},
	];
}
