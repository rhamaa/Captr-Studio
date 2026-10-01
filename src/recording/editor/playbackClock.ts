export function playbackOutputTimeUs(
	baseOutputUs: number,
	elapsedMs: number,
	durationUs: number,
): number | null {
	if (!Number.isFinite(durationUs) || durationUs <= 0) return null;
	const startUs = Number.isFinite(baseOutputUs) ? Math.max(0, Math.round(baseOutputUs)) : 0;
	const elapsedUs = Number.isFinite(elapsedMs) ? Math.round(Math.max(0, elapsedMs) * 1000) : 0;
	const outputUs = startUs + elapsedUs;
	return outputUs >= durationUs ? null : outputUs;
}
