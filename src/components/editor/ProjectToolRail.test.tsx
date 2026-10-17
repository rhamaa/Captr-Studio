import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import type { StoryDesignTemplate } from "@/core/timeline/types";
import { ProjectToolRail } from "./ProjectToolRail";

it("keeps the shape picker in the tool rail beside Assets", () => {
	const markup = renderToStaticMarkup(
		createElement(
			I18nProvider,
			null,
			createElement(ProjectToolRail, {
				onAddText: () => undefined,
				onAddShape: () => undefined,
			}),
		),
	);

	const assetsButton = markup.indexOf('aria-label="Assets"');
	const shapePicker = markup.indexOf('class="project-shape-rail-menu"');
	expect(assetsButton).toBeGreaterThanOrEqual(0);
	expect(shapePicker).toBeGreaterThan(assetsButton);
	expect(markup.match(/class="project-shape-choice"/g)).toHaveLength(4);
	expect(markup).toContain('aria-label="Add text overlay"');
});

it("keeps templates available from the tool rail instead of the asset list", () => {
	const markup = renderToStaticMarkup(
		createElement(
			I18nProvider,
			null,
			createElement(ProjectToolRail, {
				onAddText: () => undefined,
				onAddShape: () => undefined,
				templates: [{ id: "template-1", name: "Editorial" }] as StoryDesignTemplate[],
				onApplyTemplate: () => undefined,
			}),
		),
	);

	expect(markup).toContain('aria-label="Templates"');
	expect(markup).toContain("Editorial");
});
