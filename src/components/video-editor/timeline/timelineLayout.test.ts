import { describe, expect, it } from "vitest";
import {
	getTimelineCanvasContentMinHeightPx,
	getTimelineContentMinHeightPx,
	getTimelineRowsMinHeightPx,
	getTimelineViewportStretchFactor,
	TIMELINE_AXIS_HEIGHT_PX,
	TIMELINE_DEFAULT_ROW_CONTENT_MIN_HEIGHT_PX,
	TIMELINE_ROW_MIN_HEIGHT_PX,
	TIMELINE_VISIBLE_ROW_COUNT,
} from "./timelineLayout";

describe("timelineLayout", () => {
	it("reserves vertical space for every rendered timeline row", () => {
		expect(getTimelineRowsMinHeightPx(5)).toBe(5 * TIMELINE_ROW_MIN_HEIGHT_PX);
		expect(getTimelineContentMinHeightPx(5)).toBe(
			TIMELINE_AXIS_HEIGHT_PX + 5 * TIMELINE_ROW_MIN_HEIGHT_PX,
		);
	});

	it("reserves the full clip row and track space for vertical scrolling", () => {
		expect(getTimelineCanvasContentMinHeightPx(1)).toBe(110);
		expect(getTimelineCanvasContentMinHeightPx(3)).toBe(166);
		expect(getTimelineCanvasContentMinHeightPx(4)).toBe(194);
	});

	it("supports compact timelines without a tall first clip row", () => {
		expect(
			getTimelineCanvasContentMinHeightPx(3, TIMELINE_DEFAULT_ROW_CONTENT_MIN_HEIGHT_PX),
		).toBe(116);
	});

	it("ignores invalid row counts", () => {
		expect(getTimelineRowsMinHeightPx(-1)).toBe(0);
		expect(getTimelineRowsMinHeightPx(Number.NaN)).toBe(0);
		expect(getTimelineContentMinHeightPx(Number.POSITIVE_INFINITY)).toBe(
			TIMELINE_AXIS_HEIGHT_PX,
		);
	});

	it("floors fractional row counts", () => {
		expect(getTimelineRowsMinHeightPx(2.9)).toBe(2 * TIMELINE_ROW_MIN_HEIGHT_PX);
		expect(getTimelineContentMinHeightPx(2.9)).toBe(
			TIMELINE_AXIS_HEIGHT_PX + 2 * TIMELINE_ROW_MIN_HEIGHT_PX,
		);
	});

	it("stretches content height to keep a two-row viewport", () => {
		expect(TIMELINE_VISIBLE_ROW_COUNT).toBe(2);
		expect(getTimelineViewportStretchFactor(2)).toBe(1);
		expect(getTimelineViewportStretchFactor(4)).toBe(2);
		expect(getTimelineViewportStretchFactor(5)).toBe(2.5);
		expect(getTimelineViewportStretchFactor(0)).toBe(1);
	});
});
