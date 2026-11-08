import type {
	CameraInputDevice,
	CameraPreview,
	CameraRecorderSession,
	CameraResolution,
	CameraTake,
} from "@/recording/cameraRecorder";

export type MonologPhase = "setup" | "countdown" | "recording" | "review" | "saving";

export const MONOLOG_COUNTDOWN_SECONDS = 3;

export interface MonologDialogState {
	phase: MonologPhase;
	cameras: CameraInputDevice[];
	microphones: CameraInputDevice[];
	cameraId: string | null;
	microphoneId: string | null;
	resolution: CameraResolution;
	granted: CameraPreview["settings"] | null;
	stream: MediaStream | null;
	mirror: boolean;
	level: number;
	countdown: number;
	elapsedMs: number;
	hasTake: boolean;
	loading: boolean;
	error: string | null;
}

export type MonologSessionPort = Pick<
	CameraRecorderSession,
	"listInputs" | "openPreview" | "start" | "stop" | "discard" | "isRecording" | "dispose"
>;

export interface MonologDialogCallbacks<Token> {
	/** Takes the capture lease. Rejects when the project is busy. */
	begin(): Promise<Token>;
	finalize(token: Token, take: CameraTake): Promise<{ assetId: string } | null>;
	discard(token: Token): Promise<void>;
	onSaved(assetId: string): void;
	onClose(): void;
}

