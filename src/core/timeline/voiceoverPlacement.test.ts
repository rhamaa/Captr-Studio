import { describe, expect, it } from "vitest";
import { addTrack, createTimelineProject } from "./commands";
import type { MediaAsset, TimelineProject } from "./types";
import { placeVoiceover } from "./voiceoverPlacement";

const voiceover: MediaAsset = {
	id: "voiceover-asset",
	kind: "audio",
	name: "Voiceover",
	durationUs: 5_000_000,
	width: 0,
	height: 0,
	source: { path: "C:/recordings/voiceover.webm", durationUs: 5_000_000, offsetUs: 0 },
};

function projectWithVoiceover(): TimelineProject {
	const project = createTimelineProject("project", "Test");
	project.assets.push(voiceover);
	return project;
}

function addExistingClip(
	project: TimelineProject,
	trackId: string,
	startUs: number,
	durationUs: number,
) {
	const track = project.tracks.find((candidate) => candidate.id === trackId);
	if (!track) throw new Error(`Missing test track: ${trackId}`);
	const assetId = `asset-${trackId}`;
	project.assets.push({
		id: assetId,
		kind: "audio",
		name: "Existing audio",
		durationUs,
		width: 0,
		height: 0,
		source: { path: `C:/recordings/${assetId}.wav`, durationUs, offsetUs: 0 },
	});
	track.clips.push({
		id: `clip-${trackId}`,
		assetId,
		startUs,
		sourceInUs: 0,
		sourceOutUs: durationUs,
		rate: 1,
		transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
		gain: 1,
		enabled: true,
	});
}

describe("placeVoiceover", () => {
	it("places a private source without publishing it and rejects a sibling view", () => {
		const project = createTimelineProject("private-voice", "Voice");
		project.localAssets = [{ ...voiceover, kind: "audio" }];
		const ids = { clipId: "private-clip", trackId: "new-track" };
		const next = placeVoiceover(project, voiceover.id, 1_000_000, ids);
		expect(next.assets).toEqual([]);
		expect(next.localAssets).toEqual(project.localAssets);
		expect(next.tracks[1].clips[0]).toMatchObject({ assetId: voiceover.id, startUs: 1_000_000 });
		expect(() => placeVoiceover({ ...project, localAssets: [] }, voiceover.id, 0, ids)).toThrow(/asset/i);
	});
	it("uses the first unlocked audio track with a free interval", () => {
		const project = projectWithVoiceover();
		addExistingClip(project, "audio-1", 0, 10_000_000);
		project.tracks.push({
			id: "audio-2",
			name: "Audio 2",
			kind: "audio",
			locked: false,
			muted: false,
			hidden: false,
			clips: [],
		});

		const result = placeVoiceover(project, voiceover.id, 2_000_000, {
			clipId: "voiceover-clip",
			trackId: "new-audio",
		});

		expect(result.tracks.find((track) => track.id === "audio-2")?.clips).toHaveLength(1);
		expect(result.tracks.find((track) => track.id === "audio-2")?.clips[0]).toMatchObject({
			id: "voiceover-clip",
			assetId: voiceover.id,
			startUs: 2_000_000,
		});
		expect(result.tracks).toHaveLength(project.tracks.length);
	});

	it("adds an audio track when existing lanes are occupied or locked", () => {
		let project = projectWithVoiceover();
		project.tracks.find((track) => track.id === "audio-1")!.locked = true;
		project = addTrack(project, "audio-2", "audio");
		addExistingClip(project, "audio-2", 0, 10_000_000);

		const result = placeVoiceover(project, voiceover.id, 2_000_000, {
			clipId: "voiceover-clip",
			trackId: "audio-3",
		});

		const voiceoverTrack = result.tracks.find((track) => track.id === "audio-3");
		expect(voiceoverTrack).toMatchObject({ kind: "audio", locked: false });
		expect(voiceoverTrack?.clips[0]?.startUs).toBe(2_000_000);
		expect(result.tracks.find((track) => track.id === "audio-1")?.clips).toHaveLength(0);
	});

	it("adds an audio track when the project has no audio lanes", () => {
		const project = projectWithVoiceover();
		project.tracks = project.tracks.filter((track) => track.kind !== "audio");

		const result = placeVoiceover(project, voiceover.id, 0, {
			clipId: "voiceover-clip",
			trackId: "audio-created",
		});

		expect(result.tracks.find((track) => track.id === "audio-created")?.clips[0]).toMatchObject(
			{
				assetId: voiceover.id,
				startUs: 0,
			},
		);
	});

	it("never overlaps an existing clip on the selected track", () => {
		const project = projectWithVoiceover();
		addExistingClip(project, "audio-1", 0, 2_000_000);

		const result = placeVoiceover(project, voiceover.id, 2_000_000, {
			clipId: "voiceover-clip",
			trackId: "audio-created",
		});

		const audioTrack = result.tracks.find((track) => track.id === "audio-1");
		expect(audioTrack?.clips).toHaveLength(2);
		expect(audioTrack?.clips[1]?.startUs).toBe(2_000_000);
		expect(result.tracks).toHaveLength(project.tracks.length);
		expect(project.tracks.find((track) => track.id === "audio-1")?.clips).toHaveLength(1);
	});

	it("rejects missing or non-audio assets and invalid start times", () => {
		const project = projectWithVoiceover();
		project.assets.push({ ...voiceover, id: "video-asset", kind: "video" });
		const ids = { clipId: "clip", trackId: "audio-created" };

		expect(() => placeVoiceover(project, "missing", 0, ids)).toThrow(/asset/i);
		expect(() => placeVoiceover(project, "video-asset", 0, ids)).toThrow(/audio/i);
		expect(() => placeVoiceover(project, voiceover.id, -1, ids)).toThrow(/time|start/i);
	});

	it("does not mutate the source project", () => {
		const project = projectWithVoiceover();
		const result = placeVoiceover(project, voiceover.id, 1_000_000, {
			clipId: "voiceover-clip",
			trackId: "audio-created",
		});

		expect(project.tracks.flatMap((track) => track.clips)).toHaveLength(0);
		expect(result).not.toBe(project);
		expect(result.assets).toEqual(project.assets);
	});
});
