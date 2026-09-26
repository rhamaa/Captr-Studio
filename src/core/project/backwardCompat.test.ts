import { describe, expect, it } from "vitest";
import type { LegacyEditorProjectData } from "@/components/video-editor/projectPersistence";
import { createDefaultMotionMeta } from "@/slides/motion/schema";
import { isProjectV2, migrateV1ProjectToV2 } from "./backwardCompat";

describe("backwardCompat", () => {
	it("detects whether project is V2 format", () => {
		expect(isProjectV2(null)).toBe(false);
		expect(isProjectV2({})).toBe(false);
		expect(
			isProjectV2({
				version: 1,
				videoPath: "test.mp4",
				editor: {},
			}),
		).toBe(false);

		expect(
			isProjectV2({
				version: 2,
				projectId: "test-id",
				title: "V2 Project",
				canvas: { width: 1920, height: 1080, fps: 60 },
				slides: [],
				transitions: [],
				globalAudioTracks: [],
			}),
		).toBe(true);
	});

	it("migrates a monolithic single-video V1 project to V2", () => {
		const v1: LegacyEditorProjectData = {
			version: 1,
			projectId: "legacy-proj-1",
			videoPath: "C:/recordings/screen.mp4",
			editor: {
				wallpaper: "gradient-blue",
				mp4FrameRate: 60,
				aspectRatio: "16:9",
				zoomRegions: [
					{
						id: "z1",
						startMs: 1000,
						endMs: 3000,
						depth: 2,
						focus: { x: 0.5, y: 0.5 },
					},
				],
			},
		};

		const v2 = migrateV1ProjectToV2(v1);
		expect(v2.version).toBe(2);
		expect(v2.projectId).toBe("legacy-proj-1");
		expect(v2.slides.length).toBe(1);
		expect(v2.slides[0].type).toBe("record");
		const migratedSlide = v2.slides[0];
		if (migratedSlide.type !== "record") throw new Error("Expected a Record slide");
		expect(migratedSlide.meta.videoPath).toBe("C:/recordings/screen.mp4");
		expect(migratedSlide.meta.zoomRegions.length).toBe(1);
		expect(v2.canvas.fps).toBe(60);
	});

	it("migrates a multi-clip V1 project to V2 slides with transitions", () => {
		const v1: LegacyEditorProjectData = {
			version: 1,
			projectId: "multi-clip-proj",
			videoPath: "C:/recordings/screen.mp4",
			clips: [
				{
					id: "clip-1",
					slideMode: "record",
					videoPath: "C:/recordings/screen.mp4",
					startMsOffset: 0,
					durationMs: 5000,
					label: "Screen Demo",
				},
				{
					id: "clip-2",
					slideMode: "video",
					videoPath: "C:/recordings/broll.mp4",
					startMsOffset: 5000,
					durationMs: 4000,
					label: "Feature B-Roll",
					transitionIn: {
						type: "crossfade",
						durationMs: 600,
					},
				},
			],
			editor: {
				mp4FrameRate: 30,
			},
		};

		const v2 = migrateV1ProjectToV2(v1);
		expect(v2.version).toBe(2);
		expect(v2.slides.length).toBe(2);
		expect(v2.slides[0].type).toBe("record");
		expect(v2.slides[0].title).toBe("Screen Demo");
		expect(v2.slides[1].type).toBe("video");
		expect(v2.slides[1].title).toBe("Feature B-Roll");
		expect(v2.transitions.length).toBe(1);
		expect(v2.transitions[0].type).toBe("crossfade");
		expect(v2.transitions[0].durationMs).toBe(600);
	});

	it("preserves Motion slides and their metadata when migrating V1 clips", () => {
		const motionMeta = {
			...createDefaultMotionMeta(),
			document: "<!doctype html><html><body>Legacy Motion</body></html>",
			html: "<main>Legacy Motion</main>",
			css: "main { color: rebeccapurple; }",
			js: "window.setSeekTime = () => {};",
			durationMs: 2400,
			backgroundColor: "#120a24",
		};
		const v1: LegacyEditorProjectData = {
			version: 1,
			projectId: "motion-legacy-project",
			videoPath: "",
			clips: [
				{
					id: "motion-intro",
					origin: "uploaded",
					slideMode: "motion",
					videoPath: "",
					startMsOffset: 0,
					durationMs: 2400,
					label: "Animated Intro",
					motionMeta,
				},
				{
					id: "motion-outro",
					slideMode: "motion",
					videoPath: "",
					startMsOffset: 2400,
					durationMs: 3000,
					label: "Animated Outro",
					transitionIn: { type: "fade-black", durationMs: 450 },
				},
			],
			editor: {},
		};

		const v2 = migrateV1ProjectToV2(v1);

		expect(v2.slides).toHaveLength(2);
		expect(v2.slides[0]).toMatchObject({
			id: "motion-intro",
			type: "motion",
			title: "Animated Intro",
			durationMs: 2400,
			dirName: "slide_01_motion",
			meta: motionMeta,
		});
		expect(v2.slides[1]).toMatchObject({
			id: "motion-outro",
			type: "motion",
			durationMs: 3000,
			meta: createDefaultMotionMeta(),
		});
		expect(v2.transitions).toEqual([
			{
				id: "trans-motion-intro-motion-outro",
				fromSlideId: "motion-intro",
				toSlideId: "motion-outro",
				type: "fade-black",
				durationMs: 450,
			},
		]);
	});
});
