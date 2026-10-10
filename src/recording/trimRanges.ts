export interface TrimRange {
	id?: string;
	startMs: number;
	endMs: number;
}

export interface TrimRangeSummary {
	cutRanges: Array<TrimRange & { id: string }>;
	keptRanges: Array<{ startMs: number; endMs: number }>;
}

export function buildTrimRangeSummary(
	sourceDurationMs: number,
	trimRegions: readonly (TrimRange & { id: string })[],
): TrimRangeSummary {
	if (!Number.isFinite(sourceDurationMs) || sourceDurationMs <= 0) {
		return { cutRanges: [], keptRanges: [] };
	}

	const cutRanges = trimRegions
		.filter((region) => Number.isFinite(region.startMs) && Number.isFinite(region.endMs))
		.map((region) => ({
			id: region.id,
			startMs: Math.max(0, region.startMs),
			endMs: Math.min(sourceDurationMs, region.endMs),
		}))
		.filter((region) => region.endMs > region.startMs)
		.sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);

	const keptRanges: Array<{ startMs: number; endMs: number }> = [];
	let cursorMs = 0;
	for (const cutRange of cutRanges) {
		if (cutRange.startMs > cursorMs) {
			keptRanges.push({ startMs: cursorMs, endMs: cutRange.startMs });
		}
		cursorMs = Math.max(cursorMs, cutRange.endMs);
	}
	if (cursorMs < sourceDurationMs) {
		keptRanges.push({ startMs: cursorMs, endMs: sourceDurationMs });
	}

	return { cutRanges, keptRanges };
}

export function formatTrimTime(timeMs: number): string {
	const safeMs = Number.isFinite(timeMs) ? Math.max(0, Math.round(timeMs)) : 0;
	const minutes = Math.floor(safeMs / 60_000);
	const remainingMs = safeMs - minutes * 60_000;
	const seconds = (remainingMs / 1_000).toFixed(3).padStart(6, "0");
	return `${minutes}:${seconds}`;
}
