import {
	ArrowCounterClockwise,
	FileAudio,
	FileImage,
	FileVideo,
	Folder,
	FolderOpen,
	FolderSimple,
	GridFour,
	Image as ImageIcon,
	List,
	MagnifyingGlass,
	Plus,
	SpeakerHigh,
	Trash,
	UploadSimple,
	VideoCamera,
	X,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
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
	if (!bytes || bytes <= 0) return "--";
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
	onAddAsSlide: _onAddAsSlide,
	onImportMedia,
	onUseAsset,
	onRemoveAsset,
	currentActivePath,
}: AssetExplorerProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [typeFilter, setTypeFilter] = useState<"all" | "video" | "audio" | "image">("all");
	const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
	const [activeSubfolder, setActiveSubfolder] = useState<string | null>(null); // null = root view showing all folders
	const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

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
			if (activeSubfolder && asset.subfolder !== activeSubfolder) return false;
			if (searchQuery.trim()) {
				const query = searchQuery.toLowerCase();
				return (
					asset.name.toLowerCase().includes(query) ||
					(asset.subfolder && asset.subfolder.toLowerCase().includes(query))
				);
			}
			return true;
		});
	}, [slideAssets, typeFilter, activeSubfolder, searchQuery]);

	// Group assets by subfolder
	const subfolderGroups = useMemo(() => {
		const groups: Record<string, SlideAssetFile[]> = {};

		for (const folder of DEFAULT_SUBFOLDERS) {
			groups[folder] = [];
		}

		for (const asset of slideAssets) {
			const folder = asset.subfolder || "Imported Media";
			if (!groups[folder]) {
				groups[folder] = [];
			}
			groups[folder].push(asset);
		}

		return groups;
	}, [slideAssets]);

	const handleReveal = (path: string) => {
		void window.electronAPI?.revealInFolder?.(path);
	};

	// Drag & Drop Handler for Assets
	const handleDragStart = (e: React.DragEvent, asset: SlideAssetFile) => {
		e.stopPropagation();
		const assetPayload = JSON.stringify(asset);
		e.dataTransfer.setData("application/x-captr-asset", assetPayload);
		e.dataTransfer.setData("application/json", assetPayload);
		e.dataTransfer.setData("text/plain", asset.path);
		e.dataTransfer.effectAllowed = "copyMove";
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
				"flex flex-col h-full w-full bg-[#18181b]/95 border border-foreground/10 rounded-xl select-none overflow-hidden text-[11px] font-sans shadow-xl",
				className,
			)}
		>
			{/* Windows File Explorer Title Bar & Breadcrumb */}
			<div className="flex flex-col border-b border-foreground/10 bg-[#202024]">
				{/* Top Command Bar */}
				<div className="flex items-center justify-between px-2.5 py-1.5 border-b border-foreground/[0.06]">
					<div className="flex items-center gap-1.5">
						<button
							type="button"
							onClick={() => setActiveSubfolder(null)}
							className={cn(
								"p-1 rounded hover:bg-foreground/10 text-muted-foreground transition-colors",
								activeSubfolder ? "text-foreground hover:text-white" : "opacity-40 cursor-default",
							)}
							title="Back to Root Folder"
							disabled={!activeSubfolder}
						>
							<ArrowCounterClockwise className="w-3.5 h-3.5" weight="bold" />
						</button>

						{/* Breadcrumb Path Bar */}
						<div className="flex items-center gap-1 px-2 py-0.5 rounded bg-foreground/[0.04] border border-foreground/10 text-[10.5px] max-w-[210px] truncate">
							<FolderSimple className="w-3 h-3 text-amber-400 shrink-0" weight="fill" />
							<button
								type="button"
								onClick={() => setActiveSubfolder(null)}
								className="text-foreground/80 hover:text-foreground font-semibold hover:underline truncate"
							>
								{activeClip.label || "Slide Media"}
							</button>
							{activeSubfolder && (
								<>
									<span className="text-muted-foreground text-[10px]">&gt;</span>
									<span className="text-primary font-semibold truncate">
										{activeSubfolder}
									</span>
								</>
							)}
						</div>
					</div>

					{/* View Toggle & Import Actions */}
					<div className="flex items-center gap-1">
						<div className="flex items-center bg-foreground/[0.06] rounded-md p-0.5 border border-foreground/10">
							<button
								type="button"
								onClick={() => setViewMode("grid")}
								className={cn(
									"p-1 rounded transition-colors",
									viewMode === "grid"
										? "bg-primary text-white shadow-xs"
										: "text-muted-foreground hover:text-foreground",
								)}
								title="Icons / Grid View"
							>
								<GridFour className="w-3 h-3" weight="bold" />
							</button>
							<button
								type="button"
								onClick={() => setViewMode("list")}
								className={cn(
									"p-1 rounded transition-colors",
									viewMode === "list"
										? "bg-primary text-white shadow-xs"
										: "text-muted-foreground hover:text-foreground",
								)}
								title="Details / List View"
							>
								<List className="w-3 h-3" weight="bold" />
							</button>
						</div>

						{onImportMedia && (
							<Button
								type="button"
								size="sm"
								onClick={() => onImportMedia(activeSubfolder || "Imported Media")}
								className="h-6 px-2 text-[10.5px] gap-1 bg-primary hover:bg-primary/90 text-white rounded-md shadow-xs cursor-pointer"
								title="Import file to current folder"
							>
								<UploadSimple className="w-3 h-3" weight="bold" />
								<span>Import</span>
							</Button>
						)}
					</div>
				</div>

				{/* Search & Quick Category Filters */}
				<div className="flex items-center justify-between px-2.5 py-1.5 gap-2 bg-[#1c1c20]">
					<div className="relative flex items-center flex-1">
						<MagnifyingGlass className="absolute left-2 w-3 h-3 text-muted-foreground pointer-events-none" />
						<input
							type="text"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder={
								activeSubfolder
									? `Search in ${activeSubfolder}...`
									: "Search media (video, audio, graphic)..."
							}
							className="w-full h-6 pl-7 pr-6 rounded bg-foreground/[0.04] border border-foreground/10 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:border-primary/50"
						/>
						{searchQuery && (
							<button
								type="button"
								onClick={() => setSearchQuery("")}
								className="absolute right-1.5 p-0.5 text-muted-foreground hover:text-foreground"
							>
								<X className="w-2.5 h-2.5" />
							</button>
						)}
					</div>

					<div className="flex items-center gap-0.5 shrink-0">
						{(["all", "video", "audio", "image"] as const).map((filter) => (
							<button
								key={filter}
								type="button"
								onClick={() => setTypeFilter(filter)}
								className={cn(
									"px-1.5 py-0.5 text-[9.5px] rounded capitalize transition-colors",
									typeFilter === filter
										? "bg-foreground/20 text-foreground font-bold"
										: "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05]",
								)}
							>
								{filter}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Explorer Body: Split into Quick Folder Bar & Content Canvas */}
			<div className="flex-1 flex min-h-0 overflow-hidden bg-[#141416]">
				{/* Left Sidebar: Windows Navigation Pane */}
				<div className="w-28 shrink-0 border-r border-foreground/[0.07] bg-[#18181c] p-1.5 overflow-y-auto space-y-0.5 custom-scrollbar">
					<button
						type="button"
						onClick={() => setActiveSubfolder(null)}
						className={cn(
							"w-full flex items-center gap-1.5 px-2 py-1 rounded text-left transition-colors",
							activeSubfolder === null
								? "bg-primary/20 text-primary font-bold border border-primary/30"
								: "text-foreground/75 hover:bg-foreground/[0.05] hover:text-foreground",
						)}
					>
						<FolderOpen className="w-3.5 h-3.5 text-primary shrink-0" weight="fill" />
						<span className="truncate text-[10px]">All Files</span>
						<span className="ml-auto text-[8.5px] text-muted-foreground">
							{slideAssets.length}
						</span>
					</button>

					<div className="pt-1.5 pb-1 px-1">
						<span className="text-[8.5px] font-bold uppercase tracking-wider text-muted-foreground/60">
							Folders
						</span>
					</div>

					{DEFAULT_SUBFOLDERS.map((folderName) => {
						const count = subfolderGroups[folderName]?.length || 0;
						const isSelected = activeSubfolder === folderName;
						return (
							<button
								key={folderName}
								type="button"
								onClick={() => setActiveSubfolder(folderName)}
								className={cn(
									"w-full flex items-center justify-between px-2 py-1 rounded text-left transition-colors group",
									isSelected
										? "bg-primary/20 text-primary font-bold border border-primary/30"
										: "text-foreground/70 hover:bg-foreground/[0.05] hover:text-foreground",
								)}
							>
								<div className="flex items-center gap-1.5 min-w-0">
									<Folder
										className={cn(
											"w-3 h-3 shrink-0",
											count > 0 ? "text-amber-400" : "text-muted-foreground/50",
										)}
										weight={count > 0 ? "fill" : "regular"}
									/>
									<span className="truncate text-[9.5px]" title={folderName}>
										{folderName}
									</span>
								</div>
								<span className="text-[8.5px] px-1 rounded bg-foreground/[0.06] text-muted-foreground group-hover:text-foreground">
									{count}
								</span>
							</button>
						);
					})}
				</div>

				{/* Right Canvas: Windows Explorer Items Display (Grid / List) */}
				<div
					className="flex-1 overflow-y-auto p-2.5 custom-scrollbar min-h-0 relative"
					onClick={() => setSelectedAssetId(null)}
				>
					{filteredAssets.length === 0 ? (
						<div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-8">
							<FolderSimple className="w-8 h-8 opacity-25 mb-1.5" />
							<p className="text-[11px] font-semibold text-foreground/80">
								{searchQuery ? "No matching assets found" : "Folder is empty"}
							</p>
							<p className="text-[9.5px] text-muted-foreground mt-0.5">
								{searchQuery
									? "Try searching for a different keyword or filter"
									: "Import or drag media files here to get started"}
							</p>
							{onImportMedia && (
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => onImportMedia(activeSubfolder || "Imported Media")}
									className="mt-3 h-6 px-2.5 text-[10px] border-foreground/15 hover:bg-foreground/5"
								>
									<UploadSimple className="w-3 h-3 mr-1" />
									Import Media
								</Button>
							)}
						</div>
					) : viewMode === "grid" ? (
						/* GRID VIEW (Explorer Large Icons) */
						<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
							{filteredAssets.map((asset) => {
								const isCurrent = currentActivePath === asset.path;
								const isSelected = selectedAssetId === asset.id;

								return (
									<div
										key={asset.id}
										draggable={true}
										onDragStart={(e) => handleDragStart(e, asset)}
										onClick={(e) => {
											e.stopPropagation();
											setSelectedAssetId(asset.id);
										}}
										className={cn(
											"group relative flex flex-col rounded-lg border p-2 text-left cursor-grab active:cursor-grabbing transition-all select-none",
											isSelected
												? "bg-primary/20 border-primary shadow-sm"
												: isCurrent
													? "bg-primary/10 border-primary/40"
													: "bg-editor-surface/50 border-foreground/[0.08] hover:bg-editor-surface hover:border-foreground/25 hover:shadow-xs",
										)}
										title={`${asset.name}\nDrag to timeline to insert`}
									>
										{/* Asset Thumbnail / Icon Preview */}
										<div
											className={cn(
												"relative w-full h-16 rounded flex items-center justify-center overflow-hidden mb-1.5 border border-foreground/[0.05]",
												asset.type === "video" &&
													"bg-gradient-to-br from-blue-950/40 to-blue-900/20 text-blue-400",
												asset.type === "audio" &&
													"bg-gradient-to-br from-emerald-950/40 to-emerald-900/20 text-emerald-400",
												asset.type === "image" &&
													"bg-gradient-to-br from-violet-950/40 to-violet-900/20 text-violet-400",
											)}
										>
											{asset.type === "video" && (
												<FileVideo className="w-8 h-8 opacity-85" weight="duotone" />
											)}
											{asset.type === "audio" && (
												<FileAudio className="w-8 h-8 opacity-85" weight="duotone" />
											)}
											{asset.type === "image" && (
												<FileImage className="w-8 h-8 opacity-85" weight="duotone" />
											)}

											{/* Type Badge on Top Left */}
											<span
												className={cn(
													"absolute top-1 left-1 px-1 py-0.2 rounded text-[7.5px] font-bold uppercase tracking-wider",
													asset.type === "video" && "bg-blue-500/80 text-white",
													asset.type === "audio" && "bg-emerald-500/80 text-white",
													asset.type === "image" && "bg-violet-500/80 text-white",
												)}
											>
												{asset.type}
											</span>

											{/* Main Video Indicator */}
											{asset.category === "main" && (
												<span className="absolute bottom-1 right-1 px-1 py-0.2 rounded bg-amber-500/85 text-white text-[7.5px] font-bold">
													Primary
												</span>
											)}
										</div>

										{/* Filename & Info */}
										<div className="flex flex-col min-w-0">
											<span
												className="font-semibold text-foreground/95 truncate text-[10.5px]"
												title={asset.name}
											>
												{asset.name}
											</span>
											<div className="flex items-center justify-between text-[8.5px] text-muted-foreground mt-0.5">
												<span className="truncate max-w-[70px]">
													{asset.subfolder || "Media"}
												</span>
												<span>{formatBytes(asset.size)}</span>
											</div>
										</div>

										{/* Floating Quick Action Buttons on Hover */}
										<div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity bg-black/70 backdrop-blur-xs rounded p-0.5 border border-white/10">
											{onUseAsset && asset.category !== "main" && (
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														if (asset.type === "video") {
															onUseAsset(asset, "add-video-layer");
														} else if (asset.type === "audio") {
															onUseAsset(asset, "add-audio");
														} else {
															onUseAsset(asset, "add-overlay");
														}
													}}
													className="p-1 hover:bg-primary rounded text-white"
													title={
														asset.type === "video"
															? "Add to timeline as Video Layer"
															: asset.type === "audio"
																? "Add to timeline as Audio Track"
																: "Add to timeline as Overlay"
													}
												>
													<Plus className="w-2.5 h-2.5" weight="bold" />
												</button>
											)}
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													handleReveal(asset.path);
												}}
												className="p-1 hover:bg-white/20 rounded text-foreground"
												title="Reveal in Windows File Explorer"
											>
												<FolderOpen className="w-2.5 h-2.5" />
											</button>
											{onRemoveAsset && asset.category === "imported" && (
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														onRemoveAsset(asset.id);
													}}
													className="p-1 hover:bg-rose-500/30 text-rose-400 rounded"
													title="Remove from Slide"
												>
													<Trash className="w-2.5 h-2.5" />
												</button>
											)}
										</div>
									</div>
								);
							})}
						</div>
					) : (
						/* DETAILS / LIST VIEW (Windows Explorer Table) */
						<div className="flex flex-col border border-foreground/[0.08] rounded-lg overflow-hidden bg-editor-surface/30">
							{/* Table Header */}
							<div className="grid grid-cols-12 px-2.5 py-1.5 bg-foreground/[0.04] border-b border-foreground/[0.08] text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">
								<div className="col-span-6 flex items-center gap-1">Name</div>
								<div className="col-span-2">Type</div>
								<div className="col-span-2">Size</div>
								<div className="col-span-2 text-right">Actions</div>
							</div>

							{/* Table Rows */}
							<div className="divide-y divide-foreground/[0.04]">
								{filteredAssets.map((asset) => {
									const isCurrent = currentActivePath === asset.path;
									const isSelected = selectedAssetId === asset.id;

									return (
										<div
											key={asset.id}
											draggable={true}
											onDragStart={(e) => handleDragStart(e, asset)}
											onClick={(e) => {
												e.stopPropagation();
												setSelectedAssetId(asset.id);
											}}
											className={cn(
												"grid grid-cols-12 px-2.5 py-1.5 items-center cursor-grab active:cursor-grabbing text-left transition-colors select-none group",
												isSelected
													? "bg-primary/20 text-foreground"
													: isCurrent
														? "bg-primary/10 text-foreground"
														: "hover:bg-foreground/[0.04] text-foreground/85",
											)}
											title="Drag to timeline to insert"
										>
											{/* Name Column */}
											<div className="col-span-6 flex items-center gap-2 min-w-0 pr-1">
												<div
													className={cn(
														"p-1 rounded shrink-0",
														asset.type === "video" && "bg-blue-500/20 text-blue-400",
														asset.type === "audio" && "bg-emerald-500/20 text-emerald-400",
														asset.type === "image" && "bg-violet-500/20 text-violet-400",
													)}
												>
													{asset.type === "video" && (
														<VideoCamera className="w-3 h-3" weight="bold" />
													)}
													{asset.type === "audio" && (
														<SpeakerHigh className="w-3 h-3" weight="bold" />
													)}
													{asset.type === "image" && (
														<ImageIcon className="w-3 h-3" weight="bold" />
													)}
												</div>
												<span className="truncate font-medium text-[10.5px]" title={asset.name}>
													{asset.name}
												</span>
												{asset.category === "main" && (
													<span className="text-[7.5px] px-1 py-0.2 rounded bg-primary/20 text-primary font-bold shrink-0">
														Primary
													</span>
												)}
											</div>

											{/* Type Column */}
											<div className="col-span-2 capitalize text-muted-foreground text-[10px]">
												{asset.type}
											</div>

											{/* Size Column */}
											<div className="col-span-2 text-muted-foreground text-[10px]">
												{formatBytes(asset.size)}
											</div>

											{/* Actions Column */}
											<div className="col-span-2 flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
												{onUseAsset && asset.category !== "main" && (
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															if (asset.type === "video") {
																onUseAsset(asset, "add-video-layer");
															} else if (asset.type === "audio") {
																onUseAsset(asset, "add-audio");
															} else {
																onUseAsset(asset, "add-overlay");
															}
														}}
														className="p-1 hover:bg-primary/20 text-primary rounded transition-colors"
														title="Add to timeline"
													>
														<Plus className="w-3 h-3" weight="bold" />
													</button>
												)}
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														handleReveal(asset.path);
													}}
													className="p-1 hover:bg-foreground/10 text-muted-foreground hover:text-foreground rounded transition-colors"
													title="Reveal in File Explorer"
												>
													<FolderOpen className="w-3 h-3" />
												</button>
												{onRemoveAsset && asset.category === "imported" && (
													<button
														type="button"
														onClick={(e) => {
															e.stopPropagation();
															onRemoveAsset(asset.id);
														}}
														className="p-1 hover:bg-rose-500/20 text-muted-foreground hover:text-rose-400 rounded transition-colors"
														title="Delete from Slide"
													>
														<Trash className="w-3 h-3" />
													</button>
												)}
											</div>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Explorer Status Bar */}
			<div className="flex items-center justify-between px-3 py-1 bg-[#1a1a1e] border-t border-foreground/[0.07] text-[9.5px] text-muted-foreground">
				<div className="flex items-center gap-2">
					<span>{filteredAssets.length} items</span>
					{activeSubfolder && (
						<>
							<span>•</span>
							<span className="text-foreground/75 font-medium">{activeSubfolder}</span>
						</>
					)}
				</div>
				<span className="text-foreground/50 text-[9px] italic">
					Tip: Drag and drop any media asset directly to the Timeline
				</span>
			</div>
		</div>
	);
}
