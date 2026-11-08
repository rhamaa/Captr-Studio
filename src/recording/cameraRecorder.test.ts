import { describe, expect, it, vi } from "vitest";
import { type CameraRecorderEnvironment, createCameraRecorderSession } from "./cameraRecorder";

class FakeTrack {
	stopped = false;
	constructor(
		public kind: "audio" | "video",
		private settings: MediaTrackSettings = {},
	) {}
	stop() {
		this.stopped = true;
	}
	getSettings() {
		return this.settings;
	}
}

class FakeStream {
	constructor(public tracks: FakeTrack[]) {}
	getTracks() {
		return this.tracks;
	}
	getAudioTracks() {
		return this.tracks.filter((t) => t.kind === "audio");
	}
	getVideoTracks() {
		return this.tracks.filter((t) => t.kind === "video");
	}
}

class FakeRecorder {
	state = "inactive";
	ondataavailable: ((event: { data: Blob }) => void) | null = null;
	onerror: ((event: unknown) => void) | null = null;
	onstop: (() => void) | null = null;
	constructor(public mimeType: string) {}
	start() {
		this.state = "recording";
	}
	stop() {
		this.state = "inactive";
		this.ondataavailable?.({ data: new Blob(["frame"], { type: this.mimeType }) });
		this.onstop?.();
	}
}

function setup(options: { audio?: boolean; supported?: string[]; fail?: Error } = {}) {
	const streams: FakeStream[] = [];
	const recorders: FakeRecorder[] = [];
	const fixedDurations: number[] = [];
	let clock = 1000;
	const getUserMedia = vi.fn(async (_constraints: MediaStreamConstraints) => {
		if (options.fail) throw options.fail;
		const stream = new FakeStream([
			new FakeTrack("video", { width: 1280, height: 720, frameRate: 30 }),
			...(options.audio === false ? [] : [new FakeTrack("audio")]),
		]);
		streams.push(stream);
		return stream as unknown as MediaStream;
	});
	const environment: CameraRecorderEnvironment = {
		mediaDevices: {
			getUserMedia,
			enumerateDevices: async () =>
				[
					{ kind: "videoinput", deviceId: "cam-1", label: "Front Cam", groupId: "" },
					{ kind: "videoinput", deviceId: "cam-2", label: "", groupId: "" },
					{ kind: "audioinput", deviceId: "mic-1", label: "Mic", groupId: "" },
					{ kind: "audiooutput", deviceId: "spk", label: "Speaker", groupId: "" },
				] as MediaDeviceInfo[],
		},
		isTypeSupported: (type) => (options.supported ?? ["video/webm;codecs=vp9"]).includes(type),
		canPlayType: () => "maybe",
		fixWebmDuration: async (blob, durationMs) => {
			fixedDurations.push(durationMs);
			return blob;
		},
		createRecorder: (_stream, mimeType) => {
			const recorder = new FakeRecorder(mimeType);
			recorders.push(recorder);
			return recorder;
		},
		createAudioContext: () => ({
			createAnalyser: () => ({
				fftSize: 0,
				frequencyBinCount: 4,
				getByteFrequencyData: (data: Uint8Array) => data.fill(64),
			}),
			createMediaStreamSource: () => ({ connect: () => undefined }),
			close: async () => undefined,
		}),
		now: () => clock,
		requestAnimationFrame: () => 1,
		cancelAnimationFrame: () => undefined,
	};
	return {
		session: createCameraRecorderSession(environment),
		getUserMedia,
		streams,
		recorders,
		fixedDurations,
		advance: (ms: number) => {
			clock += ms;
		},
	};
}

