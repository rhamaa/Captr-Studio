import {
	addTrack,
	duplicateClip,
	moveClip,
	placeAsset,
	removeClip,
	rippleRemoveClips,
	setClipRate,
	splitClip,
	trimClip,
} from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";
import { clipDurationUs, type TimelineProject, type TimelineTrack } from "@/core/timeline/types";
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
export interface SnapResult {
	timeUs: number;
	snapped: boolean;
	snapPointUs?: number;
}
export interface SnapOptions {
	durationUs?: number;
	excludedClipId?: string;
	enabled?: boolean;
	includePlayhead?: boolean;
}
export function snapTimelineTimeWithDetails(
	timeUs: number,
	project: TimelineProject,
	playheadUs: number,
	pixelsPerSecond: number,
	optionsOrExcludedId?: SnapOptions | string,
): SnapResult {
	const options: SnapOptions =
		typeof optionsOrExcludedId === "string"
			? { excludedClipId: optionsOrExcludedId }
			: (optionsOrExcludedId ?? {});
	const enabled = options.enabled ?? true;
	const roundedTimeUs = Math.max(0, Math.round(timeUs));

	if (!enabled) {
		return { timeUs: roundedTimeUs, snapped: false };
	}

	const includePlayhead = options.includePlayhead ?? true;
	const points: number[] = [0];
	if (includePlayhead) {
		points.push(playheadUs);
	}
	for (const t of project.tracks) {
		if (t.locked) continue;
		for (const c of t.clips) {
			if (c.id === options.excludedClipId) continue;
			points.push(c.startUs);
			points.push(c.startUs + clipDurationUs(c));
		}
	}

	const threshold = pixelsToTime(8, pixelsPerSecond);
	let nearestLeading = roundedTimeUs;
	let leadingDistance = threshold + 1;
	let leadingSnapPoint: number | undefined;

	for (const point of points) {
		const delta = Math.abs(point - roundedTimeUs);
		if (delta <= threshold && delta < leadingDistance) {
			nearestLeading = point;
			leadingDistance = delta;
			leadingSnapPoint = point;
		}
	}

	if (options.durationUs && options.durationUs > 0) {
		const trailingEdge = roundedTimeUs + options.durationUs;
		let nearestTrailing = trailingEdge;
		let trailingDistance = threshold + 1;
		let trailingSnapPoint: number | undefined;

		for (const point of points) {
			const delta = Math.abs(point - trailingEdge);
			if (delta <= threshold && delta < trailingDistance) {
				nearestTrailing = point;
				trailingDistance = delta;
				trailingSnapPoint = point;
			}
		}

		if (trailingSnapPoint !== undefined && trailingDistance < leadingDistance) {
			const candidateStart = Math.max(0, nearestTrailing - options.durationUs);
			return {
				timeUs: candidateStart,
				snapped: true,
				snapPointUs: trailingSnapPoint,
			};
		}
	}

	if (leadingSnapPoint !== undefined) {
		return {
			timeUs: nearestLeading,
			snapped: true,
			snapPointUs: leadingSnapPoint,
		};
	}

	return {
		timeUs: roundedTimeUs,
		snapped: false,
	};
}
export function snapTimelineTime(
	timeUs: number,
	project: TimelineProject,
	playheadUs: number,
	pixelsPerSecond: number,
	optionsOrExcludedId?: SnapOptions | string,
): number {
	return snapTimelineTimeWithDetails(
		timeUs,
		project,
		playheadUs,
		pixelsPerSecond,
		optionsOrExcludedId,
	).timeUs;
}
export function timelineDropDetails(
	pointerX: number,
	laneLeft: number,
	pointerOffsetPx: number,
	project: TimelineProject,
	playheadUs: number,
	pixelsPerSecond: number,
	optionsOrExcludedId?: SnapOptions | string,
): SnapResult {
	const leadingEdgeX = Math.max(0, pointerX - laneLeft - Math.max(0, pointerOffsetPx));
	return snapTimelineTimeWithDetails(
		pixelsToTime(leadingEdgeX, pixelsPerSecond),
		project,
		playheadUs,
		pixelsPerSecond,
		optionsOrExcludedId,
	);
}
export function timelineDropStartUs(
	pointerX: number,
	laneLeft: number,
	pointerOffsetPx: number,
	project: TimelineProject,
	playheadUs: number,
	pixelsPerSecond: number,
	optionsOrExcludedId?: SnapOptions | string,
): number {
	return timelineDropDetails(
		pointerX,
		laneLeft,
		pointerOffsetPx,
		project,
		playheadUs,
		pixelsPerSecond,
		optionsOrExcludedId,
	).timeUs;
}
export function assetDropCommand(
	assetId: string,
	trackId: string,
	startUs: number,
	ids: { clipId: string; compositionId?: string },
): ProjectCommand {
	return (p) => placeAsset(p, assetId, trackId, startUs, ids);
}

