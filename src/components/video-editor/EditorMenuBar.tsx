import {
	Check as CheckIcon,
	Export as ExportIcon,
	FilePlus as FilePlusIcon,
	Folder as FolderIcon,
	FolderOpen as FolderOpenIcon,
	Gear as GearIcon,
	House as HouseIcon,
	Info as InfoIcon,
	Keyboard as KeyboardIcon,
	Plus as PlusIcon,
	Scissors as ScissorsIcon,
	Trash as TrashIcon,
} from "@phosphor-icons/react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuSeparator,
	DropdownMenuShortcut,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ProjectLibraryEntry } from "./ProjectBrowserDialog";

export interface EditorMenuBarProps {
	onNewProject: () => void;
	onOpenProjectFile: () => void;
	onOpenRecentProject: (projectPath: string) => void;
	recentProjects: ProjectLibraryEntry[];
	onSaveProject: () => void;
	onSaveAsProject: () => void;
	onImportMedia: () => void;
	onExportVideo: () => void;
	onNavigateToWelcome: () => void;

	canUndo: boolean;
	canRedo: boolean;
	onUndo: () => void;
	onRedo: () => void;
	onSplitClip?: () => void;
	onDeleteClip?: () => void;
	onSelectAllClips?: () => void;

	onZoomInTimeline?: () => void;
	onZoomOutTimeline?: () => void;
	onFitTimeline?: () => void;
	showSocialSafeZone?: boolean;
	onToggleSocialSafeZone?: () => void;

	onOpenSettings: (tab?: string) => void;
	onOpenShortcuts: () => void;
	onOpenProjectsFolder?: () => void;
	onOpenRecordingsFolder?: () => void;

	isMac?: boolean;
}

