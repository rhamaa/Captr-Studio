import { expect, it } from "vitest";
import { convertLegacyRecordProject } from "./legacyConversion";

it("converts canonical V2 Record once and preserves metadata without changing original", () => {
	const old = {
		version: 2,
		projectId: "old",
		title: "Old",
		canvas: { width: 1920, height: 1080, fps: 30 },
		slides: [
			{
				id: "s",
				type: "record",
				durationMs: 10000,
				meta: {
					videoPath: "screen.mp4",
					microphoneAudioPath: "mic.wav",
					cursorTelemetryPath: "cursor.json",
					showCursor: true,
					zoomRegions: [
						{ id: "z", startMs: 0, endMs: 1000, depth: 2, focus: { cx: 0.5, cy: 0.5 } },
					],
				},
			},
		],
		clips: [{ id: "duplicate", videoPath: "screen.mp4" }],
		transitions: [],
		globalAudioTracks: [],
	};
	const before = structuredClone(old);
	const next = convertLegacyRecordProject(old, { projectId: "new", prefix: "import" });
	expect(next.projectId).toBe("new");
	expect(next.assets).toHaveLength(1);
	expect(next.compositions[0].settings.zoomRegions).toHaveLength(1);
	expect(next.packages[0].microphone?.path).toBe("mic.wav");
	expect(old).toEqual(before);
	expect(() =>
		convertLegacyRecordProject(
			{ ...old, slides: [{ type: "motion" }] },
			{ projectId: "new", prefix: "import" },
		),
	).toThrow();
	expect(() =>
		convertLegacyRecordProject(
			{ ...old, transitions: [{ type: "crossfade" }] },
			{ projectId: "new", prefix: "import" },
		),
	).toThrow(/transition/i);
});
it("retains legacy audio placement, trims, gain and signed webcam offset; rejects unsupported audio", () => {
	const old = {
		version: 2,
		projectId: "old",
		slides: [
			{
				id: "s",
				type: "record",
				durationMs: 10_000,
				meta: {
					videoPath: "screen.mp4",
					webcamPath: "camera.mp4",
					webcam: { timeOffsetMs: -500 },
				},
			},
		],
		globalAudioTracks: [
			{
				id: "g",
				name: "Music",
				path: "music.wav",
				durationMs: 20_000,
				startMsOffset: 1000,
				trimStartMs: 2000,
				trimEndMs: 12_000,
				volume: 0.4,
			},
		],
	};
	const next = convertLegacyRecordProject(old, { projectId: "new", prefix: "copy" });
	const audio = next.tracks.find((t) => t.kind === "audio" && t.clips.length)!.clips[0];
	expect(next.packages[0].webcam!.offsetUs).toBe(-500_000);
	expect(audio).toMatchObject({
		startUs: 1_000_000,
		sourceInUs: 2_000_000,
		sourceOutUs: 12_000_000,
		gain: 0.4,
	});
	expect(() =>
		convertLegacyRecordProject(
			{ ...old, globalAudioTracks: [{ ...old.globalAudioTracks[0], loop: true }] },
			{ projectId: "new", prefix: "copy" },
		),
	).toThrow(/unsupported/i);
	expect(() =>
		convertLegacyRecordProject(
			{ ...old, globalAudioTracks: [{ ...old.globalAudioTracks[0], fadeInMs: 100 }] },
			{ projectId: "new", prefix: "copy" },
		),
	).toThrow(/unsupported/i);
});
it("retains kept V1 trim bounds and speed, rejects unknown effects rather than silently dropping them", () => {
	const old = {
		version: 1,
		projectId: "old",
		editor: { wallpaper: "#000000" },
		clips: [
			{
				id: "s",
				videoPath: "screen.mp4",
				durationMs: 10_000,
				trimStartMs: 2000,
				trimEndMs: 8000,
				speed: 2,
				sceneSettings: {
					padding: { top: 5, bottom: 5, left: 5, right: 5 },
					shadowIntensity: 0.4,
				},
				recordSettings: { cursorSize: 2 },
			},
		],
	};
	const p = convertLegacyRecordProject(old, { projectId: "new", prefix: "copy" });
	expect(p.compositions[0].durationUs).toBe(3_000_000);
	expect(p.compositions[0].settings.cursorSize).toBe(2);
	expect(p.compositions[0].settings.padding?.left).toBe(5);
	expect(() =>
		convertLegacyRecordProject(
			{ ...old, clips: [{ ...old.clips[0], extensions: { unknown: true } }] },
			{ projectId: "new", prefix: "copy" },
		),
	).toThrow(/unsupported/i);
	expect(() =>
		convertLegacyRecordProject(
			{ ...old, clips: [{ ...old.clips[0], recordSettings: { mysteryEffect: 1 } }] },
			{ projectId: "new", prefix: "copy" },
		),
	).toThrow(/unsupported/i);
});
