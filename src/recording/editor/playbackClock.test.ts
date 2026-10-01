import { expect, it } from "vitest";
import { playbackOutputTimeUs } from "./playbackClock";

it("holds playback at its start when a frame timestamp precedes the clock", () => {
	expect(playbackOutputTimeUs(0, -16.67, 4_000_000)).toBe(0);
});

it("advances in microseconds and ends at the composition boundary", () => {
	expect(playbackOutputTimeUs(1_000_000, 250, 4_000_000)).toBe(1_250_000);
	expect(playbackOutputTimeUs(3_900_000, 100, 4_000_000)).toBeNull();
});
