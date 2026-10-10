import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import type { AudioInputDevice, RecordedAudioTake } from "@/recording/audioRecorder";
import { AudioRecorderDialog } from "./AudioRecorderDialog";
import {
	type AudioRecorderDialogCallbacks,
	type AudioRecorderSessionPort,
	createAudioRecorderDialogController,
} from "./audioRecorderDialogController";

function createFixture(options?: { permissionError?: string; saveErrors?: number }) {
	const take: RecordedAudioTake = {
		blob: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm;codecs=opus" }),
		mimeType: "audio/webm;codecs=opus",
		extension: "webm",
		durationMs: 1_500,
		startUs: 7_000_000,
	};
	const devices: AudioInputDevice[] = [
		{ deviceId: "mic-1", label: "Desk mic" },
		{ deviceId: "mic-2", label: "USB mic" },
	];
	let levelCallback: ((level: number) => void) | undefined;
	let intervalCallback: (() => void) | undefined;
	let now = 1_000;
	let saveErrors = options?.saveErrors ?? 0;
	const session: AudioRecorderSessionPort = {
		listInputs: vi.fn(async () => devices),
		start: vi.fn(async ({ onLevel }) => {
			if (options?.permissionError) throw new Error(options.permissionError);
			levelCallback = onLevel;
			onLevel(0.65);
		}),
		stop: vi.fn(async () => take),
		discard: vi.fn(async () => undefined),
		dispose: vi.fn(),
	};
	const callbacks: AudioRecorderDialogCallbacks = {
		onPreviewStart: vi.fn(async () => undefined),
		onPreviewPause: vi.fn(async () => undefined),
		onTakeRecorded: vi.fn(async () => {
			if (saveErrors > 0) {
				saveErrors -= 1;
				throw new Error("Could not save take");
			}
		}),
		onDiscard: vi.fn(async () => undefined),
		onNavigationChoice: vi.fn(async () => undefined),
		onRecordingChange: vi.fn(),
		onClose: vi.fn(),
	};
	const controller = createAudioRecorderDialogController({
		startUs: 7_000_000,
		session,
		callbacks,
		now: () => now,
		setInterval: (callback) => {
			intervalCallback = callback;
			return 7 as unknown as ReturnType<typeof setInterval>;
		},
		clearInterval: vi.fn(),
	});
	return {
		controller,
		session,
		callbacks,
		take,
		devices,
		getNow: () => now,
		setNow: (value: number) => {
			now = value;
		},
		tick: () => intervalCallback?.(),
		emitLevel: (value: number) => levelCallback?.(value),
	};
}

