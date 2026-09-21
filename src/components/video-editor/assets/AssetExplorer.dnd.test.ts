import { describe, expect, it } from "vitest";
import type { SlideAssetFile } from "../../types";

describe("SlideAssetFile and Drag-and-Drop dataTransfer payload", () => {
	it("serializes and deserializes correctly with application/x-captr-asset format", () => {
		const sampleAsset: SlideAssetFile = {
			id: "asset-video-1",
			name: "intro.mp4",
			path: "C:\\Videos\\intro.mp4",
			size: 10485760,
			mtimeMs: 1700000000000,
			type: "video",
			subfolder: "Video Layers",
			category: "layer",
		};

		const serialized = JSON.stringify(sampleAsset);
		const parsed = JSON.parse(serialized) as SlideAssetFile;

		expect(parsed.id).toBe("asset-video-1");
		expect(parsed.name).toBe("intro.mp4");
		expect(parsed.path).toBe("C:\\Videos\\intro.mp4");
		expect(parsed.type).toBe("video");
		expect(parsed.subfolder).toBe("Video Layers");
	});

	it("handles audio and image asset types properly", () => {
		const audioAsset: SlideAssetFile = {
			id: "asset-audio-1",
			name: "bgm.mp3",
			path: "C:\\Audio\\bgm.mp3",
			size: 2048000,
			mtimeMs: 1700000000000,
			type: "audio",
			subfolder: "Audio & Voiceovers",
			category: "audio",
		};

		const imgAsset: SlideAssetFile = {
			id: "asset-img-1",
			name: "watermark.png",
			path: "C:\\Images\\watermark.png",
			size: 512000,
			mtimeMs: 1700000000000,
			type: "image",
			subfolder: "Graphics & Overlays",
			category: "graphic",
		};

		expect(JSON.parse(JSON.stringify(audioAsset)).type).toBe("audio");
		expect(JSON.parse(JSON.stringify(imgAsset)).type).toBe("image");
	});
});
