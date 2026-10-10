import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createAudioRecorderSession, type RecordedAudioTake } from "@/recording/audioRecorder";
import {
	type AudioRecorderDialogState,
	type AudioRecorderNavigationChoice,
	createAudioRecorderDialogController,
	formatAudioRecorderTime,
} from "./audioRecorderDialogController";
import { useProjectMessages } from "./useProjectMessages";

export interface AudioRecorderDialogProps {
	startUs: number;
	navigationRequested: boolean;
	onNavigationRequest?: () => void;
	onPreviewStart(): Promise<void> | void;
	onPreviewPause(): Promise<void> | void;
	onTakeRecorded(take: RecordedAudioTake): Promise<void>;
	onDiscard(take?: RecordedAudioTake): Promise<void>;
	onNavigationChoice(choice: AudioRecorderNavigationChoice): Promise<void> | void;
	onRecordingChange?(recording: boolean): void;
	onClose(): void;
}

const EMPTY_STATE: AudioRecorderDialogState = {
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
const noopSubscribe = () => () => undefined;
const getEmptyState = () => EMPTY_STATE;

export function AudioRecorderDialog(props: AudioRecorderDialogProps) {
	const m = useProjectMessages();
	const latestProps = useRef(props);
	latestProps.current = props;
	const [controller, setController] = useState<ReturnType<
		typeof createAudioRecorderDialogController
	> | null>(null);

	useEffect(() => {
		const next = createAudioRecorderDialogController({
			startUs: props.startUs,
			session: createAudioRecorderSession(),
			callbacks: {
				onPreviewStart: () => latestProps.current.onPreviewStart(),
				onPreviewPause: () => latestProps.current.onPreviewPause(),
				onTakeRecorded: (take) => latestProps.current.onTakeRecorded(take),
				onDiscard: (take) => latestProps.current.onDiscard(take),
				onNavigationChoice: (choice) => latestProps.current.onNavigationChoice(choice),
				onRecordingChange: (recording) =>
					latestProps.current.onRecordingChange?.(recording),
				onClose: () => latestProps.current.onClose(),
			},
		});
		setController(next);
		void next.loadInputs();
		return () => next.dispose();
	}, [props.startUs]);

	useEffect(() => {
		controller?.setNavigationRequested(props.navigationRequested);
	}, [controller, props.navigationRequested]);

	const state = useSyncExternalStore(
		controller?.subscribe ?? noopSubscribe,
		controller?.getSnapshot ?? getEmptyState,
		controller?.getSnapshot ?? getEmptyState,
	);

	const close = () => {
		if (controller && (state.recording || state.finalizing)) props.onNavigationRequest?.();
		if (controller) controller.close();
		else props.onClose();
	};

	return (
		<div
			className="audio-recorder-overlay"
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					close();
				}
			}}
		>
			<section
				className="audio-recorder-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="audio-recorder-title"
				tabIndex={-1}
			>
				<header className="audio-recorder-header">
					<div>
						<h2 id="audio-recorder-title">{m("audioRecorderTitle")}</h2>
						<p>{m("audioRecorderDescription")}</p>
					</div>
					<button
						type="button"
						className="audio-recorder-close"
						aria-label={m("cancel")}
						onClick={close}
					>
						×
					</button>
				</header>

				<div className="audio-recorder-fields">
					<label htmlFor="audio-recorder-device">{m("microphoneInput")}</label>
					<select
						id="audio-recorder-device"
						value={state.selectedDeviceId ?? ""}
						disabled={
							!controller ||
							state.loadingInputs ||
							state.recording ||
							state.finalizing
						}
						onChange={(event) =>
							controller?.selectDevice(event.currentTarget.value || null)
						}
					>
						<option value="">{m("defaultMicrophone")}</option>
						{state.devices.map((device) => (
							<option key={device.deviceId} value={device.deviceId}>
								{device.label}
							</option>
						))}
					</select>
					{state.loadingInputs && (
						<span className="audio-recorder-hint">{m("loadingMicrophones")}</span>
					)}
					{!state.loadingInputs && state.devices.length === 0 && (
						<span className="audio-recorder-hint">{m("noMicrophones")}</span>
					)}
				</div>

				<div className="audio-recorder-meter-row">
					<div
						className="audio-recorder-meter"
						role="meter"
						aria-label={m("microphoneLevel")}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(state.level * 100)}
					>
						<span style={{ width: `${Math.round(state.level * 100)}%` }} />
					</div>
					<output
						className="audio-recorder-timer"
						aria-label={m("elapsedTime")}
						role="timer"
						aria-live="off"
					>
						{formatAudioRecorderTime(state.elapsedMs)}
					</output>
				</div>

				{state.recording && (
					<p className="audio-recorder-status" aria-live="polite">
						{m("recording")}
					</p>
				)}
				{state.finalizing && (
					<p className="audio-recorder-status" aria-live="polite">
						{m("savingAudio")}
					</p>
				)}
				{state.error && (
					<p className="audio-recorder-error" role="alert">
						{state.error}
					</p>
				)}

				<footer className="audio-recorder-actions">
					{state.navigationRequested ? (
						<>
							<button
								type="button"
								className="audio-recorder-primary"
								disabled={state.finalizing || (!state.recording && !state.take)}
								onClick={() => void controller?.resolveNavigation("finish")}
							>
								{m("finishAndKeep")}
							</button>
							<button
								type="button"
								disabled={state.finalizing}
								onClick={() => void controller?.resolveNavigation("discard")}
							>
								{m("discardAndContinue")}
							</button>
							<button
								type="button"
								disabled={state.finalizing}
								onClick={() => void controller?.resolveNavigation("stay")}
							>
								{m("stayInProject")}
							</button>
						</>
					) : state.recording ? (
						<>
							<button
								type="button"
								className="audio-recorder-primary"
								onClick={() => void controller?.stop()}
							>
								{m("stopAudioRecording")}
							</button>
							<button type="button" onClick={() => void controller?.discard()}>
								{m("discardAudioTake")}
							</button>
						</>
					) : state.take ? (
						<>
							<button
								type="button"
								className="audio-recorder-primary"
								disabled={state.finalizing}
								onClick={() => void controller?.retry()}
							>
								{m("retryAudioSave")}
							</button>
							<button
								type="button"
								disabled={state.finalizing}
								onClick={() => void controller?.discard()}
							>
								{m("discardAudioTake")}
							</button>
						</>
					) : (
						<>
							<button
								type="button"
								className="audio-recorder-primary"
								disabled={!controller || state.loadingInputs || state.finalizing}
								onClick={() => void controller?.start()}
							>
								{m("recordAudio")}
							</button>
							<button type="button" onClick={close}>
								{m("cancel")}
							</button>
						</>
					)}
				</footer>
			</section>
		</div>
	);
}
