import {
	computeDuckingGain,
	getSpeechIntervalsFromChannelData,
	mergeSpeechIntervals,
	type SpeechInterval,
} from "@/components/video-editor/audio/audioDucking";
import { buildProjectAudioPlan, type ProjectAudioSegment } from "@/core/timeline/audioPlan";
import { projectDurationUs, type TimelineProject } from "@/core/timeline/types";
import { localMediaUrl } from "@/recording/mediaProbe";
import { AudioProcessor } from "./audioEncoder";
export function throwIfCanceled(signal?: AbortSignal) {
	if (signal?.aborted) throw new DOMException("Export canceled", "AbortError");
}
export function projectSpeechIntervals(
	segment: ProjectAudioSegment,
	intervals: SpeechInterval[],
): SpeechInterval[] {
	return intervals.flatMap((i) => {
		const start = Math.max(
				segment.startUs,
				segment.startUs + (i.startMs * 1000 - segment.sourceStartUs) / segment.rate,
			),
			end = Math.min(
				segment.endUs,
				segment.startUs + (i.endMs * 1000 - segment.sourceStartUs) / segment.rate,
			);
		return end > start ? [{ startMs: start / 1000, endMs: end / 1000 }] : [];
	});
}
/** Preview and export consume the same mixed PCM with the retained WSOLA rate adapter. */
export async function renderProjectAudio(
	project: TimelineProject,
	signal?: AbortSignal,
	timeRangeUs?: { startUs: number; endUs: number },
): Promise<Blob | null> {
	const plan = buildProjectAudioPlan(project);
	if (!plan.some((p) => p.gain > 0)) return null;
	const processor = new AudioProcessor(),
		buffers = new Map<string, AudioBuffer | null>(),
		normalizations = new Map<string, number>(),
		speech = new Map<string, SpeechInterval[]>(),
		parts: ArrayBuffer[] = [],
		sampleRate = 48000,
		channels = 2,
		totalDuration = projectDurationUs(project),
		rangeStartUs = timeRangeUs ? Math.max(0, timeRangeUs.startUs) : 0,
		rangeEndUs = timeRangeUs
			? Math.min(totalDuration, Math.max(rangeStartUs, timeRangeUs.endUs))
			: totalDuration,
		effectiveDurationUs = Math.max(0, rangeEndUs - rangeStartUs),
		totalFrames = Math.ceil((effectiveDurationUs / 1_000_000) * sampleRate);
	if (!Number.isSafeInteger(totalFrames) || totalFrames * channels * 2 > 0xffffffff - 36)
		throw new Error("Project audio exceeds WAV size limit");
	const abort = () => processor.cancel();
	signal?.addEventListener("abort", abort);
	try {
		for (const source of plan) {
			throwIfCanceled(signal);
			if (buffers.has(source.path)) continue;
			const url = await localMediaUrl(source.path),
				buffer = await processor.decodeAudioFromUrl(url, {
					isVideoContainer: /\.(mp4|webm|mov|mkv)$/i.test(source.path),
				});
			throwIfCanceled(signal);
			if (!buffer && source.kind !== "media")
				throw new Error(`Required audio stream unavailable: ${source.path}`);
			buffers.set(source.path, buffer);
		}
		for (const source of plan) {
			const buffer = buffers.get(source.path);
			if (!buffer) continue;
			if (source.normalize && !normalizations.has(source.path)) {
				let peak = 0;
				for (let c = 0; c < buffer.numberOfChannels; c++)
					for (const sample of buffer.getChannelData(c))
						peak = Math.max(peak, Math.abs(sample));
				normalizations.set(source.path, peak > 0 ? Math.min(4, 0.95 / peak) : 1);
			}
			if (
				source.kind === "microphone" &&
				source.gain > 0 &&
				plan.some((p) => p.clipId === source.clipId && p.ducking?.enabled)
			) {
				const intervals = getSpeechIntervalsFromChannelData(
					buffer.getChannelData(0),
					buffer.sampleRate,
				);
				speech.set(
					source.clipId,
					mergeSpeechIntervals([
						...(speech.get(source.clipId) ?? []),
						...projectSpeechIntervals(source, intervals),
					]),
				);
			}
		}
		for (let offset = 0; offset < totalFrames; offset += sampleRate * 10) {
			throwIfCanceled(signal);
			const count = Math.min(sampleRate * 10, totalFrames - offset),
				context = new OfflineAudioContext(channels, count, sampleRate),
				beginUs = rangeStartUs + (offset / sampleRate) * 1_000_000,
				endUs = rangeStartUs + ((offset + count) / sampleRate) * 1_000_000;
			for (const source of plan) {
				const start = Math.max(beginUs, source.startUs),
					end = Math.min(endUs, source.endUs),
					buffer = buffers.get(source.path);
				if (!buffer || end <= start || source.gain <= 0) continue;
				const duration = (end - start) / 1_000_000,
					sourceStart =
						(source.sourceStartUs + (start - source.startUs) * source.rate) / 1_000_000;
				const available = Math.min(
					duration,
					Math.max(0, (buffer.duration - sourceStart) / source.rate),
				);
				if (!available) continue;
				const stretched = processor.stretchAudioBuffer(
						buffer,
						source.rate,
						sourceStart,
						available * source.rate,
						available,
						context,
					),
					node = context.createBufferSource(),
					gain = context.createGain();
				const baseGain =
					source.gain * (source.normalize ? (normalizations.get(source.path) ?? 1) : 1);
				node.buffer = stretched;
				gain.gain.value = baseGain;
				if (source.ducking?.enabled) {
					for (let ms = start / 1000; ms < end / 1000; ms += 20)
						gain.gain.setValueAtTime(
							baseGain *
								computeDuckingGain(
									ms,
									speech.get(source.clipId) ?? [],
									source.ducking,
								),
							(ms * 1000 - beginUs) / 1_000_000,
						);
				}
				node.connect(gain).connect(context.destination);
				node.start((start - beginUs) / 1_000_000);
			}
			const rendered = await context.startRendering();
			throwIfCanceled(signal);
			const bytes = new ArrayBuffer(count * channels * 2),
				view = new DataView(bytes);
			for (let i = 0; i < count; i++) {
				for (let ch = 0; ch < channels; ch++) {
					const value = Math.max(-1, Math.min(1, rendered.getChannelData(ch)[i]));
					view.setInt16(
						(i * channels + ch) * 2,
						value < 0 ? value * 32768 : value * 32767,
						true,
					);
				}
			}
			parts.push(bytes);
		}
		const header = new ArrayBuffer(44),
			view = new DataView(header),
			write = (offset: number, value: string) => {
				for (let i = 0; i < value.length; i++)
					view.setUint8(offset + i, value.charCodeAt(i));
			};
		write(0, "RIFF");
		view.setUint32(4, 36 + totalFrames * channels * 2, true);
		write(8, "WAVEfmt ");
		view.setUint32(16, 16, true);
		view.setUint16(20, 1, true);
		view.setUint16(22, channels, true);
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, sampleRate * channels * 2, true);
		view.setUint16(32, channels * 2, true);
		view.setUint16(34, 16, true);
		write(36, "data");
		view.setUint32(40, totalFrames * channels * 2, true);
		return new Blob([header, ...parts], { type: "audio/wav" });
	} finally {
		signal?.removeEventListener("abort", abort);
		processor.cancel();
		buffers.clear();
	}
}
