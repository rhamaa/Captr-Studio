import { describe, expect, it } from "vitest";
import { slideRegistry } from "@/core/slides/registry";
import "@/slides"; // auto-registers all slide modules
import { motionSlideModule, MotionSlideTimeline } from "./index";
import { createDefaultMotionMeta } from "./schema";

describe("MotionSlideModule", () => {
	it("is registered in slideRegistry under type 'motion'", () => {
		expect(slideRegistry.has("motion")).toBe(true);
		const mod = slideRegistry.get("motion");
		expect(mod.type).toBe("motion");
		expect(mod.displayName).toBe("Motion Slide");
		expect(mod.WorkspaceComponent).toBeDefined();
	});

	it("creates default metadata with starter template HTML, CSS, and JS", () => {
		const meta = createDefaultMotionMeta();
		expect(meta.html).toContain("motion-canvas");
		expect(meta.html).toContain("CAPTR MOTION STUDIO");
		expect(meta.css).toContain("keyframes");
		expect(meta.js).toContain("window.setSeekTime");
		expect(meta.durationMs).toBe(5000);
		expect(meta.autoReload).toBe(true);
	});

	it("provides renderFrame and exportChunk methods compatible with global pipeline", async () => {
		expect(typeof motionSlideModule.exportChunk).toBe("function");
		expect(typeof motionSlideModule.renderFrame).toBe("function");

		const dummySlide = {
			id: "slide-1",
			type: "motion" as const,
			title: "Motion Test",
			durationMs: 4000,
			order: 0,
			meta: createDefaultMotionMeta(),
		};

		const chunkResult = await motionSlideModule.exportChunk!(dummySlide, {
			width: 1920,
			height: 1080,
			fps: 60,
		});

		expect(chunkResult.durationSec).toBe(4);
	});

	it("correctly parses raw HTML into separated body, css, and js", async () => {
		const rawHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    .banner { color: red; }
  </style>
</head>
<body>
  <div class="banner">Hello Motion</div>
  <script>
    console.log("animating");
  </script>
</body>
</html>`;

		const { parseHtmlFileContent } = await import("./components/MotionSlideWorkspace");
		const parsed = parseHtmlFileContent(rawHtml);
		expect(parsed.html).toContain("Hello Motion");
		expect(parsed.css).toContain(".banner { color: red; }");
		expect(parsed.js).toContain("animating");
	});

	it("exports MotionSlideTimeline component", () => {
		expect(MotionSlideTimeline).toBeDefined();
	});
});
