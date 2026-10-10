import { clipDurationUs, projectDurationUs, type ClipTransition, type ComponentAnimation, type TimelineProject } from "./types";
import { validateTimelineProject } from "./validation";

type TransitionInput = Omit<ClipTransition, "id" | "durationUs"> & { durationUs?: number };

function clipLocation(project: TimelineProject, clipId: string) {
	for (const track of project.tracks) {
		const clip = track.clips.find((candidate) => candidate.id === clipId);
		if (clip) return { track, clip };
	}
	throw new Error(`Clip not found: ${clipId}`);
}

function eligiblePair(project: TimelineProject, fromClipId: string, toClipId: string) {
	const from = clipLocation(project, fromClipId),
		to = clipLocation(project, toClipId);
	if (from.track.id !== to.track.id) throw new Error("Transition clips must be on the same track");
	if (from.track.kind !== "visual") throw new Error("Transitions require a visual track");
	if (!from.clip.enabled || !to.clip.enabled) throw new Error("Transition clips must be enabled");
	if (from.clip.id === to.clip.id || from.clip.startUs + clipDurationUs(from.clip) !== to.clip.startUs)
		throw new Error("Transition clips must be directly adjacent");
	const ordered = [...from.track.clips].sort((a, b) => a.startUs - b.startUs),
		fromIndex = ordered.findIndex((clip) => clip.id === fromClipId);
	if (ordered[fromIndex + 1]?.id !== toClipId)
		throw new Error("Transition clips must be directly adjacent");
	const fromAsset = project.assets.find((asset) => asset.id === from.clip.assetId),
		toAsset = project.assets.find((asset) => asset.id === to.clip.assetId);
	if (!fromAsset || !toAsset) throw new Error("Transition clip asset is missing");
	const fromComposition = from.clip.compositionId
		? project.compositions.find((item) => item.id === from.clip.compositionId)
		: undefined;
	const toComposition = to.clip.compositionId
		? project.compositions.find((item) => item.id === to.clip.compositionId)
		: undefined;
	if (fromAsset.kind === "recording" && !fromComposition)
		throw new Error("Outgoing recording composition is missing");
	if (toAsset.kind === "recording" && !toComposition)
		throw new Error("Incoming recording composition is missing");
	return { from, to, fromAsset, toAsset, fromComposition };
}

/** Returns the largest centered transition duration that fits source handles and project bounds. */
export function getMaxClipTransitionDurationUs(
	project: TimelineProject,
	fromClipId: string,
	toClipId: string,
	excludeTransitionId?: string,
): number {
	const { from, to, fromAsset, toAsset, fromComposition } = eligiblePair(
		project,
		fromClipId,
		toClipId,
	);
	const outgoingSourceDuration =
		fromAsset.kind === "shape" || fromAsset.kind === "image"
			? Number.POSITIVE_INFINITY
			: (fromComposition?.durationUs ?? fromAsset.durationUs);
	const incomingSourceStart =
		toAsset.kind === "shape" || toAsset.kind === "image" ? Number.POSITIVE_INFINITY : to.clip.sourceInUs;
	const outgoingTailUs =
		fromAsset.kind === "shape" || fromAsset.kind === "image"
			? Number.POSITIVE_INFINITY
			: Math.max(0, (outgoingSourceDuration - from.clip.sourceOutUs) / from.clip.rate);
	const incomingHeadUs =
		toAsset.kind === "shape" || toAsset.kind === "image"
			? Number.POSITIVE_INFINITY
			: incomingSourceStart / to.clip.rate;
	const boundaryUs = to.clip.startUs,
		projectEndUs = projectDurationUs(project),
		projectHeadUs = boundaryUs,
		projectTailUs = Math.max(0, projectEndUs - boundaryUs),
	maxHalfDurationUs = Math.min(outgoingTailUs, incomingHeadUs, projectHeadUs, projectTailUs);
	let maximumUs = Number.isFinite(maxHalfDurationUs)
		? Math.max(0, Math.floor(maxHalfDurationUs * 2))
		: Number.MAX_SAFE_INTEGER;
	for (const transition of project.clipTransitions ?? []) {
		if (transition.id === excludeTransitionId || transition.trackId !== from.track.id) continue;
		const existingTo = from.track.clips.find((clip) => clip.id === transition.toClipId);
		if (!existingTo) continue;
		const boundaryDistanceUs = Math.abs(boundaryUs - existingTo.startUs);
		maximumUs = Math.min(maximumUs, Math.max(0, 2 * boundaryDistanceUs - transition.durationUs));
	}
	return maximumUs;
}

