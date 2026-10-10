import { describe, expect, it } from "vitest";
import { parseCloudWhisperJson, parseWhisperCliJson } from "./whisperParser";

describe("whisperParser", () => {
	it("parses whisper-cli raw json output correctly", () => {
		const rawWhisperCli = {
			result: { language: "id" },
			transcription: [
				{
					offsets: { from: 1200, to: 3500 },
					text: "Halo semua",
					tokens: [
						{ text: "Halo", offsets: { from: 1200, to: 2000 }, p: 0.95 },
						{ text: "semua", offsets: { from: 2100, to: 3500 }, p: 0.98 },
					],
				},
			],
		};

		const transcript = parseWhisperCliJson(rawWhisperCli, "asset-123");
		expect(transcript.assetId).toBe("asset-123");
		expect(transcript.language).toBe("id");
		expect(transcript.durationUs).toBe(3_500_000);
		expect(transcript.segments).toHaveLength(1);

		const seg = transcript.segments[0];
		expect(seg.startUs).toBe(1_200_000);
		expect(seg.endUs).toBe(3_500_000);
		expect(seg.text).toBe("Halo semua");
		expect(seg.words).toHaveLength(2);
		expect(seg.words[0].word).toBe("Halo");
		expect(seg.words[0].startUs).toBe(1_200_000);
		expect(seg.words[0].endUs).toBe(2_000_000);
	});

	it("parses Cloud Whisper / Groq verbose_json output correctly", () => {
		const rawCloudJson = {
			language: "indonesian",
			duration: 5.5,
			segments: [
				{
					id: 0,
					start: 0.5,
					end: 2.5,
					text: "Selamat datang",
					words: [
						{ word: "Selamat", start: 0.5, end: 1.2 },
						{ word: "datang", start: 1.3, end: 2.5 },
					],
				},
				{
					id: 1,
					start: 3.0,
					end: 5.0,
					text: "di studio",
					words: [
						{ word: "di", start: 3.0, end: 3.4 },
						{ word: "studio", start: 3.5, end: 5.0 },
					],
				},
			],
		};

		const transcript = parseCloudWhisperJson(rawCloudJson, "asset-456");
		expect(transcript.assetId).toBe("asset-456");
		expect(transcript.durationUs).toBe(5_500_000);
		expect(transcript.segments).toHaveLength(2);

		expect(transcript.segments[0].startUs).toBe(500_000);
		expect(transcript.segments[0].endUs).toBe(2_500_000);
		expect(transcript.segments[0].words).toHaveLength(2);
		expect(transcript.segments[0].words[0].word).toBe("Selamat");
		expect(transcript.segments[0].words[0].startUs).toBe(500_000);
		expect(transcript.segments[0].words[0].endUs).toBe(1_200_000);
	});
});
