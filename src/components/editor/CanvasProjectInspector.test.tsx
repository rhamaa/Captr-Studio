import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CanvasProjectInspector } from "./CanvasProjectInspector";
import { createTimelineProject } from "@/core/timeline/commands";

describe("CanvasProjectInspector", () => {
	it("shows the Artboard canvas dimensions without editable ratio presets", () => {
		const project = createTimelineProject("test-canvas", "Test Canvas");
		const html = renderToStaticMarkup(
			createElement(CanvasProjectInspector, {
				project,
				onCommand: () => undefined,
			}),
		);

		expect(html).toContain("Story Canvas");
		expect(html).toContain("1920 × 1080");
		expect(html).not.toContain("Aspect Ratio Presets");
		expect(html).not.toContain("16:9 Landscape");
	});

	it("keeps story statistics and track actions without editable dimensions", () => {
		const project = createTimelineProject("test-canvas", "Test Canvas");
		const html = renderToStaticMarkup(
			createElement(CanvasProjectInspector, {
				project,
				onCommand: () => undefined,
			}),
		);

		expect(html).not.toContain("Canvas width");
		expect(html).not.toContain("Canvas height");
		expect(html).not.toContain("Canvas frame rate");
		expect(html).toContain("Story Statistics");
		expect(html).toContain("+ Video Track");
		expect(html).toContain("+ Audio Track");
		expect(html).toContain("Duration");
	});
});
