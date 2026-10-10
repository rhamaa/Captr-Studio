export interface AudioRecorderInputDevice {
	deviceId: string;
	label: string;
	groupId?: string;
}

export interface RecordedAudioTake {
	blob: Blob;
	mimeType: string;
	extension: string;
	durationMs: number;
	startUs: number;
}

export interface AudioRecorderLike {
	state: string;
	ondataavailable: ((event: { data: Blob }) => void) | null;
	onerror: ((event: unknown) => void) | null;
	onstop: (() => void) | null;
	start(): void;
	stop(): void;
}

interface AudioAnalyserLike {
	fftSize: number;
	frequencyBinCount: number;
	getByteFrequencyData(data: Uint8Array): void;
}

interface AudioContextLike {
	state?: string;
	createAnalyser(): AudioAnalyserLike;
	createMediaStreamSource(stream: MediaStream): {
		connect(destination: AudioAnalyserLike): unknown;
	};
	resume?(): Promise<void>;
	close(): Promise<void>;
}

export interface AudioRecorderEnvironment {
	mediaDevices?: Pick<MediaDevices, "enumerateDevices" | "getUserMedia">;
	isTypeSupported?: (mimeType: string) => boolean;
	createRecorder?: (stream: MediaStream, mimeType: string) => AudioRecorderLike;
	createAudioContext?: () => AudioContextLike;
	now?: () => number;
	requestAnimationFrame?: (callback: FrameRequestCallback) => number;
	cancelAnimationFrame?: (handle: number) => void;
}

export type AudioInputDevice = AudioRecorderInputDevice;

