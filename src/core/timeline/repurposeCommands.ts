import { createRecordComposition } from "@/recording/packageAdapter";
import type { RecordComposition } from "@/recording/types";
import {
	type ArtboardPreset,
	type RepurposeArtboard,
	type RepurposeArtboardFraming,
	type RepurposeAspectRatio,
	type RepurposeBoardSettings,
	type RepurposeSlice,
	SLICE_COLORS,
} from "./repurposeTypes";
import { projectDurationUs, type TimelineClip, type TimelineProject, type TimelineTrack } from "./types";

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

	const newArtboard: RepurposeArtboard = {
		id: crypto.randomUUID(),
		name,
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

	return {
		...current,
		repurposeBoard: {
			...board,
			artboards: [...board.artboards, newArtboard],
		},
		updatedAt: new Date().toISOString(),
	};
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

	return {
		...current,
		repurposeBoard: {
			...board,
			artboards: board.artboards.filter((ab: RepurposeArtboard) => ab.id !== artboardId),
		},
		updatedAt: new Date().toISOString(),
	};
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
	const current = ensureRepurposeBoard(project);
	const artboard = current.repurposeBoard?.artboards.find((a) => a.id === artboardId);
	if (!artboard) return current;

	return {
		...current,
		canvas: {
			...current.canvas,
			width: artboard.width,
			height: artboard.height,
		},
		tracks: artboard.tracks
			? structuredClone(artboard.tracks)
			: structuredClone(current.tracks),
		clipTransitions: artboard.clipTransitions
			? structuredClone(artboard.clipTransitions)
			: current.clipTransitions
				? structuredClone(current.clipTransitions)
				: [],
	};
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
	const current = ensureRepurposeBoard(project);
	const artboardIndex = current.repurposeBoard!.artboards.findIndex((a) => a.id === artboardId);
	if (artboardIndex === -1) return current;

	const artboard = current.repurposeBoard!.artboards[artboardIndex]!;
	const artboardView = getArtboardProjectView(current, artboardId);
	const updatedView = updater(artboardView);

	const updatedArtboard: RepurposeArtboard = {
		...artboard,
		tracks: updatedView.tracks,
		clipTransitions: updatedView.clipTransitions,
	};

	const updatedArtboards = [...current.repurposeBoard!.artboards];
	updatedArtboards[artboardIndex] = updatedArtboard;

	return {
		...current,
		// Shared assets and packages preserve any new media added during editing
		assets: updatedView.assets,
		packages: updatedView.packages,
		compositions: updatedView.compositions,
		repurposeBoard: {
			...current.repurposeBoard!,
			artboards: updatedArtboards,
		},
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Explicitly forks root project tracks into an artboard's independent sequence.
 */
export function forkArtboardSequence(
	project: TimelineProject,
	artboardId: string,
): TimelineProject {
	const current = ensureRepurposeBoard(project);
	const artboardIndex = current.repurposeBoard!.artboards.findIndex((a) => a.id === artboardId);
	if (artboardIndex === -1) return current;

	const artboard = current.repurposeBoard!.artboards[artboardIndex]!;
	if (artboard.tracks) return current; // Already forked

	const clonedTracks: TimelineTrack[] = structuredClone(current.tracks);
	const newCompositions: RecordComposition[] = [];
	for (const track of clonedTracks) {
		for (const clip of track.clips) {
			clip.id = crypto.randomUUID();
			if (clip.compositionId) {
				const origComp = current.compositions.find((c) => c.id === clip.compositionId);
				if (origComp) {
					const newCompId = crypto.randomUUID();
					newCompositions.push({
						...structuredClone(origComp),
						id: newCompId,
					});
					clip.compositionId = newCompId;
				}
			}
		}
	}

	const updatedArtboard: RepurposeArtboard = {
		...artboard,
		tracks: clonedTracks,
		clipTransitions: current.clipTransitions ? structuredClone(current.clipTransitions) : [],
	};

	const updatedArtboards = [...current.repurposeBoard!.artboards];
	updatedArtboards[artboardIndex] = updatedArtboard;

	return {
		...current,
		compositions: [...current.compositions, ...newCompositions],
		repurposeBoard: {
			...current.repurposeBoard!,
			artboards: updatedArtboards,
		},
		updatedAt: new Date().toISOString(),
	};
}

/**
 * Duplicates an artboard, including its framing and any independent sequence tracks.
 * Re-maps all clip compositions so edits to the duplicated artboard never affect the original.
 */
export function duplicateRepurposeArtboard(
	project: TimelineProject,
	artboardId: string,
): TimelineProject {
	const current = ensureRepurposeBoard(project);
	const artboard = current.repurposeBoard!.artboards.find((a) => a.id === artboardId);
	if (!artboard) return current;

	const newCompositions: RecordComposition[] = [];
	let duplicatedTracks: TimelineTrack[] | undefined;
	if (artboard.tracks) {
		duplicatedTracks = structuredClone(artboard.tracks);
		for (const track of duplicatedTracks) {
			for (const clip of track.clips) {
				clip.id = crypto.randomUUID();
				if (clip.compositionId) {
					const origComp = current.compositions.find((c) => c.id === clip.compositionId);
					if (origComp) {
						const newCompId = crypto.randomUUID();
						newCompositions.push({
							...structuredClone(origComp),
							id: newCompId,
						});
						clip.compositionId = newCompId;
					}
				}
			}
		}
	}

	const duplicated: RepurposeArtboard = {
		...artboard,
		id: crypto.randomUUID(),
		name: `${artboard.name} (Copy)`,
		framing: structuredClone(artboard.framing),
		tracks: duplicatedTracks,
		clipTransitions: artboard.clipTransitions
			? structuredClone(artboard.clipTransitions)
			: undefined,
	};

	return {
		...current,
		compositions: [...current.compositions, ...newCompositions],
		repurposeBoard: {
			...current.repurposeBoard!,
			artboards: [...current.repurposeBoard!.artboards, duplicated],
		},
		updatedAt: new Date().toISOString(),
	};
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
	const current = ensureRepurposeBoard(project);
	const artboardIndex = current.repurposeBoard!.artboards.findIndex((a) => a.id === artboardId);
	if (artboardIndex === -1) return current;

	const artboard = current.repurposeBoard!.artboards[artboardIndex]!;
	const asset = current.assets.find((a) => a.id === assetId);
	if (!asset) return current;

	const tracks: TimelineTrack[] = artboard.tracks
		? structuredClone(artboard.tracks)
		: current.tracks.length > 0
			? structuredClone(current.tracks)
			: [
					{
						id: crypto.randomUUID(),
						name: asset.kind === "audio" ? "Audio 1" : "Track 1",
						kind: asset.kind === "audio" ? "audio" : "visual",
						locked: false,
						muted: false,
						hidden: false,
						clips: [],
					},
				];

	const targetKind = asset.kind === "audio" ? "audio" : "visual";
	let track = tracks.find((t) => !t.locked && t.kind === targetKind);
	if (!track) {
		track = {
			id: crypto.randomUUID(),
			name: targetKind === "audio" ? "Audio Track" : "Video Track",
			kind: targetKind,
			locked: false,
			muted: false,
			hidden: false,
			clips: [],
		};
		tracks.push(track);
	}

	const startUs = Math.max(
		0,
		...track.clips.map((c) => c.startUs + Math.round((c.sourceOutUs - c.sourceInUs) / c.rate)),
	);

	let compositionId: string | undefined;
	const addedCompositions: RecordComposition[] = [];
	if (asset.kind === "recording" && asset.packageId) {
		const pkg = current.packages.find((p) => p.id === asset.packageId);
		if (pkg) {
			compositionId = crypto.randomUUID();
			const composition = createRecordComposition(pkg, compositionId);
			addedCompositions.push(composition);
		}
	}

	const clipId = crypto.randomUUID();
	const newClip: TimelineClip = {
		id: clipId,
		assetId,
		compositionId,
		startUs,
		sourceInUs: 0,
		sourceOutUs: Math.max(1_000_000, addedCompositions[0]?.durationUs ?? asset.durationUs),
		rate: 1,
		transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
		gain: 1,
		enabled: true,
	};
	track.clips.push(newClip);

	const updatedArtboards = [...current.repurposeBoard!.artboards];
	updatedArtboards[artboardIndex] = {
		...artboard,
		tracks,
	};

	return {
		...current,
		compositions: [...current.compositions, ...addedCompositions],
		repurposeBoard: {
			...current.repurposeBoard!,
			artboards: updatedArtboards,
		},
		updatedAt: new Date().toISOString(),
	};
}

