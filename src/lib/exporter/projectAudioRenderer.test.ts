import { expect, it, vi } from "vitest";
import { AudioProcessor } from "./audioEncoder";
import { projectSpeechIntervals } from "./projectAudioRenderer";

it("decodes WAV natively before asking a container demuxer", async () => {
	const processor = new AudioProcessor();
	const buffer = {} as AudioBuffer;
	const native = vi
		.spyOn(processor as never, "bulkDecodeFromUrl")
		.mockResolvedValue(buffer as never);
	const streamed = vi.spyOn(processor as never, "streamDecodeFromUrl");
	expect(await processor.decodeAudioFromUrl("http://localhost/mic.wav")).toBe(buffer);
	expect(native).toHaveBeenCalledOnce();
	expect(streamed).not.toHaveBeenCalled();
});
it("maps detected speech through stream offsets and speed", () => {
	const segment = {
		id: "mic",
		clipId: "c",
		kind: "microphone" as const,
		path: "mic.wav",
		startUs: 1_000_000,
		endUs: 3_000_000,
		sourceStartUs: 500_000,
		rate: 2,
		gain: 1,
		normalize: false,
	};
	expect(
		projectSpeechIntervals(segment, [
			{ startMs: 0, endMs: 1500 },
			{ startMs: 2000, endMs: 6000 },
		]),
	).toEqual([
		{ startMs: 1000, endMs: 1500 },
		{ startMs: 1750, endMs: 3000 },
	]);
});
