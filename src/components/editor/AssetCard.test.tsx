import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MediaAsset } from "@/core/timeline/types";
import { AssetCard } from "./AssetCard";

describe("AssetCard caption support", () => {
	const videoAsset: MediaAsset = {
		id: "asset-video-1",
		kind: "video",
		name: "My Video.mp4",
		durationUs: 15_000_000,
		width: 1920,
		height: 1080,
		source: {
			kind: "file",
			path: "D:/mock/My Video.mp4",
		},
	};

	const imageAsset: MediaAsset = {
		id: "asset-img-1",
		kind: "image",
		name: "Background.png",
		durationUs: 5_000_000,
		width: 1920,
		height: 1080,
		source: {
			kind: "file",
			path: "D:/mock/Background.png",
		},
	};

	it("renders caption button for audio/video assets", () => {
		const html = renderToStaticMarkup(
			createElement(AssetCard, {
				asset: videoAsset,
				sourcePath: "D:/mock/My Video.mp4",
				selected: false,
				onPreview: vi.fn(),
				onPlace: vi.fn(),
				onRemove: vi.fn(),
				onPublish: vi.fn(),
			}),
		);

		expect(html).toContain("project-asset-cc-btn");
		expect(html).toContain("Generate captions for My Video.mp4");
		expect(html).toContain("Publish to Assets");
	});

	it("omits caption button for image assets without audio", () => {
		const html = renderToStaticMarkup(
			createElement(AssetCard, {
				asset: imageAsset,
				sourcePath: "D:/mock/Background.png",
				selected: false,
				onPreview: vi.fn(),
				onPlace: vi.fn(),
				onRemove: vi.fn(),
			}),
		);

		expect(html).not.toContain("project-asset-cc-btn");
		expect(html).not.toContain("project-asset-cc-badge");
		expect(html).not.toContain("Publish to Assets");
	});
});
