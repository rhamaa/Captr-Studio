import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HyperframeComposition } from "@/core/story/storyTypes";
import { HyperframePreview } from "./HyperframePreview";

describe("HyperframePreview", () => {
	const sampleHyperframe: HyperframeComposition = {
		id: "test-hf",
		name: "Feature Intro",
		entryHtml: "hyperframe/intro.html",
		htmlContent: "<html><body><h1>Hello Hyperframe</h1></body></html>",
		durationUs: 4_000_000,
		width: 1920,
		height: 1080,
	};

	it("renders preview with iframe container, controls, and title", () => {
		const html = renderToStaticMarkup(<HyperframePreview hyperframe={sampleHyperframe} />);

		expect(html).toContain("Feature Intro");
		expect(html).toContain("1920x1080");
		expect(html).toContain("4.0s");
		expect(html).toContain("iframe");
		expect(html).toContain('sandbox="allow-scripts allow-same-origin"');
		expect(html).toContain("type=\"range\"");
	});
});
