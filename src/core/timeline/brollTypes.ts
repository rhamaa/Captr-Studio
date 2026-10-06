import type { MediaAsset, TimelineClip, TimelineProject, TimelineTrack } from "./types";

export type BRollAnimationType =
	| "kinetic_typography"
	| "title_card"
	| "callout_card"
	| "stat_counter"
	| "code_snippet"
	| "custom";

export interface BRollSpec {
	id: string;
	timelineStartUs: number;
	durationUs: number;
	type: BRollAnimationType;
	title: string;
	subtitle?: string;
	body?: string;
	theme?: "dark_modern" | "light_clean" | "neon_gradient" | "minimal";
	accentColor?: string;
	layout?: "fullscreen_overlay" | "lower_third" | "split_left" | "split_right" | "center_card";
	meta?: Record<string, unknown>;
}

export interface BRollRenderResult {
	specId: string;
	assetId: string;
	name: string;
	relativePath: string;
	absolutePath: string;
	timelineStartUs: number;
	durationUs: number;
	width: number;
	height: number;
	success: boolean;
	error?: string;
}

/**
 * Validates and normalizes raw JSON output representing an array of BRollSpec.
 */
export function validateBRollSpecs(data: unknown): BRollSpec[] {
	if (!Array.isArray(data)) return [];

	const valid: BRollSpec[] = [];
	for (const item of data) {
		if (!item || typeof item !== "object") continue;
		const raw = item as Record<string, unknown>;

		const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `broll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
		const timelineStartUs = Math.max(0, Math.round(Number(raw.timelineStartUs) || 0));
		const durationUs = Math.max(500_000, Math.round(Number(raw.durationUs) || 3_000_000));
		const title = typeof raw.title === "string" ? raw.title.trim() : "";
		if (!title) continue;

		const type: BRollAnimationType =
			typeof raw.type === "string" &&
			[
				"kinetic_typography",
				"title_card",
				"callout_card",
				"stat_counter",
				"code_snippet",
				"custom",
			].includes(raw.type)
				? (raw.type as BRollAnimationType)
				: "title_card";

		valid.push({
			id,
			timelineStartUs,
			durationUs,
			type,
			title,
			subtitle: typeof raw.subtitle === "string" ? raw.subtitle.trim() : undefined,
			body: typeof raw.body === "string" ? raw.body.trim() : undefined,
			theme: typeof raw.theme === "string" ? (raw.theme as BRollSpec["theme"]) : "dark_modern",
			accentColor: typeof raw.accentColor === "string" ? raw.accentColor : undefined,
			layout: typeof raw.layout === "string" ? (raw.layout as BRollSpec["layout"]) : "fullscreen_overlay",
			meta: raw.meta && typeof raw.meta === "object" ? (raw.meta as Record<string, unknown>) : undefined,
		});
	}

	return valid;
}

export const BROLL_TRACK_NAME = "B-Roll (Hyperframe)";

/**
 * Injects successfully rendered Hyperframe B-Roll assets into the timeline project.
 * Inserts media assets and places clips onto the dedicated B-Roll visual track.
 */
export function injectBRollClipsIntoProject(
	project: TimelineProject,
	results: BRollRenderResult[],
): TimelineProject {
	const successful = results.filter((r) => r.success);
	if (successful.length === 0) return project;

	// Clone assets and tracks
	const newAssets: MediaAsset[] = [...project.assets];
	const newTracks: TimelineTrack[] = project.tracks.map((t) => ({
		...t,
		clips: [...t.clips],
	}));

	// Find or create B-Roll visual track
	let brollTrackIndex = newTracks.findIndex(
		(t) => t.kind === "visual" && t.name.toLowerCase().includes("b-roll"),
	);

	if (brollTrackIndex === -1) {
		const newTrack: TimelineTrack = {
			id: `track-broll-${Date.now()}`,
			name: BROLL_TRACK_NAME,
			kind: "visual",
			locked: false,
			muted: false,
			hidden: false,
			clips: [],
		};
		// Place B-Roll above base A-Roll track (Track 1)
		const firstVisualIdx = newTracks.findIndex((t) => t.kind === "visual");
		if (firstVisualIdx !== -1 && firstVisualIdx + 1 < newTracks.length) {
			newTracks.splice(firstVisualIdx + 1, 0, newTrack);
			brollTrackIndex = firstVisualIdx + 1;
		} else {
			newTracks.push(newTrack);
			brollTrackIndex = newTracks.length - 1;
		}
	}

	const targetTrack = newTracks[brollTrackIndex];

	for (const res of successful) {
		// 1. Add MediaAsset
		const existingAssetIdx = newAssets.findIndex((a) => a.id === res.assetId);
		const assetObj: MediaAsset = {
			id: res.assetId,
			kind: "video",
			name: res.name || `Hyperframe: ${res.specId}`,
			durationUs: res.durationUs,
			width: res.width,
			height: res.height,
			source: {
				path: res.relativePath,
				durationUs: res.durationUs,
				offsetUs: 0,
			},
		};

		if (existingAssetIdx !== -1) {
			newAssets[existingAssetIdx] = assetObj;
		} else {
			newAssets.push(assetObj);
		}

		// 2. Add TimelineClip to B-Roll track
		const clipId = `clip-broll-${res.specId}-${Date.now().toString().slice(-4)}`;
		const clip: TimelineClip = {
			id: clipId,
			assetId: res.assetId,
			startUs: res.timelineStartUs,
			sourceInUs: 0,
			sourceOutUs: res.durationUs,
			rate: 1,
			transform: {
				x: 0,
				y: 0,
				scale: 1,
				rotation: 0,
				opacity: 1,
			},
			gain: 0, // No audio conflict with main A-Roll vocal track
			enabled: true,
		};

		targetTrack.clips.push(clip);
	}

	// Sort clips on B-Roll track by startUs
	targetTrack.clips.sort((a, b) => a.startUs - b.startUs);

	return {
		...project,
		assets: newAssets,
		tracks: newTracks,
		updatedAt: new Date().toISOString(),
	};
}
