import { summarizeProjectDiff } from "./agentPayload";
import {
	addTextOverlay,
	placeAsset,
	splitClip,
	trimClip,
} from "./commands";
import { validateTimelineProject } from "./validation";
import { clipDurationUs, projectDurationUs } from "./types";
import type { AssetTranscript } from "./transcriptTypes";
import type { TimelineClip, TimelineProject } from "./types";

function getAllTranscriptWords(transcript: AssetTranscript) {
	return (transcript.segments ?? []).flatMap((s) => s.words ?? []);
}

function getTranscriptFullText(transcript: AssetTranscript) {
	return (transcript.segments ?? []).map((s) => s.text).join(" ").trim();
}

export interface ProjectContextSummary {
	projectId: string;
	title: string;
	canvas: { width: number; height: number; fps: number };
	durationUs: number;
	durationSec: number;
	tracks: Array<{
		id: string;
		name: string;
		kind: "visual" | "audio";
		locked: boolean;
		clips: Array<{
			id: string;
			assetId: string;
			name: string;
			startUs: number;
			startSec: number;
			durationUs: number;
			durationSec: number;
			sourceInUs: number;
			sourceOutUs: number;
			rate: number;
		}>;
	}>;
	assets: Array<{
		id: string;
		name: string;
		kind: string;
		durationUs?: number;
		durationSec?: number;
		width?: number;
		height?: number;
		hasTranscript: boolean;
	}>;
	transcripts: Record<
		string,
		{
			assetId: string;
			language?: string;
			fullText: string;
			segmentsCount: number;
			wordsCount: number;
			sampleSegments: Array<{ text: string; startUs: number; endUs: number }>;
			words: Array<{ word: string; startUs: number; endUs: number }>;
		}
	>;
	artboards: Array<{
		id: string;
		name: string;
		aspectRatio: string;
		width: number;
		height: number;
	}>;
	cursorTelemetry: Array<{
		packageId: string;
		hasCursorTelemetry: boolean;
		cursorPath?: string;
		sampleCount?: number;
		clickCount?: number;
		settings?: {
			showCursor?: boolean;
			cursorSize?: number;
		};
	}>;
	whiteboard: {
		slices: Array<{ id: string; name: string; startUs: number; endUs: number }>;
		notesCount: number;
		snapshot?: Record<string, unknown>;
	};
	playhead: {
		playheadUs: number;
		playheadSec: number;
	};
	selection: {
		selectedClipIds: string[];
	};
}

export function formatProjectContext(
	project: TimelineProject,
	transcripts: Record<string, AssetTranscript> = {},
	meta?: {
		playheadUs?: number;
		selection?: string[];
		activeArtboardId?: string | null;
	},
): ProjectContextSummary {
	const durationUs = projectDurationUs(project);
	const playheadUs = meta?.playheadUs ?? 0;
	const selection = meta?.selection ?? [];

	const formattedTracks = project.tracks.map((t) => ({
		id: t.id,
		name: t.name,
		kind: t.kind,
		locked: Boolean(t.locked),
		clips: t.clips.map((c) => {
			const asset = project.assets.find((a) => a.id === c.assetId);
			const durUs = clipDurationUs(c);
			return {
				id: c.id,
				assetId: c.assetId,
				name: asset?.name ?? c.id,
				startUs: c.startUs,
				startSec: Number((c.startUs / 1_000_000).toFixed(3)),
				durationUs: durUs,
				durationSec: Number((durUs / 1_000_000).toFixed(3)),
				sourceInUs: c.sourceInUs,
				sourceOutUs: c.sourceOutUs,
				rate: c.rate ?? 1,
			};
		}),
	}));

	const formattedAssets = project.assets.map((a) => ({
		id: a.id,
		name: a.name,
		kind: a.kind,
		durationUs: a.durationUs,
		durationSec: a.durationUs ? Number((a.durationUs / 1_000_000).toFixed(3)) : undefined,
		width: a.width,
		height: a.height,
		hasTranscript: Boolean(transcripts[a.id]),
	}));

	const formattedTranscripts: ProjectContextSummary["transcripts"] = {};
	for (const [assetId, t] of Object.entries(transcripts)) {
		const allWords = getAllTranscriptWords(t);
		const fullText = getTranscriptFullText(t);
		formattedTranscripts[assetId] = {
			assetId,
			language: t.language,
			fullText,
			segmentsCount: (t.segments ?? []).length,
			wordsCount: allWords.length,
			sampleSegments: (t.segments ?? []).slice(0, 10).map((s) => ({
				text: s.text,
				startUs: s.startUs,
				endUs: s.endUs,
			})),
			words: allWords.map((w) => ({
				word: w.word,
				startUs: w.startUs,
				endUs: w.endUs,
			})),
		};
	}

	const artboards = (project.repurposeBoard?.artboards ?? []).map((ab) => ({
		id: ab.id,
		name: ab.name,
		aspectRatio: ab.aspectRatio,
		width: ab.width,
		height: ab.height,
	}));

	const slices = (project.repurposeBoard?.slices ?? []).map((s) => ({
		id: s.id,
		name: s.name,
		startUs: s.startUs,
		endUs: s.endUs,
	}));

	const cursorTelemetry = (project.packages ?? []).map((pkg) => {
		const comp = (project.compositions ?? []).find((c) => c.packageId === pkg.id);
		return {
			packageId: pkg.id,
			hasCursorTelemetry: Boolean(pkg.cursorPath),
			cursorPath: pkg.cursorPath,
			sampleCount: (pkg.diagnostics as any)?.cursorSampleCount ?? (pkg.cursorPath ? 1 : 0),
			clickCount: (pkg.diagnostics as any)?.cursorClickCount,
			settings: {
				showCursor: comp?.settings?.showCursor ?? pkg.settings?.showCursor,
				cursorSize: comp?.settings?.cursorSize ?? pkg.settings?.cursorSize,
			},
		};
	});

	return {
		projectId: project.projectId,
		title: project.title,
		canvas: project.canvas,
		durationUs,
		durationSec: Number((durationUs / 1_000_000).toFixed(3)),
		tracks: formattedTracks,
		assets: formattedAssets,
		transcripts: formattedTranscripts,
		artboards,
		cursorTelemetry,
		whiteboard: {
			slices,
			notesCount: slices.length,
			snapshot: project.whiteboardSnapshot,
		},
		playhead: {
			playheadUs,
			playheadSec: Number((playheadUs / 1_000_000).toFixed(3)),
		},
		selection: {
			selectedClipIds: selection,
		},
	};
}

