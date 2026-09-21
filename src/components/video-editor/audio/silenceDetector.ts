/**
 * Silence & Dead-Air Detector for Captr Studio.
 * Detects silent intervals in audio recordings so users can cut out dead air in 1 click.
 */

import type {
	AnnotationRegion,
	AudioRegion,
	ClipRegion,
	LayoutRegion,
	ZoomRegion,
} from "../types";
import { AudioProcessor } from "@/lib/exporter/audioEncoder";

export interface SilenceRegion {
	id: string;
	startMs: number;
	endMs: number;
	durationMs: number;
}

export interface SilenceDetectionOptions {
	/** Minimum silence duration to qualify as dead air in ms (default: 1200ms) */
	minDurationMs?: number;
	/** Decibel threshold below which audio is considered silence (default: -36 dB) */
	thresholdDb?: number;
	/** Safety buffer left around speech in ms (default: 150ms) */
	speechPaddingMs?: number;
	/** Window size for RMS calculation in ms (default: 50ms) */
	windowMs?: number;
}

export interface SilenceDetectionResult {
	silences: SilenceRegion[];
	totalSavedMs: number;
}

/**
 * Converts dBFS to linear amplitude (0.0 to 1.0)
 * e.g., -36dB -> 10^(-36/20) ≈ 0.0158
 */
export function dbToLinear(db: number): number {
	return Math.pow(10, db / 20);
}

/**
 * Detects silent pauses in raw audio channel data.
 */
export function detectSilenceFromChannel(
	channelData: Float32Array,
	sampleRate: number,
	options: SilenceDetectionOptions = {},
): SilenceDetectionResult {
	const minDurationMs = options.minDurationMs ?? 1200;
	const thresholdDb = options.thresholdDb ?? -36;
	const speechPaddingMs = options.speechPaddingMs ?? 150;
	const windowMs = options.windowMs ?? 50;

	const thresholdLinear = dbToLinear(thresholdDb);
	const windowSamples = Math.max(1, Math.round((windowMs / 1000) * sampleRate));
	const totalSamples = channelData.length;
	const totalDurationMs = Math.round((totalSamples / sampleRate) * 1000);

	const isSilentWindow: boolean[] = [];
	const numWindows = Math.ceil(totalSamples / windowSamples);

	for (let w = 0; w < numWindows; w++) {
		const startSample = w * windowSamples;
		const endSample = Math.min(totalSamples, startSample + windowSamples);
		let sumSq = 0;
		const count = endSample - startSample;

		if (count <= 0) {
			isSilentWindow.push(true);
			continue;
		}

		for (let i = startSample; i < endSample; i++) {
			const val = channelData[i];
			sumSq += val * val;
		}

		const rms = Math.sqrt(sumSq / count);
		isSilentWindow.push(rms < thresholdLinear);
	}

	// Group contiguous silent windows into intervals
	const rawSilences: Array<{ startMs: number; endMs: number }> = [];
	let currentSilenceStartMs: number | null = null;

	for (let w = 0; w < numWindows; w++) {
		const winTimeMs = (w * windowSamples * 1000) / sampleRate;

		if (isSilentWindow[w]) {
			if (currentSilenceStartMs === null) {
				currentSilenceStartMs = winTimeMs;
			}
		} else {
			if (currentSilenceStartMs !== null) {
				const silenceEndMs = winTimeMs;
				if (silenceEndMs - currentSilenceStartMs >= minDurationMs) {
					rawSilences.push({
						startMs: currentSilenceStartMs,
						endMs: silenceEndMs,
					});
				}
				currentSilenceStartMs = null;
			}
		}
	}

	// Check final trailing window
	if (currentSilenceStartMs !== null) {
		const silenceEndMs = totalDurationMs;
		if (silenceEndMs - currentSilenceStartMs >= minDurationMs) {
			rawSilences.push({
				startMs: currentSilenceStartMs,
				endMs: silenceEndMs,
			});
		}
	}

	// Apply speechPaddingMs to preserve speech natural attack/decay
	const silences: SilenceRegion[] = [];
	let totalSavedMs = 0;

	for (let i = 0; i < rawSilences.length; i++) {
		const raw = rawSilences[i];
		// If it's not the very beginning of the audio, add padding to start
		const paddedStart = raw.startMs > speechPaddingMs ? raw.startMs + speechPaddingMs : raw.startMs;
		// If it's not the very end of the audio, subtract padding from end
		const paddedEnd = raw.endMs < totalDurationMs - speechPaddingMs ? raw.endMs - speechPaddingMs : raw.endMs;

		const durationMs = Math.round(paddedEnd - paddedStart);
		// Ensure it still meets minimum threshold after padding
		if (durationMs >= Math.max(300, minDurationMs - speechPaddingMs * 2)) {
			silences.push({
				id: `silence-${i + 1}-${Math.round(paddedStart)}`,
				startMs: Math.round(paddedStart),
				endMs: Math.round(paddedEnd),
				durationMs,
			});
			totalSavedMs += durationMs;
		}
	}

	return {
		silences,
		totalSavedMs,
	};
}

