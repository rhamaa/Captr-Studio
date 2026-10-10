import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { HyperframeComposition } from "@/core/story/storyTypes";
import { HyperframeCard } from "./HyperframeCard";

describe("HyperframeCard", () => {
	const sampleHyperframe: HyperframeComposition = {
		id: "hf-test-1",
		name: "Title Card Intro",
		entryHtml: "hyperframe/hyperframe-hf-test-1.html",
		htmlContent: "<html><body><h1>Hello World</h1></body></html>",
		width: 1920,
		height: 1080,
		aspectRatio: "16:9",
		durationUs: 5_000_000,
	};

	it("renders card header, aspect ratio badge, and hyperframe identity", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframeCard, {
				hyperframe: sampleHyperframe,
				onOpenEditor: () => {},
				onRemove: () => {},
			}),
		);

		expect(html).toContain("Title Card Intro");
		expect(html).toContain("16:9");
		expect(html).toContain("HYPERFRAME");
		expect(html).toContain("hf-test-1");
	});

	it("renders preview container with responsive dimensions", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframeCard, {
				hyperframe: sampleHyperframe,
				displayHeight: 360,
				onOpenEditor: () => {},
				onRemove: () => {},
			}),
		);

		expect(html).toContain("repurpose-hyperframe-card");
		expect(html).toContain("iframe");
	});
});
