import { splitMediaLayer } from "./splitMediaLayer";
import { sampleAnnotationTransform } from "./annotationKeyframes";
import { describe, expect, it } from "vitest";
import { mediaLayerSourceTime, isMediaLayerActive } from "./mediaLayerTiming";
import { buildVideoLayerAudioRegions } from "./videoLayerAudio";
import { normalizeClipEntries, normalizeProjectEditor } from "./projectPersistence";
import { calculateEasingProgress } from "./keyframeInterpolation";

describe("multi-layer media contract", () => {
	it("seeks relative to placement, source trim and layer speed", () => {
		expect(
			mediaLayerSourceTime({ startMs: 2000, sourceOffsetMs: 500, playbackRate: 2 }, 3000),
		).toBe(2.5);
		expect(mediaLayerSourceTime({ startMs: 2000 }, 1000)).toBe(0);
	});
	it("uses exclusive end boundaries and respects hidden layers", () => {
		expect(isMediaLayerActive({ startMs: 0, endMs: 1000 }, 1000)).toBe(false);
		expect(isMediaLayerActive({ startMs: 0, endMs: 1000, visible: false }, 500)).toBe(false);
	});
	it("round trips video, GIF, trim, speed and custom easing", () => {
		const editor = normalizeProjectEditor({
			annotationRegions: [
				{
					id: "v",
					type: "video",
					startMs: 0,
					endMs: 3000,
					videoFilePath: "b.mp4",
					sourceOffsetMs: 500,
					playbackRate: 2,
					keyframes: [
						{
							id: "k",
							timeMs: 0,
							property: "opacity",
							value: 0,
							easing: "cubic-bezier",
							bezier: [0.1, 0.2, 0.8, 1],
						},
					],
				},
				{ id: "g", type: "gif", gifPath: "g.gif" },
			] as any,
		});
		const result = normalizeProjectEditor(JSON.parse(JSON.stringify(editor)));
		expect(result.annotationRegions[0]).toMatchObject({
			type: "video",
			sourceOffsetMs: 500,
			playbackRate: 2,
			keyframes: [{ bezier: [0.1, 0.2, 0.8, 1] }],
		});
		expect(result.annotationRegions[1].type).toBe("gif");
		const audio = buildVideoLayerAudioRegions(result.annotationRegions);
		expect(audio).toHaveLength(1);
		expect(audio[0]).toMatchObject({
			audioPath: "b.mp4",
			playbackRate: 2,
			sourceOffsetMs: 500,
		});
		expect(
			buildVideoLayerAudioRegions([{ ...result.annotationRegions[0], muted: true }]),
		).toEqual([]);
	});
	it("migrates legacy scene media layers into editable annotations", () => {
		const [scene] = normalizeClipEntries([
			{
				id: "scene",
				videoPath: "main.mp4",
				mediaTrackLayers: [
					{
						id: "v",
						type: "video",
						sourcePath: "b.mp4",
						startMs: 0,
						endMs: 1000,
						transform: { x: 10, y: 20, width: 50, height: 50 },
						opacity: 0.5,
						zIndex: 2,
					},
				],
			},
		]);
		expect(scene.annotationRegions?.[0]).toMatchObject({
			type: "video",
			videoFilePath: "b.mp4",
			position: { x: 10, y: 20 },
			style: { opacity: 0.5 },
		});
		expect(
			normalizeClipEntries(JSON.parse(JSON.stringify([scene])))[0].annotationRegions,
		).toEqual(scene.annotationRegions);
	});
	it("solves custom Bezier x before sampling y", () => {
		expect(calculateEasingProgress(0.5, "cubic-bezier", [0, 0, 1, 1])).toBeCloseTo(0.5);
		expect(calculateEasingProgress(0.5, "cubic-bezier", [0.1, 0.8, 0.2, 1])).toBeGreaterThan(
			0.8,
		);
	});
});

it("splits a sped-up layer without restarting media or its easing curve", () => {
	const layer = normalizeProjectEditor({
		annotationRegions: [
			{
				id: "v",
				type: "video",
				startMs: 1000,
				endMs: 5000,
				sourceOffsetMs: 300,
				playbackRate: 2,
				keyframes: [
					{ id: "a", property: "opacity", timeMs: 0, value: 0, easing: "ease-in" },
					{ id: "b", property: "opacity", timeMs: 4000, value: 1, easing: "linear" },
				],
			},
		] as any,
	}).annotationRegions[0];
	const [left, right] = splitMediaLayer(layer, 2500, "right");
	expect(left.endMs).toBe(2500);
	expect(mediaLayerSourceTime(right, 3000)).toBe(mediaLayerSourceTime(layer, 3000));
	expect(sampleAnnotationTransform(right, 3000)).toEqual(sampleAnnotationTransform(layer, 3000));
	expect(splitMediaLayer({ ...layer, locked: true }, 2500, "right")).toHaveLength(1);
});
