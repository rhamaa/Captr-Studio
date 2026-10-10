import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CanvasProjectInspector } from "./CanvasProjectInspector";
import { createTimelineProject } from "@/core/timeline/commands";

describe("CanvasProjectInspector", () => {
	it("renders canvas dimensions and aspect ratio presets", () => {
		const project = createTimelineProject("test-canvas", "Test Canvas");
		const html = renderToStaticMarkup(
			createElement(CanvasProjectInspector, {
				project,
				onCommand: () => undefined,
			}),
		);

		expect(html).toContain("Story Canvas");
		expect(html).toContain("1920 × 1080");
		expect(html).toContain("16:9 Landscape");
		expect(html).toContain("9:16 Vertical");
		expect(html).toContain("1:1 Square");
		expect(html).toContain("4:5 Portrait");
		expect(html).toContain("21:9 Ultrawide");
	});

	it("renders custom canvas controls and quick track actions", () => {
		const project = createTimelineProject("test-canvas", "Test Canvas");
		const html = renderToStaticMarkup(
			createElement(CanvasProjectInspector, {
				project,
				onCommand: () => undefined,
			}),
		);

		expect(html).toContain("Canvas width");
		expect(html).toContain("Canvas height");
		expect(html).toContain("Canvas frame rate");
		expect(html).toContain("+ Video Track");
		expect(html).toContain("+ Audio Track");
		expect(html).toContain("Duration");
	});
});
