export const TIMELINE_AXIS_HEIGHT_PX = 32;
export const TIMELINE_ROW_GAP_PX = 2;
export const TIMELINE_DEFAULT_ROW_CONTENT_MIN_HEIGHT_PX = 26;
export const TIMELINE_CLIP_ROW_MIN_HEIGHT_PX = 76;
export const TIMELINE_ROW_MIN_HEIGHT_PX =
	TIMELINE_DEFAULT_ROW_CONTENT_MIN_HEIGHT_PX + TIMELINE_ROW_GAP_PX;
export const TIMELINE_VISIBLE_ROW_COUNT = 2;

function normalizeRowCount(rowCount: number) {
	if (!Number.isFinite(rowCount)) {
		return 0;
	}

	return Math.max(0, Math.floor(rowCount));
}

export function getTimelineRowsMinHeightPx(rowCount: number) {
	return normalizeRowCount(rowCount) * TIMELINE_ROW_MIN_HEIGHT_PX;
}

export function getTimelineContentMinHeightPx(rowCount: number) {
	return TIMELINE_AXIS_HEIGHT_PX + getTimelineRowsMinHeightPx(rowCount);
}

export function getTimelineCanvasContentMinHeightPx(
	rowCount: number,
	firstRowMinHeightPx = TIMELINE_CLIP_ROW_MIN_HEIGHT_PX,
) {
	const normalizedRowCount = normalizeRowCount(rowCount);
	const rowsHeight =
		normalizedRowCount === 0
			? 0
			: firstRowMinHeightPx +
				TIMELINE_ROW_GAP_PX +
				(normalizedRowCount - 1) * TIMELINE_ROW_MIN_HEIGHT_PX;

	return TIMELINE_AXIS_HEIGHT_PX + rowsHeight;
}

export function getTimelineViewportStretchFactor(rowCount: number) {
	const normalizedRowCount = normalizeRowCount(rowCount);

	if (normalizedRowCount <= 0) {
		return 1;
	}

	return Math.max(1, normalizedRowCount / TIMELINE_VISIBLE_ROW_COUNT);
}
