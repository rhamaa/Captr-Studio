import { clipDurationUs, type RecordComposition, type TimelineClip } from "./types";
export function mapClipTime(clip: TimelineClip, projectUs: number): number | null {
	if (
		!clip.enabled ||
		projectUs < clip.startUs ||
		projectUs >= clip.startUs + clipDurationUs(clip)
	)
		return null;
	return clip.sourceInUs + (projectUs - clip.startUs) * clip.rate;
}
export function mapCompositionTime(composition: RecordComposition, outputUs: number): number {
	const segment = composition.timeMap.find(
		(s) => outputUs >= s.outputStartUs && outputUs < s.outputEndUs,
	);
	if (!segment) throw new Error("Composition time is outside its source map");
	return segment.sourceStartUs + (outputUs - segment.outputStartUs) * segment.rate;
}
export function mapStreamTime(
	sourceUs: number,
	offsetUs: number,
	durationUs: number,
): number | null {
	const local = sourceUs - offsetUs;
	return local >= 0 && local < durationUs ? local : null;
}
