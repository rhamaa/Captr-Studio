import { FilmSlate } from "@phosphor-icons/react";
import { slideRegistry } from "@/core/slides/registry";
import type { SlideModule } from "@/core/slides/types";
import { VideoSlideWorkspace } from "./components/VideoSlideWorkspace";
import { type VideoSlideMeta, createDefaultVideoMeta } from "./schema";

export const videoSlideModule: SlideModule<VideoSlideMeta> = {
	type: "video",
	displayName: "Video Slide",
	description: "CapCut & Filmora style NLE: multi-track editing, B-roll overlays, razor split, dan audio mix.",
	icon: FilmSlate,
	WorkspaceComponent: VideoSlideWorkspace,
	createDefaultMeta: createDefaultVideoMeta,
	exportChunk: async (slide, options) => {
		const meta = slide.meta;
		const durationSec = Math.max(0.5, slide.durationMs / 1000);
		const firstClip = meta.videoTracks?.[0]?.clips?.[0]?.sourcePath || "";
		options.onProgress?.(100);
		return {
			filePath: firstClip,
			durationSec,
		};
	},
	renderFrame: async (_slide, _timeMs, targetCanvas) => {
		const ctx = targetCanvas.getContext("2d") as
			| CanvasRenderingContext2D
			| OffscreenCanvasRenderingContext2D
			| null;
		if (!ctx) return;
		ctx.fillStyle = "#020617";
		ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
	},
};

// Auto-register to SlideRegistry
slideRegistry.register(videoSlideModule);
