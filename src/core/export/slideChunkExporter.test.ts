import { describe, expect, it } from "vitest";
import { createDefaultMotionMeta } from "@/slides/motion/schema";
import { createDefaultRecordMeta } from "@/slides/record/schema";
import { createDefaultVideoMeta } from "@/slides/video/schema";
import { slideRegistry } from "../slides/registry";
import type { SlideData, SlideModule } from "../slides/types";
import { exportSlideChunk, isWebCodecsSupported } from "./slideChunkExporter";

describe("slideChunkExporter", () => {
	it("detects WebCodecs availability cleanly", () => {
		const supported = isWebCodecsSupported();
		expect(typeof supported).toBe("boolean");
	});

	it("delegates to module.exportChunk when defined", async () => {
		const customModule: SlideModule<"keyframe"> = {
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

		const slide: SlideData<"keyframe"> = {
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
		const slide: SlideData<"record"> = {
			id: "s2",
			type: "record",
			title: "Recording",
			durationMs: 12000,
			order: 0,
			meta: { ...createDefaultRecordMeta(), videoPath: "C:/recordings/screen.mp4" },
		};

		const result = await exportSlideChunk({
			slide,
			canvas: { width: 1920, height: 1080, fps: 60 },
		});

		expect(result.filePath).toBe("C:/recordings/screen.mp4");
		expect(result.durationSec).toBe(12);
	});

	it("fails loudly when a module returns an empty chunk path", async () => {
		const brokenModule: SlideModule<"motion"> = {
			type: "motion",
			displayName: "Motion",
			description: "",
			icon: () => null,
			WorkspaceComponent: () => null,
			createDefaultMeta: createDefaultMotionMeta,
			exportChunk: async () => ({ filePath: "", durationSec: 5 }),
		};

		slideRegistry.register(brokenModule);

		const slide: SlideData<"motion"> = {
			id: "m1",
			type: "motion",
			title: "Motion Slide",
			durationMs: 5000,
			order: 0,
			meta: createDefaultMotionMeta(),
		};

		await expect(
			exportSlideChunk({
				slide,
				canvas: { width: 1920, height: 1080, fps: 30 },
			}),
		).rejects.toThrow(/exportChunk tidak mengembalikan filePath/);
	});

	it("fails loudly when the slide has no media to fall back to", async () => {
		const slide: SlideData<"video"> = {
			id: "m2",
			type: "video",
			title: "Empty Video Slide",
			durationMs: 3000,
			order: 0,
			meta: { ...createDefaultVideoMeta(), videoTracks: [] },
		};

		await expect(
			exportSlideChunk({
				slide,
				canvas: { width: 1920, height: 1080, fps: 30 },
			}),
		).rejects.toThrow(/tidak memiliki berkas media/);
	});

	it("falls back to video track clip for video slides", async () => {
		const slide: SlideData<"video"> = {
			id: "s3",
			type: "video",
			title: "Video NLE",
			durationMs: 8500,
			order: 1,
			meta: {
				...createDefaultVideoMeta(),
				videoTracks: createDefaultVideoMeta().videoTracks.map((track, index) =>
					index === 0
						? {
								...track,
								clips: [
									{
										id: "clip-1",
										title: "B-roll",
										sourcePath: "D:/media/b-roll.mp4",
										startOffsetMs: 0,
										durationMs: 8500,
										speedMultiplier: 1,
										volume: 1,
									},
								],
							}
						: track,
				),
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
