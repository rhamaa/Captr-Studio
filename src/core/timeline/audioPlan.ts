import type { TimelineProject, MediaSource } from "./types";
import { resolveRecordingSettings } from "@/recording/editor/compositionAdapter";
import { buildVideoLayerAudioRegions } from "@/components/video-editor/videoLayerAudio";
import type { AudioDuckingSettings } from "@/components/video-editor/types";
export interface ProjectAudioSegment {
	id: string;
	clipId: string;
	kind: "microphone" | "system" | "media" | "layer";
	path: string;
	startUs: number;
	endUs: number;
	sourceStartUs: number;
	rate: number;
	gain: number;
	normalize: boolean;
	ducking?: AudioDuckingSettings;
}
/** Full project intervals. Stream offsets are applied in source time before timeline rate. */
export function buildProjectAudioPlan(project: TimelineProject): ProjectAudioSegment[] {
	const result: ProjectAudioSegment[] = [];
	for (const track of project.tracks) {
		if (track.muted) continue;
		for (const clip of track.clips) {
			if (!clip.enabled) continue;
			const asset = project.assets.find((a) => a.id === clip.assetId);
			if (!asset) continue;
			const append = (
				source: MediaSource,
				kind: ProjectAudioSegment["kind"],
				segments: Array<{
					outputStartUs: number;
					outputEndUs: number;
					sourceStartUs: number;
					rate: number;
				}>,
				gain = 1,
				normalize = false,
				extra = "",
				mediaRate = 1,
				mediaInUs = 0,
				ducking?: AudioDuckingSettings,
			) => {
				for (const [index, segment] of segments.entries()) {
					const begin = Math.max(
						clip.sourceInUs,
						segment.outputStartUs,
						segment.outputStartUs +
							(source.offsetUs - segment.sourceStartUs) / segment.rate,
					);
					const end = Math.min(
						clip.sourceOutUs,
						segment.outputEndUs,
						segment.outputStartUs +
							(source.offsetUs + source.durationUs - segment.sourceStartUs) /
								segment.rate,
					);
					if (end <= begin || !source.path) continue;
					result.push({
						id: `${clip.id}:${kind}:${extra}:${index}`,
						clipId: clip.id,
						kind,
						path: source.path,
						startUs: clip.startUs + (begin - clip.sourceInUs) / clip.rate,
						endUs: clip.startUs + (end - clip.sourceInUs) / clip.rate,
						sourceStartUs:
							(segment.sourceStartUs +
								(begin - segment.outputStartUs) * segment.rate -
								source.offsetUs) *
								mediaRate +
							mediaInUs,
						rate: clip.rate * segment.rate * mediaRate,
						gain: clip.gain * gain,
						normalize,
						ducking,
					});
				}
			};
			if (asset.kind === "recording") {
				const pkg = project.packages.find((p) => p.id === asset.packageId),
					composition = project.compositions.find((c) => c.id === clip.compositionId);
				if (!pkg || !composition) continue;
				const settings = resolveRecordingSettings(pkg, composition);
				// Split at mute boundaries so recording audio follows the same source clock as effects.
				const segments = composition.timeMap.flatMap((segment) => {
					const sourceEnd =
						segment.sourceStartUs +
						(segment.outputEndUs - segment.outputStartUs) * segment.rate;
					const boundaries = [
						segment.sourceStartUs,
						sourceEnd,
						...(settings.clipRegions ?? [])
							.filter((c) => c.muted)
							.flatMap((c) => [c.startMs * 1000, c.endMs * 1000])
							.filter((t) => t > segment.sourceStartUs && t < sourceEnd),
					].sort((a, b) => a - b);
					return boundaries.slice(0, -1).flatMap((start, i) => {
						if (
							settings.clipRegions?.some(
								(c) =>
									c.muted && start >= c.startMs * 1000 && start < c.endMs * 1000,
							)
						)
							return [];
						return [
							{
								outputStartUs:
									segment.outputStartUs +
									(start - segment.sourceStartUs) / segment.rate,
								outputEndUs:
									segment.outputStartUs +
									(boundaries[i + 1] - segment.sourceStartUs) / segment.rate,
								sourceStartUs: start,
								rate: segment.rate,
							},
						];
					});
				});
				for (const kind of ["microphone", "system"] as const) {
					const stream = pkg[kind],
						control = settings.sourceAudioSettings?.[kind];
					if (stream)
						append(
							stream,
							kind,
							segments,
							control?.volume ?? 1,
							control?.normalize ?? false,
						);
				}
				for (const layer of [
					...settings.audioRegions,
					...buildVideoLayerAudioRegions(settings.annotationRegions),
				]) {
					append(
						{
							path: layer.audioPath,
							durationUs: (layer.endMs - layer.startMs) * 1000,
							offsetUs: layer.startMs * 1000,
						},
						layer.id.startsWith("video-layer:") ? "media" : "layer",
						composition.timeMap,
						layer.volume ?? 1,
						layer.normalize ?? false,
						layer.id,
						layer.playbackRate ?? 1,
						(layer.sourceOffsetMs ?? 0) * 1000,
						layer.ducking ? settings.audioDuckingSettings : undefined,
					);
				}
			} else if (asset.kind !== "image" && asset.source) {
				append(asset.source, "media", [
					{ outputStartUs: 0, outputEndUs: asset.durationUs, sourceStartUs: 0, rate: 1 },
				]);
			}
		}
	}
	return result;
}
export function audioAtTime(plan: ProjectAudioSegment[], timeUs: number) {
	return plan
		.filter((s) => timeUs >= s.startUs && timeUs < s.endUs)
		.map((s) => ({ ...s, sourceUs: s.sourceStartUs + (timeUs - s.startUs) * s.rate }));
}