const AUDIO_FORMATS = [
	{ mimeType: "audio/webm;codecs=opus", extension: "webm" },
	{ mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
	{ mimeType: "audio/mp4;codecs=mp4a.40.2", extension: "m4a" },
	{ mimeType: "audio/mp4", extension: "m4a" },
	{ mimeType: "audio/webm", extension: "webm" },
	{ mimeType: "audio/ogg", extension: "ogg" },
	{ mimeType: "audio/wav", extension: "wav" },
	{ mimeType: "audio/mpeg", extension: "mp3" },
] as const;

interface ActiveCapture {
	stream: MediaStream;
	recorder: AudioRecorderLike;
	audioContext: AudioContextLike;
	analyser: AudioAnalyserLike;
	chunks: Blob[];
	format: (typeof AUDIO_FORMATS)[number];
	startUs: number;
	startedAt: number;
	onLevel: (level: number) => void;
	frameId: number | null;
	discardRequested: boolean;
	stopping: boolean;
	completion: Promise<RecordedAudioTake | null>;
	resolveCompletion: (take: RecordedAudioTake | null) => void;
	rejectCompletion: (error: Error) => void;
	completionSettled: boolean;
	cleanupPromise: Promise<void> | null;
}

function getMediaDevices(environment: AudioRecorderEnvironment) {
	const mediaDevices =
		environment.mediaDevices ??
		(typeof navigator !== "undefined" ? navigator.mediaDevices : undefined);
	if (!mediaDevices) throw new Error("Microphone access is unavailable in this environment.");
	return mediaDevices;
}

function getAudioContext(environment: AudioRecorderEnvironment): AudioContextLike {
	if (environment.createAudioContext) return environment.createAudioContext();
	const globalWithWebkit = globalThis as typeof globalThis & {
		webkitAudioContext?: typeof AudioContext;
	};
	const ContextConstructor =
		typeof AudioContext !== "undefined" ? AudioContext : globalWithWebkit.webkitAudioContext;
	if (!ContextConstructor) throw new Error("Microphone level monitoring is unavailable.");
	return new ContextConstructor() as unknown as AudioContextLike;
}

function getSupportedFormat(environment: AudioRecorderEnvironment) {
	let isSupported = environment.isTypeSupported;
	if (!isSupported && typeof MediaRecorder !== "undefined")
		isSupported = (mimeType) => MediaRecorder.isTypeSupported(mimeType);
	if (!isSupported) throw new Error("Audio recording is unavailable in this browser.");
	for (const format of AUDIO_FORMATS) {
		try {
			if (isSupported(format.mimeType)) return format;
		} catch {
			// Ignore a runtime format probe failure and try the next supported container.
		}
	}
	throw new Error("No supported audio recording format is available.");
}

function createRecorder(
	environment: AudioRecorderEnvironment,
	stream: MediaStream,
	mimeType: string,
): AudioRecorderLike {
	if (environment.createRecorder) return environment.createRecorder(stream, mimeType);
	if (typeof MediaRecorder === "undefined")
		throw new Error("Audio recording is unavailable in this browser.");
	return new MediaRecorder(stream, { mimeType }) as unknown as AudioRecorderLike;
}

export function createAudioRecorderSession(environment: AudioRecorderEnvironment = {}) {
	let activeCapture: ActiveCapture | null = null;
	let starting = false;
	let disposed = false;
	const now = environment.now ?? (() => performance.now());
	const requestFrame =
		environment.requestAnimationFrame ??
		((callback: FrameRequestCallback) => requestAnimationFrame(callback));
	const cancelFrame =
		environment.cancelAnimationFrame ?? ((frameId: number) => cancelAnimationFrame(frameId));

	const cleanup = async (capture: ActiveCapture) => {
		if (capture.cleanupPromise) return capture.cleanupPromise;
		capture.cleanupPromise = (async () => {
			if (capture.frameId !== null) {
				cancelFrame(capture.frameId);
				capture.frameId = null;
			}
			for (const track of capture.stream.getTracks()) {
				try {
					track.stop();
				} catch {
					// Continue releasing the other tracks if one browser track fails to stop.
				}
			}
			try {
				await capture.audioContext.close();
			} catch {
				// Closing a context twice or after a device error can reject in some browsers.
			}
			capture.onLevel(0);
			if (activeCapture === capture) activeCapture = null;
		})();
		return capture.cleanupPromise;
	};

	const settle = (capture: ActiveCapture, take: RecordedAudioTake | null, error?: Error) => {
		if (capture.completionSettled) return;
		capture.completionSettled = true;
		if (error) capture.rejectCompletion(error);
		else capture.resolveCompletion(take);
	};

	const stopTracks = (stream: MediaStream) => {
		for (const track of stream.getTracks()) {
			try {
				track.stop();
			} catch {
				// Best-effort cleanup after setup errors.
			}
		}
	};

	return {
		async listInputs(): Promise<AudioInputDevice[]> {
			const devices = await getMediaDevices(environment).enumerateDevices();
			return devices
				.filter((device) => device.kind === "audioinput")
				.map((device, index) => ({
					deviceId: device.deviceId,
					label: device.label.trim() || `Microphone ${index + 1}`,
					...(device.groupId ? { groupId: device.groupId } : {}),
				}));
		},

		async start(options: {
			deviceId: string | null;
			startUs: number;
			onLevel: (level: number) => void;
		}): Promise<void> {
			if (disposed) throw new Error("This audio recorder has been closed.");
			if (activeCapture || starting) throw new Error("Audio recording is already active.");
			if (!Number.isSafeInteger(options.startUs) || options.startUs < 0)
				throw new Error("Invalid project playhead time.");
			starting = true;
			let stream: MediaStream | null = null;
			let audioContext: AudioContextLike | null = null;
			let capture: ActiveCapture | null = null;
			try {
				const format = getSupportedFormat(environment);
				const constraints: MediaStreamConstraints = {
					audio: options.deviceId
						? {
								deviceId: { exact: options.deviceId },
								echoCancellation: true,
								noiseSuppression: true,
								autoGainControl: true,
							}
						: true,
					video: false,
				};
				stream = await getMediaDevices(environment).getUserMedia(constraints);
				if (disposed) throw new Error("This audio recorder has been closed.");
				audioContext = getAudioContext(environment);
				if (audioContext.state === "suspended") await audioContext.resume?.();
				const analyser = audioContext.createAnalyser();
				analyser.fftSize = 256;
				audioContext.createMediaStreamSource(stream).connect(analyser);
				const recorder = createRecorder(environment, stream, format.mimeType);
				let resolveCompletion!: (take: RecordedAudioTake | null) => void;
				let rejectCompletion!: (error: Error) => void;
				const completion = new Promise<RecordedAudioTake | null>((resolve, reject) => {
					resolveCompletion = resolve;
					rejectCompletion = reject;
				});
				capture = {
					stream,
					recorder,
					audioContext,
					analyser,
					chunks: [],
					format,
					startUs: options.startUs,
					startedAt: 0,
					onLevel: options.onLevel,
					frameId: null,
					discardRequested: false,
					stopping: false,
					completion,
					resolveCompletion,
					rejectCompletion,
					completionSettled: false,
					cleanupPromise: null,
				};
				activeCapture = capture;
				recorder.ondataavailable = (event) => {
					if (event.data?.size) capture?.chunks.push(event.data);
				};
				recorder.onstop = () => {
					if (!capture) return;
					const finishedCapture = capture;
					const blob = new Blob(finishedCapture.chunks, { type: format.mimeType });
					const durationMs = Math.max(0, Math.round(now() - finishedCapture.startedAt));
					void cleanup(finishedCapture).then(() => {
						if (finishedCapture.discardRequested) {
							finishedCapture.chunks.length = 0;
							settle(finishedCapture, null);
						} else if (blob.size === 0) {
							settle(finishedCapture, null, new Error("No audio was captured."));
						} else {
							settle(finishedCapture, {
								blob,
								mimeType: format.mimeType,
								extension: format.extension,
								durationMs,
								startUs: finishedCapture.startUs,
							});
						}
					});
				};
				recorder.onerror = () => {
					if (!capture) return;
					const failedCapture = capture;
					void cleanup(failedCapture).then(() =>
						settle(failedCapture, null, new Error("The microphone recording failed.")),
					);
				};
				capture.startedAt = now();
				recorder.start();

				const data = new Uint8Array(analyser.frequencyBinCount);
				const updateMeter = () => {
					if (activeCapture !== capture || !capture || capture.discardRequested) return;
					try {
						analyser.getByteFrequencyData(data);
						let total = 0;
						for (const value of data) total += value;
						capture.onLevel(Math.min(1, total / data.length / 128));
					} catch {
						capture.onLevel(0);
					}
					capture.frameId = requestFrame(updateMeter);
				};
				capture.frameId = requestFrame(updateMeter);
			} catch (error) {
				if (capture) await cleanup(capture);
				else {
					if (stream) stopTracks(stream);
					if (audioContext) await audioContext.close().catch(() => undefined);
				}
				throw error;
			} finally {
				starting = false;
			}
		},

		async stop(): Promise<RecordedAudioTake> {
			const capture = activeCapture;
			if (!capture || capture.stopping) throw new Error("Audio recording is not active.");
			capture.stopping = true;
			try {
				capture.recorder.stop();
			} catch (error) {
				await cleanup(capture);
				settle(capture, null, error instanceof Error ? error : new Error(String(error)));
			}
			const take = await capture.completion;
			if (!take) throw new Error("The audio recording was discarded.");
			return take;
		},

		async discard(): Promise<void> {
			const capture = activeCapture;
			if (!capture) return;
			capture.discardRequested = true;
			capture.stopping = true;
			if (capture.recorder.state !== "inactive") {
				try {
					capture.recorder.stop();
				} catch {
					await cleanup(capture);
					settle(capture, null);
				}
				await capture.completion.catch(() => null);
			} else {
				await cleanup(capture);
				settle(capture, null);
			}
		},

		dispose(): void {
			disposed = true;
			void this.discard();
		},
	};
}
