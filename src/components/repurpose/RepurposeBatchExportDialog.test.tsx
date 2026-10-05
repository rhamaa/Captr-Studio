import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { ensureRepurposeBoard } from "@/core/timeline/repurposeCommands";
import { RepurposeBatchExportDialog } from "./RepurposeBatchExportDialog";

describe("RepurposeBatchExportDialog", () => {
	it("renders dialog with artboards and slices checklist", () => {
		const base = createTimelineProject("test-p", "My Video Project");
		const project = ensureRepurposeBoard(base);

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