export class NoAudioTrackError extends Error {
	constructor(message = "No audio track found in media resource") {
		super(message);
		this.name = "NoAudioTrackError";
	}
}

/**
 * Fetches and decodes an audio file at url, then detects silent intervals across all channels.
 */
export async function detectSilenceFromAudioUrl(
	url: string,
	options: SilenceDetectionOptions = {},
): Promise<SilenceDetectionResult> {
	// First attempt to decode using AudioProcessor (streaming WebDemuxer + WebCodecs)
	// which is proven in Captr Studio for MP4/M4A/WAV containers without needing full-file fetch.
	let demuxAttempted = false;
	try {
		const processor = new AudioProcessor();
		const audioBuffer = await processor.decodeAudioFromUrl(url);
		demuxAttempted = true;
		if (audioBuffer && audioBuffer.length > 0) {
			const channel = audioBuffer.getChannelData(0);
			return detectSilenceFromChannel(channel, audioBuffer.sampleRate, options);
		}
		if (audioBuffer === null) {
			// Container was parsed by demuxer and has no audio track or empty stream
			throw new NoAudioTrackError();
		}
	} catch (error) {
		if (error instanceof NoAudioTrackError) {
			throw error;
		}
		if (!demuxAttempted) {
			console.warn(
				"[SilenceDetector] AudioProcessor demux decode failed, falling back to fetch/decodeAudioData:",
				error,
			);
		}
	}

	// Fallback to direct fetch + AudioContext decodeAudioData for raw audio files or unsupported containers
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to load audio for silence detection: ${response.status}`);
	}

	const arrayBuffer = await response.arrayBuffer();
	const AudioCtxClass =
		window.AudioContext ||
		(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
	const audioCtx = new AudioCtxClass();
	try {
		const decoded = await audioCtx.decodeAudioData(arrayBuffer);
		const channel = decoded.getChannelData(0);
		return detectSilenceFromChannel(channel, decoded.sampleRate, options);
	} catch (decodeErr) {
		if (decodeErr instanceof DOMException) {
			throw new NoAudioTrackError("Unable to decode audio track from media");
		}
		throw decodeErr;
	} finally {
		await audioCtx.close().catch(() => undefined);
	}
}

/**
 * Maps a single timestamp forward across a set of removed silence gaps.
 */
export function mapTimeThroughSilences(timeMs: number, silences: SilenceRegion[]): number {
	let shift = 0;
	for (const s of silences) {
		if (timeMs <= s.startMs) {
			break;
		}
		if (timeMs < s.endMs) {
			return Math.max(0, s.startMs - shift);
		}
		shift += (s.endMs - s.startMs);
	}
	return Math.max(0, timeMs - shift);
}

/**
 * Maps an interval through silences. Returns null if interval was completely erased.
 */
export function mapSpanThroughSilences(
	startMs: number,
	endMs: number,
	silences: SilenceRegion[],
): { startMs: number; endMs: number } | null {
	for (const s of silences) {
		if (startMs >= s.startMs && endMs <= s.endMs) {
			return null;
		}
	}
	const newStart = mapTimeThroughSilences(startMs, silences);
	const newEnd = mapTimeThroughSilences(endMs, silences);
	if (newEnd <= newStart + 10) {
		return null;
	}
	return { startMs: Math.round(newStart), endMs: Math.round(newEnd) };
}

export interface ApplySilencesParams {
	silences: SilenceRegion[];
	clipRegions: ClipRegion[];
	zoomRegions: ZoomRegion[];
	annotationRegions: AnnotationRegion[];
	layoutRegions: LayoutRegion[];
	audioRegions: AudioRegion[];
	totalDurationMs: number;
}

export interface ApplySilencesResult {
	clipRegions: ClipRegion[];
	zoomRegions: ZoomRegion[];
	annotationRegions: AnnotationRegion[];
	layoutRegions: LayoutRegion[];
	audioRegions: AudioRegion[];
}

/**
 * Applies a list of silence cutouts to the timeline, producing clean, ripple-compressed clips and regions.
 */
export function applySilenceRemovalToTimeline({
	silences,
	clipRegions,
	zoomRegions,
	annotationRegions,
	layoutRegions,
	audioRegions,
	totalDurationMs,
}: ApplySilencesParams): ApplySilencesResult {
	if (silences.length === 0) {
		return {
			clipRegions,
			zoomRegions,
			annotationRegions,
			layoutRegions,
			audioRegions,
		};
	}

	// Sort silences ascending
	const sortedSilences = [...silences].sort((a, b) => a.startMs - b.startMs);

	// Calculate speech intervals to keep
	const keptSpeechIntervals: Array<{ startMs: number; endMs: number }> = [];
	let cursorMs = 0;

	for (const s of sortedSilences) {
		if (s.startMs > cursorMs) {
			keptSpeechIntervals.push({ startMs: cursorMs, endMs: s.startMs });
		}
		cursorMs = Math.max(cursorMs, s.endMs);
	}

	if (cursorMs < totalDurationMs) {
		keptSpeechIntervals.push({ startMs: cursorMs, endMs: totalDurationMs });
	}

	// Generate new ripple-compressed clips
	let timelineCursorMs = 0;
	const nextClips: ClipRegion[] = [];

	for (let i = 0; i < keptSpeechIntervals.length; i++) {
		const seg = keptSpeechIntervals[i];
		const duration = seg.endMs - seg.startMs;
		if (duration <= 20) continue;

		nextClips.push({
			id: `clip-silence-${i + 1}`,
			startMs: timelineCursorMs,
			endMs: timelineCursorMs + duration,
			speed: 1,
			muted: false,
		});

		timelineCursorMs += duration;
	}

	// Map zoom regions
	const nextZooms: ZoomRegion[] = [];
	for (const zoom of zoomRegions) {
		const mapped = mapSpanThroughSilences(zoom.startMs, zoom.endMs, sortedSilences);
		if (mapped) {
			nextZooms.push({ ...zoom, startMs: mapped.startMs, endMs: mapped.endMs });
		}
	}

	// Map annotation regions
	const nextAnnotations: AnnotationRegion[] = [];
	for (const ann of annotationRegions) {
		const mapped = mapSpanThroughSilences(ann.startMs, ann.endMs, sortedSilences);
		if (mapped) {
			nextAnnotations.push({ ...ann, startMs: mapped.startMs, endMs: mapped.endMs });
		}
	}

	// Map layout regions
	const nextLayouts: LayoutRegion[] = [];
	for (const lay of layoutRegions) {
		const mapped = mapSpanThroughSilences(lay.startMs, lay.endMs, sortedSilences);
		if (mapped) {
			nextLayouts.push({ ...lay, startMs: mapped.startMs, endMs: mapped.endMs });
		}
	}

	// Map audio regions
	const nextAudios: AudioRegion[] = [];
	for (const aud of audioRegions) {
		const mapped = mapSpanThroughSilences(aud.startMs, aud.endMs, sortedSilences);
		if (mapped) {
			nextAudios.push({ ...aud, startMs: mapped.startMs, endMs: mapped.endMs });
		}
	}

	return {
		clipRegions: nextClips,
		zoomRegions: nextZooms,
		annotationRegions: nextAnnotations,
		layoutRegions: nextLayouts,
		audioRegions: nextAudios,
	};
}
