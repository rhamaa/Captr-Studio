import { reconcileClipTransitions } from "./clipTransitions";
import { refreshStoryProjections } from "./storyOwnership";
import { clipDurationUs, type StoryClipContent, type TimelineProject } from "./types";
import { validateTimelineProject } from "./validation";

/** Place source-free content on a compatible visual track without creating a media Asset. */
export function placeInlineDesign(
	view: TimelineProject,
	content: StoryClipContent,
	startUs: number,
	ids: { clipId: string; trackId: string },
	durationUs = content.durationUs,
): TimelineProject {
	const next = structuredClone(view);
	let track = [...next.tracks]
		.reverse()
		.find(
			(candidate) =>
				candidate.kind === "visual" &&
				!candidate.locked &&
				!candidate.hidden &&
				candidate.clips.every(
					(clip) =>
						startUs + durationUs <= clip.startUs ||
						clip.startUs + clipDurationUs(clip) <= startUs,
				),
		);
	if (!track) {
		track = {
			id: ids.trackId,
			name: "Video",
			kind: "visual",
			locked: false,
			muted: false,
			hidden: false,
			clips: [],
		};
		const audioIndex = next.tracks.findIndex((candidate) => candidate.kind === "audio");
		if (audioIndex < 0) next.tracks.push(track);
		else next.tracks.splice(audioIndex, 0, track);
	}
	track.clips.push({
		id: ids.clipId,
		content: structuredClone(content),
		startUs,
		sourceInUs: 0,
		sourceOutUs: durationUs,
		rate: 1,
		transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
		gain: 1,
		enabled: true,
	});
	next.updatedAt = new Date().toISOString();
	return validateTimelineProject(refreshStoryProjections(next));
}

export function applyDesignTemplate(
	view: TimelineProject,
	templateId: string,
	startUs: number,
	ids: { clipId: string; trackId: string },
): TimelineProject {
	const template = view.designTemplates?.find((candidate) => candidate.id === templateId);
	if (!template) throw new Error(`Design template not found: ${templateId}`);
	return placeInlineDesign(view, template.content, startUs, ids, template.defaultDurationUs);
}

/** An explicit extension grows logical source extent; trimming never shrinks that extent. */
export function extendInlineClip(
	view: TimelineProject,
	clipId: string,
	sourceOutUs: number,
): TimelineProject {
	const next = structuredClone(view);
	const track = next.tracks.find((candidate) =>
		candidate.clips.some((clip) => clip.id === clipId),
	);
	const clip = track?.clips.find((candidate) => candidate.id === clipId);
	if (!track || !clip) throw new Error("Inline clip not found");
	if (track.locked) throw new Error("Track is locked");
	if (!clip.content || clip.assetId !== undefined)
		throw new Error("Clip is not an inline design");
	if (!Number.isSafeInteger(sourceOutUs) || sourceOutUs <= clip.sourceOutUs)
		throw new Error("Invalid inline extension extent");
	clip.content.durationUs = Math.max(clip.content.durationUs, sourceOutUs);
	clip.sourceOutUs = sourceOutUs;
	reconcileClipTransitions(next);
	next.updatedAt = new Date().toISOString();
	return validateTimelineProject(refreshStoryProjections(next));
}
