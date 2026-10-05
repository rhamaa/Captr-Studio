import {
	ArrowLeft,
	Export,
	Pause,
	Play,
	Plus,
	Scissors,
	SkipBack,
	SkipForward,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { ProjectPreview } from "@/components/editor/ProjectPreview";
import {
	addRepurposeArtboard,
	duplicateRepurposeArtboard,
	ensureRepurposeBoard,
	getArtboardProjectView,
	removeRepurposeArtboard,
	removeRepurposeSlice,
	resetRepurposeFraming,
	setActiveRepurposeSlice,
	splitRepurposeSliceAtTime,
	updateRepurposeFraming,
	updateRepurposeSlice,
} from "@/core/timeline/repurposeCommands";
import {
	ARTBOARD_PRESETS,
	type ArtboardPreset,
	type RepurposeSlice,
} from "@/core/timeline/repurposeTypes";
import { projectDurationUs, type TimelineProject } from "@/core/timeline/types";
import { RepurposeArtboardCard } from "./RepurposeArtboardCard";
import { RepurposeBatchExportDialog } from "./RepurposeBatchExportDialog";

export interface RepurposeBoardEditorProps {
	project: TimelineProject;
	projectTitle?: string;
	playheadUs: number;
	onSeek: (timeUs: number) => void;
	onChange: (updater: (prev: TimelineProject) => TimelineProject) => void;
	onClose?: () => void;
	onOpenExportModal?: () => void;
	onOpenArtboardEditor?: (artboardId: string) => void;
}

function formatTimecode(seconds: number): string {
	const totalSecs = Math.max(0, seconds);
	const mins = Math.floor(totalSecs / 60);
	const secs = Math.floor(totalSecs % 60);
	const centis = Math.floor((totalSecs % 1) * 100);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(centis).padStart(2, "0")}`;
}

export function RepurposeBoardEditor({
	project,
	projectTitle,
	playheadUs,
	onSeek,
	onChange,
	onClose,
	onOpenExportModal,
	onOpenArtboardEditor,
}: RepurposeBoardEditorProps) {
	const [playing, setPlaying] = useState(false);
	const [masterCanvas, setMasterCanvas] = useState<HTMLCanvasElement | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [showAddMenu, setShowAddMenu] = useState(false);
	const [showExportModal, setShowExportModal] = useState(false);

	// Ensure project has repurposeBoard initialized
	const boardProject = useMemo(() => ensureRepurposeBoard(project), [project]);
	const board = boardProject.repurposeBoard!;

	const totalDurationUs = useMemo(
		() => Math.max(1_000_000, projectDurationUs(boardProject)),
		[boardProject],
	);

	// Keyboard shortcut listener (Space = play/pause, Esc = back, S/C = split at playhead)
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

			if (e.key === " ") {
				e.preventDefault();
				setPlaying((v) => !v);
				return;
			}

			if (e.key === "Escape") {
				e.preventDefault();
				onClose?.();
				return;
			}

			if (
				(e.key.toLowerCase() === "s" || e.key.toLowerCase() === "c") &&
				!e.ctrlKey &&
				!e.metaKey &&
				!e.altKey
			) {
				e.preventDefault();
				onChange((p) => splitRepurposeSliceAtTime(p, playheadUs));
				return;
			}

			if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
				e.preventDefault();
				setPlaying(false);
				const stepUs = e.shiftKey ? 1_000_000 : 1_000_000 / 60;
				const dir = e.key === "ArrowLeft" ? -1 : 1;
				onSeek(Math.max(0, Math.min(totalDurationUs, playheadUs + dir * stepUs)));
				return;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [playheadUs, totalDurationUs, onSeek, onChange, onClose]);

	const handleAddPreset = (preset: ArtboardPreset) => {
		onChange((p) => addRepurposeArtboard(p, preset));
		setShowAddMenu(false);
	};

	const currentSeconds = playheadUs / 1_000_000;
	const totalSeconds = totalDurationUs / 1_000_000;

	return (
		<section className="repurpose-board-editor">
			{/* Hidden Master Frame Renderer evaluating project timeline at playhead */}
			<div className="repurpose-master-render-source" style={{ display: "none" }}>
				<ProjectPreview
					project={boardProject}
					timeUs={playheadUs}
					playing={playing}
					onError={setError}
					onRenderedCanvas={setMasterCanvas}
				/>
			</div>

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

				{/* Transport Controls */}
				<div className="repurpose-transport-center">
					<button
						type="button"
						className="repurpose-step-button"
						aria-label="Step back 1s (Left Arrow)"
						title="Step back 1s (←)"
						onClick={() => {
							setPlaying(false);
							onSeek(Math.max(0, playheadUs - 1_000_000));
						}}
					>
						<SkipBack size={13} weight="bold" />
					</button>
					<button
						type="button"
						className="repurpose-play-button"
						aria-label={playing ? "Pause preview (Space)" : "Play preview (Space)"}
						title={playing ? "Pause (Space)" : "Play (Space)"}
						onClick={() => setPlaying((v) => !v)}
					>
						{playing ? (
							<Pause size={15} weight="fill" />
						) : (
							<Play size={15} weight="fill" />
						)}
					</button>
					<button
						type="button"
						className="repurpose-step-button"
						aria-label="Step forward 1s (Right Arrow)"
						title="Step forward 1s (→)"
						onClick={() => {
							setPlaying(false);
							onSeek(Math.min(totalDurationUs, playheadUs + 1_000_000));
						}}
					>
						<SkipForward size={13} weight="bold" />
					</button>
					<div className="repurpose-timecode">
						<span className="repurpose-time-current">
							{formatTimecode(currentSeconds)}
						</span>
						<span className="repurpose-time-sep">/</span>
						<span className="repurpose-time-total">{formatTimecode(totalSeconds)}</span>
					</div>
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
							<span>Add Artboard</span>
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
						title="Export selected slices and artboards"
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

			{/* Main Canvas Board Workspace */}
			<div className="repurpose-board-stage">
				<div className="repurpose-artboards-grid">
					{board.artboards.map((artboard) => (
						<RepurposeArtboardCard
							key={artboard.id}
							artboard={artboard}
							artboardProject={
								artboard.tracks
									? getArtboardProjectView(boardProject, artboard.id)
									: undefined
							}
							playheadUs={playheadUs}
							playing={playing}
							masterCanvas={masterCanvas}
							displayHeight={360}
							onOpenArtboardEditor={onOpenArtboardEditor}
							onUpdateFraming={(patch) =>
								onChange((p) => updateRepurposeFraming(p, artboard.id, patch))
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
			</div>

			{/* Bottom Slicing Timeline Bar */}
			<div className="repurpose-timeline-bar">
				<div className="repurpose-timeline-toolbar">
					<div className="repurpose-tb-left">
						<button
							type="button"
							className="repurpose-tb-btn repurpose-tb-cut"
							title="Razor split active slice at playhead (S / C)"
							onClick={() =>
								onChange((p) => splitRepurposeSliceAtTime(p, playheadUs))
							}
						>
							<Scissors size={13} />
							<span>Split at Playhead</span>
							<kbd className="repurpose-tb-kbd">S</kbd>
						</button>
						<span className="repurpose-tb-sep" />
						<span className="repurpose-slice-count">
							{board.slices.length} {board.slices.length === 1 ? "Slice" : "Slices"}
						</span>
					</div>

					<div className="repurpose-tb-right">
						<span className="repurpose-tb-hint">
							<kbd>Space</kbd> Play · <kbd>S</kbd> Split · <kbd>Drag</kbd> Frame ·{" "}
							<kbd>Esc</kbd> Back
						</span>
					</div>
				</div>

				{/* Slice chips track with Playhead Indicator */}
				<div className="repurpose-slices-track-wrapper">
					<div
						className="repurpose-playhead-indicator"
						style={{
							left: `${Math.min(100, Math.max(0, (playheadUs / totalDurationUs) * 100))}%`,
						}}
					>
						<div className="repurpose-playhead-handle" />
					</div>
					<div
						className="repurpose-slices-track"
						onClick={(e) => {
							if (e.target === e.currentTarget) {
								const rect = e.currentTarget.getBoundingClientRect();
								const clickX = e.clientX - rect.left;
								const ratio = Math.max(0, Math.min(1, clickX / rect.width));
								onSeek(Math.round(ratio * totalDurationUs));
							}
						}}
					>
						{board.slices.map((slice: RepurposeSlice) => {
							const isSelected = board.activeSliceId === slice.id;
							const durationSec = (slice.endUs - slice.startUs) / 1_000_000;
							const widthPercent = Math.max(
								5,
								((slice.endUs - slice.startUs) / totalDurationUs) * 100,
							);

							return (
								<div
									key={slice.id}
									className={`repurpose-slice-chip ${isSelected ? "selected" : ""}`}
									style={{
										flex: `0 0 ${widthPercent}%`,
										borderLeftColor: slice.color || "#3b82f6",
									}}
									onClick={() => {
										onChange((p) => setActiveRepurposeSlice(p, slice.id));
										onSeek(slice.startUs);
									}}
								>
									<div className="repurpose-slice-title">
										<input
											type="text"
											value={slice.name}
											aria-label="Slice name"
											onChange={(e) => {
												const nextName = e.target.value;
												onChange((p) =>
													updateRepurposeSlice(p, slice.id, {
														name: nextName,
													}),
												);
											}}
											onClick={(e) => e.stopPropagation()}
											className="repurpose-slice-name-input"
										/>
									</div>
									<div className="repurpose-slice-meta">
										<span>{durationSec.toFixed(1)}s</span>
										{board.slices.length > 1 && (
											<button
												type="button"
												className="repurpose-slice-delete"
												title="Delete slice"
												onClick={(e) => {
													e.stopPropagation();
													onChange((p) =>
														removeRepurposeSlice(p, slice.id),
													);
												}}
											>
												✕
											</button>
										)}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{showExportModal && (
				<RepurposeBatchExportDialog
					project={boardProject}
					projectTitle={projectTitle || project.title || "Project"}
					onClose={() => setShowExportModal(false)}
				/>
			)}
		</section>
	);
}
