import { LocalMediaImage } from "@/components/LocalMediaImage";
import {
	FolderOpen as FolderOpenIcon,
	Gear as GearIcon,
	MagnifyingGlass as MagnifyingGlassIcon,
	Play as PlayIcon,
	Plus as PlusIcon,
	Record as RecordIcon,
	Video as VideoIcon,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { CaptrLogo } from "@/components/brand/CaptrLogo";
import { Button } from "@/components/ui/button";
import type { ProjectLibraryEntry } from "@/components/video-editor/ProjectBrowserDialog";
import { toFileUrl } from "@/components/video-editor/projectPersistence";

interface WelcomeScreenProps {
	onClose?: () => void;
	onNewProject: (aspectRatio?: string) => void;
	onOpenProjectFile: () => void;
	onOpenRecentProject: (path: string) => void;
	onOpenRecorderHud: () => void;
	recentProjects: ProjectLibraryEntry[];
	onRefreshProjects?: () => Promise<void>;
	onOpenSettings?: (tab?: string) => void;
	onOpenShortcuts?: () => void;
	isMac?: boolean;
}

const ASPECT_RATIO_OPTIONS = [
	{ id: "16:9", label: "16:9" },
	{ id: "9:16", label: "9:16" },
	{ id: "1:1", label: "1:1" },
	{ id: "4:5", label: "4:5" },
];

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
	});
}

function MinimizeIcon({ className }: { className?: string }) {
	return (
		<svg className={className} width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2">
			<line x1="1" y1="5.5" x2="10" y2="5.5" />
		</svg>
	);
}

function MaximizeIcon({ className }: { className?: string }) {
	return (
		<svg className={className} width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2">
			<rect x="1" y="1" width="9" height="9" rx="1" />
		</svg>
	);
}

function RestoreIcon({ className }: { className?: string }) {
	return (
		<svg className={className} width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2">
			<rect x="1.5" y="3.5" width="6.5" height="6.5" rx="1" />
			<path d="M3.5 3.5V2C3.5 1.45 3.95 1 4.5 1H9C9.55 1 10 1.45 10 2V6.5C10 7.05 9.55 7.5 9 7.5H7.5" />
		</svg>
	);
}

function CloseIcon({ className }: { className?: string }) {
	return (
		<svg className={className} width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
			<line x1="1.5" y1="1.5" x2="9.5" y2="9.5" />
			<line x1="9.5" y1="1.5" x2="1.5" y2="9.5" />
		</svg>
	);
}

