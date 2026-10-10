import { afterEach, describe, expect, it, vi } from "vitest";
import { addTextOverlay, createTimelineProject } from "@/core/timeline/commands";
import { evaluateProject } from "@/core/timeline/evaluation";
import { ProjectFrameRenderer } from "./projectFrameRenderer";

afterEach(() => vi.unstubAllGlobals());

vi.mock("./frameRenderer", () => ({ FrameRenderer: class {} }));
vi.mock("./layerVideoSource", () => ({ LayerVideoSource: class {} }));

describe("ProjectFrameRenderer text overlays", () => {
	it("draws evaluated text overlays through the shared project frame renderer", async () => {
		const draws: Array<{ text: string; x: number; y: number; font: string; color: string; align: string }> = [];
		const context = {
			fillStyle: "",
			font: "",
			textAlign: "",
			globalAlpha: 1,
			clearRect: () => undefined,
			fillRect: () => undefined,
			drawImage: () => undefined,
			save: () => undefined,
			restore: () => undefined,
			translate: () => undefined,
			rotate: () => undefined,
			scale: () => undefined,
			fillText: (text: string, x: number, y: number) => draws.push({ text, x, y, font: context.font, color: context.fillStyle, align: context.textAlign }),
		};
		const canvas = { width: 0, height: 0, getContext: () => context };
		vi.stubGlobal("document", { createElement: () => canvas });
		const project = addTextOverlay(createTimelineProject("project-1", "Text test"), 0, {
			assetId: "title-asset",
			trackId: "title-track",
			clipId: "title-clip",
		});
		const content = project.tracks.flatMap((track) => track.clips).find((clip) => clip.id === "title-clip")?.content;
		if (content?.kind !== "text") throw new Error("Missing inline title");
		content.text = { ...content.text, content: "Story title", fontFamily: "Arial", fontSizePx: 72,
			fontWeight: 700, color: "#00ff00", align: "left" };
		const renderer = new ProjectFrameRenderer();

		try {
			await renderer.render(evaluateProject(project, 0));
			expect(draws).toEqual([{ text: "Story title", x: 0, y: 0, font: '700 72px "Arial"', color: "#00ff00", align: "left" }]);
			expect(project.assets).toEqual([]);
		} finally {
			renderer.destroy();
		}
	});
});
