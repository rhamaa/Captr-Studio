/**
 * Smart Audio Ducking Engine for Captr Studio.
 * Automatically attenuates background audio tracks (BGM / SFX) whenever
 * vocal speech is active, preventing background music from overpowering narration.
 */

import type { AudioDuckingSettings, CaptionCue } from "../types";

export interface SpeechInterval {
	startMs: number;
	endMs: number;
}

/**
 * Converts decibels to linear amplitude factor.
 * e.g., 0 dB -> 1.0, -6 dB -> ~0.501, -14 dB -> ~0.199, -20 dB -> 0.1
 */
export function dbToLinear(db: number): number {
	return Math.pow(10, db / 20);
}

/**
 * Converts linear amplitude factor to decibels.
 */
export function linearToDb(linear: number): number {
	if (linear <= 0) return -100;
	return 20 * Math.log10(linear);
}

/**
 * Merges speech intervals that are within `maxGapMs` of each other.
 * This hysteresis prevents unnatural volume "pumping" during brief pauses between words.
 */
export function mergeSpeechIntervals(
	intervals: SpeechInterval[],
	maxGapMs = 400,
): SpeechInterval[] {
	if (intervals.length <= 1) return [...intervals];

	const sorted = [...intervals]
		.filter(
			(int) =>
				Number.isFinite(int.startMs) &&
				Number.isFinite(int.endMs) &&
				int.endMs > int.startMs,
		)
		.sort((a, b) => a.startMs - b.startMs);

	if (sorted.length <= 1) return sorted;

	const merged: SpeechInterval[] = [{ ...sorted[0] }];

	for (let i = 1; i < sorted.length; i++) {
		const curr = sorted[i];
		const prev = merged[merged.length - 1];

		if (curr.startMs <= prev.endMs + maxGapMs) {
			// Extend previous interval
			prev.endMs = Math.max(prev.endMs, curr.endMs);
		} else {
			merged.push({ ...curr });
		}
	}

	return merged;
}

/**
 * Extracts speech intervals directly from Whisper AI caption cues.
 * Extremely fast and accurate since timings are already timestamped by speech AI.
 */
export function getSpeechIntervalsFromCues(cues: CaptionCue[], maxGapMs = 500): SpeechInterval[] {
	const rawIntervals: SpeechInterval[] = cues.map((cue) => ({
		startMs: Math.max(0, cue.startMs),
		endMs: Math.max(cue.startMs, cue.endMs),
	}));

	return mergeSpeechIntervals(rawIntervals, maxGapMs);
}

/**
 * Extracts speech intervals from raw PCM audio channel data using RMS energy analysis.
 * Used as an automatic fallback when captions have not been generated yet.
 */
export function getSpeechIntervalsFromChannelData(
	channelData: Float32Array,
	sampleRate: number,
	options: {
		thresholdDb?: number;
		windowMs?: number;
		minDurationMs?: number;
		maxGapMs?: number;
	} = {},
): SpeechInterval[] {
	const thresholdDb = options.thresholdDb ?? -36;
	const windowMs = options.windowMs ?? 40;
	const minDurationMs = options.minDurationMs ?? 150;
	const maxGapMs = options.maxGapMs ?? 450;

	const thresholdLinear = dbToLinear(thresholdDb);
	const windowSamples = Math.max(1, Math.round((windowMs / 1000) * sampleRate));
	const totalSamples = channelData.length;

	const rawIntervals: SpeechInterval[] = [];
	let inSpeech = false;
	let speechStartSample = 0;

	for (let i = 0; i < totalSamples; i += windowSamples) {
		const end = Math.min(i + windowSamples, totalSamples);
		let sumSq = 0;
		for (let j = i; j < end; j++) {
			sumSq += channelData[j] * channelData[j];
		}
		const rms = Math.sqrt(sumSq / (end - i));

		if (rms >= thresholdLinear) {
			if (!inSpeech) {
				inSpeech = true;
				speechStartSample = i;
			}
		} else {
			if (inSpeech) {
				inSpeech = false;
				const durationMs = ((i - speechStartSample) / sampleRate) * 1000;
				if (durationMs >= minDurationMs) {
					rawIntervals.push({
						startMs: (speechStartSample / sampleRate) * 1000,
						endMs: (i / sampleRate) * 1000,
					});
				}
			}
		}
	}

	if (inSpeech) {
		const durationMs = ((totalSamples - speechStartSample) / sampleRate) * 1000;
		if (durationMs >= minDurationMs) {
			rawIntervals.push({
				startMs: (speechStartSample / sampleRate) * 1000,
				endMs: (totalSamples / sampleRate) * 1000,
			});
		}
	}

	return mergeSpeechIntervals(rawIntervals, maxGapMs);
}

/**
 * Calculates the ducking multiplier (0.0 to 1.0) at any given point in time (timeMs).
 * Applies attack, hold, and release curves.
 */
