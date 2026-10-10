import { extractStoriesFromProject, generateStoryManifest } from "../story/storyUtils";
import type { ProjectCommand } from "./history";
import type { StoryScope, TimelineProject } from "./types";
import { sameMetadata, validateTimelineProject } from "./validation";

/** Transient proposal identity; never serialized into the project. */
export interface StoryEditContext {
	scope: StoryScope;
	projectId: string;
	generation: number;
	revision: number;
}

export function sameStoryEditContext(
	a: StoryEditContext | undefined,
	b: StoryEditContext | undefined,
): boolean {
	return Boolean(
		a?.scope &&
			b?.scope &&
			typeof a.projectId === "string" &&
			Number.isSafeInteger(a.generation) &&
			Number.isSafeInteger(a.revision) &&
			a.revision >= 0 &&
			a.projectId === b.projectId &&
			a.generation === b.generation &&
			a.revision === b.revision &&
			a.scope.kind === b.scope.kind &&
			(a.scope.kind === "root" ||
				(b.scope.kind === "artboard" && a.scope.artboardId === b.scope.artboardId)),
	);
}

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
		canvas: { ...(owner.canvas ?? project.canvas), width: owner.width, height: owner.height },
		storyMetadata: owner.storyMetadata,
		tracks: owner.tracks,
		localAssets: owner.localAssets,
		clipTransitions: owner.clipTransitions,
		subtitles: owner.subtitles,
		repurposeBoard: undefined,
		stories: undefined,
		storyManifest: undefined,
	};
}

/** Regenerate mirrors only after canonical state changes; stale Record mirrors cannot veto edits. */
export function refreshStoryProjections(project: TimelineProject): TimelineProject {
	const stories = extractStoriesFromProject(project);
	return { ...project, stories, storyManifest: generateStoryManifest(stories) };
}

/** Agent drafts expose only the captured sequence and its owned Record compositions. */
export function getStoryEditProject(project: TimelineProject, scope: StoryScope): TimelineProject {
	const view = getStoryProject(project, scope);
	const owned = new Set(
		view.tracks.flatMap((t) => t.clips.map((c) => c.compositionId).filter(Boolean)),
	);
	return {
		...view,
		compositions: view.compositions.filter((c) => owned.has(c.id)),
		repurposeBoard: undefined,
		stories: undefined,
		storyManifest: undefined,
	};
}

/** Keep existing shared catalog entries immutable while admitting new imports. */
function appendSharedImports<T extends { id: string }>(existing: T[], updated: T[], name: string) {
	if (!Array.isArray(updated)) throw new Error(`Invalid shared ${name} library`);
	for (const entry of existing) {
		const candidate = updated.find((item) => item.id === entry.id);
		if (!candidate || !sameMetadata(entry, candidate))
			throw new Error(`Story command cannot modify or remove shared ${name}: ${entry.id}`);
	}
	const existingIds = new Set(existing.map((entry) => entry.id));
	const imports = updated.filter((entry) => !existingIds.has(entry.id));
	if (new Set(updated.map((entry) => entry.id)).size !== updated.length)
		throw new Error(`Duplicate shared ${name} identity`);
	return { entries: [...existing, ...imports], imports };
}

