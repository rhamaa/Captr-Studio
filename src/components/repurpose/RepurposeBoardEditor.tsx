import {
	ArrowLeft,
	CaretLeft,
	CaretRight,
	Export,
	FolderOpen,
	Plus,
	Sparkle,
	SquaresFour,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { AssetLibrary } from "@/components/editor/AssetLibrary";
import { createDefaultHyperframeTemplate } from "@/core/story/storyUtils";
import type { HyperframeComposition } from "@/core/story/storyTypes";
import {
	addRepurposeArtboard,
	duplicateRepurposeArtboard,
	ensureRepurposeBoard,
	getArtboardProjectView,
	placeAssetIntoArtboard,
	removeRepurposeArtboard,
	renameRepurposeArtboard,
	resetRepurposeFraming,
	updateRepurposeFraming,
} from "@/core/timeline/repurposeCommands";
import {
	ARTBOARD_PRESETS,
	type ArtboardPreset,
	type RepurposeAspectRatio,
} from "@/core/timeline/repurposeTypes";
import type { TimelineProject } from "@/core/timeline/types";
import { HyperframeEditor } from "@/components/hyperframe/HyperframeEditor";
import { RepurposeBatchExportDialog } from "./RepurposeBatchExportDialog";
import { RepurposeWhiteboardCanvas } from "./whiteboard/RepurposeWhiteboardCanvas";


export interface RepurposeBoardEditorProps {
	project: TimelineProject;
	projectTitle?: string;
	selectedAssetId?: string | null;
	transcripts?: Record<string, any>;
	onChange: (updater: (prev: TimelineProject) => TimelineProject) => void;
	onClose?: () => void;
	onOpenExportModal?: () => void;
	onOpenArtboardEditor?: (artboardId: string) => void;
	onOpenHyperframeEditor?: (hyperframeId: string) => void;
	// Asset management integration
	onImport?: (paths?: string[]) => void;
	onRecord?: () => void;
	onRecordAudio?: () => void;
	onPreviewAsset?: (id: string) => void;
	onPlaceAsset?: (id: string) => void;
	onRemoveAsset?: (id: string) => void;
}

const HYPERFRAME_ASPECT_PRESETS: Array<{
	aspectRatio: RepurposeAspectRatio;
	name: string;
	width: number;
	height: number;
}> = [
	{ aspectRatio: "16:9", name: "16:9 Landscape (YouTube)", width: 1920, height: 1080 },
	{ aspectRatio: "9:16", name: "9:16 Vertical (Shorts/TikTok)", width: 1080, height: 1920 },
	{ aspectRatio: "1:1", name: "1:1 Square (Instagram)", width: 1080, height: 1080 },
	{ aspectRatio: "4:5", name: "4:5 Portrait (Feed)", width: 1080, height: 1350 },
];

export function RepurposeBoardEditor({
	project,
	projectTitle,
	selectedAssetId = null,
	transcripts,
	onChange,
	onClose,
	onOpenExportModal,
	onOpenArtboardEditor,
	onOpenHyperframeEditor,
	onImport,
	onRecord,
	onRecordAudio,
	onPreviewAsset,
	onPlaceAsset,
	onRemoveAsset,
}: RepurposeBoardEditorProps) {
	const [error, setError] = useState<string | null>(null);
	const [showAddMenu, setShowAddMenu] = useState(false);
	const [showAddHyperframeMenu, setShowAddHyperframeMenu] = useState(false);
	const [showExportModal, setShowExportModal] = useState(false);
	const [assetsCollapsed, setAssetsCollapsed] = useState(false);
	const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
	const [editingHyperframeId, setEditingHyperframeId] = useState<string | null>(null);

	// Ensure project has repurposeBoard initialized
	const boardProject = useMemo(() => ensureRepurposeBoard(project), [project]);
	const board = boardProject.repurposeBoard!;
	const hyperframes = useMemo(() => project.hyperframes ?? [], [project.hyperframes]);

	const editingHyperframe = useMemo(() => {
		if (!editingHyperframeId) return null;
		return hyperframes.find((h) => h.id === editingHyperframeId) ?? null;
	}, [hyperframes, editingHyperframeId]);

	const totalVideoCards = board.artboards.length + hyperframes.length;

	// Memoized project views for each artboard sequence
	const artboardProjectViews = useMemo(() => {
		const map = new Map<string, TimelineProject>();
		for (const ab of board.artboards) {
			if (ab.tracks) {
				map.set(ab.id, getArtboardProjectView(boardProject, ab.id));
			}
		}
		return map;
	}, [boardProject, board.artboards]);

	// Keyboard shortcut listener (Esc = back to home if no drawer open)
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

			if (e.key === "Escape" && !editingHyperframeId) {
				e.preventDefault();
				onClose?.();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose, editingHyperframeId]);

	const handleAddPreset = (preset: ArtboardPreset) => {
		onChange((p) => addRepurposeArtboard(p, preset));
		setShowAddMenu(false);
	};

	const handleCreateHyperframe = (preset = HYPERFRAME_ASPECT_PRESETS[0]) => {
		const hfId = `hf-${Date.now().toString(36)}`;
		const hfName = `Hyperframe ${(project.hyperframes?.length ?? 0) + 1} (${preset.aspectRatio})`;

		// Adapt initial duration to project recording or main video asset if present (otherwise 5s)
		const primaryDurationUs =
			project.packages?.[0]?.durationUs ||
			project.assets?.find((a) => a.durationUs && a.durationUs > 0)?.durationUs ||
			5_000_000;
		const primaryDurationSec = Math.max(1, Math.round(primaryDurationUs / 1_000_000));

		const { html } = createDefaultHyperframeTemplate(hfId, hfName, {
			title: projectTitle || "Captr Studio Production",
			subtitle: "Automated Code-Driven Motion Graphic",
			badge: "HYPERFRAME",
			durationSec: primaryDurationSec,
			width: preset.width,
			height: preset.height,
		});

		const newHf: HyperframeComposition = {
			id: hfId,
			name: hfName,
			entryHtml: `hyperframe/hyperframe-${hfId}.html`,
			specJson: `hyperframe/hyperframe-${hfId}.json`,
			htmlContent: html,
			durationUs: primaryDurationSec * 1_000_000,
			width: preset.width,
			height: preset.height,
			fps: 60,
			aspectRatio: preset.aspectRatio,
			createdAt: new Date().toISOString(),
		};

		onChange((prev) => ({
			...prev,
			hyperframes: [...(prev.hyperframes ?? []), newHf],
		}));
		setShowAddHyperframeMenu(false);
		if (onOpenHyperframeEditor) {
			onOpenHyperframeEditor(hfId);
		} else {
			setEditingHyperframeId(hfId);
		}
	};

	const handleUpdateHyperframe = (hfId: string, patch: Partial<HyperframeComposition>) => {
		onChange((prev) => ({
			...prev,
			hyperframes: (prev.hyperframes ?? []).map((h) =>
				h.id === hfId ? { ...h, ...patch, updatedAt: new Date().toISOString() } : h,
			),
		}));
	};

	const handleRenameHyperframe = (hfId: string, newName: string) => {
		handleUpdateHyperframe(hfId, { name: newName });
	};

	const handleDuplicateHyperframe = (hfId: string) => {
		const target = (project.hyperframes ?? []).find((h) => h.id === hfId);
		if (!target) return;
		const dupId = `hf-${Date.now().toString(36)}`;
		const dup: HyperframeComposition = {
			...target,
			id: dupId,
			name: `${target.name} (Copy)`,
			entryHtml: `hyperframe/hyperframe-${dupId}.html`,
			specJson: `hyperframe/hyperframe-${dupId}.json`,
			createdAt: new Date().toISOString(),
		};
		onChange((prev) => ({
			...prev,
			hyperframes: [...(prev.hyperframes ?? []), dup],
		}));
	};

	const handleRemoveHyperframe = (hfId: string) => {
		onChange((prev) => ({
			...prev,
			hyperframes: (prev.hyperframes ?? []).filter((h) => h.id !== hfId),
		}));
		if (editingHyperframeId === hfId) {
			setEditingHyperframeId(null);
		}
	};

	const handlePlaceAssetFromSidebar = (id: string) => {
		if (board.artboards.length > 0) {
			const targetId = activePlayingId ?? board.artboards[0].id;
			onChange((p) => placeAssetIntoArtboard(p, targetId, id));
		} else {
			onPlaceAsset?.(id);
		}
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
				<div className="repurpose-header-summary flex items-center gap-3">
					<span className="repurpose-stat-badge">
						{totalVideoCards} {totalVideoCards === 1 ? "Video Card" : "Video Cards"}
						{hyperframes.length > 0 && board.artboards.length > 0 && (
							<span className="ml-1 text-[11px] text-[#A8AFBD]">
								({board.artboards.length} Stories · {hyperframes.length} Hyperframes)
							</span>
						)}
					</span>
					<span className="repurpose-stat-dot">·</span>
					<span className="repurpose-stat-badge">
						{project.assets.length} {project.assets.length === 1 ? "Asset" : "Assets"}
					</span>
				</div>

				{/* Header Actions: Add Story Artboard, Add Hyperframe & Batch Export */}
				<div className="repurpose-header-right">
					{/* Add Story Video Card */}
					<div className="repurpose-add-wrapper">
						<button
							type="button"
							className="repurpose-add-btn"
							onClick={() => {
								setShowAddMenu((v) => !v);
								setShowAddHyperframeMenu(false);
							}}
							title="Add target aspect ratio story artboard"
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

					{/* Add Hyperframe HTML Video Card */}
					<div className="repurpose-add-wrapper">
						<button
							type="button"
							className="repurpose-add-btn repurpose-add-hyperframe-btn"
							onClick={() => {
								setShowAddHyperframeMenu((v) => !v);
								setShowAddMenu(false);
							}}
							title="Add code-driven Hyperframe video card"
						>
							<Sparkle size={13} weight="bold" className="text-[#A879F5]" />
							<span>Hyperframe</span>
						</button>
						{showAddHyperframeMenu && (
							<div className="repurpose-add-menu">
								{HYPERFRAME_ASPECT_PRESETS.map((preset) => (
									<button
										key={preset.aspectRatio}
										type="button"
										className="repurpose-menu-item"
										onClick={() => handleCreateHyperframe(preset)}
									>
										<span className="repurpose-menu-aspect font-mono text-[#c5a7fb]">
											{preset.aspectRatio}
										</span>
										<span className="repurpose-menu-name">{preset.name}</span>
									</button>
								))}
							</div>
						)}
					</div>

					{/* Batch Export */}
					<button
						type="button"
						className="repurpose-export-btn"
						title="Export videos"
						disabled={totalVideoCards === 0}
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
								onPlace={handlePlaceAssetFromSidebar}
								onRemove={onRemoveAsset ?? (() => undefined)}
							/>
						</div>
					)}
				</aside>

				{/* Right Unified Artboard Canvas Stage */}
				<div className="repurpose-board-stage">
					{totalVideoCards === 0 && !project.whiteboardSnapshot ? (
						<div className="repurpose-empty-board">
							<div className="repurpose-empty-icon">
								<SquaresFour size={40} weight="duotone" />
							</div>
							<h3 className="repurpose-empty-title">Artboard Belum Memiliki Video</h3>
							<p className="repurpose-empty-sub">
								Pilih format video di bawah untuk mulai memproduksi Story dari aset
								atau animasi Hyperframe berbasis kode:
							</p>

							{/* Story Presets */}
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

							{/* Hyperframe Quick Add CTA */}
							<div className="mt-6 flex flex-col items-center">
								<button
									type="button"
									onClick={() => handleCreateHyperframe(HYPERFRAME_ASPECT_PRESETS[0])}
									className="flex items-center gap-2 rounded-xl border border-[#A879F5]/40 bg-[#A879F5]/15 px-4 py-2 text-xs font-bold text-white shadow transition hover:bg-[#A879F5]/25"
								>
									<Sparkle size={15} weight="fill" className="text-[#A879F5]" />
									<span>Buat Animasi Hyperframe (16:9)</span>
								</button>
							</div>
						</div>
					) : (
						<RepurposeWhiteboardCanvas
							project={project}
							boardProject={boardProject}
							artboardProjectViews={artboardProjectViews}
							activePlayingId={activePlayingId}
							setActivePlayingId={setActivePlayingId}
							onChange={onChange}
							onOpenArtboardEditor={onOpenArtboardEditor}
							onOpenHyperframeEditor={(hfId) => {
								if (onOpenHyperframeEditor) {
									onOpenHyperframeEditor(hfId);
								} else {
									setEditingHyperframeId(hfId);
								}
							}}
							onUpdateFraming={(artboardId, patch) =>
								onChange((p) => updateRepurposeFraming(p, artboardId, patch))
							}
							onResetFraming={(artboardId) =>
								onChange((p) => resetRepurposeFraming(p, artboardId))
							}
							onRemoveArtboard={(artboardId) =>
								onChange((p) => removeRepurposeArtboard(p, artboardId))
							}
							onDuplicateArtboard={(artboardId) =>
								onChange((p) => duplicateRepurposeArtboard(p, artboardId))
							}
							onRenameArtboard={(artboardId, newName) =>
								onChange((p) => renameRepurposeArtboard(p, artboardId, newName))
							}
							onRemoveHyperframe={handleRemoveHyperframe}
							onDuplicateHyperframe={handleDuplicateHyperframe}
							onRenameHyperframe={handleRenameHyperframe}
							onDropAsset={(artboardId, assetId) =>
								onChange((p) => placeAssetIntoArtboard(p, artboardId, assetId))
							}
						/>
					)}
				</div>
			</div>

			{/* Fallback In-Place Hyperframe Editor (when not handled by parent router) */}
			{editingHyperframe && (
				<HyperframeEditor
					hyperframe={editingHyperframe}
					project={boardProject}
					projectTitle={projectTitle}
					transcripts={transcripts}
					onUpdate={(patch) => handleUpdateHyperframe(editingHyperframe.id, patch)}
					onClose={() => setEditingHyperframeId(null)}
				/>
			)}

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