export function computeDuckingGain(
	timeMs: number,
	speechIntervals: SpeechInterval[],
	settings: AudioDuckingSettings,
): number {
	if (!settings.enabled || speechIntervals.length === 0) {
		return 1.0;
	}

	const duckFactor = Math.max(0.01, Math.min(1.0, dbToLinear(settings.duckingAmountDb)));
	const attackMs = Math.max(10, settings.attackMs);
	const releaseMs = Math.max(10, settings.releaseMs);
	const holdMs = Math.max(0, settings.holdMs);

	let minGain = 1.0;

	for (const interval of speechIntervals) {
		const attackStart = interval.startMs - attackMs;
		const holdEnd = interval.endMs + holdMs;
		const releaseEnd = holdEnd + releaseMs;

		if (timeMs < attackStart || timeMs > releaseEnd) {
			// Outside this interval's zone of influence
			continue;
		}

		if (timeMs >= interval.startMs && timeMs <= holdEnd) {
			// Fully ducked (inside speech or hold period)
			return duckFactor;
		}

		if (timeMs >= attackStart && timeMs < interval.startMs) {
			// Attack phase (fading down from 1.0 to duckFactor)
			const progress = (timeMs - attackStart) / attackMs;
			// Smooth cosine ease-in-out
			const factor = 0.5 - 0.5 * Math.cos(Math.PI * progress);
			const gain = 1.0 - (1.0 - duckFactor) * factor;
			minGain = Math.min(minGain, gain);
		} else if (timeMs > holdEnd && timeMs <= releaseEnd) {
			// Release phase (fading up from duckFactor to 1.0)
			const progress = (timeMs - holdEnd) / releaseMs;
			// Smooth cosine ease-in-out
			const factor = 0.5 - 0.5 * Math.cos(Math.PI * progress);
			const gain = duckFactor + (1.0 - duckFactor) * factor;
			minGain = Math.min(minGain, gain);
		}
	}

	return Math.max(duckFactor, Math.min(1.0, minGain));
}

/**
 * Applies ducking automation curves directly to a Web Audio GainNode for offline export rendering.
 * Operates on a chunk window [chunkStartSec, chunkStartSec + chunkDurationSec].
 */
export function applyDuckingAutomationToGainNode(
	gainNode: GainNode,
	speechIntervals: SpeechInterval[],
	settings: AudioDuckingSettings,
	chunkStartSec: number,
	chunkDurationSec: number,
	baseGain: number,
): void {
	if (!settings.enabled || speechIntervals.length === 0) {
		gainNode.gain.setValueAtTime(baseGain, 0);
		return;
	}

	const duckFactor = Math.max(0.01, Math.min(1.0, dbToLinear(settings.duckingAmountDb)));
	const duckedGain = baseGain * duckFactor;
	const attackSec = Math.max(0.01, settings.attackMs / 1000);
	const releaseSec = Math.max(0.01, settings.releaseMs / 1000);
	const holdSec = Math.max(0, settings.holdMs / 1000);

	const chunkEndSec = chunkStartSec + chunkDurationSec;
	const chunkStartMs = chunkStartSec * 1000;

	// Initial gain at start of chunk
	const initialGain = baseGain * computeDuckingGain(chunkStartMs, speechIntervals, settings);
	gainNode.gain.setValueAtTime(initialGain, 0);

	// Schedule points across intervals that intersect with this chunk
	for (const interval of speechIntervals) {
		const speechStartSec = interval.startMs / 1000;
		const speechEndSec = interval.endMs / 1000;
		const attackStartSec = speechStartSec - attackSec;
		const holdEndSec = speechEndSec + holdSec;
		const releaseEndSec = holdEndSec + releaseSec;

		if (releaseEndSec < chunkStartSec || attackStartSec > chunkEndSec) {
			continue;
		}

		// Attack start -> normal gain
		const relAttackStart = attackStartSec - chunkStartSec;
		if (relAttackStart > 0 && relAttackStart <= chunkDurationSec) {
			gainNode.gain.setValueAtTime(baseGain, relAttackStart);
		}

		// Speech start -> ducked gain
		const relSpeechStart = speechStartSec - chunkStartSec;
		if (relSpeechStart > 0 && relSpeechStart <= chunkDurationSec) {
			gainNode.gain.linearRampToValueAtTime(duckedGain, relSpeechStart);
		}

		// Hold end -> still ducked gain
		const relHoldEnd = holdEndSec - chunkStartSec;
		if (relHoldEnd > 0 && relHoldEnd <= chunkDurationSec) {
			gainNode.gain.setValueAtTime(duckedGain, relHoldEnd);
		}

		// Release end -> back to base gain
		const relReleaseEnd = releaseEndSec - chunkStartSec;
		if (relReleaseEnd > 0 && relReleaseEnd <= chunkDurationSec) {
			gainNode.gain.linearRampToValueAtTime(baseGain, relReleaseEnd);
		}
	}
}
