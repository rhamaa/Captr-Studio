import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createTimelineProject, placeAsset, registerMedia } from "@/core/timeline/commands";
import type { AssetTranscript } from "@/core/timeline/transcriptTypes";
import {
	DEFAULT_SUBTITLE_STYLE,
	SubtitleOverlay,
	getSubtitleForProjectAtTime,
} from "./SubtitleOverlay";

describe("SubtitleOverlay logic and time-mapping sync", () => {
	const sampleTranscript: AssetTranscript = {
		assetId: "asset-speech-1",
		language: "id",
		durationUs: 10_000_000,
		segments: [
			{
				id: 0,
				startUs: 1_000_000,
				endUs: 4_500_000,
				text: "Halo selamat datang di Captr",
				words: [
					{ word: "Halo", startUs: 1_000_000, endUs: 1_400_000 },
					{ word: "selamat", startUs: 1_500_000, endUs: 2_200_000 },
					{ word: "datang", startUs: 2_300_000, endUs: 3_000_000 },
					{ word: "di", startUs: 3_100_000, endUs: 3_400_000 },
					{ word: "Captr", startUs: 3_500_000, endUs: 4_500_000 },
				],
			},
		],
	};

	function createTestProject() {
		let proj = createTimelineProject("test-subtitles", "Test Subtitles");
		proj = registerMedia(proj, {
			id: "asset-speech-1",
			kind: "video",
			name: "speech.mp4",
			durationUs: 10_000_000,
			width: 1920,
			height: 1080,
			source: { path: "D:/mock/speech.mp4", durationUs: 10_000_000, offsetUs: 0 },
		});
		return proj;
	}

	it("finds active word and segment at timeline playhead", () => {
		let proj = createTestProject();
		proj = placeAsset(proj, "asset-speech-1", "visual-1", 0, { clipId: "clip-1" });

		const transcripts = { "asset-speech-1": sampleTranscript };

		// At 1.2s -> "Halo" is active
		const atHalo = getSubtitleForProjectAtTime(proj, 1_200_000, transcripts);
		expect(atHalo).not.toBeNull();
		expect(atHalo?.segment.text).toContain("Halo");
		expect(atHalo?.activeWord?.word).toBe("Halo");
		expect(atHalo?.words[0].active).toBe(true);
		expect(atHalo?.words[1].active).toBe(false);

		// At 2.5s -> "datang" is active, "Halo" and "selamat" are passed
		const atDatang = getSubtitleForProjectAtTime(proj, 2_500_000, transcripts);
		expect(atDatang?.activeWord?.word).toBe("datang");
		expect(atDatang?.words[0].passed).toBe(true);
		expect(atDatang?.words[1].passed).toBe(true);
		expect(atDatang?.words[2].active).toBe(true);

		// Outside clip / speech duration (e.g. 5.5s) -> returns null
		const outside = getSubtitleForProjectAtTime(proj, 5_500_000, transcripts);
		expect(outside).toBeNull();
	});

	it("automatically adapts when clip is trimmed non-destructively", () => {
		let proj = createTestProject();
		proj = placeAsset(proj, "asset-speech-1", "visual-1", 0, { clipId: "clip-1" });

		// Trim start by 2.0s (sourceInUs = 2_000_000)
		proj.tracks[0].clips[0].sourceInUs = 2_000_000;

		const transcripts = { "asset-speech-1": sampleTranscript };

		// Now at timeline 0s, media time is 2.0s.
		// "Halo" (1.0s-1.4s) is trimmed out!
		// At timeline 0.5s (media time 2.5s), "datang" is active!
		const res = getSubtitleForProjectAtTime(proj, 500_000, transcripts);
		expect(res).not.toBeNull();
		expect(res?.activeWord?.word).toBe("datang");
		expect(res?.words.map((w) => w.word)).not.toContain("Halo");
	});

	it("automatically scales timings when clip playback rate changes", () => {
		let proj = createTestProject();
		proj = placeAsset(proj, "asset-speech-1", "visual-1", 0, { clipId: "clip-1" });

		// 2x speed playback
		proj.tracks[0].clips[0].rate = 2;

		const transcripts = { "asset-speech-1": sampleTranscript };

		// Halo is original 1.0s - 1.4s, at 2x rate it happens at 0.5s - 0.7s in timeline!
		const atHalo = getSubtitleForProjectAtTime(proj, 600_000, transcripts);
		expect(atHalo?.activeWord?.word).toBe("Halo");

		// datang is original 2.3s - 3.0s, at 2x rate it happens at 1.15s - 1.5s in timeline!
		const atDatang = getSubtitleForProjectAtTime(proj, 1_250_000, transcripts);
		expect(atDatang?.activeWord?.word).toBe("datang");
	});

	it("renders SubtitleOverlay markup with karaoke word spans", () => {
		let proj = createTestProject();
		proj = placeAsset(proj, "asset-speech-1", "visual-1", 0, { clipId: "clip-1" });

		const html = renderToStaticMarkup(
			createElement(SubtitleOverlay, {
				project: proj,
				timeUs: 1_200_000,
				initialTranscripts: { "asset-speech-1": sampleTranscript },
				styleOverrides: {
					...DEFAULT_SUBTITLE_STYLE,
					enabled: true,
					position: "bottom",
				},
			}),
		);

		expect(html).toContain("subtitle-overlay-root");
		expect(html).toContain("subtitle-pos-bottom");
		expect(html).toContain("subtitle-toggle-pill");
	});
});
