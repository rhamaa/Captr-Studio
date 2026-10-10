import { placeAsset } from "./commands";
import {
	type ArtboardPreset,
	type RepurposeArtboard,
	type RepurposeArtboardFraming,
	type RepurposeAspectRatio,
	type RepurposeBoardSettings,
	type RepurposeSlice,
	SLICE_COLORS,
} from "./repurposeTypes";
import {
	applyStoryCommand,
	createStorySnapshot,
	getStoryProject,
	refreshStoryProjections,
} from "./storyOwnership";
import { clipDurationUs, projectDurationUs, type TimelineProject } from "./types";

/**
 * Creates default RepurposeBoardSettings with standard social media artboards (9:16, 1:1, 16:9)
 * and one full-length slice spanning the project duration.
 */
export function createDefaultRepurposeBoard(project: TimelineProject): RepurposeBoardSettings {
	const totalDurationUs = Math.max(1_000_000, projectDurationUs(project));
	const defaultSliceId = crypto.randomUUID();

	const artboards: RepurposeArtboard[] = [];

	const slices: RepurposeSlice[] = [
		{
			id: defaultSliceId,
			name: "Full Video",
			startUs: 0,
			endUs: totalDurationUs,
			color: SLICE_COLORS[0],
		},
	];

	return {
		artboards,
		slices,
		activeSliceId: defaultSliceId,
	};
}

/**
 * Ensures project has repurposeBoard settings initialized.
 */
