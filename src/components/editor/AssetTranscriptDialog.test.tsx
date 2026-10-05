import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AssetTranscript } from "@/core/timeline/transcriptTypes";
import type { MediaAsset } from "@/core/timeline/types";
import { AssetTranscriptDialog } from "./AssetTranscriptDialog";

describe("AssetTranscriptDialog", () => {
	const asset: MediaAsset = {
		id: "asset-1",
		kind: "video",
		name: "Intro Speech.mp4",
		durationUs: 10_000_000,
		width: 1920,
		height: 1080,
	};

	const sampleTranscript: AssetTranscript = {
		assetId: "asset-1",
		language: "id",
		durationUs: 10_000_000,
		segments: [
			{
				id: 0,
				startUs: 1_000_000,
				endUs: 4_500_000,
				text: "Selamat datang di Captr Studio",
				words: [
					{ word: "Selamat", startUs: 1_000_000, endUs: 1_600_000 },
					{ word: "datang", startUs: 1_650_000, endUs: 2_200_000 },
					{ word: "di", startUs: 2_250_000, endUs: 2_500_000 },
					{ word: "Captr", startUs: 2_550_000, endUs: 3_200_000 },
					{ word: "Studio", startUs: 3_250_000, endUs: 4_500_000 },
				],
			},
		],
	};

	it("renders transcript segments, language badge, and word tokens", () => {
		const html = renderToStaticMarkup(
			createElement(AssetTranscriptDialog, {
				asset,
				transcript: sampleTranscript,
				isTranscribing: false,
				error: null,
				open: true,
				onOpenChange: vi.fn(),
				onTranscribe: vi.fn(),
			}),
		);

		expect(html).toContain("Selamat datang di Captr Studio");
		expect(html).toContain("ID");
		expect(html).toContain("1 segments");
		expect(html).toContain("5 words");
		expect(html).toContain("Selamat");
		expect(html).toContain("Studio");
	});

	it("renders transcribing state when loading", () => {
		const html = renderToStaticMarkup(
			createElement(AssetTranscriptDialog, {
				asset,
				transcript: null,
				isTranscribing: true,
				error: null,
				open: true,
				onOpenChange: vi.fn(),
				onTranscribe: vi.fn(),
			}),
		);

		expect(html).toContain("Transcribing speech with Whisper");
	});

	it("renders generate options view when no transcript exists yet", () => {
		const html = renderToStaticMarkup(
			createElement(AssetTranscriptDialog, {
				asset,
				transcript: null,
				isTranscribing: false,
				error: null,
				open: true,
				onOpenChange: vi.fn(),
				onTranscribe: vi.fn(),
			}),
		);

		expect(html).toContain("Generate Captions");
		expect(html).toContain("Local Whisper");
		expect(html).toContain("Spoken Language");
	});
});
