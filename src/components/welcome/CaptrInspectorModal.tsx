import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	Check,
	Code,
	Copy,
	Eye,
	FileArchive,
	FileCode,
	FileText,
	FilmStrip,
	FolderOpen,
	Image as ImageIcon,
	MagnifyingGlass,
	Package,
	Play,
	Sparkle,
	SpeakerHigh,
	UploadSimple,
	X,
} from "@phosphor-icons/react";
import { CaptrLogo } from "@/components/brand/CaptrLogo";
import type { ProjectLibraryEntry } from "@/components/video-editor/ProjectBrowserDialog";
import { formatMs } from "@/components/video-editor/timeline/items/itemUtils";

export interface CaptrInspectorModalProps {
	open: boolean;
	onClose: () => void;
	initialFilePath?: string | null;
	recentProjects?: ProjectLibraryEntry[];
	onOpenProject?: (filePath: string) => void;
}

export function formatBytes(bytes?: number): string {
	if (!bytes || bytes <= 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function CaptrInspectorModal({
	open,
	onClose,
	initialFilePath,
	recentProjects = [],
	onOpenProject,
}: CaptrInspectorModalProps) {
	const [activeFilePath, setActiveFilePath] = useState<string | null>(initialFilePath || null);
	const [loading, setLoading] = useState(false);
	const [inspection, setInspection] = useState<ProjectInspectionResult | null>(null);
	const [error, setError] = useState<string | null>(null);

	const [activeTab, setActiveTab] = useState<"overview" | "explorer" | "manifest">("overview");
	const [searchQuery, setSearchQuery] = useState("");
	const [categoryFilter, setCategoryFilter] = useState<string>("all");

	const [selectedEntry, setSelectedEntry] = useState<ProjectInspectionEntry | null>(null);
	const [entryContent, setEntryContent] = useState<{
		text?: string;
		dataUrl?: string;
		loading?: boolean;
		error?: string;
	} | null>(null);

	const [copiedJson, setCopiedJson] = useState(false);
	const [copiedPath, setCopiedPath] = useState(false);
	const [isDraggingOver, setIsDraggingOver] = useState(false);

	// Synchronize when initialFilePath changes
	useEffect(() => {
		if (initialFilePath) {
			setActiveFilePath(initialFilePath);
		}
	}, [initialFilePath]);

	// Fetch inspection data whenever activeFilePath changes
	const inspectFile = useCallback(async (path: string) => {
		if (!path) return;
		setLoading(true);
		setError(null);
		setSelectedEntry(null);
		setEntryContent(null);

		try {
			if (window.electronAPI?.inspectProjectFile) {
				const result = await window.electronAPI.inspectProjectFile(path);
				if (!result.success) {
					setError(result.error || "Gagal membaca project bundle .captr");
					setInspection(null);
				} else {
					setInspection(result);
					setActiveFilePath(path);
					// Default select project.json in explorer if present
					const projEntry = result.entries?.find((e) => e.path === "project.json");
					if (projEntry) {
						setSelectedEntry(projEntry);
					}
				}
			} else {
				setError("Electron API tidak tersedia di environment ini");
			}
		} catch (err) {
			setError(String(err));
			setInspection(null);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (open && activeFilePath) {
			void inspectFile(activeFilePath);
		}
	}, [open, activeFilePath, inspectFile]);

	// Load entry content when selectedEntry changes
	useEffect(() => {
		if (!selectedEntry || !activeFilePath) {
			setEntryContent(null);
			return;
		}

		// If it's project.json and we already parsed projectData, use it directly
		if (selectedEntry.path === "project.json" && inspection?.projectData) {
			setEntryContent({
				text: JSON.stringify(inspection.projectData, null, 2),
				loading: false,
			});
			return;
		}

		// If it's the thumbnail and we already have thumbnailDataUrl
		if (
			(selectedEntry.path === "thumbnail.png" || selectedEntry.path.endsWith(".thumb.png")) &&
			inspection?.thumbnailDataUrl
		) {
			setEntryContent({
				dataUrl: inspection.thumbnailDataUrl,
				loading: false,
			});
			return;
		}

		// Otherwise, fetch via readProjectBundleEntry if text or image
		const ext = selectedEntry.path.split(".").pop()?.toLowerCase();
		const isTextOrImage = [
			"json",
			"html",
			"txt",
			"svg",
			"png",
			"jpg",
			"jpeg",
			"webp",
			"gif",
		].includes(ext || "");

		if (isTextOrImage && window.electronAPI?.readProjectBundleEntry) {
			setEntryContent({ loading: true });
			window.electronAPI
				.readProjectBundleEntry(activeFilePath, selectedEntry.path)
				.then((res) => {
					if (res.success) {
						setEntryContent({
							text: res.content,
							dataUrl: res.dataUrl,
							loading: false,
						});
					} else {
						setEntryContent({
							error: res.error || "Gagal memuat isi file dari bundle",
							loading: false,
						});
					}
				})
				.catch((err) => {
					setEntryContent({
						error: String(err),
						loading: false,
					});
				});
		} else {
			setEntryContent(null);
		}
	}, [selectedEntry, activeFilePath, inspection]);

	// Pick file via Electron dialog
	const handlePickFile = async () => {
		try {
			if (window.electronAPI?.pickAndInspectProjectFile) {
				setLoading(true);
				const res = await window.electronAPI.pickAndInspectProjectFile();
				if (res.success && res.filePath) {
					setInspection(res);
					setActiveFilePath(res.filePath);
					setError(null);
					const projEntry = res.entries?.find((e) => e.path === "project.json");
					if (projEntry) setSelectedEntry(projEntry);
				} else if (res.error && !res.canceled) {
					setError(res.error);
				}
			}
		} catch (err) {
			setError(String(err));
		} finally {
			setLoading(false);
		}
	};

	// Copy project.json to clipboard
	const handleCopyJson = () => {
		if (!inspection?.projectData) return;
		try {
			navigator.clipboard.writeText(JSON.stringify(inspection.projectData, null, 2));
			setCopiedJson(true);
			setTimeout(() => setCopiedJson(false), 2000);
		} catch {}
	};

	// Copy active file path to clipboard
	const handleCopyPath = () => {
		if (!activeFilePath) return;
		try {
			navigator.clipboard.writeText(activeFilePath);
			setCopiedPath(true);
			setTimeout(() => setCopiedPath(false), 2000);
		} catch {}
	};

	// Drag & Drop handler
	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDraggingOver(false);
		if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
			const dropped = e.dataTransfer.files[0];
			const path = (dropped as { path?: string }).path;
			if (path && /\.captr$/i.test(path)) {
				void inspectFile(path);
			} else {
				setError("Mohon jatuhkan file proyek berformat .captr yang valid");
			}
		}
	};

	// Derived metrics from inspection and project.json
	const metrics = useMemo(() => {
		if (!inspection) return null;
		const proj = inspection.projectData as Record<string, any> | null;
		const entries = inspection.entries || [];

		const totalUncompressed = entries.reduce((acc, e) => acc + (e.size || 0), 0);
		const totalCompressed = entries.reduce((acc, e) => acc + (e.compressedSize || 0), 0);
		const spaceSavings =
			totalUncompressed > 0
				? Math.max(0, Math.round(((totalUncompressed - totalCompressed) / totalUncompressed) * 100))
				: 0;

		const videoEntries = entries.filter((e) => e.category === "video");
		const audioEntries = entries.filter((e) => e.category === "audio");
		const graphicEntries = entries.filter((e) => e.category === "graphic");
		const storyEntries = entries.filter((e) => e.category === "story");
		const hyperframeEntries = entries.filter((e) => e.category === "hyperframe");
		const telemetryEntries = entries.filter((e) => e.category === "telemetry");

		const tracks = Array.isArray(proj?.tracks) ? proj.tracks : [];
		const totalClips = tracks.reduce(
			(acc: number, t: any) => acc + (Array.isArray(t?.clips) ? t.clips.length : 0),
			0,
		);
		const durationUs =
			typeof proj?.durationUs === "number"
				? proj.durationUs
				: typeof proj?.durationMs === "number"
					? proj.durationMs * 1000
					: 0;

		const durationMs = durationUs ? Math.round(durationUs / 1000) : 0;
		const aspectRatio = proj?.aspectRatio || "16:9";
		const resolution =
			aspectRatio === "9:16"
				? "1080 × 1920"
				: aspectRatio === "1:1"
					? "1080 × 1080"
					: "1920 × 1080";

		return {
			totalUncompressed,
			totalCompressed,
			spaceSavings,
			videoEntries,
			audioEntries,
			graphicEntries,
			storyEntries,
			hyperframeEntries,
			telemetryEntries,
			tracksCount: tracks.length,
			clipsCount: totalClips,
			durationMs,
			aspectRatio,
			resolution,
			title: proj?.title || inspection.fileName?.replace(/\.captr$/i, "") || "Proyek Tanpa Judul",
			projectId: proj?.projectId || "—",
		};
	}, [inspection]);

	// Filtered package entries for Tab 2
	const filteredEntries = useMemo(() => {
		if (!inspection?.entries) return [];
		return inspection.entries.filter((entry) => {
			if (entry.isDirectory) return false;
			const matchesCategory =
				categoryFilter === "all" || entry.category === categoryFilter;
			const matchesQuery =
				!searchQuery.trim() ||
				entry.path.toLowerCase().includes(searchQuery.trim().toLowerCase());
			return matchesCategory && matchesQuery;
		});
	}, [inspection?.entries, categoryFilter, searchQuery]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-[#0B0C0E]/80 backdrop-blur-md animate-in fade-in duration-150"
			onDragOver={(e) => {
				e.preventDefault();
				setIsDraggingOver(true);
			}}
			onDragLeave={() => setIsDraggingOver(false)}
			onDrop={handleDrop}
		>
			<div className="relative w-full max-w-[1240px] h-[88vh] max-h-[860px] flex flex-col bg-[#15171C] border border-[#282B36] rounded-2xl shadow-2xl overflow-hidden text-[#E4E7EE]">
				{/* Top App Header */}
				<header className="h-[64px] px-6 border-b border-[#242733] bg-[#181B22]/90 flex items-center justify-between gap-4 shrink-0 select-none">
					<div className="flex items-center gap-3 min-w-0">
						<div className="w-9 h-9 rounded-xl bg-[#6FA8FF]/15 border border-[#6FA8FF]/30 flex items-center justify-center text-[#6FA8FF] shrink-0 shadow-sm">
							<Package size={20} weight="duotone" />
						</div>
						<div className="min-w-0">
							<div className="flex items-center gap-2">
								<h2 className="text-[15px] font-bold text-white tracking-tight truncate">
									Captr Package Inspector
								</h2>
								<span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-[#A879F5]/20 border border-[#A879F5]/35 text-[#d8bfff]">
									.captr V3 Mini App
								</span>
							</div>
							<p className="text-[11.5px] text-[#8F94A6] truncate">
								{inspection?.fileName || activeFilePath || "Pilih atau jatuhkan file proyek untuk dianalisis"}
							</p>
						</div>
					</div>

					<div className="flex items-center gap-2.5 shrink-0">
						{inspection && (
							<>
								<button
									type="button"
									onClick={handlePickFile}
									disabled={loading}
									className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#21242E] hover:bg-[#2A2E3B] border border-[#323644] text-[#C6C9D6] transition flex items-center gap-1.5"
								>
									<FolderOpen size={14} />
									<span>Ganti File</span>
								</button>

								{onOpenProject && activeFilePath && (
									<button
										type="button"
										onClick={() => {
											onOpenProject(activeFilePath);
											onClose();
										}}
										className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#6FA8FF] hover:bg-[#85b7ff] text-[#111215] transition shadow-md flex items-center gap-1.5"
									>
										<Play size={13} weight="fill" />
										<span>Buka di Editor</span>
									</button>
								)}
							</>
						)}

						<button
							type="button"
							onClick={onClose}
							aria-label="Tutup Inspector"
							className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8F94A6] hover:text-white hover:bg-[#252834] transition"
						>
							<X size={18} />
						</button>
					</div>
				</header>

				{/* Drag & Drop Visual Indicator Overlay */}
				{isDraggingOver && (
					<div className="absolute inset-0 z-50 bg-[#15171C]/90 backdrop-blur-sm border-2 border-dashed border-[#6FA8FF] flex flex-col items-center justify-center gap-3">
						<UploadSimple size={48} className="text-[#6FA8FF] animate-bounce" />
						<p className="text-base font-semibold text-white">
							Lepaskan file .captr untuk langsung menganalisis
						</p>
					</div>
				)}

				{/* Body Content */}
				{loading ? (
					<div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
						<div className="w-10 h-10 border-2 border-[#6FA8FF] border-t-transparent rounded-full animate-spin" />
						<p className="text-sm text-[#9CA1B4] font-medium">Membongkar isi paket .captr…</p>
					</div>
				) : error ? (
					<div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto gap-4">
						<div className="w-12 h-12 rounded-2xl bg-[#FF6B81]/15 border border-[#FF6B81]/30 flex items-center justify-center text-[#FF6B81]">
							<FileArchive size={28} />
						</div>
						<div>
							<h3 className="text-base font-semibold text-white mb-1">Gagal Membaca Paket</h3>
							<p className="text-xs text-[#9CA1B4] leading-relaxed">{error}</p>
						</div>
						<button
							type="button"
							onClick={handlePickFile}
							className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#6FA8FF] text-[#111215] hover:bg-[#85b7ff] transition"
						>
							Pilih File .captr Lain
						</button>
					</div>
				) : !inspection ? (
					/* Empty State: File Picker / Drop Zone & Recent Projects */
					<div className="flex-1 p-8 overflow-y-auto flex flex-col items-center justify-center">
						<div className="w-full max-w-xl flex flex-col items-center text-center gap-6">
							<div
								onClick={handlePickFile}
								className="w-full p-10 rounded-2xl border-2 border-dashed border-[#2F3342] hover:border-[#6FA8FF]/60 bg-[#191C24]/60 hover:bg-[#1E222D]/80 transition cursor-pointer flex flex-col items-center gap-3 group"
							>
								<div className="w-14 h-14 rounded-2xl bg-[#6FA8FF]/10 group-hover:bg-[#6FA8FF]/20 border border-[#6FA8FF]/25 flex items-center justify-center text-[#6FA8FF] transition">
									<UploadSimple size={28} />
								</div>
								<div>
									<h3 className="text-base font-semibold text-white group-hover:text-[#6FA8FF] transition">
										Pilih File Proyek .captr
									</h3>
									<p className="text-xs text-[#8E93A5] mt-1">
										Klik untuk menjelajahi disk atau seret file .captr langsung ke sini
									</p>
								</div>
								<span className="px-3 py-1 rounded-full text-[11px] font-medium bg-[#252834] text-[#A6ABB8] border border-[#313543]">
									Mendukung paket .captr V3 (ZIP Bundle)
								</span>
							</div>

							{recentProjects.length > 0 && (
								<div className="w-full text-left">
									<h4 className="text-xs font-bold uppercase tracking-wider text-[#828799] mb-3">
										Atau Pilih dari Proyek Terbaru
									</h4>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
										{recentProjects.slice(0, 4).map((rp) => (
											<button
												key={rp.path}
												type="button"
												onClick={() => void inspectFile(rp.path)}
												className="p-3 rounded-xl bg-[#1C1F27] hover:bg-[#232733] border border-[#2B2F3D] hover:border-[#6FA8FF]/40 text-left transition flex items-center gap-3 group"
											>
												<div className="w-9 h-9 rounded-lg bg-[#272B38] flex items-center justify-center text-[#6FA8FF] shrink-0">
													<Eye size={18} />
												</div>
												<div className="min-w-0 flex-1">
													<p className="text-xs font-semibold text-white truncate group-hover:text-[#6FA8FF] transition">
														{rp.name}
													</p>
													<p className="text-[10px] text-[#7E8394] truncate" title={rp.path}>
														{rp.path}
													</p>
												</div>
											</button>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				) : (
					/* Active Inspector Workspace */
					<div className="flex-1 flex flex-col min-h-0">
						{/* Tab Selector Bar */}
						<div className="px-6 border-b border-[#222530] bg-[#171920] flex items-center justify-between shrink-0 select-none">
							<div className="flex items-center gap-1">
								<button
									type="button"
									onClick={() => setActiveTab("overview")}
									className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
										activeTab === "overview"
											? "border-[#6FA8FF] text-[#6FA8FF]"
											: "border-transparent text-[#8E93A5] hover:text-[#CCD0DC]"
									}`}
								>
									<Sparkle size={15} />
									<span>Ringkasan & Pratinjau</span>
								</button>
								<button
									type="button"
									onClick={() => setActiveTab("explorer")}
									className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
										activeTab === "explorer"
											? "border-[#6FA8FF] text-[#6FA8FF]"
											: "border-transparent text-[#8E93A5] hover:text-[#CCD0DC]"
									}`}
								>
									<FileArchive size={15} />
									<span>Isi Paket Bundle ({inspection.entries?.length || 0})</span>
								</button>
								<button
									type="button"
									onClick={() => setActiveTab("manifest")}
									className={`px-4 py-3 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
										activeTab === "manifest"
											? "border-[#6FA8FF] text-[#6FA8FF]"
											: "border-transparent text-[#8E93A5] hover:text-[#CCD0DC]"
									}`}
								>
									<Code size={15} />
									<span>project.json</span>
								</button>
							</div>

							<div className="flex items-center gap-2 text-xs text-[#828799]">
								<span>Format:</span>
								<span className="font-mono text-[11px] text-[#8DDB9B] bg-[#8DDB9B]/10 px-2 py-0.5 rounded border border-[#8DDB9B]/20">
									V3 ZIP Bundle
								</span>
							</div>
						</div>

						{/* Tab 1: Overview */}
						{activeTab === "overview" && metrics && (
							<div className="flex-1 p-6 overflow-y-auto">
								<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto">
									{/* Visual Cover Preview Card */}
									<div className="lg:col-span-5 flex flex-col gap-4">
										<div className="p-4 rounded-2xl bg-[#191C24] border border-[#272B38] flex flex-col gap-3 shadow-sm">
											<div className="relative aspect-video rounded-xl bg-[#0F1014] border border-[#252834] overflow-hidden flex items-center justify-center">
												{inspection.thumbnailDataUrl ? (
													<img
														src={inspection.thumbnailDataUrl}
														alt="Thumbnail Proyek"
														className="w-full h-full object-cover"
													/>
												) : (
													<div className="flex flex-col items-center gap-2 text-[#686D80]">
														<CaptrLogo variant="icon" size={44} />
														<span className="text-[11px]">Tidak ada thumbnail tertanam</span>
													</div>
												)}

												<div className="absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#111215]/85 border border-white/10 text-white backdrop-blur-sm">
													{metrics.aspectRatio}
												</div>

												{metrics.durationMs > 0 && (
													<div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#111215]/85 border border-white/10 text-[#6FA8FF] backdrop-blur-sm">
														{formatMs(metrics.durationMs)}
													</div>
												)}
											</div>

											<div className="flex items-center justify-between text-xs pt-1 px-1">
												<span className="text-[#8E93A5]">Resolusi Kanvas</span>
												<span className="font-mono font-semibold text-white">
													{metrics.resolution}
												</span>
											</div>
										</div>

										{/* File Location Card */}
										<div className="p-4 rounded-2xl bg-[#191C24] border border-[#272B38] flex flex-col gap-2 text-xs">
											<span className="text-[#8E93A5] font-medium">Lokasi File di Disk</span>
											<div className="p-2.5 rounded-lg bg-[#111215] border border-[#252834] font-mono text-[11px] text-[#A6ABB9] break-all select-all">
												{inspection.filePath}
											</div>
											<div className="flex items-center gap-2 pt-1">
												<button
													type="button"
													onClick={handleCopyPath}
													className="px-2.5 py-1 rounded bg-[#232733] hover:bg-[#2B3040] text-[11px] text-[#C4C8D6] transition flex items-center gap-1"
												>
													{copiedPath ? (
														<Check size={12} className="text-[#8DDB9B]" />
													) : (
														<Copy size={12} />
													)}
													<span>{copiedPath ? "Tersalin!" : "Salin Path"}</span>
												</button>

												{window.electronAPI?.revealInFolder && activeFilePath && (
													<button
														type="button"
														onClick={() =>
															window.electronAPI?.revealInFolder?.(activeFilePath)
														}
														className="px-2.5 py-1 rounded bg-[#232733] hover:bg-[#2B3040] text-[11px] text-[#C4C8D6] transition flex items-center gap-1"
													>
														<FolderOpen size={12} />
														<span>Tampilkan di Explorer</span>
													</button>
												)}
											</div>
										</div>
									</div>

									{/* Metrics & Spec Overview Grid */}
									<div className="lg:col-span-7 flex flex-col gap-4">
										{/* Highlight Stats Row */}
										<div className="grid grid-cols-3 gap-3">
											<div className="p-4 rounded-2xl bg-[#191C24] border border-[#272B38] flex flex-col gap-1">
												<span className="text-[11px] text-[#8E93A5] font-medium">
													Ukuran Bundle
												</span>
												<span className="text-xl font-bold font-mono text-white">
													{formatBytes(inspection.fileSize)}
												</span>
												<span className="text-[10px] text-[#8DDB9B] font-medium">
													Hemat {metrics.spaceSavings}% kompresi
												</span>
											</div>

											<div className="p-4 rounded-2xl bg-[#191C24] border border-[#272B38] flex flex-col gap-1">
												<span className="text-[11px] text-[#8E93A5] font-medium">
													Timeline Video
												</span>
												<span className="text-xl font-bold font-mono text-[#6FA8FF]">
													{metrics.clipsCount}{" "}
													<span className="text-xs font-normal text-[#8E93A5]">clips</span>
												</span>
												<span className="text-[10px] text-[#8E93A5]">
													{metrics.tracksCount} tracks aktif
												</span>
											</div>

											<div className="p-4 rounded-2xl bg-[#191C24] border border-[#272B38] flex flex-col gap-1">
												<span className="text-[11px] text-[#8E93A5] font-medium">
													Total File Arsip
												</span>
												<span className="text-xl font-bold font-mono text-[#A879F5]">
													{inspection.entries?.length || 0}
												</span>
												<span className="text-[10px] text-[#8E93A5]">
													Uncompressed: {formatBytes(metrics.totalUncompressed)}
												</span>
											</div>
										</div>

										{/* Sub-Projects & Story Architecture Card */}
										<div className="p-4 rounded-2xl bg-[#191C24] border border-[#272B38] flex flex-col gap-3">
											<div className="flex items-center justify-between">
												<h3 className="text-xs font-bold uppercase tracking-wider text-[#A2A7B8] flex items-center gap-1.5">
													<Sparkle size={14} className="text-[#A879F5]" />
													<span>Sub-Project & Arsitektur Komposisi</span>
												</h3>
												<span className="text-[11px] text-[#7E8394]">
													Shared Asset Ecosystem
												</span>
											</div>

											<div className="grid grid-cols-2 gap-3">
												<div className="p-3 rounded-xl bg-[#13151B] border border-[#222530] flex items-center justify-between">
													<div>
														<p className="text-xs font-semibold text-white">
															Story Compositions
														</p>
														<p className="text-[10px] text-[#7E8394]">
															Folder story/ (JSON orkestrasi)
														</p>
													</div>
													<span className="px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-[#A879F5]/20 text-[#d8bfff] border border-[#A879F5]/30">
														{metrics.storyEntries.length}
													</span>
												</div>

												<div className="p-3 rounded-xl bg-[#13151B] border border-[#222530] flex items-center justify-between">
													<div>
														<p className="text-xs font-semibold text-white">
															Hyperframe HTMLs
														</p>
														<p className="text-[10px] text-[#7E8394]">
															Folder hyperframe/ (Web Canvas)
														</p>
													</div>
													<span className="px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-[#6FA8FF]/20 text-[#9bc6ff] border border-[#6FA8FF]/30">
														{metrics.hyperframeEntries.length}
													</span>
												</div>
											</div>
										</div>

										{/* Asset Inventory Breakdown Card */}
										<div className="p-4 rounded-2xl bg-[#191C24] border border-[#272B38] flex flex-col gap-3">
											<h3 className="text-xs font-bold uppercase tracking-wider text-[#A2A7B8]">
												Rincian Media Asset di assets/
											</h3>
											<div className="grid grid-cols-4 gap-2 text-center">
												<div className="p-2.5 rounded-xl bg-[#13151B] border border-[#222530]">
													<FilmStrip size={18} className="mx-auto mb-1 text-[#6FA8FF]" />
													<p className="text-sm font-bold font-mono text-white">
														{metrics.videoEntries.length}
													</p>
													<p className="text-[10px] text-[#7E8394]">Video Tracks</p>
												</div>

												<div className="p-2.5 rounded-xl bg-[#13151B] border border-[#222530]">
													<SpeakerHigh
														size={18}
														className="mx-auto mb-1 text-[#8DDB9B]"
													/>
													<p className="text-sm font-bold font-mono text-white">
														{metrics.audioEntries.length}
													</p>
													<p className="text-[10px] text-[#7E8394]">Audio & Peaks</p>
												</div>

												<div className="p-2.5 rounded-xl bg-[#13151B] border border-[#222530]">
													<ImageIcon size={18} className="mx-auto mb-1 text-[#F6C768]" />
													<p className="text-sm font-bold font-mono text-white">
														{metrics.graphicEntries.length}
													</p>
													<p className="text-[10px] text-[#7E8394]">Grafik / Foto</p>
												</div>

												<div className="p-2.5 rounded-xl bg-[#13151B] border border-[#222530]">
													<FileText size={18} className="mx-auto mb-1 text-[#A879F5]" />
													<p className="text-sm font-bold font-mono text-white">
														{metrics.telemetryEntries.length}
													</p>
													<p className="text-[10px] text-[#7E8394]">Telemetri Kursor</p>
												</div>
											</div>
										</div>
									</div>
								</div>
							</div>
						)}

						{/* Tab 2: Package Explorer */}
						{activeTab === "explorer" && (
							<div className="flex-1 flex flex-col md:flex-row min-h-0">
								{/* Left: Files Filter & List */}
								<div className="w-full md:w-[480px] border-r border-[#222530] flex flex-col bg-[#14161C] shrink-0 min-h-0">
									{/* Search & Filter Toolbar */}
									<div className="p-3 border-b border-[#222530] flex flex-col gap-2.5 shrink-0 bg-[#171921]">
										<div className="relative">
											<MagnifyingGlass
												size={14}
												className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7E8394]"
											/>
											<input
												type="search"
												placeholder="Cari file dalam arsip bundle…"
												value={searchQuery}
												onChange={(e) => setSearchQuery(e.target.value)}
												className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-[#111215] border border-[#2A2D3A] text-white placeholder-[#686D7E] focus:outline-none focus:border-[#6FA8FF]"
											/>
										</div>

										<div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
											{[
												{ id: "all", label: "Semua" },
												{ id: "config", label: "Config" },
												{ id: "story", label: "Story" },
												{ id: "hyperframe", label: "Hyperframe" },
												{ id: "video", label: "Video" },
												{ id: "audio", label: "Audio" },
												{ id: "graphic", label: "Graphic" },
											].map((cat) => (
												<button
													key={cat.id}
													type="button"
													onClick={() => setCategoryFilter(cat.id)}
													className={`px-2.5 py-1 rounded-md shrink-0 font-medium transition ${
														categoryFilter === cat.id
															? "bg-[#6FA8FF]/20 text-[#8ec0ff] border border-[#6FA8FF]/40"
															: "bg-[#1C1F27] text-[#8A8F9E] hover:text-white border border-transparent"
													}`}
												>
													{cat.label}
												</button>
											))}
										</div>
									</div>

									{/* Entries List */}
									<div className="flex-1 overflow-y-auto divide-y divide-[#1D202A]">
										{filteredEntries.length === 0 ? (
											<div className="p-8 text-center text-xs text-[#7A7F90]">
												Tidak ada file yang cocok dengan filter
											</div>
										) : (
											filteredEntries.map((entry) => {
												const isSelected = selectedEntry?.path === entry.path;
												return (
													<button
														key={entry.path}
														type="button"
														onClick={() => setSelectedEntry(entry)}
														className={`w-full p-2.5 px-3.5 text-left transition flex items-center justify-between gap-3 text-xs ${
															isSelected
																? "bg-[#6FA8FF]/15 border-l-2 border-[#6FA8FF]"
																: "hover:bg-[#1B1D25]"
														}`}
													>
														<div className="flex items-center gap-2.5 min-w-0">
															<span className="shrink-0 text-[#8F94A6]">
																{entry.category === "video" && (
																	<FilmStrip size={15} className="text-[#6FA8FF]" />
																)}
																{entry.category === "audio" && (
																	<SpeakerHigh size={15} className="text-[#8DDB9B]" />
																)}
																{entry.category === "graphic" && (
																	<ImageIcon size={15} className="text-[#F6C768]" />
																)}
																{entry.category === "story" && (
																	<FileCode size={15} className="text-[#A879F5]" />
																)}
																{entry.category === "hyperframe" && (
																	<Code size={15} className="text-[#6FA8FF]" />
																)}
																{entry.category === "config" && (
																	<FileText size={15} className="text-[#8DDB9B]" />
																)}
																{entry.category === "thumbnail" && (
																	<ImageIcon size={15} className="text-[#A879F5]" />
																)}
																{entry.category === "other" && <FileText size={15} />}
															</span>
															<span
																className={`truncate font-mono text-[11px] ${
																	isSelected ? "text-white font-semibold" : "text-[#CCD0DC]"
																}`}
																title={entry.path}
															>
																{entry.path}
															</span>
														</div>

														<div className="flex items-center gap-2 shrink-0">
															<span className="text-[10px] font-mono text-[#7B8092]">
																{formatBytes(entry.size)}
															</span>
														</div>
													</button>
												);
											})
										)}
									</div>
								</div>

								{/* Right: File Preview / Inspector Pane */}
								<div className="flex-1 flex flex-col bg-[#111215] min-h-0 overflow-hidden">
									{selectedEntry ? (
										<div className="flex-1 flex flex-col min-h-0">
											{/* Detail Header */}
											<div className="p-3 px-5 border-b border-[#222530] bg-[#161820] flex items-center justify-between gap-4 shrink-0">
												<div className="min-w-0">
													<p className="text-xs font-mono font-semibold text-white truncate">
														{selectedEntry.path}
													</p>
													<div className="flex items-center gap-2 text-[10px] text-[#868B9D] mt-0.5">
														<span>Uncompressed: {formatBytes(selectedEntry.size)}</span>
														<span>•</span>
														<span>
															Compressed: {formatBytes(selectedEntry.compressedSize)}
														</span>
														<span>•</span>
														<span className="uppercase text-[#8DDB9B]">
															{selectedEntry.category}
														</span>
													</div>
												</div>

												{entryContent?.text && (
													<button
														type="button"
														onClick={() => {
															navigator.clipboard.writeText(entryContent.text || "");
															setCopiedJson(true);
															setTimeout(() => setCopiedJson(false), 2000);
														}}
														className="px-2.5 py-1 rounded bg-[#232733] hover:bg-[#2B3040] text-[11px] text-[#C4C8D6] transition flex items-center gap-1 shrink-0"
													>
														{copiedJson ? (
															<Check size={12} className="text-[#8DDB9B]" />
														) : (
															<Copy size={12} />
														)}
														<span>{copiedJson ? "Tersalin!" : "Salin Isi"}</span>
													</button>
												)}
											</div>

											{/* Preview Body */}
											<div className="flex-1 p-4 overflow-auto font-mono text-xs text-[#CCD0DC] leading-relaxed">
												{entryContent?.loading ? (
													<div className="h-full flex items-center justify-center text-xs text-[#7B8092]">
														Memuat isi file…
													</div>
												) : entryContent?.error ? (
													<div className="p-4 rounded-xl bg-[#FF6B81]/10 border border-[#FF6B81]/25 text-[#FF6B81]">
														{entryContent.error}
													</div>
												) : entryContent?.dataUrl ? (
													<div className="h-full flex flex-col items-center justify-center gap-3">
														<img
															src={entryContent.dataUrl}
															alt="Preview Media"
															className="max-h-[70%] max-w-[85%] object-contain rounded-lg border border-[#2B2F3D] shadow-lg"
														/>
														<span className="text-[11px] text-[#828799]">
															Pratinjau Gambar Tertanam
														</span>
													</div>
												) : entryContent?.text ? (
													<pre className="whitespace-pre-wrap select-text break-words">
														{entryContent.text}
													</pre>
												) : (
													<div className="h-full flex flex-col items-center justify-center gap-2 text-[#727688]">
														<FileArchive size={32} />
														<p className="text-xs">
															File binary ({selectedEntry.category}). Tidak ada pratinjau teks.
														</p>
													</div>
												)}
											</div>
										</div>
									) : (
										<div className="flex-1 flex items-center justify-center text-xs text-[#727688]">
											Pilih file dari daftar sebelah kiri untuk melihat isinya
										</div>
									)}
								</div>
							</div>
						)}

						{/* Tab 3: Manifest project.json */}
						{activeTab === "manifest" && (
							<div className="flex-1 flex flex-col min-h-0 bg-[#111215]">
								<div className="p-3 px-6 border-b border-[#222530] bg-[#161820] flex items-center justify-between shrink-0">
									<div className="flex items-center gap-2">
										<Code size={15} className="text-[#8DDB9B]" />
										<span className="text-xs font-semibold text-white">
											Authoritative Index: project.json
										</span>
									</div>

									<button
										type="button"
										onClick={handleCopyJson}
										className="px-3 py-1 rounded-lg bg-[#232733] hover:bg-[#2B3040] text-xs font-medium text-[#C4C8D6] transition flex items-center gap-1.5"
									>
										{copiedJson ? (
											<Check size={13} className="text-[#8DDB9B]" />
										) : (
											<Copy size={13} />
										)}
										<span>{copiedJson ? "Tersalin ke Clipboard" : "Salin JSON"}</span>
									</button>
								</div>

								<div className="flex-1 p-6 overflow-auto font-mono text-xs leading-relaxed text-[#CCD0DC] select-text">
									{inspection.projectData ? (
										<pre className="whitespace-pre-wrap break-words">
											{JSON.stringify(inspection.projectData, null, 2)}
										</pre>
									) : (
										<p className="text-xs text-[#7B8092]">
											project.json tidak ditemukan atau tidak dapat diuraikan
										</p>
									)}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