interface ControllerOptions<Token> {
	session: MonologSessionPort;
	callbacks: MonologDialogCallbacks<Token>;
	now?: () => number;
	setTimer?: (fn: () => void, ms: number) => number;
	clearTimer?: (id: number) => void;
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function createMonologDialogController<Token>(options: ControllerOptions<Token>) {
	const { session, callbacks } = options;
	const now = options.now ?? (() => performance.now());
	const setTimer = options.setTimer ?? ((fn, ms) => window.setTimeout(fn, ms));
	const clearTimer = options.clearTimer ?? ((id) => window.clearTimeout(id));
	const listeners = new Set<() => void>();
	let state: MonologDialogState = {
		phase: "setup",
		cameras: [],
		microphones: [],
		cameraId: null,
		microphoneId: null,
		resolution: "1080p",
		granted: null,
		stream: null,
		mirror: true,
		level: 0,
		countdown: 0,
		elapsedMs: 0,
		hasTake: false,
		loading: true,
		error: null,
	};
	let token: Token | null = null;
	let take: CameraTake | null = null;
	let timer: number | null = null;
	let startedAt = 0;
	let closed = false;

	const set = (patch: Partial<MonologDialogState>) => {
		state = { ...state, ...patch };
		for (const listener of listeners) listener();
	};
	const stopTimer = () => {
		if (timer !== null) clearTimer(timer);
		timer = null;
	};
	const releaseToken = async () => {
		const current = token;
		token = null;
		if (current !== null) await callbacks.discard(current).catch(() => undefined);
	};
	const openPreview = async () => {
		set({ loading: true, error: null });
		try {
			const preview = await session.openPreview({
				cameraId: state.cameraId,
				microphoneId: state.microphoneId,
				resolution: state.resolution,
				onLevel: (level) => {
					if (!closed) set({ level });
				},
			});
			if (!closed) set({ stream: preview.stream, granted: preview.settings, loading: false });
		} catch (error) {
			if (!closed) set({ stream: null, loading: false, error: message(error) });
		}
	};
	const tickElapsed = () => {
		set({ elapsedMs: Math.max(0, Math.round(now() - startedAt)) });
		timer = setTimer(tickElapsed, 250);
	};
	const beginRecording = () => {
		try {
			session.start();
		} catch (error) {
			set({ phase: "setup", error: message(error) });
			void releaseToken();
			return;
		}
		startedAt = now();
		set({ phase: "recording", countdown: 0, elapsedMs: 0 });
		timer = setTimer(tickElapsed, 250);
	};
	const countdownStep = (remaining: number) => {
		if (remaining <= 0) {
			timer = null;
			beginRecording();
			return;
		}
		set({ countdown: remaining });
		timer = setTimer(() => countdownStep(remaining - 1), 1000);
	};
	const editable = () => state.phase === "setup" && !state.loading;

	return {
		subscribe(listener: () => void) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		getSnapshot: () => state,

		async open() {
			try {
				const inputs = await session.listInputs();
				set({ cameras: inputs.cameras, microphones: inputs.microphones });
			} catch (error) {
				set({ error: message(error) });
			}
			await openPreview();
		},

		async selectCamera(cameraId: string | null) {
			if (state.phase !== "setup") return;
			set({ cameraId });
			await openPreview();
		},
		async selectMicrophone(microphoneId: string | null) {
			if (state.phase !== "setup") return;
			set({ microphoneId });
			await openPreview();
		},
		async selectResolution(resolution: CameraResolution) {
			if (state.phase !== "setup") return;
			set({ resolution });
			await openPreview();
		},
		toggleMirror() {
			set({ mirror: !state.mirror });
		},

		async record() {
			if (!editable() || !state.stream) return;
			set({ error: null });
			try {
				token = await callbacks.begin();
			} catch (error) {
				set({ error: message(error) });
				return;
			}
			if (closed) {
				await releaseToken();
				return;
			}
			set({ phase: "countdown", countdown: MONOLOG_COUNTDOWN_SECONDS, elapsedMs: 0 });
			timer = setTimer(() => countdownStep(MONOLOG_COUNTDOWN_SECONDS - 1), 1000);
		},

		async stop() {
			if (state.phase === "countdown") {
				stopTimer();
				await releaseToken();
				set({ phase: "setup", countdown: 0 });
				return;
			}
			if (state.phase !== "recording") return;
			stopTimer();
			const elapsedMs = Math.max(0, Math.round(now() - startedAt));
			try {
				take = await session.stop();
				set({ phase: "review", hasTake: true, elapsedMs });
			} catch (error) {
				take = null;
				await releaseToken();
				set({ phase: "setup", hasTake: false, error: message(error) });
			}
		},

		async retake() {
			if (state.phase !== "review") return;
			take = null;
			await releaseToken();
			set({ phase: "setup", hasTake: false, elapsedMs: 0, error: null });
		},

		async save() {
			if (state.phase !== "review" || !take || token === null) return;
			const current = token;
			set({ phase: "saving", error: null });
			try {
				const result = await callbacks.finalize(current, take);
				token = null;
				take = null;
				set({ phase: "setup", hasTake: false, elapsedMs: 0 });
				if (result) callbacks.onSaved(result.assetId);
			} catch (error) {
				// The lease was released by finalize; take a fresh one on retry.
				token = null;
				try {
					token = await callbacks.begin();
				} catch {
					// Without a lease the take can still be retried later.
				}
				set({ phase: "review", error: message(error) });
			}
		},

		/** Called when a camera/mic track ends or the recorder errors mid-take. */
		reportCaptureError(error: unknown) {
			if (state.phase !== "recording" && state.phase !== "countdown") return;
			stopTimer();
			take = null;
			void session.discard().catch(() => undefined);
			void releaseToken();
			set({ phase: "setup", hasTake: false, countdown: 0, error: message(error) });
		},

		canClose: () => state.phase === "setup" || state.phase === "review",
		isCapturing: () => state.phase !== "setup",

		async close() {
			if (state.phase !== "setup" && state.phase !== "review") return;
			closed = true;
			stopTimer();
			take = null;
			await releaseToken();
			await session.dispose();
			callbacks.onClose();
		},

		dispose() {
			closed = true;
			stopTimer();
			take = null;
			void session.discard().catch(() => undefined);
			void releaseToken();
			void session.dispose();
		},
	};
}

export type MonologDialogController<Token> = ReturnType<
	typeof createMonologDialogController<Token>
>;

export function formatMonologTime(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(total / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	const seconds = total % 60;
	const pad = (value: number) => String(value).padStart(2, "0");
	return hours > 0
		? `${hours}:${pad(minutes)}:${pad(seconds)}`
		: `${pad(minutes)}:${pad(seconds)}`;
}