describe("AudioRecorderDialogController", () => {
	it("waits for a kept Story take to finalize before continuing Finish navigation", async () => {
		const fixture = createFixture();
		let finishKeep!: () => void;
		vi.mocked(fixture.callbacks.onTakeRecorded).mockImplementation(
			() =>
				new Promise((resolve) => {
					finishKeep = resolve;
				}),
		);
		await fixture.controller.loadInputs();
		await fixture.controller.start();
		fixture.controller.requestNavigation();
		const completion = fixture.controller.resolveNavigation("finish");
		await vi.waitFor(() => expect(finishKeep).toBeDefined());
		expect(fixture.controller.getSnapshot().finalizing).toBe(true);
		expect(fixture.callbacks.onNavigationChoice).not.toHaveBeenCalled();
		finishKeep();
		await completion;
		expect(fixture.callbacks.onNavigationChoice).toHaveBeenCalledWith("finish");
	});
	it("loads microphone inputs and anchors capture with the selected device", async () => {
		const fixture = createFixture();
		await fixture.controller.loadInputs();
		fixture.controller.selectDevice("mic-2");
		await fixture.controller.start();

		expect(fixture.session.start).toHaveBeenCalledWith(
			expect.objectContaining({ deviceId: "mic-2", startUs: 7_000_000 }),
		);
		expect(fixture.callbacks.onPreviewStart).toHaveBeenCalledOnce();
		expect(fixture.controller.getSnapshot()).toMatchObject({
			devices: fixture.devices,
			selectedDeviceId: "mic-2",
			recording: true,
			level: 0.65,
		});
	});

	it("updates elapsed time from a monotonic clock while recording", async () => {
		const fixture = createFixture();
		await fixture.controller.loadInputs();
		await fixture.controller.start();
		fixture.setNow(2_750);
		fixture.tick();

		expect(fixture.controller.getSnapshot().elapsedMs).toBe(1_750);
	});

	it("stops the microphone, pauses preview and registers the finalized take", async () => {
		const fixture = createFixture();
		await fixture.controller.loadInputs();
		await fixture.controller.start();

		await expect(fixture.controller.stop()).resolves.toBe(true);
		expect(fixture.session.stop).toHaveBeenCalledOnce();
		expect(fixture.callbacks.onPreviewPause).toHaveBeenCalledOnce();
		expect(fixture.callbacks.onTakeRecorded).toHaveBeenCalledWith(fixture.take);
		expect(fixture.callbacks.onClose).toHaveBeenCalledOnce();
		expect(fixture.controller.getSnapshot()).toMatchObject({ recording: false, take: null });
	});

	it("keeps a take available for retry when saving it fails", async () => {
		const fixture = createFixture({ saveErrors: 1 });
		await fixture.controller.loadInputs();
		await fixture.controller.start();

		await expect(fixture.controller.stop()).resolves.toBe(false);
		expect(fixture.controller.getSnapshot()).toMatchObject({
			take: fixture.take,
			error: "Could not save take",
		});
		await expect(fixture.controller.retry()).resolves.toBe(true);
		expect(fixture.callbacks.onTakeRecorded).toHaveBeenCalledTimes(2);
	});

	it("discards an active take and pauses preview without registering it", async () => {
		const fixture = createFixture();
		await fixture.controller.loadInputs();
		await fixture.controller.start();

		await fixture.controller.discard();
		expect(fixture.session.discard).toHaveBeenCalledOnce();
		expect(fixture.callbacks.onPreviewPause).toHaveBeenCalledOnce();
		expect(fixture.callbacks.onDiscard).toHaveBeenCalledWith(undefined);
		expect(fixture.callbacks.onTakeRecorded).not.toHaveBeenCalled();
	});

	it("surfaces microphone permission errors without starting preview", async () => {
		const fixture = createFixture({ permissionError: "Permission denied" });
		await fixture.controller.loadInputs();

		await expect(fixture.controller.start()).resolves.toBe(false);
		expect(fixture.controller.getSnapshot().error).toBe("Permission denied");
		expect(fixture.callbacks.onPreviewStart).not.toHaveBeenCalled();
		expect(fixture.controller.getSnapshot().recording).toBe(false);
	});

	it("routes finish, discard and stay choices during project navigation", async () => {
		const finish = createFixture();
		await finish.controller.loadInputs();
		await finish.controller.start();
		finish.controller.requestNavigation();
		await finish.controller.resolveNavigation("finish");
		expect(finish.session.stop).toHaveBeenCalledOnce();
		expect(finish.callbacks.onNavigationChoice).toHaveBeenCalledWith("finish");

		const discard = createFixture();
		await discard.controller.loadInputs();
		await discard.controller.start();
		discard.controller.requestNavigation();
		await discard.controller.resolveNavigation("discard");
		expect(discard.session.discard).toHaveBeenCalledOnce();
		expect(discard.callbacks.onNavigationChoice).toHaveBeenCalledWith("discard");

		const stay = createFixture();
		await stay.controller.loadInputs();
		await stay.controller.start();
		stay.controller.requestNavigation();
		await stay.controller.resolveNavigation("stay");
		expect(stay.callbacks.onNavigationChoice).toHaveBeenCalledWith("stay");
		expect(stay.controller.getSnapshot().recording).toBe(true);
	});

	it("disposes an active session and pauses preview when the dialog unmounts", async () => {
		const fixture = createFixture();
		await fixture.controller.loadInputs();
		await fixture.controller.start();

		fixture.controller.dispose();
		await Promise.resolve();
		expect(fixture.session.dispose).toHaveBeenCalledOnce();
		expect(fixture.callbacks.onPreviewPause).toHaveBeenCalledOnce();
		expect(fixture.callbacks.onRecordingChange).toHaveBeenLastCalledWith(false);
	});
});

it("renders an accessible standalone recorder dialog", () => {
	const markup = renderToStaticMarkup(
		createElement(
			I18nProvider,
			null,
			createElement(AudioRecorderDialog, {
				startUs: 0,
				navigationRequested: false,
				onPreviewStart: () => undefined,
				onPreviewPause: () => undefined,
				onTakeRecorded: async () => undefined,
				onDiscard: async () => undefined,
				onNavigationChoice: () => undefined,
				onRecordingChange: () => undefined,
				onClose: () => undefined,
			}),
		),
	);

	expect(markup).toContain('role="dialog"');
	expect(markup).toContain('aria-modal="true"');
	expect(markup).toContain('aria-label="Microphone input level"');
	expect(markup).toContain("Record Audio");
});
