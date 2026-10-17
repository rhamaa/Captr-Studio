import { clipDurationUs, type TimelineClip } from "./types";
export function fadeGain(
	timeUs: number,
	startUs: number,
	endUs: number,
	fadeInUs = 0,
	fadeOutUs = 0,
): number {
	if (timeUs < startUs || timeUs >= endUs) return 0;
	const duration = endUs - startUs;
	return Math.max(
		0,
		Math.min(
			1,
			fadeInUs ? (timeUs - startUs) / Math.min(duration, fadeInUs) : 1,
			fadeOutUs ? (endUs - timeUs) / Math.min(duration, fadeOutUs) : 1,
		),
	);
}
export function clipFadeGain(clip: TimelineClip, timeUs: number): number {
	return fadeGain(
		timeUs,
		clip.startUs,
		clip.startUs + clipDurationUs(clip),
		clip.fadeInUs,
		clip.fadeOutUs,
	);
}
