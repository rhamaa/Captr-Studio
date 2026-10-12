import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import type { MediaAsset } from "@/core/timeline/types";
import { AssetLibrary } from "./AssetLibrary";

const mediaAsset = (id: string, name: string, kind: MediaAsset["kind"]): MediaAsset => ({
	id,
	name,
	kind,
	durationUs: 1_000_000,
	width: 640,
	height: 360,
});

it("offers Audio Recorder from the asset library with no selected clip", () => {
	const markup = renderToStaticMarkup(
		createElement(
			I18nProvider,
			null,
			createElement(AssetLibrary, {
				assets: [],
				storyAssets: [],
				packages: [],
				selectedAssetId: null,
				onImport: vi.fn(),
				onRecord: vi.fn(),
				onRecordAudio: vi.fn(),
				onPreview: vi.fn(),
				onPlace: vi.fn(),
				onRemove: vi.fn(),
			}),
		),
	);

	expect(markup).toContain("Record Audio");
	expect(markup).toContain('aria-label="Asset library"');
	expect(markup).not.toContain("Story Media");
	expect(markup).not.toContain("Text / Shapes");
	expect(markup).not.toContain("Templates");
});

it("shows project and Story media in one grid while omitting inline overlays", () => {
	const markup = renderToStaticMarkup(
		createElement(
			I18nProvider,
			null,
			createElement(AssetLibrary, {
				assets: [
					mediaAsset("shared-video", "Shared video", "video"),
					mediaAsset("overlay-text", "Overlay text", "text"),
				],
				storyAssets: [mediaAsset("story-image", "Story image", "image")],
				packages: [],
				selectedAssetId: null,
				onImport: vi.fn(),
				onRecord: vi.fn(),
				onRecordAudio: vi.fn(),
				onPreview: vi.fn(),
				onPlace: vi.fn(),
				onRemove: vi.fn(),
				onRemoveStoryMedia: vi.fn(),
			}),
		),
	);

	expect(markup).toContain("Shared video");
	expect(markup).toContain("Story image");
	expect(markup).not.toContain("Overlay text");
	expect(markup).not.toContain("Story Media");
	expect(markup.match(/class="project-asset-grid grid"/g)).toHaveLength(1);
});
