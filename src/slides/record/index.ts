import { VideoCamera } from "@phosphor-icons/react";
import { slideRegistry } from "@/core/slides/registry";
import type { SlideModule } from "@/core/slides/types";
import { RecordSlideWorkspace } from "./components/RecordSlideWorkspace";
import { type RecordSlideMeta, createDefaultRecordMeta } from "./schema";

export const recordSlideModule: SlideModule<RecordSlideMeta> = {
	type: "record",
	displayName: "Record Slide",
	description: "Screen studio mode dengan auto-zoom, cursor smoothing, dan wallpaper backdrop.",
	icon: VideoCamera,
	WorkspaceComponent: RecordSlideWorkspace,
	createDefaultMeta: createDefaultRecordMeta,
};

// Auto-register to SlideRegistry
slideRegistry.register(recordSlideModule);
