import type { AudioInputDevice, RecordedAudioTake } from "@/recording/audioRecorder";

export type AudioRecorderNavigationChoice = "finish" | "discard" | "stay";

export interface AudioRecorderSessionPort {
	listInputs(): Promise<AudioInputDevice[]>;
	start(options: {
		deviceId: string | null;
		startUs: number;
		onLevel: (level: number) => void;
	}): Promise<void>;
	stop(): Promise<RecordedAudioTake>;
	discard(): Promise<void>;
	dispose(): void;
}

export interface AudioRecorderDialogCallbacks {
	onPreviewStart(): Promise<void> | void;
	onPreviewPause(): Promise<void> | void;
	onTakeRecorded(take: RecordedAudioTake): Promise<void>;
	onDiscard(take?: RecordedAudioTake): Promise<void>;
	onNavigationChoice(choice: AudioRecorderNavigationChoice): Promise<void> | void;
	onRecordingChange?(recording: boolean): void;
	onClose(): void;
}

export interface AudioRecorderDialogState {
	devices: AudioInputDevice[];
	selectedDeviceId: string | null;
	loadingInputs: boolean;
	recording: boolean;
	finalizing: boolean;
	elapsedMs: number;
	level: number;
	take: RecordedAudioTake | null;
	error: string | null;
	navigationRequested: boolean;
}

export interface AudioRecorderDialogControllerOptions {
	startUs: number;
	session: AudioRecorderSessionPort;
	callbacks: AudioRecorderDialogCallbacks;
	now?: () => number;
	setInterval?: typeof globalThis.setInterval;
	clearInterval?: typeof globalThis.clearInterval;
}

const initialState: AudioRecorderDialogState = {
	devices: [],
	selectedDeviceId: null,
	loadingInputs: true,
	recording: false,
	finalizing: false,
	elapsedMs: 0,
	level: 0,
	take: null,
	error: null,
	navigationRequested: false,
};

