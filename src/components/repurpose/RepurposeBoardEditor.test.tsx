import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { createTimelineProject } from "@/core/timeline/commands";
import { addRepurposeArtboard, ensureRepurposeBoard } from "@/core/timeline/repurposeCommands";
import { RepurposeBoardEditor } from "./RepurposeBoardEditor";

describe("RepurposeBoardEditor", () => {
	it("renders empty state by default with preset selection buttons", () => {
		const base = createTimelineProject("p1", "Test Project");
		const project = ensureRepurposeBoard(base);

		const html = renderToStaticMarkup(
			createElement(
				I18nProvider,
				null,
				createElement(RepurposeBoardEditor, {
					project,
					projectTitle: "Test Project",
					onChange: vi.fn(),
					onClose: vi.fn(),
				}),
			),
		);

		// Breadcrumb & header
		expect(html).toContain("Multi-Artboard Hub");
		expect(html).toContain("0 Video Cards");
		// Empty state
		expect(html).toContain("Artboard Belum Memiliki Video");
		expect(html).toContain("9:16");
		expect(html).toContain("1:1");
		expect(html).toContain("16:9");
		// Docked asset library
		expect(html).toContain("Project Assets");
	});

	it("renders artboard cards with rename button and individual playback controls", () => {
		const base = createTimelineProject("p1", "Test Project");
		let project = ensureRepurposeBoard(base);
		project = addRepurposeArtboard(project, {
			aspectRatio: "9:16",
			name: "Shorts Hook",
			width: 1080,
			height: 1920,
			defaultFitMode: "cover",
		});
		project = addRepurposeArtboard(project, {
			aspectRatio: "1:1",
			name: "Feed Square",
			width: 1080,
			height: 1080,
			defaultFitMode: "cover",
		});

		const html = renderToStaticMarkup(
			createElement(
				I18nProvider,
				null,
				createElement(RepurposeBoardEditor, {
					project,
					projectTitle: "Test Project",
					onChange: vi.fn(),
					onClose: vi.fn(),
				}),
			),
		);

		expect(html).toContain("2 Video Cards");
		expect(html).toContain("Shorts Hook");
		expect(html).toContain("Feed Square");
		// Individual scrubber & play button
		expect(html).toContain("repurpose-card-scrubber");
		expect(html).toContain("repurpose-card-play-btn");
		expect(html).toContain("repurpose-card-name-edit-btn");
	});
});
