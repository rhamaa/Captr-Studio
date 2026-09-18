import { expect, it } from "vitest";
import { buildLayerAudioSchedule } from "./layerAudioSchedule";

it("preserves layer source position through a removed section and speed change", () => {
	const result = buildLayerAudioSchedule(
		{
			id: "a",
			startMs: 1000,
			endMs: 6000,
			audioPath: "b.mp4",
			volume: 1,
			sourceOffsetMs: 500,
			playbackRate: 2,
		},
		[
			{ sourceStartMs: 0, sourceEndMs: 2000, speed: 1 },
			{ sourceStartMs: 4000, sourceEndMs: 6000, speed: 2 },
		],
		0,
		10,
		30,
	);
	expect(result).toEqual([
		{ start: 1, offset: 0.5, duration: 2, rate: 2 },
		{ start: 2, offset: 6.5, duration: 4, rate: 4 },
	]);
});

it("clips at output chunk boundaries without restarting source audio", () => {
	expect(
		buildLayerAudioSchedule(
			{ id: "a", startMs: 0, endMs: 10000, audioPath: "b.mp4", volume: 1, playbackRate: 2 },
			[{ sourceStartMs: 0, sourceEndMs: 10000, speed: 1 }],
			3,
			2,
			20,
		),
	).toEqual([{ start: 0, offset: 6, duration: 4, rate: 2 }]);
});
