import type { SlideChunkExportOptions, SlideData } from "@/core/slides/types";
import { buildMotionPreviewDocument } from "../motionDocument";
import type { MotionSlideMeta } from "../schema";

export interface MotionRenderProgress {
	currentFrame: number;
	totalFrames: number;
	percentage: number;
}

interface RenderMotionSlideChunkOptions {
	meta: MotionSlideMeta;
	durationMs: number;
	width: number;
	height: number;
	fps: number;
	onProgress?: (progress: MotionRenderProgress) => void;
}

export async function renderMotionSlideChunk({
	meta,
	durationMs,
	width,
	height,
	fps,
	onProgress,
}: RenderMotionSlideChunkOptions): Promise<{ filePath: string; durationSec: number }> {
	const electronApi = typeof window === "undefined" ? undefined : window.electronAPI;
	if (!electronApi?.renderMotionSlide) {
		throw new Error("Motion slide export is only supported in Captr Studio desktop.");
	}

	const unsubscribe = electronApi.onRenderMotionSlideProgress?.((progress) => {
		onProgress?.(progress);
	});

	let result: Awaited<ReturnType<typeof electronApi.renderMotionSlide>>;
	try {
		result = await electronApi.renderMotionSlide({
			htmlDocument: buildMotionPreviewDocument(meta),
			durationMs,
			width,
			height,
			fps,
		});
	} finally {
		unsubscribe?.();
	}

	if (!result.success || !result.tempPath) {
		throw new Error(result.error || "Failed to render motion slide");
	}

	return {
		filePath: result.tempPath,
		durationSec: result.durationSec ?? durationMs / 1000,
	};
}

export async function exportMotionSlideChunk(
	slide: SlideData<"motion">,
	options: SlideChunkExportOptions,
): Promise<{ filePath: string; durationSec: number }> {
	const durationMs = Math.max(500, slide.durationMs || slide.meta.durationMs || 5000);
	return renderMotionSlideChunk({
		meta: slide.meta,
		durationMs,
		width: options.width,
		height: options.height,
		fps: options.fps,
		onProgress: ({ percentage }) => options.onProgress?.(percentage),
	});
}
