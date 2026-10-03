import { describe, expect, it } from "vitest";
import { sampleClipTransform } from "./clipTransform";
import {
	addClipKeyframe,
	addTextOverlay,
	createTimelineProject,
	removeClipKeyframe,
	updateClipKeyframe,
} from "./commands";
import { evaluateProject } from "./evaluation";
import type { PropertyKeyframe, TimelineClip } from "./types";
import { validateTimelineProject } from "./validation";

describe("Timeline Clip Keyframing Engine", () => {
	it("validates timeline clip keyframes correctly and rejects invalid formats", () => {
		const project = addTextOverlay(createTimelineProject("proj", "Title"), 0, {
			assetId: "a1",
			trackId: "t1",
			clipId: "c1",
		});

		const validKeyframe: PropertyKeyframe = {
			id: "kf1",
			timeMs: 500,
			property: "scale",
			value: 1.5,
			easing: "ease-in-out",
		};

		const withKf = addClipKeyframe(project, "c1", validKeyframe);
		expect(() => validateTimelineProject(withKf)).not.toThrow();

		const invalidKfProject = structuredClone(withKf);
		const clip = invalidKfProject.tracks.flatMap((t) => t.clips).find((c) => c.id === "c1")!;
		// Corrupt keyframe property
		(clip.keyframes![0] as any).property = "unsupported-prop";
		expect(() => validateTimelineProject(invalidKfProject)).toThrow(
			/Invalid clip keyframe format/i,
		);
	});

	it("adds, updates, and removes keyframes in chronological order", () => {
		let project = addTextOverlay(createTimelineProject("proj", "Title"), 0, {
			assetId: "a1",
			trackId: "t1",
			clipId: "c1",
		});

		project = addClipKeyframe(project, "c1", {
			id: "kf2",
			timeMs: 2000,
			property: "opacity",
			value: 0.2,
			easing: "linear",
		});

		project = addClipKeyframe(project, "c1", {
			id: "kf1",
			timeMs: 1000,
			property: "opacity",
			value: 0.8,
			easing: "linear",
		});

		let clip = project.tracks.flatMap((t) => t.clips).find((c) => c.id === "c1")!;
		expect(clip.keyframes).toHaveLength(2);
		expect(clip.keyframes![0].id).toBe("kf1");
		expect(clip.keyframes![1].id).toBe("kf2");

		// Update keyframe
		project = updateClipKeyframe(project, "c1", "kf1", { value: 0.9 });
		clip = project.tracks.flatMap((t) => t.clips).find((c) => c.id === "c1")!;
		expect(clip.keyframes![0].value).toBe(0.9);

		// Remove keyframe
		project = removeClipKeyframe(project, "c1", "kf2");
		clip = project.tracks.flatMap((t) => t.clips).find((c) => c.id === "c1")!;
		expect(clip.keyframes).toHaveLength(1);
		expect(clip.keyframes![0].id).toBe("kf1");
	});

	it("interpolates position, scale, rotation, and opacity at intermediate times", () => {
		const baseClip: TimelineClip = {
			id: "c1",
			assetId: "a1",
			startUs: 0,
			sourceInUs: 0,
			sourceOutUs: 5_000_000,
			rate: 1,
			transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
			gain: 1,
			enabled: true,
			keyframes: [
				{
					id: "pos1",
					timeMs: 0,
					property: "position",
					value: { x: 0, y: 0 },
					easing: "linear",
				},
				{
					id: "pos2",
					timeMs: 2000,
					property: "position",
					value: { x: 200, y: 100 },
					easing: "linear",
				},
				{
					id: "scale1",
					timeMs: 0,
					property: "scale",
					value: 1,
					easing: "linear",
				},
				{
					id: "scale2",
					timeMs: 2000,
					property: "scale",
					value: 2,
					easing: "linear",
				},
				{
					id: "op1",
					timeMs: 0,
					property: "opacity",
					value: 0.2,
					easing: "linear",
				},
				{
					id: "op2",
					timeMs: 2000,
					property: "opacity",
					value: 1,
					easing: "linear",
				},
			],
		};

		// At start (0s)
		const start = sampleClipTransform(baseClip, 0);
		expect(start.x).toBe(0);
		expect(start.y).toBe(0);
		expect(start.scale).toBe(1);
		expect(start.opacity).toBeCloseTo(0.2);

		// At midpoint (1s = 1,000,000us)
		const mid = sampleClipTransform(baseClip, 1_000_000);
		expect(mid.x).toBeCloseTo(100);
		expect(mid.y).toBeCloseTo(50);
		expect(mid.scale).toBeCloseTo(1.5);
		expect(mid.opacity).toBeCloseTo(0.6);

		// At endpoint (2s = 2,000,000us)
		const end = sampleClipTransform(baseClip, 2_000_000);
		expect(end.x).toBe(200);
		expect(end.y).toBe(100);
		expect(end.scale).toBe(2);
		expect(end.opacity).toBe(1);
	});

	it("evaluateProject attaches sampled keyframe transform to visuals", () => {
		let project = addTextOverlay(
			createTimelineProject("eval-proj", "Eval"),
			1_000_000, // Starts at 1s
			{ assetId: "text-asset", trackId: "text-track", clipId: "text-clip" },
		);

		project = addClipKeyframe(project, "text-clip", {
			id: "kf1",
			timeMs: 0,
			property: "scale",
			value: 1,
			easing: "linear",
		});
		project = addClipKeyframe(project, "text-clip", {
			id: "kf2",
			timeMs: 2000,
			property: "scale",
			value: 3,
			easing: "linear",
		});

		// At 2s (1s into the clip)
		const evaluation = evaluateProject(project, 2_000_000);
		expect(evaluation.visuals).toHaveLength(1);
		const visual = evaluation.visuals[0];
		expect(visual.transform.scale).toBeCloseTo(2);
	});
});
