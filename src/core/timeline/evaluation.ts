import type { TimelineProject, TimelineClip, MediaAsset } from "./types";
import { mapClipTime } from "./timeMapping";
import { evaluateRecording } from "@/recording/evaluation";
import { audioAtTime, buildProjectAudioPlan } from "./audioPlan";
export interface ProjectVisual {
	clipId: string;
	trackId: string;
	clip: TimelineClip;
	asset: MediaAsset;
	path: string;
	sourceUs: number;
	compositionUs: number;
	recording?: ReturnType<typeof evaluateRecording>;
}
export interface ProjectEvaluation {
	project: TimelineProject;
	timeUs: number;
	visuals: ProjectVisual[];
	audio: ReturnType<typeof audioAtTime>;
	issues: string[];
}
export function evaluateProject(project: TimelineProject, timeUs: number): ProjectEvaluation {
	if (!Number.isFinite(timeUs) || timeUs < 0) throw new Error("Invalid project time");
	const visuals: ProjectVisual[] = [],
		issues: string[] = [];
	for (const track of project.tracks) {
		if (track.hidden || track.kind !== "visual") continue;
		for (const clip of track.clips) {
			const compositionUs = mapClipTime(clip, timeUs);
			if (compositionUs === null) continue;
			const asset = project.assets.find((a) => a.id === clip.assetId);
			if (!asset) {
				issues.push(`Missing asset for ${clip.id}`);
				continue;
			}
			if (asset.kind === "text") {
				visuals.push({
					clipId: clip.id,
					trackId: track.id,
					clip,
					asset,
					path: "",
					sourceUs: compositionUs,
					compositionUs,
				});
			} else if (asset.kind === "recording") {
				const pkg = project.packages.find((p) => p.id === asset.packageId),
					composition = project.compositions.find((c) => c.id === clip.compositionId);
				if (!pkg?.screen.path || !composition) {
					issues.push(`Missing screen source for ${clip.id}`);
					continue;
				}
				const recording = evaluateRecording(pkg, composition, compositionUs);
				if (recording.screenUs === null) {
					issues.push(`Missing screen frame for ${clip.id}`);
					continue;
				}
				visuals.push({
					clipId: clip.id,
					trackId: track.id,
					clip,
					asset,
					path: pkg.screen.path,
					sourceUs: recording.screenUs,
					compositionUs,
					recording,
				});
			} else if (asset.source?.path)
				visuals.push({
					clipId: clip.id,
					trackId: track.id,
					clip,
					asset,
					path: asset.source.path,
					sourceUs: compositionUs,
					compositionUs,
				});
			else issues.push(`Missing media source for ${clip.id}`);
		}
	}
	return {
		project,
		timeUs,
		visuals,
		audio: audioAtTime(buildProjectAudioPlan(project), timeUs),
		issues,
	};
}
