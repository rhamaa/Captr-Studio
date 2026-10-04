import { afterEach, describe, expect, it, vi } from "vitest";
import {
	type AudioRecorderEnvironment,
	type AudioRecorderInputDevice,
	type AudioRecorderLike,
	createAudioRecorderSession,
} from "./audioRecorder";

function createFixture(options?: { supported?: string[]; devices?: AudioRecorderInputDevice[] }) {
	const track = { stop: vi.fn() };
	const stream = { getTracks: () => [track] } as unknown as MediaStream;
	const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm;codecs=opus" });
	const analyser = {
		fftSize: 0,
		frequencyBinCount: 16,
		getByteFrequencyData: (data: Uint8Array) => data.fill(64),
	};
	const source = { connect: vi.fn() };
	const audioContext = {
		state: "running",
		createAnalyser: vi.fn(() => analyser),
		createMediaStreamSource: vi.fn(() => source),
		resume: vi.fn(async () => undefined),
		close: vi.fn(async () => undefined),
	};
	let now = 1_000;
	let recorder!: AudioRecorderLike;
	let frameCallback: FrameRequestCallback | undefined;
	const recorderOptions: string[] = [];
	const mediaDevices = {
		enumerateDevices: vi.fn(async () =>
			(
				options?.devices ?? [
					{ deviceId: "mic-1", label: "Desk mic", kind: "audioinput" },
					{ deviceId: "cam-1", label: "Camera", kind: "videoinput" },
				]
			).map((device) => ({ groupId: "group", ...device })),
		),
		getUserMedia: vi.fn(async () => stream),
	};
	const environment: AudioRecorderEnvironment = {
		mediaDevices: mediaDevices as unknown as AudioRecorderEnvironment["mediaDevices"],
		isTypeSupported: (mimeType) =>
			(options?.supported ?? ["audio/webm;codecs=opus"]).includes(mimeType),
		createRecorder: (_stream, mimeType) => {
			recorderOptions.push(mimeType);
			recorder = {
				state: "inactive",
				ondataavailable: null,
				onerror: null,
				onstop: null,
				start: vi.fn(() => {
					recorder.state = "recording";
				}),
				stop: vi.fn(() => {
					recorder.state = "inactive";
					recorder.ondataavailable?.({ data: blob });
					recorder.onstop?.();
				}),
			};
			return recorder;
		},
		createAudioContext: () => audioContext as unknown as AudioContext,
		now: () => {
			const current = now;
			now += 1_250;
			return current;
		},
		requestAnimationFrame: vi.fn((callback) => {
			frameCallback = callback;
			return 41;
		}),
		cancelAnimationFrame: vi.fn(),
	};
	return {
		environment,
		mediaDevices,
		recorderOptions,
		audioContext,
		track,
		blob,
		updateMeter: () => frameCallback?.(0),
	};
}

afterEach(() => vi.restoreAllMocks());

describe("createAudioRecorderSession", () => {
	it("lists audio inputs only without requesting capture permission", async () => {
		const fixture = createFixture();
		const session = createAudioRecorderSession(fixture.environment);

		await expect(session.listInputs()).resolves.toEqual([
			{ deviceId: "mic-1", label: "Desk mic", groupId: "group" },
		]);
		expect(fixture.mediaDevices.enumerateDevices).toHaveBeenCalledOnce();
		expect(fixture.mediaDevices.getUserMedia).not.toHaveBeenCalled();
	});

	it("selects a supported MIME type with its matching allowed extension", async () => {
		const fixture = createFixture({ supported: ["audio/ogg;codecs=opus"] });
		const session = createAudioRecorderSession(fixture.environment);
		await session.start({ deviceId: null, startUs: 0, onLevel: vi.fn() });

		const take = await session.stop();
		expect(fixture.recorderOptions).toEqual(["audio/ogg;codecs=opus"]);
		expect(take.mimeType).toBe("audio/ogg;codecs=opus");
		expect(take.extension).toBe("ogg");
	});

	it("returns a finalized take anchored to the captured project time", async () => {
		const fixture = createFixture();
		const session = createAudioRecorderSession(fixture.environment);
		const level = vi.fn();
		await session.start({ deviceId: "mic-1", startUs: 4_250_000, onLevel: level });

		const take = await session.stop();
		expect(take).toMatchObject({
			mimeType: "audio/webm;codecs=opus",
			extension: "webm",
			durationMs: 1_250,
			startUs: 4_250_000,
		});
		expect(take.blob).toBeInstanceOf(Blob);
		expect(await take.blob.arrayBuffer()).toEqual(await fixture.blob.arrayBuffer());
		expect(fixture.mediaDevices.getUserMedia).toHaveBeenCalledWith({
			audio: {
				deviceId: { exact: "mic-1" },
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
			},
			video: false,
		});
	});

	it("reports a normalized live microphone level", async () => {
		const fixture = createFixture();
		const session = createAudioRecorderSession(fixture.environment);
		const onLevel = vi.fn();
		await session.start({ deviceId: null, startUs: 0, onLevel });

		fixture.updateMeter();
		expect(onLevel).toHaveBeenLastCalledWith(0.5);
		await session.discard();
	});

	it("discards without returning a take", async () => {
		const fixture = createFixture();
		const session = createAudioRecorderSession(fixture.environment);
		await session.start({ deviceId: null, startUs: 0, onLevel: vi.fn() });

		await expect(session.discard()).resolves.toBeUndefined();
		expect(fixture.track.stop).toHaveBeenCalledOnce();
	});

	it("releases stream, context and animation frame after stop and discard", async () => {
		const stopped = createFixture();
		const stopSession = createAudioRecorderSession(stopped.environment);
		await stopSession.start({ deviceId: null, startUs: 0, onLevel: vi.fn() });
		await stopSession.stop();
		expect(stopped.track.stop).toHaveBeenCalledOnce();
		expect(stopped.audioContext.close).toHaveBeenCalledOnce();
		expect(stopped.environment.cancelAnimationFrame).toHaveBeenCalledWith(41);

		const discarded = createFixture();
		const discardSession = createAudioRecorderSession(discarded.environment);
		await discardSession.start({ deviceId: null, startUs: 0, onLevel: vi.fn() });
		await discardSession.discard();
		expect(discarded.track.stop).toHaveBeenCalledOnce();
		expect(discarded.audioContext.close).toHaveBeenCalledOnce();
		expect(discarded.environment.cancelAnimationFrame).toHaveBeenCalledWith(41);
	});

	it("rejects unavailable recording formats before requesting microphone access", async () => {
		const fixture = createFixture({ supported: [] });
		const session = createAudioRecorderSession(fixture.environment);

		await expect(
			session.start({ deviceId: null, startUs: 0, onLevel: vi.fn() }),
		).rejects.toThrow(/supported audio/i);
		expect(fixture.mediaDevices.getUserMedia).not.toHaveBeenCalled();
		expect(fixture.audioContext.close).not.toHaveBeenCalled();
	});
});
