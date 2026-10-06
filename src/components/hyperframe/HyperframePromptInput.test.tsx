import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MediaAsset } from "@/core/timeline/types";
import { HyperframePromptInput } from "./HyperframePromptInput";

const mockAssets: MediaAsset[] = [
	{
		id: "asset-1",
		name: "screen-demo.mp4",
		kind: "video",
		durationUs: 5_000_000,
		width: 1920,
		height: 1080,
	},
	{
		id: "asset-2",
		name: "captr-logo.png",
		kind: "image",
		durationUs: 0,
		width: 512,
		height: 512,
	},
];

describe("HyperframePromptInput", () => {
	it("renders prompt textarea with placeholder and asset count hint", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframePromptInput, {
				value: "Create intro animation",
				onChange: vi.fn(),
				assets: mockAssets,
				taggedAssets: [],
				onTaggedAssetsChange: vi.fn(),
				placeholder: "Type @ to mention assets...",
			}),
		);

		expect(html).toContain("Create intro animation");
		expect(html).toContain("Type @ to mention assets...");
		expect(html).toContain("@ Tag Asset");
	});

	it("renders tagged asset chips when taggedAssets are provided", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframePromptInput, {
				value: "Use @captr-logo.png with elastic bounce",
				onChange: vi.fn(),
				assets: mockAssets,
				taggedAssets: [mockAssets[1]],
				onTaggedAssetsChange: vi.fn(),
			}),
		);

		expect(html).toContain("captr-logo.png");
		expect(html).toContain("tagged-asset-chip");
	});
});
