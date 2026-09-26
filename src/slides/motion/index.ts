import { Lightning } from "@phosphor-icons/react";
import { slideRegistry } from "@/core/slides/registry";
import type { SlideModule } from "@/core/slides/types";
import { MotionSlideWorkspace } from "./components/MotionSlideWorkspace";
import { createDefaultMotionMeta, type MotionSlideMeta } from "./schema";

export const motionSlideModule: SlideModule<MotionSlideMeta> = {
	type: "motion",
	displayName: "Motion Slide",
	description:
		"HTML5, CSS & JavaScript Motion Graphics studio dengan auto-reload & live timeline.",
	icon: Lightning,
	WorkspaceComponent: MotionSlideWorkspace,
	createDefaultMeta: createDefaultMotionMeta,
	exportChunk: async (slide, options) => {
		const durationSec = Math.max(0.5, (slide.durationMs || 5000) / 1000);
		options.onProgress?.(100);
		return {
			filePath: "",
			durationSec,
		};
	},
	renderFrame: async (slide, _timeMs, targetCanvas) => {
		const ctx = targetCanvas.getContext("2d") as
			| CanvasRenderingContext2D
			| OffscreenCanvasRenderingContext2D
			| null;
		if (!ctx) return;
		ctx.fillStyle = slide.meta.backgroundColor || "#030712";
		ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
	},
};

// Auto-register to SlideRegistry
slideRegistry.register(motionSlideModule);

export * from "./components/MotionSlideWorkspace";
export * from "./components/MotionSlideTimeline";
export * from "./schema";
