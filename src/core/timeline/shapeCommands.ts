import { resolveClipSource } from "./clipSource";
import { placeInlineDesign } from "./designTemplateCommands";
import { refreshStoryProjections } from "./storyOwnership";
import { type ShapeDefinition, type ShapeStyle, type TimelineProject } from "./types";
import { validateTimelineProject } from "./validation";

export function createAndPlaceShape(
	project: TimelineProject,
	shape: ShapeDefinition,
	startUs: number,
	ids: { assetId?: string; clipId: string; trackId: string },
): TimelineProject {
	if (!Number.isSafeInteger(startUs) || startUs < 0)
		throw new Error("Invalid shape placement time");
	return placeInlineDesign(
		project,
		{ kind: "shape", shapeDefinition: shape, durationUs: 5_000_000 },
		startUs,
		ids,
	);
}

export function setShapeStyleOverride(
	project: TimelineProject,
	clipId: string,
	style: ShapeStyle | null,
): TimelineProject {
	const next = structuredClone(project);
	const track = next.tracks.find((candidate) =>
		candidate.clips.some((clip) => clip.id === clipId),
	);
	const clip = track?.clips.find((candidate) => candidate.id === clipId);
	if (!track || !clip) throw new Error("Shape clip not found");
	if (track.locked) throw new Error("Cannot edit a shape on a locked track");
	if (resolveClipSource(next, clip).kind !== "shape") throw new Error("Clip is not a shape");
	if (style === null) delete clip.shapeStyleOverride;
	else clip.shapeStyleOverride = structuredClone(style);
	next.updatedAt = new Date().toISOString();
	return validateTimelineProject(refreshStoryProjections(next));
}
