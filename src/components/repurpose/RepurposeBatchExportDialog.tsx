import {
	CheckCircle,
	CheckSquare,
	CircleNotch,
	FolderOpen,
	Square,
	WarningCircle,
	X,
} from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";
import { getArtboardProjectView } from "@/core/timeline/repurposeCommands";
import type { RepurposeArtboard, RepurposeSlice } from "@/core/timeline/repurposeTypes";
import type { TimelineProject } from "@/core/timeline/types";
import { TimelineProjectExporter } from "@/lib/exporter/timelineProjectExporter";

export interface RepurposeBatchExportDialogProps {
	project: TimelineProject;
	projectTitle: string;
	onClose: () => void;
}

interface ExportItemTask {
	artboard: RepurposeArtboard;
	slice: RepurposeSlice;
	fileName: string;
	outputPath?: string;
}

function sanitizeFileName(name: string): string {
	return name.replace(/[<>:"/\\|?*]/g, "_").trim();
}

export function RepurposeBatchExportDialog({
	project,
	projectTitle,
	onClose,
}: RepurposeBatchExportDialogProps) {
	const board = project.repurposeBoard;
	const artboards = useMemo(() => board?.artboards ?? [], [board]);
	const slices = useMemo(() => board?.slices ?? [], [board]);

	// Selection state: by default, all enabled artboards and all slices selected
	const [selectedArtboardIds, setSelectedArtboardIds] = useState<Set<string>>(
		() => new Set(artboards.map((a) => a.id)),
	);
	const [selectedSliceIds, setSelectedSliceIds] = useState<Set<string>>(
		() => new Set(slices.map((s) => s.id)),
	);
	const [outputDir, setOutputDir] = useState<string>("");

	// Export running state
	const [isExporting, setIsExporting] = useState(false);
	const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
	const [totalTasksCount, setTotalTasksCount] = useState(0);
	const [currentFileProgress, setCurrentFileProgress] = useState(0);
	const [currentFileName, setCurrentFileName] = useState("");
	const [exportError, setExportError] = useState<string | null>(null);
	const [completedFiles, setCompletedFiles] = useState<string[]>([]);
	const [isFinished, setIsFinished] = useState(false);

	const abortControllerRef = useRef<AbortController | null>(null);

	const titleSafe = sanitizeFileName(projectTitle || "Project");

	// Build queue of tasks based on selected artboards and slices
	const tasks: ExportItemTask[] = useMemo(() => {
		const chosenArtboards = artboards.filter((a) => selectedArtboardIds.has(a.id));
		const chosenSlices = slices.filter((s) => selectedSliceIds.has(s.id));
		const list: ExportItemTask[] = [];

		for (const slice of chosenSlices) {
			const sliceNameSafe = sanitizeFileName(slice.name || "Slice");
			for (const ab of chosenArtboards) {
				const aspectSafe = ab.aspectRatio.replace(":", "x");
				const fileName = `${titleSafe}_${sliceNameSafe}_${aspectSafe}.mp4`;
				const outputPath = outputDir
					? `${outputDir.replace(/[/\\]+$/, "")}/${fileName}`
					: undefined;
				list.push({
					artboard: ab,
					slice,
					fileName,
					outputPath,
				});
			}
		}
		return list;
	}, [artboards, slices, selectedArtboardIds, selectedSliceIds, titleSafe, outputDir]);

	const handleChooseDirectory = async () => {
		if (!window.electronAPI?.showOpenDialog) {
			return;
		}
		try {
			const res = await window.electronAPI.showOpenDialog({
				title: "Select Folder for Repurposed Videos",
				properties: ["openDirectory", "createDirectory"],
			});
			if (!res.canceled && res.filePaths?.[0]) {
				setOutputDir(res.filePaths[0]);
			}
		} catch (e) {
			console.warn("Folder picker error:", e);
		}
	};

	const toggleArtboard = (id: string) => {
		setSelectedArtboardIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const toggleSlice = (id: string) => {
		setSelectedSliceIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	};

	const handleSelectAllArtboards = () => {
		if (selectedArtboardIds.size === artboards.length) {
			setSelectedArtboardIds(new Set());
		} else {
			setSelectedArtboardIds(new Set(artboards.map((a) => a.id)));
		}
	};

	const handleSelectAllSlices = () => {
		if (selectedSliceIds.size === slices.length) {
			setSelectedSliceIds(new Set());
		} else {
			setSelectedSliceIds(new Set(slices.map((s) => s.id)));
		}
	};

	const handleStartBatchExport = async () => {
		if (tasks.length === 0) return;
		setIsExporting(true);
		setExportError(null);
		setIsFinished(false);
		setCompletedFiles([]);
		setTotalTasksCount(tasks.length);
		setCurrentTaskIndex(0);

		const abort = new AbortController();
		abortControllerRef.current = abort;

		const exporter = new TimelineProjectExporter();
		const finishedList: string[] = [];

		try {
			for (let i = 0; i < tasks.length; i++) {
				if (abort.signal.aborted) break;

				const task = tasks[i]!;
				setCurrentTaskIndex(i);
				setCurrentFileName(task.fileName);
				setCurrentFileProgress(0);

				const projectToExport = task.artboard.tracks
					? getArtboardProjectView(project, task.artboard.id)
					: project;

				const result = await exporter.export(projectToExport, {
					outputPath: task.outputPath || "",
					fileName: task.fileName,
					fps: projectToExport.canvas.fps || 30,
					artboard: task.artboard,
					timeRangeUs: {
						startUs: task.slice.startUs,
						endUs: task.slice.endUs,
					},
					signal: abort.signal,
					onProgress: (pct) => {
						setCurrentFileProgress(Math.round(pct));
					},
				});

				if (result.canceled) {
					break;
				}

				if (!result.success) {
					throw new Error(result.error ?? `Failed to export ${task.fileName}`);
				}

				if (result.outputPath) {
					finishedList.push(result.outputPath);
				} else {
					finishedList.push(task.fileName);
				}
				setCompletedFiles([...finishedList]);
			}

			if (!abort.signal.aborted) {
				setIsFinished(true);
			}
		} catch (err) {
			if (!abort.signal.aborted) {
				setExportError(
					err instanceof Error ? err.message : String(err || "Batch export failed"),
				);
			}
		} finally {
			setIsExporting(false);
			abortControllerRef.current = null;
		}
	};

	const handleCancelExport = () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		setIsExporting(false);
	};

	const overallPercent =
		totalTasksCount > 0
			? Math.round(((currentTaskIndex + currentFileProgress / 100) / totalTasksCount) * 100)
			: 0;

	return (
		<div className="repurpose-dialog-backdrop" role="dialog" aria-modal="true">
			<div className="repurpose-dialog-container">
				<header className="repurpose-dialog-header">
					<div className="repurpose-dialog-title">
						<h2>Batch Export Repurposed Media</h2>
						<span className="repurpose-dialog-subtitle">
							Export combinations of screen aspect ratios and video slices
						</span>
					</div>
					{!isExporting && (
						<button
							type="button"
							className="repurpose-dialog-close-btn"
							onClick={onClose}
							aria-label="Close dialog"
						>
							<X size={16} />
						</button>
					)}
				</header>

				<div className="repurpose-dialog-content">
					{exportError && (
						<div className="repurpose-dialog-error">
							<WarningCircle size={16} weight="fill" />
							<span>{exportError}</span>
						</div>
					)}

					{isFinished ? (
						<div className="repurpose-dialog-finished">
							<CheckCircle
								size={48}
								weight="fill"
								className="repurpose-success-icon"
							/>
							<h3>Batch Export Completed!</h3>
							<p>
								Successfully exported {completedFiles.length} video
								{completedFiles.length > 1 ? "s" : ""}.
							</p>
							<div className="repurpose-finished-filelist">
								{completedFiles.map((f) => (
									<div key={f} className="repurpose-finished-item">
										✓ {f}
									</div>
								))}
							</div>
						</div>
					) : isExporting ? (
						<div className="repurpose-dialog-progress-state">
							<div className="repurpose-progress-header">
								<div className="repurpose-progress-label">
									<CircleNotch size={18} className="repurpose-spinning-icon" />
									<span>
										Exporting file {currentTaskIndex + 1} of {totalTasksCount}
									</span>
								</div>
								<span className="repurpose-overall-badge">{overallPercent}%</span>
							</div>

							{/* Overall Progress Bar */}
							<div className="repurpose-progress-bar-bg">
								<div
									className="repurpose-progress-bar-fill"
									style={{ width: `${overallPercent}%` }}
								/>
							</div>

							<div className="repurpose-current-file-box">
								<span className="repurpose-current-filename">
									{currentFileName}
								</span>
								<div className="repurpose-sub-progress-bar-bg">
									<div
										className="repurpose-sub-progress-bar-fill"
										style={{ width: `${currentFileProgress}%` }}
									/>
								</div>
								<span className="repurpose-file-progress-text">
									Current item: {currentFileProgress}%
								</span>
							</div>
						</div>
					) : (
						<>
							{/* Section 1: Artboard Aspect Ratios */}
							<div className="repurpose-dialog-section">
								<div className="repurpose-section-header">
									<label className="repurpose-section-title">
										Select Target Screen Formats ({selectedArtboardIds.size}/
										{artboards.length})
									</label>
									<button
										type="button"
										className="repurpose-section-toggle"
										onClick={handleSelectAllArtboards}
									>
										{selectedArtboardIds.size === artboards.length
											? "Deselect All"
											: "Select All"}
									</button>
								</div>
								<div className="repurpose-grid-options">
									{artboards.map((ab) => {
										const isChecked = selectedArtboardIds.has(ab.id);
										return (
											<button
												key={ab.id}
												type="button"
												className={`repurpose-option-card ${isChecked ? "checked" : ""}`}
												onClick={() => toggleArtboard(ab.id)}
											>
												{isChecked ? (
													<CheckSquare
														size={16}
														weight="fill"
														color="#3b82f6"
													/>
												) : (
													<Square size={16} color="#6b7280" />
												)}
												<div className="repurpose-option-info">
													<div className="repurpose-option-title">
														<span className="repurpose-badge-aspect">
															{ab.aspectRatio}
														</span>
														<span>{ab.name}</span>
													</div>
													<span className="repurpose-option-sub">
														{ab.width} × {ab.height}
													</span>
												</div>
											</button>
										);
									})}
								</div>
							</div>

							{/* Section 2: Video Slices */}
							<div className="repurpose-dialog-section">
								<div className="repurpose-section-header">
									<label className="repurpose-section-title">
										Select Video Slices ({selectedSliceIds.size}/{slices.length}
										)
									</label>
									<button
										type="button"
										className="repurpose-section-toggle"
										onClick={handleSelectAllSlices}
									>
										{selectedSliceIds.size === slices.length
											? "Deselect All"
											: "Select All"}
									</button>
								</div>
								<div className="repurpose-grid-options">
									{slices.map((slice) => {
										const isChecked = selectedSliceIds.has(slice.id);
										const durationSec =
											(slice.endUs - slice.startUs) / 1_000_000;
										return (
											<button
												key={slice.id}
												type="button"
												className={`repurpose-option-card ${isChecked ? "checked" : ""}`}
												onClick={() => toggleSlice(slice.id)}
											>
												{isChecked ? (
													<CheckSquare
														size={16}
														weight="fill"
														color="#3b82f6"
													/>
												) : (
													<Square size={16} color="#6b7280" />
												)}
												<div className="repurpose-option-info">
													<div className="repurpose-option-title">
														<span
															className="repurpose-slice-dot"
															style={{
																backgroundColor:
																	slice.color || "#3b82f6",
															}}
														/>
														<span>
															{slice.name || "Untitled Slice"}
														</span>
													</div>
													<span className="repurpose-option-sub">
														{(slice.startUs / 1_000_000).toFixed(1)}s -{" "}
														{(slice.endUs / 1_000_000).toFixed(1)}s (
														{durationSec.toFixed(1)}s)
													</span>
												</div>
											</button>
										);
									})}
								</div>
							</div>

							{/* Section 3: Output Destination */}
							<div className="repurpose-dialog-section">
								<label className="repurpose-section-title">Output Folder</label>
								<div className="repurpose-dir-picker">
									<div className="repurpose-dir-input-box">
										<span className="repurpose-dir-path">
											{outputDir || "Default system Downloads folder"}
										</span>
									</div>
									<button
										type="button"
										className="repurpose-dir-btn"
										onClick={() => void handleChooseDirectory()}
									>
										<FolderOpen size={15} />
										<span>Choose Folder</span>
									</button>
								</div>
								<span className="repurpose-preview-hint">
									Batch will generate {tasks.length} file
									{tasks.length === 1 ? "" : "s"}
									{tasks.length > 0 && ` (e.g. ${tasks[0]!.fileName})`}
								</span>
							</div>
						</>
					)}
				</div>

				<footer className="repurpose-dialog-footer">
					{isFinished ? (
						<button type="button" className="repurpose-btn-primary" onClick={onClose}>
							Done
						</button>
					) : isExporting ? (
						<button
							type="button"
							className="repurpose-btn-danger"
							onClick={handleCancelExport}
						>
							Cancel Batch Export
						</button>
					) : (
						<>
							<button
								type="button"
								className="repurpose-btn-secondary"
								onClick={onClose}
							>
								Cancel
							</button>
							<button
								type="button"
								className="repurpose-btn-primary"
								disabled={tasks.length === 0}
								onClick={() => void handleStartBatchExport()}
							>
								Export {tasks.length} Video{tasks.length === 1 ? "" : "s"}
							</button>
						</>
					)}
				</footer>
			</div>
		</div>
	);
}
