import {
	ArrowLeft,
	CaretLeft,
	CaretRight,
	Export,
	FolderOpen,
	Plus,
	SquaresFour,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { AssetLibrary } from "@/components/editor/AssetLibrary";
import {
	addRepurposeArtboard,
	duplicateRepurposeArtboard,
	ensureRepurposeBoard,
	getArtboardProjectView,
	removeRepurposeArtboard,
	renameRepurposeArtboard,
	resetRepurposeFraming,
	updateRepurposeFraming,
} from "@/core/timeline/repurposeCommands";
import { ARTBOARD_PRESETS, type ArtboardPreset } from "@/core/timeline/repurposeTypes";
import type { TimelineProject } from "@/core/timeline/types";
import { RepurposeArtboardCard } from "./RepurposeArtboardCard";
import { RepurposeBatchExportDialog } from "./RepurposeBatchExportDialog";

export interface RepurposeBoardEditorProps {
	project: TimelineProject;
	projectTitle?: string;
	selectedAssetId?: string | null;
	onChange: (updater: (prev: TimelineProject) => TimelineProject) => void;
	onClose?: () => void;
	onOpenExportModal?: () => void;
	onOpenArtboardEditor?: (artboardId: string) => void;
	// Asset management integration
	onImport?: (paths?: string[]) => void;
	onRecord?: () => void;
	onRecordAudio?: () => void;
	onPreviewAsset?: (id: string) => void;
	onPlaceAsset?: (id: string) => void;
	onRemoveAsset?: (id: string) => void;
}

export function RepurposeBoardEditor({
	project,
	projectTitle,
	selectedAssetId = null,
	onChange,
	onClose,
	onOpenExportModal,
	onOpenArtboardEditor,
	onImport,
	onRecord,
	onRecordAudio,
	onPreviewAsset,
	onPlaceAsset,
	onRemoveAsset,
}: RepurposeBoardEditorProps) {
	const [error, setError] = useState<string | null>(null);
	const [showAddMenu, setShowAddMenu] = useState(false);
	const [showExportModal, setShowExportModal] = useState(false);
	const [assetsCollapsed, setAssetsCollapsed] = useState(false);
	const [activePlayingId, setActivePlayingId] = useState<string | null>(null);

	// Ensure project has repurposeBoard initialized
	const boardProject = useMemo(() => ensureRepurposeBoard(project), [project]);
	const board = boardProject.repurposeBoard!;

	// Keyboard shortcut listener (Esc = back to home)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target;
			if (
				target instanceof HTMLElement &&
				(target.matches("input,textarea,select,[contenteditable=true]") ||
					target.isContentEditable)
			) {
				return;
			}

			if (e.key === "Escape") {
				e.preventDefault();
				onClose?.();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

	const handleAddPreset = (preset: ArtboardPreset) => {
		onChange((p) => addRepurposeArtboard(p, preset));
		setShowAddMenu(false);
	};

	return (
		<section className="repurpose-board-editor">
			{/* Sub-Editor Header */}
			<header className="repurpose-editor-header">
				<div className="repurpose-header-left">
					{onClose ? (
						<button
							type="button"
							className="repurpose-back-button"
							onClick={onClose}
							title="Return (Esc)"
						>
							<ArrowLeft size={13} weight="bold" />
							<span>Back</span>
							<kbd className="repurpose-kbd">Esc</kbd>
						</button>
					) : (
						<div className="repurpose-hub-title">
							<span>Artboards Hub</span>
						</div>
					)}
					<span className="repurpose-header-sep">/</span>
					{projectTitle && (
						<>
							<span className="repurpose-breadcrumb-project" title={projectTitle}>
								{projectTitle}
							</span>
							<span className="repurpose-header-sep">/</span>
						</>
					)}
					<span className="repurpose-breadcrumb-active">Multi-Artboard Hub</span>
				</div>

				{/* Center Summary Indicator */}
				<div className="repurpose-header-summary">
					<span className="repurpose-stat-badge">
						{board.artboards.length}{" "}
						{board.artboards.length === 1 ? "Video Card" : "Video Cards"}
					</span>
					<span className="repurpose-stat-dot">·</span>
					<span className="repurpose-stat-badge">
						{project.assets.length} {project.assets.length === 1 ? "Asset" : "Assets"}
					</span>
				</div>

				{/* Header Actions: Add Artboard & Batch Export */}
				<div className="repurpose-header-right">
					<div className="repurpose-add-wrapper">
						<button
							type="button"
							className="repurpose-add-btn"
							onClick={() => setShowAddMenu((v) => !v)}
							title="Add target aspect ratio artboard"
						>
							<Plus size={13} weight="bold" />
							<span>Add Video</span>
						</button>
						{showAddMenu && (
							<div className="repurpose-add-menu">
								{ARTBOARD_PRESETS.map((preset) => (
									<button
										key={preset.aspectRatio}
										type="button"
										className="repurpose-menu-item"
										onClick={() => handleAddPreset(preset)}
									>
										<span className="repurpose-menu-aspect">
											{preset.aspectRatio}
										</span>
										<span className="repurpose-menu-name">{preset.name}</span>
									</button>
								))}
							</div>
						)}
					</div>

					<button
						type="button"
						className="repurpose-export-btn"
						title="Export videos"
						disabled={board.artboards.length === 0}
						onClick={() => {
							if (onOpenExportModal) {
								onOpenExportModal();
							} else {
								setShowExportModal(true);
							}
						}}
					>
						<Export size={14} weight="bold" />
						<span>Batch Export</span>
					</button>
				</div>
			</header>

			{error && (
				<div role="alert" className="repurpose-error-bar">
					<span>{error}</span>
					<button onClick={() => setError(null)}>✕</button>
				</div>
			)}

			{/* Main Split Layout: Left Docked Asset Library & Right Artboard Canvas */}
			<div className="repurpose-main-layout">
				{/* Left Docked Assets Sidebar */}
				<aside className={`repurpose-assets-sidebar ${assetsCollapsed ? "collapsed" : ""}`}>
					<div className="repurpose-sidebar-top">
						<div className="repurpose-sidebar-title">
							<FolderOpen size={14} weight="bold" />
							{!assetsCollapsed && <span>Project Assets</span>}
							{!assetsCollapsed && (
								<span className="repurpose-assets-count-badge">
									{project.assets.length}
								</span>
							)}
						</div>
						<button
							type="button"
							className="repurpose-sidebar-toggle-btn"
							onClick={() => setAssetsCollapsed((c) => !c)}
							title={assetsCollapsed ? "Expand Assets Library" : "Collapse Assets"}
						>
							{assetsCollapsed ? <CaretRight size={13} /> : <CaretLeft size={13} />}
						</button>
					</div>

					{!assetsCollapsed && (
						<div className="repurpose-sidebar-content">
							<AssetLibrary
								assets={project.assets}
								packages={project.packages}
								selectedAssetId={selectedAssetId}
								onImport={onImport ?? (() => undefined)}
								onRecord={onRecord ?? (() => undefined)}
								onRecordAudio={onRecordAudio ?? (() => undefined)}
								onPreview={onPreviewAsset ?? (() => undefined)}
								onPlace={onPlaceAsset ?? (() => undefined)}
								onRemove={onRemoveAsset ?? (() => undefined)}
							/>
						</div>
					)}
				</aside>

				{/* Right Artboard Canvas Stage */}
				<div className="repurpose-board-stage">
					{board.artboards.length === 0 ? (
						<div className="repurpose-empty-board">
							<div className="repurpose-empty-icon">
								<SquaresFour size={40} weight="duotone" />
							</div>
							<h3 className="repurpose-empty-title">Artboard Belum Memiliki Video</h3>
							<p className="repurpose-empty-sub">
								Pilih format aspek rasio di bawah untuk mulai memproduksi video dari
								aset project:
							</p>
							<div className="repurpose-empty-presets-grid">
								{ARTBOARD_PRESETS.map((preset) => (
									<button
										key={preset.aspectRatio}
										type="button"
										className="repurpose-empty-preset-card"
										onClick={() => handleAddPreset(preset)}
									>
										<span className="repurpose-empty-preset-ratio">
											{preset.aspectRatio}
										</span>
										<span className="repurpose-empty-preset-name">
											{preset.name}
										</span>
										<span className="repurpose-empty-preset-dims">
											{preset.width} × {preset.height}
										</span>
									</button>
								))}
							</div>
						</div>
					) : (
						<div className="repurpose-artboards-grid">
							{board.artboards.map((artboard) => (
								<RepurposeArtboardCard
									key={artboard.id}
									artboard={artboard}
									rootProject={boardProject}
									artboardProject={
										artboard.tracks
											? getArtboardProjectView(boardProject, artboard.id)
											: undefined
									}
									activePlayingId={activePlayingId}
									displayHeight={360}
									onPlayingChange={(isPlaying) =>
										setActivePlayingId(isPlaying ? artboard.id : null)
									}
									onOpenArtboardEditor={onOpenArtboardEditor}
									onRename={(newName) =>
										onChange((p) =>
											renameRepurposeArtboard(p, artboard.id, newName),
										)
									}
									onUpdateFraming={(patch) =>
										onChange((p) =>
											updateRepurposeFraming(p, artboard.id, patch),
										)
									}
									onResetFraming={() =>
										onChange((p) => resetRepurposeFraming(p, artboard.id))
									}
									onRemove={() =>
										onChange((p) => removeRepurposeArtboard(p, artboard.id))
									}
									onDuplicate={() =>
										onChange((p) => duplicateRepurposeArtboard(p, artboard.id))
									}
								/>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Batch Export Modal Dialog */}
			{showExportModal && (
				<RepurposeBatchExportDialog
					project={boardProject}
					projectTitle={projectTitle || "Project"}
					onClose={() => setShowExportModal(false)}
				/>
			)}
		</section>
	);
}
