import { describe, expect, it } from "vitest";
import { slideRegistry } from "@/core/slides/registry";
import "@/slides"; // auto-registers all slide modules
import { videoSlideModule, VideoSlideTimeline } from "./index";
import { createDefaultVideoMeta } from "./schema";

describe("VideoSlideModule", () => {
	it("is registered in slideRegistry under type 'video'", () => {
		expect(slideRegistry.has("video")).toBe(true);
		const mod = slideRegistry.get("video");
		expect(mod.type).toBe("video");
		expect(mod.displayName).toBe("Video Slide");
		expect(mod.WorkspaceComponent).toBeDefined();
	});

	it("creates default video metadata with tracks and empty pool", () => {
		const meta = createDefaultVideoMeta();
		expect(meta.videoTracks).toBeDefined();
		expect(meta.videoTracks.length).toBeGreaterThan(0);
		expect(meta.audioTracks).toEqual([]);
		expect(meta.mediaPool).toEqual([]);
	});

	it("exports videoSlideModule with renderFrame and WorkspaceComponent", () => {
		expect(videoSlideModule.type).toBe("video");
		expect(typeof videoSlideModule.WorkspaceComponent).toBe("function");
		expect(typeof videoSlideModule.renderFrame).toBe("function");
	});

	it("exports VideoSlideTimeline component", () => {
		expect(VideoSlideTimeline).toBeDefined();
	});
});
