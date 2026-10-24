import { describe, expect, it } from "vitest";
import { executeNaturalLanguageAiCommand } from "./aiIntentParser";
import { createTimelineProject, placeAsset, registerMedia } from "./commands";
import type { MediaAsset, RecordingPackage, TimelineProject } from "./types";

function createTestProject(): TimelineProject {
	let project = createTimelineProject("proj-intent-test", "Intent Test Project");
	const pkg: RecordingPackage = {
		id: "package-1",
		schemaVersion: 1,
		captureId: "capture-1",
		width: 1920,
		height: 1080,
		durationUs: 10_000_000,
		screen: { path: "assets/pkg-1/screen.mp4", durationUs: 10_000_000, offsetUs: 0 },
		settings: {},
	};
	const asset: MediaAsset = {
		id: "asset-1",
		kind: "recording",
		name: "Screen Recording",
		durationUs: 10_000_000,
		width: 1920,
		height: 1080,
		packageId: "package-1",
	};
	project = {
		...project,
		packages: [pkg],
	};
	project = registerMedia(project, asset);
	project = placeAsset(project, "asset-1", "visual-1", 0, {
		clipId: "clip-1",
		compositionId: "comp-1",
	});
	return project;
}

describe("Natural Language AI Command Parser & Executor", () => {
	it("executes generative frame styling on visual style prompt", () => {
		const baseProject = createTestProject();
		const res = executeNaturalLanguageAiCommand(
			baseProject,
			"ubah gaya frame jadi cyberpunk neon magenta",
		);
		expect(res.success).toBe(true);
		expect(res.summary).toContain("Cyberpunk");

		const comp = res.project.compositions[0];
		expect(comp.settings?.windowAppearance?.borderWidth).toBeGreaterThanOrEqual(3);
		expect(comp.settings?.windowAppearance?.borderColor.toLowerCase()).toMatch(
			/#(?:ff007f|ec4899|ff0055)/i,
		);
		expect(comp.settings?.wallpaper).toContain("energy-19");
	});

	it("executes silence removal when silence/pause keywords are in prompt", () => {
		const baseProject = createTestProject();
		const transcripts = {
			"asset-1": {
				language: "en",
				segments: [
					{
						id: "seg-1",
						startUs: 0,
						endUs: 2_000_000,
						text: "Hello everyone",
						words: [
							{ word: "Hello", startUs: 0, endUs: 1_000_000 },
							{ word: "everyone", startUs: 1_000_000, endUs: 2_000_000 },
						],
					},
					// 2.0s to 5.0s is a 3.0s pause (> 800ms)
					{
						id: "seg-2",
						startUs: 5_000_000,
						endUs: 9_000_000,
						text: "Welcome back",
						words: [
							{ word: "Welcome", startUs: 5_000_000, endUs: 7_000_000 },
							{ word: "back", startUs: 7_000_000, endUs: 9_000_000 },
						],
					},
				],
			},
		};

		const res = executeNaturalLanguageAiCommand(baseProject, "buang jeda hening di video", {
			transcripts,
		});
		expect(res.success).toBe(true);
		expect(res.summary).toContain("silence");
		expect(res.diff.durationDeltaUs).toBeLessThan(0);
	});

	it("executes auto-zoom to clicks when zoom keywords are present", () => {
		const baseProject = createTestProject();
		const res = executeNaturalLanguageAiCommand(
			baseProject,
			"beri efek auto zoom pada setiap klik mouse",
			{
				clickTimestampsUs: [2_500_000, 7_000_000],
			},
		);
		expect(res.success).toBe(true);
		expect(res.summary).toContain("zoom");
		const clip = res.project.tracks[0].clips[0];
		expect(clip.keyframes?.length).toBeGreaterThanOrEqual(4);
	});

	it("executes compound instructions (styling + silence removal) seamlessly", () => {
		const baseProject = createTestProject();
		const transcripts = {
			"asset-1": {
				language: "en",
				segments: [
					{
						id: "s1",
						startUs: 0,
						endUs: 2_000_000,
						text: "Intro",
						words: [
							{ word: "Intro", startUs: 0, endUs: 2_000_000 },
						],
					},
					{
						id: "s2",
						startUs: 6_000_000,
						endUs: 9_000_000,
						text: "Content",
						words: [
							{ word: "Content", startUs: 6_000_000, endUs: 9_000_000 },
						],
					},
				],
			},
		};

		const res = executeNaturalLanguageAiCommand(
			baseProject,
			"potong jeda hening dan ubah tampilan frame jadi tema retro terminal hijau matrix",
			{ transcripts },
		);
		expect(res.success).toBe(true);
		expect(res.summary).toContain("Matrix");
		expect(res.summary).toContain("silence");

		const comp = res.project.compositions[0];
		expect(comp.settings?.windowAppearance?.borderColor.toLowerCase()).toMatch(
			/#(?:00ff66|22c55e|10b981)/i,
		);
		expect(res.diff.durationDeltaUs).toBeLessThan(0);
	});
});
