import {
	ArrowsClockwise,
	CaretDown,
	CaretRight,
	CheckCircle,
	FileVideo,
	FolderOpen,
	FolderSimple,
	Image as ImageIcon,
	MagnifyingGlass,
	Plus,
	SpeakerHigh,
	Trash,
	UploadSimple,
	VideoCamera,
} from "@phosphor-icons/react";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClipEntry, SlideAssetFile } from "../types";

export interface AssetExplorerProps {
	className?: string;
	activeClip?: ClipEntry | null;
	onAddAsSlide?: (filePath: string, label?: string) => void;
	onImportMedia?: (subfolder?: string) => void;
	onUseAsset?: (
		asset: SlideAssetFile,
		action: "set-main" | "add-video-layer" | "add-audio" | "add-overlay",
	) => void;
	onRemoveAsset?: (assetId: string) => void;
	currentActivePath?: string | null;
}

function formatBytes(bytes?: number): string {
	if (!bytes || bytes <= 0) return "";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const DEFAULT_SUBFOLDERS = [
	"Main Video",
	"Video Layers",
	"Audio & Voiceovers",
	"Graphics & Overlays",
	"Imported Media",
] as const;

export function AssetExplorer({
	className,
	activeClip,
	onAddAsSlide,
	onImportMedia,
	onUseAsset,
	onRemoveAsset,
	currentActivePath,
}: AssetExplorerProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState<"all" | "video" | "audio" | "image">("all");
	const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

	const toggleFolder = useCallback((folder: string) => {
		setCollapsedFolders((prev) => ({ ...prev, [folder]: !prev[folder] }));
	}, []);

	// Aggregate all assets exclusive to this specific slide
	const slideAssets = useMemo<SlideAssetFile[]>(() => {
		if (!activeClip) return [];
		const items: SlideAssetFile[] = [];

		// 1. Main Video
		if (activeClip.videoPath) {
			const name = activeClip.videoPath.split(/[/\\]/).pop() || "Main Video";
			items.push({
				id: "main-video",
				name,
				path: activeClip.videoPath,
				size: 0,
				mtimeMs: 0,
				type: "video",
				subfolder: "Main Video",
				category: "main",
			});
		}

		// 2. Video Layers & Graphics from Annotation Regions
		if (activeClip.annotationRegions) {
			for (const ann of activeClip.annotationRegions) {
				if (ann.videoFilePath) {
					const name =
						ann.name || ann.videoFilePath.split(/[/\\]/).pop() || "Video Layer";
					items.push({
						id: `layer-${ann.id}`,
						name,
						path: ann.videoFilePath,
						size: 0,
						mtimeMs: 0,
						type: "video",
						subfolder: "Video Layers",
						category: "layer",
					});
				} else if (ann.imageFilePath || ann.gifPath) {
					const path = (ann.imageFilePath || ann.gifPath)!;
					const name = ann.name || path.split(/[/\\]/).pop() || "Graphic Overlay";
					items.push({
						id: `graphic-${ann.id}`,
						name,
						path,
						size: 0,
						mtimeMs: 0,
						type: "image",
						subfolder: "Graphics & Overlays",
						category: "graphic",
					});
				}
			}
		}

		// 3. Audio & Voiceovers
		if (activeClip.audioRegions) {
			for (const aud of activeClip.audioRegions) {
				if (aud.audioPath) {
					const name =
						(aud as unknown as { name?: string }).name ||
						aud.audioPath.split(/[/\\]/).pop() ||
						"Audio Track";
					items.push({
						id: `audio-${aud.id}`,
						name,
						path: aud.audioPath,
						size: 0,
						mtimeMs: 0,
						type: "audio",
						subfolder: "Audio & Voiceovers",
						category: "audio",
					});
				}
			}
		}

		// 4. Explicitly Imported Assets saved in this slide's metadata
		if (Array.isArray(activeClip.assetFiles)) {
			for (const asset of activeClip.assetFiles) {
				if (
					!items.some(
						(it) =>
							it.path === asset.path &&
							it.subfolder === (asset.subfolder || "Imported Media"),
					)
				) {
					items.push({
						...asset,
						subfolder: asset.subfolder || "Imported Media",
						category: asset.category || "imported",
					});
				}
			}
		}

		return items;
	}, [activeClip]);

	// Filter assets based on search query and type filter
	const filteredAssets = useMemo(() => {
		return slideAssets.filter((asset) => {
			if (typeFilter !== "all" && asset.type !== typeFilter) return false;
			if (searchQuery.trim()) {
				const query = searchQuery.toLowerCase();
				return (
					asset.name.toLowerCase().includes(query) ||
					(asset.subfolder && asset.subfolder.toLowerCase().includes(query))
				);
			}
			return true;
		});
	}, [slideAssets, typeFilter, searchQuery]);

	// Group assets by subfolder
	const subfolderGroups = useMemo(() => {
		const groups: Record<string, SlideAssetFile[]> = {};

		// Initialize default subfolders so the structure is always clear
		for (const folder of DEFAULT_SUBFOLDERS) {
			groups[folder] = [];
		}

		for (const asset of filteredAssets) {
			const folder = asset.subfolder || "Imported Media";
			if (!groups[folder]) {
				groups[folder] = [];
			}
			groups[folder].push(asset);
		}

		return groups;
	}, [filteredAssets]);

	const handleReveal = (path: string) => {
		void window.electronAPI?.revealInFolder?.(path);
	};

	if (!activeClip) {
		return (
			<div
				className={cn(
					"flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground",
					className,
				)}
			>
				<FileVideo className="w-8 h-8 mb-2 opacity-30 text-muted-foreground" />
				<p className="text-xs font-semibold text-foreground/80">No Video Slide Selected</p>
				<p className="text-[10px] text-muted-foreground mt-0.5">
					Select a video slide to explore its exclusive assets.
				</p>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex flex-col h-full w-full bg-editor-surface/80 border-t border-foreground/10 select-none overflow-hidden",
				className,
			)}
		>
			{/* Top Bar / Slide Folder Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-foreground/10 bg-editor-surface">
				<div className="flex items-center gap-1.5 min-w-0">
					<FolderOpen className="w-4 h-4 text-primary shrink-0" weight="bold" />
					<div className="flex flex-col min-w-0">
						<div className="flex items-center gap-1.5">
							<span className="text-xs font-bold tracking-tight text-foreground truncate max-w-[150px]">
								{activeClip.label || "Current Slide"}
							</span>
							<span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold shrink-0">
								{slideAssets.length} assets
							</span>
						</div>
						<span className="text-[9px] text-muted-foreground flex items-center gap-1">
							<CheckCircle
								className="w-2.5 h-2.5 text-emerald-500 inline"
								weight="fill"
							/>
							Exclusive slide folder
						</span>
					</div>
				</div>

				<div className="flex items-center gap-1 shrink-0">
					{onImportMedia && (
						<Button
							type="button"
							size="sm"
							onClick={() => onImportMedia("Imported Media")}
							className="h-6 px-2 text-[11px] gap-1 bg-primary hover:bg-primary/90 text-white rounded-md shadow-xs cursor-pointer"
							title="Import asset to this slide"
						>
							<UploadSimple className="w-3 h-3" weight="bold" />
							<span>Import</span>
						</Button>
					)}
				</div>
			</div>

			{/* Search & Filter Bar */}
			<div className="p-2 border-b border-foreground/[0.06] bg-editor-bg/40 space-y-1.5">
				<div className="relative flex items-center">
					<MagnifyingGlass className="absolute left-2 w-3 h-3 text-muted-foreground pointer-events-none" />
					<input
						type="text"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search slide assets..."
						className="w-full h-6 pl-7 pr-2 rounded bg-foreground/[0.04] border border-foreground/10 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary/40"
					/>
				</div>
				<div className="flex items-center gap-1">
					{(["all", "video", "audio", "image"] as const).map((filter) => (
						<button
							key={filter}
							type="button"
							onClick={() => setTypeFilter(filter)}
							className={cn(
								"px-2 py-0.5 text-[9px] font-medium rounded capitalize transition-colors",
								typeFilter === filter
									? "bg-foreground/15 text-foreground font-semibold"
									: "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]",
							)}
						>
							{filter}
						</button>
					))}
				</div>
			</div>

			{/* Sub-Folders Tree View */}
			<div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar min-h-0">
				{Object.entries(subfolderGroups).map(([folderName, items]) => {
					const isCollapsed = collapsedFolders[folderName] ?? false;

					// If searching, hide empty folders
					if (searchQuery.trim() && items.length === 0) return null;

					return (
						<div
							key={folderName}
							className="rounded-lg border border-foreground/[0.06] bg-editor-surface/40 overflow-hidden"
						>
							{/* Folder Header */}
							<div
								onClick={() => toggleFolder(folderName)}
								className="flex items-center justify-between px-2.5 py-1.5 bg-foreground/[0.02] hover:bg-foreground/[0.05] cursor-pointer transition-colors"
							>
								<div className="flex items-center gap-1.5">
									{isCollapsed ? (
										<CaretRight className="w-2.5 h-2.5 text-muted-foreground" />
									) : (
										<CaretDown className="w-2.5 h-2.5 text-muted-foreground" />
									)}
									<FolderSimple
										className={cn(
											"w-3.5 h-3.5",
											items.length > 0
												? "text-primary/80"
												: "text-muted-foreground/60",
										)}
										weight={items.length > 0 ? "fill" : "regular"}
									/>
									<span className="text-[11px] font-semibold text-foreground/90">
										{folderName}
									</span>
									<span className="text-[9px] px-1 rounded-full bg-foreground/[0.08] text-muted-foreground font-medium">
										{items.length}
									</span>
								</div>

								{onImportMedia && folderName !== "Main Video" && (
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onImportMedia(folderName);
										}}
										className="text-[10px] text-muted-foreground hover:text-primary p-0.5 rounded transition-colors"
										title={`Import file to ${folderName}`}
									>
										<Plus className="w-2.5 h-2.5" weight="bold" />
									</button>
								)}
							</div>

							{/* Folder Items */}
							{!isCollapsed && (
								<div className="p-1.5 space-y-1 border-t border-foreground/[0.04]">
									{items.length === 0 ? (
										<div className="py-2 text-center text-[10px] text-muted-foreground/60 italic">
											Folder is empty
										</div>
									) : (
										items.map((asset) => {
											const isCurrent = currentActivePath === asset.path;

											return (
												<div
													key={asset.id}
													className={cn(
														"group flex items-center justify-between p-1.5 rounded-md border text-left transition-all",
														isCurrent
															? "bg-primary/10 border-primary/30"
															: "bg-editor-surface/60 border-foreground/[0.04] hover:bg-editor-surface hover:border-foreground/15",
													)}
												>
													<div className="flex items-center gap-2 min-w-0 flex-1 pr-1.5">
														<div
															className={cn(
																"flex items-center justify-center w-6 h-6 rounded shrink-0",
																asset.type === "video" &&
																	"bg-blue-500/15 text-blue-400",
																asset.type === "audio" &&
																	"bg-emerald-500/15 text-emerald-400",
																asset.type === "image" &&
																	"bg-violet-500/15 text-violet-400",
															)}
														>
															{asset.type === "video" && (
																<VideoCamera
																	className="w-3 h-3"
																	weight="bold"
																/>
															)}
															{asset.type === "audio" && (
																<SpeakerHigh
																	className="w-3 h-3"
																	weight="bold"
																/>
															)}
															{asset.type === "image" && (
																<ImageIcon
																	className="w-3 h-3"
																	weight="bold"
																/>
															)}
														</div>

														<div className="flex flex-col min-w-0 flex-1">
															<span
																className="text-[10.5px] font-semibold truncate text-foreground/90 group-hover:text-foreground"
																title={asset.name}
															>
																{asset.name}
															</span>
															<div className="flex items-center gap-1 text-[8.5px] text-muted-foreground">
																<span className="capitalize">
																	{asset.type}
																</span>
																{asset.size > 0 && (
																	<>
																		<span>•</span>
																		<span>
																			{formatBytes(
																				asset.size,
																			)}
																		</span>
																	</>
																)}
																{asset.category === "main" && (
																	<>
																		<span>•</span>
																		<span className="text-primary font-medium">
																			Primary Video
																		</span>
																	</>
																)}
															</div>
														</div>
													</div>

													<div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 shrink-0">
														{/* Action: Use in Slide */}
														{onUseAsset &&
															asset.category !== "main" && (
																<Button
																	type="button"
																	variant="ghost"
																	size="sm"
																	onClick={() => {
																		if (
																			asset.type === "video"
																		) {
																			onUseAsset(
																				asset,
																				"add-video-layer",
																			);
																		} else if (
																			asset.type === "audio"
																		) {
																			onUseAsset(
																				asset,
																				"add-audio",
																			);
																		} else {
																			onUseAsset(
																				asset,
																				"add-overlay",
																			);
																		}
																	}}
																	className="h-5 px-1.5 text-[9.5px] bg-primary/10 hover:bg-primary/20 text-primary font-semibold rounded gap-0.5"
																	title={
																		asset.type === "video"
																			? "Add as Video Layer"
																			: asset.type === "audio"
																				? "Add to Audio Track"
																				: "Add as Overlay"
																	}
																>
																	<Plus
																		className="w-2.5 h-2.5"
																		weight="bold"
																	/>
																	<span>Use</span>
																</Button>
															)}

														{/* Action: Reveal in Explorer */}
														<Button
															type="button"
															variant="ghost"
															size="icon"
															onClick={() => handleReveal(asset.path)}
															className="h-5 w-5 text-muted-foreground hover:text-foreground rounded"
															title="Reveal in File Explorer"
														>
															<FolderOpen className="w-2.5 h-2.5" />
														</Button>

														{/* Action: Delete / Remove */}
														{onRemoveAsset &&
															asset.category === "imported" && (
																<Button
																	type="button"
																	variant="ghost"
																	size="icon"
																	onClick={() =>
																		onRemoveAsset(asset.id)
																	}
																	className="h-5 w-5 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded"
																	title="Remove from this slide"
																>
																	<Trash className="w-2.5 h-2.5" />
																</Button>
															)}
													</div>
												</div>
											);
										})
									)}
								</div>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
