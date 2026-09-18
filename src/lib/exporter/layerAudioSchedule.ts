import type { AudioRegion } from "@/components/video-editor/types";

/** Intersect source edits with a layer, then map each surviving slice to output time. */
export function buildLayerAudioSchedule(
	region: AudioRegion,
	slices: { sourceStartMs: number; sourceEndMs: number; speed: number }[],
	chunkStartSec: number,
	chunkDurationSec: number,
	bufferDurationSec: number,
) {
	const result: { start: number; offset: number; duration: number; rate: number }[] = [];
	let outputMs = 0;
	for (const slice of slices) {
		const start = Math.max(slice.sourceStartMs, region.startMs);
		const end = Math.min(slice.sourceEndMs, region.endMs);
		const layerRate = region.playbackRate ?? 1;
		const rate = layerRate * slice.speed;
		if (end > start) {
			const outputStart = (outputMs + (start - slice.sourceStartMs) / slice.speed) / 1000;
			const outputEnd = outputStart + (end - start) / slice.speed / 1000;
			const clippedStart = Math.max(outputStart, chunkStartSec);
			const clippedEnd = Math.min(outputEnd, chunkStartSec + chunkDurationSec);
			const offset =
				((region.sourceOffsetMs ?? 0) + (start - region.startMs) * layerRate) / 1000 +
				(clippedStart - outputStart) * rate;
			const duration = Math.min(
				(clippedEnd - clippedStart) * rate,
				bufferDurationSec - offset,
			);
			if (clippedEnd > clippedStart && duration > 0)
				result.push({ start: clippedStart - chunkStartSec, offset, duration, rate });
		}
		outputMs += (slice.sourceEndMs - slice.sourceStartMs) / slice.speed;
	}
	return result;
}
