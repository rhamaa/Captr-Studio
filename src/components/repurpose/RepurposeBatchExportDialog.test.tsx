import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { addRepurposeArtboard, ensureRepurposeBoard } from "@/core/timeline/repurposeCommands";
import { RepurposeBatchExportDialog } from "./RepurposeBatchExportDialog";

describe("RepurposeBatchExportDialog", () => {
	it("renders dialog with artboards and slices checklist", () => {
		const base = createTimelineProject("test-p", "My Video Project");
		let project = ensureRepurposeBoard(base);
		project = addRepurposeArtboard(project, {
			aspectRatio: "9:16",
			name: "Shorts / Reels",
			width: 1080,
			height: 1920,
			defaultFitMode: "cover",
		});
		project = addRepurposeArtboard(project, {
			aspectRatio: "1:1",
			name: "Square Post",
			width: 1080,
			height: 1080,
			defaultFitMode: "cover",
		});
		project = addRepurposeArtboard(project, {
			aspectRatio: "16:9",
			name: "Landscape Master",
			width: 1920,
			height: 1080,
			defaultFitMode: "contain",
		});

		const html = renderToStaticMarkup(
			createElement(RepurposeBatchExportDialog, {
				project,
				projectTitle: "My Video Project",
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain("Batch Export Repurposed Media");
		expect(html).toContain("Shorts / Reels");
		expect(html).toContain("Square Post");
		expect(html).toContain("Full Video");
		expect(html).toContain("Export 3 Videos");
	});
});
