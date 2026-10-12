import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { MediaAsset, RecordingPackage } from "@/core/timeline/types";
import { AssetCard } from "./AssetCard";
import { AssetSourcePreview } from "./AssetSourcePreview";

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

	const recordingAsset: MediaAsset = {
		id: "asset-recording-1",
		kind: "recording",
		name: "Recording.mp4",
		durationUs: 18_000_000,
		width: 1920,
		height: 1080,
		packageId: "package-1",
		source: { kind: "file", path: "D:/mock/Recording.mp4" },
	};
	const recordingPackage: RecordingPackage = {
		id: "package-1",
		captureId: "capture-1",
		schemaVersion: 1,
		durationUs: 18_000_000,
		width: 1920,
		height: 1080,
		screen: { path: "D:/mock/Recording.mp4", durationUs: 18_000_000, offsetUs: 0 },
		webcam: { path: "D:/mock/Webcam.mp4", durationUs: 18_000_000, offsetUs: 0 },
		microphone: { path: "D:/mock/Microphone.wav", durationUs: 18_000_000, offsetUs: 0 },
		settings: {},
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

	it("shows the available recording components on the asset card", () => {
		const html = renderToStaticMarkup(
			createElement(AssetCard, {
				asset: recordingAsset,
				recordingPackage,
				sourcePath: recordingPackage.screen.path,
				selected: false,
				onPreview: vi.fn(),
				onPlace: vi.fn(),
				onRemove: vi.fn(),
			}),
		);

		expect(html).toContain('aria-label="Recording contents"');
		expect(html).toContain('title="Screen video: available"');
		expect(html).toContain('title="Webcam video: available"');
		expect(html).toContain('title="Microphone audio: available"');
		expect(html).toContain('title="Internal audio: not included"');
		expect(html).toContain('title="Captions: not included"');
	});

	it("previews the components inside a recording package", () => {
		const html = renderToStaticMarkup(
			createElement(AssetSourcePreview, {
				asset: recordingAsset,
				path: recordingPackage.screen.path,
				recordingPackage,
			}),
		);

		expect(html).toContain("project-recording-source-preview");
		expect(html).toContain("Screen video");
		expect(html).toContain("Webcam video");
		expect(html).toContain("Microphone audio");
		expect(html).toContain("No captions");
	});
});
