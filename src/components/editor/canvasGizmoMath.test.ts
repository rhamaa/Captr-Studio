import { describe, expect, it } from "vitest";
import type { TimelineProject } from "@/core/timeline/types";
import {
	calculateResizeScale,
	calculateRotationAngle,
	getActiveVisualClipsBounds,
	getClipBaseDimensions,
	hitTestCanvasPoint,
} from "./canvasGizmoMath";

describe("canvasGizmoMath", () => {
	const mockProject: TimelineProject = {
		id: "proj_1",
		title: "Test",
		canvas: { width: 1920, height: 1080, background: "#000000", fps: 60 },
		assets: [
			{
				id: "asset_text",
				kind: "text",
				name: "Header",
				durationUs: 5_000_000,
				width: 1920,
				height: 1080,
				text: {
					content: "Hello World",
					fontFamily: "Arial",
					fontSizePx: 80,
					fontWeight: 700,
					color: "#ffffff",
					align: "center",
				},
			},
			{
				id: "asset_shape",
				kind: "shape",
				name: "Box",
				durationUs: 5_000_000,
				width: 1920,
				height: 1080,
				shapeDefinition: {
					kind: "rectangle",
					width: 400,
					height: 300,
					radius: 8,
					style: { stroke: { color: "#fff", width: 2 } },
				},
			},
		],
		packages: [],
		compositions: [],
		tracks: [
			{
				id: "track_1",
				name: "Text Track",
				kind: "visual",
				locked: false,
				muted: false,
				hidden: false,
				clips: [
					{
						id: "clip_text",
						assetId: "asset_text",
						startUs: 0,
						sourceInUs: 0,
						sourceOutUs: 5_000_000,
						rate: 1,
						transform: { x: 50, y: -100, scale: 1.2, rotation: 0, opacity: 1 },
						gain: 1,
						enabled: true,
					},
					{
						id: "clip_shape",
						assetId: "asset_shape",
						startUs: 0,
						sourceInUs: 0,
						sourceOutUs: 5_000_000,
						rate: 1,
						transform: { x: 0, y: 0, scale: 1, rotation: 45, opacity: 1 },
						gain: 1,
						enabled: true,
					},
				],
			},
		],
	};

	it("computes base dimensions correctly for text and shape assets", () => {
		const textClip = mockProject.tracks[0]!.clips[0]!;
		const textAsset = mockProject.assets[0]!;
		const textDims = getClipBaseDimensions(textClip, textAsset, 1920, 1080);
		expect(textDims.width).toBeGreaterThan(100);
		expect(textDims.height).toBeGreaterThan(50);

		const shapeClip = mockProject.tracks[0]!.clips[1]!;
		const shapeAsset = mockProject.assets[1]!;
		const shapeDims = getClipBaseDimensions(shapeClip, shapeAsset, 1920, 1080);
		expect(shapeDims.width).toBe(400);
		expect(shapeDims.height).toBe(300);
	});

	it("returns active visual bounds at a given playhead time", () => {
		const bounds = getActiveVisualClipsBounds(mockProject, 1_000_000);
		expect(bounds).toHaveLength(2);

		const textBound = bounds.find((b) => b.clipId === "clip_text");
		expect(textBound).toBeDefined();
		// Center = 1920 / 2 + 50 = 1010, CenterY = 1080 / 2 - 100 = 440
		expect(textBound!.centerX).toBe(1010);
		expect(textBound!.centerY).toBe(440);
		expect(textBound!.scale).toBe(1.2);
	});

	it("performs hit testing on canvas points", () => {
		const bounds = getActiveVisualClipsBounds(mockProject, 1_000_000);

		// Shape is centered at (960, 540)
		const hitShape = hitTestCanvasPoint(bounds, 960, 540);
		expect(hitShape?.clipId).toBe("clip_shape");

		// Far away point hits nothing
		const hitNone = hitTestCanvasPoint(bounds, 10, 10);
		expect(hitNone).toBeNull();
	});

	it("calculates scale changes from resize handles", () => {
		const newScale = calculateResizeScale(1.0, 200, 200, "se", 50, 50);
		expect(newScale).toBeGreaterThan(1.0);

		const smallerScale = calculateResizeScale(1.0, 200, 200, "se", -50, -50);
		expect(smallerScale).toBeLessThan(1.0);
	});

	it("calculates rotation angles from handle pointer coords", () => {
		// Point directly to the right (east)
		const angleEast = calculateRotationAngle(100, 100, 200, 100);
		expect(angleEast).toBe(90);

		// Point directly above (north)
		const angleNorth = calculateRotationAngle(100, 100, 100, 50);
		expect(angleNorth).toBe(0);
	});
});
