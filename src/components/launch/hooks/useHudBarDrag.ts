import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { mergeHudInteractiveBounds, shouldRestoreHudMousePassthroughAfterDrag } from "../hudMousePassthrough";

const DEFAULT_RECORDING_HUD_OFFSET = { x: 0, y: 0 };

export function useHudBarDrag({
	hudContentRef: _hudContentRef,
	hudBarRef,
	recordingWebcamPreviewContainerRef,
}: {
	hudContentRef: RefObject<HTMLDivElement>;
	hudBarRef: RefObject<HTMLDivElement>;
	recordingWebcamPreviewContainerRef: RefObject<HTMLDivElement>;
}) {
	const [recordingHudOffset, setRecordingHudOffset] = useState(DEFAULT_RECORDING_HUD_OFFSET);
	const [isHudDragging, setIsHudDragging] = useState(false);
	const hudBarTransformRef = useRef<HTMLDivElement | null>(null);
	const recordingHudOffsetRef = useRef(DEFAULT_RECORDING_HUD_OFFSET);
	const hudDragStartRef = useRef<{
		pointerId: number;
		startX: number;
		startY: number;
		originX: number;
		originY: number;
		initialLeft: number;
		initialTop: number;
		hudWidth: number;
		hudHeight: number;
	} | null>(null);
	const isHudDraggingRef = useRef(false);
	const hudDragMoveRafRef = useRef<number | null>(null);
	const hudDragPendingPointerRef = useRef<{ clientX: number; clientY: number } | null>(null);
	const cleanupWindowListenersRef = useRef<(() => void) | null>(null);

	useEffect(() => {
		recordingHudOffsetRef.current = recordingHudOffset;
		if (!isHudDraggingRef.current && hudBarTransformRef.current) {
			hudBarTransformRef.current.style.transform = `translate3d(${recordingHudOffset.x}px, ${recordingHudOffset.y}px, 0)`;
		}
	}, [recordingHudOffset]);

	const updateDragPosition = useCallback((clientX: number, clientY: number) => {
		const latestDragState = hudDragStartRef.current;
		if (!latestDragState) return;

		const deltaX = clientX - latestDragState.startX;
		const deltaY = clientY - latestDragState.startY;
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const EDGE_MARGIN = 0;

		const unclampedLeft = latestDragState.initialLeft + deltaX;
		const unclampedTop = latestDragState.initialTop + deltaY;

		const minLeft = EDGE_MARGIN;
		const maxLeft = Math.max(minLeft, viewportWidth - latestDragState.hudWidth - EDGE_MARGIN);
		const clampedLeft = Math.min(Math.max(minLeft, unclampedLeft), maxLeft);

		const minTop = EDGE_MARGIN;
		const maxTop = Math.max(minTop, viewportHeight - latestDragState.hudHeight - EDGE_MARGIN);
		const clampedTop = Math.min(Math.max(minTop, unclampedTop), maxTop);

		const nextOffset = {
			x: latestDragState.originX + (clampedLeft - latestDragState.initialLeft),
			y: latestDragState.originY + (clampedTop - latestDragState.initialTop),
		};
		recordingHudOffsetRef.current = nextOffset;
		if (hudBarTransformRef.current) {
			hudBarTransformRef.current.style.transform = `translate3d(${nextOffset.x}px, ${nextOffset.y}px, 0)`;
		}
	}, []);

	const handleHudBarPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) {
			return;
		}
		if (!hudBarRef.current) return;

		event.preventDefault();
		event.stopPropagation();
		isHudDraggingRef.current = true;
		setIsHudDragging(true);
		window.electronAPI?.hudOverlaySetIgnoreMouse?.(false);

		// Keep receiving moves when the pointer leaves the small grip or the
		// transparent overlay changes its hit-test region during the gesture.
		const captureTarget = event.currentTarget;
		captureTarget.setPointerCapture(event.pointerId);

		const hudRect = hudBarRef.current.getBoundingClientRect();
		hudDragStartRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			originX: recordingHudOffsetRef.current.x,
			originY: recordingHudOffsetRef.current.y,
			initialLeft: hudRect.left,
			initialTop: hudRect.top,
			hudWidth: hudRect.width,
			hudHeight: hudRect.height,
		};

		// Clean up any stale window listener
		cleanupWindowListenersRef.current?.();

		const onWindowPointerMove = (ev: globalThis.PointerEvent) => {
			if (hudDragStartRef.current?.pointerId !== ev.pointerId) return;
			hudDragPendingPointerRef.current = { clientX: ev.clientX, clientY: ev.clientY };
			if (hudDragMoveRafRef.current !== null) return;

			hudDragMoveRafRef.current = requestAnimationFrame(() => {
				hudDragMoveRafRef.current = null;
				const pointer = hudDragPendingPointerRef.current;
				if (pointer) {
					updateDragPosition(pointer.clientX, pointer.clientY);
				}
			});
		};

		const onWindowPointerUp = (ev: globalThis.PointerEvent) => {
			if (hudDragStartRef.current?.pointerId !== ev.pointerId) return;
			cleanupWindowListenersRef.current?.();
			if (captureTarget.hasPointerCapture(ev.pointerId)) captureTarget.releasePointerCapture(ev.pointerId);

			if (hudDragMoveRafRef.current !== null) {
				cancelAnimationFrame(hudDragMoveRafRef.current);
				hudDragMoveRafRef.current = null;
			}
			hudDragPendingPointerRef.current = null;

			// Perform final position sync
			updateDragPosition(ev.clientX, ev.clientY);

			hudDragStartRef.current = null;
			const wasDragging = isHudDraggingRef.current;
			isHudDraggingRef.current = false;
			const finalOffset = { ...recordingHudOffsetRef.current };
			setRecordingHudOffset(finalOffset);
			setIsHudDragging(false);

			const hudBounds = mergeHudInteractiveBounds(
				[
					hudBarRef.current?.getBoundingClientRect(),
					recordingWebcamPreviewContainerRef.current?.getBoundingClientRect(),
				].map((bounds) =>
					bounds
						? {
								left: bounds.left,
								top: bounds.top,
								right: bounds.right,
								bottom: bounds.bottom,
						  }
						: null,
				),
			);
			if (wasDragging && shouldRestoreHudMousePassthroughAfterDrag(hudBounds, ev.clientX, ev.clientY)) {
				window.electronAPI?.hudOverlaySetIgnoreMouse?.(true);
			}
		};

		window.addEventListener("pointermove", onWindowPointerMove, { passive: false });
		window.addEventListener("pointerup", onWindowPointerUp);
		window.addEventListener("pointercancel", onWindowPointerUp);

		cleanupWindowListenersRef.current = () => {
			window.removeEventListener("pointermove", onWindowPointerMove);
			window.removeEventListener("pointerup", onWindowPointerUp);
			window.removeEventListener("pointercancel", onWindowPointerUp);
			cleanupWindowListenersRef.current = null;
		};
	}, [hudBarRef, recordingWebcamPreviewContainerRef, updateDragPosition]);

	// Backward compatibility fallback handlers for JSX
	const handleHudBarPointerMove = useCallback((_event: PointerEvent<HTMLDivElement>) => {
		// Handled globally via window listener
	}, []);

	const handleHudBarPointerUp = useCallback((_event: PointerEvent<HTMLDivElement>) => {
		// Handled globally via window listener
	}, []);

	useEffect(() => {
		const handleResize = () => {
			if (!hudBarRef.current || isHudDraggingRef.current) return;
			const hudRect = hudBarRef.current.getBoundingClientRect();
			const viewportWidth = window.innerWidth;
			const viewportHeight = window.innerHeight;
			const EDGE_MARGIN = 0;
			const minLeft = EDGE_MARGIN;
			const maxLeft = Math.max(minLeft, viewportWidth - hudRect.width - EDGE_MARGIN);
			const minTop = EDGE_MARGIN;
			const maxTop = Math.max(minTop, viewportHeight - hudRect.height - EDGE_MARGIN);

			if (hudRect.left < minLeft || hudRect.left > maxLeft || hudRect.top < minTop || hudRect.top > maxTop) {
				const clampedLeft = Math.min(Math.max(minLeft, hudRect.left), maxLeft);
				const clampedTop = Math.min(Math.max(minTop, hudRect.top), maxTop);
				setRecordingHudOffset((prev) => ({
					x: prev.x + (clampedLeft - hudRect.left),
					y: prev.y + (clampedTop - hudRect.top),
				}));
			}
		};

		window.addEventListener("resize", handleResize);
		return () => {
			window.removeEventListener("resize", handleResize);
			cleanupWindowListenersRef.current?.();
			if (hudDragMoveRafRef.current !== null) {
				cancelAnimationFrame(hudDragMoveRafRef.current);
			}
			hudDragMoveRafRef.current = null;
			hudDragPendingPointerRef.current = null;
			hudDragStartRef.current = null;
		};
	}, [hudBarRef]);

	return {
		recordingHudOffset,
		isHudDragging,
		hudBarTransformRef,
		isHudDraggingRef,
		handleHudBarPointerDown,
		handleHudBarPointerMove,
		handleHudBarPointerUp,
	};
}
