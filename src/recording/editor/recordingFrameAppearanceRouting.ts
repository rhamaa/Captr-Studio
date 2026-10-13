import type { LayoutScenePreset } from "@/components/video-editor/types";

export type RecordingAppearanceSection = "scene" | "cursor" | "layout";
export type RecordingAppearanceTarget = "window" | "webcam";

export function resolveRecordingFrameAppearanceTarget(
	section: RecordingAppearanceSection,
	layoutPreset: LayoutScenePreset | null,
): RecordingAppearanceTarget | null {
	if (layoutPreset === "screen-only" && (section === "scene" || section === "layout")) {
		return "window";
	}
	if (section === "layout" && (layoutPreset === "bubble" || layoutPreset === "webcam-only")) {
		return "webcam";
	}
	return null;
}
