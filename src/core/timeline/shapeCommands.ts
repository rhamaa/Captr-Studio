import { addTrack, placeAsset, registerMedia } from "./commands";
import { type ShapeDefinition, type ShapeStyle, type TimelineProject } from "./types";
import { validateTimelineProject } from "./validation";

function shapeBounds(shape: ShapeDefinition) {
	if (shape.kind === "rectangle" || shape.kind === "ellipse")
		return { width: Math.ceil(shape.width), height: Math.ceil(shape.height) };
	return {
		width: Math.max(1, Math.ceil(Math.max(shape.from.x, shape.to.x))),
		height: Math.max(1, Math.ceil(Math.max(shape.from.y, shape.to.y))),
	};
}

export function createAndPlaceShape(
	project: TimelineProject,
	shape: ShapeDefinition,
	startUs: number,
	ids: { assetId: string; clipId: string; trackId: string },
): TimelineProject {
	if (!Number.isSafeInteger(startUs) || startUs < 0) throw new Error("Invalid shape placement time");
	const bounds = shapeBounds(shape);
	let next = registerMedia(project, {
		id: ids.assetId,
		kind: "shape",
		name: shape.kind === "rectangle" ? "Rectangle" : shape.kind[0]!.toUpperCase() + shape.kind.slice(1),
		durationUs: 5_000_000,
		width: bounds.width,
		height: bounds.height,
		shapeDefinition: structuredClone(shape),
	});
	const durationUs = 5_000_000;
	let targetTrack = [...next.tracks].reverse().find((track) =>
		track.kind === "visual" && !track.locked && !track.hidden &&
		track.clips.every((clip) => startUs + durationUs <= clip.startUs || clip.startUs + (clip.sourceOutUs - clip.sourceInUs) / clip.rate <= startUs),
	);
	if (!targetTrack) {
		next = addTrack(next, ids.trackId, "visual");
		targetTrack = next.tracks.find((track) => track.id === ids.trackId);
	}
	if (!targetTrack) throw new Error("Could not create a visual track for the shape");
	next = placeAsset(next, ids.assetId, targetTrack.id, startUs, { clipId: ids.clipId });
	return validateTimelineProject(next);
}

export function setShapeStyleOverride(
	project: TimelineProject,
	clipId: string,
	style: ShapeStyle | null,
): TimelineProject {
	const next = structuredClone(project);
	const track = next.tracks.find((candidate) => candidate.clips.some((clip) => clip.id === clipId));
	const clip = track?.clips.find((candidate) => candidate.id === clipId);
	if (!track || !clip) throw new Error("Shape clip not found");
	if (track.locked) throw new Error("Cannot edit a shape on a locked track");
	if (next.assets.find((asset) => asset.id === clip.assetId)?.kind !== "shape")
		throw new Error("Clip is not a shape");
	if (style === null) delete clip.shapeStyleOverride;
	else clip.shapeStyleOverride = structuredClone(style);
	next.updatedAt = new Date().toISOString();
	return validateTimelineProject(next);
}
