import {
	FolderSimple,
	Plus,
	ArrowsClockwise,
	VideoCamera,
	FileVideo,
	FolderOpen,
	UploadSimple,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface AssetFile {
	name: string;
	path: string;
	size: number;
	mtimeMs: number;
	createdAt: string;
	type: "recording" | "imported";
}

export interface AssetExplorerProps {
	className?: string;
	onAddAsSlide: (filePath: string, label?: string) => void;
	onImportMedia?: () => void;
	currentActivePath?: string | null;
}

function formatBytes(bytes: number): string {
	if (!bytes || bytes <= 0) return "0 B";
	const units = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDate(isoOrMs: string | number): string {
	try {
		const d = new Date(isoOrMs);
		return d.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "";
	}
}

export function AssetExplorer({
	className,
	onAddAsSlide,
	onImportMedia,
	currentActivePath,
}: AssetExplorerProps) {
	const [files, setFiles] = useState<AssetFile[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const loadFiles = useCallback(async () => {
		if (!window.electronAPI?.listRecordingsFiles) return;
		setIsLoading(true);
		try {
			const res = await window.electronAPI.listRecordingsFiles();
			if (res && res.success && Array.isArray(res.files)) {
				setFiles(
					res.files.map((f) => ({
						...f,
						type: "recording" as const,
					})),
				);
			}
		} catch (err) {
			console.error("Failed to load recording assets:", err);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadFiles();
	}, [loadFiles]);

	const handleOpenFolder = () => {
		void window.electronAPI?.openRecordingsFolder?.();
	};

	const handleReveal = (path: string) => {
		void window.electronAPI?.revealInFolder?.(path);
	};

	return (
		<div
			className={cn(
				"flex flex-col h-full w-full bg-editor-surface/80 border-t border-foreground/10 select-none overflow-hidden",
				className,
			)}
		>
			{/* Top Bar / Header */}
			<div className="flex items-center justify-between px-3 py-2 border-b border-foreground/10 bg-editor-surface">
				<div className="flex items-center gap-1.5">
					<FolderSimple className="w-3.5 h-3.5 text-primary" weight="bold" />
					<span className="text-xs font-bold tracking-tight text-foreground">
						Media Library
					</span>
					<span className="text-[10px] px-1.5 py-0.2 rounded-full bg-foreground/10 text-muted-foreground font-semibold">
						{files.length}
					</span>
				</div>

				<div className="flex items-center gap-1">
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={loadFiles}
						className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-md"
						title="Refresh asset files"
						disabled={isLoading}
					>
						<ArrowsClockwise
							className={cn("w-3 h-3", isLoading && "animate-spin")}
						/>
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={handleOpenFolder}
						className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-md"
						title="Open media directory in Explorer"
					>
						<FolderOpen className="w-3 h-3" />
					</Button>
				</div>
			</div>

			{/* Action buttons row */}
			{onImportMedia && (
				<div className="flex items-center gap-1.5 p-2 bg-editor-bg/40 border-b border-foreground/[0.06]">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={onImportMedia}
						className="flex-1 h-6 px-2 text-[11px] gap-1 bg-foreground/[0.06] hover:bg-foreground/10 text-foreground rounded-md font-medium"
					>
						<UploadSimple className="w-2.5 h-2.5" weight="bold" />
						<span>Import Media</span>
					</Button>
				</div>
			)}

			{/* File list */}
			<div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar min-h-0">
				{files.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-28 text-center p-3 text-muted-foreground">
						<FileVideo className="w-6 h-6 mb-1 opacity-40 text-muted-foreground" />
						<p className="text-[11px] font-medium text-foreground/80">No media assets found</p>
						<p className="text-[10px] text-muted-foreground mt-0.5">
							Import video or audio files to your project
						</p>
					</div>
				) : (
					files.map((file) => {
						const isCurrent = currentActivePath === file.path;

						return (
							<div
								key={file.path}
								className={cn(
									"group relative flex items-center justify-between p-2 rounded-lg border transition-all text-left",
									isCurrent
										? "bg-primary/10 border-primary/40 shadow-sm"
										: "bg-editor-surface/60 border-foreground/5 hover:border-foreground/15 hover:bg-editor-surface",
								)}
							>
								<div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
									<div
										className={cn(
											"flex items-center justify-center w-7 h-7 rounded-md flex-shrink-0",
											file.type === "recording"
												? "bg-rose-500/15 text-rose-400"
												: "bg-blue-500/15 text-blue-400",
										)}
									>
										{file.type === "recording" ? (
											<VideoCamera className="w-3.5 h-3.5" weight="bold" />
										) : (
											<FileVideo className="w-3.5 h-3.5" weight="bold" />
										)}
									</div>
									<div className="flex flex-col min-w-0 flex-1">
										<span
											className="text-[11px] font-semibold truncate text-foreground/90 group-hover:text-foreground"
											title={file.name}
										>
											{file.name}
										</span>
										<div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
											<span>{formatBytes(file.size)}</span>
											<span>•</span>
											<span>{formatDate(file.mtimeMs)}</span>
										</div>
									</div>
								</div>

								<div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 flex-shrink-0">
									<Button
										type="button"
										variant="ghost"
										size="icon"
										onClick={() => handleReveal(file.path)}
										className="h-6 w-6 text-muted-foreground hover:text-foreground rounded"
										title="Reveal in File Explorer"
									>
										<FolderOpen className="w-3 h-3" />
									</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => onAddAsSlide(file.path, file.name)}
										className="h-6 px-1.5 text-[10px] bg-primary/15 hover:bg-primary/25 text-primary font-semibold rounded gap-1"
										title="Add this file as a new slide"
									>
										<Plus className="w-2.5 h-2.5" weight="bold" />
										<span>Slide</span>
									</Button>
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}
