import {
	getVideoExtensionForMimeType,
	isWebmMimeType,
	selectWebcamRecordingMimeType,
} from "@/hooks/recordingMimeType";
import type { AudioRecorderLike } from "./audioRecorder";

export interface CameraInputDevice {
	deviceId: string;
	label: string;
}

export type CameraResolution = "1080p" | "720p" | "480p";

export const CAMERA_RESOLUTIONS: Record<CameraResolution, { width: number; height: number }> = {
	"1080p": { width: 1920, height: 1080 },
	"720p": { width: 1280, height: 720 },
	"480p": { width: 854, height: 480 },
};

export interface CameraTake {
	blob: Blob;
	mimeType: string;
	extension: "mp4" | "webm";
	durationMs: number;
	hasAudio: boolean;
}

export interface CameraPreview {
	stream: MediaStream;
	settings: { width?: number; height?: number; frameRate?: number };
}

interface AudioContextLike {
	state?: string;
	createAnalyser(): {
		fftSize: number;
		frequencyBinCount: number;
		getByteFrequencyData(data: Uint8Array): void;
	};
	createMediaStreamSource(stream: MediaStream): { connect(destination: unknown): unknown };
	resume?(): Promise<void>;
	close(): Promise<void>;
}

export interface CameraRecorderEnvironment {
	mediaDevices?: Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;
	isTypeSupported?: (mimeType: string) => boolean;
	canPlayType?: (mimeType: string) => string;
	fixWebmDuration?: (blob: Blob, durationMs: number) => Promise<Blob>;
	createRecorder?: (stream: MediaStream, mimeType: string) => AudioRecorderLike;
	createAudioContext?: () => AudioContextLike;
	now?: () => number;
	requestAnimationFrame?: (callback: FrameRequestCallback) => number;
	cancelAnimationFrame?: (handle: number) => void;
}

interface OpenPreviewOptions {
	cameraId: string | null;
	microphoneId: string | null;
	resolution: CameraResolution;
	onLevel: (level: number) => void;
}

interface PreviewState {
	stream: MediaStream;
	audioContext: AudioContextLike | null;
	frameId: number | null;
	onLevel: (level: number) => void;
}

interface ActiveTake {
	recorder: AudioRecorderLike;
	mimeType: string;
	chunks: Blob[];
	startedAt: number;
	discard: boolean;
	completion: Promise<CameraTake | null>;
}

/** Chunk interval so MediaRecorder flushes data regularly instead of holding one huge buffer. */
const TIMESLICE_MS = 1000;

function readableMediaError(error: unknown): Error {
	const name = (error as { name?: string } | null)?.name;
	if (name === "NotAllowedError" || name === "SecurityError")
		return new Error("Camera or microphone permission was denied.");
	if (name === "NotFoundError" || name === "OverconstrainedError")
		return new Error("The selected camera or microphone is not available.");
	if (name === "NotReadableError")
		return new Error("The camera or microphone is already in use by another app.");
	return error instanceof Error ? error : new Error(String(error));
}

function stopStream(stream: MediaStream) {
	for (const track of stream.getTracks()) {
		try {
			track.stop();
		} catch {
			// Keep releasing the remaining tracks.
		}
	}
}

/**
 * Camera + microphone capture for Monolog takes. A preview stream stays open between takes so
 * the narrator can retake without re-requesting devices; `start` records that same stream.
 */