export function applySplitClip(
	project: TimelineProject,
	clipId: string,
	atUs: number,
): { project: TimelineProject; leftClipId: string; rightClipId: string } {
	const rightClipId = `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
	const rightCompositionId = `comp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

	const nextProject = splitClip(project, clipId, atUs, {
		rightClipId,
		rightCompositionId,
	});

	return {
		project: nextProject,
		leftClipId: clipId,
		rightClipId,
	};
}

export function applyTrimClip(
	project: TimelineProject,
	clipId: string,
	params: {
		sourceInUs?: number;
		sourceOutUs?: number;
		startUs?: number;
	},
): TimelineProject {
	// Find clip to preserve untouched values
	let targetClip: TimelineClip | undefined;
	for (const t of project.tracks) {
		const found = t.clips.find((c) => c.id === clipId);
		if (found) {
			targetClip = found;
			break;
		}
	}

	if (!targetClip) {
		throw new Error(`Clip with id "${clipId}" not found in project`);
	}

	const sourceInUs = params.sourceInUs ?? targetClip.sourceInUs;
	const sourceOutUs = params.sourceOutUs ?? targetClip.sourceOutUs;
	const startUs = params.startUs ?? targetClip.startUs;

	return trimClip(project, clipId, sourceInUs, sourceOutUs, startUs);
}

export interface RemoveSilenceOptions {
	assetId?: string;
	minDurationMs?: number; // Minimum pause to consider silence, default 800ms
	targetClipIds?: string[];
}

export interface RemoveSilenceResult {
	project: TimelineProject;
	cutsCount: number;
	savedDurationUs: number;
}

/**
 * Automatically removes silent pauses based on speech transcripts
 * or specified gaps. Performs ripple cuts along the visual and linked tracks.
 */
