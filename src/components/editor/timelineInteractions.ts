import {
	duplicateClip,
	moveClip,
	placeAsset,
	removeClip,
	setClipRate,
	splitClip,
	trimClip,
} from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";
import { clipDurationUs, type TimelineProject } from "@/core/timeline/types";
export const ASSET_DRAG_TYPE = "application/x-captr-asset";
export const CLIP_DRAG_TYPE = "application/x-captr-clip";
export interface TimelineDragSession {
	type: "asset" | "clip";
	id: string;
	durationUs: number;
	mediaKind: "visual" | "audio";
	pointerOffsetPx: number;
}
let activeTimelineDrag: TimelineDragSession | null = null;
export const beginTimelineDrag = (session: TimelineDragSession) => {
	activeTimelineDrag = session;
};
export const getTimelineDrag = () => activeTimelineDrag;
export const endTimelineDrag = (id: string) => {
	if (activeTimelineDrag?.id === id) activeTimelineDrag = null;
};
export const timeToPixels = (timeUs: number, pixelsPerSecond: number) =>
	(timeUs / 1_000_000) * pixelsPerSecond;
export const pixelsToTime = (pixels: number, pixelsPerSecond: number) =>
	Math.round((pixels / pixelsPerSecond) * 1_000_000);
export function snapTimelineTime(
	timeUs: number,
	project: TimelineProject,
	playheadUs: number,
	pixelsPerSecond: number,
	excludedClipId?: string,
): number {
	const points = [
		0,
		playheadUs,
		...project.tracks.flatMap((t) =>
			t.clips
				.filter((c) => c.id !== excludedClipId)
				.flatMap((c) => [c.startUs, c.startUs + clipDurationUs(c)]),
		),
	];
	const threshold = pixelsToTime(8, pixelsPerSecond);
	let nearest = Math.max(0, Math.round(timeUs)),
		distance = threshold + 1;
	for (const point of points) {
		const delta = Math.abs(point - timeUs);
		if (delta <= threshold && delta < distance) {
			nearest = point;
			distance = delta;
		}
	}
	return nearest;
}
export function timelineDropStartUs(
	pointerX: number,
	laneLeft: number,
	pointerOffsetPx: number,
	project: TimelineProject,
	playheadUs: number,
	pixelsPerSecond: number,
	excludedClipId?: string,
): number {
	const leadingEdgeX = Math.max(0, pointerX - laneLeft - Math.max(0, pointerOffsetPx));
	return snapTimelineTime(
		pixelsToTime(leadingEdgeX, pixelsPerSecond),
		project,
		playheadUs,
		pixelsPerSecond,
		excludedClipId,
	);
}
export function assetDropCommand(
	assetId: string,
	trackId: string,
	startUs: number,
	ids: { clipId: string; compositionId?: string },
): ProjectCommand {
	return (p) => placeAsset(p, assetId, trackId, startUs, ids);
}
export interface ClipGesture {
	kind: "move" | "trim-in" | "trim-out";
	deltaUs: number;
	trackId?: string;
}
export function applyClipGesture(
	project: TimelineProject,
	clipId: string,
	gesture: ClipGesture,
): TimelineProject {
	const owner = project.tracks.find((t) => t.clips.some((c) => c.id === clipId));
	const clip = owner?.clips.find((c) => c.id === clipId);
	if (!clip || !owner) throw new Error("Clip not found");
	if (gesture.kind === "move")
		return moveClip(
			project,
			clipId,
			gesture.trackId ?? owner.id,
			Math.max(0, clip.startUs + gesture.deltaUs),
		);
	const sourceDelta = Math.round(gesture.deltaUs * clip.rate);
	if (gesture.kind === "trim-in") {
		const nextIn = Math.max(0, clip.sourceInUs + sourceDelta),
			effectiveDelta = Math.round((nextIn - clip.sourceInUs) / clip.rate);
		return trimClip(project, clipId, nextIn, clip.sourceOutUs, clip.startUs + effectiveDelta);
	}
	const asset = project.assets.find((a) => a.id === clip.assetId)!,
		composition = project.compositions.find((c) => c.id === clip.compositionId),
		duration = composition?.durationUs ?? asset.durationUs;
	return trimClip(
		project,
		clipId,
		clip.sourceInUs,
		Math.min(duration, clip.sourceOutUs + sourceDelta),
	);
}
export type TimelineAction = "split" | "delete" | "duplicate" | "rate";
export function timelineActionCommand(
	action: TimelineAction,
	selection: string[],
	playheadUs: number,
	ids?: { clipId: string; compositionId?: string },
	rate = 1,
): ProjectCommand {
	return (project) =>
		selection.reduce((p, id, index) => {
			const clip = p.tracks.flatMap((t) => t.clips).find((c) => c.id === id);
			if (!clip) return p;
			if (action === "delete") return removeClip(p, id);
			if (action === "rate") return setClipRate(p, id, rate);
			const generated =
				index === 0 && ids
					? ids
					: { clipId: crypto.randomUUID(), compositionId: crypto.randomUUID() };
			if (action === "duplicate")
				return duplicateClip(p, id, clip.startUs + clipDurationUs(clip), generated);
			return splitClip(p, id, playheadUs, {
				rightClipId: generated.clipId,
				rightCompositionId: generated.compositionId,
			});
		}, project);
}
