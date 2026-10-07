import {
	CheckCircle,
	Clock,
	DownloadSimple,
	FolderOpen,
	SpeakerHigh,
	SpeakerSlash,
	WarningCircle,
	X,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";

export interface HyperframeExportModalProps {
	isOpen: boolean;
	hyperframeName: string;
	htmlContent: string;
	width: number;
	height: number;
	durationSec: number;
	companionAudioPath?: string | null;
	companionAudioName?: string | null;
	onClose: () => void;
}

export function HyperframeExportModal({
	isOpen,
	hyperframeName,
	htmlContent,
	width,
	height,
	durationSec,
	companionAudioPath,
	companionAudioName,
	onClose,
}: HyperframeExportModalProps) {
	const [fps, setFps] = useState<60 | 30>(60);
	const [quality, setQuality] = useState<"balanced" | "quality" | "fast">("balanced");
	const [includeAudio, setIncludeAudio] = useState(Boolean(companionAudioPath));
	const [outputPath, setOutputPath] = useState("");
	const [status, setStatus] = useState<"idle" | "exporting" | "completed" | "error">("idle");
	const [progress, setProgress] = useState({
		currentFrame: 0,
		totalFrames: Math.max(1, Math.round(durationSec * 60)),
		percentage: 0,
		stage: "preparing",
	});
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [exportedPath, setExportedPath] = useState<string | null>(null);
	const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

	// Reset state when opened
	useEffect(() => {
		if (isOpen) {
			setStatus("idle");
			setErrorMsg(null);
			setExportedPath(null);
			setActiveSessionId(null);
			setIncludeAudio(Boolean(companionAudioPath));
			const safeBaseName = hyperframeName
				.toLowerCase()
				.replace(/[^a-z0-9_-]+/g, "-")
				.replace(/^-+|-+$/g, "") || "hyperframe";
			setOutputPath(`${safeBaseName}.mp4`);
		}
	}, [isOpen, hyperframeName, companionAudioPath]);

	// Listen for live export progress
	useEffect(() => {
		if (status !== "exporting" || !window.electronAPI?.onHyperframeExportProgress) return;

		const unsubscribe = window.electronAPI.onHyperframeExportProgress((p) => {
			setProgress({
				currentFrame: p.currentFrame,
				totalFrames: p.totalFrames,
				percentage: p.percentage,
				stage: p.stage || "rendering",
			});
		});

		return () => {
			unsubscribe();
		};
	}, [status]);

	if (!isOpen) return null;

	const totalFrames = Math.max(1, Math.round(durationSec * fps));

	const handleBrowseDestination = async () => {
		if (!window.electronAPI?.showSaveDialog) return;
		const safeBaseName = outputPath.endsWith(".mp4") ? outputPath : `${outputPath}.mp4`;
		const res = await window.electronAPI.showSaveDialog({
			title: "Save Exported Video",
			defaultPath: safeBaseName,
			filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
		});
		if (res && !res.canceled && res.filePath) {
			setOutputPath(res.filePath);
		}
	};

	const handleStartExport = async () => {
		if (!window.electronAPI?.exportHyperframeVideo) {
			setErrorMsg("Electron Export API is not available in this environment.");
			setStatus("error");
			return;
		}

		let finalPath = outputPath.trim();
		if (!finalPath) {
			finalPath = `${hyperframeName.toLowerCase().replace(/[^a-z0-9_-]+/g, "-")}.mp4`;
		}

		// If user hasn't specified an absolute path with folder, prompt with save dialog
		if (!finalPath.includes("\\") && !finalPath.includes("/")) {
			if (window.electronAPI?.showSaveDialog) {
				const picked = await window.electronAPI.showSaveDialog({
					title: "Save Exported MP4 Video",
					defaultPath: finalPath,
					filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
				});
				if (picked.canceled || !picked.filePath) {
					return;
				}
				finalPath = picked.filePath;
				setOutputPath(finalPath);
			}
		}

		const sessionId = `hf-export-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		setActiveSessionId(sessionId);
		setStatus("exporting");
		setProgress({
			currentFrame: 0,
			totalFrames,
			percentage: 0,
			stage: "preparing",
		});
		setErrorMsg(null);

		const bitrate = quality === "quality" ? 24_000_000 : quality === "fast" ? 6_000_000 : 12_000_000;

		try {
			const res = await window.electronAPI.exportHyperframeVideo({
				sessionId,
				htmlContent,
				width,
				height,
				fps,
				durationSec,
				bitrate,
				encodingMode: quality,
				audioSourcePath: includeAudio ? companionAudioPath : null,
				outputPath: finalPath,
			});

			if (res.success && res.outputPath) {
				setStatus("completed");
				setExportedPath(res.outputPath);
			} else {
				setStatus("error");
				setErrorMsg(res.error || "Rendering pipeline failed without returning valid output.");
			}
		} catch (err) {
			setStatus("error");
			setErrorMsg(err instanceof Error ? err.message : String(err));
		}
	};

	const handleCancel = async () => {
		if (activeSessionId && window.electronAPI?.cancelHyperframeExport) {
			await window.electronAPI.cancelHyperframeExport(activeSessionId);
		}
		setStatus("idle");
	};

	const handleOpenFolder = () => {
		if (exportedPath && window.electronAPI?.revealInFolder) {
			window.electronAPI.revealInFolder(exportedPath);
		}
	};

	return (
		<div
			data-testid="hyperframe-export-modal"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fadeIn"
		>
			<div className="relative w-full max-w-lg rounded-2xl border border-[#343A46] bg-[#15171C] p-6 shadow-2xl space-y-5 text-[#F5F6F8]">
				{/* Header */}
				<div className="flex items-center justify-between border-b border-[#343A46] pb-3.5">
					<div className="flex items-center gap-2.5">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-[#6FA8FF] to-[#A879F5] text-[#15171C] font-bold shadow-md">
							<DownloadSimple size={18} weight="bold" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-white">Export Video</h3>
							<p className="text-xs text-[#A8AFBD]">{hyperframeName}</p>
						</div>
					</div>

					{status !== "exporting" && (
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg p-1.5 text-[#A8AFBD] hover:bg-[#242832] hover:text-white transition"
						>
							<X size={16} />
						</button>
					)}
				</div>

				{/* Body Content by Status */}
				{status === "idle" && (
					<div className="space-y-4 text-xs">
						{/* Configuration Grid */}
						<div className="grid grid-cols-2 gap-3">
							{/* Resolution (Match Canvas) */}
							<div className="rounded-xl border border-[#343A46] bg-[#1C1F26] p-3 space-y-1">
								<span className="text-[10px] font-bold uppercase tracking-wider text-[#A8AFBD]">
									Resolution
								</span>
								<div className="flex items-center justify-between">
									<span className="font-mono font-semibold text-white">
										{width}x{height}
									</span>
									<span className="rounded bg-[#6FA8FF]/15 px-1.5 py-0.5 font-mono text-[10px] text-[#6FA8FF]">
										100% Native
									</span>
								</div>
							</div>

							{/* Duration */}
							<div className="rounded-xl border border-[#343A46] bg-[#1C1F26] p-3 space-y-1">
								<span className="text-[10px] font-bold uppercase tracking-wider text-[#A8AFBD]">
									Duration & Frames
								</span>
								<div className="flex items-center justify-between">
									<span className="font-mono font-semibold text-white">{durationSec.toFixed(1)}s</span>
									<span className="rounded bg-[#242832] px-1.5 py-0.5 font-mono text-[10px] text-[#A8AFBD]">
										{totalFrames} frames
									</span>
								</div>
							</div>
						</div>

						{/* Framerate Selection */}
						<div className="space-y-1.5">
							<label className="text-[11px] font-bold text-[#A8AFBD]">Framerate</label>
							<div className="grid grid-cols-2 gap-2">
								<button
									type="button"
									onClick={() => setFps(60)}
									className={`flex items-center justify-between rounded-xl border p-2.5 transition ${
										fps === 60
											? "border-[#6FA8FF] bg-[#6FA8FF]/15 text-white font-bold"
											: "border-[#343A46] bg-[#1C1F26] text-[#A8AFBD] hover:border-white/20"
									}`}
								>
									<span>60 fps (Smooth Motion)</span>
									<span className="rounded bg-[#6FA8FF]/20 px-1 py-0.2 text-[9px] text-[#6FA8FF]">
										Best
									</span>
								</button>

								<button
									type="button"
									onClick={() => setFps(30)}
									className={`flex items-center justify-between rounded-xl border p-2.5 transition ${
										fps === 30
											? "border-[#6FA8FF] bg-[#6FA8FF]/15 text-white font-bold"
											: "border-[#343A46] bg-[#1C1F26] text-[#A8AFBD] hover:border-white/20"
									}`}
								>
									<span>30 fps (Standard Web)</span>
								</button>
							</div>
						</div>

						{/* Quality Selection */}
						<div className="space-y-1.5">
							<label className="text-[11px] font-bold text-[#A8AFBD]">Quality Preset</label>
							<div className="grid grid-cols-3 gap-2">
								{(
									[
										{ id: "balanced", label: "Balanced", bit: "12 Mbps" },
										{ id: "quality", label: "High Quality", bit: "24 Mbps" },
										{ id: "fast", label: "Fast", bit: "6 Mbps" },
									] as const
								).map((q) => (
									<button
										key={q.id}
										type="button"
										onClick={() => setQuality(q.id)}
										className={`flex flex-col items-center rounded-xl border p-2 transition ${
											quality === q.id
												? "border-[#A879F5] bg-[#A879F5]/15 text-white font-bold"
												: "border-[#343A46] bg-[#1C1F26] text-[#A8AFBD] hover:border-white/20"
										}`}
									>
										<span>{q.label}</span>
										<span className="text-[10px] text-[#717887] font-mono">{q.bit}</span>
									</button>
								))}
							</div>
						</div>

						{/* Companion Audio Option */}
						{companionAudioPath && (
							<div className="rounded-xl border border-[#343A46] bg-[#1C1F26] p-3 space-y-2">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-2">
										{includeAudio ? (
											<SpeakerHigh size={15} weight="bold" className="text-[#8DDB9B]" />
										) : (
											<SpeakerSlash size={15} className="text-[#717887]" />
										)}
										<span className="font-semibold text-white">Include Audio Track</span>
									</div>
									<input
										type="checkbox"
										checked={includeAudio}
										onChange={(e) => setIncludeAudio(e.target.checked)}
										className="h-4 w-4 rounded border-[#343A46] text-[#6FA8FF] focus:ring-0 cursor-pointer"
									/>
								</div>
								{companionAudioName && (
									<p className="text-[11px] text-[#A8AFBD] truncate">
										Source: <span className="font-mono text-slate-300">{companionAudioName}</span>
									</p>
								)}
							</div>
						)}

						{/* Destination File Picker */}
						<div className="space-y-1.5">
							<label className="text-[11px] font-bold text-[#A8AFBD]">Output File</label>
							<div className="flex gap-2">
								<input
									type="text"
									value={outputPath}
									onChange={(e) => setOutputPath(e.target.value)}
									placeholder="e.g. C:\Videos\my-video.mp4"
									className="flex-1 rounded-xl border border-[#343A46] bg-[#1C1F26] px-3 py-2 text-xs text-white placeholder-[#717887] outline-none focus:border-[#6FA8FF]"
								/>
								<button
									type="button"
									onClick={handleBrowseDestination}
									className="rounded-xl border border-[#343A46] bg-[#242832] px-3 py-2 text-xs font-semibold text-[#A8AFBD] hover:text-white transition"
								>
									Browse...
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Exporting Progress View */}
				{status === "exporting" && (
					<div className="space-y-4 py-4 text-center">
						<div className="flex justify-center">
							<div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6FA8FF]/15 text-[#6FA8FF] shadow-inner">
								<Clock size={32} weight="bold" className="animate-spin" />
							</div>
						</div>

						<div className="space-y-1">
							<h4 className="text-sm font-bold text-white">
								{progress.stage === "preparing" && "Preparing Offscreen Renderer..."}
								{progress.stage === "rendering" &&
									`Rendering Frame ${progress.currentFrame} of ${progress.totalFrames}`}
								{progress.stage === "muxing" && "Muxing Companion Audio Stream..."}
								{progress.stage === "completed" && "Finalizing Video File..."}
							</h4>
							<p className="font-mono text-xs text-[#A8AFBD]">{progress.percentage}% completed</p>
						</div>

						{/* Progress Bar */}
						<div className="h-3 w-full overflow-hidden rounded-full bg-[#1C1F26] border border-[#343A46]">
							<div
								className="h-full bg-gradient-to-r from-[#6FA8FF] via-[#A879F5] to-[#8DDB9B] transition-all duration-200"
								style={{ width: `${progress.percentage}%` }}
							/>
						</div>

						<p className="text-[11px] text-[#717887]">
							Rendering frames directly with hardware acceleration. Do not close this window.
						</p>
					</div>
				)}

				{/* Completed View */}
				{status === "completed" && (
					<div className="space-y-4 py-4 text-center">
						<div className="flex justify-center">
							<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#8DDB9B]/15 text-[#8DDB9B] shadow-lg">
								<CheckCircle size={36} weight="fill" />
							</div>
						</div>

						<div className="space-y-1">
							<h4 className="text-sm font-bold text-white">Export Complete!</h4>
							<p className="text-xs text-[#A8AFBD]">
								Rendered {progress.totalFrames} frames ({durationSec.toFixed(1)}s at {fps}fps) successfully.
							</p>
						</div>

						{exportedPath && (
							<div className="rounded-xl border border-[#343A46] bg-[#1C1F26] p-3 text-left">
								<span className="text-[10px] font-bold uppercase tracking-wider text-[#A8AFBD]">
									Location:
								</span>
								<p className="mt-1 font-mono text-[11px] text-white truncate select-all">
									{exportedPath}
								</p>
							</div>
						)}
					</div>
				)}

				{/* Error View */}
				{status === "error" && (
					<div className="space-y-3 py-2">
						<div className="flex items-center gap-2.5 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
							<WarningCircle size={20} weight="fill" className="shrink-0 text-red-400" />
							<div>
								<span className="font-bold">Export Failed:</span>
								<p className="mt-0.5 font-mono text-[11px] leading-relaxed break-words">
									{errorMsg || "An unexpected error occurred during rendering."}
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Modal Footer Actions */}
				<div className="flex items-center justify-end gap-2.5 border-t border-[#343A46] pt-3.5">
					{status === "idle" && (
						<>
							<button
								type="button"
								onClick={onClose}
								className="rounded-xl border border-[#343A46] bg-[#1C1F26] px-4 py-2 text-xs font-semibold text-[#A8AFBD] hover:text-white transition"
							>
								Cancel
							</button>

							<button
								type="button"
								onClick={handleStartExport}
								className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#6FA8FF] to-[#A879F5] px-4 py-2 text-xs font-bold text-[#15171C] shadow-lg hover:brightness-110 transition active:scale-95"
							>
								<DownloadSimple size={15} weight="bold" />
								<span>Start Export</span>
							</button>
						</>
					)}

					{status === "exporting" && (
						<button
							type="button"
							onClick={handleCancel}
							className="rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2 text-xs font-bold text-red-300 hover:bg-red-500/25 transition"
						>
							Cancel Export
						</button>
					)}

					{status === "completed" && (
						<>
							<button
								type="button"
								onClick={handleOpenFolder}
								className="flex items-center gap-1.5 rounded-xl border border-[#343A46] bg-[#1C1F26] px-4 py-2 text-xs font-semibold text-white hover:border-[#6FA8FF] transition"
							>
								<FolderOpen size={15} className="text-[#6FA8FF]" />
								<span>Open in Folder</span>
							</button>

							<button
								type="button"
								onClick={onClose}
								className="rounded-xl bg-[#6FA8FF] px-4 py-2 text-xs font-bold text-[#15171C] hover:bg-[#85b7ff] transition"
							>
								Done
							</button>
						</>
					)}

					{status === "error" && (
						<>
							<button
								type="button"
								onClick={onClose}
								className="rounded-xl border border-[#343A46] bg-[#1C1F26] px-4 py-2 text-xs font-semibold text-[#A8AFBD] hover:text-white transition"
							>
								Close
							</button>

							<button
								type="button"
								onClick={handleStartExport}
								className="rounded-xl bg-gradient-to-r from-[#6FA8FF] to-[#A879F5] px-4 py-2 text-xs font-bold text-[#15171C] hover:brightness-110 transition"
							>
								Try Again
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
