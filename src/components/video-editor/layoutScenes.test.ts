import { describe, expect, it } from "vitest";
import {
	getLayoutPresetTransform,
	LAYOUT_SCENE_CATEGORIES,
	resolveActiveLayoutRegion,
	resolveLayoutSceneAtTime,
} from "./layoutScenes";
import { DEFAULT_WEBCAM_OVERLAY, type LayoutRegion } from "./types";

const webcam = { ...DEFAULT_WEBCAM_OVERLAY, enabled: true, sourcePath: "webcam.mp4" };

describe("layoutScenes", () => {
	it("resolves preset layer transforms inside the stage", () => {
		const scene = getLayoutPresetTransform({
			preset: "side-by-side",
			stageWidth: 1920,
			stageHeight: 1080,
			webcam,
			hasWebcam: true,
		});

		expect(scene.screen.opacity).toBe(1);
		expect(scene.webcam.opacity).toBe(1);
		expect(scene.screen.width + scene.webcam.width).toBeLessThanOrEqual(1920);
	});

	it("groups layout presets into four main categories", () => {
		expect(LAYOUT_SCENE_CATEGORIES.map((category) => category.label)).toEqual([
			"Camera Bubble",
			"Side-by-side",
			"Camera Only",
			"Screen Only",
		]);
	});

	it("resolves camera-only circle and centered screen variants", () => {
		const cameraCircle = getLayoutPresetTransform({
			preset: "camera-circle",
			stageWidth: 1280,
			stageHeight: 720,
			webcam,
			hasWebcam: true,
		});
		const screenCenter = getLayoutPresetTransform({
			preset: "screen-center",
			stageWidth: 1280,
			stageHeight: 720,
			webcam,
			hasWebcam: true,
		});

		expect(cameraCircle.screen.opacity).toBe(0);
		expect(cameraCircle.webcam.width).toBe(cameraCircle.webcam.height);
		expect(screenCenter.webcam.opacity).toBe(0);
		expect(screenCenter.screen.width).toBeLessThan(1280);
	});

	it("falls back to screen-only when webcam is unavailable", () => {
		const scene = getLayoutPresetTransform({
			preset: "webcam-only",
			stageWidth: 1280,
			stageHeight: 720,
			webcam,
			hasWebcam: false,
		});

		expect(scene.preset).toBe("screen-only");
		expect(scene.screen.opacity).toBe(1);
		expect(scene.webcam.opacity).toBe(0);
	});

	it("finds the active layout region at boundaries", () => {
		const regions: LayoutRegion[] = [
			{
				id: "layout-1",
				startMs: 0,
				endMs: 1000,
				preset: "bubble",
				transitionMs: 600,
				easing: "smooth",
			},
			{
				id: "layout-2",
				startMs: 1000,
				endMs: 2000,
				preset: "presenter",
				transitionMs: 600,
				easing: "smooth",
			},
		];

		expect(resolveActiveLayoutRegion(999, regions)?.id).toBe("layout-1");
		expect(resolveActiveLayoutRegion(1000, regions)?.id).toBe("layout-2");
		expect(resolveActiveLayoutRegion(2000, regions)).toBeNull();
	});

	it("interpolates between neighbouring regions", () => {
		const regions: LayoutRegion[] = [
			{
				id: "layout-1",
				startMs: 0,
				endMs: 1000,
				preset: "bubble",
				transitionMs: 600,
				easing: "smooth",
			},
			{
				id: "layout-2",
				startMs: 1000,
				endMs: 2000,
				preset: "webcam-only",
				transitionMs: 600,
				easing: "smooth",
			},
		];

		const scene = resolveLayoutSceneAtTime({
			timeMs: 1200,
			layoutRegions: regions,
			stageWidth: 1280,
			stageHeight: 720,
			webcam,
			hasWebcam: true,
		});

		expect(scene).not.toBeNull();
		expect(scene!.webcam.width).toBeGreaterThan(1280 * 0.2);
		expect(scene!.webcam.width).toBeLessThan(1280);
	});

	it("eases the first region in from the default bubble layout", () => {
		const regions: LayoutRegion[] = [
			{
				id: "layout-1",
				startMs: 1000,
				endMs: 3000,
				preset: "webcam-only",
				transitionMs: 600,
				easing: "smooth",
			},
		];

		const scene = resolveLayoutSceneAtTime({
			timeMs: 1200,
			layoutRegions: regions,
			stageWidth: 1280,
			stageHeight: 720,
			webcam,
			hasWebcam: true,
		});

		expect(scene).not.toBeNull();
		expect(scene!.webcam.width).toBeGreaterThan(1280 * 0.2);
		expect(scene!.webcam.width).toBeLessThan(1280);
	});

	it("eases out to the default bubble layout after a region ends", () => {
		const regions: LayoutRegion[] = [
			{
				id: "layout-1",
				startMs: 0,
				endMs: 1000,
				preset: "webcam-only",
				transitionMs: 600,
				easing: "smooth",
			},
		];

		const scene = resolveLayoutSceneAtTime({
			timeMs: 1200,
			layoutRegions: regions,
			stageWidth: 1280,
			stageHeight: 720,
			webcam,
			hasWebcam: true,
		});

		expect(scene).not.toBeNull();
		expect(scene!.webcam.width).toBeGreaterThan(1280 * 0.2);
		expect(scene!.webcam.width).toBeLessThan(1280);
	});
});
