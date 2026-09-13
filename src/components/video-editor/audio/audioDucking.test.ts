import { describe, expect, it, vi } from "vitest";
import type { AudioDuckingSettings, CaptionCue } from "../types";
import {
	applyDuckingAutomationToGainNode,
	computeDuckingGain,
	dbToLinear,
	getSpeechIntervalsFromChannelData,
	getSpeechIntervalsFromCues,
	linearToDb,
	mergeSpeechIntervals,
} from "./audioDucking";

describe("audioDucking - dbToLinear and linearToDb", () => {
	it("converts 0 dB to 1.0", () => {
		expect(dbToLinear(0)).toBeCloseTo(1.0, 3);
	});

	it("converts -6 dB to ~0.501", () => {
		expect(dbToLinear(-6)).toBeCloseTo(0.501, 2);
	});

	it("converts -14 dB to ~0.1995", () => {
		expect(dbToLinear(-14)).toBeCloseTo(0.1995, 2);
	});

	it("converts -20 dB to 0.1", () => {
		expect(dbToLinear(-20)).toBeCloseTo(0.1, 3);
	});

	it("converts linear back to dB", () => {
		expect(linearToDb(1.0)).toBeCloseTo(0, 2);
		expect(linearToDb(0.1)).toBeCloseTo(-20, 2);
	});
});

describe("audioDucking - mergeSpeechIntervals", () => {
	it("merges intervals separated by less than maxGapMs", () => {
		const intervals = [
			{ startMs: 1000, endMs: 2000 },
			{ startMs: 2200, endMs: 3500 }, // gap 200ms <= 400ms -> merge
			{ startMs: 4500, endMs: 5000 }, // gap 1000ms > 400ms -> separate
		];

		const merged = mergeSpeechIntervals(intervals, 400);
		expect(merged).toEqual([
			{ startMs: 1000, endMs: 3500 },
			{ startMs: 4500, endMs: 5000 },
		]);
	});

	it("handles empty and single interval arrays", () => {
		expect(mergeSpeechIntervals([])).toEqual([]);
		expect(mergeSpeechIntervals([{ startMs: 100, endMs: 500 }])).toEqual([
			{ startMs: 100, endMs: 500 },
		]);
	});
});

describe("audioDucking - getSpeechIntervalsFromCues", () => {
	it("extracts and merges intervals from caption cues", () => {
		const cues: CaptionCue[] = [
			{ id: "1", startMs: 500, endMs: 1500, text: "Halo semuanya" },
			{ id: "2", startMs: 1800, endMs: 2800, text: "kembali lagi" }, // gap 300ms
			{ id: "3", startMs: 5000, endMs: 6500, text: "di channel ini" },
		];

		const intervals = getSpeechIntervalsFromCues(cues, 500);
		expect(intervals).toEqual([
			{ startMs: 500, endMs: 2800 },
			{ startMs: 5000, endMs: 6500 },
		]);
	});
});

describe("audioDucking - getSpeechIntervalsFromChannelData", () => {
	it("detects loud speech sections above threshold from raw audio", () => {
		const sampleRate = 1000; // 1000 samples/sec = 1ms per sample
		const channelData = new Float32Array(4000); // 4000ms audio

		// Fill 1000ms - 2500ms with sine wave of amplitude 0.5 (~ -6dB > -36dB)
		for (let i = 1000; i < 2500; i++) {
			channelData[i] = 0.5 * Math.sin((i / 10) * Math.PI);
		}

		const intervals = getSpeechIntervalsFromChannelData(channelData, sampleRate, {
			thresholdDb: -30,
			windowMs: 50,
			minDurationMs: 100,
		});

		expect(intervals.length).toBe(1);
		expect(intervals[0].startMs).toBeGreaterThanOrEqual(950);
		expect(intervals[0].startMs).toBeLessThanOrEqual(1050);
		expect(intervals[0].endMs).toBeGreaterThanOrEqual(2450);
		expect(intervals[0].endMs).toBeLessThanOrEqual(2550);
	});
});

