import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProjectEditorPanel } from "./ProjectEditorPanel";

describe("ProjectEditorPanel", () => {
	it("shows recording sub-editor in place of project workspace", () => {
		const html = renderToStaticMarkup(
			createElement(
				ProjectEditorPanel,
				{
					recordingEditor: createElement("section", {
						"aria-label": "Recording effects",
					}),
				},
				createElement("section", { "aria-label": "Project timeline" }),
			),
		);

		expect(html).toContain('class="project-recording-subeditor"');
		expect(html).toContain('aria-label="Recording effects"');
		expect(html).not.toContain('aria-label="Project timeline"');
	});

	it("restores project workspace when no recording composition is open", () => {
		const html = renderToStaticMarkup(
			createElement(
				ProjectEditorPanel,
				{ recordingEditor: null },
				createElement("section", { "aria-label": "Project timeline" }),
			),
		);

		expect(html).toContain('aria-label="Project timeline"');
		expect(html).not.toContain("project-recording-subeditor");
	});
});
