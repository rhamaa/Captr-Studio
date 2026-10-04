import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { AssetLibrary } from "./AssetLibrary";

it("offers Audio Recorder from the asset library with no selected clip", () => {
	const markup = renderToStaticMarkup(
		createElement(
			I18nProvider,
			null,
			createElement(AssetLibrary, {
				assets: [],
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
});