describe("audioDucking - computeDuckingGain", () => {
	const settings: AudioDuckingSettings = {
		enabled: true,
		duckingAmountDb: -14, // ~0.1995
		attackMs: 200,
		releaseMs: 600,
		holdMs: 300,
	};

	const intervals = [{ startMs: 2000, endMs: 5000 }];

	it("returns 1.0 when ducking is disabled", () => {
		const disabledSettings = { ...settings, enabled: false };
		expect(computeDuckingGain(3000, intervals, disabledSettings)).toBe(1.0);
	});

	it("returns 1.0 far outside speech intervals", () => {
		// Before attack start (2000 - 200 = 1800ms)
		expect(computeDuckingGain(1000, intervals, settings)).toBe(1.0);
		// After release end (5000 + 300 + 600 = 5900ms)
		expect(computeDuckingGain(7000, intervals, settings)).toBe(1.0);
	});

	it("returns duckFactor during speech", () => {
		const gain = computeDuckingGain(3500, intervals, settings);
		expect(gain).toBeCloseTo(dbToLinear(-14), 3);
	});

	it("holds duckFactor during hold interval", () => {
		// Speech ends at 5000ms, hold lasts until 5300ms
		const gain = computeDuckingGain(5200, intervals, settings);
		expect(gain).toBeCloseTo(dbToLinear(-14), 3);
	});

	it("smoothly attenuates during attack phase", () => {
		// Attack is from 1800ms to 2000ms
		const gainStart = computeDuckingGain(1800, intervals, settings);
		const gainMid = computeDuckingGain(1900, intervals, settings);
		const gainEnd = computeDuckingGain(2000, intervals, settings);

		expect(gainStart).toBeCloseTo(1.0, 2);
		expect(gainMid).toBeLessThan(1.0);
		expect(gainMid).toBeGreaterThan(dbToLinear(-14));
		expect(gainEnd).toBeCloseTo(dbToLinear(-14), 2);
	});

	it("smoothly releases back to normal during release phase", () => {
		// Release is from 5300ms to 5900ms
		const gainStart = computeDuckingGain(5300, intervals, settings);
		const gainMid = computeDuckingGain(5600, intervals, settings);
		const gainEnd = computeDuckingGain(5900, intervals, settings);

		expect(gainStart).toBeCloseTo(dbToLinear(-14), 2);
		expect(gainMid).toBeGreaterThan(dbToLinear(-14));
		expect(gainMid).toBeLessThan(1.0);
		expect(gainEnd).toBeCloseTo(1.0, 2);
	});
});

describe("audioDucking - applyDuckingAutomationToGainNode", () => {
	it("schedules Web Audio automation points across intervals", () => {
		const mockGain = {
			setValueAtTime: vi.fn(),
			linearRampToValueAtTime: vi.fn(),
		};
		const mockGainNode = {
			gain: mockGain,
		} as unknown as GainNode;

		const settings: AudioDuckingSettings = {
			enabled: true,
			duckingAmountDb: -14,
			attackMs: 200,
			releaseMs: 600,
			holdMs: 300,
		};

		const intervals = [{ startMs: 2000, endMs: 4000 }];

		// Chunk covers 0s to 5s
		applyDuckingAutomationToGainNode(mockGainNode, intervals, settings, 0, 5, 1.0);

		// Must set initial gain
		expect(mockGain.setValueAtTime).toHaveBeenCalled();
		// Must ramp to ducked gain at speech start (2s)
		expect(mockGain.linearRampToValueAtTime).toHaveBeenCalledWith(
			expect.closeTo(dbToLinear(-14), 2),
			expect.closeTo(2.0, 2),
		);
		// Must ramp back to base gain at release end (4 + 0.3 + 0.6 = 4.9s)
		expect(mockGain.linearRampToValueAtTime).toHaveBeenCalledWith(
			expect.closeTo(1.0, 2),
			expect.closeTo(4.9, 2),
		);
	});
});
