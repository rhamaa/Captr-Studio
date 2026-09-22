import {
	DotsThreeVertical as DotsThreeVerticalIcon,
	FolderOpen as FolderOpenIcon,
	Play as PlayIcon,
	Trash as TrashIcon,
	Video as VideoIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { CaptrLogo } from "@/components/brand/CaptrLogo";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectLibraryEntry } from "@/components/video-editor/ProjectBrowserDialog";
import { toFileUrl } from "@/components/video-editor/projectPersistence";

interface ProjectCardProps {
	entry: ProjectLibraryEntry;
	onOpen: (path: string) => void;
	onReveal?: (path: string) => void;
	onDelete?: (path: string) => void;
	viewMode?: "grid" | "list";
}

function formatRelativeTime(timestamp: number): string {
	if (!timestamp) return "Unknown date";
	const diff = Date.now() - timestamp;
	const minute = 60 * 1000;
	const hour = 60 * minute;
	const day = 24 * hour;
	const week = 7 * day;

	if (diff < minute) return "Just now";
	if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
	if (diff < day) return `${Math.floor(diff / hour)}h ago`;
	if (diff < week) return `${Math.floor(diff / day)}d ago`;
	return new Date(timestamp).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function ProjectCard({
	entry,
	onOpen,
	onReveal,
	onDelete,
	viewMode = "grid",
}: ProjectCardProps) {
	const [imageError, setImageError] = useState(false);
	// Prefer the preview embedded inside the .captr bundle (data URL, immune to
	// file:// blocking for projects outside app-managed directories); fall back
	// to the legacy loose ".preview.png" sidecar.
	const imageUrl = !imageError
		? (entry.thumbnailDataUrl ?? (entry.thumbnailPath ? toFileUrl(entry.thumbnailPath) : null))
		: null;

	if (viewMode === "list") {
		return (
			<div
				onClick={() => onOpen(entry.path)}
				className="group flex items-center justify-between px-4 py-3 rounded-xl border border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.05] hover:border-primary/30 transition-all cursor-pointer select-none"
			>
				<div className="flex items-center gap-3.5 min-w-0">
					<div className="w-16 h-10 rounded-lg overflow-hidden bg-foreground/5 border border-foreground/10 flex-shrink-0 flex items-center justify-center relative">
						{imageUrl ? (
							<img
								src={imageUrl}
								alt={entry.name}
								className="w-full h-full object-cover"
								onError={() => setImageError(true)}
							/>
						) : (
							<CaptrLogo variant="icon" size={24} />
						)}
					</div>
					<div className="min-w-0">
						<h4 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
							{entry.name}
						</h4>
						<p className="text-[11px] text-muted-foreground truncate max-w-sm">
							{entry.path}
						</p>
					</div>
				</div>

				<div className="flex items-center gap-4">
					<span className="text-xs text-muted-foreground whitespace-nowrap">
						{formatRelativeTime(entry.updatedAt)}
					</span>

					<DropdownMenu>
						<DropdownMenuTrigger
							onClick={(e) => e.stopPropagation()}
							className="p-1.5 rounded-md hover:bg-foreground/10 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
						>
							<DotsThreeVerticalIcon className="w-4 h-4" weight="bold" />
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-44 bg-editor-dialog border border-foreground/10 text-xs shadow-xl p-1 rounded-xl"
						>
							<DropdownMenuItem
								onClick={() => onOpen(entry.path)}
								className="gap-2 cursor-pointer"
							>
								<PlayIcon className="w-3.5 h-3.5 text-primary" />
								<span>Open Project</span>
							</DropdownMenuItem>
							{onReveal && (
								<DropdownMenuItem
									onClick={() => onReveal(entry.path)}
									className="gap-2 cursor-pointer"
								>
									<FolderOpenIcon className="w-3.5 h-3.5 text-muted-foreground" />
									<span>Reveal in Explorer</span>
								</DropdownMenuItem>
							)}
							{onDelete && (
								<DropdownMenuItem
									onClick={() => onDelete(entry.path)}
									className="gap-2 text-destructive cursor-pointer"
								>
									<TrashIcon className="w-3.5 h-3.5" />
									<span>Delete Project</span>
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
		);
	}

	return (
		<div
			onClick={() => onOpen(entry.path)}
			className="group flex flex-col rounded-2xl border border-foreground/10 bg-card/[0.65] hover:bg-card hover:border-primary/40 transition-all duration-200 cursor-pointer overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 select-none"
		>
			{/* Thumbnail Area */}
			<div className="relative aspect-video w-full bg-gradient-to-br from-slate-900 to-black overflow-hidden flex items-center justify-center border-b border-foreground/5">
				{imageUrl ? (
					<img
						src={imageUrl}
						alt={entry.name}
						className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
						onError={() => setImageError(true)}
					/>
				) : (
					<div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
						<CaptrLogo variant="icon" size={44} animateGlow={false} />
						<span className="text-[10px] text-muted-foreground/60 font-mono tracking-wider uppercase">
							Captr Studio Project
						</span>
					</div>
				)}

				{/* Hover Play Backdrop */}
				<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
					<div className="w-11 h-11 rounded-full bg-primary/90 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
						<PlayIcon className="w-5 h-5 fill-current ml-0.5" />
					</div>
				</div>

				{/* Context Menu Trigger */}
				<div
					className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity"
					onClick={(e) => e.stopPropagation()}
				>
					<DropdownMenu>
						<DropdownMenuTrigger className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-md text-white flex items-center justify-center border border-white/10 shadow-sm transition-colors">
							<DotsThreeVerticalIcon className="w-4 h-4" weight="bold" />
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-44 bg-editor-dialog border border-foreground/10 text-xs shadow-xl p-1 rounded-xl"
						>
							<DropdownMenuItem
								onClick={() => onOpen(entry.path)}
								className="gap-2 cursor-pointer"
							>
								<PlayIcon className="w-3.5 h-3.5 text-primary" />
								<span>Open Project</span>
							</DropdownMenuItem>
							{onReveal && (
								<DropdownMenuItem
									onClick={() => onReveal(entry.path)}
									className="gap-2 cursor-pointer"
								>
									<FolderOpenIcon className="w-3.5 h-3.5 text-muted-foreground" />
									<span>Reveal in Explorer</span>
								</DropdownMenuItem>
							)}
							{onDelete && (
								<DropdownMenuItem
									onClick={() => onDelete(entry.path)}
									className="gap-2 text-destructive cursor-pointer"
								>
									<TrashIcon className="w-3.5 h-3.5" />
									<span>Delete Project</span>
								</DropdownMenuItem>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Project Info */}
			<div className="p-3.5 flex flex-col justify-between flex-1">
				<div>
					<h4
						className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors"
						title={entry.name}
					>
						{entry.name}
					</h4>
					<p
						className="text-[11px] text-muted-foreground truncate mt-0.5 font-mono"
						title={entry.path}
					>
						{entry.path}
					</p>
				</div>

				<div className="flex items-center justify-between pt-3 mt-2 border-t border-foreground/5 text-[11px] text-muted-foreground">
					<span>{formatRelativeTime(entry.updatedAt)}</span>
					<span className="flex items-center gap-1 text-[10px] text-primary/80 font-medium">
						<VideoIcon className="w-3 h-3" />
						.captr
					</span>
				</div>
			</div>
		</div>
	);
}
