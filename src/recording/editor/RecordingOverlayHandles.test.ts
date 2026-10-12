import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEFAULT_ANNOTATION_STYLE } from "@/components/video-editor/types";
import { getDraggedAnnotationPosition, RecordingOverlayHandles } from "./RecordingOverlayHandles";

describe("recording overlay drag geometry", () => {
	it("converts preview pixels to percent coordinates and keeps the overlay within the canvas", () => {
		expect(getDraggedAnnotationPosition({ x: 40, y: 50 }, 100, -50, 1000, 500, 20, 15)).toEqual(
			{
				x: 50,
				y: 40,
			},
		);
		expect(getDraggedAnnotationPosition({ x: 90, y: 95 }, 200, 100, 1000, 500, 20, 15)).toEqual(
			{
				x: 80,
				y: 85,
			},
		);
	});

	it("exposes an active overlay as a draggable preview handle", () => {
		const html = renderToStaticMarkup(
			createElement(RecordingOverlayHandles, {
				annotations: [
					{
						id: "overlay-1",
						name: "Overlay 1",
						startMs: 0,
						endMs: 1000,
						type: "text",
						content: "Title",
						position: { x: 50, y: 40 },
						size: { width: 30, height: 20 },
						style: { ...DEFAULT_ANNOTATION_STYLE },
						zIndex: 1,
					},
				],
				currentMs: 500,
				playing: false,
				selectedAnnotationId: "overlay-1",
				onSelect: () => {},
				onPreviewPosition: () => {},
				onCommitPosition: () => {},
			}),
		);

		expect(html).toContain('aria-label="Move overlay Overlay 1"');
		expect(html).toContain("left:50%;top:40%");
	});
});
