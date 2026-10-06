import React, { useEffect, useRef, useState, useMemo } from "react";
import type { ClipTransform, TimelineProject } from "@/core/timeline/types";
import {
	type CanvasObjectBounds,
	type ResizeHandleDirection,
	calculateResizeScale,
	calculateRotationAngle,
	getActiveVisualClipsBounds,
	hitTestCanvasPoint,
} from "./canvasGizmoMath";

export interface CanvasTransformGizmoProps {
	project: TimelineProject;
	timeUs: number;
	selectedClipId?: string | null;
	canvasElement: HTMLCanvasElement | null;
	onSelectClip?: (clipId: string) => void;
	onUpdateClipTransform?: (clipId: string, transform: ClipTransform) => void;
	disabled?: boolean;
}

type DragMode = "translate" | "resize" | "rotate" | null;

interface DragState {
	mode: DragMode;
	handle?: ResizeHandleDirection;
	pointerId: number;
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

	// Canvas client rect tracking
	const [canvasRect, setCanvasRect] = useState<DOMRect | null>(null);

	useEffect(() => {
		if (!canvasElement) return;

		const updateRect = () => {
			setCanvasRect(canvasElement.getBoundingClientRect());
		};

		updateRect();
		window.addEventListener("resize", updateRect);
		const observer = new ResizeObserver(updateRect);
		observer.observe(canvasElement);

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

	if (disabled || !canvasElement || !canvasRect) {
		return null;
	}

	const { width: projectWidth, height: projectHeight } = project.canvas;
	const scaleFactorX = canvasRect.width / projectWidth;
	const scaleFactorY = canvasRect.height / projectHeight;

	// Convert canvas coordinates to DOM pixel coordinates inside overlay
	const toOverlayX = (canvasX: number) => canvasX * scaleFactorX;
	const toOverlayY = (canvasY: number) => canvasY * scaleFactorY;

	// Handle background canvas click for hit-testing unselected clips
	const handleOverlayPointerDown = (e: React.PointerEvent) => {
		if (e.target !== overlayRef.current) return;

		const clickScreenX = e.clientX - canvasRect.left;
		const clickScreenY = e.clientY - canvasRect.top;

		const canvasX = clickScreenX / scaleFactorX;
		const canvasY = clickScreenY / scaleFactorY;

		const hit = hitTestCanvasPoint(visibleBounds, canvasX, canvasY);
		if (hit) {
			onSelectClip?.(hit.clipId);
		} else {
			// Clicked empty area
			onSelectClip?.("");
		}
	};

	// Start translation drag
	const startTranslate = (e: React.PointerEvent) => {
		if (!selectedBounds || !activeTransform) return;
		e.stopPropagation();
		e.preventDefault();

		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);

		dragState.current = {
			mode: "translate",
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			initialTransform: structuredClone(activeTransform),
			initialBounds: structuredClone(selectedBounds),
		};
	};

	// Start resize drag
	const startResize = (e: React.PointerEvent, handle: ResizeHandleDirection) => {
		if (!selectedBounds || !activeTransform) return;
		e.stopPropagation();
		e.preventDefault();

		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);

		dragState.current = {
			mode: "resize",
			handle,
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			initialTransform: structuredClone(activeTransform),
			initialBounds: structuredClone(selectedBounds),
		};
	};

	// Start rotation drag
	const startRotate = (e: React.PointerEvent) => {
		if (!selectedBounds || !activeTransform) return;
		e.stopPropagation();
		e.preventDefault();

		const target = e.currentTarget as HTMLElement;
		target.setPointerCapture(e.pointerId);

		dragState.current = {
			mode: "rotate",
			pointerId: e.pointerId,
			startX: e.clientX,
			startY: e.clientY,
			initialTransform: structuredClone(activeTransform),
			initialBounds: structuredClone(selectedBounds),
		};
	};

	// Unified pointer move
	const handlePointerMove = (e: React.PointerEvent) => {
		const drag = dragState.current;
		if (!drag || !selectedBounds) return;

		e.preventDefault();
		const deltaScreenX = e.clientX - drag.startX;
		const deltaScreenY = e.clientY - drag.startY;

		if (drag.mode === "translate") {
			const deltaCanvasX = deltaScreenX / scaleFactorX;
			const deltaCanvasY = deltaScreenY / scaleFactorY;

			const newTransform: ClipTransform = {
				...drag.initialTransform,
				x: Math.round(drag.initialTransform.x + deltaCanvasX),
				y: Math.round(drag.initialTransform.y + deltaCanvasY),
			};
			setActiveTransform(newTransform);
		} else if (drag.mode === "resize" && drag.handle) {
			const deltaCanvasX = deltaScreenX / scaleFactorX;
			const deltaCanvasY = deltaScreenY / scaleFactorY;

			// Rotate delta vector into object's unrotated frame
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
			const centerScreenX = canvasRect.left + drag.initialBounds.centerX * scaleFactorX;
			const centerScreenY = canvasRect.top + drag.initialBounds.centerY * scaleFactorY;

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

	// Unified pointer up (commit to project history)
	const handlePointerUp = (e: React.PointerEvent) => {
		const drag = dragState.current;
		if (!drag || !selectedBounds) return;

		try {
			(e.currentTarget as HTMLElement).releasePointerCapture(drag.pointerId);
		} catch {
			// ignore
		}

		dragState.current = null;

		if (activeTransform && onUpdateClipTransform) {
			onUpdateClipTransform(selectedBounds.clipId, activeTransform);
		}
	};

	// Current display values
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
	const boxX = toOverlayX(currentCenterX) - boxW / 2;
	const boxY = toOverlayY(currentCenterY) - boxH / 2;

	return (
		<div
			ref={overlayRef}
			className="canvas-transform-gizmo-layer absolute inset-0 pointer-events-auto select-none"
			style={{
				width: `${canvasRect.width}px`,
				height: `${canvasRect.height}px`,
				overflow: "hidden",
			}}
			onPointerDown={handleOverlayPointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
		>
			{/* Selected bounding box and handles */}
			{selectedBounds && (
				<div
					className="absolute"
					style={{
						left: `${boxX}px`,
						top: `${boxY}px`,
						width: `${boxW}px`,
						height: `${boxH}px`,
						transform: `rotate(${currentRotation}deg)`,
						transformOrigin: "center center",
					}}
				>
					{/* Bounding outline */}
					<div
						className="absolute inset-0 border-2 border-[#6FA8FF] rounded-[2px] shadow-[0_2px_10px_rgba(0,0,0,0.3)] cursor-move"
						onPointerDown={startTranslate}
					/>

					{/* Rotation stem & handle */}
					<div
						className="absolute left-1/2 -top-7 -translate-x-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing"
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
							className={`absolute w-2.5 h-2.5 bg-white border border-[#6FA8FF] rounded-sm shadow-sm hover:scale-125 transition-transform ${style}`}
							onPointerDown={(e) => startResize(e, dir)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
