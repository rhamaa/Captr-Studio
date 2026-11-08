import { describe, expect, it, vi } from "vitest";
import type { CameraTake } from "@/recording/cameraRecorder";
import {
	createMonologDialogController,
	type MonologDialogCallbacks,
	type MonologSessionPort,
} from "./monologDialogController";

const take: CameraTake = {
	blob: new Blob(["v"], { type: "video/webm" }),
	mimeType: "video/webm",
	extension: "webm",
	durationMs: 4000,
	hasAudio: true,
};

function fixture(options: { beginFails?: boolean; saveFails?: boolean } = {}) {
	const timers: Array<{ fn: () => void; ms: number; id: number }> = [];
	let nextTimer = 1;
	let now = 0;
	const session: MonologSessionPort = {
		listInputs: vi.fn(async () => ({
			cameras: [{ deviceId: "cam", label: "Cam" }],
			microphones: [{ deviceId: "mic", label: "Mic" }],
		})),
		openPreview: vi.fn(async ({ onLevel }) => {
			onLevel(0.5);
			return {
				stream: {} as MediaStream,
				settings: { width: 1920, height: 1080, frameRate: 30 },
			};
		}),
		start: vi.fn(),
		stop: vi.fn(async () => take),
		discard: vi.fn(async () => undefined),
		isRecording: vi.fn(() => false),
		dispose: vi.fn(async () => undefined),
	};
	const token = { id: "token" };
	const callbacks: MonologDialogCallbacks<typeof token> = {
		begin: vi.fn(async () => {
			if (options.beginFails) throw new Error("Finish the project file operation first.");
			return token;
		}),
		finalize: vi.fn(async () => {
			if (options.saveFails) throw new Error("disk full");
			return { assetId: "asset-1" };
		}),
		discard: vi.fn(async () => undefined),
		onSaved: vi.fn(),
		onClose: vi.fn(),
	};
	const controller = createMonologDialogController({
		session,
		callbacks,
		now: () => now,
		setTimer: (fn, ms) => {
			const id = nextTimer++;
			timers.push({ fn, ms, id });
			return id;
		},
		clearTimer: (id) => {
			const index = timers.findIndex((timer) => timer.id === id);
			if (index >= 0) timers.splice(index, 1);
		},
	});
	const runTimers = (count = 1) => {
		for (let i = 0; i < count; i++) timers.shift()?.fn();
	};
	return {
		controller,
		session,
		callbacks,
		token,
		runTimers,
		advance: (ms: number) => {
			now += ms;
		},
		state: () => controller.getSnapshot(),
	};
}

async function toRecording(f: ReturnType<typeof fixture>) {
	await f.controller.open();
	await f.controller.record();
	f.runTimers(3);
}

describe("monolog dialog controller", () => {
	it("opens devices and the 1080p preview", async () => {
		const f = fixture();
		await f.controller.open();
		expect(f.state()).toMatchObject({
			phase: "setup",
			cameras: [{ deviceId: "cam", label: "Cam" }],
			resolution: "1080p",
			level: 0.5,
			granted: { width: 1920, height: 1080, frameRate: 30 },
			mirror: true,
		});
		expect(f.session.openPreview).toHaveBeenCalledWith(
			expect.objectContaining({ cameraId: null, microphoneId: null, resolution: "1080p" }),
		);
	});

	it("reopens the preview when a device or resolution changes", async () => {
		const f = fixture();
		await f.controller.open();
		await f.controller.selectCamera("cam");
		await f.controller.selectResolution("720p");
		expect(f.session.openPreview).toHaveBeenLastCalledWith(
			expect.objectContaining({ cameraId: "cam", resolution: "720p" }),
		);
	});

	it("leases, counts down 3..1, then records", async () => {
		const f = fixture();
		await f.controller.open();
		await f.controller.record();
		expect(f.callbacks.begin).toHaveBeenCalledOnce();
		expect(f.state()).toMatchObject({ phase: "countdown", countdown: 3 });
		f.runTimers();
		expect(f.state().countdown).toBe(2);
		f.runTimers(2);
		expect(f.state().phase).toBe("recording");
		expect(f.session.start).toHaveBeenCalledOnce();
	});

	it("does not count down when the lease is refused", async () => {
		const f = fixture({ beginFails: true });
		await f.controller.open();
		await f.controller.record();
		expect(f.state()).toMatchObject({
			phase: "setup",
			error: expect.stringMatching(/file operation/),
		});
		expect(f.session.start).not.toHaveBeenCalled();
	});

	it("stops into review with the elapsed time", async () => {
		const f = fixture();
		await toRecording(f);
		f.advance(4000);
		await f.controller.stop();
		expect(f.state()).toMatchObject({ phase: "review", hasTake: true, elapsedMs: 4000 });
	});

	it("retake discards the take and the lease", async () => {
		const f = fixture();
		await toRecording(f);
		await f.controller.stop();
		await f.controller.retake();
		expect(f.callbacks.discard).toHaveBeenCalledWith(f.token);
		expect(f.callbacks.finalize).not.toHaveBeenCalled();
		expect(f.state()).toMatchObject({ phase: "setup", hasTake: false });
	});

	it("save registers the take and returns to setup", async () => {
		const f = fixture();
		await toRecording(f);
		await f.controller.stop();
		await f.controller.save();
		expect(f.callbacks.finalize).toHaveBeenCalledWith(f.token, take);
		expect(f.callbacks.onSaved).toHaveBeenCalledWith("asset-1");
		expect(f.state()).toMatchObject({ phase: "setup", hasTake: false });
	});

	it("keeps the take for retry when saving fails", async () => {
		const f = fixture({ saveFails: true });
		await toRecording(f);
		await f.controller.stop();
		await f.controller.save();
		expect(f.state()).toMatchObject({ phase: "review", hasTake: true, error: "disk full" });
	});

	it("cannot close while counting down or recording", async () => {
		const f = fixture();
		await f.controller.open();
		await f.controller.record();
		expect(f.controller.canClose()).toBe(false);
		await f.controller.close();
		expect(f.callbacks.onClose).not.toHaveBeenCalled();
		f.runTimers(3);
		await f.controller.close();
		expect(f.callbacks.onClose).not.toHaveBeenCalled();
	});

	it("closing from review discards the take and releases the camera", async () => {
		const f = fixture();
		await toRecording(f);
		await f.controller.stop();
		await f.controller.close();
		expect(f.callbacks.discard).toHaveBeenCalledWith(f.token);
		expect(f.session.dispose).toHaveBeenCalled();
		expect(f.callbacks.onClose).toHaveBeenCalled();
	});

	it("aborts the take when the camera fails mid-recording", async () => {
		const f = fixture();
		await toRecording(f);
		f.controller.reportCaptureError(new Error("The camera recording failed."));
		await Promise.resolve();
		await Promise.resolve();
		expect(f.state()).toMatchObject({ phase: "setup", error: "The camera recording failed." });
		expect(f.callbacks.discard).toHaveBeenCalledWith(f.token);
	});

	it("toggles the preview mirror", async () => {
		const f = fixture();
		await f.controller.open();
		f.controller.toggleMirror();
		expect(f.state().mirror).toBe(false);
	});
});
