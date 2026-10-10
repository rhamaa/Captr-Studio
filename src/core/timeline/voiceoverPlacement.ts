import { resolveMediaAsset } from "./clipSource";
import { addTrack, placeAsset } from "./commands";
import { clipDurationUs, type TimelineProject } from "./types";

export function placeVoiceover(
	project: TimelineProject,
	assetId: string,
	startUs: number,
	ids: { clipId: string; trackId: string },
): TimelineProject {
	const asset = resolveMediaAsset(project, assetId);
	if (asset.kind !== "audio") throw new Error("Voiceover asset must be audio");
	if (
		!Number.isSafeInteger(startUs) ||
		startUs < 0 ||
		!Number.isSafeInteger(asset.durationUs) ||
		asset.durationUs <= 0 ||
		!Number.isSafeInteger(startUs + asset.durationUs)
	)
		throw new Error("Invalid voiceover start time or duration");

	const endUs = startUs + asset.durationUs;
	const canPlaceOnTrack = (track: TimelineProject["tracks"][number]) =>
		track.kind === "audio" &&
		!track.locked &&
		track.clips.every((clip) => {
			const clipEndUs = clip.startUs + clipDurationUs(clip);
			return !(startUs < clipEndUs && clip.startUs < endUs);
		});

	const availableTrack = project.tracks.find(canPlaceOnTrack);
	if (availableTrack)
		return placeAsset(project, assetId, availableTrack.id, startUs, { clipId: ids.clipId });

	if (project.tracks.some((track) => track.id === ids.trackId))
		throw new Error("New audio track ID already exists");

	const withAudioTrack = addTrack(project, ids.trackId, "audio");
	return placeAsset(withAudioTrack, assetId, ids.trackId, startUs, { clipId: ids.clipId });
}
