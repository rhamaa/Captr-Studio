import { refreshStoryProjections } from "./storyOwnership";
import type { ClipVisualSettings, TimelineProject } from "./types";
import { validateTimelineProject } from "./validation";

export function validateClipVisualSettings(value: unknown): asserts value is ClipVisualSettings {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw new Error("Invalid clip visual settings");
	const v = value as ClipVisualSettings;
	for (const n of [v.brightness, v.contrast, v.saturation])
		if (n !== undefined && (!Number.isFinite(n) || n < 0 || n > 3))
			throw new Error("Invalid clip color adjustment");
	if (v.mask !== undefined && !["rectangle", "ellipse"].includes(v.mask))
		throw new Error("Invalid clip mask");
	if (
		v.maskInset !== undefined &&
		(!Number.isFinite(v.maskInset) || v.maskInset < 0 || v.maskInset >= 0.5)
	)
		throw new Error("Invalid mask inset");
	if (v.crop !== undefined) {
		const c = v.crop;
		if (
			!c ||
			typeof c !== "object" ||
			[c.left, c.right, c.top, c.bottom].some((n) => !Number.isFinite(n) || n < 0) ||
			c.left + c.right >= 1 ||
			c.top + c.bottom >= 1
		)
			throw new Error("Invalid clip crop");
	}
}
export function updateClipVisualSettings(
	project: TimelineProject,
	id: string,
	settings: ClipVisualSettings | undefined,
): TimelineProject {
	const next = structuredClone(project),
		track = next.tracks.find((t) => t.clips.some((c) => c.id === id));
	if (!track) throw new Error("Clip not found");
	if (track.locked) throw new Error("Track is locked");
	track.clips.find((c) => c.id === id)!.visualSettings = structuredClone(settings);
	next.updatedAt = new Date().toISOString();
	return validateTimelineProject(refreshStoryProjections(next));
}
