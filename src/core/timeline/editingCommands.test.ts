import { expect, it } from "vitest";
import { ownershipFixture, fixtureClip, fixtureTrack } from "./storyOwnership.fixtures";
import { getStoryProject } from "./storyOwnership";
import { moveClip } from "./commands";
import { audioAtTime, buildProjectAudioPlan } from "./audioPlan";
import {
	copyClips,
	pasteClips,
	setClipRelation,
	relatedClipIds,
	detachClipAudio,
	setClipFades,
	clipFadeGain,
	copyClipAttributes,
	pasteClipAttributes,
} from "./editingCommands";
import { validateTimelineProject } from "./validation";
const fixture = () => getStoryProject(ownershipFixture(), { kind: "artboard", artboardId: "A" });
it("pastes independent Record compositions and caption anchors without crossing Story scope", () => {
	const p = fixture(),
		id = p.tracks[0].clips[0].id;
	p.subtitles = {
		enabled: true,
		segments: [{ id: 1, clipId: id, text: "Hello", startUs: 0, endUs: 1_000_000, words: [] }],
	};
	const clipboard = copyClips(p, [id]);
	let n = 0;
	const next = pasteClips(p, clipboard, 5_000_000, () => `copy-${n++}`);
	const pasted = next.tracks.flatMap((t) => t.clips).find((c) => c.id !== id)!;
	expect(pasted.startUs).toBe(5_000_000);
	expect(pasted.compositionId).not.toBe(p.tracks[0].clips[0].compositionId);
	expect(next.subtitles!.segments!.at(-1)!.clipId).toBe(pasted.id);
	expect(p.tracks[0].clips).toHaveLength(1);
	expect(() =>
		pasteClips(
			getStoryProject(ownershipFixture(), { kind: "artboard", artboardId: "B" }),
			clipboard,
			0,
		),
	).toThrow(/scope|Story/i);
});
it("moves grouped clips atomically and refuses a locked member", () => {
	let p = fixture();
	p.tracks.push(fixtureTrack("extra", [fixtureClip("second")]));
	p = setClipRelation(p, [p.tracks[0].clips[0].id, "second"], "groupId", true);
	const id = p.tracks[0].clips[0].id;
	expect(relatedClipIds(p, [id])).toHaveLength(2);
	const next = moveClip(p, id, p.tracks[0].id, 1_000_000);
	expect(
		next.tracks
			.flatMap((t) => t.clips)
			.filter((c) => [id, "second"].includes(c.id))
			.map((c) => c.startUs),
	).toEqual([1_000_000, 1_000_000]);
	p.tracks.find((t) => t.id === "extra")!.locked = true;
	expect(() => moveClip(p, id, p.tracks[0].id, 1_000_000)).toThrow(/locked/i);
	expect(p.tracks[0].clips[0].startUs).toBe(0);
});
it("detaches Record audio without flattening or doubling playback", () => {
	const p = fixture(),
		id = p.tracks[0].clips[0].id;
	p.packages[0].microphone = { path: "mic.wav", durationUs: 5_000_000, offsetUs: 0 };
	const next = detachClipAudio(p, id);
	const audio = next.tracks.flatMap((t) => t.clips).find((c) => c.audioOnly)!;
	expect(audio.audioOnly).toBe(true);
	expect(next.packages).toEqual(p.packages);
	expect(
		buildProjectAudioPlan(next)
			.filter((s) => s.path === "mic.wav")
			.map((s) => s.clipId),
	).toEqual([audio.id]);
	expect(() => validateTimelineProject(next)).not.toThrow();
});
it("applies a shared fade envelope and rejects invalid values", () => {
	let p = fixture(),
		id = p.tracks[0].clips[0].id;
	p = setClipFades(p, id, 1_000_000, 1_000_000);
	const clip = p.tracks[0].clips[0];
	expect([0, 500_000, 2_000_000, 4_500_000, 5_000_000].map((t) => clipFadeGain(clip, t))).toEqual(
		[0, 0.5, 1, 0.5, 0],
	);
	p.packages[0].microphone = { path: "mic.wav", durationUs: 5_000_000, offsetUs: 0 };
	expect(audioAtTime(buildProjectAudioPlan(p), 500_000).find((s) => s.clipId === id)?.gain).toBe(
		0.5,
	);
	expect(() => setClipFades(p, id, -1, 0)).toThrow(/fade/i);
});
it("copies placement attributes without replacing text content or sharing mutable state", () => {
	const p = ownershipFixture();
	p.tracks = [
		fixtureTrack("text", [
			fixtureClip("a", {
				content: {
					kind: "text",
					durationUs: 5_000_000,
					text: {
						content: "A",
						fontFamily: "Arial",
						fontSizePx: 60,
						fontWeight: 700,
						color: "#00ff00",
						align: "center",
					},
				},
			}),
			fixtureClip("b", {
				startUs: 5_000_000,
				content: {
					kind: "text",
					durationUs: 5_000_000,
					text: {
						content: "B",
						fontFamily: "Arial",
						fontSizePx: 24,
						fontWeight: 400,
						color: "#ffffff",
						align: "center",
					},
				},
			}),
		]),
	];
	const next = pasteClipAttributes(p, ["b"], copyClipAttributes(p, "a"));
	const content = next.tracks[0].clips[1].content;
	expect(content?.kind === "text" && content.text).toMatchObject({
		content: "B",
		fontSizePx: 60,
		color: "#00ff00",
	});
	expect(p.tracks[0].clips[1].content).not.toEqual(content);
});
