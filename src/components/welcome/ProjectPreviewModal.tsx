import {
	Archive as ArchiveIcon,
	Check as CheckIcon,
	Copy as CopyIcon,
	Cursor as CursorIcon,
	Eye as EyeIcon,
	FileCode as FileCodeIcon,
	FileText as FileTextIcon,
	FilmStrip as FilmStripIcon,
	Folder as FolderIcon,
	FolderOpen as FolderOpenIcon,
	Image as ImageIcon,
	MusicNote as MusicNoteIcon,
	Play as PlayIcon,
	Sliders as SlidersIcon,
	X as XIcon,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface ProjectInspectionEntry {
	path: string;
	size: number;
	compressedSize: number;
	isDirectory: boolean;
	slideId?: string;
	category?: "config" | "thumbnail" | "video" | "audio" | "graphic" | "telemetry" | "other";
}

export interface InspectionClipData {
	id?: string;
	name?: string;
	videoPath?: string;
	duration?: number;
	editorMode?: "record" | "video";
	mode?: "record" | "video";
	telemetryPath?: string;
	cursorTelemetry?: unknown;
	transition?: {
		type?: string;
		duration?: number;
	};
}

export interface InspectionProjectData {
	projectName?: string;
	aspectRatio?: string;
	duration?: number;
	canvasBackground?: string;
	backgroundColor?: string;
	padding?: number;
	borderRadius?: number;
	shadowLevel?: string;
	autoZoomEnabled?: boolean;
	masterVolume?: number | string;
	audioSettings?: {
		duckingEnabled?: boolean;
		duckingAmountDb?: string | number;
	};
	clips?: InspectionClipData[];
	videoPath?: string;
	[key: string]: unknown;
}

export interface ProjectInspectionResult {
	success: boolean;
	filePath?: string;
	fileName?: string;
	fileSize?: number;
	lastModified?: number;
	isBundle?: boolean;
	thumbnailDataUrl?: string | null;
	projectData?: InspectionProjectData | null;
	entries?: ProjectInspectionEntry[];
	error?: string;
	canceled?: boolean;
}

interface ProjectPreviewModalProps {
	inspection: ProjectInspectionResult;
	onClose: () => void;
	onOpenProject: (path: string) => void;
}

function formatBytes(bytes?: number): string {
	if (!bytes || bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	const unitIndex = Math.min(i, units.length - 1);
	return `${(bytes / 1024 ** unitIndex).toFixed(1)} ${units[unitIndex]}`;
}

function formatDuration(seconds?: number): string {
	if (!seconds || seconds <= 0) return "0:00";
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function ProjectPreviewModal({
	inspection,
	onClose,
	onOpenProject,
}: ProjectPreviewModalProps) {
	const [activeTab, setActiveTab] = useState<"slides" | "config" | "json">("slides");
	const [hasCopiedJson, setHasCopiedJson] = useState(false);

	const {
		filePath,
		fileName,
		fileSize = 0,
		lastModified = 0,
		isBundle = false,
		thumbnailDataUrl,
		projectData,
		entries = [],
	} = inspection;

	// Extract project specs
	const aspectRatio = projectData?.aspectRatio || "16:9";
	const clips = useMemo(() => {
		if (Array.isArray(projectData?.clips) && projectData.clips.length > 0) {
			return projectData.clips;
		}
		if (projectData?.videoPath) {
			return [
				{
					id: "main-slide",
					videoPath: projectData.videoPath,
					duration: projectData.duration || 0,
				},
			];
		}
		return [];
	}, [projectData]);

	const totalDurationSec = useMemo(() => {
		if (typeof projectData?.duration === "number" && projectData.duration > 0) {
			return projectData.duration;
		}
		return clips.reduce((acc: number, c: InspectionClipData) => acc + (c.duration || 0), 0);
	}, [projectData, clips]);

	// Group entries by slide
	const { slideGroups, rootEntries, totalUncompressedBytes } = useMemo(() => {
		const groups: Record<string, ProjectInspectionEntry[]> = {};
		const roots: ProjectInspectionEntry[] = [];
		let totalBytes = 0;

		for (const entry of entries) {
			totalBytes += entry.size;
			if (entry.slideId) {
				if (!groups[entry.slideId]) {
					groups[entry.slideId] = [];
				}
				groups[entry.slideId].push(entry);
			} else {
				roots.push(entry);
			}
		}

		return {
			slideGroups: groups,
			rootEntries: roots,
			totalUncompressedBytes: totalBytes,
		};
	}, [entries]);

	const handleCopyJson = () => {
		if (!projectData) return;
		navigator.clipboard.writeText(JSON.stringify(projectData, null, 2)).then(() => {
			setHasCopiedJson(true);
			setTimeout(() => setHasCopiedJson(false), 2000);
		});
	};

	const handleRevealInExplorer = async () => {
		if (filePath && window.electronAPI?.revealInFolder) {
			await window.electronAPI.revealInFolder(filePath);
		}
	};

	const handleOpen = () => {
		if (filePath) {
			onOpenProject(filePath);
			onClose();
		}
	};

	const recordSlidesCount = clips.filter(
		(c: InspectionClipData) =>
			c.editorMode === "record" ||
			c.mode === "record" ||
			Boolean(c.telemetryPath || c.cursorTelemetry),
	).length;
	const videoSlidesCount = clips.length - recordSlidesCount;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
			<div className="flex flex-col w-full max-w-4xl h-[85vh] bg-editor-dialog border border-foreground/15 rounded-2xl shadow-2xl overflow-hidden text-foreground select-none">
				{/* Modal Header */}
				<div className="px-6 py-4 border-b border-foreground/10 bg-foreground/[0.02] flex items-center justify-between flex-shrink-0">
					<div className="flex items-center gap-3 min-w-0">
						<div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
							<EyeIcon className="w-5 h-5" weight="bold" />
						</div>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<h3 className="text-sm font-bold text-foreground truncate">
									{fileName || "Project Preview"}
								</h3>
								{isBundle ? (
									<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 text-[10px] font-semibold tracking-wide">
										<ArchiveIcon className="w-3 h-3" />
										ZIP BUNDLE
									</span>
								) : (
									<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 text-[10px] font-semibold tracking-wide">
										<FileTextIcon className="w-3 h-3" />
										NOT SUPPORTED
									</span>
								)}
							</div>
							<p className="text-[11px] text-muted-foreground truncate font-mono mt-0.5 max-w-lg">
								{filePath || "In-Memory"}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2 flex-shrink-0">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={onClose}
							className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-foreground/10"
							title="Close Preview"
						>
							<XIcon className="w-4 h-4" />
						</Button>
					</div>
				</div>

				{/* Modal Body: Split Layout */}
				<div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
					{/* Left Sidebar: Thumbnail & Specs */}
					<div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-foreground/10 p-5 flex flex-col gap-4 bg-foreground/[0.01] overflow-y-auto flex-shrink-0">
						{/* Visual Thumbnail */}
						<div className="space-y-1.5">
							<label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
								Project Snapshot
							</label>
							<div className="w-full aspect-video rounded-xl bg-foreground/5 border border-foreground/10 overflow-hidden relative shadow-inner flex items-center justify-center">
								{thumbnailDataUrl ? (
									<img
										src={thumbnailDataUrl}
										alt="Project Thumbnail"
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="flex flex-col items-center justify-center text-muted-foreground/60 gap-1.5 p-4 text-center">
										<FilmStripIcon className="w-8 h-8 opacity-40" />
										<span className="text-[11px]">No snapshot embedded</span>
									</div>
								)}
							</div>
						</div>

						{/* Key Specifications */}
						<div className="space-y-2.5 pt-2 border-t border-foreground/10">
							<label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
								Specifications
							</label>
							<div className="grid grid-cols-2 gap-2 text-xs">
								<div className="p-2.5 rounded-lg bg-foreground/[0.03] border border-foreground/5">
									<span className="text-[10px] text-muted-foreground block">
										Duration
									</span>
									<span className="font-bold text-foreground">
										{formatDuration(totalDurationSec)}
									</span>
								</div>
								<div className="p-2.5 rounded-lg bg-foreground/[0.03] border border-foreground/5">
									<span className="text-[10px] text-muted-foreground block">
										Aspect Ratio
									</span>
									<span className="font-bold text-foreground">{aspectRatio}</span>
								</div>
								<div className="p-2.5 rounded-lg bg-foreground/[0.03] border border-foreground/5">
									<span className="text-[10px] text-muted-foreground block">
										Total Slides
									</span>
									<span className="font-bold text-foreground">
										{clips.length}
									</span>
								</div>
								<div className="p-2.5 rounded-lg bg-foreground/[0.03] border border-foreground/5">
									<span className="text-[10px] text-muted-foreground block">
										Archive Size
									</span>
									<span className="font-bold text-foreground">
										{formatBytes(fileSize)}
									</span>
								</div>
							</div>

							<div className="p-2.5 rounded-lg bg-foreground/[0.02] border border-foreground/5 text-[11px] space-y-1 mt-1">
								<div className="flex items-center justify-between text-muted-foreground">
									<span>Slide Composition:</span>
									<span className="font-medium text-foreground">
										{recordSlidesCount} Record · {videoSlidesCount} Video
									</span>
								</div>
								<div className="flex items-center justify-between text-muted-foreground">
									<span>File Footprint:</span>
									<span className="font-mono text-[10px] text-foreground">
										{entries.length} files (
										{formatBytes(totalUncompressedBytes)})
									</span>
								</div>
								{lastModified > 0 && (
									<div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-foreground/5">
										<span>Modified:</span>
										<span className="text-foreground">
											{new Date(lastModified).toLocaleDateString(undefined, {
												month: "short",
												day: "numeric",
												year: "numeric",
											})}
										</span>
									</div>
								)}
							</div>
						</div>
					</div>

					{/* Right Content Area: Tabs */}
					<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
						{/* Tab Navigation */}
						<div className="flex items-center gap-2 px-5 pt-3 border-b border-foreground/10 bg-foreground/[0.01] flex-shrink-0">
							<button
								type="button"
								onClick={() => setActiveTab("slides")}
								className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-semibold border-b-2 transition-colors ${
									activeTab === "slides"
										? "border-primary text-primary bg-primary/[0.04]"
										: "border-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/[0.02]"
								}`}
							>
								<FolderIcon className="w-4 h-4" />
								<span>Isi Project & File Slide ({entries.length})</span>
							</button>

							<button
								type="button"
								onClick={() => setActiveTab("config")}
								className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-semibold border-b-2 transition-colors ${
									activeTab === "config"
										? "border-primary text-primary bg-primary/[0.04]"
										: "border-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/[0.02]"
								}`}
							>
								<SlidersIcon className="w-4 h-4" />
								<span>Konfigurasi & Settings</span>
							</button>

							<button
								type="button"
								onClick={() => setActiveTab("json")}
								className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-semibold border-b-2 transition-colors ${
									activeTab === "json"
										? "border-primary text-primary bg-primary/[0.04]"
										: "border-transparent text-muted-foreground hover:text-foreground hover:bg-foreground/[0.02]"
								}`}
							>
								<FileCodeIcon className="w-4 h-4" />
								<span>Raw JSON (project.json)</span>
							</button>
						</div>

						{/* Tab 1: Slides & File Explorer */}
						{activeTab === "slides" && (
							<div className="flex-1 overflow-y-auto p-5 space-y-4">
								<div className="flex items-center justify-between">
									<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
										Subfolder & Asset per Slide
									</h4>
									<span className="text-[11px] text-muted-foreground">
										{clips.length} Slides terdaftar di proyek
									</span>
								</div>

								{clips.map((clip: InspectionClipData, idx: number) => {
									const slideId = clip.id || `slide-${idx + 1}`;
									const slideEntries = slideGroups[slideId] || [];
									const isRecord =
										clip.editorMode === "record" ||
										clip.mode === "record" ||
										Boolean(clip.telemetryPath || clip.cursorTelemetry);

									return (
										<div
											key={slideId}
											className="p-3.5 rounded-xl border border-foreground/10 bg-foreground/[0.02] space-y-2.5"
										>
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<div
														className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold ${
															isRecord
																? "bg-red-500/20 text-red-400"
																: "bg-blue-500/20 text-blue-400"
														}`}
													>
														{idx + 1}
													</div>
													<div>
														<h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
															{clip.name || `Slide ${idx + 1}`}
															<span
																className={`text-[9px] px-1.5 py-0.2 rounded font-semibold uppercase ${
																	isRecord
																		? "bg-red-500/15 text-red-400"
																		: "bg-blue-500/15 text-blue-400"
																}`}
															>
																{isRecord ? "Record" : "Video"}
															</span>
														</h5>
														<p className="text-[10px] text-muted-foreground font-mono">
															slides/{slideId}/
														</p>
													</div>
												</div>
												<div className="text-right">
													<span className="text-xs font-semibold text-foreground">
														{formatDuration(clip.duration)}
													</span>
													<span className="text-[10px] text-muted-foreground block">
														{slideEntries.length} files
													</span>
												</div>
											</div>

											{/* Slide Files List */}
											<div className="space-y-1 pt-2 border-t border-foreground/5">
												{slideEntries.length > 0 ? (
													slideEntries.map((entry) => {
														let EntryIcon = FolderIcon;
														let colorClass = "text-muted-foreground";

														if (entry.category === "video") {
															EntryIcon = FilmStripIcon;
															colorClass = "text-sky-400";
														} else if (entry.category === "audio") {
															EntryIcon = MusicNoteIcon;
															colorClass = "text-purple-400";
														} else if (entry.category === "graphic") {
															EntryIcon = ImageIcon;
															colorClass = "text-emerald-400";
														} else if (entry.category === "telemetry") {
															EntryIcon = CursorIcon;
															colorClass = "text-amber-400";
														}

														return (
															<div
																key={entry.path}
																className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-foreground/[0.02] hover:bg-foreground/[0.04] text-[11px] font-mono"
															>
																<div className="flex items-center gap-2 min-w-0">
																	<EntryIcon
																		className={`w-3.5 h-3.5 flex-shrink-0 ${colorClass}`}
																	/>
																	<span className="text-foreground truncate">
																		{entry.path.replace(
																			`slides/${slideId}/`,
																			"",
																		)}
																	</span>
																</div>
																<div className="flex items-center gap-2 text-muted-foreground flex-shrink-0 ml-2">
																	<span>
																		{formatBytes(entry.size)}
																	</span>
																</div>
															</div>
														);
													})
												) : (
													<div className="text-[11px] text-muted-foreground italic py-1 px-2">
														File video utama:{" "}
														{clip.videoPath || "Belum ada file media"}
													</div>
												)}
											</div>
										</div>
									);
								})}

								{/* Root Files */}
								{rootEntries.length > 0 && (
									<div className="p-3.5 rounded-xl border border-foreground/10 bg-foreground/[0.02] space-y-2">
										<h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
											Root Project Files
										</h5>
										<div className="space-y-1">
											{rootEntries.map((entry) => (
												<div
													key={entry.path}
													className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-foreground/[0.02] text-[11px] font-mono"
												>
													<div className="flex items-center gap-2 min-w-0">
														{entry.category === "config" ? (
															<FileCodeIcon className="w-3.5 h-3.5 text-primary" />
														) : entry.category === "thumbnail" ? (
															<ImageIcon className="w-3.5 h-3.5 text-emerald-400" />
														) : (
															<FileTextIcon className="w-3.5 h-3.5 text-muted-foreground" />
														)}
														<span className="text-foreground truncate">
															{entry.path}
														</span>
													</div>
													<span className="text-muted-foreground">
														{formatBytes(entry.size)}
													</span>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						)}

						{/* Tab 2: Configuration & Settings */}
						{activeTab === "config" && (
							<div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
								{/* Canvas & Layout */}
								<div className="p-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] space-y-3">
									<h4 className="font-bold text-foreground flex items-center gap-2">
										<SlidersIcon className="w-4 h-4 text-primary" />
										Canvas & Visual Layout
									</h4>
									<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
										<div className="p-2 rounded-lg bg-foreground/[0.02] border border-foreground/5">
											<span className="text-[10px] text-muted-foreground block">
												Background
											</span>
											<div className="flex items-center gap-2 mt-1">
												<div
													className="w-4 h-4 rounded border border-foreground/20"
													style={{
														background:
															projectData?.canvasBackground ||
															projectData?.backgroundColor ||
															"#000000",
													}}
												/>
												<span className="font-mono text-[11px]">
													{projectData?.canvasBackground ||
														projectData?.backgroundColor ||
														"Default Black"}
												</span>
											</div>
										</div>

										<div className="p-2 rounded-lg bg-foreground/[0.02] border border-foreground/5">
											<span className="text-[10px] text-muted-foreground block">
												Aspect Ratio
											</span>
											<span className="font-semibold text-foreground mt-1 block">
												{aspectRatio}
											</span>
										</div>

										<div className="p-2 rounded-lg bg-foreground/[0.02] border border-foreground/5">
											<span className="text-[10px] text-muted-foreground block">
												Padding
											</span>
											<span className="font-semibold text-foreground mt-1 block">
												{projectData?.padding ?? "Default"}
											</span>
										</div>

										<div className="p-2 rounded-lg bg-foreground/[0.02] border border-foreground/5">
											<span className="text-[10px] text-muted-foreground block">
												Border Radius
											</span>
											<span className="font-semibold text-foreground mt-1 block">
												{projectData?.borderRadius ?? "Default"}
											</span>
										</div>

										<div className="p-2 rounded-lg bg-foreground/[0.02] border border-foreground/5">
											<span className="text-[10px] text-muted-foreground block">
												Drop Shadow
											</span>
											<span className="font-semibold text-foreground mt-1 block">
												{projectData?.shadowLevel ?? "Default"}
											</span>
										</div>

										<div className="p-2 rounded-lg bg-foreground/[0.02] border border-foreground/5">
											<span className="text-[10px] text-muted-foreground block">
												Auto Zoom
											</span>
											<span className="font-semibold text-foreground mt-1 block">
												{projectData?.autoZoomEnabled !== false
													? "Enabled"
													: "Disabled"}
											</span>
										</div>
									</div>
								</div>

								{/* Audio Settings */}
								<div className="p-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] space-y-3">
									<h4 className="font-bold text-foreground flex items-center gap-2">
										<MusicNoteIcon className="w-4 h-4 text-purple-400" />
										Audio & Ducking
									</h4>
									<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
										<div className="p-2 rounded-lg bg-foreground/[0.02] border border-foreground/5">
											<span className="text-[10px] text-muted-foreground block">
												Smart Ducking
											</span>
											<span className="font-semibold text-foreground mt-1 block">
												{projectData?.audioSettings?.duckingEnabled
													? "Active"
													: "Off"}
											</span>
										</div>
										<div className="p-2 rounded-lg bg-foreground/[0.02] border border-foreground/5">
											<span className="text-[10px] text-muted-foreground block">
												Ducking Threshold
											</span>
											<span className="font-semibold text-foreground mt-1 block">
												{projectData?.audioSettings?.duckingAmountDb ??
													"-14 dB"}
											</span>
										</div>
										<div className="p-2 rounded-lg bg-foreground/[0.02] border border-foreground/5">
											<span className="text-[10px] text-muted-foreground block">
												Volume Master
											</span>
											<span className="font-semibold text-foreground mt-1 block">
												{projectData?.masterVolume ?? "100%"}
											</span>
										</div>
									</div>
								</div>

								{/* Slide Transitions */}
								<div className="p-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] space-y-3">
									<h4 className="font-bold text-foreground flex items-center gap-2">
										<FilmStripIcon className="w-4 h-4 text-sky-400" />
										Slide Transitions
									</h4>
									<div className="space-y-1.5">
										{clips.length > 1 ? (
											clips
												.slice(0, -1)
												.map((c: InspectionClipData, i: number) => (
													<div
														key={`trans-${i}`}
														className="flex items-center justify-between p-2 rounded-lg bg-foreground/[0.02] border border-foreground/5"
													>
														<span className="text-muted-foreground">
															Slide {i + 1} &rarr; Slide {i + 2}:
														</span>
														<span className="font-semibold text-foreground">
															{c.transition?.type || "Cut / None"} (
															{c.transition?.duration || 0.5}s)
														</span>
													</div>
												))
										) : (
											<span className="text-muted-foreground italic">
												Only 1 slide in this project (no transitions).
											</span>
										)}
									</div>
								</div>
							</div>
						)}

						{/* Tab 3: Raw JSON */}
						{activeTab === "json" && (
							<div className="flex-1 min-h-0 flex flex-col p-4">
								<div className="flex items-center justify-between mb-2">
									<span className="text-[11px] font-semibold text-muted-foreground">
										project.json contents (
										{entries.find((e) => e.path === "project.json")?.size || 0}{" "}
										bytes)
									</span>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={handleCopyJson}
										className="h-7 px-2 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground"
									>
										{hasCopiedJson ? (
											<>
												<CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
												<span className="text-emerald-400">Copied!</span>
											</>
										) : (
											<>
												<CopyIcon className="w-3.5 h-3.5" />
												<span>Copy JSON</span>
											</>
										)}
									</Button>
								</div>
								<div className="flex-1 min-h-0 rounded-xl bg-black/40 border border-foreground/10 p-3.5 overflow-auto font-mono text-[11px] leading-relaxed text-foreground/90">
									<pre>{JSON.stringify(projectData, null, 2)}</pre>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Modal Footer */}
				<div className="px-6 py-3.5 border-t border-foreground/10 bg-foreground/[0.02] flex items-center justify-between flex-shrink-0">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleRevealInExplorer}
						className="text-xs text-muted-foreground hover:text-foreground gap-1.5 rounded-lg"
					>
						<FolderOpenIcon className="w-4 h-4" />
						<span>Show in File Explorer</span>
					</Button>

					<div className="flex items-center gap-2.5">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={onClose}
							className="rounded-lg text-xs"
						>
							Close
						</Button>
						{isBundle ? (
							<Button
								type="button"
								size="sm"
								onClick={handleOpen}
								className="rounded-lg text-xs bg-primary text-white font-semibold gap-1.5 hover:bg-primary/90"
							>
								<PlayIcon className="w-3.5 h-3.5 fill-current" />
								<span>Open in Editor</span>
							</Button>
						) : (
							<div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[11px]">
								<FileTextIcon className="w-3.5 h-3.5 flex-shrink-0" />
								<span>Legacy format — cannot be opened</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