/** Execute against an isolated view, then atomically validate the complete canonical project. */
export function applyStoryCommand(
	project: TimelineProject,
	scope: StoryScope,
	command: ProjectCommand,
): TimelineProject {
	const originalView = getStoryProject(project, scope);
	const view = structuredClone(originalView);
	view.repurposeBoard = undefined;
	view.stories = undefined;
	view.storyManifest = undefined;
	const ownedCompositions = new Set(
		view.tracks.flatMap((t) => t.clips.map((c) => c.compositionId).filter(Boolean)),
	);
	view.compositions = view.compositions.filter((c) => ownedCompositions.has(c.id));
	const updated = command(view);
	if (updated.projectId !== project.projectId)
		throw new Error("Story command changed project identity");
	const assets = appendSharedImports(project.assets, updated.assets, "asset");
	const packages = appendSharedImports(project.packages, updated.packages, "package");
	for (const asset of assets.imports) {
		const published = originalView.localAssets?.find((media) => media.id === asset.id);
		if (published && !sameMetadata(published, asset))
			throw new Error(`Story publication must preserve private media: ${asset.id}`);
	}
	for (const pkg of packages.imports)
		if (
			!assets.imports.some(
				(asset) => asset.kind === "recording" && asset.packageId === pkg.id,
			)
		)
			throw new Error(`Imported package requires a new global Recording Asset: ${pkg.id}`);
	if (
		!sameMetadata(
			project.designTemplates === undefined ? [] : project.designTemplates,
			updated.designTemplates === undefined ? [] : updated.designTemplates,
		)
	)
		throw new Error("Story command cannot modify shared design templates");
	let next: TimelineProject = {
		...project,
		assets: assets.entries,
		packages: packages.entries,
		compositions: [
			...project.compositions.filter((c) => !ownedCompositions.has(c.id)),
			...updated.compositions,
		],
		designTemplates: project.designTemplates,
		updatedAt: updated.updatedAt,
	};
	if (scope.kind === "root") {
		next = {
			...next,
			tracks: updated.tracks,
			localAssets: updated.localAssets,
			clipTransitions: updated.clipTransitions,
			canvas: updated.canvas,
			subtitles: updated.subtitles,
			storyMetadata: updated.storyMetadata,
		};
	} else {
		next.repurposeBoard = {
			...project.repurposeBoard!,
			artboards: project.repurposeBoard!.artboards.map((owner) =>
				owner.id === scope.artboardId
					? {
							...owner,
							tracks: updated.tracks,
							localAssets: updated.localAssets,
							clipTransitions: updated.clipTransitions,
							canvas: updated.canvas,
							width: updated.canvas.width,
							height: updated.canvas.height,
							subtitles: updated.subtitles,
							storyMetadata: updated.storyMetadata,
						}
					: owner,
			),
		};
	}
	return validateTimelineProject(refreshStoryProjections(next));
}

type StorySequence = Pick<
	TimelineProject,
	"tracks" | "clipTransitions" | "localAssets" | "subtitles"
>;

/** Snapshot placements and owned file identities; shared media/package identities remain untouched. */
export function createStorySnapshot(
	project: TimelineProject,
	source: StorySequence,
	newId: (kind: string, oldId: string) => string = () => crypto.randomUUID(),
) {
	const sourceIds = [
		...source.tracks.flatMap((track) => [track.id, ...track.clips.map((clip) => clip.id)]),
		...(source.clipTransitions ?? []).map((transition) => transition.id),
		...(source.localAssets ?? []).map((asset) => asset.id),
	];
	if (
		new Set(sourceIds).size !== sourceIds.length ||
		sourceIds.some((id) => !/^[a-zA-Z0-9_-]+$/.test(id))
	)
		throw new Error("Duplicate or invalid snapshot source ID");
	const snapshot = structuredClone({
		tracks: source.tracks,
		clipTransitions: source.clipTransitions,
		localAssets: source.localAssets,
		subtitles: source.subtitles,
	});
	const tracks = new Map<string, string>();
	const clips = new Map<string, string>();
	const media = new Map<string, string>();
	const compositions: TimelineProject["compositions"] = [];
	for (const asset of snapshot.localAssets ?? []) {
		const id = newId("media", asset.id);
		media.set(asset.id, id);
		asset.id = id;
	}
	for (const track of snapshot.tracks) {
		const id = newId("track", track.id);
		tracks.set(track.id, id);
		track.id = id;
		for (const clip of track.clips) {
			const id = newId("clip", clip.id);
			clips.set(clip.id, id);
			clip.id = id;
			if (clip.assetId && media.has(clip.assetId)) clip.assetId = media.get(clip.assetId)!;
			if (clip.compositionId) {
				const original = project.compositions.find((c) => c.id === clip.compositionId);
				if (!original) throw new Error(`Missing Record composition: ${clip.compositionId}`);
				const id = newId("composition", original.id);
				compositions.push({ ...structuredClone(original), id });
				clip.compositionId = id;
			}
		}
	}
	for (const transition of snapshot.clipTransitions ?? []) {
		transition.id = newId("transition", transition.id);
		if (
			!tracks.has(transition.trackId) ||
			!clips.has(transition.fromClipId) ||
			!clips.has(transition.toClipId)
		)
			throw new Error("Snapshot transition references missing placements");
		transition.trackId = tracks.get(transition.trackId)!;
		transition.fromClipId = clips.get(transition.fromClipId)!;
		transition.toClipId = clips.get(transition.toClipId)!;
	}
	return { ...snapshot, compositions };
}
