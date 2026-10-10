import { audioAtTime, buildProjectAudioPlan } from "./audioPlan";
import type { TimelineProject } from "./types";
import { mapClipTime } from "./timeMapping";
import {
	sampleClipTransition,
	sampleProjectVisual,
	type EvaluatedClipTransition,
	type EvaluatedComponentAnimations,
	type ProjectVisualSample,
} from "./visualAnimation";
export type ProjectVisual = ProjectVisualSample;
export interface ProjectEvaluation {
	project: TimelineProject;
	timeUs: number;
	visuals: ProjectVisual[];
	visualTransitions: EvaluatedClipTransition[];
	componentAnimations: EvaluatedComponentAnimations[];
	audio: ReturnType<typeof audioAtTime>;
	issues: string[];
}
export function evaluateProject(project: TimelineProject, timeUs: number): ProjectEvaluation {
	if (!Number.isFinite(timeUs) || timeUs < 0) throw new Error("Invalid project time");
	const visuals: ProjectVisual[] = [],
		visualTransitions: EvaluatedClipTransition[] = [],
		componentAnimations: EvaluatedComponentAnimations[] = [],
		issues: string[] = [];
	for (const track of project.tracks) {
		if (track.hidden || track.kind !== "visual") continue;
		for (const clip of track.clips) {
			if (mapClipTime(clip, timeUs) === null) continue;
			try {
				const visual = sampleProjectVisual(project, track, clip, timeUs);
				visuals.push(visual);
				if (visual.componentAnimations)
					componentAnimations.push({
						clipId: clip.id,
						trackId: track.id,
						...visual.componentAnimations,
					});
			} catch (error) {
				issues.push(error instanceof Error ? error.message : String(error));
			}
		}
	}
	const trackOrder = new Map(project.tracks.map((track, index) => [track.id, index]));
	const transitions = [...(project.clipTransitions ?? [])].sort((left, right) => {
		const trackDifference = (trackOrder.get(left.trackId) ?? Number.MAX_SAFE_INTEGER) -
			(trackOrder.get(right.trackId) ?? Number.MAX_SAFE_INTEGER);
		if (trackDifference) return trackDifference;
		const leftBoundary = project.tracks.find((track) => track.id === left.trackId)?.clips.find((clip) => clip.id === left.toClipId)?.startUs ?? 0;
		const rightBoundary = project.tracks.find((track) => track.id === right.trackId)?.clips.find((clip) => clip.id === right.toClipId)?.startUs ?? 0;
		return leftBoundary - rightBoundary;
	});
	for (const transition of transitions) {
		try {
			const sample = sampleClipTransition(project, transition, timeUs);
			if (sample) visualTransitions.push(sample);
		} catch (error) {
			issues.push(error instanceof Error ? error.message : String(error));
		}
	}
	return {
		project,
		timeUs,
		visuals,
		visualTransitions,
		componentAnimations,
		audio: audioAtTime(buildProjectAudioPlan(project), timeUs),
		issues: [...new Set(issues)],
	};
}