export function ensureRepurposeBoard(project: TimelineProject): TimelineProject {
	if (project.repurposeBoard) {
		return project;
	}
	return {
		...project,
		repurposeBoard: createDefaultRepurposeBoard(project),
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Sets or updates the whiteboard snapshot for infinite canvas state persistence.
 */
export function setWhiteboardSnapshot(
	project: TimelineProject,
	snapshot: Record<string, unknown>,
): TimelineProject {
	return {
		...project,
		whiteboardSnapshot: snapshot,
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Adds a new artboard to the repurpose board.
 */
export function addRepurposeArtboard(
	project: TimelineProject,
	presetOrConfig:
		| ArtboardPreset
		| {
				aspectRatio: RepurposeAspectRatio;
				name: string;
				width: number;
				height: number;
				fitMode?: "cover" | "contain";
		  },
): TimelineProject {
	const current = ensureRepurposeBoard(project);
	const board = current.repurposeBoard!;

	const fitMode: "cover" | "contain" =
		"defaultFitMode" in presetOrConfig
			? presetOrConfig.defaultFitMode
			: (presetOrConfig.fitMode ?? "cover");

	let name = presetOrConfig.name;
	const existingNames = new Set(board.artboards.map((a) => a.name));
	if (existingNames.has(name)) {
		let count = 2;
		while (existingNames.has(`${name} ${count}`)) {
			count++;
		}
		name = `${name} ${count}`;
	}

	const snapshot = createStorySnapshot(current, current);
	const newArtboard: RepurposeArtboard = {
		id: crypto.randomUUID(),
		name,
		tracks: snapshot.tracks,
		clipTransitions: snapshot.clipTransitions,
		localAssets: snapshot.localAssets,
		subtitles: snapshot.subtitles,
		canvas: { ...current.canvas, width: presetOrConfig.width, height: presetOrConfig.height },
		aspectRatio: presetOrConfig.aspectRatio,
		width: presetOrConfig.width,
		height: presetOrConfig.height,
		framing: {
			scale: 1,
			offsetX: 0,
			offsetY: 0,
			fitMode,
		},
	};

	return refreshStoryProjections({
		...current,
		compositions: [...current.compositions, ...snapshot.compositions],
		repurposeBoard: {
			...board,
			artboards: [...board.artboards, newArtboard],
		},
		updatedAt: new Date().toISOString(),
	});
}

/**
 * Renames an artboard in the repurpose board.
 */
export function renameRepurposeArtboard(
	project: TimelineProject,
	artboardId: string,
	name: string,
): TimelineProject {
	const current = ensureRepurposeBoard(project);
	const board = current.repurposeBoard!;

	const trimmed = name.trim();
	if (!trimmed) return current;

	return {
		...current,
		repurposeBoard: {
			...board,
			artboards: board.artboards.map((a) =>
				a.id === artboardId ? { ...a, name: trimmed } : a,
			),
		},
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Updates artboard properties (e.g. name, dimensions).
 */
export function updateRepurposeArtboard(
	project: TimelineProject,
	artboardId: string,
	patch: Partial<Omit<RepurposeArtboard, "id">>,
): TimelineProject {
	const current = ensureRepurposeBoard(project);
	const board = current.repurposeBoard!;

	return {
		...current,
		repurposeBoard: {
			...board,
			artboards: board.artboards.map((ab: RepurposeArtboard) =>
				ab.id === artboardId ? { ...ab, ...patch } : ab,
			),
		},
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Updates framing properties for a specific artboard (scale, offsetX, offsetY, fitMode).
 */
export function updateRepurposeFraming(
	project: TimelineProject,
	artboardId: string,
	framingPatch: Partial<RepurposeArtboardFraming>,
): TimelineProject {
	const current = ensureRepurposeBoard(project);
	const board = current.repurposeBoard!;

	return {
		...current,
		repurposeBoard: {
			...board,
			artboards: board.artboards.map((ab: RepurposeArtboard) =>
				ab.id === artboardId
					? {
							...ab,
							framing: {
								...ab.framing,
								...framingPatch,
								// Clamp scale to [0.5, 3.0]
								scale: Math.max(
									0.5,
									Math.min(3, framingPatch.scale ?? ab.framing.scale),
								),
								// Clamp offsets to [-0.5, 0.5]
								offsetX: Math.max(
									-0.5,
									Math.min(0.5, framingPatch.offsetX ?? ab.framing.offsetX),
								),
								offsetY: Math.max(
									-0.5,
									Math.min(0.5, framingPatch.offsetY ?? ab.framing.offsetY),
								),
							},
						}
					: ab,
			),
		},
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Resets framing of an artboard back to center with 1x scale.
 */
export function resetRepurposeFraming(
	project: TimelineProject,
	artboardId: string,
): TimelineProject {
	return updateRepurposeFraming(project, artboardId, {
		scale: 1,
		offsetX: 0,
		offsetY: 0,
	});
}

/**
 * Removes an artboard from the repurpose board.
 */
export function removeRepurposeArtboard(
	project: TimelineProject,
	artboardId: string,
): TimelineProject {
	const current = ensureRepurposeBoard(project);
	const board = current.repurposeBoard!;

	return refreshStoryProjections({
		...current,
		repurposeBoard: {
			...board,
			artboards: board.artboards.filter((ab: RepurposeArtboard) => ab.id !== artboardId),
		},
		updatedAt: new Date().toISOString(),
	});
}

const MIN_SLICE_DURATION_US = 500_000; // 0.5 second minimum slice length

/**
 * Splits the slice containing splitTimeUs into two separate slices (Razor Cut).
 */
export function splitRepurposeSliceAtTime(
	project: TimelineProject,
	splitTimeUs: number,
): TimelineProject {
	const current = ensureRepurposeBoard(project);
	const board = current.repurposeBoard!;

	// Find the slice that envelopes splitTimeUs
	const targetIndex = board.slices.findIndex(
		(s: RepurposeSlice) =>
			splitTimeUs >= s.startUs + MIN_SLICE_DURATION_US &&
			splitTimeUs <= s.endUs - MIN_SLICE_DURATION_US,
	);

	if (targetIndex === -1) {
		return current; // No valid split candidate
	}

	const target = board.slices[targetIndex];
	const colorIndex = board.slices.length % SLICE_COLORS.length;

	const sliceA: RepurposeSlice = {
		...target,
		endUs: splitTimeUs,
	};

	const sliceB: RepurposeSlice = {
		id: crypto.randomUUID(),
		name: `${target.name} (Part 2)`,
		startUs: splitTimeUs,
		endUs: target.endUs,
		color: SLICE_COLORS[colorIndex],
	};

	const updatedSlices = [...board.slices];
	updatedSlices.splice(targetIndex, 1, sliceA, sliceB);

	return {
		...current,
		repurposeBoard: {
			...board,
			slices: updatedSlices,
			activeSliceId: sliceB.id,
		},
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Adds an arbitrary new slice range.
 */
export function addRepurposeSlice(
	project: TimelineProject,
	startUs: number,
	endUs: number,
	name?: string,
): TimelineProject {
	if (endUs <= startUs + MIN_SLICE_DURATION_US) return project;

	const current = ensureRepurposeBoard(project);
	const board = current.repurposeBoard!;
	const colorIndex = board.slices.length % SLICE_COLORS.length;
	const newId = crypto.randomUUID();

	const newSlice: RepurposeSlice = {
		id: newId,
		name: name || `Slice ${board.slices.length + 1}`,
		startUs,
		endUs,
		color: SLICE_COLORS[colorIndex],
	};

	return {
		...current,
		repurposeBoard: {
			...board,
			slices: [...board.slices, newSlice].sort((a, b) => a.startUs - b.startUs),
			activeSliceId: newId,
		},
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Updates a slice (name, startUs, endUs, color).
 */
export function updateRepurposeSlice(
	project: TimelineProject,
	sliceId: string,
	patch: Partial<Omit<RepurposeSlice, "id">>,
): TimelineProject {
	const current = ensureRepurposeBoard(project);
	const board = current.repurposeBoard!;

	return {
		...current,
		repurposeBoard: {
			...board,
			slices: board.slices.map((s: RepurposeSlice) => {
				if (s.id !== sliceId) return s;
				const updated = { ...s, ...patch };
				if (updated.endUs <= updated.startUs + MIN_SLICE_DURATION_US) {
					return s; // Reject invalid boundary
				}
				return updated;
			}),
		},
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Removes a slice by ID. Prevents deleting if only 1 slice remains.
 */
export function removeRepurposeSlice(project: TimelineProject, sliceId: string): TimelineProject {
	const current = ensureRepurposeBoard(project);
	const board = current.repurposeBoard!;

	if (board.slices.length <= 1) return current; // Keep at least one slice

	const nextSlices = board.slices.filter((s: RepurposeSlice) => s.id !== sliceId);
	const nextActiveId =
		board.activeSliceId === sliceId ? (nextSlices[0]?.id ?? null) : board.activeSliceId;

	return {
		...current,
		repurposeBoard: {
			...board,
			slices: nextSlices,
			activeSliceId: nextActiveId,
		},
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Sets the active highlighted slice.
 */
export function setActiveRepurposeSlice(
	project: TimelineProject,
	sliceId: string | null,
): TimelineProject {
	const current = ensureRepurposeBoard(project);
	const board = current.repurposeBoard!;

	return {
		...current,
		repurposeBoard: {
			...board,
			activeSliceId: sliceId,
		},
	};
}

/**
 * Creates a project view representation tailored to a specific artboard.
 * The canvas dimensions match the artboard, and tracks/clipTransitions
 * use the artboard's independent sequence (or falls back to project root).
 */
export function getArtboardProjectView(
	project: TimelineProject,
	artboardId: string,
): TimelineProject {
	return getStoryProject(project, { kind: "artboard", artboardId });
}

/**
 * Updates a specific artboard's independent sequence timeline via an updater function.
 * Tracks and clip transitions are stored directly in the artboard.
 * Any added assets or packages are synced to the root project shared asset pool.
 */
export function updateArtboardProject(
	project: TimelineProject,
	artboardId: string,
	updater: (artboardProject: TimelineProject) => TimelineProject,
): TimelineProject {
	return applyStoryCommand(project, { kind: "artboard", artboardId }, updater);
}

/**
 * Explicitly forks root project tracks into an artboard's independent sequence.
 */
export function forkArtboardSequence(
	project: TimelineProject,
	artboardId: string,
): TimelineProject {
	const owner = project.repurposeBoard?.artboards.find((a) => a.id === artboardId);
	if (!owner) throw new Error(`Story owner not found: ${artboardId}`);
	if (owner.tracks !== undefined) return project;
	const snapshot = createStorySnapshot(project, project);
	return refreshStoryProjections({
		...project,
		compositions: [...project.compositions, ...snapshot.compositions],
		repurposeBoard: {
			...project.repurposeBoard!,
			artboards: project.repurposeBoard!.artboards.map((a) =>
				a.id === artboardId
					? {
							...a,
							tracks: snapshot.tracks,
							clipTransitions: snapshot.clipTransitions,
							localAssets:
								a.localAssets === undefined
									? snapshot.localAssets
									: [
											...structuredClone(a.localAssets),
											...(snapshot.localAssets ?? []),
										],
							subtitles: a.subtitles === undefined ? snapshot.subtitles : a.subtitles,
							canvas: structuredClone(
								a.canvas ?? { ...project.canvas, width: a.width, height: a.height },
							),
						}
					: a,
			),
		},
		updatedAt: new Date().toISOString(),
	});
}

/**
 * Duplicates an artboard, including its framing and any independent sequence tracks.
 * Re-maps all clip compositions so edits to the duplicated artboard never affect the original.
 */
export function duplicateRepurposeArtboard(
	project: TimelineProject,
	artboardId: string,
): TimelineProject {
	const source = getStoryProject(project, { kind: "artboard", artboardId });
	const artboard = project.repurposeBoard!.artboards.find((a) => a.id === artboardId)!;
	const snapshot = createStorySnapshot(project, source);
	const duplicated: RepurposeArtboard = {
		...structuredClone(artboard),
		id: crypto.randomUUID(),
		name: `${artboard.name} (Copy)`,
		storyMetadata: { ...artboard.storyMetadata, id: undefined },
		tracks: snapshot.tracks,
		clipTransitions: snapshot.clipTransitions,
		localAssets: snapshot.localAssets,
		subtitles: snapshot.subtitles,
	};
	return refreshStoryProjections({
		...project,
		compositions: [...project.compositions, ...snapshot.compositions],
		repurposeBoard: {
			...project.repurposeBoard!,
			artboards: [...project.repurposeBoard!.artboards, duplicated],
		},
		updatedAt: new Date().toISOString(),
	});
}

/**
 * Places an asset into an artboard's independent sequence tracks.
 * If artboard has no tracks yet, initializes with a compatible visual/audio track.
 * Automatically generates a dedicated RecordComposition if placing a recording asset.
 */
export function placeAssetIntoArtboard(
	project: TimelineProject,
	artboardId: string,
	assetId: string,
): TimelineProject {
	return applyStoryCommand(project, { kind: "artboard", artboardId }, (view) => {
		const asset = view.assets.find((a) => a.id === assetId);
		if (!asset) throw new Error(`Shared asset not found: ${assetId}`);
		const kind = asset.kind === "audio" ? "audio" : "visual";
		let track = view.tracks.find((t) => !t.locked && t.kind === kind);
		if (!track) {
			track = {
				id: crypto.randomUUID(),
				name: kind === "audio" ? "Audio Track" : "Video Track",
				kind,
				locked: false,
				muted: false,
				hidden: false,
				clips: [],
			};
			view.tracks.push(track);
		}
		const startUs = Math.max(0, ...track.clips.map((c) => c.startUs + clipDurationUs(c)));
		return placeAsset(view, assetId, track.id, startUs, {
			clipId: crypto.randomUUID(),
			compositionId: crypto.randomUUID(),
		});
	});
}
