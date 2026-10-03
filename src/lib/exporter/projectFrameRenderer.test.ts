import { afterEach, expect, it, vi } from "vitest";
import {
	createTimelineProject,
	placeAsset,
	registerRecording,
	updateComposition,
} from "@/core/timeline/commands";
import { evaluateProject } from "@/core/timeline/evaluation";

const configs = vi.hoisted(() => [] as any[]);
const videoFrames = vi.hoisted(() => [] as any[]);
vi.mock("./frameRenderer", () => ({
	FrameRenderer: class {
		constructor(config: any) {
			configs.push(config);
		}
		async initialize() {}
		async renderFrame() {}
		getCanvas() {
			return { width: 100, height: 100 };
		}
		setProjectWebcamFrame() {}
		destroy() {}
	},
}));
vi.mock("./layerVideoSource", () => ({
	LayerVideoSource: class {
		async load() {}
		async frame(timeSec: number, options?: unknown) {
			videoFrames.push({ timeSec, options });
			return {};
		}
		destroy() {}
	},
}));

import { ProjectFrameRenderer } from "./projectFrameRenderer";

afterEach(() => {
	vi.unstubAllGlobals();
	configs.length = 0;
	videoFrames.length = 0;
});
it("undo followed by another edit at the same revision uses different effect settings", async () => {
	vi.stubGlobal("document", {
		createElement: () => ({
			getContext: () => ({
				fillRect() {},
				save() {},
				restore() {},
				translate() {},
				rotate() {},
				scale() {},
				drawImage() {},
				clearRect() {},
			}),
		}),
	});
	vi.stubGlobal(
		"VideoFrame",
		class {
			close() {}
		},
	);
	vi.stubGlobal("HTMLVideoElement", class {});
	vi.stubGlobal("HTMLImageElement", class {});
	const base = placeAsset(
		registerRecording(
			createTimelineProject("p", "P"),
			{
				captureId: "r",
				name: "R",
				durationUs: 1_000_000,
				width: 100,
				height: 100,
				screen: { path: "screen.mp4", durationUs: 1_000_000, offsetUs: 0 },
				settings: {},
			},
			{ assetId: "a", packageId: "pkg" },
		),
		"a",
		"visual-1",
		0,
		{ clipId: "c", compositionId: "e" },
	);
	const first = updateComposition(base, "e", {
		...base.compositions[0],
		settings: { background: "#ff0000" },
	});
	const alternate = updateComposition(base, "e", {
		...base.compositions[0],
		settings: { background: "#0000ff" },
	});
	expect(first.compositions[0].revision).toBe(alternate.compositions[0].revision);
	const renderer = new ProjectFrameRenderer();
	await renderer.render(evaluateProject(first, 0));
	await renderer.render(evaluateProject(base, 0));
	await renderer.render(evaluateProject(alternate, 0));
	expect(configs.map((c) => c.background)).toEqual(["#ff0000", undefined, "#0000ff"]);
	await renderer.render(evaluateProject(first, 0));
	expect(configs).toHaveLength(3);
	await renderer.render(evaluateProject(first, 0), { continuousPlayback: true });
	expect(videoFrames.at(-1)).toEqual({
		timeSec: 0,
		options: { continuousPlayback: true, playbackRate: 1 },
	});
	renderer.destroy();
});
