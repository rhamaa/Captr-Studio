import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
		expect(html).not.toContain("project-repurpose-subeditor");
	});

	it("shows repurpose sub-editor when repurposeEditor is provided and recordingEditor is null", () => {
		const html = renderToStaticMarkup(
			createElement(
				ProjectEditorPanel,
				{
					recordingEditor: null,
					repurposeEditor: createElement("section", {
						"aria-label": "Repurpose studio",
					}),
				},
				createElement("section", { "aria-label": "Project timeline" }),
			),
		);

		expect(html).toContain('class="project-repurpose-subeditor"');
		expect(html).toContain('aria-label="Repurpose studio"');
		expect(html).not.toContain('aria-label="Project timeline"');
	});

	it("shows hyperframe sub-editor when hyperframeEditor is provided and recordingEditor is null", () => {
		const html = renderToStaticMarkup(
			createElement(
				ProjectEditorPanel,
				{
					recordingEditor: null,
					hyperframeEditor: createElement("section", {
						"aria-label": "Hyperframe full editor",
					}),
				},
				createElement("section", { "aria-label": "Project timeline" }),
			),
		);

		expect(html).toContain('class="project-hyperframe-subeditor"');
		expect(html).toContain('aria-label="Hyperframe full editor"');
		expect(html).not.toContain('aria-label="Project timeline"');
	});
});
