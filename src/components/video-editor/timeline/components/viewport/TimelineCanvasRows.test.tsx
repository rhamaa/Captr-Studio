import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CLIP_ROW_ID } from "../../core/constants";
import type { AudioPeaksData } from "../../core/timelineTypes";
import { TimelineCanvasRows } from "./TimelineCanvasRows";

vi.mock("../../Row", () => ({
	default: ({
		id,
		label,
		hint,
		children,
	}: {
		id: string;
		label?: string;
		hint?: string;
		children?: ReactNode;
	}) =>
		createElement(
			"section",
			{ "data-row-id": id, "data-row-label": label },
			label ? createElement("span", null, label) : null,
			hint ? createElement("span", null, hint) : null,
			children,
		),
}));

vi.mock("../../Item", () => ({
	default: ({
		id,
		children,
		waveformPeaks,
		span,
		waveformSegmentSpan,
		readOnly,
	}: {
		id: string;
		children?: ReactNode;
		waveformPeaks?: AudioPeaksData | null;
		span?: { start: number; end: number };
		waveformSegmentSpan?: { start: number; end: number };
		readOnly?: boolean;
	}) =>
		createElement(
			"div",
			{
				"data-item-id": id,
				"data-waveform": waveformPeaks ? "true" : "false",
				"data-read-only": String(readOnly),
				"data-span-start": span?.start,
				"data-span-end": span?.end,
				"data-waveform-start": waveformSegmentSpan?.start,
				"data-waveform-end": waveformSegmentSpan?.end,
			},
			children,
		),
}));

vi.mock("../overlays/ClipMarkerOverlay", () => ({ default: () => null }));

const baseProps = {
	recordToolsEnabled: true,
	items: [],
	videoDurationMs: 10_000,
	selectAllBlocksActive: false,
	selectedZoomId: null,
	direction: "ltr",
	canShowGhostZoom: false,
	ghostStartMs: null,
	ghostStartOffsetPx: 0,
	ghostWidthPx: 0,
	onZoomRowMouseEnter: () => {},
	onZoomRowMouseMove: () => {},
	onZoomRowMouseLeave: () => {},
	onZoomRowMouseDown: () => {},
	onZoomRowClick: () => {},
	canShowGhostLayout: false,
	layoutGhostStartMs: null,
	layoutGhostStartOffsetPx: 0,
	layoutGhostWidthPx: 0,
	onLayoutRowMouseEnter: () => {},
	onLayoutRowMouseMove: () => {},
	onLayoutRowMouseLeave: () => {},
	onLayoutRowMouseDown: () => {},
	onLayoutRowClick: () => {},
};

const renderRows = (overrides: Record<string, unknown> = {}) =>
	renderToStaticMarkup(
		createElement(TimelineCanvasRows, { ...baseProps, ...overrides } as never),
	);

describe("TimelineCanvasRows recording editor layout", () => {
	it("keeps the split-clip lane for the standard editor by default", () => {
		const html = renderRows();

		expect(html).toContain(`data-row-id="${CLIP_ROW_ID}"`);
		expect(html).toContain("Press C to split clip");
	});

	it("omits the empty split-clip lane in compact mode", () => {
		const html = renderRows({ showClipRow: false });

		expect(html).not.toContain(`data-row-id="${CLIP_ROW_ID}"`);
		expect(html).not.toContain("Press C to split clip");
	});

	it("renders source recording audio tracks as waveform rows", () => {
		const peaks = {} as AudioPeaksData;
		const html = renderRows({
			showClipRow: false,
			showSourceAudioTrack: true,
			sourceAudioTracks: [{ id: "mic", label: "Microphone", peaks }],
		});

		expect(html).toContain('data-row-label="Microphone"');
		expect(html).toContain('data-waveform="true"');
		expect(html).toContain('data-read-only="true"');
		expect(html).not.toContain("Press C to split clip");
	});

	it("aligns source waveform time with the audio stream offset", () => {
		const html = renderRows({
			showClipRow: false,
			showSourceAudioTrack: true,
			sourceAudioTracks: [
				{
					id: "mic",
					label: "Microphone",
					peaks: {} as AudioPeaksData,
					offsetMs: 125,
					durationMs: 9_500,
				},
			],
		});

		expect(html).toContain('data-span-start="125"');
		expect(html).toContain('data-span-end="9625"');
		expect(html).toContain('data-waveform-start="0"');
		expect(html).toContain('data-waveform-end="9500"');
	});
});
