import { describe, expect, it } from "vitest";
import { createTimelineProject } from "./commands";
import {
	type BRollRenderResult,
	type BRollSpec,
	injectBRollClipsIntoProject,
	validateBRollSpecs,
} from "./brollTypes";

describe("brollTypes", () => {
	it("validates and normalizes raw BRoll spec array", () => {
		const raw = [
			{
				id: "broll-1",
				timelineStartUs: 5_000_000,
				durationUs: 3_000_000,
				type: "kinetic_typography",
				title: "Core Feature",
				subtitle: "Fast & Reliable",
			},
			{
				// Missing title, should be ignored
				id: "broll-invalid",
				timelineStartUs: 1_000_000,
			},
		];

		const validated = validateBRollSpecs(raw);
		expect(validated).toHaveLength(1);
		expect(validated[0].id).toBe("broll-1");
		expect(validated[0].title).toBe("Core Feature");
		expect(validated[0].type).toBe("kinetic_typography");
		expect(validated[0].timelineStartUs).toBe(5_000_000);
	});

	it("injects rendered B-Roll assets and clips into timeline project", () => {
		const baseProject = createTimelineProject("test-p", "Test Project");
		expect(baseProject.tracks).toHaveLength(2); // Default visual + audio tracks

		const renderResults: BRollRenderResult[] = [
			{
				specId: "broll-1",
				assetId: "asset-broll-1",
				name: "Hyperframe: Core Feature",
				relativePath: "assets/asset-broll-1/source.mp4",
				absolutePath: "C:/fake/assets/asset-broll-1/source.mp4",
				timelineStartUs: 4_000_000,
				durationUs: 3_000_000,
				width: 1920,
				height: 1080,
				success: true,
			},
		];

		const updated = injectBRollClipsIntoProject(baseProject, renderResults);

		// Verified asset was added
		expect(updated.assets.some((a) => a.id === "asset-broll-1")).toBe(true);

		// Verified B-Roll track was created
		const brollTrack = updated.tracks.find((t) =>
			t.name.toLowerCase().includes("b-roll"),
		);
		expect(brollTrack).toBeDefined();
		expect(brollTrack?.clips).toHaveLength(1);
		expect(brollTrack?.clips[0].assetId).toBe("asset-broll-1");
		expect(brollTrack?.clips[0].startUs).toBe(4_000_000);
		expect(brollTrack?.clips[0].gain).toBe(0); // Audio muted for overlay
	});
});
