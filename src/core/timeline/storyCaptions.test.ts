import { describe, expect, it } from "vitest";
import {
	createTimelineProject,
	placeAsset,
	registerMedia,
	setClipRate,
	trimClip,
	moveClip,
} from "./commands";
import {
	generateStoryCaptions,
	projectCaptionSegments,
	updateStoryCaptions,
	setStoryCaptionTime,
} from "./storyCaptions";
import { validateTimelineProject } from "./validation";
import type { AssetTranscript } from "./transcriptTypes";
import { ownershipFixture } from "./storyOwnership.fixtures";
import { applyStoryCommand, createStorySnapshot, getStoryProject } from "./storyOwnership";
import { ProjectHistory } from "./history";

const transcript: AssetTranscript = {
	assetId: "speech",
	language: "en",
	durationUs: 4_000_000,
	segments: [
		{
			id: 0,
			text: "Hello world",
			startUs: 1_000_000,
			endUs: 3_000_000,
			words: [
				{ word: "Hello", startUs: 1_000_000, endUs: 2_000_000 },
				{ word: "world", startUs: 2_000_000, endUs: 3_000_000 },
			],
		},
	],
};
function fixture() {
	let p = createTimelineProject("captions", "Captions");
	p = registerMedia(p, {
		id: "speech",
		name: "Speech",
		kind: "video",
		width: 1920,
		height: 1080,
		durationUs: 4_000_000,
		source: { path: "/speech.mp4", durationUs: 4_000_000, offsetUs: 0 },
	});
	return placeAsset(p, "speech", p.tracks[0].id, 2_000_000, { clipId: "clip" });
}
describe("final Story captions", () => {
	it("does not dirty or truncate an anchored caption when unchanged visible timing loses focus", () => {
		const p = trimClip(
			generateStoryCaptions(fixture(), { speech: transcript }),
			"clip",
			1_500_000,
			4_000_000,
		);
		expect(setStoryCaptionTime(p, 0, "startUs", 2_000_000)).toBe(p);
		expect(p.subtitles!.segments![0].startUs).toBe(1_000_000);
	});
	it("generates only captions intersecting the current placement", () => {
		const p = trimClip(fixture(), "clip", 0, 3_000_000);
		const raw = structuredClone(transcript);
		raw.segments.push({
			id: 1,
			text: "Outside",
			startUs: 3_100_000,
			endUs: 3_800_000,
			words: [],
		});
		expect(generateStoryCaptions(p, { speech: raw }).subtitles!.segments).toHaveLength(1);
	});
	it("keeps editable source captions anchored through later trims, rate changes and moves", () => {
		let p = generateStoryCaptions(fixture(), { speech: transcript });
		p = trimClip(p, "clip", 1_500_000, 4_000_000);
		p = setClipRate(p, "clip", 2);
		p = moveClip(p, "clip", p.tracks[0].id, 5_000_000);
		const [cue] = projectCaptionSegments(p);
		expect([cue.startUs, cue.endUs]).toEqual([5_000_000, 5_750_000]);
		expect(cue.words.map((w) => [w.startUs, w.endUs])).toEqual([
			[5_000_000, 5_250_000],
			[5_250_000, 5_750_000],
		]);
		expect(transcript.segments[0].startUs).toBe(1_000_000);
	});
	it("maps Record source captions across cuts and nested playback rates", () => {
		let p = ownershipFixture();
		p = getStoryProject(p, { kind: "artboard", artboardId: "A" });
		const clip = p.tracks.flatMap((t) => t.clips).find((c) => c.compositionId)!;
		const comp = p.compositions.find((c) => c.id === clip.compositionId)!;
		comp.timeMap = [
			{ outputStartUs: 0, outputEndUs: 1_000_000, sourceStartUs: 1_000_000, rate: 2 },
		];
		comp.durationUs = 1_000_000;
		clip.sourceInUs = 0;
		clip.sourceOutUs = 1_000_000;
		clip.startUs = 0;
		clip.rate = 2;
		p = generateStoryCaptions(p, { [clip.assetId!]: transcript });
		const cues = projectCaptionSegments(p);
		expect(cues.map((c) => [c.startUs, c.endUs])).toEqual([[0, 500_000]]);
	});
	it.each([
		"startUs",
		"endUs",
	] as const)("anchors caption %s to the correct side of a Record cut", (edge) => {
		const p = getStoryProject(ownershipFixture(), { kind: "artboard", artboardId: "A" });
		const clip = p.tracks[0].clips[0],
			comp = p.compositions.find((c) => c.id === clip.compositionId)!;
		comp.timeMap = [
			{ outputStartUs: 0, outputEndUs: 1_000_000, sourceStartUs: 0, rate: 1 },
			{ outputStartUs: 1_000_000, outputEndUs: 2_000_000, sourceStartUs: 3_000_000, rate: 1 },
		];
		comp.durationUs = clip.sourceOutUs = 2_000_000;
		p.subtitles = {
			enabled: true,
			segments: [
				{ id: 0, clipId: clip.id, text: "Cut", startUs: 0, endUs: 4_000_000, words: [] },
			],
		};
		const next = setStoryCaptionTime(p, 0, edge, 1_000_000);
		expect(next.subtitles!.segments![0][edge]).toBe(edge === "startUs" ? 3_000_000 : 1_000_000);
	});
	it("preserves edited wordless captions and localizes changes to one Artboard", () => {
		const p = ownershipFixture(),
			before = structuredClone(p.repurposeBoard!.artboards[1]);
		const updated = applyStoryCommand(p, { kind: "artboard", artboardId: "A" }, (view) =>
			updateStoryCaptions(view, {
				enabled: true,
				segments: [{ id: 1, text: "Local", startUs: 0, endUs: 1_000_000, words: [] }],
			}),
		);
		expect(
			projectCaptionSegments(
				getStoryProject(updated, { kind: "artboard", artboardId: "A" }),
			)[0].text,
		).toBe("Local");
		expect(updated.repurposeBoard!.artboards[1]).toEqual(before);
		expect(p.repurposeBoard!.artboards[0].subtitles?.segments).toBeUndefined();
	});
	it("undoes caption generation and remaps placement anchors in independent snapshots", () => {
		const history = new ProjectHistory(fixture());
		history.execute((p) => generateStoryCaptions(p, { speech: transcript }));
		const copied = createStorySnapshot(
			history.project,
			history.project,
			(kind, id) => `${kind}-${id}-copy`,
		);
		expect(copied.subtitles!.segments![0].clipId).toBe("clip-clip-copy");
		history.undo();
		expect(history.project.subtitles).toBeUndefined();
		history.redo();
		expect(projectCaptionSegments(history.project)[0].text).toBe("Hello world");
	});
	it.each([
		{ segments: [{ id: 1, text: "Bad", startUs: 10, endUs: 5, words: [] }] },
		{
			segments: [
				{
					id: 1,
					text: "Bad",
					startUs: 0,
					endUs: 10,
					words: [{ word: "bad", startUs: -1, endUs: 2 }],
				},
			],
		},
		{ primaryColor: "url(bad)" },
		{ position: "outside" },
		{ fontSize: 0 },
	])("rejects invalid caption metadata at the project boundary: %o", (patch) => {
		const p = fixture();
		p.subtitles = { enabled: true, ...patch } as any;
		expect(() => validateTimelineProject(p)).toThrow(/subtitle|caption/i);
	});
});
