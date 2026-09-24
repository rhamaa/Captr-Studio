import { useCallback, useEffect, useRef, useState } from "react";

export interface RecordedAudioClip {
	filePath: string;
	startOffsetMs: number;
	durationMs: number;
}

export interface UseSlideAudioRecorderOptions {
	slideId: string;
	getCurrentTimeMs: () => number;
	onStartPlayback?: () => void;
	onPausePlayback?: () => void;
	onAudioClipRecorded?: (clip: RecordedAudioClip) => void;
}

export function useSlideAudioRecorder(options: UseSlideAudioRecorderOptions) {
	const {
		slideId,
		getCurrentTimeMs,
		onStartPlayback,
		onPausePlayback,
		onAudioClipRecorded,
	} = options;

	const [isRecording, setIsRecording] = useState(false);
	const [countdown, setCountdown] = useState<number | null>(null);
	const [audioLevel, setAudioLevel] = useState(0);
	const [peakLevel, setPeakLevel] = useState(0);
	const [recordingDurationMs, setRecordingDurationMs] = useState(0);
	const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
	const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<number | null>(null);
	const countdownTimerRef = useRef<number | null>(null);
	const startPlayheadMsRef = useRef<number>(0);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	const recordingStartTimeRef = useRef<number>(0);

	// Fetch mic devices
	useEffect(() => {
		async function fetchDevices() {
			if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
				return;
			}
			try {
				const devices = await navigator.mediaDevices.enumerateDevices();
				const audioInputs = devices.filter((d) => d.kind === "audioinput");
				setAvailableDevices(audioInputs);
				if (audioInputs.length > 0 && !selectedDeviceId) {
					setSelectedDeviceId(audioInputs[0].deviceId);
				}
			} catch (err) {
				console.error("[useSlideAudioRecorder] Enumerate devices failed:", err);
			}
		}
		void fetchDevices();
	}, [selectedDeviceId]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
			if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
			if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
			if (audioContextRef.current) {
				audioContextRef.current.close().catch(() => undefined);
			}
		};
	}, []);

	const executeStart = useCallback(async () => {
		try {
			const constraints: MediaStreamConstraints = {
				audio: selectedDeviceId
					? {
							deviceId: { exact: selectedDeviceId },
							echoCancellation: true,
							noiseSuppression: true,
							autoGainControl: true,
						}
					: true,
			};

			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			audioChunksRef.current = [];
			startPlayheadMsRef.current = Math.max(0, Math.round(getCurrentTimeMs()));

			// Setup VU meter analyser
			const AudioCtxClass =
				window.AudioContext ||
				(window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
			if (AudioCtxClass) {
				const audioCtx = new AudioCtxClass();
				audioContextRef.current = audioCtx;
				const analyser = audioCtx.createAnalyser();
				analyser.fftSize = 256;
				analyserRef.current = analyser;

				const source = audioCtx.createMediaStreamSource(stream);
				source.connect(analyser);

				const dataArray = new Uint8Array(analyser.frequencyBinCount);
				const updateMeter = () => {
					if (!analyserRef.current) return;
					analyserRef.current.getByteFrequencyData(dataArray);
					let sum = 0;
					for (let i = 0; i < dataArray.length; i++) {
						sum += dataArray[i];
					}
					const avg = sum / dataArray.length;
					const norm = Math.min(1, avg / 128);
					setAudioLevel(norm);
					setPeakLevel((prev) => Math.max(prev * 0.95, norm));
					animationFrameRef.current = requestAnimationFrame(updateMeter);
				};
				updateMeter();
			}

			const recorder = new MediaRecorder(stream);
			mediaRecorderRef.current = recorder;

			recorder.ondataavailable = (e) => {
				if (e.data && e.data.size > 0) {
					audioChunksRef.current.push(e.data);
				}
			};

			recorder.onstop = async () => {
				stream.getTracks().forEach((track) => track.stop());
				if (audioContextRef.current) {
					audioContextRef.current.close().catch(() => undefined);
					audioContextRef.current = null;
				}
				if (animationFrameRef.current) {
					cancelAnimationFrame(animationFrameRef.current);
					animationFrameRef.current = null;
				}
				setAudioLevel(0);
				setPeakLevel(0);

				const recordedDuration = Date.now() - recordingStartTimeRef.current;
				const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

				if (recordedDuration > 300) {
					let finalPath: string | null = null;
					try {
						if (window.electronAPI?.saveRecordedAudio) {
							const arrayBuffer = await blob.arrayBuffer();
							const result = await window.electronAPI.saveRecordedAudio({
								audioBuffer: arrayBuffer,
								slideId: slideId || null,
								extension: "webm",
							});
							if (result.success && result.filePath) {
								finalPath = result.filePath;
							}
						}
					} catch (saveErr) {
						console.error("[useSlideAudioRecorder] Failed to persist audio to disk:", saveErr);
					}

					if (!finalPath) {
						finalPath = URL.createObjectURL(blob);
					}

					onAudioClipRecorded?.({
						filePath: finalPath,
						startOffsetMs: startPlayheadMsRef.current,
						durationMs: Math.max(500, recordedDuration),
					});
				}
			};

			recorder.start(100);
			setIsRecording(true);
			setRecordingDurationMs(0);
			recordingStartTimeRef.current = Date.now();

			// Start timer for duration tracking
			timerRef.current = window.setInterval(() => {
				setRecordingDurationMs(Date.now() - recordingStartTimeRef.current);
			}, 100);

			// Synchronously start preview video playback so playhead moves along with voiceover!
			onStartPlayback?.();
		} catch (err) {
			console.error("[useSlideAudioRecorder] Failed to start microphone recording:", err);
			setIsRecording(false);
			onPausePlayback?.();
		}
	}, [selectedDeviceId, getCurrentTimeMs, slideId, onAudioClipRecorded, onStartPlayback, onPausePlayback]);

	const startRecording = useCallback(
		(withCountdown = false) => {
			if (isRecording) return;

			if (!withCountdown) {
				void executeStart();
				return;
			}

			// Countdown 3, 2, 1
			setCountdown(3);
			let count = 3;
			countdownTimerRef.current = window.setInterval(() => {
				count -= 1;
				if (count <= 0) {
					if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
					countdownTimerRef.current = null;
					setCountdown(null);
					void executeStart();
				} else {
					setCountdown(count);
				}
			}, 1000);
		},
		[isRecording, executeStart],
	);

	const stopRecording = useCallback(() => {
		if (countdownTimerRef.current) {
			clearInterval(countdownTimerRef.current);
			countdownTimerRef.current = null;
			setCountdown(null);
		}

		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}

		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
			mediaRecorderRef.current.stop();
		}

		setIsRecording(false);
		// Synchronously pause preview playback
		onPausePlayback?.();
	}, [onPausePlayback]);

	const cancelRecording = useCallback(() => {
		if (countdownTimerRef.current) {
			clearInterval(countdownTimerRef.current);
			countdownTimerRef.current = null;
			setCountdown(null);
		}

		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}

		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
			audioChunksRef.current = []; // Clear chunks so onstop does not save
			mediaRecorderRef.current.stop();
		}

		setIsRecording(false);
		setAudioLevel(0);
		setPeakLevel(0);
		setRecordingDurationMs(0);
		onPausePlayback?.();
	}, [onPausePlayback]);

	return {
		isRecording,
		countdown,
		audioLevel,
		peakLevel,
		recordingDurationMs,
		startPlayheadMs: startPlayheadMsRef.current,
		availableDevices,
		selectedDeviceId,
		setSelectedDeviceId,
		startRecording,
		stopRecording,
		cancelRecording,
	};
}
