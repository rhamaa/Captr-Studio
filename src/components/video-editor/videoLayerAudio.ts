import type { AnnotationRegion, AudioRegion } from "./types";

export function buildVideoLayerAudioRegions(layers: AnnotationRegion[]): AudioRegion[] {
	return layers
		.filter(
			(layer) =>
				layer.type === "video" &&
				layer.videoFilePath &&
				layer.visible !== false &&
				!layer.muted,
		)
		.map((layer) => ({
			id: `video-layer:${layer.id}`,
			audioPath: layer.videoFilePath!,
			startMs: layer.startMs,
			endMs: layer.endMs,
			sourceOffsetMs: layer.sourceOffsetMs ?? 0,
			playbackRate: layer.playbackRate ?? 1,
			volume: 1,
			ducking: false,
		}));
}
