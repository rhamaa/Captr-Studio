import { afterEach, expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { fixtureClip, fixtureText, fixtureTrack } from "@/core/timeline/storyOwnership.fixtures";
import { AudioProcessor } from "./audioEncoder";
import { projectSpeechIntervals, renderProjectAudio } from "./projectAudioRenderer";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([0.5, 2])("mixes private audio through the existing decoder and stretch contract at rate %s", async (rate) => {
	const project = createTimelineProject("private-mix", "Private mix");
	const clip = fixtureClip("voice", { assetId: "voice" });
	clip.rate = rate; clip.sourceInUs = 1_000_000; clip.sourceOutUs = 2_000_000;
	project.localAssets = [{ id: "voice", kind: "audio", name: "Voice", width: 0, height: 0, durationUs: 5_000_000,
		source: { path: "voice.wav", durationUs: 4_000_000, offsetUs: 500_000 } }];
	project.tracks = [fixtureTrack("voice-track", [clip], "audio")];
	const buffer = { duration: 4, numberOfChannels: 1 } as AudioBuffer;
	const decode = vi.spyOn(AudioProcessor.prototype, "decodeAudioFromUrl").mockResolvedValue(buffer);
	const stretch = vi.spyOn(AudioProcessor.prototype, "stretchAudioBuffer").mockReturnValue(buffer);
	vi.spyOn(AudioProcessor.prototype, "cancel").mockImplementation(() => undefined);
	vi.stubGlobal("window", { electronAPI: { getLocalMediaUrl: async (path: string) => ({ success: true, url: path }) } });
	vi.stubGlobal("OfflineAudioContext", class {
		destination = {};
		private samples: Float32Array;
		constructor(_channels: number, length: number) { this.samples = new Float32Array(length).fill(0.25); }
		createBufferSource() { return { buffer: null, connect: () => ({ connect: () => undefined }), start: () => undefined }; }
		createGain() { return { gain: { value: 1 } }; }
		async startRendering() { return { getChannelData: () => this.samples }; }
	});
	const wav = await renderProjectAudio(project);
	expect(decode).toHaveBeenCalledOnce();
	expect(stretch.mock.calls[0].slice(0, 5)).toEqual([buffer, rate, 0.5, 1, 1 / rate]);
	expect(wav?.type).toBe("audio/wav");
	expect(wav?.size).toBe(44 + Math.ceil(48_000 / rate) * 4);
});

it("emits no exported audio for inline-only Story content", async () => {
	const project = createTimelineProject("silent-inline", "Inline");
	project.tracks = [fixtureTrack("design", [fixtureClip("title", { content: { kind: "text", text: fixtureText, durationUs: 5_000_000 } })])];
	expect(await renderProjectAudio(project)).toBeNull();
});

it("decodes WAV natively before asking a container demuxer", async () => {
	const processor = new AudioProcessor();
	const buffer = {} as AudioBuffer;
	const native = vi
		.spyOn(processor as never, "bulkDecodeFromUrl")
		.mockResolvedValue(buffer as never);
	const streamed = vi.spyOn(processor as never, "streamDecodeFromUrl");
	expect(await processor.decodeAudioFromUrl("http://localhost/mic.wav")).toBe(buffer);
	expect(native).toHaveBeenCalledOnce();
	expect(streamed).not.toHaveBeenCalled();
});
it("maps detected speech through stream offsets and speed", () => {
	const segment = {
		id: "mic",
		clipId: "c",
		kind: "microphone" as const,
		path: "mic.wav",
		startUs: 1_000_000,
		endUs: 3_000_000,
		sourceStartUs: 500_000,
		rate: 2,
		gain: 1,
		normalize: false,
	};
	expect(
		projectSpeechIntervals(segment, [
			{ startMs: 0, endMs: 1500 },
			{ startMs: 2000, endMs: 6000 },
		]),
	).toEqual([
		{ startMs: 1000, endMs: 1500 },
		{ startMs: 1750, endMs: 3000 },
	]);
});
