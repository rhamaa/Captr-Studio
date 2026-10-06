import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HyperframeComposition } from "@/core/story/storyTypes";
import type { TimelineProject } from "@/core/timeline/types";
import { HyperframeEditor } from "./HyperframeEditor";

const mockHyperframe: HyperframeComposition = {
	id: "hf-full-1",
	name: "Kinetic Intro Screen",
	entryHtml: "hyperframe/hyperframe-hf-full-1.html",
	specJson: "hyperframe/hyperframe-hf-full-1.json",
	htmlContent: "<!DOCTYPE html><html><body><h1>Hyperframe Full View</h1></body></html>",
	durationUs: 6_000_000,
	width: 1920,
	height: 1080,
	fps: 60,
	aspectRatio: "16:9",
	createdAt: "2026-10-06T10:00:00.000Z",
};

const mockProject: TimelineProject = {
	version: 3,
	projectId: "proj-full",
	title: "Product Launch",
	assets: [
		{
			id: "a1",
			kind: "video",
			name: "teaser.mp4",
			source: { kind: "video", path: "/videos/teaser.mp4" },
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

describe("HyperframeEditor", () => {
	it("renders full editor header, expansive preview, and dedicated transport bar", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframeEditor, {
				hyperframe: mockHyperframe,
				project: mockProject,
				projectTitle: "Product Launch",
				onUpdate: vi.fn(),
				onClose: vi.fn(),
			}),
		);

		// Top header
		expect(html).toContain("Kinetic Intro Screen");
		expect(html).toContain("16:9");
		expect(html).toContain("1920x1080");
		expect(html).toContain("6.0s");
		expect(html).toContain("Back");

		// Dedicated Transport Controls
		expect(html).toContain("hyperframe-transport-play");
		expect(html).toContain("hyperframe-transport-scrubber");
		expect(html).toContain("0.00s");
		expect(html).toContain("6.00s");

		// Center Stage Preview
		expect(html).toContain("hyperframe-stage-iframe");

		// Side Panel
		expect(html).toContain("CLI Agent");
		expect(html).toContain("Source Code");
	});

	it("renders prompt input with @ asset tagging trigger", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframeEditor, {
				hyperframe: mockHyperframe,
				project: mockProject,
				onUpdate: vi.fn(),
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain("@ Tag Asset");
		expect(html).toContain("1 available");
	});
});
