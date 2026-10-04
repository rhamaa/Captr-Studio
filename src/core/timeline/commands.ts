import {
	compositionTimeMap,
	createRecordComposition,
	createRecordingPackage,
} from "@/recording/packageAdapter";
import {
	type CompletedRecording,
	clipDurationUs,
	type MediaAsset,
	type RecordComposition,
	type TextOverlay,
	type TimelineClip,
	type TimelineProject,
} from "./types";
import { validateTimelineProject } from "./validation";

export function createTimelineProject(projectId: string, title: string): TimelineProject {
	const stamp = new Date().toISOString();
	return {
		version: 3,
		projectId,
		title,
		canvas: { width: 1920, height: 1080, fps: 30 },
		assets: [],
		packages: [],
		compositions: [],
		tracks: [
			{
				id: "visual-1",
				name: "Video 1",
				kind: "visual",
				locked: false,
				muted: false,
				hidden: false,
				clips: [],
			},
			{
				id: "audio-1",
				name: "Audio 1",
				kind: "audio",
				locked: false,
				muted: false,
				hidden: false,
				clips: [],
			},
		],
		createdAt: stamp,
		updatedAt: stamp,
	};
}
function edit(project: TimelineProject, update: (next: TimelineProject) => void): TimelineProject {
	const next = structuredClone(project);
	update(next);
	next.updatedAt = new Date().toISOString();
	return validateTimelineProject(next);
}
export function registerRecording(
	p: TimelineProject,
	input: CompletedRecording,
	ids: { assetId: string; packageId: string },
): TimelineProject {
	if (p.packages.some((r) => r.captureId === input.captureId)) return p;
	return edit(p, (n) => {
		n.packages.push(createRecordingPackage(input, ids.packageId));
		n.assets.push({
			id: ids.assetId,
			kind: "recording",
			name: input.name,
			durationUs: input.durationUs,
			width: input.width,
			height: input.height,
			packageId: ids.packageId,
		});
	});
}
export function registerMedia(p: TimelineProject, asset: MediaAsset): TimelineProject {
	return edit(p, (n) => n.assets.push(structuredClone(asset)));
}
function track(p: TimelineProject, id: string) {
	const t = p.tracks.find((t) => t.id === id);
	if (!t) throw new Error("Track not found");
	if (t.locked) throw new Error("Track is locked");
	return t;
}
function find(p: TimelineProject, id: string) {
	const t = p.tracks.find((t) => t.clips.some((c) => c.id === id));
	if (!t) throw new Error("Clip not found");
	track(p, t.id);
	return { track: t, clip: t.clips.find((c) => c.id === id)! };
}
export function placeAsset(
	p: TimelineProject,
	assetId: string,
	trackId: string,
	startUs: number,
	ids: { clipId: string; compositionId?: string },
): TimelineProject {
	return edit(p, (n) => {
		const t = track(n, trackId),
			a = n.assets.find((a) => a.id === assetId);
		if (!a) throw new Error("Asset not found");
		let composition: RecordComposition | undefined;
		if (a.kind === "recording") {
			if (!ids.compositionId) throw new Error("Composition ID required");
			composition = createRecordComposition(
				n.packages.find((r) => r.id === a.packageId)!,
				ids.compositionId,
			);
			n.compositions.push(composition);
		}
		t.clips.push({
			id: ids.clipId,
			assetId,
			compositionId: composition?.id,
			startUs,
			sourceInUs: 0,
			sourceOutUs: composition?.durationUs ?? a.durationUs,
			rate: 1,
			transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
			gain: 1,
			enabled: true,
			...(a.kind === "text" ? { text: structuredClone(a.text!) } : {}),
		});
	});
}
export const DEFAULT_TEXT_OVERLAY: TextOverlay = {
	content: "Your text",
	fontFamily: "Arial",
	fontSizePx: 96,
	fontWeight: 700,
	color: "#ffffff",
	align: "center",
};
export function addTextOverlay(
	p: TimelineProject,
	startUs: number,
	ids: { assetId: string; trackId: string; clipId: string },
): TimelineProject {
	const overlay = structuredClone(DEFAULT_TEXT_OVERLAY),
		durationUs = 5_000_000,
		number =
			p.tracks.filter((t) => t.kind === "visual" && /^Text(?: \d+)?$/.test(t.name)).length +
			1;
	const asset: MediaAsset = {
		id: ids.assetId,
		kind: "text",
		name: "Text overlay",
		durationUs,
		width: p.canvas.width,
		height: p.canvas.height,
		text: overlay,
	};
	const clip: TimelineClip = {
		id: ids.clipId,
		assetId: ids.assetId,
		startUs,
		sourceInUs: 0,
		sourceOutUs: durationUs,
		rate: 1,
		transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
		gain: 1,
		enabled: true,
		text: structuredClone(overlay),
	};
	const newTrack = {
		id: ids.trackId,
		name: `Text ${number}`,
		kind: "visual" as const,
		locked: false,
		muted: false,
		hidden: false,
		clips: [clip],
	};
	return edit(p, (n) => {
		n.assets.push(asset);
		const audioIndex = n.tracks.findIndex((t) => t.kind === "audio");
		if (audioIndex < 0) n.tracks.push(newTrack);
		else n.tracks.splice(audioIndex, 0, newTrack);
	});
}
export function updateTextOverlay(
	p: TimelineProject,
	id: string,
	patch: Partial<TextOverlay>,
): TimelineProject {
	return edit(p, (n) => {
		const { clip } = find(n, id),
			asset = n.assets.find((a) => a.id === clip.assetId);
		if (asset?.kind !== "text") throw new Error("Clip is not a text overlay");
		clip.text = { ...structuredClone(clip.text ?? asset.text!), ...structuredClone(patch) };
	});
}
export function removeClip(p: TimelineProject, id: string) {
	return edit(p, (n) => {
		const { track: t, clip } = find(n, id);
		t.clips = t.clips.filter((c) => c.id !== id);
		if (
			clip.compositionId &&
			!n.tracks.some((t) => t.clips.some((c) => c.compositionId === clip.compositionId))
		)
			n.compositions = n.compositions.filter((e) => e.id !== clip.compositionId);
	});
}
export function rippleRemoveClips(p: TimelineProject, ids: string[]): TimelineProject {
	return edit(p, (n) => {
		const byTrack = new Map<string, string[]>();
		for (const id of ids) {
			const found = n.tracks.find((t) => t.clips.some((c) => c.id === id));
			if (found) {
				const list = byTrack.get(found.id) ?? [];
				list.push(id);
				byTrack.set(found.id, list);
			}
		}

		const removedCompositionIds: string[] = [];

		for (const [trackId, clipIds] of byTrack.entries()) {
			const track = n.tracks.find((t) => t.id === trackId);
			if (!track || track.locked) continue;

			const targetClips = track.clips
				.filter((c) => clipIds.includes(c.id))
				.sort((a, b) => b.startUs - a.startUs);

			for (const clip of targetClips) {
				const dur = clipDurationUs(clip);
				const startUs = clip.startUs;
				if (clip.compositionId) {
					removedCompositionIds.push(clip.compositionId);
				}
				track.clips = track.clips.filter((c) => c.id !== clip.id);
				for (const other of track.clips) {
					if (other.startUs >= startUs + dur) {
						other.startUs = Math.max(0, other.startUs - dur);
					}
				}
			}
		}

		for (const compId of removedCompositionIds) {
			if (!n.tracks.some((t) => t.clips.some((c) => c.compositionId === compId))) {
				n.compositions = n.compositions.filter((e) => e.id !== compId);
			}
		}
	});
}
export function rippleRemoveClip(p: TimelineProject, id: string): TimelineProject {
	return rippleRemoveClips(p, [id]);
}
export function removeAsset(p: TimelineProject, id: string) {
	return edit(p, (n) => {
		if (n.tracks.some((t) => t.clips.some((c) => c.assetId === id)))
			throw new Error("Asset is referenced by timeline clips");
		const a = n.assets.find((a) => a.id === id);
		n.assets = n.assets.filter((a) => a.id !== id);
		if (a?.packageId && !n.assets.some((a2) => a2.packageId === a.packageId)) {
			n.packages = n.packages.filter((r) => r.id !== a.packageId);
			n.compositions = n.compositions.filter((e) => e.packageId !== a.packageId);
		}
	});
}
export function setClipRate(p: TimelineProject, id: string, rate: number) {
	return edit(p, (n) => {
		find(n, id).clip.rate = rate;
	});
}
export function moveClip(p: TimelineProject, id: string, trackId: string, startUs: number) {
	return edit(p, (n) => {
		const { track: t, clip } = find(n, id);
		t.clips = t.clips.filter((c) => c.id !== id);
		clip.startUs = startUs;
		track(n, trackId).clips.push(clip);
	});
}
export function trimClip(
	p: TimelineProject,
	id: string,
	sourceInUs: number,
	sourceOutUs: number,
	startUs?: number,
) {
	return edit(p, (n) => {
		const c = find(n, id).clip;
		c.sourceInUs = sourceInUs;
		c.sourceOutUs = sourceOutUs;
		if (startUs !== undefined) c.startUs = startUs;
	});
}
export function splitClip(
	p: TimelineProject,
	id: string,
	atUs: number,
	ids: { rightClipId: string; rightCompositionId?: string },
) {
	return edit(p, (n) => {
		const { track: t, clip: c } = find(n, id);
		if (atUs <= c.startUs || atUs >= c.startUs + clipDurationUs(c))
			throw new Error("Split outside clip");
		const boundary = Math.round(c.sourceInUs + (atUs - c.startUs) * c.rate),
			right: TimelineClip = {
				...structuredClone(c),
				id: ids.rightClipId,
				startUs: atUs,
				sourceInUs: boundary,
			};
		c.sourceOutUs = boundary;
		if (c.compositionId) {
			if (!ids.rightCompositionId) throw new Error("Composition ID required");
			const original = n.compositions.find((e) => e.id === c.compositionId)!;
			n.compositions.push({ ...structuredClone(original), id: ids.rightCompositionId });
			right.compositionId = ids.rightCompositionId;
		}
		t.clips.push(right);
	});
}
export function duplicateClip(
	p: TimelineProject,
	id: string,
	startUs: number,
	ids: { clipId: string; compositionId?: string },
) {
	return edit(p, (n) => {
		const { track: t, clip } = find(n, id),
			copy = { ...structuredClone(clip), id: ids.clipId, startUs };
		if (clip.compositionId) {
			if (!ids.compositionId) throw new Error("Composition ID required");
			const e = n.compositions.find((e) => e.id === clip.compositionId)!;
			n.compositions.push({ ...structuredClone(e), id: ids.compositionId });
			copy.compositionId = ids.compositionId;
		}
		t.clips.push(copy);
	});
}
export function updateComposition(p: TimelineProject, id: string, value: RecordComposition) {
	return edit(p, (n) => {
		const index = n.compositions.findIndex((e) => e.id === id);
		if (index < 0) throw new Error("Composition not found");
		for (const t of n.tracks.filter((t) => t.clips.some((c) => c.compositionId === id)))
			track(n, t.id);
		const old = n.compositions[index];
		if (value.id !== id || value.packageId !== old.packageId)
			throw new Error("Composition identity is immutable");
		const pkg = n.packages.find((r) => r.id === old.packageId)!;
		const timeMap = compositionTimeMap(pkg.durationUs, value.settings);
		const durationUs = timeMap.at(-1)?.outputEndUs ?? 0;
		if (!durationUs) throw new Error("Composition cannot be empty");
		n.compositions[index] = {
			...structuredClone(value),
			revision: old.revision + 1,
			timeMap,
			durationUs,
		};
		for (const t of n.tracks)
			for (const c of t.clips.filter((c) => c.compositionId === id))
				c.sourceOutUs = Math.min(c.sourceOutUs, durationUs);
	});
}
export function updateClip(
	p: TimelineProject,
	id: string,
	patch: Partial<Pick<TimelineClip, "gain" | "transform" | "enabled" | "keyframes">>,
) {
	return edit(p, (n) => Object.assign(find(n, id).clip, structuredClone(patch)));
}
export function addClipKeyframe(
	p: TimelineProject,
	id: string,
	keyframe: import("./types").PropertyKeyframe,
): TimelineProject {
	return edit(p, (n) => {
		const clip = find(n, id).clip;
		const existing = (clip.keyframes ?? []).filter(
			(k) =>
				k.id !== keyframe.id &&
				(k.property !== keyframe.property || Math.abs(k.timeMs - keyframe.timeMs) >= 1),
		);
		clip.keyframes = [...existing, structuredClone(keyframe)].sort(
			(a, b) => a.timeMs - b.timeMs,
		);
	});
}
export function removeClipKeyframe(
	p: TimelineProject,
	id: string,
	keyframeId: string,
): TimelineProject {
	return edit(p, (n) => {
		const clip = find(n, id).clip;
		if (clip.keyframes) {
			clip.keyframes = clip.keyframes.filter((k) => k.id !== keyframeId);
		}
	});
}
export function updateClipKeyframe(
	p: TimelineProject,
	id: string,
	keyframeId: string,
	patch: Partial<import("./types").PropertyKeyframe>,
): TimelineProject {
	return edit(p, (n) => {
		const clip = find(n, id).clip;
		if (clip.keyframes) {
			clip.keyframes = clip.keyframes
				.map((k) => (k.id === keyframeId ? { ...k, ...structuredClone(patch) } : k))
				.sort((a, b) => a.timeMs - b.timeMs);
		}
	});
}
export function updateTrack(
	p: TimelineProject,
	id: string,
	patch: Partial<Pick<TimelineProject["tracks"][number], "muted" | "hidden" | "locked" | "name">>,
) {
	return edit(p, (n) => {
		const t = n.tracks.find((t) => t.id === id);
		if (!t) throw new Error("Track not found");
		Object.assign(t, patch);
	});
}
export function addTrack(p: TimelineProject, id: string, kind: "visual" | "audio") {
	return edit(p, (n) =>
		n.tracks.push({
			id,
			name: kind === "visual" ? "Video" : "Audio",
			kind,
			locked: false,
			muted: false,
			hidden: false,
			clips: [],
		}),
	);
}
export function removeTrack(p: TimelineProject, id: string): TimelineProject {
	return edit(p, (n) => {
		if (n.tracks.length <= 1) {
			throw new Error("Cannot remove the last remaining track");
		}
		const t = n.tracks.find((t) => t.id === id);
		if (!t) throw new Error("Track not found");
		if (t.locked) throw new Error("Cannot remove locked track");

		const removedCompositionIds = t.clips
			.map((c) => c.compositionId)
			.filter((id): id is string => Boolean(id));

		n.tracks = n.tracks.filter((track) => track.id !== id);

		for (const compId of removedCompositionIds) {
			if (!n.tracks.some((track) => track.clips.some((c) => c.compositionId === compId))) {
				n.compositions = n.compositions.filter((c) => c.id !== compId);
			}
		}
	});
}
export function reorderTrack(p: TimelineProject, id: string, targetIndex: number): TimelineProject {
	return edit(p, (n) => {
		const currentIndex = n.tracks.findIndex((t) => t.id === id);
		if (currentIndex < 0) throw new Error("Track not found");
		const clampedIndex = Math.max(0, Math.min(n.tracks.length - 1, targetIndex));
		if (clampedIndex === currentIndex) return;
		const [moved] = n.tracks.splice(currentIndex, 1);
		n.tracks.splice(clampedIndex, 0, moved);
	});
}
