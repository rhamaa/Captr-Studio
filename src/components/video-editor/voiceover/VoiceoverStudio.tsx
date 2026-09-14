import {
	Microphone,
	Stop,
	SlidersHorizontal,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface VoiceoverStudioProps {
	onAudioRecorded?: (span: { start: number; end: number }, audioPath: string) => void;
	currentTime?: number;
	slideDurationMs?: number;
}

export function VoiceoverStudio({
	onAudioRecorded,
	currentTime = 0,
	slideDurationMs: _slideDurationMs,
}: VoiceoverStudioProps) {
	const [isRecording, setIsRecording] = useState(false);
	const [countdown, setCountdown] = useState<number | null>(null);
	const [recordingDuration, setRecordingDuration] = useState(0);
	const [audioLevel, setAudioLevel] = useState(0);
	const [peakLevel, setPeakLevel] = useState(0);
	const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
	const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const timerRef = useRef<number | null>(null);
	const countdownTimerRef = useRef<number | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	const recordStartPlayheadRef = useRef<number>(0);

	// Enumerate microphones
	useEffect(() => {
		async function getMics() {
			try {
				const devices = await navigator.mediaDevices.enumerateDevices();
				const audioInputs = devices.filter((d) => d.kind === "audioinput");
				setAvailableDevices(audioInputs);
				if (audioInputs.length > 0 && !selectedDeviceId) {
					setSelectedDeviceId(audioInputs[0].deviceId);
				}
			} catch (err) {
				console.error("[VoiceoverStudio] Enumerate devices failed:", err);
			}
		}
		void getMics();
	}, [selectedDeviceId]);

	const startActualRecording = async () => {
		try {
			const constraints: MediaStreamConstraints = {
				audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
			};
			const stream = await navigator.mediaDevices.getUserMedia(constraints);
			audioChunksRef.current = [];
			recordStartPlayheadRef.current = currentTime * 1000;

			const audioCtx = new AudioContext();
			audioContextRef.current = audioCtx;
			const source = audioCtx.createMediaStreamSource(stream);
			const analyser = audioCtx.createAnalyser();
			analyser.fftSize = 256;
			source.connect(analyser);
			analyserRef.current = analyser;

			const dataArray = new Uint8Array(analyser.frequencyBinCount);
			const updateMeter = () => {
				if (!analyserRef.current) return;
				analyserRef.current.getByteFrequencyData(dataArray);
				let sum = 0;
				let maxVal = 0;
				for (let i = 0; i < dataArray.length; i++) {
					sum += dataArray[i];
					if (dataArray[i] > maxVal) maxVal = dataArray[i];
				}
				const avg = sum / dataArray.length;
				const level = Math.min(100, Math.round((avg / 128) * 100));
				const peak = Math.min(100, Math.round((maxVal / 255) * 100));
				setAudioLevel(level);
				setPeakLevel(peak);
				animationFrameRef.current = requestAnimationFrame(updateMeter);
			};
			updateMeter();

			const recorder = new MediaRecorder(stream);
			mediaRecorderRef.current = recorder;

			recorder.ondataavailable = (e) => {
				if (e.data && e.data.size > 0) {
					audioChunksRef.current.push(e.data);
				}
			};

			recorder.onstop = () => {
				stream.getTracks().forEach((track) => track.stop());
				if (audioContextRef.current) {
					audioContextRef.current.close().catch(() => {});
					audioContextRef.current = null;
				}
				if (animationFrameRef.current) {
					cancelAnimationFrame(animationFrameRef.current);
					animationFrameRef.current = null;
				}
				setAudioLevel(0);
				setPeakLevel(0);

				const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
				const audioUrl = URL.createObjectURL(blob);
				const durationMs = recordingDuration * 1000;
				const startMs = recordStartPlayheadRef.current;
				const endMs = startMs + Math.max(1000, durationMs);

				if (onAudioRecorded && durationMs > 200) {
					onAudioRecorded({ start: startMs, end: endMs }, audioUrl);
					toast.success("Voiceover recording placed on audio track");
				}
			};

			recorder.start(100);
			setIsRecording(true);
			setRecordingDuration(0);

			const startEpoch = Date.now();
			timerRef.current = window.setInterval(() => {
				setRecordingDuration(Math.round((Date.now() - startEpoch) / 1000));
			}, 200);
		} catch (err) {
			console.error("[VoiceoverStudio] Failed to access mic:", err);
			toast.error("Microphone access denied or device disconnected");
		}
	};

	const initiateRecordingWithCountdown = () => {
		if (isRecording) return;
		setCountdown(3);

		let count = 3;
		countdownTimerRef.current = window.setInterval(() => {
			count -= 1;
			if (count > 0) {
				setCountdown(count);
			} else {
				if (countdownTimerRef.current) {
					clearInterval(countdownTimerRef.current);
					countdownTimerRef.current = null;
				}
				setCountdown(null);
				void startActualRecording();
			}
		}, 800);
	};

	const stopRecording = () => {
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
	};

	useEffect(() => {
		return () => {
			if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
			if (timerRef.current) clearInterval(timerRef.current);
			if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
			if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
				mediaRecorderRef.current.stop();
			}
		};
	}, []);

	const minutes = Math.floor(recordingDuration / 60);
	const seconds = recordingDuration % 60;
	const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

	return (
		<div className="flex flex-col gap-3 p-3.5 rounded-2xl border border-foreground/10 bg-editor-surface/90 shadow-sm backdrop-blur-md">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<div
						className={cn(
							"flex items-center justify-center w-7 h-7 rounded-lg transition-colors",
							isRecording
								? "bg-rose-500/20 text-rose-500 animate-pulse"
								: "bg-primary/10 text-primary",
						)}
					>
						<Microphone className="w-4 h-4" weight="bold" />
					</div>
					<div>
						<h4 className="text-xs font-bold text-foreground tracking-tight">
							Voiceover Studio
						</h4>
						<p className="text-[10px] text-muted-foreground">
							Direct narration recorder with live meter
						</p>
					</div>
				</div>

				{isRecording && (
					<span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 text-[10px] font-mono font-bold text-rose-500 border border-rose-500/20 animate-pulse">
						<span className="w-2 h-2 rounded-full bg-rose-500" />
						{timeStr}
					</span>
				)}
			</div>

			{/* Device Selector */}
			{availableDevices.length > 1 && !isRecording && countdown === null && (
				<div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-foreground/8 bg-foreground/[0.02]">
					<SlidersHorizontal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
					<select
						value={selectedDeviceId}
						onChange={(e) => setSelectedDeviceId(e.target.value)}
						className="flex-1 bg-transparent text-[10.5px] text-foreground font-medium focus:outline-none cursor-pointer truncate"
					>
						{availableDevices.map((dev) => (
							<option key={dev.deviceId} value={dev.deviceId} className="bg-editor-surface text-foreground">
								{dev.label || `Microphone ${dev.deviceId.slice(0, 5)}...`}
							</option>
						))}
					</select>
				</div>
			)}

			{/* Live VU Meter & Peak indicator */}
			<div className="space-y-1">
				<div className="flex items-center justify-between text-[9px] font-mono font-semibold text-muted-foreground">
					<span>-48 dB</span>
					<span>-18 dB</span>
					<span className={peakLevel > 85 ? "text-rose-400 font-bold" : ""}>0 dB PEAK</span>
				</div>
				<div className="relative h-2.5 w-full rounded-full bg-foreground/10 overflow-hidden p-0.5">
					{/* Gradient VU Bar */}
					<div
						className="h-full rounded-full transition-all duration-75"
						style={{
							width: `${isRecording ? audioLevel : 0}%`,
							background:
								audioLevel > 80
									? "linear-gradient(90deg, #10b981 0%, #eab308 70%, #ef4444 100%)"
									: audioLevel > 50
										? "linear-gradient(90deg, #10b981 0%, #eab308 100%)"
										: "#10b981",
						}}
					/>
					{/* Peak Marker Line */}
					{isRecording && peakLevel > 5 && (
						<div
							className="absolute top-0 bottom-0 w-0.5 bg-white shadow-xs transition-all duration-150"
							style={{ left: `${peakLevel}%` }}
						/>
					)}
				</div>
			</div>

			{/* Countdown Modal Overlay */}
			{countdown !== null && (
				<div className="flex items-center justify-center p-3 rounded-xl bg-primary/10 border border-primary/20 text-center animate-fade-in">
					<span className="text-3xl font-extrabold font-mono text-primary animate-bounce">
						{countdown}
					</span>
					<span className="ml-3 text-xs font-semibold text-foreground">Get ready to speak...</span>
				</div>
			)}

			{/* Controls Row */}
			<div className="flex items-center gap-2">
				{isRecording ? (
					<Button
						type="button"
						onClick={stopRecording}
						variant="destructive"
						size="sm"
						className="flex-1 h-8 text-xs font-bold gap-1.5 rounded-xl shadow-xs cursor-pointer bg-rose-600 hover:bg-rose-700 text-white"
					>
						<Stop className="w-3.5 h-3.5" weight="fill" />
						<span>Finish Recording</span>
					</Button>
				) : (
					<Button
						type="button"
						onClick={initiateRecordingWithCountdown}
						disabled={countdown !== null}
						size="sm"
						className="flex-1 h-8 text-xs font-bold gap-1.5 rounded-xl shadow-xs cursor-pointer bg-primary hover:bg-primary/90 text-white"
					>
						<Microphone className="w-3.5 h-3.5" weight="bold" />
						<span>{countdown !== null ? "Starting..." : "Record Voiceover (3s)"}</span>
					</Button>
				)}
			</div>
		</div>
	);
}
