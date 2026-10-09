import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TimelineProject } from "@/core/timeline/types";
import { CanvasTransformGizmo } from "./CanvasTransformGizmo";
import {
	calculateResizeScale,
	calculateRotationAngle,
	getActiveVisualClipsBounds,
	hitTestCanvasPoint,
} from "./canvasGizmoMath";

describe("CanvasTransformGizmo", () => {
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
						transform: { x: 50, y: -20, scale: 1.2, rotation: 15, opacity: 1 },
						gain: 1,
						enabled: true,
					},
				],
			},
		],
	};

	it("renders gizmo layer when active", () => {
		const html = renderToStaticMarkup(
			createElement(CanvasTransformGizmo, {
				project: mockProject,
				timeUs: 1_000_000,
			}),
		);
		expect(html).toContain("canvas-transform-gizmo-layer");
	});

	it("returns empty markup when disabled is true", () => {
		const html = renderToStaticMarkup(
			createElement(CanvasTransformGizmo, {
				project: mockProject,
				timeUs: 1_000_000,
				disabled: true,
			}),
		);
		expect(html).toBe("");
	});

	it("renders bounding box and resize handles when clip is selected", () => {
		const html = renderToStaticMarkup(
			createElement(CanvasTransformGizmo, {
				project: mockProject,
				timeUs: 1_000_000,
				selectedClipId: "clip_text",
			}),
		);
		expect(html).toContain("cursor-move");
		expect(html).toContain("Drag to rotate");
		expect(html).toContain("cursor-nwse-resize");
	});

	it("correctly identifies active bounds and hit tests canvas coordinates", () => {
		const bounds = getActiveVisualClipsBounds(mockProject, 1_000_000);
		expect(bounds).toHaveLength(1);
		expect(bounds[0]!.clipId).toBe("clip_text");
		expect(bounds[0]!.centerX).toBe(1920 / 2 + 50);
		expect(bounds[0]!.centerY).toBe(1080 / 2 - 20);

		// Hit test on the center of the text clip
		const hit = hitTestCanvasPoint(bounds, 1920 / 2 + 50, 1080 / 2 - 20);
		expect(hit).not.toBeNull();
		expect(hit?.clipId).toBe("clip_text");

		// Miss test far outside
		const miss = hitTestCanvasPoint(bounds, 100, 100);
		expect(miss).toBeNull();
	});

	it("calculates resize scale and rotation angles accurately", () => {
		const scale = calculateResizeScale(1.0, 200, 100, "se", 20, 10);
		expect(scale).toBeGreaterThan(1.0);

		const angle = calculateRotationAngle(100, 100, 150, 100);
		expect(angle).toBeDefined();
	});
});