export function applyRemoveSilence(
	project: TimelineProject,
	transcripts: Record<string, AssetTranscript>,
	options: RemoveSilenceOptions = {},
): RemoveSilenceResult {
	const minDurationUs = (options.minDurationMs ?? 800) * 1000;
	let current = structuredClone(project);
	let cutsCount = 0;
	const originalDurationUs = projectDurationUs(project);

	// Collect silence intervals per asset from word-level gaps
	for (const [assetId, transcript] of Object.entries(transcripts)) {
		if (options.assetId && options.assetId !== assetId) continue;
		const words = getAllTranscriptWords(transcript);
		if (words.length < 2) continue;

		// Detect pauses between consecutive words
		const pauses: Array<{ sourceStartUs: number; sourceEndUs: number; durationUs: number }> = [];
		for (let i = 0; i < words.length - 1; i++) {
			const prevWord = words[i];
			const nextWord = words[i + 1];
			const gapUs = nextWord.startUs - prevWord.endUs;
			if (gapUs >= minDurationUs) {
				pauses.push({
					sourceStartUs: prevWord.endUs,
					sourceEndUs: nextWord.startUs,
					durationUs: gapUs,
				});
			}
		}

		if (pauses.length === 0) continue;

		// Find clips referencing this asset
		for (const track of current.tracks) {
			if (track.locked) continue;
			const matchingClips = track.clips.filter((c) => {
				if (c.assetId !== assetId) return false;
				if (options.targetClipIds && !options.targetClipIds.includes(c.id)) return false;
				return true;
			});

			for (const clip of matchingClips) {
				// Find pauses that fall completely inside this clip's source range
				const relevantPauses = pauses
					.filter(
						(p) =>
							p.sourceStartUs > clip.sourceInUs &&
							p.sourceEndUs < clip.sourceOutUs,
					)
					.sort((a, b) => b.sourceStartUs - a.sourceStartUs); // Cut from end to start to preserve indices

				for (const pause of relevantPauses) {
					try {
						const timelineCutPointUs =
							clip.startUs + Math.round((pause.sourceStartUs - clip.sourceInUs) / (clip.rate || 1));
						const splitRes = applySplitClip(current, clip.id, timelineCutPointUs);
						current = splitRes.project;

						// Trim right clip to skip the pause
						const pauseDurUs = pause.durationUs;
						const rightClip = current.tracks
							.flatMap((t) => t.clips)
							.find((c) => c.id === splitRes.rightClipId);

						if (rightClip) {
							const newSourceIn = pause.sourceEndUs;
							const newStartUs = timelineCutPointUs;
							current = trimClip(
								current,
								rightClip.id,
								newSourceIn,
								rightClip.sourceOutUs,
								newStartUs,
							);
							// Ripple shift all subsequent clips on this track
							const targetTrack = current.tracks.find((t) =>
								t.clips.some((c) => c.id === rightClip.id),
							);
							if (targetTrack) {
								for (const other of targetTrack.clips) {
									if (other.id !== rightClip.id && other.startUs > newStartUs) {
										other.startUs = Math.max(0, other.startUs - pauseDurUs);
									}
								}
							}
							cutsCount++;
						}
					} catch {
						// Boundary or overlap issue, continue safely
					}
				}
			}
		}
	}

	const newDurationUs = projectDurationUs(current);
	const savedDurationUs = Math.max(0, originalDurationUs - newDurationUs);

	return {
		project: validateTimelineProject(current),
		cutsCount,
		savedDurationUs,
	};
}

export interface BRollOrOverlaySpec {
	type: "hyperframe" | "text" | "asset";
	title?: string;
	subtitle?: string;
	text?: string;
	assetId?: string;
	trackId?: string;
	startUs: number;
	durationUs: number;
	theme?: string;
}

export function applyAddBRollOrOverlay(
	project: TimelineProject,
	spec: BRollOrOverlaySpec,
): { project: TimelineProject; clipId: string; trackId: string } {
	const clipId = `broll-clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
	let targetTrackId = spec.trackId;

	// If no track specified, find or create topmost visual track
	if (!targetTrackId) {
		const visualTracks = project.tracks.filter((t) => t.kind === "visual");
		if (visualTracks.length > 1) {
			// Second visual track (overlay track)
			targetTrackId = visualTracks[0].id;
		} else if (visualTracks.length === 1) {
			targetTrackId = visualTracks[0].id;
		} else {
			targetTrackId = "visual-overlay-1";
		}
	}

	let updated = structuredClone(project);

	if (spec.type === "text" || !spec.assetId) {
		const overlayAssetId = `asset-txt-${Date.now().toString(36)}`;
		const textContent = spec.text || spec.title || "Key Point";
		updated = addTextOverlay(updated, spec.startUs, {
			assetId: overlayAssetId,
			trackId: `text-track-${Date.now().toString(36)}`,
			clipId,
		});
		// Update clip text content
		const textClip = updated.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
		if (textClip && textClip.text) {
			textClip.text.content = textContent;
			textClip.sourceOutUs = spec.durationUs;
		}
		return { project: validateTimelineProject(updated), clipId, trackId: targetTrackId };
	}

	// Place media asset
	const asset = project.assets.find((a) => a.id === spec.assetId);
	if (!asset) {
		throw new Error(`Asset "${spec.assetId}" not found`);
	}

	updated = placeAsset(updated, spec.assetId, targetTrackId, spec.startUs, {
		clipId,
		compositionId: asset.kind === "recording" ? `comp-${Date.now().toString(36)}` : undefined,
	});

	// Trim duration if requested
	const placed = updated.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
	if (placed && spec.durationUs > 0) {
		placed.sourceOutUs = Math.min(placed.sourceOutUs, placed.sourceInUs + spec.durationUs);
	}

	return {
		project: validateTimelineProject(updated),
		clipId,
		trackId: targetTrackId,
	};
}

export { summarizeProjectDiff };
