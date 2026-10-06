import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HyperframeComposition } from "@/core/story/storyTypes";
import type { TimelineProject } from "@/core/timeline/types";
import { HyperframeEditorDrawer } from "./HyperframeEditorDrawer";

const mockHyperframe: HyperframeComposition = {
	id: "hf-test-1",
	name: "Kinetic Intro",
	entryHtml: "hyperframe/hyperframe-hf-test-1.html",
	specJson: "hyperframe/hyperframe-hf-test-1.json",
	htmlContent: "<!DOCTYPE html><html><body><h1>Hello World</h1></body></html>",
	durationUs: 5_000_000,
	width: 1920,
	height: 1080,
	fps: 60,
	aspectRatio: "16:9",
	createdAt: "2026-10-06T10:00:00.000Z",
};

const mockProject: TimelineProject = {
	version: 3,
	projectId: "proj-1",
	title: "Test Project",
	assets: [
		{
			id: "asset-1",
			kind: "video",
			name: "intro.mp4",
			source: { kind: "video", path: "/path/to/intro.mp4" },
			durationUs: 10_000_000,
			width: 1920,
			height: 1080,
		},
	],
	tracks: [],
	canvas: { width: 1920, height: 1080, fps: 60 },
	packages: [],
	compositions: [],
	createdAt: "2026-10-06T10:00:00.000Z",
	updatedAt: "2026-10-06T10:00:00.000Z",
};

describe("HyperframeEditorDrawer", () => {
	it("renders drawer header with hyperframe identity, aspect ratio, duration, and close button", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframeEditorDrawer, {
				hyperframe: mockHyperframe,
				project: mockProject,
				projectTitle: "My Project",
				onUpdate: vi.fn(),
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain("Kinetic Intro");
		expect(html).toContain("16:9");
		expect(html).toContain("1920x1080");
		expect(html).toContain("5.0s");
		expect(html).toContain("hyperframe-drawer-close");
	});

	it("renders live preview iframe with scrubber and playback toolbar", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframeEditorDrawer, {
				hyperframe: mockHyperframe,
				project: mockProject,
				onUpdate: vi.fn(),
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain("hyperframe-drawer-iframe");
		expect(html).toContain("hyperframe-drawer-scrubber");
		expect(html).toContain("Play");
	});

	it("renders Agent Prompt tab with CLI agent selector, context badges, and run button", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframeEditorDrawer, {
				hyperframe: mockHyperframe,
				project: mockProject,
				onUpdate: vi.fn(),
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain("CLI Agent");
		expect(html).toContain("Run Agent");
		expect(html).toContain("1 Asset");
		expect(html).toContain("Source Code");
	});
});
