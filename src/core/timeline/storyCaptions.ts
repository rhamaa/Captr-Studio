import type { StoryCaptionSegment, StorySubtitleSettings } from "../story/storyTypes";
import { refreshStoryProjections } from "./storyOwnership";
import type { AssetTranscript, TranscriptSegment } from "./transcriptTypes";
import type { TimelineProject } from "./types";
import { validateTimelineProject } from "./validation";

export function validateCaptionSettings(value: StorySubtitleSettings) {
	const fail = () => {
		throw new Error("Invalid Story caption settings");
	};
	for (const color of [value.primaryColor, value.secondaryColor, value.backgroundColor])
		if (color !== undefined && !/^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(color)) fail();
	if (value.position !== undefined && !["top", "center", "bottom"].includes(value.position))
		fail();
	if (value.highlightWords !== undefined && typeof value.highlightWords !== "boolean") fail();
	if (
		value.fontSize !== undefined &&
		(!Number.isFinite(value.fontSize) || value.fontSize < 1 || value.fontSize > 512)
	)
		fail();
	if (value.segments === undefined) return;
	if (!Array.isArray(value.segments) || value.segments.length > 100_000) fail();
	const ids = new Set<number>();
	for (const cue of value.segments) {
		if (
			!cue ||
			!Number.isSafeInteger(cue.id) ||
			ids.has(cue.id) ||
			typeof cue.text !== "string" ||
			!Number.isSafeInteger(cue.startUs) ||
			!Number.isSafeInteger(cue.endUs) ||
			cue.startUs < 0 ||
			cue.endUs <= cue.startUs ||
			!Array.isArray(cue.words) ||
			(cue.clipId !== undefined && (typeof cue.clipId !== "string" || !cue.clipId))
		)
			fail();
		ids.add(cue.id);
		for (const w of cue.words)
			if (
				!w ||
				typeof w.word !== "string" ||
				!Number.isSafeInteger(w.startUs) ||
				!Number.isSafeInteger(w.endUs) ||
				w.startUs < cue.startUs ||
				w.endUs > cue.endUs ||
				w.endUs <= w.startUs
			)
				fail();
	}
}

export function updateStoryCaptions(
	project: TimelineProject,
	settings: StorySubtitleSettings,
): TimelineProject {
	const next = structuredClone(project);
	next.subtitles = structuredClone(settings);
	next.updatedAt = new Date().toISOString();
	return validateTimelineProject(refreshStoryProjections(next));
}

export function generateStoryCaptions(
	project: TimelineProject,
	transcripts: Record<string, AssetTranscript>,
): TimelineProject {
	const segments: StoryCaptionSegment[] = [];
	for (const track of project.tracks) {
		if (track.hidden || (track.kind === "audio" && track.muted)) continue;
		for (const clip of track.clips) {
			const transcript = clip.assetId && transcripts[clip.assetId];
			if (!clip.enabled || clip.audioOnly || !transcript) continue;
			for (const cue of transcript.segments)
				segments.push({ ...structuredClone(cue), id: segments.length, clipId: clip.id });
		}
	}
	const settings = { ...project.subtitles, enabled: true, segments };
	validateCaptionSettings(settings);
	const visible = new Set(
		projectCaptionSegments({ ...project, subtitles: settings }).map((c) => c.id),
	);
	return updateStoryCaptions(project, {
		...settings,
		segments: segments.filter((c) => visible.has(c.id)),
	});
}

export function setStoryCaptionTime(
	project: TimelineProject,
	id: number,
	key: "startUs" | "endUs",
	timeUs: number,
): TimelineProject {
	if (!Number.isSafeInteger(timeUs) || timeUs < 0) throw new Error("Invalid caption time");
	const settings = project.subtitles,
		cue = settings?.segments?.find((c) => c.id === id);
	if (!settings || !cue) throw new Error("Caption no longer exists");
	const parts = projectCaptionSegments({
		...project,
		subtitles: { ...settings, enabled: true },
	}).filter((c) => c.id === id);
	const visible = key === "startUs" ? parts[0]?.startUs : parts.at(-1)?.endUs;
	if (timeUs === (visible ?? cue[key])) return project;
	const source = parts.length ? captionSourceTime(project, cue.clipId, timeUs, key) : timeUs;
	const a = key === "startUs" ? source : cue.startUs,
		b = key === "endUs" ? source : cue.endUs;
	const edited = {
		...cue,
		[key]: source,
		words: cue.words
			.filter((w) => w.endUs > a && w.startUs < b)
			.map((w) => ({ ...w, startUs: Math.max(a, w.startUs), endUs: Math.min(b, w.endUs) })),
	};
	return updateStoryCaptions(project, {
		...settings,
		segments: settings.segments!.map((c) => (c.id === id ? edited : c)),
	});
}

