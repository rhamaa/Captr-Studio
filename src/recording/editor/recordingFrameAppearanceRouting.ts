import type { LayoutScenePreset } from "@/components/video-editor/types";

export type RecordingAppearanceSection = "scene" | "cursor" | "layout" | "appearance";
export type RecordingAppearanceTarget = "window" | "webcam";

export function resolveRecordingFrameAppearanceTarget(
	section: RecordingAppearanceSection,
	layoutPreset: LayoutScenePreset | null,
): RecordingAppearanceTarget | null {
	if (section === "appearance") {
		if (layoutPreset === "webcam-only") {
			return "webcam";
		}
		return "window";
	}
	return null;
}
