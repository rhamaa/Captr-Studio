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
	SquaresFour,
	Code,
	Sparkle,
} from "@phosphor-icons/react";
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { AssetLibrary } from "@/components/editor/AssetLibrary";
import { HyperframePreview } from "@/components/hyperframe/HyperframePreview";
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
	const [activeTab, setActiveTab] = useState<"stories" | "hyperframes">("stories");
	const [selectedHyperframeId, setSelectedHyperframeId] = useState<string | null>(null);

	const currentHyperframe = useMemo(() => {
		const hfs = project.hyperframes ?? [];
		if (hfs.length === 0) return null;
		return hfs.find((h) => h.id === selectedHyperframeId) ?? hfs[0];
	}, [project.hyperframes, selectedHyperframeId]);

	const handleCreateHyperframe = (presetTitle = "Kinetic Title Card") => {
		const hfId = `hf-${Date.now().toString(36)}`;
		const hfName = `${presetTitle} ${(project.hyperframes?.length ?? 0) + 1}`;
		const { html } = createDefaultHyperframeTemplate(hfId, hfName, {
			title: projectTitle || "Captr Studio Production",
			subtitle: "Automated Code-Driven Motion Graphic",
			badge: "HYPERFRAME",
			durationSec: 5,
			width: 1920,
			height: 1080,
		});

		const newHf: HyperframeComposition = {
			id: hfId,
			name: hfName,
			entryHtml: `hyperframe/hyperframe-${hfId}.html`,
			specJson: `hyperframe/hyperframe-${hfId}.json`,
			htmlContent: html,
			durationUs: 5_000_000,
			width: 1920,
			height: 1080,
			fps: 60,
			createdAt: new Date().toISOString(),
		};

		onChange((prev) => ({
			...prev,
			hyperframes: [...(prev.hyperframes ?? []), newHf],
		}));
		setSelectedHyperframeId(hfId);
	};

	const handleUpdateHyperframeHtml = (hfId: string, newHtml: string) => {
		onChange((prev) => ({
			...prev,
			hyperframes: (prev.hyperframes ?? []).map((h) =>
				h.id === hfId ? { ...h, htmlContent: newHtml, updatedAt: new Date().toISOString() } : h,
			),
		}));
	};

	// Ensure project has repurposeBoard initialized
	const boardProject = useMemo(() => ensureRepurposeBoard(project), [project]);
	const board = boardProject.repurposeBoard!;

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

	// Stage pan listeners
	const handleStageMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
		if ((e.target as HTMLElement).closest(".repurpose-artboard-card")) return;
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

	// Card Dragging listeners
	const handleStartDragCard = (artboardId: string, e: ReactMouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDraggingCardId(artboardId);
		const currentPos = cardPositions[artboardId] || { x: 0, y: 0 };
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

				{/* Center Summary Indicator & Tab Switcher */}
				<div className="repurpose-header-summary flex items-center gap-3">
					<div className="repurpose-tab-switch inline-flex items-center bg-slate-900 border border-slate-800 rounded-md p-0.5">
						<button
							type="button"
							className={`px-2.5 py-0.5 text-xs font-semibold rounded transition ${
								activeTab === "stories"
									? "bg-sky-500 text-slate-950 shadow-sm"
									: "text-slate-400 hover:text-white"
							}`}
							onClick={() => setActiveTab("stories")}
						>
							Stories ({board.artboards.length})
						</button>
						<button
							type="button"
							className={`px-2.5 py-0.5 text-xs font-semibold rounded transition ${
								activeTab === "hyperframes"
									? "bg-sky-500 text-slate-950 shadow-sm"
									: "text-slate-400 hover:text-white"
							}`}
							onClick={() => setActiveTab("hyperframes")}
						>
							Hyperframes ({project.hyperframes?.length ?? 0})
						</button>
					</div>
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

			{activeTab === "hyperframes" ? (
				<div className="repurpose-hyperframe-stage flex-1 flex bg-slate-950 overflow-hidden p-6 gap-6 min-h-[500px]">
					{/* Hyperframe List Sidebar */}
					<div className="w-80 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-xl">
						<div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
							<div className="flex items-center gap-2">
								<Code size={16} className="text-sky-400" weight="bold" />
								<h4 className="text-xs font-bold text-white uppercase tracking-wider">Hyperframes</h4>
							</div>
							<button
								type="button"
								onClick={() => handleCreateHyperframe("Kinetic Title Card")}
								className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-md transition shadow"
							>
								<Plus size={12} weight="bold" />
								<span>New</span>
							</button>
						</div>
						<div className="flex-1 overflow-y-auto p-2 space-y-1.5">
							{(project.hyperframes ?? []).length === 0 ? (
								<div className="p-6 text-center text-slate-500 text-xs">
									Belum ada Hyperframe code. Klik tombol di atas untuk membuat animasi baru!
								</div>
							) : (
								(project.hyperframes ?? []).map((hf) => {
									const isSelected = (currentHyperframe?.id ?? project.hyperframes?.[0]?.id) === hf.id;
									return (
										<button
											key={hf.id}
											type="button"
											onClick={() => setSelectedHyperframeId(hf.id)}
											className={`w-full text-left p-2.5 rounded-lg border transition ${
												isSelected
													? "bg-sky-500/10 border-sky-500/50 text-white"
													: "bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300"
											}`}
										>
											<div className="text-xs font-semibold">{hf.name}</div>
											<div className="text-[10px] text-slate-400 font-mono mt-0.5">
												{hf.width}x{hf.height} &bull; {(hf.durationUs / 1_000_000).toFixed(1)}s
											</div>
										</button>
									);
								})
							)}
						</div>
					</div>

					{/* Main Hyperframe Preview */}
					<div className="flex-1 h-full min-w-0">
						{currentHyperframe ? (
							<HyperframePreview
								hyperframe={currentHyperframe}
								onUpdateHtml={(newHtml) => handleUpdateHyperframeHtml(currentHyperframe.id, newHtml)}
							/>
						) : (
							<div className="h-full flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl p-8 text-center bg-slate-900/40">
								<div className="p-3 bg-sky-500/10 text-sky-400 rounded-2xl mb-4 border border-sky-500/20">
									<Sparkle size={36} weight="duotone" />
								</div>
								<h3 className="text-base font-semibold text-white mb-2">Code-Driven Hyperframe Studio</h3>
								<p className="text-xs text-slate-400 max-w-md mb-6 leading-relaxed">
									Hyperframe memungkinkan animasi motion graphic, kinetic typography, dan kartu informasi diproduksi menggunakan kode HTML5, CSS, dan GSAP secara pixel-perfect dan siap diorkestrasi oleh AI Agent.
								</p>
								<button
									type="button"
									onClick={() => handleCreateHyperframe("Kinetic Title Card")}
									className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition shadow-lg"
								>
									<Sparkle size={15} weight="bold" />
									<span>Generate Kinetic Intro Hyperframe</span>
								</button>
							</div>
						)}
					</div>
				</div>
			) : (
				/* Main Split Layout: Left Docked Asset Library & Right Artboard Canvas */
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

				{/* Right Artboard Canvas Stage */}
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
						<div
							className="repurpose-canvas-world"
							style={{
								transform: `translate(${stagePan.x}px, ${stagePan.y}px) scale(${stageZoom})`,
							}}
						>
							<div className="repurpose-artboards-grid">
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
							</div>
						</div>
					)}
				</div>
			</div>
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
