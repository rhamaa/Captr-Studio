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
};

// Auto-register to SlideRegistry
slideRegistry.register(videoSlideModule);