function mapCue(
	cue: StoryCaptionSegment,
	begin: number,
	end: number,
	startUs: number,
	rate: number,
): TranscriptSegment[] {
	const a = Math.max(cue.startUs, begin),
		b = Math.min(cue.endUs, end);
	if (b <= a) return [];
	const at = (source: number) => Math.round(startUs + (source - begin) / rate);
	const words = cue.words
		.filter((w) => w.endUs > a && w.startUs < b)
		.map((w) => ({
			...w,
			startUs: at(Math.max(a, w.startUs)),
			endUs: at(Math.min(b, w.endUs)),
		}));
	return [
		{
			...cue,
			startUs: at(a),
			endUs: at(b),
			words,
			text:
				words.length && (a !== cue.startUs || b !== cue.endUs)
					? words.map((w) => w.word.trim()).join(" ")
					: cue.text,
		},
	];
}

export function projectCaptionSegments(project: TimelineProject): TranscriptSegment[] {
	if (!project.subtitles?.enabled) return [];
	const result: TranscriptSegment[] = [];
	for (const cue of project.subtitles.segments ?? []) {
		if (!cue.clipId) {
			result.push(cue);
			continue;
		}
		const track = project.tracks.find((t) => t.clips.some((c) => c.id === cue.clipId));
		const clip = track?.clips.find((c) => c.id === cue.clipId);
		if (!clip?.enabled || track?.hidden || (track?.kind === "audio" && track.muted)) continue;
		const comp = project.compositions.find((c) => c.id === clip.compositionId);
		if (!comp)
			result.push(...mapCue(cue, clip.sourceInUs, clip.sourceOutUs, clip.startUs, clip.rate));
		else {
			const offset =
				project.packages.find((p) => p.id === comp.packageId)?.screen.offsetUs ?? 0;
			for (const s of comp.timeMap) {
				const a = Math.max(clip.sourceInUs, s.outputStartUs),
					b = Math.min(clip.sourceOutUs, s.outputEndUs);
				if (b <= a) continue;
				result.push(
					...mapCue(
						cue,
						s.sourceStartUs + (a - s.outputStartUs) * s.rate - offset,
						s.sourceStartUs + (b - s.outputStartUs) * s.rate - offset,
						clip.startUs + (a - clip.sourceInUs) / clip.rate,
						clip.rate * s.rate,
					),
				);
			}
		}
	}
	return result.sort((a, b) => a.startUs - b.startUs);
}

export function captionSourceTime(
	project: TimelineProject,
	clipId: string | undefined,
	timelineUs: number,
	edge: "startUs" | "endUs",
): number {
	if (!clipId) return Math.round(timelineUs);
	const clip = project.tracks.flatMap((t) => t.clips).find((c) => c.id === clipId);
	if (!clip) throw new Error("Caption clip no longer exists");
	const output = clip.sourceInUs + (timelineUs - clip.startUs) * clip.rate;
	const comp = project.compositions.find((c) => c.id === clip.compositionId);
	if (!comp) return Math.round(output);
	const s = comp.timeMap.find((s) =>
		edge === "startUs"
			? output >= s.outputStartUs && output < s.outputEndUs
			: output > s.outputStartUs && output <= s.outputEndUs,
	);
	if (!s) throw new Error("Caption time is outside the Record composition");
	const offset = project.packages.find((p) => p.id === comp.packageId)?.screen.offsetUs ?? 0;
	return Math.round(s.sourceStartUs + (output - s.outputStartUs) * s.rate - offset);
}
