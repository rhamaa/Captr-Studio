import { evaluateRecording } from "@/recording/evaluation";
import { sampleClipTransform } from "./clipTransform";
import { clipDurationUs, type ClipTransition, type ComponentAnimation, type TimelineClip, type TimelineProject, type TimelineTrack, type TransitionEasing, type ClipTransform, type MediaAsset } from "./types";

export interface ComponentAnimationSample {
	edge: "enter" | "exit";
	preset: ComponentAnimation["preset"];
	direction?: ComponentAnimation["direction"];
	progress: number;
}

export interface ProjectVisualSample {
	clipId: string;
	trackId: string;
	clip: TimelineClip;
	asset: MediaAsset;
	path: string;
	sourceUs: number;
	compositionUs: number;
	projectSampleUs: number;
	transform: ClipTransform;
	recording?: ReturnType<typeof evaluateRecording>;
	componentAnimations?: { enter: ComponentAnimationSample | null; exit: ComponentAnimationSample | null };
}

export interface EvaluatedComponentAnimations {
	clipId: string;
	trackId: string;
	enter: ComponentAnimationSample | null;
	exit: ComponentAnimationSample | null;
}

export interface EvaluatedClipTransition {
	id: string;
	trackId: string;
	fromClipId: string;
	toClipId: string;
	startUs: number;
	endUs: number;
	progress: number;
	preset: ClipTransition["preset"];
	easing: TransitionEasing;
	outgoing: ProjectVisualSample;
	incoming: ProjectVisualSample;
}

export function easeVisualProgress(progress: number, easing: TransitionEasing): number {
	const t = Math.max(0, Math.min(1, progress));
	switch (easing) {
		case "ease-in":
			return t * t;
		case "ease-out":
			return 1 - (1 - t) * (1 - t);
		case "ease-in-out":
			return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
		default:
			return t;
	}
}

export function sampleComponentAnimation(
	animation: ComponentAnimation,
	edge: "enter" | "exit",
	clipStartUs: number,
	clipEndUs: number,
	timeUs: number,
): ComponentAnimationSample | null {
	if (![clipStartUs, clipEndUs, timeUs, animation.durationUs].every(Number.isFinite))
		throw new Error("Invalid component animation sample time");
	if (clipEndUs <= clipStartUs || animation.durationUs <= 0) return null;
	const durationUs = Math.min(animation.durationUs, clipEndUs - clipStartUs),
		startUs = edge === "enter" ? clipStartUs : clipEndUs - durationUs,
		endUs = edge === "enter" ? clipStartUs + durationUs : clipEndUs;
	if (timeUs < startUs || timeUs >= endUs) return null;
	const sample: ComponentAnimationSample = {
		edge,
		preset: animation.preset,
		progress: easeVisualProgress((timeUs - startUs) / durationUs, animation.easing),
	};
	if (animation.direction) sample.direction = animation.direction;
	return sample;
}

function visualSample(
	project: TimelineProject,
	track: TimelineTrack,
	clip: TimelineClip,
	timeUs: number,
): ProjectVisualSample {
	const asset = project.assets.find((candidate) => candidate.id === clip.assetId);
	if (!asset) throw new Error(`Missing asset for ${clip.id}`);
	const compositionUs = clip.sourceInUs + (timeUs - clip.startUs) * clip.rate,
		clipSourceDurationUs = clip.sourceOutUs - clip.sourceInUs,
		transform = sampleClipTransform(
			clip,
			Math.max(0, Math.min(clipSourceDurationUs, (timeUs - clip.startUs) * clip.rate)),
		);
	let path = "",
		sourceUs = compositionUs,
		recording: ReturnType<typeof evaluateRecording> | undefined;
	if (asset.kind === "recording") {
		const pkg = project.packages.find((candidate) => candidate.id === asset.packageId),
			composition = project.compositions.find((candidate) => candidate.id === clip.compositionId);
		if (!pkg?.screen.path || !composition) throw new Error(`Missing screen source for ${clip.id}`);
		recording = evaluateRecording(pkg, composition, compositionUs);
		if (recording.screenUs === null) throw new Error(`Missing screen frame for ${clip.id}`);
		path = pkg.screen.path;
		sourceUs = recording.screenUs;
	} else if (asset.kind === "video" || asset.kind === "image") {
		if (!asset.source?.path) throw new Error(`Missing media source for ${clip.id}`);
		path = asset.source.path;
	} else if (asset.kind === "audio") {
		throw new Error(`Audio asset cannot render on visual track for ${clip.id}`);
	}
	const clipEndUs = clip.startUs + clipDurationUs(clip);
	const componentAnimations = clip.componentAnimation
		? {
				enter: clip.componentAnimation.enter
					? sampleComponentAnimation(clip.componentAnimation.enter, "enter", clip.startUs, clipEndUs, timeUs)
					: null,
				exit: clip.componentAnimation.exit
					? sampleComponentAnimation(clip.componentAnimation.exit, "exit", clip.startUs, clipEndUs, timeUs)
					: null,
			}
		: undefined;
	return {
		clipId: clip.id,
		trackId: track.id,
		clip,
		asset,
		path,
		sourceUs,
		compositionUs,
		projectSampleUs: timeUs,
		transform,
		...(recording ? { recording } : {}),
		...(componentAnimations ? { componentAnimations } : {}),
	};
}

export function sampleProjectVisual(
	project: TimelineProject,
	track: TimelineTrack,
	clip: TimelineClip,
	timeUs: number,
): ProjectVisualSample {
	return visualSample(project, track, clip, timeUs);
}

export function sampleClipTransition(
	project: TimelineProject,
	transition: ClipTransition,
	timeUs: number,
): EvaluatedClipTransition | null {
	if (!Number.isFinite(timeUs)) throw new Error("Invalid transition sample time");
	const track = project.tracks.find((candidate) => candidate.id === transition.trackId);
	if (track?.kind !== "visual") throw new Error("Transition must reference a visual track");
	const orderedClips = [...track.clips].sort((a, b) => a.startUs - b.startUs),
		fromIndex = orderedClips.findIndex((clip) => clip.id === transition.fromClipId),
		from = orderedClips[fromIndex],
		to = orderedClips[fromIndex + 1];
	if (!from || !to || !from.enabled || !to.enabled)
		throw new Error("Transition references a missing or disabled clip");
	const boundaryUs = to.startUs;
	if (to.id !== transition.toClipId || from.startUs + clipDurationUs(from) !== boundaryUs)
		throw new Error("Transition clips must be directly adjacent");
	if (!Number.isSafeInteger(transition.durationUs) || transition.durationUs <= 0)
		throw new Error("Invalid transition duration");
	const startUs = boundaryUs - transition.durationUs / 2,
		endUs = boundaryUs + transition.durationUs / 2;
	if (timeUs < startUs || timeUs >= endUs) return null;
	const fromTrack = track;
	return {
		id: transition.id,
		trackId: transition.trackId,
		fromClipId: from.id,
		toClipId: to.id,
		startUs,
		endUs,
		progress: easeVisualProgress((timeUs - startUs) / transition.durationUs, transition.easing),
		preset: transition.preset,
		easing: transition.easing,
		outgoing: visualSample(project, fromTrack, from, timeUs),
		incoming: visualSample(project, fromTrack, to, timeUs),
	};
}
