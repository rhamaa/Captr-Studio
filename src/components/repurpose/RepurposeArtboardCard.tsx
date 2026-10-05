import {
	ArrowCounterClockwise,
	ArrowsIn,
	ArrowsOut,
	Copy,
	FilmStrip,
	MagnifyingGlassMinus,
	MagnifyingGlassPlus,
	Pause,
	PencilSimple,
	Play,
	Trash,
} from "@phosphor-icons/react";
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { ProjectPreview } from "@/components/editor/ProjectPreview";
import type { RepurposeArtboard, RepurposeArtboardFraming } from "@/core/timeline/repurposeTypes";
import { projectDurationUs, type TimelineProject } from "@/core/timeline/types";
import { drawArtboardFrame } from "./repurposeFraming";

function formatCardTime(seconds: number): string {
	const totalSecs = Math.max(0, seconds);
	const mins = Math.floor(totalSecs / 60);
	const secs = Math.floor(totalSecs % 60);
	const centis = Math.floor((totalSecs % 1) * 10);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${centis}`;
}

export interface RepurposeArtboardCardProps {
	artboard: RepurposeArtboard;
	rootProject: TimelineProject;
	artboardProject?: TimelineProject;
	activePlayingId?: string | null;
	displayHeight?: number;
	onPlayingChange?: (isPlaying: boolean) => void;
	onOpenArtboardEditor?: (artboardId: string) => void;
	onUpdateFraming: (patch: Partial<RepurposeArtboardFraming>) => void;
	onRemove: () => void;
	onResetFraming: () => void;
	onDuplicate?: () => void;
	onRename?: (newName: string) => void;
}

export function RepurposeArtboardCard({
	artboard,
	rootProject,
	artboardProject,
	activePlayingId,
	displayHeight = 360,
	onPlayingChange,
	onOpenArtboardEditor,
	onUpdateFraming,
	onRemove,
	onResetFraming,
	onDuplicate,
	onRename,
}: RepurposeArtboardCardProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [renderedCanvas, setRenderedCanvas] = useState<HTMLCanvasElement | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const dragStart = useRef<{
		x: number;
		y: number;
		initialOffsetX: number;
		initialOffsetY: number;
	}>({ x: 0, y: 0, initialOffsetX: 0, initialOffsetY: 0 });

	// Inline renaming state
	const [isEditingName, setIsEditingName] = useState(false);
	const [nameInput, setNameInput] = useState(artboard.name);

	useEffect(() => {
		setNameInput(artboard.name);
	}, [artboard.name]);

	const handleSaveName = () => {
		setIsEditingName(false);
		const trimmed = nameInput.trim();
		if (trimmed && trimmed !== artboard.name) {
			onRename?.(trimmed);
		} else {
			setNameInput(artboard.name);
		}
	};

	// Determine effective project and duration for this card
	const targetProject = useMemo(() => {
		if (artboard.tracks && artboardProject) {
			return artboardProject;
		}
		return rootProject;
	}, [artboard.tracks, artboardProject, rootProject]);

	const durationUs = useMemo(
		() => Math.max(1_000_000, projectDurationUs(targetProject)),
		[targetProject],
	);

	// Independent Local Playback
	const [localPlaying, setLocalPlaying] = useState(false);
	const [localPlayheadUs, setLocalPlayheadUs] = useState(0);

	// Pause if another card starts playing
	useEffect(() => {
		if (activePlayingId !== undefined && activePlayingId !== artboard.id && localPlaying) {
			setLocalPlaying(false);
		}
	}, [activePlayingId, artboard.id, localPlaying]);

	const localPlayheadUsRef = useRef(localPlayheadUs);
	localPlayheadUsRef.current = localPlayheadUs;

	// Local playback animation loop
	useEffect(() => {
		if (!localPlaying) return;
		const startedAt = performance.now();
		const baseUs = localPlayheadUsRef.current;
		let animId = 0;

		const tick = (now: number) => {
			const elapsedUs = Math.round((now - startedAt) * 1000);
			const nextUs = baseUs + elapsedUs;
			if (nextUs >= durationUs) {
				setLocalPlayheadUs(0);
				setLocalPlaying(false);
				onPlayingChange?.(false);
				return;
			}
			setLocalPlayheadUs(nextUs);
			animId = requestAnimationFrame(tick);
		};

		animId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(animId);
	}, [localPlaying, durationUs, onPlayingChange]);

	const togglePlay = (e: ReactMouseEvent) => {
		e.stopPropagation();
		const next = !localPlaying;
		setLocalPlaying(next);
		onPlayingChange?.(next);
	};

	// Calculate display dimensions based on artboard aspect ratio
	const aspect = artboard.width / Math.max(1, artboard.height);
	const displayWidth = Math.round(displayHeight * aspect);

	// Render frame to canvas whenever renderedCanvas, or framing changes
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		if (renderedCanvas && renderedCanvas.width > 0 && renderedCanvas.height > 0) {
			if (artboard.tracks) {
				ctx.clearRect(0, 0, displayWidth, displayHeight);
				ctx.drawImage(renderedCanvas, 0, 0, displayWidth, displayHeight);
			} else {
				drawArtboardFrame(ctx, renderedCanvas, artboard, displayWidth, displayHeight);
			}
		} else {
			// Placeholder pattern
			ctx.fillStyle = "#151518";
			ctx.fillRect(0, 0, displayWidth, displayHeight);
			ctx.fillStyle = "#4a4a55";
			ctx.font = "12px sans-serif";
			ctx.textAlign = "center";
			ctx.fillText(
				`${artboard.aspectRatio} (${artboard.width}×${artboard.height})`,
				displayWidth / 2,
				displayHeight / 2,
			);
		}
	}, [renderedCanvas, artboard, displayWidth, displayHeight]);

	// Mouse drag-to-pan handlers
	const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(true);
		dragStart.current = {
			x: e.clientX,
			y: e.clientY,
			initialOffsetX: artboard.framing.offsetX,
			initialOffsetY: artboard.framing.offsetY,
		};
	};

	useEffect(() => {
		if (!isDragging) return;

		const handleMouseMove = (e: MouseEvent) => {
			const dx = e.clientX - dragStart.current.x;
			const dy = e.clientY - dragStart.current.y;

			// Movement speed scaled relative to display dimensions
			const deltaOffsetX = -(dx / (displayWidth * 0.75));
			const deltaOffsetY = -(dy / (displayHeight * 0.75));

			onUpdateFraming({
				offsetX: Math.max(
					-0.5,
					Math.min(0.5, dragStart.current.initialOffsetX + deltaOffsetX),
				),
				offsetY: Math.max(
					-0.5,
					Math.min(0.5, dragStart.current.initialOffsetY + deltaOffsetY),
				),
			});
		};

		const handleMouseUp = () => {
			setIsDragging(false);
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isDragging, displayWidth, displayHeight, onUpdateFraming]);

	const scalePercent = Math.round((artboard.framing.scale || 1) * 100);

	return (
		<div className="repurpose-artboard-card" style={{ width: displayWidth }}>
			{/* Hidden Dedicated ProjectPreview running this card's own sequence & playhead */}
			<div style={{ display: "none" }}>
				<ProjectPreview
					project={targetProject}
					timeUs={localPlayheadUs}
					playing={localPlaying}
					onError={() => undefined}
					onRenderedCanvas={setRenderedCanvas}
				/>
			</div>

			{/* Artboard Card Header */}
			<div className="repurpose-card-header">
				<div className="repurpose-card-badge">
					<span className="repurpose-card-aspect">{artboard.aspectRatio}</span>
					{isEditingName ? (
						<input
							type="text"
							className="repurpose-card-name-input"
							value={nameInput}
							autoFocus
							onChange={(e) => setNameInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSaveName();
								if (e.key === "Escape") {
									setIsEditingName(false);
									setNameInput(artboard.name);
								}
							}}
							onBlur={handleSaveName}
							onClick={(e) => e.stopPropagation()}
						/>
					) : (
						<span
							className="repurpose-card-name"
							title="Double-click to rename"
							onDoubleClick={(e) => {
								e.stopPropagation();
								setIsEditingName(true);
							}}
						>
							{artboard.name}
						</span>
					)}
					{!isEditingName && (
						<button
							type="button"
							className="repurpose-card-name-edit-btn"
							title="Rename video"
							onClick={(e) => {
								e.stopPropagation();
								setIsEditingName(true);
							}}
						>
							<PencilSimple size={10} />
						</button>
					)}
					{artboard.tracks && (
						<span
							className="repurpose-card-tag custom"
							title="Independent timeline sequence customized for this artboard"
						>
							Custom
						</span>
					)}
				</div>
				<div className="repurpose-card-actions">
					{onOpenArtboardEditor && (
						<button
							type="button"
							className="repurpose-card-btn repurpose-card-btn-edit"
							title="Edit Timeline (Double-Click)"
							onClick={() => onOpenArtboardEditor(artboard.id)}
						>
							<FilmStrip size={12} weight="bold" />
							<span>Edit</span>
						</button>
					)}
					{onDuplicate && (
						<button
							type="button"
							className="repurpose-card-btn"
							title="Duplicate Artboard"
							onClick={onDuplicate}
						>
							<Copy size={12} />
						</button>
					)}
					<button
						type="button"
						className={`repurpose-card-btn ${artboard.framing.fitMode === "cover" ? "active" : ""}`}
						title={
							artboard.framing.fitMode === "cover"
								? "Mode: Cover (Fill)"
								: "Mode: Contain (Fit)"
						}
						onClick={() =>
							onUpdateFraming({
								fitMode: artboard.framing.fitMode === "cover" ? "contain" : "cover",
							})
						}
					>
						{artboard.framing.fitMode === "cover" ? (
							<ArrowsOut size={12} weight="bold" />
						) : (
							<ArrowsIn size={12} weight="bold" />
						)}
					</button>
					<button
						type="button"
						className="repurpose-card-btn"
						title="Reset framing (Center & 1x)"
						onClick={onResetFraming}
					>
						<ArrowCounterClockwise size={12} />
					</button>
					<button
						type="button"
						className="repurpose-card-btn repurpose-card-btn-danger"
						title="Remove Artboard"
						onClick={onRemove}
					>
						<Trash size={12} />
					</button>
				</div>
			</div>

			{/* Interactive Canvas Viewport */}
			<div
				className={`repurpose-card-viewport ${isDragging ? "dragging" : ""}`}
				style={{ width: displayWidth, height: displayHeight }}
				onMouseDown={handleMouseDown}
				onDoubleClick={(e) => {
					e.stopPropagation();
					onOpenArtboardEditor?.(artboard.id);
				}}
				title="Double-click to edit timeline · Drag mouse to pan camera framing"
			>
				<canvas
					ref={canvasRef}
					width={displayWidth}
					height={displayHeight}
					className="repurpose-card-canvas"
				/>

				{/* Framing indicator crosshair overlay on hover/drag */}
				<div className="repurpose-framing-overlay">
					<span className="repurpose-drag-hint">Double-click to Edit · Drag to Pan</span>
				</div>
			</div>

			{/* Mini Interactive Scrubber Bar */}
			<div
				className="repurpose-card-scrubber"
				onClick={(e) => {
					const rect = e.currentTarget.getBoundingClientRect();
					const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
					const seekUs = Math.round(ratio * durationUs);
					setLocalPlayheadUs(seekUs);
				}}
				title={`Seek: ${formatCardTime(localPlayheadUs / 1_000_000)} / ${formatCardTime(durationUs / 1_000_000)}`}
			>
				<div
					className="repurpose-card-scrubber-fill"
					style={{
						width: `${Math.min(100, (localPlayheadUs / durationUs) * 100)}%`,
					}}
				/>
			</div>

			{/* Artboard Card Footer Toolbar */}
			<div className="repurpose-card-footer">
				<div className="repurpose-card-playback-controls">
					<button
						type="button"
						className="repurpose-card-play-btn"
						title={localPlaying ? "Pause (Local)" : "Play preview (Local)"}
						onClick={togglePlay}
					>
						{localPlaying ? (
							<Pause size={10} weight="fill" />
						) : (
							<Play size={10} weight="fill" />
						)}
					</button>
					<span className="repurpose-card-timecode">
						{formatCardTime(localPlayheadUs / 1_000_000)}
					</span>
				</div>

				<div className="repurpose-zoom-controls">
					<button
						type="button"
						className="repurpose-zoom-btn"
						title="Zoom out"
						onClick={() =>
							onUpdateFraming({
								scale: Math.max(0.5, (artboard.framing.scale || 1) - 0.1),
							})
						}
					>
						<MagnifyingGlassMinus size={11} />
					</button>
					<span className="repurpose-zoom-text">{scalePercent}%</span>
					<button
						type="button"
						className="repurpose-zoom-btn"
						title="Zoom in"
						onClick={() =>
							onUpdateFraming({
								scale: Math.min(3, (artboard.framing.scale || 1) + 0.1),
							})
						}
					>
						<MagnifyingGlassPlus size={11} />
					</button>
				</div>
				<div className="repurpose-resolution-text">
					{artboard.width}×{artboard.height}
				</div>
			</div>
		</div>
	);
}
