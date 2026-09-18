import {
	CaretUpIcon,
	MicrophoneIcon,
	MicrophoneSlashIcon,
	MinusIcon,
	MonitorIcon,
	DotsThreeVerticalIcon,
	TimerIcon,
	VideoCameraIcon,
	VideoCameraSlashIcon,
	XIcon,
	ArrowClockwiseIcon,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { RxDragHandleDots2 } from "react-icons/rx";
import { useScopedT } from "../../contexts/I18nContext";
import { useHudBarDrag } from "./hooks/useHudBarDrag";
import { useMicrophoneDevices } from "../../hooks/useMicrophoneDevices";
import { useLaunchWindowSystemState } from "./hooks/useLaunchWindowSystemState";
import { useLaunchHudInteractionState } from "./hooks/useLaunchHudInteractionState";
import { useLaunchWindowActions } from "./hooks/useLaunchWindowActions";
import { useRecordingTimer } from "./hooks/useRecordingTimer";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { useVideoDevices } from "../../hooks/useVideoDevices";
import { useWebcamPreviewOverlay } from "./hooks/useWebcamPreviewOverlay";
import {
	canToggleFloatingWebcamPreview,
} from "./floatingWebcamPreview";
import { LaunchPopoverCoordinatorProvider, useLaunchPopoverCoordinator } from "./popovers/LaunchPopoverCoordinator";
import { CountdownPopover } from "./popovers/CountdownPopover";
import { MicPopover } from "./popovers/MicPopover";
import { MorePopover } from "./popovers/MorePopover";
import { ProjectPopover } from "./popovers/ProjectPopover";
import { SourcePopover } from "./popovers/SourcePopover";
import { WebcamPopover } from "./popovers/WebcamPopover";
import { HudInteractionContext } from "./contexts/HudInteractionContext";
import { MarqueeText } from "./SourceSelector";
import styles from "./LaunchWindow.module.css";

import { Separator } from "@/components/ui/separator";
import { Button } from "../ui/button";
import { RecordingControls } from "./RecordingControls";
import { useEffect, useRef } from "react";

const SHOW_DEV_UPDATE_PREVIEW = import.meta.env.DEV;

export function LaunchWindow() {
	return (
		<LaunchPopoverCoordinatorProvider>
			<LaunchWindowContent />
		</LaunchPopoverCoordinatorProvider>
	);
}

function LaunchWindowContent() {
	const t = useScopedT("launch");
	const { openId, requestClose, requestOpen } = useLaunchPopoverCoordinator();

	const {
		recording,
		starting,
		paused,
		finalizing,
		countdownActive,
		toggleRecording,
		pauseRecording,
		resumeRecording,
		cancelRecording,
		microphoneEnabled,
		setMicrophoneEnabled,
		microphoneDeviceId,
		setMicrophoneDeviceId,
		systemAudioEnabled,
		setSystemAudioEnabled,
		webcamEnabled,
		setWebcamEnabled,
		webcamDeviceId,
		setWebcamDeviceId,
		countdownDelay,
		setCountdownDelay,
		preparePermissions,
	} = useScreenRecorder();

	const { elapsed, formatTime } = useRecordingTimer(recording, paused);
	const hudContentRef = useRef<HTMLDivElement>(null);
	const hudBarRef = useRef<HTMLDivElement>(null);


	const {
		selectedSource,
		hasSelectedSource,
		projectLibraryEntries,
		handleSourceSelect,
		openVideoFile,
		openProjectFromLibrary,
		syncSelectedSource,
		refreshProjectLibrary,
	} = useLaunchWindowActions();

	const showWebcamControls = webcamEnabled && !recording;
	const { devices, selectedDeviceId, setSelectedDeviceId } = useMicrophoneDevices(
		microphoneEnabled || openId === "mic",
		microphoneDeviceId,
	);
	const {
		devices: videoDevices,
		selectedDeviceId: selectedVideoDeviceId,
		setSelectedDeviceId: setSelectedVideoDeviceId,
	} = useVideoDevices(webcamEnabled || openId === "webcam");

	const {
		hudOverlayMousePassthroughSupported,
		platform,
		appVersion,
		hideHudFromCapture,
		chooseRecordingsDirectory,
		toggleHudCaptureProtection,
	} = useLaunchWindowSystemState(preparePermissions);

	const supportsHudCaptureProtection = platform !== "linux";

	useEffect(() => {
		if (!selectedDeviceId) {
			return;
		}

		setMicrophoneDeviceId(selectedDeviceId === "default" ? undefined : selectedDeviceId);
	}, [selectedDeviceId, setMicrophoneDeviceId]);

	useEffect(() => {
		if (selectedVideoDeviceId && selectedVideoDeviceId !== "default") {
			setWebcamDeviceId(selectedVideoDeviceId);
		}
	}, [selectedVideoDeviceId, setWebcamDeviceId]);

	const {
		showFloatingWebcamPreview,
		setShowFloatingWebcamPreview,
		showRecordingWebcamPreview,
		webcamPreviewOffset,
		recordingWebcamPreviewContainerRef,
		isWebcamPreviewDraggingRef,
		webcamPreviewDragStartRef,
		handleWebcamPreviewPointerDown,
		handleWebcamPreviewPointerMove,
		handleWebcamPreviewPointerUp,
		setWebcamPreviewNode,
		setRecordingWebcamPreviewNode,
	} = useWebcamPreviewOverlay({
		webcamEnabled,
		webcamDeviceId,
		showWebcamControls,
		webcamPopoverOpen: openId === "webcam",
		hudOverlayMousePassthroughSupported,
	});

	const {
		recordingHudOffset,
		hudBarTransformRef,
		isHudDraggingRef,
		handleHudBarPointerDown,
		handleHudBarPointerMove,
		handleHudBarPointerUp,
	} = useHudBarDrag({
		hudContentRef,
		hudBarRef,
		recordingWebcamPreviewContainerRef,
	});

	const { handleHudMouseEnter, handleHudMouseLeave, beginInteractiveHudAction } = useLaunchHudInteractionState({
		openId,
		isHudDraggingRef,
		isWebcamPreviewDraggingRef,
		webcamPreviewDragStartRef,
	});

	useEffect(() => {
		let mounted = true;

		void window.electronAPI.getSelectedSource().then((source) => {
			if (mounted) syncSelectedSource(source);
		});

		const cleanup = window.electronAPI.onSelectedSourceChanged((source) => {
			if (mounted) syncSelectedSource(source);
		});

		return () => {
			mounted = false;
			cleanup?.();
		};
	}, [syncSelectedSource]);

	const hudStateTransition = {
		duration: 0.24,
		ease: [0.22, 1, 0.36, 1] as const,
	};


	const recordingControls = (
		<RecordingControls
			paused={paused}
			microphoneEnabled={microphoneEnabled}
			elapsed={elapsed}
			onToggleMicrophone={() => setMicrophoneEnabled(!microphoneEnabled)}
			onPauseResume={paused ? resumeRecording : pauseRecording}
			onStopRecording={toggleRecording}
			onHideHud={() => window.electronAPI?.hudOverlayHide?.()}
			onCancelRecording={cancelRecording}
			formatTime={formatTime}
		/>
	);

	const idleControls = (
		<>
			{platform !== "linux" && (
				<>
					<SourcePopover
						selectedSource={selectedSource}
						onSourceSelect={handleSourceSelect}
						onOpen={beginInteractiveHudAction}
						trigger={
							<Button
								variant="outline"
								size="lg"
								className={`${styles.electronNoDrag} group gap-2 px-3 min-w-0 max-w-[180px] rounded-[11px] font-medium text-[12px] shrink-0 border-[var(--launch-border)] bg-[var(--launch-surface)] text-[var(--launch-text)] hover:border-[var(--launch-border-strong)] hover:bg-[var(--launch-hover)] transition-all ${openId === "sources" ? "border-[var(--launch-border-strong)] bg-[var(--launch-hover)]" : ""}`}
								title={selectedSource}
							>
								<MonitorIcon size={16} className="shrink-0" />
								<div className="flex-1 min-w-0 overflow-hidden">
									<MarqueeText text={selectedSource} />
								</div>
								<CaretUpIcon
									size={10}
									className={`text-[#6b6b78] ml-0.5 shrink-0 transition-transform duration-200 ${
										openId === "sources" ? "" : "rotate-180"
									}`}
								/>
							</Button>
						}
					/>

					<Separator orientation="vertical" className="mx-[5px] h-6" />
				</>
			)}

			<MicPopover
				disabled={recording}
				systemAudioEnabled={systemAudioEnabled}
				onToggleSystemAudio={() => setSystemAudioEnabled(!systemAudioEnabled)}
				microphoneEnabled={microphoneEnabled}
				onDisableMicrophone={() => setMicrophoneEnabled(false)}
				devices={devices}
				microphoneDeviceId={microphoneDeviceId}
				selectedDeviceId={selectedDeviceId}
				onSelectDevice={(deviceId) => {
					setMicrophoneEnabled(true);
					setSelectedDeviceId(deviceId);
					setMicrophoneDeviceId(deviceId === "default" ? undefined : deviceId);
				}}
				trigger={
					<Button
						variant="ghost"
						size="icon"
						iconSize="lg"
						title={
							microphoneEnabled
								? `${t("recording.microphone")}: ON (${t("recording.disableMicrophone")})`
								: `${t("recording.microphone")}: OFF (${t("recording.enableMicrophone")})`
						}
						className={`relative transition-all duration-150 rounded-[11px] ${
							microphoneEnabled
								? "text-emerald-400 bg-emerald-500/15 border border-emerald-500/35 shadow-[0_0_12px_rgba(16,185,129,0.25)] hover:bg-emerald-500/25 hover:text-emerald-300"
								: "text-red-400/90 bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40"
						}`}
						aria-label={
							microphoneEnabled
								? t("recording.disableMicrophone")
								: t("recording.enableMicrophone")
						}
					>
						{microphoneEnabled ? (
							<>
								<MicrophoneIcon size={18} weight="fill" />
								<span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-[var(--launch-bar-bg,#121215)] shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse" />
							</>
						) : (
							<>
								<MicrophoneSlashIcon size={18} />
								<span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-400/80 ring-2 ring-[var(--launch-bar-bg,#121215)]" />
							</>
						)}
					</Button>
				}
			/>

			<WebcamPopover
				disabled={recording}
				webcamEnabled={webcamEnabled}
				onDisableWebcam={() => setWebcamEnabled(false)}
				canToggleFloatingPreview={canToggleFloatingWebcamPreview(
					hudOverlayMousePassthroughSupported,
				)}
				showFloatingWebcamPreview={showFloatingWebcamPreview}
				onToggleFloatingPreview={() =>
					setShowFloatingWebcamPreview((current) => !current)
				}
				showWebcamControls={showWebcamControls}
				setWebcamPreviewNode={setWebcamPreviewNode}
				videoDevices={videoDevices}
				webcamDeviceId={webcamDeviceId}
				selectedVideoDeviceId={selectedVideoDeviceId}
				onSelectVideoDevice={(deviceId) => {
					setWebcamEnabled(true);
					setSelectedVideoDeviceId(deviceId);
					setWebcamDeviceId(deviceId);
				}}
				trigger={
					<Button
						variant="ghost"
						size="icon"
						iconSize="lg"
						title={
							webcamEnabled
								? `${t("recording.webcam")}: ON (${t("recording.disableWebcam")})`
								: `${t("recording.webcam")}: OFF (${t("recording.enableWebcam")})`
						}
						className={`relative transition-all duration-150 rounded-[11px] ${
							webcamEnabled
								? "text-blue-400 bg-blue-500/15 border border-blue-500/35 shadow-[0_0_12px_rgba(59,130,246,0.25)] hover:bg-blue-500/25 hover:text-blue-300"
								: "text-[var(--launch-text-muted)] bg-transparent border border-transparent hover:bg-[var(--launch-hover)] hover:text-[var(--launch-text)]"
						}`}
						aria-label={
							webcamEnabled
								? t("recording.disableWebcam")
								: t("recording.enableWebcam")
						}
					>
						{webcamEnabled ? (
							<>
								<VideoCameraIcon size={18} weight="fill" />
								<span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 ring-2 ring-[var(--launch-bar-bg,#121215)] shadow-[0_0_6px_rgba(96,165,250,0.9)] animate-pulse" />
							</>
						) : (
							<VideoCameraSlashIcon size={18} />
						)}
					</Button>
				}
			/>

			<CountdownPopover
				countdownDelay={countdownDelay}
				onSelectDelay={setCountdownDelay}
				trigger={
					<Button
						variant="ghost"
						size="icon"
						iconSize="lg"
						title={t("recording.countdownDelay")}
						className={countdownDelay > 0 ? styles.ibActive : ""}
					>
						<TimerIcon size={18} />
					</Button>
				}
			/>


			<button
				type="button"
				className={`${styles.recBtn} ${starting ? styles.recBtnStarting : ""} ${styles.electronNoDrag}`}
				onClick={
					hasSelectedSource || platform === "linux"
						? toggleRecording
						: () => {
								beginInteractiveHudAction();
								requestOpen("sources");
						  }
				}
				disabled={countdownActive || starting}
				title={starting ? t("recording.starting", "Starting recording...") : t("recording.record")}
			>
				{starting ? <div className={styles.recSpinner} /> : <div className={styles.recDot} />}
			</button>

			<Separator orientation="vertical" className="mx-[5px] h-6" />

			<div className="relative w-0 h-0">
				<ProjectPopover
					entries={projectLibraryEntries}
					onOpenProject={openProjectFromLibrary}
					trigger={<div className="absolute inset-0 pointer-events-none opacity-0" />}
				/>
			</div>

			<MorePopover
				supportsHudCaptureProtection={supportsHudCaptureProtection}
				hideHudFromCapture={hideHudFromCapture}
				onToggleHudCaptureProtection={() => {
					void toggleHudCaptureProtection();
				}}
				onChooseRecordingsDirectory={() => {
					void chooseRecordingsDirectory();
				}}
				onOpenVideoFile={() => {
					void openVideoFile();
				}}
				onOpenProjectBrowser={() => {
					refreshProjectLibrary().then(() => {
						requestOpen("projects");
					});
				}}
				showDevUpdatePreview={SHOW_DEV_UPDATE_PREVIEW}
				onPreviewUpdateUi={() => {
					if (openId) requestClose(openId);
					void window.electronAPI.previewUpdateToast().catch((error) => {
						console.warn("Failed to preview update toast:", error);
					});
				}}
				appVersion={appVersion}
				trigger={
					<Button
						variant="ghost"
						size="icon"
						iconSize="lg"
						title={t("recording.more")}
					>
						<DotsThreeVerticalIcon size={18} />
					</Button>
				}
			/>

			<Button
				variant="ghost"
				size="icon"
				iconSize="lg"
				onClick={() => window.electronAPI?.hudOverlayHide?.()}
				title={t("recording.hideHud")}
			>
				<MinusIcon size={16} />
			</Button>

			<Button
				variant="ghost"
				size="icon"
				iconSize="lg"
				onClick={() => window.electronAPI?.hudOverlayClose?.()}
				title={t("recording.closeApp")}
			>
				<XIcon size={16} />
			</Button>
		</>
	);

	const finalizingControls = (
		<div className={styles.finalizingState}>
			<ArrowClockwiseIcon size={15} className={styles.finalizingSpin} />
			<div className={styles.finalizingCopy}>
				<span>{t("recording.preparing", "Preparing recording")}</span>
				<small>{t("recording.preparingSubtitle", "Opening the editor in a moment")}</small>
			</div>
		</div>
	);

	const hudMode = finalizing ? "finalizing" : recording ? "recording" : "idle";

	return (
		<HudInteractionContext.Provider value={{ onMouseEnter: handleHudMouseEnter, onMouseLeave: handleHudMouseLeave }}>
			<div
				className="fixed inset-0 flex justify-center bg-transparent overflow-visible items-end pb-5 pointer-events-none"
			>
			<div
				ref={hudContentRef}
				className="flex items-center overflow-visible flex-col-reverse pointer-events-none"
			>
				<div
					className="flex flex-col items-center overflow-visible pointer-events-none p-2"
				>
					<div
						ref={hudBarTransformRef}
						data-hud-interactive
						className="pointer-events-auto overflow-visible"
						onMouseEnter={handleHudMouseEnter}
						onMouseLeave={handleHudMouseLeave}
						style={{
							transform: `translate3d(${recordingHudOffset.x}px, ${recordingHudOffset.y}px, 0)`,
						}}
					>
						<motion.div
							ref={hudBarRef}
							data-hud-interactive
							layout="size"
							transition={hudStateTransition}
							className={`${styles.bar} launch-theme mb-2 pointer-events-auto`}
						>
							<div
								// On Linux (especially Wayland) the compositor owns window
								// placement, so BrowserWindow.setBounds() is silently ignored.
								// Fall back to a native OS drag via -webkit-app-region on the
								// handle.  We still need JS pointer handlers in webcam-preview
								// mode (which translates via CSS inside the window), so only
								// mark the handle as a native drag region for the IPC path.
								aria-label="Move recording hub"
								style={{ touchAction: "none" }}
								className={`flex items-center px-0.5 cursor-grab active:cursor-grabbing pointer-events-auto ${
									platform === "linux" && !showRecordingWebcamPreview
										? styles.electronDrag
										: ""
								}`}
								onPointerDown={handleHudBarPointerDown}
								onPointerMove={handleHudBarPointerMove}
								onPointerUp={handleHudBarPointerUp}
								onPointerCancel={handleHudBarPointerUp}
							>
								<RxDragHandleDots2 size={14} className="text-[#6b6b78]" />
							</div>

							<div className={styles.barStateViewport}>
								<AnimatePresence initial={false} mode="wait">
									<motion.div
										key={hudMode}
										layout="size"
										className={styles.barState}
										initial={{
											opacity: 0,
											y: 10,
											scale: 0.985,
											filter: "blur(8px)",
										}}
										animate={{
											opacity: 1,
											y: 0,
											scale: 1,
											filter: "blur(0px)",
										}}
										exit={{
											opacity: 0,
											y: -10,
											scale: 0.985,
											filter: "blur(6px)",
										}}
										transition={hudStateTransition}
									>
										{finalizing
											? finalizingControls
											: recording
												? recordingControls
												: idleControls}
									</motion.div>
								</AnimatePresence>
							</div>
						</motion.div>
					</div>
					{showRecordingWebcamPreview && (
						<div
							ref={recordingWebcamPreviewContainerRef}
							className={`${styles.recordingWebcamPreview} ${styles.electronNoDrag} pointer-events-auto`}
							data-hud-interactive
							title={t("recording.webcam")}
							style={{
								transform: `translate(${webcamPreviewOffset.x}px, ${webcamPreviewOffset.y}px)`,
							}}
							onMouseEnter={handleHudMouseEnter}
							onMouseLeave={handleHudMouseLeave}
							onPointerDown={handleWebcamPreviewPointerDown}
							onPointerMove={handleWebcamPreviewPointerMove}
							onPointerUp={handleWebcamPreviewPointerUp}
							onPointerCancel={handleWebcamPreviewPointerUp}
						>
							<video
								ref={setRecordingWebcamPreviewNode}
								className={styles.recordingWebcamPreviewVideo}
								muted
								playsInline
								style={{ transform: "scaleX(-1)" }}
							/>
						</div>
					)}
				</div>

			</div>
		</div>
		</HudInteractionContext.Provider>
	);
}
