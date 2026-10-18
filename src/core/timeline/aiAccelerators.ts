import type { ActiveSurface, ContextualAccelerator } from "./aiTypes";

/**
 * Formats a user-facing badge describing the active editing surface and state.
 */
export function formatSurfaceBadge(surface: ActiveSurface): string {
	switch (surface.kind) {
		case "record-editor": {
			const tab = surface.activeTab;
			let tabLabel = "Framing & Appearance";
			if (tab === "cursor") tabLabel = "Cursor Settings";
			else if (tab === "scene") tabLabel = "Scene Layout";
			else if (tab === "layout") tabLabel = "Layout";
			return `Record Editor • ${tabLabel}`;
		}
		case "story-editor": {
			const count = surface.selectedClipIds?.length ?? 0;
			if (count > 0) {
				return `Story Timeline • ${count} clip${count > 1 ? "s" : ""} selected`;
			}
			return "Story Timeline";
		}
		case "caption-editor": {
			if (typeof surface.selectedSegmentIndex === "number") {
				return `Caption Editor • Segment #${surface.selectedSegmentIndex + 1}`;
			}
			return "Caption Editor • Segments";
		}
		case "artboard-canvas": {
			return `Artboard Canvas • ${surface.aspectRatio ?? "16:9"}`;
		}
		case "voiceover-studio": {
			return `Voiceover Studio • Take ${surface.takeCount ?? 0}`;
		}
		default:
			return "Captr Studio";
	}
}

/**
 * Returns contextual action accelerators matching the active surface.
 */
export function getAcceleratorsForSurface(surface: ActiveSurface): ContextualAccelerator[] {
	switch (surface.kind) {
		case "record-editor":
			return [
				{
					id: "auto-zoom-clicks",
					label: "Auto-Zoom to Clicks",
					description: "Automatically add zoom keyframes to cursor click events",
					toolName: "auto_zoom_to_clicks",
				},
				{
					id: "frame-appearance-brutalism",
					label: "Style: Brutalism",
					description: "Apply neo-brutalism frame styling with high contrast borders",
					toolName: "set_frame_appearance",
				},
				{
					id: "frame-appearance-glass",
					label: "Style: Glassmorphism",
					description: "Apply frosted glass translucent styling to window frame",
					toolName: "set_frame_appearance",
				},
				{
					id: "frame-border-outward",
					label: "Outward Border +4px",
					description: "Increase outward border padding by 4px",
					toolName: "set_frame_appearance",
				},
			];
		case "story-editor":
			return [
				{
					id: "remove-silence",
					label: "Remove Silence",
					description: "Remove pauses and silent gaps from timeline clips",
					toolName: "remove_silence",
				},
				{
					id: "split-clip",
					label: "Split Clip",
					description: "Split clip at current playhead position",
					toolName: "split_clip",
				},
				{
					id: "add-broll",
					label: "Add B-Roll Card",
					description: "Insert B-Roll graphic or callout card at current timestamp",
					toolName: "add_broll_or_overlay",
				},
			];
		case "caption-editor":
			return [
				{
					id: "fix-typos",
					label: "Fix Typos with AI",
					description: "Correct grammar and spelling errors across transcript segments",
					toolName: "fix_caption_typos",
				},
				{
					id: "split-short-lines",
					label: "Split into Short Lines",
					description: "Format captions into 2-4 word punchy lines for readability",
					toolName: "split_caption_lines",
				},
				{
					id: "sync-timing",
					label: "Sync Word Timestamps",
					description: "Re-align word timestamps with speech audio",
					toolName: "sync_caption_timing",
				},
			];
		case "artboard-canvas":
			return [
				{
					id: "repurpose-shorts-9-16",
					label: "Repurpose 9:16 Shorts",
					description: "Generate 9:16 vertical short format from main sequence",
					toolName: "repurpose_aspect_ratio",
				},
				{
					id: "auto-center-webcam",
					label: "Auto-Center Webcam & Screen",
					description: "Center webcam overlay and content for social formats",
					toolName: "auto_center_webcam",
				},
			];
		default:
			return [];
	}
}