describe("camera recorder session", () => {
	it("lists cameras and microphones separately with fallback labels", async () => {
		const { session } = setup();
		expect(await session.listInputs()).toEqual({
			cameras: [
				{ deviceId: "cam-1", label: "Front Cam" },
				{ deviceId: "cam-2", label: "Camera 2" },
			],
			microphones: [{ deviceId: "mic-1", label: "Mic" }],
		});
	});

	it("opens a 1080p30 preview with the chosen devices and reports granted settings", async () => {
		const { session, getUserMedia } = setup();
		const preview = await session.openPreview({
			cameraId: "cam-1",
			microphoneId: "mic-1",
			resolution: "1080p",
			onLevel: () => undefined,
		});
		const constraints = getUserMedia.mock.calls[0][0];
		expect(constraints.video).toMatchObject({
			deviceId: { exact: "cam-1" },
			width: { ideal: 1920 },
			height: { ideal: 1080 },
			frameRate: { ideal: 30 },
		});
		expect(constraints.audio).toMatchObject({ deviceId: { exact: "mic-1" } });
		expect(preview.settings).toEqual({ width: 1280, height: 720, frameRate: 30 });
	});

	it("reopening the preview releases the old stream", async () => {
		const { session, streams } = setup();
		const opts = {
			cameraId: null,
			microphoneId: null,
			resolution: "720p" as const,
			onLevel: () => {},
		};
		await session.openPreview(opts);
		await session.openPreview({ ...opts, resolution: "480p" });
		expect(streams[0].tracks.every((t) => t.stopped)).toBe(true);
		expect(streams[1].tracks.some((t) => t.stopped)).toBe(false);
	});

	it("records the preview stream and keeps the preview open after stop", async () => {
		const { session, streams, recorders, fixedDurations, advance } = setup();
		await session.openPreview({
			cameraId: null,
			microphoneId: null,
			resolution: "1080p",
			onLevel: () => {},
		});
		session.start();
		advance(2500);
		const take = await session.stop();
		expect(recorders[0].mimeType).toBe("video/webm;codecs=vp9");
		expect(fixedDurations).toEqual([2500]);
		expect(take).toMatchObject({ extension: "webm", durationMs: 2500, hasAudio: true });
		expect(take.blob.size).toBeGreaterThan(0);
		expect(streams[0].tracks.some((t) => t.stopped)).toBe(false);
		expect(session.isRecording()).toBe(false);
	});

	it("falls back to a supported container", async () => {
		const { session, recorders, fixedDurations } = setup({ supported: ["video/mp4"] });
		await session.openPreview({
			cameraId: null,
			microphoneId: null,
			resolution: "1080p",
			onLevel: () => {},
		});
		session.start();
		expect(recorders[0].mimeType).toBe("video/mp4");
		expect((await session.stop()).extension).toBe("mp4");
		expect(fixedDurations).toEqual([]);
	});

	it("reports a take without audio", async () => {
		const { session } = setup({ audio: false });
		await session.openPreview({
			cameraId: null,
			microphoneId: null,
			resolution: "1080p",
			onLevel: () => {},
		});
		session.start();
		expect((await session.stop()).hasAudio).toBe(false);
	});

	it("discard drops the take", async () => {
		const { session } = setup();
		await session.openPreview({
			cameraId: null,
			microphoneId: null,
			resolution: "1080p",
			onLevel: () => {},
		});
		session.start();
		await session.discard();
		expect(session.isRecording()).toBe(false);
		await expect(session.stop()).rejects.toThrow(/not active/i);
	});

	it("refuses to change devices or start twice while recording", async () => {
		const { session } = setup();
		const opts = {
			cameraId: null,
			microphoneId: null,
			resolution: "1080p" as const,
			onLevel: () => {},
		};
		await session.openPreview(opts);
		session.start();
		expect(() => session.start()).toThrow(/already/i);
		await expect(session.openPreview(opts)).rejects.toThrow(/while recording/i);
	});

	it("requires a preview before recording", () => {
		const { session } = setup();
		expect(() => session.start()).toThrow(/preview/i);
	});

	it("dispose stops every track", async () => {
		const { session, streams } = setup();
		await session.openPreview({
			cameraId: null,
			microphoneId: null,
			resolution: "1080p",
			onLevel: () => {},
		});
		session.start();
		await session.dispose();
		expect(streams[0].tracks.every((t) => t.stopped)).toBe(true);
	});

	it("turns a permission error into a readable message", async () => {
		const error = Object.assign(new Error("denied"), { name: "NotAllowedError" });
		const { session } = setup({ fail: error });
		await expect(
			session.openPreview({
				cameraId: null,
				microphoneId: null,
				resolution: "1080p",
				onLevel: () => {},
			}),
		).rejects.toThrow(/permission/i);
	});
});
