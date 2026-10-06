import {
	ArrowLeft,
	ArrowsInSimple,
	CaretLeft,
	CaretRight,
	Export,
	FolderOpen,
	MagnifyingGlassMinus,
	MagnifyingGlassPlus,
	Plus,
	Sparkle,
	SquaresFour,
} from "@phosphor-icons/react";
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
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
import { HyperframeCard } from "./HyperframeCard";
import { HyperframeEditorDrawer } from "./HyperframeEditorDrawer";
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

	// Interactive Canvas Stage Pan and Zoom state
	const [stagePan, setStagePan] = useState({ x: 0, y: 0 });
	const [stageZoom, setStageZoom] = useState(1);
	const [isPanningStage, setIsPanningStage] = useState(false);
	const stagePanStart = useRef({ x: 0, y: 0 });

	// Card Dragging (Repositioning) state
	const [cardPositions, setCardPositions] = useState<Record<string, { x: number; y: number }>>({});
	const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
	const cardDragStart = useRef<{
		mouseX: number;
		mouseY: number;
		initialX: number;
		initialY: number;
	}>({
		mouseX: 0,
		mouseY: 0,
		initialX: 0,
		initialY: 0,
	});

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

	// Stage pan listeners
	const handleStageMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
		if (
			(e.target as HTMLElement).closest(".repurpose-artboard-card") ||
			(e.target as HTMLElement).closest(".repurpose-hyperframe-card")
		) {
			return;
		}
		e.preventDefault();
		setIsPanningStage(true);
		stagePanStart.current = {
			x: e.clientX - stagePan.x,
			y: e.clientY - stagePan.y,
		};
	};

	useEffect(() => {
		if (!isPanningStage) return;
		const handleMouseMove = (e: MouseEvent) => {
			setStagePan({
				x: e.clientX - stagePanStart.current.x,
				y: e.clientY - stagePanStart.current.y,
			});
		};
		const handleMouseUp = () => {
			setIsPanningStage(false);
		};
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isPanningStage]);

	const handleStageWheel = (e: React.WheelEvent<HTMLDivElement>) => {
		if (e.ctrlKey || e.metaKey) {
			e.preventDefault();
			const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
			setStageZoom((prev) =>
				Math.max(0.3, Math.min(2.5, Number((prev * zoomFactor).toFixed(2)))),
			);
		} else {
			setStagePan((prev) => ({
				x: prev.x - e.deltaX,
				y: prev.y - e.deltaY,
			}));
		}
	};

	// Card Dragging listeners (works for both Story & Hyperframe cards)
	const handleStartDragCard = (cardId: string, e: ReactMouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDraggingCardId(cardId);
		const currentPos = cardPositions[cardId] || { x: 0, y: 0 };
		cardDragStart.current = {
			mouseX: e.clientX,
			mouseY: e.clientY,
			initialX: currentPos.x,
			initialY: currentPos.y,
		};
	};

	useEffect(() => {
		if (!draggingCardId) return;
		const handleMouseMove = (e: MouseEvent) => {
			const dx = (e.clientX - cardDragStart.current.mouseX) / stageZoom;
			const dy = (e.clientY - cardDragStart.current.mouseY) / stageZoom;
			setCardPositions((prev) => ({
				...prev,
				[draggingCardId]: {
					x: Math.round(cardDragStart.current.initialX + dx),
					y: Math.round(cardDragStart.current.initialY + dy),
				},
			}));
		};
		const handleMouseUp = () => {
			setDraggingCardId(null);
		};
		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [draggingCardId, stageZoom]);

	const handleResetView = () => {
		setStagePan({ x: 0, y: 0 });
		setStageZoom(1);
	};

	const handleAddPreset = (preset: ArtboardPreset) => {
		onChange((p) => addRepurposeArtboard(p, preset));
		setShowAddMenu(false);
	};

	const handleCreateHyperframe = (preset = HYPERFRAME_ASPECT_PRESETS[0]) => {
		const hfId = `hf-${Date.now().toString(36)}`;
		const hfName = `Hyperframe ${(project.hyperframes?.length ?? 0) + 1} (${preset.aspectRatio})`;
		const { html } = createDefaultHyperframeTemplate(hfId, hfName, {
			title: projectTitle || "Captr Studio Production",
			subtitle: "Automated Code-Driven Motion Graphic",
			badge: "HYPERFRAME",
			durationSec: 5,
			width: preset.width,
			height: preset.height,
		});

		const newHf: HyperframeComposition = {
			id: hfId,
			name: hfName,
			entryHtml: `hyperframe/hyperframe-${hfId}.html`,
			specJson: `hyperframe/hyperframe-${hfId}.json`,
			htmlContent: html,
			durationUs: 5_000_000,
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
		setEditingHyperframeId(hfId);
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
				<div
					className={`repurpose-board-stage ${isPanningStage ? "panning" : ""}`}
					onMouseDown={handleStageMouseDown}
					onWheel={handleStageWheel}
				>
					{/* Floating Canvas Navigation Toolbar */}
					<div
						className="repurpose-canvas-controls"
						onClick={(e) => e.stopPropagation()}
					>
						<button
							type="button"
							className="repurpose-canvas-ctrl-btn"
							title="Zoom Out"
							onClick={() =>
								setStageZoom((z) => Math.max(0.3, Number((z - 0.1).toFixed(2))))
							}
						>
							<MagnifyingGlassMinus size={13} />
						</button>
						<span className="repurpose-canvas-zoom-label" title="Current Zoom">
							{Math.round(stageZoom * 100)}%
						</span>
						<button
							type="button"
							className="repurpose-canvas-ctrl-btn"
							title="Zoom In"
							onClick={() =>
								setStageZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))
							}
						>
							<MagnifyingGlassPlus size={13} />
						</button>
						<button
							type="button"
							className="repurpose-canvas-ctrl-btn"
							title="Reset View (Center & 100%)"
							onClick={handleResetView}
						>
							<ArrowsInSimple size={13} />
							<span>Center</span>
						</button>
					</div>

					{totalVideoCards === 0 ? (
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
						<div
							className="repurpose-canvas-world"
							style={{
								transform: `translate(${stagePan.x}px, ${stagePan.y}px) scale(${stageZoom})`,
							}}
						>
							<div className="repurpose-artboards-grid">
								{/* Render Story Artboard Cards */}
								{board.artboards.map((artboard) => {
									const pos = cardPositions[artboard.id];
									return (
										<div
											key={artboard.id}
											className="repurpose-card-slot"
											style={
												pos
													? {
															transform: `translate(${pos.x}px, ${pos.y}px)`,
															position: "relative",
															zIndex:
																draggingCardId === artboard.id
																	? 20
																	: 1,
														}
													: { position: "relative" }
											}
										>
											<RepurposeArtboardCard
												artboard={artboard}
												rootProject={boardProject}
												artboardProject={artboardProjectViews.get(
													artboard.id,
												)}
												activePlayingId={activePlayingId}
												displayHeight={360}
												onPlayingChange={(isPlaying) =>
													setActivePlayingId(
														isPlaying ? artboard.id : null,
													)
												}
												onOpenArtboardEditor={onOpenArtboardEditor}
												onRename={(newName) =>
													onChange((p) =>
														renameRepurposeArtboard(
															p,
															artboard.id,
															newName,
														),
													)
												}
												onUpdateFraming={(patch) =>
													onChange((p) =>
														updateRepurposeFraming(
															p,
															artboard.id,
															patch,
														),
													)
												}
												onResetFraming={() =>
													onChange((p) =>
														resetRepurposeFraming(p, artboard.id),
													)
												}
												onRemove={() =>
													onChange((p) =>
														removeRepurposeArtboard(p, artboard.id),
													)
												}
												onDuplicate={() =>
													onChange((p) =>
														duplicateRepurposeArtboard(p, artboard.id),
													)
												}
												onStartDragCard={(e) =>
													handleStartDragCard(artboard.id, e)
												}
												onDropAsset={(assetId) =>
													onChange((p) =>
														placeAssetIntoArtboard(
															p,
															artboard.id,
															assetId,
														),
													)
												}
											/>
										</div>
									);
								})}

								{/* Render Unified Hyperframe Cards */}
								{hyperframes.map((hf) => {
									const pos = cardPositions[hf.id];
									return (
										<div
											key={hf.id}
											className="repurpose-card-slot"
											style={
												pos
													? {
															transform: `translate(${pos.x}px, ${pos.y}px)`,
															position: "relative",
															zIndex:
																draggingCardId === hf.id ? 20 : 1,
														}
													: { position: "relative" }
											}
										>
											<HyperframeCard
												hyperframe={hf}
												displayHeight={360}
												onOpenEditor={() => setEditingHyperframeId(hf.id)}
												onRename={(newName) => handleRenameHyperframe(hf.id, newName)}
												onDuplicate={() => handleDuplicateHyperframe(hf.id)}
												onRemove={() => handleRemoveHyperframe(hf.id)}
												onStartDragCard={(e) => handleStartDragCard(hf.id, e)}
											/>
										</div>
									);
								})}
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Slide-over Hyperframe Editor Drawer */}
			{editingHyperframe && (
				<HyperframeEditorDrawer
					hyperframe={editingHyperframe}
					project={boardProject}
					projectTitle={projectTitle}
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