export function createCameraRecorderSession(environment: CameraRecorderEnvironment = {}) {
	let preview: PreviewState | null = null;
	let take: ActiveTake | null = null;
	let opening = false;
	let disposed = false;
	const now = environment.now ?? (() => performance.now());
	const requestFrame =
		environment.requestAnimationFrame ?? ((callback) => requestAnimationFrame(callback));
	const cancelFrame = environment.cancelAnimationFrame ?? ((id) => cancelAnimationFrame(id));
	const mediaDevices = () => {
		const devices =
			environment.mediaDevices ??
			(typeof navigator !== "undefined" ? navigator.mediaDevices : undefined);
		if (!devices) throw new Error("Camera access is unavailable in this environment.");
		return devices;
	};
	const fixDuration =
		environment.fixWebmDuration ??
		(async (blob: Blob, durationMs: number) =>
			(await import("@fix-webm-duration/fix")).fixWebmDuration(blob, durationMs));

	const closePreviewState = async (state: PreviewState) => {
		if (state.frameId !== null) cancelFrame(state.frameId);
		state.frameId = null;
		stopStream(state.stream);
		await state.audioContext?.close().catch(() => undefined);
		state.onLevel(0);
	};

	const startMeter = (state: PreviewState) => {
		if (!state.stream.getAudioTracks().length) return;
		const audioContext = environment.createAudioContext
			? environment.createAudioContext()
			: (new AudioContext() as unknown as AudioContextLike);
		state.audioContext = audioContext;
		if (audioContext.state === "suspended") void audioContext.resume?.();
		const analyser = audioContext.createAnalyser();
		analyser.fftSize = 256;
		audioContext.createMediaStreamSource(state.stream).connect(analyser);
		const data = new Uint8Array(analyser.frequencyBinCount);
		const update = () => {
			if (preview !== state) return;
			try {
				analyser.getByteFrequencyData(data);
				let total = 0;
				for (const value of data) total += value;
				state.onLevel(Math.min(1, total / data.length / 128));
			} catch {
				state.onLevel(0);
			}
			state.frameId = requestFrame(update);
		};
		state.frameId = requestFrame(update);
	};

	const selectMimeType = () => {
		const isTypeSupported =
			environment.isTypeSupported ??
			(typeof MediaRecorder !== "undefined"
				? (type: string) => MediaRecorder.isTypeSupported(type)
				: undefined);
		if (!isTypeSupported) throw new Error("Video recording is unavailable in this browser.");
		const mimeType = selectWebcamRecordingMimeType({
			isTypeSupported,
			...(environment.canPlayType ? { canPlayType: environment.canPlayType } : {}),
		});
		if (!mimeType) throw new Error("No supported video recording format is available.");
		return mimeType;
	};

	return {
		async listInputs(): Promise<{
			cameras: CameraInputDevice[];
			microphones: CameraInputDevice[];
		}> {
			const devices = await mediaDevices().enumerateDevices();
			const pick = (kind: MediaDeviceKind, fallback: string) =>
				devices
					.filter((device) => device.kind === kind)
					.map((device, index) => ({
						deviceId: device.deviceId,
						label: device.label.trim() || `${fallback} ${index + 1}`,
					}));
			return {
				cameras: pick("videoinput", "Camera"),
				microphones: pick("audioinput", "Microphone"),
			};
		},

		async openPreview(options: OpenPreviewOptions): Promise<CameraPreview> {
			if (disposed) throw new Error("This camera recorder has been closed.");
			if (take) throw new Error("Cannot change devices while recording.");
			if (opening) throw new Error("The camera is already opening.");
			opening = true;
			try {
				const size = CAMERA_RESOLUTIONS[options.resolution];
				let stream: MediaStream;
				try {
					stream = await mediaDevices().getUserMedia({
						video: {
							...(options.cameraId ? { deviceId: { exact: options.cameraId } } : {}),
							width: { ideal: size.width },
							height: { ideal: size.height },
							frameRate: { ideal: 30 },
						},
						audio: {
							...(options.microphoneId
								? { deviceId: { exact: options.microphoneId } }
								: {}),
							echoCancellation: true,
							noiseSuppression: true,
							autoGainControl: true,
						},
					});
				} catch (error) {
					throw readableMediaError(error);
				}
				if (disposed) {
					stopStream(stream);
					throw new Error("This camera recorder has been closed.");
				}
				if (preview) await closePreviewState(preview);
				const state: PreviewState = {
					stream,
					audioContext: null,
					frameId: null,
					onLevel: options.onLevel,
				};
				preview = state;
				try {
					startMeter(state);
				} catch {
					// The meter is optional; recording still works without it.
				}
				const granted = stream.getVideoTracks()[0]?.getSettings?.() ?? {};
				return {
					stream,
					settings: {
						width: granted.width,
						height: granted.height,
						frameRate: granted.frameRate,
					},
				};
			} finally {
				opening = false;
			}
		},

		start(): void {
			if (disposed) throw new Error("This camera recorder has been closed.");
			if (take) throw new Error("Camera recording is already active.");
			if (!preview) throw new Error("Open the camera preview before recording.");
			const stream = preview.stream;
			const mimeType = selectMimeType();
			const recorder = environment.createRecorder
				? environment.createRecorder(stream, mimeType)
				: (new MediaRecorder(stream, { mimeType }) as unknown as AudioRecorderLike);
			const hasAudio = stream.getAudioTracks().length > 0;
			let resolve!: (value: CameraTake | null) => void;
			let reject!: (error: Error) => void;
			const completion = new Promise<CameraTake | null>((res, rej) => {
				resolve = res;
				reject = rej;
			});
			completion.catch(() => undefined);
			const active: ActiveTake = {
				recorder,
				mimeType,
				chunks: [],
				startedAt: now(),
				discard: false,
				completion,
			};
			take = active;
			recorder.ondataavailable = (event) => {
				if (event.data?.size) active.chunks.push(event.data);
			};
			recorder.onerror = () => {
				if (take === active) take = null;
				reject(new Error("The camera recording failed."));
			};
			recorder.onstop = () => {
				const durationMs = Math.max(0, Math.round(now() - active.startedAt));
				if (take === active) take = null;
				if (active.discard) {
					active.chunks.length = 0;
					resolve(null);
					return;
				}
				const blob = new Blob(active.chunks, { type: mimeType });
				active.chunks.length = 0;
				if (blob.size === 0) {
					reject(new Error("No video was captured."));
					return;
				}
				const finish = isWebmMimeType(mimeType)
					? fixDuration(blob, durationMs)
					: Promise.resolve(blob);
				finish.then(
					(fixed) =>
						resolve({
							blob: fixed,
							mimeType,
							extension:
								getVideoExtensionForMimeType(mimeType) === ".mp4" ? "mp4" : "webm",
							durationMs,
							hasAudio,
						}),
					(error) => reject(error instanceof Error ? error : new Error(String(error))),
				);
			};
			(recorder.start as (timeslice?: number) => void)(TIMESLICE_MS);
		},

		async stop(): Promise<CameraTake> {
			const active = take;
			if (!active || active.discard) throw new Error("Camera recording is not active.");
			active.recorder.stop();
			const result = await active.completion;
			if (!result) throw new Error("The camera recording was discarded.");
			return result;
		},

		async discard(): Promise<void> {
			const active = take;
			if (!active) return;
			active.discard = true;
			try {
				if (active.recorder.state !== "inactive") active.recorder.stop();
				else take = null;
			} catch {
				take = null;
			}
			await active.completion.catch(() => null);
			if (take === active) take = null;
		},

		isRecording(): boolean {
			return take !== null;
		},

		async closePreview(): Promise<void> {
			await this.discard();
			const state = preview;
			preview = null;
			if (state) await closePreviewState(state);
		},

		async dispose(): Promise<void> {
			disposed = true;
			await this.closePreview();
		},
	};
}

export type CameraRecorderSession = ReturnType<typeof createCameraRecorderSession>;
