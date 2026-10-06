import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TimelineProject } from "@/core/timeline/types";
import { CanvasTransformGizmo } from "./CanvasTransformGizmo";

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
						transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
						gain: 1,
						enabled: true,
					},
				],
			},
		],
	};

	it("renders nothing if disabled or canvasElement is missing", () => {
		const html = renderToStaticMarkup(
			createElement(CanvasTransformGizmo, {
				project: mockProject,
				timeUs: 1_000_000,
				canvasElement: null,
			}),
		);
		expect(html).toBe("");
	});

	it("renders gizmo structure cleanly when disabled is true", () => {
		const canvas = {
			getBoundingClientRect: () => ({
				width: 960,
				height: 540,
				top: 0,
				left: 0,
			}),
		} as unknown as HTMLCanvasElement;

		const html = renderToStaticMarkup(
			createElement(CanvasTransformGizmo, {
				project: mockProject,
				timeUs: 1_000_000,
				canvasElement: canvas,
				disabled: true,
			}),
		);
		expect(html).toBe("");
	});
});