export function timelineTracksInDisplayOrder(tracks: TimelineTrack[]): TimelineTrack[] {
	const visual = tracks.filter((track) => track.kind === "visual").reverse();
	const audio = tracks.filter((track) => track.kind === "audio");
	return [...visual, ...audio];
}

export interface TimelineDropRequest {
	type: "asset" | "clip";
	id: string;
	preferredTrackId: string;
	startUs: number;
	durationUs: number;
}

export interface TimelineDropTarget {
	kind: "visual" | "audio";
	trackId?: string;
	createTrack: boolean;
	blocked: boolean;
}

function dropKind(project: TimelineProject, request: TimelineDropRequest): "visual" | "audio" {
	if (request.type === "asset") {
		const asset = project.assets.find((entry) => entry.id === request.id);
		if (!asset) throw new Error("Asset not found");
		return asset.kind === "audio" ? "audio" : "visual";
	}

	const track = project.tracks.find((entry) =>
		entry.clips.some((clip) => clip.id === request.id),
	);
	if (!track) throw new Error("Clip not found");
	return track.kind;
}

export function resolveTimelineDropTarget(
	project: TimelineProject,
	request: TimelineDropRequest,
): TimelineDropTarget {
	const kind = dropKind(project, request);
	const preferred = project.tracks.find((track) => track.id === request.preferredTrackId);
	if (preferred?.kind === kind) {
		if (preferred.locked)
			return { kind, trackId: preferred.id, createTrack: false, blocked: true };
		const endUs = request.startUs + request.durationUs;
		const overlaps = preferred.clips.some(
			(clip) =>
				clip.id !== (request.type === "clip" ? request.id : undefined) &&
				request.startUs < clip.startUs + clipDurationUs(clip) &&
				endUs > clip.startUs,
		);
		return { kind, trackId: preferred.id, createTrack: overlaps, blocked: false };
	}

	const displayTracks = timelineTracksInDisplayOrder(project.tracks);
	const preferredIndex = displayTracks.findIndex(
		(track) => track.id === request.preferredTrackId,
	);
	const candidates = displayTracks.filter((track) => track.kind === kind && !track.locked);
	const target = candidates.reduce<TimelineTrack | undefined>((closest, candidate) => {
		if (!closest) return candidate;
		if (preferredIndex < 0) return closest;
		const candidateDistance = Math.abs(displayTracks.indexOf(candidate) - preferredIndex);
		const closestDistance = Math.abs(displayTracks.indexOf(closest) - preferredIndex);
		return candidateDistance < closestDistance ? candidate : closest;
	}, undefined);

	if (!target) {
		const lockedTrack = displayTracks.find((track) => track.kind === kind);
		return lockedTrack
			? { kind, trackId: lockedTrack.id, createTrack: false, blocked: true }
			: { kind, createTrack: true, blocked: false };
	}
	const endUs = request.startUs + request.durationUs;
	const overlaps = target.clips.some(
		(clip) =>
			clip.id !== (request.type === "clip" ? request.id : undefined) &&
			request.startUs < clip.startUs + clipDurationUs(clip) &&
			endUs > clip.startUs,
	);
	return { kind, trackId: target.id, createTrack: overlaps, blocked: false };
}

