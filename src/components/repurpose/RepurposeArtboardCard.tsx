import {
	ArrowCounterClockwise,
	ArrowsIn,
	ArrowsOut,
	Copy,
	FilmStrip,
	MagnifyingGlassMinus,
	MagnifyingGlassPlus,
	Trash,
} from "@phosphor-icons/react";
import React, { useEffect, useRef, useState } from "react";
import { ProjectPreview } from "@/components/editor/ProjectPreview";
import type { RepurposeArtboard, RepurposeArtboardFraming } from "@/core/timeline/repurposeTypes";
import type { TimelineProject } from "@/core/timeline/types";
import { drawArtboardFrame } from "./repurposeFraming";

export interface RepurposeArtboardCardProps {
	artboard: RepurposeArtboard;
	artboardProject?: TimelineProject;
	playheadUs?: number;
	playing?: boolean;
	masterCanvas: HTMLCanvasElement | null;
	displayHeight?: number;
	onOpenArtboardEditor?: (artboardId: string) => void;
	onUpdateFraming: (patch: Partial<RepurposeArtboardFraming>) => void;
	onRemove: () => void;
	onResetFraming: () => void;
	onDuplicate?: () => void;
}

export function RepurposeArtboardCard({
	artboard,
	artboardProject,
	playheadUs = 0,
	playing = false,
	masterCanvas,
	displayHeight = 360,
	onOpenArtboardEditor,
	onUpdateFraming,
	onRemove,
	onResetFraming,
	onDuplicate,
}: RepurposeArtboardCardProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [customCanvas, setCustomCanvas] = useState<HTMLCanvasElement | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const dragStart = useRef<{
		x: number;
		y: number;
		initialOffsetX: number;
		initialOffsetY: number;
	}>({ x: 0, y: 0, initialOffsetX: 0, initialOffsetY: 0 });

	// Calculate display dimensions based on artboard aspect ratio
	const aspect = artboard.width / Math.max(1, artboard.height);
	const displayWidth = Math.round(displayHeight * aspect);

	// Render frame to canvas whenever masterCanvas, customCanvas, or framing changes
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		if (artboard.tracks && customCanvas && customCanvas.width > 0 && customCanvas.height > 0) {
			ctx.clearRect(0, 0, displayWidth, displayHeight);
			ctx.drawImage(customCanvas, 0, 0, displayWidth, displayHeight);
		} else if (masterCanvas && masterCanvas.width > 0 && masterCanvas.height > 0) {
			drawArtboardFrame(ctx, masterCanvas, artboard, displayWidth, displayHeight);
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
	}, [masterCanvas, customCanvas, artboard, displayWidth, displayHeight]);

	// Mouse drag-to-pan handlers
	const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
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
			{/* Hidden Dedicated ProjectPreview if Artboard has its own custom sequence */}
			{artboard.tracks && artboardProject && (
				<div style={{ display: "none" }}>
					<ProjectPreview
						project={artboardProject}
						timeUs={playheadUs}
						playing={playing}
						onError={() => undefined}
						onRenderedCanvas={setCustomCanvas}
					/>
				</div>
			)}

			{/* Artboard Card Header */}
			<div className="repurpose-card-header">
				<div className="repurpose-card-badge">
					<span className="repurpose-card-aspect">{artboard.aspectRatio}</span>
					<span className="repurpose-card-name" title={artboard.name}>
						{artboard.name}
					</span>
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

			{/* Artboard Card Footer Toolbar */}
			<div className="repurpose-card-footer">
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
