import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ClipTransform, TimelineProject } from "@/core/timeline/types";
import {
	type CanvasObjectBounds,
	type ResizeHandleDirection,
	calculateResizeScale,
	calculateRotationAngle,
	getActiveVisualClipsBounds,
	hitTestCanvasPoint,
} from "./canvasGizmoMath";
import { ASSET_DRAG_TYPE, getTimelineDrag } from "./timelineInteractions";

export interface CanvasTransformGizmoProps {
	project: TimelineProject;
	timeUs: number;
	selectedClipId?: string | null;
	canvasElement?: HTMLCanvasElement | null;
	onSelectClip?: (clipId: string) => void;
	onUpdateClipTransform?: (clipId: string, transform: ClipTransform) => void;
	onDropAsset?: (assetId: string, canvasX: number, canvasY: number) => void;
	disabled?: boolean;
}

type DragMode = "translate" | "resize" | "rotate" | null;

interface DragState {
	mode: DragMode;
	clipId: string;
	handle?: ResizeHandleDirection;
	startX: number; // screen coords
	startY: number;
	initialTransform: ClipTransform;
	initialBounds: CanvasObjectBounds;
}

export function CanvasTransformGizmo({
	project,
	timeUs,
	selectedClipId,
	canvasElement,
	onSelectClip,
	onUpdateClipTransform,
	onDropAsset,
	disabled = false,
}: CanvasTransformGizmoProps) {
	const overlayRef = useRef<HTMLDivElement>(null);

	// Compute all visible bounds at current playhead time
	const visibleBounds = useMemo(() => {
		return getActiveVisualClipsBounds(project, timeUs);
	}, [project, timeUs]);

	// Find bounds for the currently selected clip
	const selectedBounds = useMemo(() => {
		if (!selectedClipId) return null;
		return visibleBounds.find((b) => b.clipId === selectedClipId) ?? null;
	}, [visibleBounds, selectedClipId]);

	// Local transform for 60 FPS drag feedback before committing to history
	const [activeTransform, setActiveTransform] = useState<ClipTransform | null>(null);
	const dragState = useRef<DragState | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [dragCoordsHud, setDragCoordsHud] = useState<{ x: number; y: number } | null>(null);
	const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

	// Overlay bounding rect tracking
	const [overlayRect, setOverlayRect] = useState<DOMRect | null>(null);

	useEffect(() => {
		const target = overlayRef.current ?? canvasElement;
		if (!target) return;

		const updateRect = () => {
			const el = overlayRef.current ?? canvasElement;
			if (el) {
				const rect = el.getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0) {
					setOverlayRect(rect);
				}
			}
		};

		updateRect();
		window.addEventListener("resize", updateRect);
		const observer = new ResizeObserver(updateRect);
		observer.observe(target);

		return () => {
			window.removeEventListener("resize", updateRect);
			observer.disconnect();
		};
	}, [canvasElement]);

	// Keep activeTransform in sync with selected clip
	useEffect(() => {
		if (selectedBounds) {
			const clip = project.tracks
				.flatMap((t) => t.clips)
				.find((c) => c.id === selectedBounds.clipId);
			if (clip) {
				setActiveTransform(structuredClone(clip.transform));
			}
		} else {
			setActiveTransform(null);
		}
	}, [selectedBounds, project]);

	const { width: projectWidth, height: projectHeight } = project.canvas;

	// Scale factors: screen pixels / project canvas units
	const scaleFactorX = overlayRect && projectWidth > 0 ? overlayRect.width / projectWidth : 1;
	const scaleFactorY = overlayRect && projectHeight > 0 ? overlayRect.height / projectHeight : 1;

	// Start window-based drag listener loop
	const startDragSession = (
		mode: DragMode,
		clipId: string,
		initialTransform: ClipTransform,
		initialBounds: CanvasObjectBounds,
		clientX: number,
		clientY: number,
		handle?: ResizeHandleDirection,
	) => {
		dragState.current = {
			mode,
			clipId,
			handle,
			startX: clientX,
			startY: clientY,
			initialTransform: structuredClone(initialTransform),
			initialBounds: structuredClone(initialBounds),
		};

		setIsDragging(true);
		setDragCoordsHud({ x: initialTransform.x, y: initialTransform.y });

		const handleWindowPointerMove = (e: PointerEvent) => {
			const drag = dragState.current;
			if (!drag) return;

			const rect = overlayRef.current?.getBoundingClientRect() ?? overlayRect;
			const currentScaleX = rect && projectWidth > 0 ? rect.width / projectWidth : scaleFactorX;
			const currentScaleY = rect && projectHeight > 0 ? rect.height / projectHeight : scaleFactorY;

			const deltaScreenX = e.clientX - drag.startX;
			const deltaScreenY = e.clientY - drag.startY;

			if (drag.mode === "translate") {
				const deltaCanvasX = deltaScreenX / currentScaleX;
				const deltaCanvasY = deltaScreenY / currentScaleY;

				const newX = Math.round(drag.initialTransform.x + deltaCanvasX);
				const newY = Math.round(drag.initialTransform.y + deltaCanvasY);

				const newTransform: ClipTransform = {
					...drag.initialTransform,
					x: newX,
					y: newY,
				};
				setActiveTransform(newTransform);
				setDragCoordsHud({ x: newX, y: newY });
			} else if (drag.mode === "resize" && drag.handle) {
				const deltaCanvasX = deltaScreenX / currentScaleX;
				const deltaCanvasY = deltaScreenY / currentScaleY;

				const rad = (-drag.initialTransform.rotation * Math.PI) / 180;
				const localDeltaX = deltaCanvasX * Math.cos(rad) - deltaCanvasY * Math.sin(rad);
				const localDeltaY = deltaCanvasX * Math.sin(rad) + deltaCanvasY * Math.cos(rad);

				const newScale = calculateResizeScale(
					drag.initialTransform.scale,
					drag.initialBounds.width,
					drag.initialBounds.height,
					drag.handle,
					localDeltaX,
					localDeltaY,
				);

				const newTransform: ClipTransform = {
					...drag.initialTransform,
					scale: newScale,
				};
				setActiveTransform(newTransform);
			} else if (drag.mode === "rotate") {
				const originLeft = rect ? rect.left : 0;
				const originTop = rect ? rect.top : 0;
				const centerScreenX = originLeft + drag.initialBounds.centerX * currentScaleX;
				const centerScreenY = originTop + drag.initialBounds.centerY * currentScaleY;

				const angle = calculateRotationAngle(
					centerScreenX,
					centerScreenY,
					e.clientX,
					e.clientY,
				);

				const newTransform: ClipTransform = {
					...drag.initialTransform,
					rotation: angle,
				};
				setActiveTransform(newTransform);
			}
		};

		const handleWindowPointerUp = () => {
			window.removeEventListener("pointermove", handleWindowPointerMove);
			window.removeEventListener("pointerup", handleWindowPointerUp);

			const drag = dragState.current;
			dragState.current = null;
			setIsDragging(false);
			setDragCoordsHud(null);

			if (drag && onUpdateClipTransform) {
				setActiveTransform((current) => {
					if (current) {
						onUpdateClipTransform(drag.clipId, current);
					}
					return current;
				});
			}
		};

		window.addEventListener("pointermove", handleWindowPointerMove);
		window.addEventListener("pointerup", handleWindowPointerUp);
	};

	// Handle background canvas click and immediate selection + drag
	const handleOverlayPointerDown = (e: React.PointerEvent) => {
		if (disabled || e.button !== 0) return;

		const rect = overlayRef.current?.getBoundingClientRect() ?? overlayRect;
		if (!rect) return;

		const currentScaleX = rect.width / projectWidth;
		const currentScaleY = rect.height / projectHeight;

		const clickScreenX = e.clientX - rect.left;
		const clickScreenY = e.clientY - rect.top;

		const canvasX = clickScreenX / currentScaleX;
		const canvasY = clickScreenY / currentScaleY;

		const hit = hitTestCanvasPoint(visibleBounds, canvasX, canvasY);
		if (hit) {
			e.stopPropagation();
			e.preventDefault();
			onSelectClip?.(hit.clipId);

			const clip = project.tracks
				.flatMap((t) => t.clips)
				.find((c) => c.id === hit.clipId);
			const initialTransform = clip ? structuredClone(clip.transform) : {
				x: hit.centerX - projectWidth / 2,
				y: hit.centerY - projectHeight / 2,
				scale: hit.scale,
				rotation: hit.rotation,
				opacity: hit.opacity,
			};
			setActiveTransform(initialTransform);
			startDragSession("translate", hit.clipId, initialTransform, hit, e.clientX, e.clientY);
		} else {
			// Clicked empty area
			onSelectClip?.("");
		}
	};

	// Translate on selected bounding box
	const startTranslate = (e: React.PointerEvent) => {
		if (!selectedBounds || !activeTransform || e.button !== 0) return;
		e.stopPropagation();
		e.preventDefault();

		startDragSession(
			"translate",
			selectedBounds.clipId,
			activeTransform,
			selectedBounds,
			e.clientX,
			e.clientY,
		);
	};

	// Resize on handle
	const startResize = (e: React.PointerEvent, handle: ResizeHandleDirection) => {
		if (!selectedBounds || !activeTransform || e.button !== 0) return;
		e.stopPropagation();
		e.preventDefault();

		startDragSession(
			"resize",
			selectedBounds.clipId,
			activeTransform,
			selectedBounds,
			e.clientX,
			e.clientY,
			handle,
		);
	};

	// Rotate on handle
	const startRotate = (e: React.PointerEvent) => {
		if (!selectedBounds || !activeTransform || e.button !== 0) return;
		e.stopPropagation();
		e.preventDefault();

		startDragSession(
			"rotate",
			selectedBounds.clipId,
			activeTransform,
			selectedBounds,
			e.clientX,
			e.clientY,
		);
	};

	// HTML5 Drag-and-Drop from Asset Library
	const handleDragOver = (e: React.DragEvent) => {
		if (e.dataTransfer.types.includes(ASSET_DRAG_TYPE)) {
			e.preventDefault();
			e.dataTransfer.dropEffect = "copy";
			if (!isDragOverCanvas) setIsDragOverCanvas(true);
		}
	};

	const handleDragLeave = () => {
		setIsDragOverCanvas(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		setIsDragOverCanvas(false);
		const assetId = e.dataTransfer.getData(ASSET_DRAG_TYPE) || getTimelineDrag()?.id;
		if (!assetId || !onDropAsset) return;

		e.preventDefault();
		const rect = overlayRef.current?.getBoundingClientRect() ?? overlayRect;
		if (!rect) return;

		const currentScaleX = rect.width / projectWidth;
		const currentScaleY = rect.height / projectHeight;

		const canvasX = Math.round((e.clientX - rect.left) / currentScaleX);
		const canvasY = Math.round((e.clientY - rect.top) / currentScaleY);

		onDropAsset(assetId, canvasX, canvasY);
	};

	if (disabled) {
		return null;
	}

	// Calculate display coordinates for selected gizmo box
	const currentCenterX = activeTransform
		? projectWidth / 2 + activeTransform.x
		: selectedBounds?.centerX ?? 0;
	const currentCenterY = activeTransform
		? projectHeight / 2 + activeTransform.y
		: selectedBounds?.centerY ?? 0;
	const currentScale = activeTransform?.scale ?? selectedBounds?.scale ?? 1;
	const currentRotation = activeTransform?.rotation ?? selectedBounds?.rotation ?? 0;

	const boxW = (selectedBounds?.width ?? 100) * currentScale * scaleFactorX;
	const boxH = (selectedBounds?.height ?? 100) * currentScale * scaleFactorY;
	const boxX = (currentCenterX * scaleFactorX) - boxW / 2;
	const boxY = (currentCenterY * scaleFactorY) - boxH / 2;

	return (
		<div
			ref={overlayRef}
			className={`canvas-transform-gizmo-layer absolute inset-0 pointer-events-auto select-none overflow-hidden ${
				isDragOverCanvas ? "border-2 border-primary border-dashed bg-primary/10" : ""
			}`}
			onPointerDown={handleOverlayPointerDown}
			onDragOver={handleDragOver}
			onDragLeave={handleDragLeave}
			onDrop={handleDrop}
		>
			{/* Drop target prompt when dragging asset from library */}
			{isDragOverCanvas && (
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					<div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-primary/50 text-white text-xs font-medium shadow-2xl animate-pulse">
						Drop to place overlay at cursor
					</div>
				</div>
			)}

			{/* Selected bounding box and handles */}
			{selectedBounds && (
				<div
					className="absolute transition-shadow duration-75"
					style={{
						left: `${boxX}px`,
						top: `${boxY}px`,
						width: `${boxW}px`,
						height: `${boxH}px`,
						transform: `rotate(${currentRotation}deg)`,
						transformOrigin: "center center",
					}}
				>
					{/* Active Drag Coordinates Tooltip HUD */}
					{isDragging && dragCoordsHud && (
						<div
							className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-black/85 border border-[#6FA8FF]/60 text-[#6FA8FF] font-mono text-[10px] font-semibold whitespace-nowrap shadow-lg pointer-events-none z-30"
						>
							X: {dragCoordsHud.x > 0 ? `+${dragCoordsHud.x}` : dragCoordsHud.x}px  Y: {dragCoordsHud.y > 0 ? `+${dragCoordsHud.y}` : dragCoordsHud.y}px
						</div>
					)}

					{/* Bounding outline with draggable fill */}
					<div
						className="absolute inset-0 border-2 border-[#6FA8FF] rounded-[2px] bg-[#6FA8FF]/10 shadow-[0_2px_12px_rgba(111,168,255,0.35)] cursor-move"
						onPointerDown={startTranslate}
						title="Drag to reposition overlay"
					/>

					{/* Rotation stem & handle */}
					<div
						className="absolute left-1/2 -top-7 -translate-x-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing z-20"
						onPointerDown={startRotate}
						title="Drag to rotate"
					>
						<div className="w-3.5 h-3.5 rounded-full bg-[#6FA8FF] border-2 border-white shadow-md hover:scale-125 transition-transform" />
						<div className="w-0.5 h-3.5 bg-[#6FA8FF]" />
					</div>

					{/* 8 Resize Handles */}
					{(
						[
							{ dir: "nw", style: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize" },
							{ dir: "n",  style: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize" },
							{ dir: "ne", style: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize" },
							{ dir: "e",  style: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
							{ dir: "se", style: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize" },
							{ dir: "s",  style: "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-ns-resize" },
							{ dir: "sw", style: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize" },
							{ dir: "w",  style: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize" },
						] as const
					).map(({ dir, style }) => (
						<div
							key={dir}
							className={`absolute w-2.5 h-2.5 bg-white border border-[#6FA8FF] rounded-sm shadow-sm hover:scale-125 transition-transform z-20 ${style}`}
							onPointerDown={(e) => startResize(e, dir)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