export function WelcomeScreen({
	onClose,
	onNewProject,
	onOpenProjectFile,
	onOpenRecentProject,
	onOpenRecorderHud,
	recentProjects,
	onOpenSettings,
}: WelcomeScreenProps) {
	const [selectedAspectRatio, setSelectedAspectRatio] = useState("16:9");
	const [searchQuery, setSearchQuery] = useState("");
	const [isMaximized, setIsMaximized] = useState(false);

	useEffect(() => {
		window.electronAPI?.isWindowMaximized?.().then((maximized) => {
			setIsMaximized(Boolean(maximized));
		}).catch(() => {});

		const unsubscribe = window.electronAPI?.onWindowMaximizedChange?.((maximized) => {
			setIsMaximized(maximized);
		});
		return () => {
			unsubscribe?.();
		};
	}, []);

	const handleMinimize = async () => {
		await window.electronAPI?.minimizeWindow?.();
	};

	const handleToggleMaximize = async () => {
		const res = await window.electronAPI?.maximizeWindow?.();
		if (res && typeof res.isMaximized === "boolean") {
			setIsMaximized(res.isMaximized);
		}
	};

	const handleClose = async () => {
		await window.electronAPI?.closeWindow?.();
	};

	const filteredProjects = useMemo(() => {
		if (!searchQuery.trim()) {
			return recentProjects;
		}
		const query = searchQuery.toLowerCase();
		return recentProjects.filter(
			(p) => p.name.toLowerCase().includes(query) || p.path.toLowerCase().includes(query),
		);
	}, [recentProjects, searchQuery]);

	const handleOpenProjectsDirectory = async () => {
		try {
			await window.electronAPI?.openProjectsDirectory?.();
		} catch (err) {
			console.error("Failed to open projects directory:", err);
		}
	};

	return (
		<div className="flex flex-col h-full w-full bg-editor-dialog/95 text-foreground select-none overflow-hidden border border-foreground/15 shadow-2xl backdrop-blur-2xl">
			{/* Header */}
			<div
				className="px-5 py-3 border-b border-foreground/10 flex items-center justify-between bg-foreground/[0.02] flex-shrink-0 select-none"
				style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
			>
				<div className="flex items-center gap-3">
					<CaptrLogo variant="icon" size={28} animateGlow={false} />
					<div>
						<h2 className="text-sm font-extrabold tracking-tight text-foreground flex items-center gap-2">
							CAPTR STUDIO
							<span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-semibold">
								v2.4
							</span>
						</h2>
						<p className="text-[11px] text-muted-foreground">Select an option to begin</p>
					</div>
				</div>

				<div
					className="flex items-center gap-1"
					style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
				>
					{onOpenSettings && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={() => onOpenSettings("general")}
							className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground rounded-lg"
							title="Preferences"
						>
							<GearIcon className="w-4 h-4" />
						</Button>
					)}

					<div className="h-4 w-px bg-foreground/10 mx-1" />

					{/* Window Controls */}
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleMinimize}
						className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-lg transition-colors"
						title="Minimize"
						aria-label="Minimize"
					>
						<MinimizeIcon className="w-3.5 h-3.5" />
					</Button>

					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleToggleMaximize}
						className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-foreground/10 rounded-lg transition-colors"
						title={isMaximized ? "Restore" : "Maximize"}
						aria-label={isMaximized ? "Restore" : "Maximize"}
					>
						{isMaximized ? (
							<RestoreIcon className="w-3.5 h-3.5" />
						) : (
							<MaximizeIcon className="w-3.5 h-3.5" />
						)}
					</Button>

					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleClose}
						className="h-7 w-7 p-0 text-muted-foreground hover:text-white hover:bg-red-500 rounded-lg transition-colors"
						title="Close"
						aria-label="Close"
					>
						<CloseIcon className="w-3.5 h-3.5" />
					</Button>
				</div>
			</div>

				{/* Quick Actions (3 Core Pillars) */}
				<div className="p-5 border-b border-foreground/10 bg-foreground/[0.01]">
					<div className="grid grid-cols-3 gap-3">
						{/* Action 1: New Project */}
						<div className="flex flex-col justify-between p-3.5 rounded-xl border border-primary/25 bg-primary/[0.06] hover:bg-primary/[0.1] hover:border-primary/40 transition-all group">
							<div>
								<div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center mb-2.5">
									<PlusIcon className="w-4 h-4" weight="bold" />
								</div>
								<h3 className="text-xs font-bold text-foreground">New Project</h3>
								<p className="text-[10px] text-muted-foreground mt-0.5">Choose aspect ratio</p>
							</div>

							<div className="mt-3 pt-2.5 border-t border-foreground/10 space-y-2">
								<div className="flex items-center gap-1">
									{ASPECT_RATIO_OPTIONS.map((ratio) => (
										<button
											key={ratio.id}
											type="button"
											onClick={() => setSelectedAspectRatio(ratio.id)}
											className={`flex-1 py-1 rounded-md text-[10px] font-semibold transition-all ${
												selectedAspectRatio === ratio.id
													? "bg-primary text-white shadow-sm"
													: "bg-foreground/5 text-muted-foreground hover:bg-foreground/10"
											}`}
										>
											{ratio.label}
										</button>
									))}
								</div>
								<Button
									type="button"
									size="sm"
									onClick={() => onNewProject(selectedAspectRatio)}
									className="w-full h-7 rounded-lg bg-primary text-white text-[11px] font-semibold"
								>
									Start ({selectedAspectRatio})
								</Button>
							</div>
						</div>

						{/* Action 2: Open Project */}
						<button
							type="button"
							onClick={onOpenProjectFile}
							className="flex flex-col justify-between p-3.5 rounded-xl border border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.06] hover:border-foreground/20 transition-all text-left group"
						>
							<div>
								<div className="w-8 h-8 rounded-lg bg-foreground/10 text-foreground flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
									<FolderOpenIcon className="w-4 h-4" />
								</div>
								<h3 className="text-xs font-bold text-foreground">Open Project</h3>
								<p className="text-[10px] text-muted-foreground mt-0.5">Browse .captr files</p>
							</div>
							<div className="text-[10px] text-muted-foreground/60 font-mono mt-4">
								Ctrl + O
							</div>
						</button>

						{/* Action 3: Record Screen */}
						<button
							type="button"
							onClick={onOpenRecorderHud}
							className="flex flex-col justify-between p-3.5 rounded-xl border border-red-500/20 bg-red-500/[0.04] hover:bg-red-500/[0.08] hover:border-red-500/30 transition-all text-left group"
						>
							<div>
								<div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
									<RecordIcon className="w-4 h-4 fill-current animate-pulse" />
								</div>
								<h3 className="text-xs font-bold text-foreground group-hover:text-red-400 transition-colors">
									Record Screen
								</h3>
								<p className="text-[10px] text-muted-foreground mt-0.5">Screen & camera take</p>
							</div>
							<div className="text-[10px] text-red-400 font-semibold mt-4">
								Launch HUD
							</div>
						</button>
					</div>
				</div>

				{/* Recent Projects List Section */}
				<div className="flex-1 min-h-0 flex flex-col p-5">
					<div className="flex items-center justify-between mb-3">
						<div className="flex items-center gap-2">
							<span className="text-xs font-bold text-foreground">Recent Projects</span>
							<span className="px-1.5 py-0.2 rounded-full bg-foreground/10 text-[10px] text-muted-foreground font-semibold">
								{filteredProjects.length}
							</span>
						</div>

						{/* Search Input */}
						{recentProjects.length > 3 && (
							<div className="relative w-44">
								<MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
								<input
									type="text"
									placeholder="Search..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="w-full h-7 pl-7 pr-2 rounded-lg border border-foreground/10 bg-foreground/[0.03] text-foreground text-[11px] placeholder:text-muted-foreground/60 outline-none focus:border-primary"
								/>
							</div>
						)}
					</div>

					{/* Project List */}
					<div className="flex-1 overflow-y-auto max-h-[260px] space-y-1.5 pr-1">
						{filteredProjects.length > 0 ? (
							filteredProjects.map((proj) => {
								const thumbUrl = proj.thumbnailPath ? toFileUrl(proj.thumbnailPath) : null;
								return (
									<div
										key={proj.path}
										onClick={() => onOpenRecentProject(proj.path)}
										className="group flex items-center justify-between px-3 py-2 rounded-xl border border-foreground/5 bg-foreground/[0.02] hover:bg-foreground/[0.06] hover:border-primary/30 transition-all cursor-pointer select-none"
									>
										<div className="flex items-center gap-3 min-w-0">
											<div className="w-10 h-7 rounded-md overflow-hidden bg-foreground/10 border border-foreground/10 flex-shrink-0 flex items-center justify-center relative">
												{thumbUrl ? (
													<LocalMediaImage
														src={thumbUrl}
														alt={proj.name}
														className="w-full h-full object-cover"
													/>
												) : (
													<VideoIcon className="w-3.5 h-3.5 text-muted-foreground" />
												)}
											</div>
											<div className="min-w-0">
												<h4 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
													{proj.name}
												</h4>
												<p className="text-[10px] text-muted-foreground truncate max-w-xs font-mono">
													{proj.path}
												</p>
											</div>
										</div>

										<div className="flex items-center gap-3">
											<span className="text-[10px] text-muted-foreground whitespace-nowrap">
												{formatRelativeTime(proj.updatedAt)}
											</span>
											<div className="w-6 h-6 rounded-md bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
												<PlayIcon className="w-3 h-3 fill-current" />
											</div>
										</div>
									</div>
								);
							})
						) : (
							<div className="py-8 text-center text-xs text-muted-foreground">
								{searchQuery ? "No matching projects found." : "No recent projects yet."}
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
				<div className="px-6 py-2.5 border-t border-foreground/10 bg-foreground/[0.02] flex items-center justify-between text-[11px] text-muted-foreground">
					<button
						type="button"
						onClick={handleOpenProjectsDirectory}
						className="hover:text-foreground transition-colors flex items-center gap-1.5"
					>
						<FolderOpenIcon className="w-3.5 h-3.5" />
						<span>Open Projects Directory</span>
					</button>

					{onClose && (
						<button
							type="button"
							onClick={onClose}
							className="hover:text-foreground transition-colors"
						>
							Continue to Editor &rarr;
						</button>
					)}
				</div>
		</div>
	);
}
