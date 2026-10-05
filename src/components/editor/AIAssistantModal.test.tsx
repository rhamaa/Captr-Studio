import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { AIAssistantModal } from "./AIAssistantModal";

describe("AIAssistantModal", () => {
	const mockProject = createTimelineProject("test-proj", "Test Project");

	it("renders modal with prompt presets and agent selection when open", () => {
		const html = renderToStaticMarkup(
			createElement(AIAssistantModal, {
				open: true,
				onOpenChange: vi.fn(),
				project: mockProject,
				transcripts: {},
				onApplyChanges: vi.fn(),
			}),
		);

		expect(html).toContain("AI Editor Assistant");
		expect(html).toContain("Cut dead air &amp; long pauses");
		expect(html).toContain("Make a 60-second reel");
		expect(html).toContain("Run AI Agent");
	});

	it("renders nothing when open is false", () => {
		const html = renderToStaticMarkup(
			createElement(AIAssistantModal, {
				open: false,
				onOpenChange: vi.fn(),
				project: mockProject,
				transcripts: {},
				onApplyChanges: vi.fn(),
			}),
		);

		expect(html).toBe("");
	});
});
