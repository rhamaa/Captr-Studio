import type {
	AssetTranscript,
	TranscriptSegment,
	TranscriptWord,
} from "../../../src/core/timeline/transcriptTypes";

/**
 * Parses raw JSON output from whisper-cli into a canonical AssetTranscript.
 */
export function parseWhisperCliJson(
	rawJson: Record<string, unknown>,
	assetId: string,
): AssetTranscript {
	const resultLang =
		(rawJson.result as Record<string, unknown> | undefined)?.language ||
		(rawJson.params as Record<string, unknown> | undefined)?.language ||
		"auto";

	const transcription = Array.isArray(rawJson.transcription) ? rawJson.transcription : [];
	const segments: TranscriptSegment[] = [];

	let segmentId = 0;
	let maxEndUs = 0;

	for (const item of transcription) {
		if (typeof item !== "object" || !item) continue;
		const offsets = (item as Record<string, unknown>).offsets as
			| Record<string, unknown>
			| undefined;
		const text = typeof (item as any).text === "string" ? (item as any).text.trim() : "";

		// offsets.from and offsets.to are in milliseconds in whisper.cpp
		const startMs = typeof offsets?.from === "number" ? offsets.from : 0;
		const endMs = typeof offsets?.to === "number" ? offsets.to : startMs;

		const startUs = Math.round(startMs * 1000);
		const endUs = Math.round(endMs * 1000);
		if (endUs > maxEndUs) maxEndUs = endUs;

		const rawTokens = Array.isArray((item as any).tokens) ? (item as any).tokens : [];
		const words: TranscriptWord[] = [];

		for (const tok of rawTokens) {
			if (typeof tok !== "object" || !tok) continue;
			const tokOffsets = (tok as any).offsets as Record<string, unknown> | undefined;
			const tokText = typeof (tok as any).text === "string" ? (tok as any).text.trim() : "";
			if (!tokText) continue;

			const tokStartMs = typeof tokOffsets?.from === "number" ? tokOffsets.from : startMs;
			const tokEndMs = typeof tokOffsets?.to === "number" ? tokOffsets.to : endMs;

			words.push({
				word: tokText,
				startUs: Math.round(tokStartMs * 1000),
				endUs: Math.round(tokEndMs * 1000),
				probability: typeof (tok as any).p === "number" ? (tok as any).p : undefined,
			});
		}

		// Fallback: if no token-level offsets, split text evenly across segment duration
		if (words.length === 0 && text.length > 0) {
			const splitWords = text.split(/\s+/).filter(Boolean);
			const durationPerWord = splitWords.length > 0 ? (endUs - startUs) / splitWords.length : 0;
			splitWords.forEach((w: string, idx: number) => {
				words.push({
					word: w,
					startUs: startUs + Math.round(idx * durationPerWord),
					endUs: startUs + Math.round((idx + 1) * durationPerWord),
				});
			});
		}

		segments.push({
			id: segmentId++,
			text,
			startUs,
			endUs,
			words,
		});
	}

	return {
		assetId,
		language: String(resultLang),
		durationUs: maxEndUs,
		segments,
		createdAt: new Date().toISOString(),
	};
}

/**
 * Parses raw JSON output from OpenAI / Groq verbose_json format into AssetTranscript.
 */
export function parseCloudWhisperJson(
	rawJson: Record<string, unknown>,
	assetId: string,
): AssetTranscript {
	const language = typeof rawJson.language === "string" ? rawJson.language : "auto";
	const durationSec = typeof rawJson.duration === "number" ? rawJson.duration : 0;
	const durationUs = Math.round(durationSec * 1_000_000);

	const rawSegments = Array.isArray(rawJson.segments) ? rawJson.segments : [];
	const rawWords = Array.isArray(rawJson.words) ? rawJson.words : [];

	const segments: TranscriptSegment[] = [];

	if (rawSegments.length > 0) {
		for (const seg of rawSegments) {
			if (typeof seg !== "object" || !seg) continue;
			const segStartUs = Math.round((Number((seg as any).start) || 0) * 1_000_000);
			const segEndUs = Math.round((Number((seg as any).end) || 0) * 1_000_000);
			const segText = typeof (seg as any).text === "string" ? (seg as any).text.trim() : "";

			// Match words that belong to this segment
			const segWords: TranscriptWord[] = [];
			const innerWords = Array.isArray((seg as any).words) ? (seg as any).words : rawWords;

			for (const w of innerWords) {
				const wStartUs = Math.round((Number(w.start) || 0) * 1_000_000);
				const wEndUs = Math.round((Number(w.end) || 0) * 1_000_000);
				if (wStartUs >= segStartUs && wEndUs <= segEndUs + 200_000) {
					segWords.push({
						word: String(w.word || "").trim(),
						startUs: wStartUs,
						endUs: wEndUs,
					});
				}
			}

			// Fallback if words not populated
			if (segWords.length === 0 && segText.length > 0) {
				const splitWords = segText.split(/\s+/).filter(Boolean);
				const durPerWord =
					splitWords.length > 0 ? (segEndUs - segStartUs) / splitWords.length : 0;
				splitWords.forEach((w: string, idx: number) => {
					segWords.push({
						word: w,
						startUs: segStartUs + Math.round(idx * durPerWord),
						endUs: segStartUs + Math.round((idx + 1) * durPerWord),
					});
				});
			}

			segments.push({
				id: typeof (seg as any).id === "number" ? (seg as any).id : segments.length,
				text: segText,
				startUs: segStartUs,
				endUs: segEndUs,
				words: segWords,
			});
		}
	} else if (rawWords.length > 0) {
		// Only words provided
		const allWords: TranscriptWord[] = rawWords.map((w: any) => ({
			word: String(w.word || "").trim(),
			startUs: Math.round((Number(w.start) || 0) * 1_000_000),
			endUs: Math.round((Number(w.end) || 0) * 1_000_000),
		}));

		const fullText = typeof rawJson.text === "string" ? rawJson.text : "";
		segments.push({
			id: 0,
			text: fullText,
			startUs: allWords[0]?.startUs ?? 0,
			endUs: allWords[allWords.length - 1]?.endUs ?? durationUs,
			words: allWords,
		});
	}

	return {
		assetId,
		language,
		durationUs: Math.max(durationUs, segments.at(-1)?.endUs ?? 0),
		segments,
		createdAt: new Date().toISOString(),
	};
}
