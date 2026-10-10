import type { StoryScope, TimelineProject } from "./types";

export function listStoryScopes(project: TimelineProject): StoryScope[] {
	return [
		{ kind: "root" },
		...(project.repurposeBoard?.artboards ?? []).map((artboard) => ({
			kind: "artboard" as const,
			artboardId: artboard.id,
		})),
	];
}

/** A read-only projection; ownership is materialized by normalization, never by lookup. */
export function getStoryProject(project: TimelineProject, scope: StoryScope): TimelineProject {
	if (scope.kind === "root") return project;
	const owner = project.repurposeBoard?.artboards.find(
		(artboard) => artboard.id === scope.artboardId,
	);
	if (!owner) throw new Error(`Story owner not found: ${scope.artboardId}`);
	if (!owner.tracks)
		throw new Error(`Story owner has not been materialized: ${scope.artboardId}`);
	return {
		...project,
		canvas: { ...project.canvas, width: owner.width, height: owner.height },
		tracks: owner.tracks,
		localAssets: owner.localAssets,
		clipTransitions: owner.clipTransitions,
		subtitles: owner.subtitles,
		repurposeBoard: undefined,
		stories: undefined,
	};
}
