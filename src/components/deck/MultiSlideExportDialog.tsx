import React, { useState } from "react";
import {
	CheckCircle,
	DownloadSimple,
	FilmSlate,
	FolderOpen,
	Spinner,
	WarningCircle,
	X,
} from "@phosphor-icons/react";
import {
	type ExportProgressUpdate,
	exportMultiSlideProject,
} from "@/core/export/multiSlideExporter";
import { useSlideDeck } from "@/core/slides/SlideDeckContext";

interface MultiSlideExportDialogProps {
	isOpen: boolean;
	onClose: () => void;
}

export const MultiSlideExportDialog: React.FC<MultiSlideExportDialogProps> = ({
	isOpen,
	onClose,
}) => {
	const { project } = useSlideDeck();

	const [isExporting, setIsExporting] = useState(false);
	const [progress, setProgress] = useState<ExportProgressUpdate | null>(null);
	const [exportSuccessPath, setExportSuccessPath] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	const totalDurationSec = project.slides.reduce(
		(acc, s) => acc + s.durationMs / 1000,
		0,
	);

	if (!isOpen) return null;

	const handleStartExport = async () => {
		setIsExporting(true);
		setErrorMessage(null);
		setExportSuccessPath(null);

		const defaultFileName = `${project.title.replace(/[^a-zA-Z0-9_-]/g, "_")}-${Date.now()}.mp4`;
		let outputPath = defaultFileName;

		// Ask user for save destination via electron dialog if available
		if (window.electronAPI?.showSaveDialog) {
			try {
				const saveResult = await window.electronAPI.showSaveDialog({
					title: "Simpan Video Ekspor",
					defaultPath: defaultFileName,
					filters: [{ name: "MP4 Video", extensions: ["mp4"] }],
				});

				if (saveResult.canceled || !saveResult.filePath) {
					setIsExporting(false);
					return;
				}
				outputPath = saveResult.filePath;
			} catch (e) {
				console.warn("Failed to open save dialog, using default path:", e);
			}
		}

		const result = await exportMultiSlideProject({
			project,
			outputPath,
			onProgress: (update) => setProgress(update),
		});

		setIsExporting(false);

		if (result.success && result.outputPath) {
			setExportSuccessPath(result.outputPath);
		} else {
			setErrorMessage(result.error || "Ekspor gagal diselesaikan.");
		}
	};

	const handleOpenFolder = () => {
		if (exportSuccessPath && window.electronAPI?.revealInFolder) {
			window.electronAPI.revealInFolder(exportSuccessPath);
		}
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none">
			<div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-200">
				{/* Header */}
				<div className="flex items-center justify-between pb-3 border-b border-slate-800">
					<div className="flex items-center gap-2">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
							<FilmSlate size={18} weight="bold" />
						</div>
						<div>
							<h3 className="text-sm font-semibold text-white">Ekspor Multi-Slide Project</h3>
							<p className="text-[11px] text-slate-400">
								{project.slides.length} slide · Total durasi: {totalDurationSec.toFixed(1)}s
							</p>
						</div>
					</div>

					{!isExporting && (
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
						>
							<X size={16} />
						</button>
					)}
				</div>

				{/* Body */}
				<div className="py-5 space-y-4">
					{/* Status: Ready to Export */}
					{!isExporting && !exportSuccessPath && !errorMessage && (
						<div className="space-y-3">
							<div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2 text-xs">
								<div className="flex justify-between">
									<span className="text-slate-400">Resolusi Canvas:</span>
									<span className="font-semibold text-white">
										{project.canvas.width} x {project.canvas.height} ({project.canvas.aspectRatio || "16:9"})
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-400">Target Framerate:</span>
									<span className="font-semibold text-white">{project.canvas.fps} FPS</span>
								</div>
								<div className="flex justify-between">
									<span className="text-slate-400">Jumlah Transisi:</span>
									<span className="font-semibold text-white">
										{project.transitions.length} transisi
									</span>
								</div>
							</div>

							<p className="text-[11px] text-slate-400 leading-relaxed">
								Proses ekspor akan merender setiap slide secara modular dan menggabungkannya dengan transisi mulus menggunakan FFmpeg.
							</p>
						</div>
					)}

					{/* Status: Exporting in progress */}
					{isExporting && progress && (
						<div className="space-y-4 py-2">
							<div className="flex items-center justify-between text-xs">
								<span className="font-medium text-slate-200">{progress.message}</span>
								<span className="font-bold text-emerald-400">{progress.percentage}%</span>
							</div>

							{/* Progress Bar */}
							<div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
								<div
									className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all duration-300"
									style={{ width: `${progress.percentage}%` }}
								/>
							</div>

							{/* Stage Steps */}
							<div className="grid grid-cols-3 gap-2 pt-2 text-center text-[10px]">
								<div
									className={`rounded py-1.5 px-2 border ${
										progress.stage === "rendering-slide"
											? "border-emerald-500/40 bg-emerald-950/40 text-emerald-400 font-semibold"
											: "border-slate-800 bg-slate-900/40 text-slate-500"
									}`}
								>
									1. Render Slides
								</div>
								<div
									className={`rounded py-1.5 px-2 border ${
										progress.stage === "stitching"
											? "border-sky-500/40 bg-sky-950/40 text-sky-400 font-semibold"
											: "border-slate-800 bg-slate-900/40 text-slate-500"
									}`}
								>
									2. FFmpeg Stitch
								</div>
								<div
									className={`rounded py-1.5 px-2 border ${
										progress.stage === "completed"
											? "border-emerald-500/40 bg-emerald-950/40 text-emerald-400 font-semibold"
											: "border-slate-800 bg-slate-900/40 text-slate-500"
									}`}
								>
									3. Selesai
								</div>
							</div>
						</div>
					)}

					{/* Status: Success */}
					{exportSuccessPath && (
						<div className="flex flex-col items-center gap-3 py-3 text-center">
							<div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
								<CheckCircle size={32} weight="fill" />
							</div>
							<div>
								<h4 className="text-sm font-semibold text-white">Ekspor Video Sukses!</h4>
								<p className="mt-1 max-w-sm truncate text-xs text-slate-400 font-mono">
									{exportSuccessPath}
								</p>
							</div>
						</div>
					)}

					{/* Status: Error */}
					{errorMessage && (
						<div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3.5 flex items-start gap-2.5 text-xs text-rose-300">
							<WarningCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
							<div>
								<span className="font-semibold block mb-0.5">Ekspor Gagal</span>
								<span>{errorMessage}</span>
							</div>
						</div>
					)}
				</div>

				{/* Footer Controls */}
				<div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
					{exportSuccessPath ? (
						<>
							<button
								type="button"
								onClick={handleOpenFolder}
								className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
							>
								<FolderOpen size={14} />
								<span>Buka Folder</span>
							</button>
							<button
								type="button"
								onClick={onClose}
								className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
							>
								Tutup
							</button>
						</>
					) : (
						<>
							<button
								type="button"
								onClick={onClose}
								disabled={isExporting}
								className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
							>
								Batal
							</button>
							<button
								type="button"
								onClick={handleStartExport}
								disabled={isExporting}
								className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
							>
								{isExporting ? (
									<>
										<Spinner size={14} className="animate-spin" />
										<span>Mengekspor...</span>
									</>
								) : (
									<>
										<DownloadSimple size={14} weight="bold" />
										<span>Mulai Ekspor</span>
									</>
								)}
							</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
};
