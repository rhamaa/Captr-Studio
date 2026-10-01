import { describe, expect, it } from "vitest";
import { resolveLoadedSlideAudioRegions, resolveSlideAudioSourcePath } from "./slideAudioIsolation";
import type { AudioRegion } from "./types";

const RECORD_SOURCE = "C:/recordings/recording-1.mp4";

describe("resolveSlideAudioSourcePath", () => {
	it("keeps the global source for record slides that own their media", () => {
		expect(
			resolveSlideAudioSourcePath({
				activeSlide: { videoPath: "C:/recordings/recording-1.mp4" },
				activeSlideMode: "record",
				currentSourcePath: RECORD_SOURCE,
			}),
		).toBe("C:/recordings/recording-1.mp4");
	});

	it("falls back to the global source for record takes without a stored path", () => {
		expect(
			resolveSlideAudioSourcePath({
				activeSlide: { videoPath: "" },
				activeSlideMode: "record",
				currentSourcePath: RECORD_SOURCE,
			}),
		).toBe(RECORD_SOURCE);
	});

	it("keeps the global source while no slide is loaded (dev/smoke flows)", () => {
		expect(
			resolveSlideAudioSourcePath({
				activeSlide: null,
				activeSlideMode: "record",
				currentSourcePath: RECORD_SOURCE,
			}),
		).toBe(RECORD_SOURCE);
	});

	it("returns null when nothing is available at all", () => {
		expect(
			resolveSlideAudioSourcePath({
				activeSlide: null,
				activeSlideMode: "record",
				currentSourcePath: null,
			}),
		).toBeNull();
	});
});

describe("resolveLoadedSlideAudioRegions", () => {
	const recordAudio: AudioRegion[] = [
		{ id: "audio-1", startMs: 0, endMs: 1000, audioPath: "C:/recordings/mic.wav", volume: 1 },
	];

	it("prefers the slide's own persisted regions", () => {
		expect(
			resolveLoadedSlideAudioRegions({
				persistedClipAudioRegions: [],
				editorAudioRegions: recordAudio,
				clipCount: 3,
			}),
		).toEqual([]);
	});

	it("adopts legacy editor regions only when a single slide exists", () => {
		expect(
			resolveLoadedSlideAudioRegions({
				persistedClipAudioRegions: undefined,
				editorAudioRegions: recordAudio,
				clipCount: 1,
			}),
		).toBe(recordAudio);
	});

	it("never throws the record slide's audio onto a multi-slide project", () => {
		expect(
			resolveLoadedSlideAudioRegions({
				persistedClipAudioRegions: undefined,
				editorAudioRegions: recordAudio,
				clipCount: 2,
			}),
		).toEqual([]);
	});
});
