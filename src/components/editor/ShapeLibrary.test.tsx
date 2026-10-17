import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PRESET_COLORS, SHAPE_PRESETS, ShapeLibrary, STROKE_WEIGHTS } from "./ShapeLibrary";

describe("ShapeLibrary presets and definitions", () => {
	it("contains high-value highlight and privacy shapes", () => {
		const ids = SHAPE_PRESETS.map((p) => p.id);
		expect(ids).toContain("focus-frame");
		expect(ids).toContain("highlighter-marker");
		expect(ids).toContain("attention-dashed-box");
		expect(ids).toContain("arrow-right");
		expect(ids).toContain("arrow-down");
		expect(ids).toContain("callout-circle");
		expect(ids).toContain("blur-redact");
		expect(ids).toContain("blackout-bar");
	});

	it("creates valid highlight and arrow shapes with custom color and stroke width", () => {
		const focusPreset = SHAPE_PRESETS.find((p) => p.id === "focus-frame")!;
		const shape = focusPreset.createDefinition("#facc15", 8);
		expect(shape.kind).toBe("rectangle");
		expect(shape.style.stroke?.color).toBe("#facc15");
		expect(shape.style.stroke?.width).toBe(8);

		const arrowPreset = SHAPE_PRESETS.find((p) => p.id === "arrow-right")!;
		const arrowShape = arrowPreset.createDefinition("#06b6d4", 10);
		expect(arrowShape.kind).toBe("arrow");
		expect(arrowShape.style.stroke?.color).toBe("#06b6d4");
	});

	it("creates valid blur mask definition with custom blurRadius", () => {
		const blurPreset = SHAPE_PRESETS.find((p) => p.id === "blur-redact")!;
		const shape = blurPreset.createDefinition("#ef4444", 6);
		expect(shape.kind).toBe("blur");
		if (shape.kind === "blur") {
			expect(shape.blurRadius).toBe(18);
			expect(shape.width).toBe(320);
			expect(shape.height).toBe(140);
		}
	});

	it("has color presets and stroke weights ready for user customization", () => {
		expect(PRESET_COLORS.length).toBeGreaterThanOrEqual(6);
		expect(STROKE_WEIGHTS.length).toBe(3);
	});
});

describe("ShapeLibrary component markup", () => {
	it("renders visual shape cards with SVG previews rather than plain text list", () => {
		const onAddShape = vi.fn();
		const markup = renderToStaticMarkup(createElement(ShapeLibrary, { onAddShape }));

		// Header and count badge
		expect(markup).toContain("Highlights &amp; Shapes");
		expect(markup).toContain(String(SHAPE_PRESETS.length));

		// Search input and customization controls
		expect(markup).toContain('placeholder="Search shapes &amp; highlights..."');
		expect(markup).toContain("Preset Color");
		expect(markup).toContain("Stroke Width");

		// Filter categories
		expect(markup).toContain("Focus &amp; Box");
		expect(markup).toContain("Arrows");
		expect(markup).toContain("Callouts");
		expect(markup).toContain("Privacy");

		// Visual SVG rendering in cards
		expect(markup).toContain("<svg");
		expect(markup).toContain('aria-label="Add Focus Box"');
		expect(markup).toContain('aria-label="Add Blur Mask"');
		expect(markup).toContain('aria-label="Add Right Arrow"');
	});

	it("renders category sub-menu at the very top of the panel, before search and customization", () => {
		const onAddShape = vi.fn();
		const markup = renderToStaticMarkup(createElement(ShapeLibrary, { onAddShape }));

		const subTabsIndex = markup.indexOf('class="project-sub-tabs"');
		const searchIndex = markup.indexOf('class="project-shapes-search"');
		const toolbarIndex = markup.indexOf('class="project-shapes-toolbar"');
		const gridIndex = markup.indexOf('class="project-shapes-grid"');

		expect(subTabsIndex).toBeGreaterThanOrEqual(0);
		expect(subTabsIndex).toBeLessThan(searchIndex);
		expect(searchIndex).toBeLessThan(toolbarIndex);
		expect(toolbarIndex).toBeLessThan(gridIndex);
	});

	it("renders top navigation tabs when onSelectTab is provided", () => {
		const onAddShape = vi.fn();
		const onSelectTab = vi.fn();
		const markup = renderToStaticMarkup(
			createElement(ShapeLibrary, {
				onAddShape,
				activeTab: "shapes",
				onSelectTab,
			}),
		);

		expect(markup).toContain('class="project-sidebar-top-tabs"');
		expect(markup).toContain("Assets");
		expect(markup).toContain("Shapes &amp; Highlights");
	});
});
