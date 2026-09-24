import { describe, expect, it, vi } from "vitest";
import type { ProjectV2Data } from "../slides/types";
import { exportMultiSlideProject } from "./multiSlideExporter";

describe("multiSlideExporter", () => {
	it("returns error if project has no slides", async () => {
		const emptyProject: ProjectV2Data = {
			version: 2,
			projectId: "p-empty",
			title: "Empty Project",
			canvas: { width: 1920, height: 1080, fps: 30 },
			slides: [],
			transitions: [],
			globalAudioTracks: [],
		};

		const result = await exportMultiSlideProject({
			project: emptyProject,
			outputPath: "output.mp4",
		});

		expect(result.success).toBe(false);
		expect(result.error).toMatch(/tidak memiliki slide/);
	});

	it("returns error if electronAPI.stitchProjectSlides is missing", async () => {
		const project: ProjectV2Data = {
			version: 2,
			projectId: "p1",
			title: "Test Project",
			canvas: { width: 1920, height: 1080, fps: 30 },
			slides: [
				{
					id: "s1",
					type: "record",
					title: "Slide 1",
					durationMs: 4000,
					order: 0,
					meta: { videoPath: "/path/to/v1.mp4" },
				},
			],
			transitions: [],
			globalAudioTracks: [],
		};

		// Ensure electronAPI is undefined
		const originalElectronAPI = (globalThis as any).window?.electronAPI;
		if (typeof window !== "undefined") {
			(window as any).electronAPI = undefined;
		}

		const result = await exportMultiSlideProject({
			project,
			outputPath: "out.mp4",
		});

		expect(result.success).toBe(false);
		expect(result.error).toMatch(/stitchProjectSlides tidak tersedia/);

		// Restore
		if (typeof window !== "undefined") {
			(window as any).electronAPI = originalElectronAPI;
		}
	});

	it("successfully coordinates slide chunks and calls stitcher IPC", async () => {
		const stitchMock = vi.fn().mockResolvedValue({
			success: true,
			outputPath: "/final/output.mp4",
		});

		if (typeof window === "undefined") {
			(globalThis as any).window = {};
		}
		(window as any).electronAPI = {
			stitchProjectSlides: stitchMock,
		};

		const project: ProjectV2Data = {
			version: 2,
			projectId: "p-full",
			title: "Multi Slide Demo",
			canvas: { width: 1920, height: 1080, fps: 30 },
			slides: [
				{
					id: "slide-1",
					type: "record",
					title: "Record Intro",
					durationMs: 5000,
					order: 0,
					meta: { videoPath: "/media/slide1.mp4" },
				},
				{
					id: "slide-2",
					type: "video",
					title: "Video NLE Main",
					durationMs: 6000,
					order: 1,
					meta: {
						videoTracks: [
							{
								id: "v1",
								clips: [{ id: "c1", sourcePath: "/media/slide2.mp4" }],
							},
						],
					},
				},
			],
			transitions: [
				{
					id: "t1",
					fromSlideId: "slide-1",
					toSlideId: "slide-2",
					type: "crossfade",
					durationMs: 500,
				},
			],
			globalAudioTracks: [
				{
					id: "bgm-1",
					name: "Background Track",
					path: "/audio/bgm.mp3",
					volume: 0.4,
					startMsOffset: 0,
				},
			],
		};

		const progressUpdates: any[] = [];
		const result = await exportMultiSlideProject({
			project,
			outputPath: "/final/output.mp4",
			onProgress: (u) => progressUpdates.push(u),
		});

		expect(result.success).toBe(true);
		expect(result.outputPath).toBe("/final/output.mp4");
		expect(stitchMock).toHaveBeenCalledTimes(1);

		const stitchCallArgs = stitchMock.mock.calls[0][0];
		expect(stitchCallArgs.slides.length).toBe(2);
		expect(stitchCallArgs.slides[0].filePath).toBe("/media/slide1.mp4");
		expect(stitchCallArgs.slides[1].filePath).toBe("/media/slide2.mp4");
		expect(stitchCallArgs.transitions.length).toBe(1);
		expect(stitchCallArgs.transitions[0].type).toBe("crossfade");
		expect(stitchCallArgs.globalAudio?.path).toBe("/audio/bgm.mp3");

		// Verify progress states reached
		const stages = progressUpdates.map((p) => p.stage);
		expect(stages).toContain("rendering-slide");
		expect(stages).toContain("stitching");
		expect(stages).toContain("completed");
	});
});
