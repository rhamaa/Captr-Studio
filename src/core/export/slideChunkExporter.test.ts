import { describe, expect, it } from "vitest";
import { slideRegistry } from "../slides/registry";
import type { SlideData, SlideModule } from "../slides/types";
import { exportSlideChunk, isWebCodecsSupported } from "./slideChunkExporter";

describe("slideChunkExporter", () => {
	it("detects WebCodecs availability cleanly", () => {
		const supported = isWebCodecsSupported();
		expect(typeof supported).toBe("boolean");
	});

	it("delegates to module.exportChunk when defined", async () => {
		const customModule: SlideModule = {
			type: "keyframe",
			displayName: "Keyframe",
			description: "",
			icon: () => null,
			WorkspaceComponent: () => null,
			createDefaultMeta: () => ({}),
			exportChunk: async (slide, options) => {
				options.onProgress?.(100);
				return {
					filePath: `/tmp/custom_${slide.id}.mp4`,
					durationSec: 5,
				};
			},
		};

		slideRegistry.register(customModule);

		const slide: SlideData = {
			id: "s1",
			type: "keyframe",
			title: "Custom Keyframe",
			durationMs: 5000,
			order: 0,
			meta: {},
		};

		let progressCalled = false;
		const result = await exportSlideChunk({
			slide,
			canvas: { width: 1920, height: 1080, fps: 30 },
			onProgress: (p) => {
				if (p === 100) progressCalled = true;
			},
		});

		expect(result.filePath).toBe("/tmp/custom_s1.mp4");
		expect(result.durationSec).toBe(5);
		expect(progressCalled).toBe(true);
	});

	it("falls back to slide.meta.videoPath if exportChunk is not defined", async () => {
		const slide: SlideData = {
			id: "s2",
			type: "record",
			title: "Recording",
			durationMs: 12000,
			order: 0,
			meta: {
				videoPath: "C:/recordings/screen.mp4",
			},
		};

		const result = await exportSlideChunk({
			slide,
			canvas: { width: 1920, height: 1080, fps: 60 },
		});

		expect(result.filePath).toBe("C:/recordings/screen.mp4");
		expect(result.durationSec).toBe(12);
	});

	it("falls back to video track clip for video slides", async () => {
		const slide: SlideData = {
			id: "s3",
			type: "video",
			title: "Video NLE",
			durationMs: 8500,
			order: 1,
			meta: {
				videoTracks: [
					{
						id: "track-1",
						clips: [
							{
								id: "clip-1",
								sourcePath: "D:/media/b-roll.mp4",
							},
						],
					},
				],
			},
		};

		const result = await exportSlideChunk({
			slide,
			canvas: { width: 1920, height: 1080, fps: 30 },
		});

		expect(result.filePath).toBe("D:/media/b-roll.mp4");
		expect(result.durationSec).toBe(8.5);
	});
});
