import { describe, expect, it, vi } from "vitest";
import { dbToLinear, detectSilenceFromChannel } from "./silenceDetector";

describe("silenceDetector", () => {
	it("converts dB to linear amplitude accurately", () => {
		expect(dbToLinear(0)).toBeCloseTo(1.0, 5);
		expect(dbToLinear(-20)).toBeCloseTo(0.1, 5);
		expect(dbToLinear(-40)).toBeCloseTo(0.01, 5);
		expect(dbToLinear(-60)).toBeCloseTo(0.001, 5);
	});

	it("detects silence between speech segments with speech padding", () => {
		const sampleRate = 1000; // 1000 samples per second -> 1 sample = 1ms
		const totalSamples = 4000; // 4 seconds
		const channel = new Float32Array(totalSamples);

		// 0s - 1s (0 - 1000 samples): Speech (amplitude 0.5)
		for (let i = 0; i < 1000; i++) {
			channel[i] = i % 2 === 0 ? 0.5 : -0.5;
		}

		// 1s - 3s (1000 - 3000 samples): Dead air (all zeros)
		// Duration is 2000ms

		// 3s - 4s (3000 - 4000 samples): Speech (amplitude 0.5)
		for (let i = 3000; i < 4000; i++) {
			channel[i] = i % 2 === 0 ? 0.5 : -0.5;
		}

		const result = detectSilenceFromChannel(channel, sampleRate, {
			minDurationMs: 1000,
			thresholdDb: -30,
			speechPaddingMs: 150,
			windowMs: 50,
		});

		expect(result.silences).toHaveLength(1);
		const silence = result.silences[0];
		// With 150ms padding on both sides of speech:
		// start should be 1000 + 150 = 1150ms
		// end should be 3000 - 150 = 2850ms
		// duration should be 1700ms
		expect(silence.startMs).toBe(1150);
		expect(silence.endMs).toBe(2850);
		expect(silence.durationMs).toBe(1700);
		expect(result.totalSavedMs).toBe(1700);
	});

	it("ignores short pauses below minDurationMs", () => {
		const sampleRate = 1000;
		const totalSamples = 2000;
		const channel = new Float32Array(totalSamples);

		// 0s - 0.8s speech
		for (let i = 0; i < 800; i++) channel[i] = 0.5;
		// 0.8s - 1.2s silence (400ms - too short)
		// 1.2s - 2.0s speech
		for (let i = 1200; i < 2000; i++) channel[i] = 0.5;

		const result = detectSilenceFromChannel(channel, sampleRate, {
			minDurationMs: 1000,
		});

		expect(result.silences).toHaveLength(0);
		expect(result.totalSavedMs).toBe(0);
	});

	it("handles completely silent audio", () => {
		const sampleRate = 1000;
		const channel = new Float32Array(3000); // 3s of silence

		const result = detectSilenceFromChannel(channel, sampleRate, {
			minDurationMs: 1000,
		});

		expect(result.silences.length).toBeGreaterThanOrEqual(1);
		expect(result.totalSavedMs).toBeGreaterThan(0);
	});

	it("detects silence from AudioBuffer decoded via AudioProcessor", async () => {
		const { detectSilenceFromAudioUrl } = await import("./silenceDetector");
		const { AudioProcessor } = await import("@/lib/exporter/audioEncoder");

		const sampleRate = 1000;
		const channel = new Float32Array(3000);
		// speech from 0 to 500, dead air from 500 to 2500, speech 2500 to 3000
		for (let i = 0; i < 500; i++) channel[i] = 0.5;
		for (let i = 2500; i < 3000; i++) channel[i] = 0.5;

		const mockAudioBuffer = {
			sampleRate,
			length: 3000,
			numberOfChannels: 1,
			getChannelData: () => channel,
		} as unknown as AudioBuffer;

		vi.spyOn(AudioProcessor.prototype, "decodeAudioFromUrl").mockResolvedValue(mockAudioBuffer);

		const result = await detectSilenceFromAudioUrl(
			"http://127.0.0.1:1234/video?path=test.mp4",
			{
				minDurationMs: 1000,
				speechPaddingMs: 100,
			},
		);

		expect(result.silences).toHaveLength(1);
		expect(result.silences[0].startMs).toBe(600);
		expect(result.silences[0].endMs).toBe(2400);
		expect(result.totalSavedMs).toBe(1800);
	});
});
