import { applyStoryCommand, getStoryProject, listStoryScopes } from "./storyOwnership";
import type { PrivateMediaAsset, StoryScope, TimelineProject } from "./types";

/** Registration deliberately has no placement or filesystem side effects. */
export function registerStoryMedia(
	project: TimelineProject,
	scope: StoryScope,
	asset: PrivateMediaAsset,
): TimelineProject {
	getStoryProject(project, scope);
	if (!["video", "image", "audio"].includes(asset.kind))
		throw new Error("Private media must be video, image, or audio");
	if (
		project.assets.some((candidate) => candidate.id === asset.id) ||
		listStoryScopes(project).some((owner) =>
			getStoryProject(project, owner).localAssets?.some(
				(candidate) => candidate.id === asset.id,
			),
		)
	)
		throw new Error(`Duplicate media identity: ${asset.id}`);
	return applyStoryCommand(project, scope, (view) => ({
		...view,
		localAssets: [...(view.localAssets ?? []), structuredClone(asset)],
		updatedAt: new Date().toISOString(),
	}));
}

export function removeStoryMedia(
	project: TimelineProject,
	scope: StoryScope,
	assetId: string,
): TimelineProject {
	const owner = getStoryProject(project, scope);
	if (!owner.localAssets?.some((asset) => asset.id === assetId))
		throw new Error("Private media not found in Story owner");
	if (owner.tracks.some((track) => track.clips.some((clip) => clip.assetId === assetId)))
		throw new Error("Story media is referenced by timeline clips");
	return applyStoryCommand(project, scope, (view) => ({
		...view,
		localAssets: view.localAssets!.filter((asset) => asset.id !== assetId),
		updatedAt: new Date().toISOString(),
	}));
}