export function formatAudioRecorderTime(durationMs: number): string {
	const totalSeconds = Math.floor(Math.max(0, durationMs) / 1_000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function createAudioRecorderDialogController(options: AudioRecorderDialogControllerOptions) {
	let state = { ...initialState };
	let recordingStartedAt = 0;
	let timer: ReturnType<typeof globalThis.setInterval> | null = null;
	let disposed = false;
	const listeners = new Set<() => void>();
	const now = options.now ?? (() => performance.now());
	const setIntervalFn = options.setInterval ?? globalThis.setInterval.bind(globalThis);
	const clearIntervalFn = options.clearInterval ?? globalThis.clearInterval.bind(globalThis);

	const update = (patch: Partial<AudioRecorderDialogState>) => {
		state = { ...state, ...patch };
		for (const listener of listeners) listener();
	};
	const setError = (error: unknown) =>
		update({ error: error instanceof Error ? error.message : String(error) });
	const clearTimer = () => {
		if (timer === null) return;
		clearIntervalFn(timer);
		timer = null;
	};
	const pausePreview = async () => {
		try {
			await options.callbacks.onPreviewPause();
		} catch (error) {
			setError(error);
		}
	};

	const finishTake = async (take: RecordedAudioTake): Promise<boolean> => {
		update({ finalizing: true, error: null, take });
		try {
			await options.callbacks.onTakeRecorded(take);
			update({ finalizing: false, error: null, take: null, level: 0 });
			if (state.navigationRequested) {
				await options.callbacks.onNavigationChoice("finish");
				update({ navigationRequested: false });
			} else {
				options.callbacks.onClose();
			}
			return true;
		} catch (error) {
			setError(error);
			update({ finalizing: false, take, level: 0 });
			return false;
		}
	};

	const discardTake = async (): Promise<boolean> => {
		const wasRecording = state.recording;
		const pendingTake = state.take ?? undefined;
		clearTimer();
		update({ recording: false, finalizing: true, level: 0, error: null });
		options.callbacks.onRecordingChange?.(false);
		try {
			await options.session.discard();
			if (wasRecording) await pausePreview();
			await options.callbacks.onDiscard(pendingTake);
			update({ finalizing: false, take: null, elapsedMs: 0, level: 0, error: null });
			if (state.navigationRequested) {
				await options.callbacks.onNavigationChoice("discard");
				update({ navigationRequested: false });
			} else {
				options.callbacks.onClose();
			}
			return true;
		} catch (error) {
			setError(error);
			update({ finalizing: false, recording: false, take: pendingTake ?? null });
			return false;
		}
	};

	return {
		getSnapshot: () => state,
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		async loadInputs() {
			update({ loadingInputs: true, error: null });
			try {
				const devices = await options.session.listInputs();
				const selectedDeviceId = devices.some(
					(device) => device.deviceId === state.selectedDeviceId,
				)
					? state.selectedDeviceId
					: (devices[0]?.deviceId ?? null);
				update({ devices, selectedDeviceId, loadingInputs: false });
			} catch (error) {
				setError(error);
				update({ loadingInputs: false });
			}
		},
		selectDevice(deviceId: string | null) {
			if (state.recording || state.finalizing) return;
			update({ selectedDeviceId: deviceId, error: null });
		},
		async start(): Promise<boolean> {
			if (disposed || state.recording || state.finalizing) return false;
			update({ error: null, elapsedMs: 0, level: 0 });
			try {
				await options.session.start({
					deviceId: state.selectedDeviceId,
					startUs: options.startUs,
					onLevel: (level) => update({ level: Math.max(0, Math.min(1, level)) }),
				});
				update({ recording: true });
				options.callbacks.onRecordingChange?.(true);
				await options.callbacks.onPreviewStart();
				recordingStartedAt = now();
				timer = setIntervalFn(() => {
					update({ elapsedMs: Math.max(0, Math.round(now() - recordingStartedAt)) });
				}, 100);
				return true;
			} catch (error) {
				if (state.recording) {
					clearTimer();
					await options.session.discard().catch(() => undefined);
					await pausePreview();
					options.callbacks.onRecordingChange?.(false);
				}
				update({ recording: false, level: 0 });
				setError(error);
				return false;
			}
		},
		async stop(): Promise<boolean> {
			if (!state.recording || state.finalizing) return false;
			clearTimer();
			update({ recording: false, finalizing: true, level: 0, error: null });
			options.callbacks.onRecordingChange?.(false);
			let take: RecordedAudioTake;
			try {
				take = await options.session.stop();
			} catch (error) {
				await pausePreview();
				update({ finalizing: false });
				setError(error);
				return false;
			}
			await pausePreview();
			update({ finalizing: false, take });
			return finishTake(take);
		},
		async retry(): Promise<boolean> {
			if (!state.take || state.finalizing) return false;
			return finishTake(state.take);
		},
		async discard(): Promise<boolean> {
			if (disposed || state.finalizing) return false;
			return discardTake();
		},
		requestNavigation() {
			update({ navigationRequested: true });
		},
		setNavigationRequested(requested: boolean) {
			update({ navigationRequested: requested });
		},
		async resolveNavigation(choice: AudioRecorderNavigationChoice): Promise<boolean> {
			if (choice === "stay") {
				update({ navigationRequested: false });
				await options.callbacks.onNavigationChoice("stay");
				return true;
			}
			if (choice === "finish") {
				if (state.recording) return this.stop();
				if (state.take) return this.retry();
				await options.callbacks.onNavigationChoice("finish");
				update({ navigationRequested: false });
				return true;
			}
			return discardTake();
		},
		close() {
			if (state.recording || state.finalizing) {
				update({ navigationRequested: true });
				return;
			}
			options.callbacks.onClose();
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			clearTimer();
			if (state.recording) {
				options.callbacks.onRecordingChange?.(false);
				void Promise.resolve()
					.then(() => options.callbacks.onPreviewPause())
					.catch(() => undefined);
			}
			options.session.dispose();
			listeners.clear();
		},
	};
}
