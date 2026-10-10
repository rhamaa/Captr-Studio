import { artboardToStory, createDefaultStory, storyToArtboard } from "../story/storyUtils";
import {
	createStorySnapshot,
	getStoryProject,
	listStoryScopes,
	refreshStoryProjections,
} from "./storyOwnership";
import type { StoryClipContent, TimelineClip, TimelineProject } from "./types";
import { validateStoryPresentation, validateTimelineProject } from "./validation";

/** Legacy ingress only. Never mutate the source project or persist migration during load. */
export function normalizeStoryOwnership(input: TimelineProject): TimelineProject {
	const project = structuredClone(input);
	const array = (value: unknown, name: string, required = false) => {
		if ((required || value !== undefined) && !Array.isArray(value))
			throw new Error(`Invalid ${name}: expected an array`);
	};
	const ownerCollections = (owner: {
		tracks?: unknown;
		localAssets?: unknown;
		clipTransitions?: unknown;
	}) => {
		array(owner.tracks, "Story tracks");
		array(owner.localAssets, "Story localAssets");
		array(owner.clipTransitions, "Story clipTransitions");
	};
	for (const key of ["assets", "packages", "compositions", "tracks"] as const)
		array(project[key], key, true);
	for (const key of ["stories", "storyManifest", "designTemplates"] as const)
		array(project[key], key);
	ownerCollections(project);
	if (project.repurposeBoard !== undefined) {
		if (!project.repurposeBoard || typeof project.repurposeBoard !== "object")
			throw new Error("Invalid repurpose board");
		array(project.repurposeBoard.artboards, "Artboards", true);
		array(project.repurposeBoard.slices, "Repurpose slices", true);
		for (const owner of project.repurposeBoard.artboards) ownerCollections(owner);
	}
	for (const story of project.stories ?? []) {
		array(story.tracks, "Story projection tracks", true);
		ownerCollections(story);
	}
	validateStoryPresentation(project);
	for (const owner of project.repurposeBoard?.artboards ?? []) validateStoryPresentation(owner);
	const occupied = new Set<string>();
	const collect = (value: unknown): void => {
		if (!value || typeof value !== "object") return;
		if ("id" in value && typeof value.id === "string") occupied.add(value.id);
		for (const child of Object.values(value)) collect(child);
	};
	collect(project);
	const allocate = (owner: string) => (kind: string, old: string) => {
		const base = `story-${owner}-${kind}-${old}`.replace(/[^a-zA-Z0-9_-]/g, "_");
		let id = base,
			suffix = 2;
		while (occupied.has(id)) id = `${base}-${suffix++}`;
		occupied.add(id);
		return id;
	};
	const mapped = new Set<string>();
	const storyIds = new Set<string>();
	for (const story of project.stories ?? []) {
		if (storyIds.has(story.id)) throw new Error("Ambiguous duplicate Story identity");
		storyIds.add(story.id);
		const candidates = (project.repurposeBoard?.artboards ?? []).filter((ab) =>
			story.artboardId !== undefined
				? ab.id === story.artboardId
				: ab.id === story.id ||
					`story-${ab.id}` === story.id ||
					ab.storyMetadata?.id === story.id,
		);
		const root =
			story.artboardId === undefined &&
			story.id === (project.defaultStoryId ?? project.storyMetadata?.id ?? "story-main");
		if (candidates.length > 1 || (root && candidates.length))
			throw new Error("Ambiguous Story owner");
		if (story.artboardId !== undefined && !candidates.length)
			throw new Error(`Story owner not found: ${story.artboardId}`);
		let owner:
			| TimelineProject
			| NonNullable<TimelineProject["repurposeBoard"]>["artboards"][number];
		if (root) owner = project;
		else if (candidates[0]) owner = candidates[0];
		else {
			// A standalone Story becomes a canonical owner, retaining all original placements.
			const artboard = storyToArtboard(story);
			if (project.repurposeBoard === undefined)
				project.repurposeBoard = { artboards: [], slices: [], activeSliceId: null };
			if (project.repurposeBoard.artboards.some((ab) => ab.id === artboard.id))
				throw new Error("Ambiguous standalone Story owner");
			project.repurposeBoard.artboards.push(artboard);
			owner = artboard;
		}
		const key = owner === project ? "root" : `artboard:${"id" in owner ? owner.id : ""}`;
		if (mapped.has(key)) throw new Error("Ambiguous multiple Stories for one owner");
		mapped.add(key);
		if (owner.localAssets === undefined) owner.localAssets = structuredClone(story.localAssets);
		if (owner.subtitles === undefined) owner.subtitles = structuredClone(story.subtitles);
		if (owner.clipTransitions === undefined)
			owner.clipTransitions = structuredClone(story.clipTransitions);
		const metadata = {
			id: story.id,
			createdAt: story.createdAt,
			updatedAt: story.updatedAt,
			...(root
				? { name: story.name, aspectRatio: story.aspectRatio, framing: story.framing }
				: {}),
		};
		owner.storyMetadata = { ...metadata, ...owner.storyMetadata };
		if (root) {
			if (project.defaultStoryId === undefined) project.defaultStoryId = story.id;
			project.canvas = { ...story.canvas, ...project.canvas };
		} else {
			const artboard = owner as NonNullable<
				TimelineProject["repurposeBoard"]
			>["artboards"][number];
			if (artboard.canvas === undefined) artboard.canvas = structuredClone(story.canvas);
		}
	}
	// Projections are never a source of newer sequence data. Remove them before checking edits.
	project.stories = undefined;
	project.storyManifest = undefined;
	const seen = new Set<string>();
	const sequenceIds = (owner: Pick<TimelineProject, "tracks" | "clipTransitions">) => [
		...owner.tracks.flatMap((t) => [
			t.id,
			...t.clips.flatMap((c) => [c.id, ...(c.compositionId ? [c.compositionId] : [])]),
		]),
		...(owner.clipTransitions ?? []).map((t) => t.id),
	];
	for (const id of sequenceIds(project)) seen.add(id);
	for (const artboard of project.repurposeBoard?.artboards ?? []) {
		const inherited = artboard.tracks === undefined;
		const source = inherited
			? {
					tracks: project.tracks,
					clipTransitions:
						artboard.clipTransitions === undefined
							? project.clipTransitions
							: artboard.clipTransitions,
					localAssets: project.localAssets,
					subtitles: project.subtitles,
				}
			: {
					tracks: artboard.tracks!,
					clipTransitions: artboard.clipTransitions,
					localAssets: artboard.localAssets,
					subtitles: artboard.subtitles,
				};
		if (inherited || sequenceIds(source).some((id) => seen.has(id))) {
			const snapshot = createStorySnapshot(project, source, allocate(artboard.id));
			artboard.tracks = snapshot.tracks;
			artboard.clipTransitions = snapshot.clipTransitions;
			// Explicit local/caption metadata wins; root-private media is copied for inherited clips.
			artboard.localAssets =
				inherited && artboard.localAssets !== undefined
					? [...artboard.localAssets, ...(snapshot.localAssets ?? [])]
					: snapshot.localAssets;
			if (artboard.subtitles === undefined) artboard.subtitles = snapshot.subtitles;
			project.compositions.push(...snapshot.compositions);
		}
		for (const id of sequenceIds({
			tracks: artboard.tracks!,
			clipTransitions: artboard.clipTransitions,
		}))
			seen.add(id);
	}
	// Persist defaults once as canonical metadata, so generated mirrors cannot add them on a second pass.
	const rootStory = createDefaultStory(project);
	if (project.defaultStoryId === undefined) project.defaultStoryId = rootStory.id;
	project.storyMetadata = {
		id: rootStory.id,
		name: rootStory.name,
		aspectRatio: rootStory.aspectRatio,
		framing: rootStory.framing,
		createdAt: rootStory.createdAt,
		updatedAt: rootStory.updatedAt,
		...project.storyMetadata,
	};
	project.canvas = rootStory.canvas;
	if (project.clipTransitions === undefined) project.clipTransitions = [];
	for (const artboard of project.repurposeBoard?.artboards ?? []) {
		const story = artboardToStory(artboard, project.canvas.fps);
		artboard.storyMetadata = {
			id: story.id,
			createdAt: story.createdAt,
			updatedAt: story.updatedAt,
			...artboard.storyMetadata,
		};
		if (artboard.canvas === undefined) artboard.canvas = { ...project.canvas, ...story.canvas };
		if (artboard.clipTransitions === undefined) artboard.clipTransitions = [];
	}
	// Validate legacy definitions before removing them; a malformed unused preset rejects the clone too.
	validateTimelineProject(project, { mode: "legacy" });
	const designs = project.assets.filter(
		(asset) => asset.kind === "text" || asset.kind === "shape",
	);
	const placed = new Set<string>();
	const migratedShapes = new Set<TimelineClip>();
	for (const scope of listStoryScopes(project)) {
		for (const track of getStoryProject(project, scope).tracks) {
			for (const clip of track.clips) {
				const asset = designs.find((candidate) => candidate.id === clip.assetId);
				if (!asset) continue;
				placed.add(asset.id);
				if (asset.kind === "shape") migratedShapes.add(clip);
				clip.content =
					asset.kind === "text"
						? {
								kind: "text",
								text: structuredClone(clip.text ?? asset.text!),
								durationUs: asset.durationUs,
							}
						: {
								kind: "shape",
								shapeDefinition: structuredClone(asset.shapeDefinition!),
								durationUs: asset.durationUs,
							};
				delete clip.assetId;
				delete clip.text;
			}
		}
	}
	// Historical static shapes had unlimited handles. Add only missing logical handles,
	// preserving visible placement duration, rate and clip-local animation/keyframe clocks.
	for (const scope of listStoryScopes(project)) {
		const view = getStoryProject(project, scope);
		for (const clip of view.tracks.flatMap((track) => track.clips)) {
			if (!migratedShapes.has(clip) || clip.content?.kind !== "shape") continue;
			let headUs = 0,
				tailUs = 0;
			for (const transition of view.clipTransitions ?? []) {
				const handleUs = Math.ceil((transition.durationUs / 2) * clip.rate);
				if (transition.toClipId === clip.id) headUs = Math.max(headUs, handleUs);
				if (transition.fromClipId === clip.id) tailUs = Math.max(tailUs, handleUs);
			}
			const paddingUs = Math.max(0, headUs - clip.sourceInUs);
			clip.sourceInUs += paddingUs;
			clip.sourceOutUs += paddingUs;
			clip.content.durationUs = Math.max(clip.content.durationUs, clip.sourceOutUs + tailUs);
		}
	}
	for (const asset of designs) {
		if (placed.has(asset.id)) continue;
		const content: StoryClipContent =
			asset.kind === "text"
				? { kind: "text", text: structuredClone(asset.text!), durationUs: asset.durationUs }
				: {
						kind: "shape",
						shapeDefinition: structuredClone(asset.shapeDefinition!),
						durationUs: asset.durationUs,
					};
		project.designTemplates ??= [];
		project.designTemplates.push({
			id: asset.id,
			name: asset.name,
			kind: content.kind,
			content,
			width: asset.width,
			height: asset.height,
			defaultDurationUs: asset.durationUs,
		});
	}
	project.assets = project.assets.filter(
		(asset) => asset.kind !== "text" && asset.kind !== "shape",
	);
	return validateTimelineProject(refreshStoryProjections(project));
}
