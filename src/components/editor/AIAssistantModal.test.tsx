import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { AIAssistantModal } from "./AIAssistantModal";

describe("AIAssistantModal", () => {
	const mockProject = createTimelineProject("test-proj", "Test Project");
	mockProject.assets = [
		{
			id: "rec-1",
			kind: "video",
			name: "Screen_Recording",
			durationUs: 10_000_000,
			width: 1920,
			height: 1080,
		},
	];

	it("renders modal with prompt presets, agent selection, and asset mention chips", () => {
		const html = renderToStaticMarkup(
			createElement(AIAssistantModal, {
				open: true,
				onOpenChange: vi.fn(),
				project: mockProject,
				transcripts: {
					"rec-1": {
						assetId: "rec-1",
						language: "id",
						fullText: "Halo semua",
						segments: [],
						words: [],
						createdAt: "",
					},
				},
				onApplyChanges: vi.fn(),
			}),
		);

		expect(html).toContain("AI Editor Assistant");
		expect(html).toContain("A-Roll speech + Hyperframe B-Roll");
		expect(html).toContain("Cut dead air &amp; long pauses");
		expect(html).toContain("@Screen_Recording");
		expect(html).toContain("CC");
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