export function addClipTransition(
	project: TimelineProject,
	input: TransitionInput,
	transitionId: string,
): TimelineProject {
	const { from } = eligiblePair(project, input.fromClipId, input.toClipId);
	if (from.track.id !== input.trackId) throw new Error("Transition track does not match its clips");
	if (from.track.locked) throw new Error("Cannot add a transition to a locked track");
	if (!/^[a-zA-Z0-9_-]+$/.test(transitionId)) throw new Error("Invalid transition ID");
	if (project.clipTransitions?.some((transition) => transition.id === transitionId))
		throw new Error("Duplicate transition ID");
	const maximumUs = getMaxClipTransitionDurationUs(project, input.fromClipId, input.toClipId);
	if (maximumUs <= 0) throw new Error("No transition handle is available");
	const durationUs = input.durationUs ?? Math.min(500_000, maximumUs);
	if (!Number.isSafeInteger(durationUs) || durationUs <= 0 || durationUs > maximumUs)
		throw new Error(`Transition exceeds maximum available handle duration of ${maximumUs} µs`);
	const next = structuredClone(project);
	next.clipTransitions ??= [];
	next.clipTransitions.push({ ...structuredClone(input), id: transitionId, durationUs });
	next.updatedAt = new Date().toISOString();
	return validateTimelineProject(next, { mode: "legacy" });
}

export function updateClipTransition(
	project: TimelineProject,
	transitionId: string,
	patch: Partial<Pick<ClipTransition, "preset" | "durationUs" | "easing">>,
): TimelineProject {
	const next = structuredClone(project),
		transition = next.clipTransitions?.find((item) => item.id === transitionId);
	if (!transition) throw new Error("Transition not found");
	const maximumUs = getMaxClipTransitionDurationUs(next, transition.fromClipId, transition.toClipId, transition.id);
	Object.assign(transition, structuredClone(patch));
	if (!Number.isSafeInteger(transition.durationUs) || transition.durationUs <= 0 || transition.durationUs > maximumUs)
		throw new Error(`Transition exceeds maximum available handle duration of ${maximumUs} µs`);
	next.updatedAt = new Date().toISOString();
	return validateTimelineProject(next, { mode: "legacy" });
}

export function removeClipTransition(project: TimelineProject, transitionId: string): TimelineProject {
	const next = structuredClone(project),
		transitions = next.clipTransitions ?? [],
		remaining = transitions.filter((item) => item.id !== transitionId);
	if (remaining.length === transitions.length) throw new Error("Transition not found");
	next.clipTransitions = remaining;
	next.updatedAt = new Date().toISOString();
	return validateTimelineProject(next, { mode: "legacy" });
}

export function reconcileClipTransitions(project: TimelineProject): void {
	const transitions = project.clipTransitions ?? [];
	project.clipTransitions = transitions.filter((transition) => {
		try {
			const { from, to } = eligiblePair(project, transition.fromClipId, transition.toClipId);
			return from.track.id === transition.trackId && from.track.id === to.track.id;
		} catch {
			return false;
		}
	});
	for (const transition of project.clipTransitions) {
		const maximumUs = getMaxClipTransitionDurationUs(project, transition.fromClipId, transition.toClipId, transition.id);
		if (transition.durationUs > maximumUs)
			throw new Error(`Trim would remove required transition handle; maximum is ${maximumUs} µs`);
	}
}

export function setComponentAnimation(
	project: TimelineProject,
	clipId: string,
	edge: "enter" | "exit",
	animation: ComponentAnimation | null,
): TimelineProject {
	const next = structuredClone(project),
		{ track, clip } = clipLocation(next, clipId);
	if (track.locked) throw new Error("Cannot edit a component on a locked track");
	if (animation === null) {
		if (clip.componentAnimation) delete clip.componentAnimation[edge];
	} else {
		clip.componentAnimation ??= {};
		clip.componentAnimation[edge] = structuredClone(animation);
	}
	if (clip.componentAnimation && !clip.componentAnimation.enter && !clip.componentAnimation.exit)
		delete clip.componentAnimation;
	next.updatedAt = new Date().toISOString();
	return validateTimelineProject(next, { mode: "legacy" });
}