export function applyTimelineDrop(
	project: TimelineProject,
	request: TimelineDropRequest,
	ids: { trackId: string; clipId: string; compositionId?: string },
): TimelineProject {
	const target = resolveTimelineDropTarget(project, request);
	if (target.blocked) throw new Error("Cannot drop on a locked track");
	const trackId = target.createTrack ? ids.trackId : target.trackId!;
	const next = target.createTrack ? addTrack(project, trackId, target.kind) : project;
	return request.type === "asset"
		? placeAsset(next, request.id, trackId, request.startUs, ids)
		: moveClip(next, request.id, trackId, request.startUs);
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

	const targetTrackId = gesture.trackId ?? owner.id;
	const targetTrack = project.tracks.find((t) => t.id === targetTrackId);
	if (!targetTrack) throw new Error("Target track not found");
	if (targetTrack.locked) throw new Error("Target track is locked");

	const otherClips = targetTrack.clips
		.filter((c) => c.id !== clipId)
		.sort((a, b) => a.startUs - b.startUs);

	if (gesture.kind === "move") {
		const dur = clipDurationUs(clip);
		const requestedStartUs = Math.max(0, clip.startUs + gesture.deltaUs);

		let minStartUs = 0;
		let maxStartUs = Number.MAX_SAFE_INTEGER;
		for (const other of otherClips) {
			const otherEnd = other.startUs + clipDurationUs(other);
			if (other.startUs < clip.startUs) {
				minStartUs = Math.max(minStartUs, otherEnd);
			} else {
				maxStartUs = Math.min(maxStartUs, other.startUs - dur);
			}
		}
		if (maxStartUs < minStartUs) {
			return project;
		}
		const clampedStartUs = Math.max(minStartUs, Math.min(maxStartUs, requestedStartUs));
		return moveClip(project, clipId, targetTrackId, clampedStartUs);
	}

	const sourceDelta = Math.round(gesture.deltaUs * clip.rate);

	if (gesture.kind === "trim-in") {
		const prevClip = otherClips
			.filter((c) => c.startUs + clipDurationUs(c) <= clip.startUs)
			.pop();
		const minClipStartUs = prevClip ? prevClip.startUs + clipDurationUs(prevClip) : 0;
		const minDurUs = Math.max(10_000, Math.round(1_000_000 / (project.canvas.fps || 30)));
		const maxIn = Math.max(0, clip.sourceOutUs - Math.round(minDurUs * clip.rate));
		let nextIn = Math.max(0, Math.min(maxIn, clip.sourceInUs + sourceDelta));
		let effectiveDelta = Math.round((nextIn - clip.sourceInUs) / clip.rate);
		let nextStartUs = clip.startUs + effectiveDelta;

		if (nextStartUs < minClipStartUs) {
			nextStartUs = minClipStartUs;
			effectiveDelta = nextStartUs - clip.startUs;
			nextIn = clip.sourceInUs + Math.round(effectiveDelta * clip.rate);
		}

		return trimClip(project, clipId, nextIn, clip.sourceOutUs, nextStartUs);
	}

	const asset = project.assets.find((a) => a.id === clip.assetId)!;
	const composition = project.compositions.find((c) => c.id === clip.compositionId);
	const maxSourceDuration = composition?.durationUs ?? asset.durationUs;
	const nextClip = otherClips.find((c) => c.startUs >= clip.startUs + clipDurationUs(clip));
	const maxAllowedEndUs = nextClip ? nextClip.startUs : Number.MAX_SAFE_INTEGER;
	const minDurUs = Math.max(10_000, Math.round(1_000_000 / (project.canvas.fps || 30)));
	const minOut = clip.sourceInUs + Math.round(minDurUs * clip.rate);
	let nextOut = Math.max(minOut, Math.min(maxSourceDuration, clip.sourceOutUs + sourceDelta));
	const effectiveDelta = Math.round((nextOut - clip.sourceOutUs) / clip.rate);
	const candidateEndUs = clip.startUs + clipDurationUs(clip) + effectiveDelta;

	if (candidateEndUs > maxAllowedEndUs) {
		const clampedDur = maxAllowedEndUs - clip.startUs;
		nextOut = clip.sourceInUs + Math.round(clampedDur * clip.rate);
	}

	return trimClip(project, clipId, clip.sourceInUs, Math.min(maxSourceDuration, nextOut));
}
export function findClipsAtPlayhead(project: TimelineProject, playheadUs: number): string[] {
	return project.tracks
		.filter((t) => !t.locked)
		.flatMap((t) => t.clips)
		.filter((c) => c.startUs < playheadUs && playheadUs < c.startUs + clipDurationUs(c))
		.map((c) => c.id);
}
export type TimelineAction = "split" | "delete" | "duplicate" | "rate" | "ripple-delete";
export function timelineActionCommand(
	action: TimelineAction,
	selection: string[],
	playheadUs: number,
	ids?: { clipId: string; compositionId?: string },
	rate = 1,
): ProjectCommand {
	return (project) => {
		let targetIds: string[];
		if (action === "split") {
			const selectedUnderPlayhead = selection.filter((id) => {
				const c = project.tracks.flatMap((t) => t.clips).find((clip) => clip.id === id);
				return c && playheadUs > c.startUs && playheadUs < c.startUs + clipDurationUs(c);
			});
			if (selectedUnderPlayhead.length > 0) {
				targetIds = selectedUnderPlayhead;
			} else {
				targetIds = findClipsAtPlayhead(project, playheadUs);
			}
			if (targetIds.length === 0) {
				return project;
			}
		} else {
			targetIds = selection;
		}

		if (action === "ripple-delete") {
			return rippleRemoveClips(project, targetIds);
		}

		return targetIds.reduce((p, id, index) => {
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
			if (playheadUs <= clip.startUs || playheadUs >= clip.startUs + clipDurationUs(clip)) {
				return p;
			}
			return splitClip(p, id, playheadUs, {
				rightClipId: generated.clipId,
				rightCompositionId: generated.compositionId,
			});
		}, project);
	};
}
