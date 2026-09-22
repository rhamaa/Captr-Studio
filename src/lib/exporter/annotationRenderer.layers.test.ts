import { expect, it, vi } from "vitest";
import { normalizeProjectEditor } from "@/components/video-editor/projectPersistence";
import { renderAnnotations } from "./annotationRenderer";

it("composites independent source times in z-order and samples animated opacity", async () => {
	const layers = normalizeProjectEditor({
		annotationRegions: [
			{
				id: "top",
				type: "video",
				startMs: 1000,
				endMs: 4000,
				videoFilePath: "top.mp4",
				sourceOffsetMs: 500,
				playbackRate: 2,
				zIndex: 2,
				position: { x: 25, y: 25 },
				size: { width: 50, height: 50 },
				keyframes: [
					{ id: "a", timeMs: 0, property: "opacity", value: 0, easing: "linear" },
					{ id: "b", timeMs: 2000, property: "opacity", value: 1, easing: "linear" },
				],
			},
			{
				id: "bottom",
				type: "video",
				startMs: 0,
				endMs: 4000,
				videoFilePath: "bottom.mp4",
				zIndex: 1,
			},
			{ id: "hidden", type: "video", startMs: 0, endMs: 4000, visible: false },
		] as any,
	}).annotationRegions;
	const bottom = { videoWidth: 100, videoHeight: 100 },
		top = { videoWidth: 100, videoHeight: 100 };
	const lower = vi.fn(async () => bottom),
		upper = vi.fn(async () => top);
	const draws: { source: unknown; alpha: number }[] = [];
	const ctx = {
		save: vi.fn(),
		restore: vi.fn(),
		globalAlpha: 1,
		drawImage(source: unknown) {
			draws.push({ source, alpha: this.globalAlpha });
		},
	};
	await renderAnnotations(ctx as any, layers, 100, 100, 2000, 1, {
		videoCache: new Map([
			["bottom", { frame: lower }],
			["top", { frame: upper }],
		]),
	} as any);
	expect(lower).toHaveBeenCalledWith(2);
	expect(upper).toHaveBeenCalledWith(2.5);
	expect(draws).toEqual([
		{ source: bottom, alpha: 1 },
		{ source: top, alpha: 0.5 },
	]);
});
