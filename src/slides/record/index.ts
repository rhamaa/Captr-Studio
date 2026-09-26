import { VideoCamera } from "@phosphor-icons/react";
import { slideRegistry } from "@/core/slides/registry";
import type { SlideModule } from "@/core/slides/types";
import { RecordSlideWorkspace } from "./components/RecordSlideWorkspace";
import { createDefaultRecordMeta, type RecordSlideMeta } from "./schema";

export const recordSlideModule: SlideModule<RecordSlideMeta> = {
	type: "record",
	displayName: "Record Slide",
	description: "Screen studio mode dengan auto-zoom, cursor smoothing, dan wallpaper backdrop.",
	icon: VideoCamera,
	WorkspaceComponent: RecordSlideWorkspace,
	createDefaultMeta: createDefaultRecordMeta,
	exportChunk: async (slide, options) => {
		const meta = slide.meta;
		const durationSec = Math.max(0.5, slide.durationMs / 1000);
		options.onProgress?.(100);
		return {
			filePath: meta.videoPath || "",
			durationSec,
		};
	},
	renderFrame: async (slide, _timeMs, targetCanvas) => {
		const ctx = targetCanvas.getContext("2d") as
			| CanvasRenderingContext2D
			| OffscreenCanvasRenderingContext2D
			| null;
		if (!ctx) return;
		ctx.fillStyle = slide.meta.wallpaper || "#0f172a";
		ctx.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
	},
};

// Auto-register to SlideRegistry
slideRegistry.register(recordSlideModule);

export * from "./components/RecordSlideTimeline";
export * from "./schema";

