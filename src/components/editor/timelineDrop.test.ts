import { expect, it } from "vitest";
import { addTrack, createTimelineProject, placeAsset, updateTrack } from "@/core/timeline/commands";
import {
	applyTimelineDrop,
	timelineDropStartUs,
	timelineTracksInDisplayOrder,
} from "./timelineInteractions";

it("keeps the pointer at the same point inside a clip while moving it", () => {
	const project = createTimelineProject("drop-test", "Drop test");

	expect(timelineDropStartUs(550, 100, 50, project, 0, 100)).toBe(4_000_000);
});

it("clamps a drop before the lane to its beginning", () => {
	const project = createTimelineProject("drop-test", "Drop test");

	expect(timelineDropStartUs(40, 100, 20, project, 0, 100)).toBe(0);
});

it("displays visual layers above audio while keeping each group's order stable", () => {
	let project = createTimelineProject("drop-test", "Drop test");
	project = addTrack(project, "visual-2", "visual");
	project = addTrack(project, "audio-2", "audio");

	expect(timelineTracksInDisplayOrder(project.tracks).map((track) => track.id)).toEqual([
		"visual-2",
		"visual-1",
		"audio-1",
		"audio-2",
	]);
});

it("routes an audio asset dropped over a visual lane into the audio group", () => {
	const project = createTimelineProject("drop-test", "Drop test");
	project.assets.push({
		id: "voice",
		kind: "audio",
		name: "Voice",
		durationUs: 4_000_000,
		width: 0,
		height: 0,
		source: { path: "voice.wav", durationUs: 4_000_000, offsetUs: 0 },
	});
	const visualTrack = project.tracks.find((track) => track.kind === "visual")!;

	const next = applyTimelineDrop(
		project,
		{
			type: "asset",
			id: "voice",
			preferredTrackId: visualTrack.id,
			startUs: 0,
			durationUs: 4_000_000,
		},
		{ trackId: "audio-new", clipId: "voice-clip" },
	);

	const placedTrack = next.tracks.find((track) =>
		track.clips.some((clip) => clip.id === "voice-clip"),
	);
	expect(placedTrack?.kind).toBe("audio");
	expect(placedTrack?.id).toBe("audio-1");
	expect(next.tracks.filter((track) => track.kind === "visual")).toHaveLength(1);
});

it("does not create a replacement lane when all compatible lanes are locked", () => {
	let project = createTimelineProject("drop-test", "Drop test");
	project.assets.push({
		id: "voice",
		kind: "audio",
		name: "Voice",
		durationUs: 4_000_000,
		width: 0,
		height: 0,
		source: { path: "voice.wav", durationUs: 4_000_000, offsetUs: 0 },
	});
	project = updateTrack(project, "audio-1", { locked: true });

	expect(() =>
		applyTimelineDrop(
			project,
			{
				type: "asset",
				id: "voice",
				preferredTrackId: "visual-1",
				startUs: 0,
				durationUs: 4_000_000,
			},
			{ trackId: "audio-new", clipId: "voice-clip" },
		),
	).toThrow("Cannot drop on a locked track");
	expect(project.tracks).toHaveLength(2);
});

it("creates a visual lane for overlapping drops and places it above existing visual lanes", () => {
	let project = createTimelineProject("drop-test", "Drop test");
	project.assets.push({
		id: "video",
		kind: "video",
		name: "Video",
		durationUs: 5_000_000,
		width: 1920,
		height: 1080,
		source: { path: "video.mp4", durationUs: 5_000_000, offsetUs: 0 },
	});
	const visualTrack = project.tracks.find((track) => track.kind === "visual")!;
	project = placeAsset(project, "video", visualTrack.id, 0, { clipId: "first-clip" });

	const next = applyTimelineDrop(
		project,
		{
			type: "asset",
			id: "video",
			preferredTrackId: visualTrack.id,
			startUs: 4_000_000,
			durationUs: 5_000_000,
		},
		{ trackId: "visual-new", clipId: "second-clip" },
	);

	expect(next.tracks.find((track) => track.id === "visual-new")?.clips[0]?.id).toBe(
		"second-clip",
	);
	expect(
		timelineTracksInDisplayOrder(next.tracks)
			.filter((track) => track.kind === "visual")
			.map((track) => track.id),
	).toEqual(["visual-new", visualTrack.id]);
});

it("reuses a visual lane when the new clip only touches the existing interval", () => {
	let project = createTimelineProject("drop-test", "Drop test");
	project.assets.push({
		id: "video",
		kind: "video",
		name: "Video",
		durationUs: 5_000_000,
		width: 1920,
		height: 1080,
		source: { path: "video.mp4", durationUs: 5_000_000, offsetUs: 0 },
	});
	const visualTrack = project.tracks.find((track) => track.kind === "visual")!;
	project = placeAsset(project, "video", visualTrack.id, 0, { clipId: "first-clip" });

	const next = applyTimelineDrop(
		project,
		{
			type: "asset",
			id: "video",
			preferredTrackId: visualTrack.id,
			startUs: 5_000_000,
			durationUs: 5_000_000,
		},
		{ trackId: "unused-track", clipId: "second-clip" },
	);

	expect(next.tracks.filter((track) => track.kind === "visual")).toHaveLength(1);
	expect(next.tracks.find((track) => track.id === visualTrack.id)?.clips).toHaveLength(2);
});

it("creates a same-kind lane when moving a clip into an occupied interval", () => {
	let project = createTimelineProject("drop-test", "Drop test");
	project.assets.push({
		id: "video",
		kind: "video",
		name: "Video",
		durationUs: 5_000_000,
		width: 1920,
		height: 1080,
		source: { path: "video.mp4", durationUs: 5_000_000, offsetUs: 0 },
	});
	const visualTrack = project.tracks.find((track) => track.kind === "visual")!;
	project = placeAsset(project, "video", visualTrack.id, 0, { clipId: "moving-clip" });
	project = addTrack(project, "visual-2", "visual");
	project = placeAsset(project, "video", "visual-2", 0, { clipId: "blocking-clip" });

	const next = applyTimelineDrop(
		project,
		{
			type: "clip",
			id: "moving-clip",
			preferredTrackId: "visual-2",
			startUs: 0,
			durationUs: 5_000_000,
		},
		{ trackId: "visual-new", clipId: "unused-clip" },
	);

	expect(
		next.tracks.find((track) => track.id === "visual-new")?.clips.map((clip) => clip.id),
	).toEqual(["moving-clip"]);
	expect(next.tracks.find((track) => track.id === "visual-1")?.clips).toHaveLength(0);
});
