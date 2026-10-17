import { afterEach, expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { evaluateProject } from "@/core/timeline/evaluation";
import { ProjectFrameRenderer } from "./projectFrameRenderer";
vi.mock("./frameRenderer", () => ({ FrameRenderer: class {} }));
vi.mock("./layerVideoSource", () => ({ LayerVideoSource: class {} }));
afterEach(() => vi.unstubAllGlobals());
it("burns final captions into the shared canvas on half-open time intervals", async () => {
	const output: string[] = [];
	const ctx = {
		clearRect() {},
		fillRect() {},
		save() {},
		restore() {},
		drawImage() {},
		measureText: (s: string) => ({ width: s.length * 20 }),
		fillText: (s: string) => output.push(s),
	};
	vi.stubGlobal("document", { createElement: () => ({ getContext: () => ctx }) });
	const p = createTimelineProject("caption-render", "Render");
	p.subtitles = {
		enabled: true,
		segments: [{ id: 1, text: "Final caption", startUs: 0, endUs: 1_000_000, words: [] }],
	};
	const renderer = new ProjectFrameRenderer();
	await renderer.render(evaluateProject(p, 500_000));
	expect(output).toEqual(["Final caption"]);
	output.length = 0;
	await renderer.render(evaluateProject(p, 1_000_000));
	expect(output).toEqual([]);
	renderer.destroy();
});
