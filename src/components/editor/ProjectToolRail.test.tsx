import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { ProjectToolRail } from "./ProjectToolRail";

it("keeps the shape picker in the tool rail beside Assets", () => {
	const markup = renderToStaticMarkup(
		createElement(
			I18nProvider,
			null,
			createElement(ProjectToolRail, { onAddShape: () => undefined }),
		),
	);

	const assetsButton = markup.indexOf('aria-label="Assets"');
	const shapePicker = markup.indexOf('class="project-shape-rail-menu"');
	expect(assetsButton).toBeGreaterThanOrEqual(0);
	expect(shapePicker).toBeGreaterThan(assetsButton);
	expect(markup.match(/class="project-shape-choice"/g)).toHaveLength(4);
});
