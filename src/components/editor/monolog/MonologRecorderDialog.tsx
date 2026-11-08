import { ArrowsIn, ArrowsOut } from "@phosphor-icons/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
	CAMERA_RESOLUTIONS,
	type CameraResolution,
	type CameraTake,
	createCameraRecorderSession,
} from "@/recording/cameraRecorder";
import { useProjectMessages } from "../useProjectMessages";
import {
	createMonologDialogController,
	formatMonologTime,
	type MonologDialogController,
	type MonologDialogState,
	type MonologSessionPort,
} from "./monologDialogController";
import { TeleprompterPanel } from "./TeleprompterPanel";

export interface MonologRecorderDialogProps<Token> {
	begin(): Promise<Token>;
	finalize(token: Token, take: CameraTake): Promise<{ assetId: string } | null>;
	discard(token: Token): Promise<void>;
	onSaved(assetId: string): void;
	onClose(): void;
	/** Test seam; defaults to a real camera session. */
	createSession?: () => MonologSessionPort;
}

const noopSubscribe = () => () => undefined;

export function MonologRecorderDialog<Token>(props: MonologRecorderDialogProps<Token>) {
	const m = useProjectMessages();
	const latest = useRef(props);
	latest.current = props;
	const [controller, setController] = useState<MonologDialogController<Token> | null>(null);
	// The script lives only in this component: it is never sent to the project, IPC or storage.
	const [script, setScript] = useState("");
	const [fontSize, setFontSize] = useState(32);
	const [mirrorText, setMirrorText] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);

	useEffect(() => {
		const next = createMonologDialogController<Token>({
			session: (latest.current.createSession ?? createCameraRecorderSession)(),
			callbacks: {
				begin: () => latest.current.begin(),
				finalize: (token, take) => latest.current.finalize(token, take),
				discard: (token) => latest.current.discard(token),
				onSaved: (assetId) => latest.current.onSaved(assetId),
				onClose: () => latest.current.onClose(),
			},
		});
		setController(next);
		void next.open();
		return () => next.dispose();
	}, []);

	const state: MonologDialogState | null = useSyncExternalStore(
		controller?.subscribe ?? noopSubscribe,
		() => controller?.getSnapshot() ?? null,
		() => controller?.getSnapshot() ?? null,
	);

	const stream = state?.stream ?? null;
	const cameraLostMessage = useRef(m("monologCameraLost"));
	cameraLostMessage.current = m("monologCameraLost");

	useEffect(() => {
		if (videoRef.current) videoRef.current.srcObject = stream;
	}, [stream]);

	// A track that ends mid-take (camera unplugged, permission revoked) aborts the take.
	useEffect(() => {
		if (!stream || !controller) return;
		const onEnded = () => controller.reportCaptureError(new Error(cameraLostMessage.current));
		const tracks = stream.getTracks();
		for (const track of tracks) track.addEventListener("ended", onEnded);
		return () => {
			for (const track of tracks) track.removeEventListener("ended", onEnded);
		};
	}, [stream, controller]);

	const phase = state?.phase ?? "setup";
	const canClose = !state || phase === "setup" || phase === "review";
	const close = () => {
		if (controller) void controller.close();
		else props.onClose();
	};

	return (
		<div
			className="audio-recorder-overlay"
			onKeyDown={(event) => {
				if (event.key === "Escape" && canClose) {
					event.preventDefault();
					close();
				}
			}}
		>
			<section
				className={`monolog-dialog ${expanded ? "expanded" : ""}`}
				role="dialog"
				aria-modal="true"
				aria-labelledby="monolog-title"
				tabIndex={-1}
			>
				<header className="audio-recorder-header">
					<div>
						<h2 id="monolog-title">{m("monologTitle")}</h2>
						<p>{m("monologDescription")}</p>
					</div>
					<div className="monolog-header-actions">
						<button
							type="button"
							className="audio-recorder-close"
							aria-label={expanded ? m("shrinkDialog") : m("expandDialog")}
							title={expanded ? m("shrinkDialog") : m("expandDialog")}
							onClick={() => setExpanded((value) => !value)}
						>
							{expanded ? <ArrowsIn size={16} /> : <ArrowsOut size={16} />}
						</button>
						<button
							type="button"
							className="audio-recorder-close"
							aria-label={m("closeMonolog")}
							disabled={!canClose}
							onClick={close}
						>
							×
						</button>
					</div>
				</header>

				<TeleprompterPanel
					script={script}
					onScriptChange={setScript}
					phase={phase}
					fontSize={fontSize}
					onFontSizeChange={setFontSize}
					mirrorText={mirrorText}
					onMirrorTextChange={setMirrorText}
				/>

				<div className="monolog-preview">
					<video
						ref={videoRef}
						autoPlay
						muted
						playsInline
						className={state?.mirror ? "mirrored" : ""}
						aria-label={m("preview")}
					/>
					{phase === "countdown" && (
						<div className="monolog-countdown" aria-live="assertive">
							{state?.countdown}
						</div>
					)}
					{(phase === "recording" || phase === "review" || phase === "saving") && (
						<output
							className="monolog-timer"
							role="timer"
							aria-label={m("elapsedTime")}
						>
							{phase === "recording" && (
								<span className="monolog-rec-dot" aria-hidden="true" />
							)}
							{formatMonologTime(state?.elapsedMs ?? 0)}
						</output>
					)}
				</div>

				<div className="monolog-fields">
					<label>
						<span>{m("cameraInput")}</span>
						<select
							value={state?.cameraId ?? ""}
							disabled={phase !== "setup" || state?.loading}
							onChange={(event) =>
								void controller?.selectCamera(event.currentTarget.value || null)
							}
						>
							<option value="">{m("defaultCamera")}</option>
							{state?.cameras.map((device) => (
								<option key={device.deviceId} value={device.deviceId}>
									{device.label}
								</option>
							))}
						</select>
					</label>
					<label>
						<span>{m("microphoneInput")}</span>
						<select
							value={state?.microphoneId ?? ""}
							disabled={phase !== "setup" || state?.loading}
							onChange={(event) =>
								void controller?.selectMicrophone(event.currentTarget.value || null)
							}
						>
							<option value="">{m("defaultMicrophone")}</option>
							{state?.microphones.map((device) => (
								<option key={device.deviceId} value={device.deviceId}>
									{device.label}
								</option>
							))}
						</select>
					</label>
					<label>
						<span>{m("monologResolution")}</span>
						<select
							value={state?.resolution ?? "1080p"}
							disabled={phase !== "setup" || state?.loading}
							onChange={(event) =>
								void controller?.selectResolution(
									event.currentTarget.value as CameraResolution,
								)
							}
						>
							{(Object.keys(CAMERA_RESOLUTIONS) as CameraResolution[]).map(
								(resolution) => (
									<option key={resolution} value={resolution}>
										{resolution}
									</option>
								),
							)}
						</select>
					</label>
					<label className="monolog-checkbox">
						<input
							type="checkbox"
							checked={state?.mirror ?? true}
							onChange={() => controller?.toggleMirror()}
						/>
						<span>{m("mirrorPreview")}</span>
					</label>
				</div>

				<div className="audio-recorder-meter-row">
					<div
						className="audio-recorder-meter"
						role="meter"
						aria-label={m("microphoneLevel")}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round((state?.level ?? 0) * 100)}
					>
						<span style={{ width: `${Math.round((state?.level ?? 0) * 100)}%` }} />
					</div>
					{state?.granted?.width && state.granted.height && (
						<span className="audio-recorder-hint">
							{state.granted.width}×{state.granted.height}
							{state.granted.frameRate
								? ` · ${Math.round(state.granted.frameRate)} fps`
								: ""}
						</span>
					)}
				</div>

				{!state?.loading && state?.cameras.length === 0 && (
					<p className="audio-recorder-hint">{m("noCameras")}</p>
				)}
				{phase === "saving" && (
					<p className="audio-recorder-status" aria-live="polite">
						{m("savingMonolog")}
					</p>
				)}
				{state?.error && (
					<p className="audio-recorder-error" role="alert">
						{state.error}
					</p>
				)}

				<footer className="audio-recorder-actions">
					{phase === "setup" && (
						<>
							<button
								type="button"
								className="audio-recorder-primary"
								disabled={!controller || state?.loading || !state?.stream}
								onClick={() => void controller?.record()}
							>
								{m("startMonolog")}
							</button>
							<button type="button" onClick={close}>
								{m("closeMonolog")}
							</button>
						</>
					)}
					{phase === "countdown" && (
						<button type="button" onClick={() => void controller?.stop()}>
							{m("cancelCountdown")}
						</button>
					)}
					{phase === "recording" && (
						<button
							type="button"
							className="audio-recorder-primary"
							onClick={() => void controller?.stop()}
						>
							{m("stopMonolog")}
						</button>
					)}
					{(phase === "review" || phase === "saving") && (
						<>
							<button
								type="button"
								className="audio-recorder-primary"
								disabled={phase === "saving"}
								onClick={() => void controller?.save()}
							>
								{m("saveMonolog")}
							</button>
							<button
								type="button"
								disabled={phase === "saving"}
								onClick={() => void controller?.retake()}
							>
								{m("retakeMonolog")}
							</button>
						</>
					)}
				</footer>
			</section>
		</div>
	);
}
