import { describe, expect, it } from "vitest";
import {
	type AssetTranscript,
	formatVttTimestamp,
	generateVttFromTranscript,
	getActiveSubtitleAtTime,
	mapTranscriptToClip,
} from "./transcriptTypes";

describe("transcriptTypes", () => {
	const sampleTranscript: AssetTranscript = {
		assetId: "asset-1",
		language: "id",
		durationUs: 10_000_000,
		segments: [
			{
				id: 0,
				text: "Halo semua selamat datang",
				startUs: 1_000_000,
				endUs: 4_000_000,
				words: [
					{ word: "Halo", startUs: 1_000_000, endUs: 1_500_000 },
					{ word: "semua", startUs: 1_600_000, endUs: 2_200_000 },
					{ word: "selamat", startUs: 2_300_000, endUs: 3_000_000 },
					{ word: "datang", startUs: 3_100_000, endUs: 4_000_000 },
				],
			},
			{
				id: 1,
				text: "di Captr Studio",
				startUs: 5_000_000,
				endUs: 8_000_000,
				words: [
					{ word: "di", startUs: 5_000_000, endUs: 5_500_000 },
					{ word: "Captr", startUs: 5_600_000, endUs: 6_800_000 },
					{ word: "Studio", startUs: 7_000_000, endUs: 8_000_000 },
				],
			},
		],
	};

	it("formats timestamps into WebVTT specification format", () => {
		expect(formatVttTimestamp(0)).toBe("00:00:00.000");
		expect(formatVttTimestamp(1_500_000)).toBe("00:00:01.500");
		expect(formatVttTimestamp(65_230_000)).toBe("00:01:05.230");
		expect(formatVttTimestamp(3665_000_000)).toBe("01:01:05.000");
	});

	it("generates valid WebVTT subtitle document from transcript", () => {
		const vtt = generateVttFromTranscript(sampleTranscript);
		expect(vtt).toContain("WEBVTT");
		expect(vtt).toContain("00:00:01.000 --> 00:00:04.000");
		expect(vtt).toContain("Halo semua selamat datang");
		expect(vtt).toContain("00:00:05.000 --> 00:00:08.000");
		expect(vtt).toContain("di Captr Studio");
	});

	it("projects transcript onto timeline clip with trimming", () => {
		// Clip starts at 10s on timeline, but only takes source between 2s and 6s
		const clip = {
			startUs: 10_000_000,
			sourceInUs: 2_000_000,
			sourceOutUs: 6_000_000,
			rate: 1,
		};

		const mapped = mapTranscriptToClip(sampleTranscript, clip);
		expect(mapped).toHaveLength(2);

		// First segment: "Halo" was before 2s, so only words from 2s onwards remain
		const seg1 = mapped[0];
		expect(seg1.words.map((w) => w.word)).toEqual(["semua", "selamat", "datang"]);
		// "semua" was at source 2.0s clamped -> timeline 10s + (2s - 2s) = 10s
		expect(seg1.words[0].startUs).toBe(10_000_000);

		// Second segment: "di" and "Captr" are before 6s, "Studio" is at 7s (excluded!)
		const seg2 = mapped[1];
		expect(seg2.words.map((w) => w.word)).toEqual(["di", "Captr"]);
	});

	it("adjusts mapped timestamps when clip has speed rate multiplier", () => {
		// Clip at 2x speed: duration is halved
		const clip = {
			startUs: 0,
			sourceInUs: 1_000_000,
			sourceOutUs: 3_000_000,
			rate: 2,
		};

		const mapped = mapTranscriptToClip(sampleTranscript, clip);
		expect(mapped).toHaveLength(1);
		const words = mapped[0].words;
		// source delta (3s - 1s) = 2s, but at 2x rate timeline duration is 1s
		expect(words[0].startUs).toBe(0); // 0 + (1s - 1s)/2 = 0s
		expect(words[words.length - 1].endUs).toBe(1_000_000); // 0 + (3s - 1s)/2 = 1.0s
	});

	it("finds currently active subtitle segment and word at given timeline position", () => {
		const clip = {
			startUs: 0,
			sourceInUs: 0,
			sourceOutUs: 10_000_000,
			rate: 1,
		};
		const mapped = mapTranscriptToClip(sampleTranscript, clip);

		// At 1.2s -> "Halo" is active
		const at12 = getActiveSubtitleAtTime(mapped, 1_200_000);
		expect(at12.segment).toBeDefined();
		expect(at12.activeWord?.word).toBe("Halo");

		// At 4.5s -> between segments (silence)
		const at45 = getActiveSubtitleAtTime(mapped, 4_500_000);
		expect(at45.segment).toBeNull();
		expect(at45.activeWord).toBeNull();
	});
});
