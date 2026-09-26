import { FilmSlate } from "@phosphor-icons/react";
import { slideRegistry } from "@/core/slides/registry";
import type { SlideModule } from "@/core/slides/types";
import { VideoSlideWorkspace } from "./components/VideoSlideWorkspace";
import { createDefaultVideoMeta, type VideoSlideMeta } from "./schema";

export const videoSlideModule: SlideModule<VideoSlideMeta> = {
	type: "video",
	displayName: "Video Slide",
	description:
		"CapCut & Filmora style NLE: multi-track editing, B-roll overlays, razor split, dan audio mix.",
	icon: FilmSlate,
	WorkspaceComponent: VideoSlideWorkspace,
	createDefaultMeta: createDefaultVideoMeta,
	exportChunk: async (slide, options) => {
		const meta = slide.meta;
		const durationSec = Math.max(0.5, slide.durationMs / 1000);
		const firstClip = meta.videoTracks?.[0]?.clips?.[0]?.sourcePath || "";

		if (
			firstClip &&
			meta.audioTracks &&
			meta.audioTracks.length > 0 &&
			window.electronAPI?.muxExportedVideoAudioFromPath
		) {
			const firstAudio = meta.audioTracks[0];
			if (firstAudio.sourcePath && !firstAudio.sourcePath.startsWith("blob:")) {
				try {
					const muxResult = await window.electronAPI.muxExportedVideoAudioFromPath(
						firstClip,
						{
							audioMode: "copy-source",
							audioSourcePath: firstAudio.sourcePath,
							outputDurationSec: durationSec,
						},
					);
					if (muxResult.success && muxResult.tempPath) {
						options.onProgress?.(100);
						return {
							filePath: muxResult.tempPath,
							durationSec,
						};
					}
				} catch (err) {
					console.warn(
						"[VideoSlide] Failed to mux audio track into chunk, using raw video:",
						err,
					);
				}
			}
		}

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

export { VideoSlideTimeline } from "./components/VideoSlideTimeline";

