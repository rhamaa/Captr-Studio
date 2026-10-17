import { resolveClipSource } from "./clipSource";
import { reconcileClipTransitions } from "./clipTransitions";
import { refreshStoryProjections } from "./storyOwnership";
import {
	clipDurationUs,
	type TimelineClip,
	type TimelineProject,
	type TimelineTrack,
} from "./types";
import { validateTimelineProject } from "./validation";
export { clipFadeGain } from "./audioFades";

function commit(p: TimelineProject, update: (next: TimelineProject) => void): TimelineProject {
	const next = structuredClone(p);
	update(next);
	reconcileClipTransitions(next);
	next.updatedAt = new Date().toISOString();
	return validateTimelineProject(refreshStoryProjections(next));
}
function entries(p: TimelineProject, ids: string[], locked = true) {
	return [...new Set(ids)].map((id) => {
		const track = p.tracks.find((t) => t.clips.some((c) => c.id === id)),
			clip = track?.clips.find((c) => c.id === id);
		if (!track || !clip) throw new Error("Clip not found in this Story");
		if (locked && track.locked) throw new Error("Track is locked");
		return { track, clip };
	});
}
export function relatedClipIds(p: TimelineProject, ids: string[]): string[] {
	const all = p.tracks.flatMap((t) => t.clips),
		selected = new Set(ids.filter((id) => all.some((c) => c.id === id)));
	let changed = true;
	while (changed) {
		changed = false;
		const chosen = all.filter((c) => selected.has(c.id));
		const groups = new Set(chosen.map((c) => c.groupId).filter(Boolean)),
			links = new Set(chosen.map((c) => c.linkId).filter(Boolean));
		for (const clip of all)
			if (
				!selected.has(clip.id) &&
				((clip.groupId && groups.has(clip.groupId)) ||
					(clip.linkId && links.has(clip.linkId)))
			) {
				selected.add(clip.id);
				changed = true;
			}
	}
	return [...selected];
}
export function setClipRelation(
	p: TimelineProject,
	ids: string[],
	kind: "groupId" | "linkId",
	join: boolean,
): TimelineProject {
	return commit(p, (n) => {
		const selected = entries(n, relatedClipIds(n, ids));
		if (join && selected.length < 2) throw new Error("Select at least two clips");
		const relation = join ? crypto.randomUUID() : undefined;
		for (const { clip } of selected) clip[kind] = relation;
	});
}
export interface ClipClipboard {
	projectId: string;
	lanes: Array<{ trackId: string; kind: TimelineTrack["kind"]; clips: TimelineClip[] }>;
	compositions: TimelineProject["compositions"];
	transitions: NonNullable<TimelineProject["clipTransitions"]>;
	captions: NonNullable<NonNullable<TimelineProject["subtitles"]>["segments"]>;
}
export function copyClips(p: TimelineProject, ids: string[]): ClipClipboard {
	const selection = new Set(relatedClipIds(p, ids));
	if (!selection.size) throw new Error("Select clips to copy");
	return structuredClone({
		projectId: p.projectId,
		lanes: p.tracks
			.filter((t) => t.clips.some((c) => selection.has(c.id)))
			.map((t) => ({
				trackId: t.id,
				kind: t.kind,
				clips: t.clips.filter((c) => selection.has(c.id)),
			})),
		compositions: p.compositions.filter((c) =>
			p.tracks.some((t) =>
				t.clips.some((clip) => selection.has(clip.id) && clip.compositionId === c.id),
			),
		),
		transitions: (p.clipTransitions ?? []).filter(
			(t) => selection.has(t.fromClipId) && selection.has(t.toClipId),
		),
		captions: (p.subtitles?.segments ?? []).filter((c) => c.clipId && selection.has(c.clipId)),
	});
}
export function pasteClips(
	p: TimelineProject,
	data: ClipClipboard,
	startUs: number,
	newId: () => string = () => crypto.randomUUID(),
): TimelineProject {
	if (
		data.projectId !== p.projectId ||
		data.lanes.some((l) => !p.tracks.some((t) => t.id === l.trackId))
	)
		throw new Error("Clipboard belongs to a different Story scope");
	if (!Number.isSafeInteger(startUs) || startUs < 0) throw new Error("Invalid paste time");
	return commit(p, (n) => {
		const origin = Math.min(...data.lanes.flatMap((l) => l.clips.map((c) => c.startUs))),
			ids = new Map<string, string>(),
			relations = new Map<string, string>(),
			lanes = new Map<string, string>();
		const remap = (id: string) => {
			let next = relations.get(id);
			if (!next) {
				next = newId();
				relations.set(id, next);
			}
			return next;
		};
		for (const lane of data.lanes) {
			let track = n.tracks.find((t) => t.id === lane.trackId)!;
			if (track.locked) throw new Error("Track is locked");
			const clips = structuredClone(lane.clips).map((c) => ({
				...c,
				startUs: startUs + c.startUs - origin,
			}));
			if (
				clips.some((c) =>
					track.clips.some(
						(other) =>
							c.startUs < other.startUs + clipDurationUs(other) &&
							other.startUs < c.startUs + clipDurationUs(c),
					),
				)
			) {
				track = { ...track, id: newId(), name: `${track.name} copy`, clips: [] };
				n.tracks.push(track);
			}
			lanes.set(lane.trackId, track.id);
			for (const clip of clips) {
				const original = clip.id;
				clip.id = newId();
				ids.set(original, clip.id);
				if (clip.groupId) clip.groupId = remap(clip.groupId);
				if (clip.linkId) clip.linkId = remap(clip.linkId);
				if (clip.compositionId) {
					const comp = data.compositions.find((c) => c.id === clip.compositionId);
					if (!comp) throw new Error("Missing clipboard composition");
					clip.compositionId = newId();
					n.compositions.push({ ...structuredClone(comp), id: clip.compositionId });
				}
				track.clips.push(clip);
			}
		}
		for (const transition of data.transitions)
			(n.clipTransitions ??= []).push({
				...structuredClone(transition),
				id: newId(),
				trackId: lanes.get(transition.trackId)!,
				fromClipId: ids.get(transition.fromClipId)!,
				toClipId: ids.get(transition.toClipId)!,
			});
		if (n.subtitles && data.captions.length) {
			let cueId = Math.max(-1, ...(n.subtitles.segments ?? []).map((c) => c.id)) + 1;
			(n.subtitles.segments ??= []).push(
				...data.captions.map((c) => ({
					...structuredClone(c),
					id: cueId++,
					clipId: ids.get(c.clipId!)!,
				})),
			);
		}
	});
}
export function copyClipAttributes(p: TimelineProject, id: string) {
	const { clip } = entries(p, [id], false)[0];
	return structuredClone({
		transform: clip.transform,
		gain: clip.gain,
		keyframes: clip.keyframes,
		componentAnimation: clip.componentAnimation,
		shapeStyleOverride: clip.shapeStyleOverride,
		fadeInUs: clip.fadeInUs,
		fadeOutUs: clip.fadeOutUs,
		text: clip.content?.kind === "text" ? clip.content.text : undefined,
	});
}
export function pasteClipAttributes(
	p: TimelineProject,
	ids: string[],
	data: ReturnType<typeof copyClipAttributes>,
): TimelineProject {
	return commit(p, (n) => {
		for (const { clip } of entries(n, ids)) {
			const { text, shapeStyleOverride, ...common } = structuredClone(data);
			Object.assign(clip, common);
			if (clip.content?.kind === "text" && text)
				clip.content.text = { ...text, content: clip.content.text.content };
			if (resolveClipSource(n, clip).kind === "shape")
				clip.shapeStyleOverride = shapeStyleOverride;
		}
	});
}
export function detachClipAudio(p: TimelineProject, id: string): TimelineProject {
	return commit(p, (n) => {
		const { clip, track } = entries(n, [id])[0],
			source = resolveClipSource(n, clip);
		if (
			track.kind !== "visual" ||
			clip.audioMuted ||
			!["video", "recording"].includes(source.kind)
		)
			throw new Error("This clip has no attached audio");
		const audio = { ...structuredClone(clip), id: crypto.randomUUID(), audioOnly: true };
		delete audio.groupId;
		delete audio.linkId;
		delete audio.keyframes;
		delete audio.componentAnimation;
		if (audio.compositionId) {
			const comp = n.compositions.find((c) => c.id === audio.compositionId)!;
			audio.compositionId = crypto.randomUUID();
			n.compositions.push({ ...structuredClone(comp), id: audio.compositionId });
		}
		clip.audioMuted = true;
		n.tracks.push({
			id: crypto.randomUUID(),
			name: `${source.name} audio`,
			kind: "audio",
			locked: false,
			muted: false,
			hidden: false,
			clips: [audio],
		});
	});
}
export function setClipFades(
	p: TimelineProject,
	id: string,
	fadeInUs: number,
	fadeOutUs: number,
): TimelineProject {
	return commit(p, (n) => {
		const { clip } = entries(n, [id])[0];
		Object.assign(clip, { fadeInUs, fadeOutUs });
	});
}
