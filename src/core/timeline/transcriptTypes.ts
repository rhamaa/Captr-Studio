/**
 * Types and utilities for asset speech-to-text transcripts, word-level timestamps,
 * and timeline subtitle mapping.
 */

export interface TranscriptWord {
	word: string;
	startUs: number;
	endUs: number;
	probability?: number;
}

export interface TranscriptSegment {
	id: number;
	text: string;
	startUs: number;
	endUs: number;
	words: TranscriptWord[];
}

export interface AssetTranscript {
	assetId: string;
	language: string;
	durationUs: number;
	segments: TranscriptSegment[];
	createdAt?: string;
}

/**
 * Formats microseconds to WebVTT timestamp format (HH:MM:SS.mmm).
 */
export function formatVttTimestamp(us: number): string {
	const totalMs = Math.max(0, Math.floor(us / 1000));
	const ms = totalMs % 1000;
	const totalSecs = Math.floor(totalMs / 1000);
	const s = totalSecs % 60;
	const totalMins = Math.floor(totalSecs / 60);
	const m = totalMins % 60;
	const h = Math.floor(totalMins / 60);

	const hh = String(h).padStart(2, "0");
	const mm = String(m).padStart(2, "0");
	const ss = String(s).padStart(2, "0");
	const mmm = String(ms).padStart(3, "0");

	return `${hh}:${mm}:${ss}.${mmm}`;
}

/**
 * Converts an AssetTranscript into a standard WebVTT subtitle string.
 */
export function generateVttFromTranscript(transcript: AssetTranscript): string {
	const lines = ["WEBVTT", ""];

	for (let i = 0; i < transcript.segments.length; i++) {
		const seg = transcript.segments[i];
		lines.push(String(i + 1));
		lines.push(`${formatVttTimestamp(seg.startUs)} --> ${formatVttTimestamp(seg.endUs)}`);
		lines.push(seg.text.trim());
		lines.push("");
	}

	return lines.join("\n");
}

export interface TimelineClipTimeRange {
	startUs: number;
	sourceInUs: number;
	sourceOutUs: number;
	rate: number;
}

/**
 * Projects an asset transcript onto a specific timeline clip.
 * Filters out words and segments outside the clip's [sourceInUs, sourceOutUs] boundary,
 * and maps all timestamps to the timeline's playback time using the clip's rate.
 */
export function mapTranscriptToClip(
	transcript: AssetTranscript,
	clip: TimelineClipTimeRange,
): TranscriptSegment[] {
	const rate = clip.rate > 0 ? clip.rate : 1;
	const mappedSegments: TranscriptSegment[] = [];

	for (const seg of transcript.segments) {
		// Check segment overlap with clip boundary
		if (seg.endUs <= clip.sourceInUs || seg.startUs >= clip.sourceOutUs) {
			continue;
		}

		// Filter words within clip boundaries
		const activeWords: TranscriptWord[] = [];
		for (const w of seg.words) {
			if (w.endUs > clip.sourceInUs && w.startUs < clip.sourceOutUs) {
				const clampedStart = Math.max(clip.sourceInUs, w.startUs);
				const clampedEnd = Math.min(clip.sourceOutUs, w.endUs);

				const timelineWordStartUs =
					clip.startUs + Math.round((clampedStart - clip.sourceInUs) / rate);
				const timelineWordEndUs =
					clip.startUs + Math.round((clampedEnd - clip.sourceInUs) / rate);

				activeWords.push({
					word: w.word,
					startUs: timelineWordStartUs,
					endUs: timelineWordEndUs,
					probability: w.probability,
				});
			}
		}

		if (activeWords.length > 0) {
			const segStart = activeWords[0].startUs;
			const segEnd = activeWords[activeWords.length - 1].endUs;
			const segText = activeWords.map((w) => w.word.trim()).join(" ");

			mappedSegments.push({
				id: seg.id,
				text: segText,
				startUs: segStart,
				endUs: segEnd,
				words: activeWords,
			});
		}
	}

	return mappedSegments;
}

/**
 * Finds the currently active subtitle text at a given timeline position (in microseconds).
 */
export function getActiveSubtitleAtTime(
	segments: TranscriptSegment[],
	currentTimelineUs: number,
): { segment: TranscriptSegment | null; activeWord: TranscriptWord | null } {
	for (const seg of segments) {
		if (currentTimelineUs >= seg.startUs && currentTimelineUs <= seg.endUs) {
			const activeWord =
				seg.words.find(
					(w) => currentTimelineUs >= w.startUs && currentTimelineUs <= w.endUs,
				) ?? null;
			return { segment: seg, activeWord };
		}
	}
	return { segment: null, activeWord: null };
}
