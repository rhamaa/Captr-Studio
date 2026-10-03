import { afterEach, describe, expect, it, vi } from "vitest";
import { addTextOverlay, createTimelineProject } from "@/core/timeline/commands";
import { evaluateProject } from "@/core/timeline/evaluation";
import { ProjectFrameRenderer } from "./projectFrameRenderer";

afterEach(() => vi.unstubAllGlobals());

vi.mock("./frameRenderer", () => ({ FrameRenderer: class {} }));
vi.mock("./layerVideoSource", () => ({ LayerVideoSource: class {} }));

describe("ProjectFrameRenderer text overlays", () => {
	it("draws evaluated text overlays through the shared project frame renderer", async () => {
		const draws: Array<{ text: string; x: number; y: number }> = [];
		const context = {
			fillStyle: "",
			globalAlpha: 1,
			fillRect: () => undefined,
			save: () => undefined,
			restore: () => undefined,
			translate: () => undefined,
			rotate: () => undefined,
			scale: () => undefined,
			fillText: (text: string, x: number, y: number) => draws.push({ text, x, y }),
		};
		const canvas = { width: 0, height: 0, getContext: () => context };
		vi.stubGlobal("document", { createElement: () => canvas });
		const project = addTextOverlay(createTimelineProject("project-1", "Text test"), 0, {
			assetId: "title-asset",
			trackId: "title-track",
			clipId: "title-clip",
		});
		const renderer = new ProjectFrameRenderer();

		try {
			await renderer.render(evaluateProject(project, 0));
			expect(draws).toEqual([{ text: "Your text", x: 0, y: 0 }]);
		} finally {
			renderer.destroy();
		}
	});
});