export function EditorMenuBar({
	onNewProject,
	onOpenProjectFile,
	onOpenRecentProject,
	recentProjects,
	onSaveProject,
	onSaveAsProject,
	onImportMedia,
	onExportVideo,
	onNavigateToWelcome,

	canUndo,
	canRedo,
	onUndo,
	onRedo,
	onSplitClip,
	onDeleteClip,
	onSelectAllClips,

	onZoomInTimeline,
	onZoomOutTimeline,
	onFitTimeline,
	showSocialSafeZone,
	onToggleSocialSafeZone,

	onOpenSettings,
	onOpenShortcuts,
	onOpenProjectsFolder,
	onOpenRecordingsFolder,

	isMac = false,
}: EditorMenuBarProps) {
	const mod = isMac ? "⌘" : "Ctrl+";

	return (
		<div className="flex items-center gap-0.5 text-xs text-foreground/80 font-medium select-none">
			{/* FILE MENU */}
			<DropdownMenu>
				<DropdownMenuTrigger className="px-2.5 py-1 rounded-[5px] hover:bg-foreground/10 hover:text-foreground transition-colors outline-none focus-visible:bg-foreground/10 data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground">
					File
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="min-w-[210px] bg-editor-dialog border border-foreground/15 shadow-xl rounded-xl p-1 text-xs"
				>
					<DropdownMenuItem
						onClick={onNewProject}
						className="cursor-pointer gap-2 py-1.5"
					>
						<FilePlusIcon className="w-4 h-4 text-primary" />
						<span>New Project</span>
						<DropdownMenuShortcut>{mod}N</DropdownMenuShortcut>
					</DropdownMenuItem>

					<DropdownMenuItem
						onClick={onOpenProjectFile}
						className="cursor-pointer gap-2 py-1.5"
					>
						<FolderOpenIcon className="w-4 h-4 text-muted-foreground" />
						<span>Open Project...</span>
						<DropdownMenuShortcut>{mod}O</DropdownMenuShortcut>
					</DropdownMenuItem>

					{/* OPEN RECENT SUBMENU */}
					<DropdownMenuSub>
						<DropdownMenuSubTrigger className="cursor-pointer gap-2 py-1.5">
							<FolderIcon className="w-4 h-4 text-muted-foreground" />
							<span>Open Recent</span>
						</DropdownMenuSubTrigger>
						<DropdownMenuPortal>
							<DropdownMenuSubContent className="min-w-[240px] max-h-[320px] overflow-y-auto bg-editor-dialog border border-foreground/15 shadow-xl rounded-xl p-1 text-xs">
								{recentProjects.length > 0 ? (
									recentProjects.slice(0, 8).map((proj) => (
										<DropdownMenuItem
											key={proj.path}
											onClick={() => onOpenRecentProject(proj.path)}
											className="cursor-pointer flex flex-col items-start gap-0.5 py-1.5"
										>
											<span className="font-medium text-foreground truncate max-w-[210px]">
												{proj.name}
											</span>
											<span className="text-[10px] text-muted-foreground truncate max-w-[210px]">
												{proj.path}
											</span>
										</DropdownMenuItem>
									))
								) : (
									<div className="px-3 py-2 text-muted-foreground text-[11px]">
										No recent projects
									</div>
								)}
							</DropdownMenuSubContent>
						</DropdownMenuPortal>
					</DropdownMenuSub>

					<DropdownMenuSeparator className="bg-foreground/10 my-1" />

					<DropdownMenuItem
						onClick={onSaveProject}
						className="cursor-pointer gap-2 py-1.5"
					>
						<span>Save Project</span>
						<DropdownMenuShortcut>{mod}S</DropdownMenuShortcut>
					</DropdownMenuItem>

					<DropdownMenuItem
						onClick={onSaveAsProject}
						className="cursor-pointer gap-2 py-1.5"
					>
						<span>Save As...</span>
						<DropdownMenuShortcut>
							{isMac ? "⇧⌘S" : "Ctrl+Shift+S"}
						</DropdownMenuShortcut>
					</DropdownMenuItem>

					<DropdownMenuSeparator className="bg-foreground/10 my-1" />

					<DropdownMenuItem
						onClick={onImportMedia}
						className="cursor-pointer gap-2 py-1.5"
					>
						<PlusIcon className="w-4 h-4 text-muted-foreground" />
						<span>Import Media...</span>
						<DropdownMenuShortcut>{mod}I</DropdownMenuShortcut>
					</DropdownMenuItem>

					<DropdownMenuItem
						onClick={onExportVideo}
						className="cursor-pointer gap-2 py-1.5 font-semibold text-primary"
					>
						<ExportIcon className="w-4 h-4 text-primary" />
						<span>Export Video...</span>
						<DropdownMenuShortcut>{mod}E</DropdownMenuShortcut>
					</DropdownMenuItem>

					<DropdownMenuSeparator className="bg-foreground/10 my-1" />

					<DropdownMenuItem
						onClick={onNavigateToWelcome}
						className="cursor-pointer gap-2 py-1.5"
					>
						<HouseIcon className="w-4 h-4 text-muted-foreground" />
						<span>Welcome Screen</span>
						<DropdownMenuShortcut>Alt+Home</DropdownMenuShortcut>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			{/* EDIT MENU */}
			<DropdownMenu>
				<DropdownMenuTrigger className="px-2.5 py-1 rounded-[5px] hover:bg-foreground/10 hover:text-foreground transition-colors outline-none focus-visible:bg-foreground/10 data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground">
					Edit
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="min-w-[190px] bg-editor-dialog border border-foreground/15 shadow-xl rounded-xl p-1 text-xs"
				>
					<DropdownMenuItem
						onClick={onUndo}
						disabled={!canUndo}
						className="cursor-pointer gap-2 py-1.5"
					>
						<span>Undo</span>
						<DropdownMenuShortcut>{mod}Z</DropdownMenuShortcut>
					</DropdownMenuItem>

					<DropdownMenuItem
						onClick={onRedo}
						disabled={!canRedo}
						className="cursor-pointer gap-2 py-1.5"
					>
						<span>Redo</span>
						<DropdownMenuShortcut>{isMac ? "⇧⌘Z" : "Ctrl+Y"}</DropdownMenuShortcut>
					</DropdownMenuItem>

					<DropdownMenuSeparator className="bg-foreground/10 my-1" />

					{onSplitClip && (
						<DropdownMenuItem
							onClick={onSplitClip}
							className="cursor-pointer gap-2 py-1.5"
						>
							<ScissorsIcon className="w-4 h-4 text-muted-foreground" />
							<span>Split at Playhead</span>
							<DropdownMenuShortcut>S</DropdownMenuShortcut>
						</DropdownMenuItem>
					)}

					{onDeleteClip && (
						<DropdownMenuItem
							onClick={onDeleteClip}
							className="cursor-pointer gap-2 py-1.5 text-destructive focus:text-destructive"
						>
							<TrashIcon className="w-4 h-4" />
							<span>Delete Selected</span>
							<DropdownMenuShortcut>Del</DropdownMenuShortcut>
						</DropdownMenuItem>
					)}

					{onSelectAllClips && (
						<DropdownMenuItem
							onClick={onSelectAllClips}
							className="cursor-pointer gap-2 py-1.5"
						>
							<span>Select All Clips</span>
							<DropdownMenuShortcut>{mod}A</DropdownMenuShortcut>
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* VIEW MENU */}
			<DropdownMenu>
				<DropdownMenuTrigger className="px-2.5 py-1 rounded-[5px] hover:bg-foreground/10 hover:text-foreground transition-colors outline-none focus-visible:bg-foreground/10 data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground">
					View
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="min-w-[190px] bg-editor-dialog border border-foreground/15 shadow-xl rounded-xl p-1 text-xs"
				>
					{onZoomInTimeline && (
						<DropdownMenuItem
							onClick={onZoomInTimeline}
							className="cursor-pointer gap-2 py-1.5"
						>
							<span>Zoom In Timeline</span>
							<DropdownMenuShortcut>{mod}+</DropdownMenuShortcut>
						</DropdownMenuItem>
					)}

					{onZoomOutTimeline && (
						<DropdownMenuItem
							onClick={onZoomOutTimeline}
							className="cursor-pointer gap-2 py-1.5"
						>
							<span>Zoom Out Timeline</span>
							<DropdownMenuShortcut>{mod}-</DropdownMenuShortcut>
						</DropdownMenuItem>
					)}

					{onFitTimeline && (
						<DropdownMenuItem
							onClick={onFitTimeline}
							className="cursor-pointer gap-2 py-1.5"
						>
							<span>Fit Timeline to Screen</span>
							<DropdownMenuShortcut>Shift+Z</DropdownMenuShortcut>
						</DropdownMenuItem>
					)}

					{onToggleSocialSafeZone && (
						<>
							<DropdownMenuSeparator className="bg-foreground/10 my-1" />
							<DropdownMenuItem
								onClick={onToggleSocialSafeZone}
								className="cursor-pointer gap-2 py-1.5"
							>
								<span className="flex-1">Social Safe Zones</span>
								{showSocialSafeZone && (
									<CheckIcon className="w-3.5 h-3.5 text-primary" />
								)}
							</DropdownMenuItem>
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* SETTINGS MENU */}
			<DropdownMenu>
				<DropdownMenuTrigger className="px-2.5 py-1 rounded-[5px] hover:bg-foreground/10 hover:text-foreground transition-colors outline-none focus-visible:bg-foreground/10 data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground">
					Settings
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="min-w-[210px] bg-editor-dialog border border-foreground/15 shadow-xl rounded-xl p-1 text-xs"
				>
					<DropdownMenuItem
						onClick={() => onOpenSettings("general")}
						className="cursor-pointer gap-2 py-1.5"
					>
						<GearIcon className="w-4 h-4 text-muted-foreground" />
						<span>Preferences...</span>
						<DropdownMenuShortcut>{mod},</DropdownMenuShortcut>
					</DropdownMenuItem>

					<DropdownMenuItem
						onClick={onOpenShortcuts}
						className="cursor-pointer gap-2 py-1.5"
					>
						<KeyboardIcon className="w-4 h-4 text-muted-foreground" />
						<span>Keyboard Shortcuts...</span>
						<DropdownMenuShortcut>{mod}/</DropdownMenuShortcut>
					</DropdownMenuItem>

					<DropdownMenuSeparator className="bg-foreground/10 my-1" />

					{onOpenProjectsFolder && (
						<DropdownMenuItem
							onClick={onOpenProjectsFolder}
							className="cursor-pointer gap-2 py-1.5"
						>
							<FolderIcon className="w-4 h-4 text-muted-foreground" />
							<span>Open Projects Directory</span>
						</DropdownMenuItem>
					)}

					{onOpenRecordingsFolder && (
						<DropdownMenuItem
							onClick={onOpenRecordingsFolder}
							className="cursor-pointer gap-2 py-1.5"
						>
							<FolderOpenIcon className="w-4 h-4 text-muted-foreground" />
							<span>Open Recordings Directory</span>
						</DropdownMenuItem>
					)}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* HELP MENU */}
			<DropdownMenu>
				<DropdownMenuTrigger className="px-2.5 py-1 rounded-[5px] hover:bg-foreground/10 hover:text-foreground transition-colors outline-none focus-visible:bg-foreground/10 data-[state=open]:bg-foreground/10 data-[state=open]:text-foreground">
					Help
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="start"
					className="min-w-[190px] bg-editor-dialog border border-foreground/15 shadow-xl rounded-xl p-1 text-xs"
				>
					<DropdownMenuItem
						onClick={onNavigateToWelcome}
						className="cursor-pointer gap-2 py-1.5"
					>
						<HouseIcon className="w-4 h-4 text-muted-foreground" />
						<span>Welcome Screen</span>
					</DropdownMenuItem>

					<DropdownMenuSeparator className="bg-foreground/10 my-1" />

					<DropdownMenuItem
						onClick={() => onOpenSettings("about")}
						className="cursor-pointer gap-2 py-1.5"
					>
						<InfoIcon className="w-4 h-4 text-muted-foreground" />
						<span>About Captr Studio...</span>
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
