import { type PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import { sampleAnnotationTransform } from "@/components/video-editor/annotationKeyframes";
import type { AnnotationPosition, AnnotationRegion } from "@/components/video-editor/types";

interface DragState {
	id: string;
	pointerId: number;
	startX: number;
	startY: number;
	origin: AnnotationPosition;
	width: number;
	height: number;
	keyframeId: string;
	moved: boolean;
	position?: AnnotationPosition;
}

interface PreviewPosition {
	id: string;
	position: AnnotationPosition;
	keyframeId: string;
}

interface RecordingOverlayHandlesProps {
	annotations: AnnotationRegion[];
	currentMs: number;
	playing: boolean;
	selectedAnnotationId: string | null;
	onSelect: (id: string) => void;
	onPreviewPosition: (preview: PreviewPosition | null) => void;
	onCommitPosition: (id: string, position: AnnotationPosition, keyframeId: string) => void;
}

export function getDraggedAnnotationPosition(
	origin: AnnotationPosition,
	deltaX: number,
	deltaY: number,
	stageWidth: number,
	stageHeight: number,
	overlayWidth: number,
	overlayHeight: number,
): AnnotationPosition {
	const maxX = Math.max(0, 100 - overlayWidth);
	const maxY = Math.max(0, 100 - overlayHeight);
	return {
		x:
			stageWidth > 0
				? Math.max(0, Math.min(maxX, origin.x + (deltaX / stageWidth) * 100))
				: origin.x,
		y:
			stageHeight > 0
				? Math.max(0, Math.min(maxY, origin.y + (deltaY / stageHeight) * 100))
				: origin.y,
	};
}

export function RecordingOverlayHandles({
	annotations,
	currentMs,
	playing,
	selectedAnnotationId,
	onSelect,
	onPreviewPosition,
	onCommitPosition,
}: RecordingOverlayHandlesProps) {
	const layerRef = useRef<HTMLDivElement>(null);
	const dragRef = useRef<DragState | null>(null);
	const [draggedPosition, setDraggedPosition] = useState<PreviewPosition | null>(null);
	const activeAnnotations = annotations
		.filter(
			(annotation) =>
				annotation.visible !== false &&
				currentMs >= annotation.startMs &&
				currentMs <= annotation.endMs,
		)
		.slice()
		.sort((left, right) => left.zIndex - right.zIndex);

	const handlePointerDown = (
		event: ReactPointerEvent<HTMLButtonElement>,
		annotation: AnnotationRegion,
		origin: AnnotationPosition,
		width: number,
		height: number,
	) => {
		if (playing || annotation.locked || event.button !== 0 || !layerRef.current) return;
		event.preventDefault();
		onSelect(annotation.id);
		dragRef.current = {
			id: annotation.id,
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			origin,
			width,
			height,
			keyframeId: crypto.randomUUID(),
			moved: false,
		};
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const handlePointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
		const drag = dragRef.current;
		const bounds = layerRef.current?.getBoundingClientRect();
		if (!drag || drag.pointerId !== event.pointerId || !bounds) return;
		const deltaX = event.clientX - drag.startX;
		const deltaY = event.clientY - drag.startY;
		if (!drag.moved && Math.hypot(deltaX, deltaY) < 1) return;
		drag.moved = true;
		const preview = {
			id: drag.id,
			position: getDraggedAnnotationPosition(
				drag.origin,
				deltaX,
				deltaY,
				bounds.width,
				bounds.height,
				drag.width,
				drag.height,
			),
			keyframeId: drag.keyframeId,
		};
		drag.position = preview.position;
		setDraggedPosition(preview);
		onPreviewPosition(preview);
	};

	const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>, commit: boolean) => {
		const drag = dragRef.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (commit && drag.moved && drag.position) {
			onCommitPosition(drag.id, drag.position, drag.keyframeId);
		}
		dragRef.current = null;
		setDraggedPosition(null);
		onPreviewPosition(null);
	};

	return (
		<div
			ref={layerRef}
			className="recording-overlay-handles"
			role="group"
			aria-label="Recording overlays in preview"
			style={{
				position: "absolute",
				inset: 0,
				zIndex: 20,
				pointerEvents: "none",
			}}
		>
			{activeAnnotations.map((annotation) => {
				const sampled = sampleAnnotationTransform(annotation, currentMs);
				const isSelected = annotation.id === selectedAnnotationId;
				const position =
					draggedPosition?.id === annotation.id
						? draggedPosition.position
						: sampled.position;
				const width = annotation.size.width * sampled.scale;
				const height = annotation.size.height * sampled.scale;
				return (
					<button
						key={annotation.id}
						type="button"
						aria-label={`Move overlay ${annotation.name || annotation.content || "Overlay"}`}
						title={`Drag to reposition ${annotation.name || annotation.content || "overlay"}`}
						className="recording-overlay-handle"
						disabled={playing || Boolean(annotation.locked)}
						style={{
							position: "absolute",
							left: `${position.x}%`,
							top: `${position.y}%`,
							width: `${width}%`,
							height: `${height}%`,
							zIndex: isSelected ? annotation.zIndex + 1000 : annotation.zIndex,
							padding: 0,
							border: isSelected ? "2px solid #8aaeff" : "1px solid transparent",
							borderRadius: 2,
							background: "transparent",
							cursor: playing || annotation.locked ? "default" : "move",
							pointerEvents: playing || annotation.locked ? "none" : "auto",
							touchAction: "none",
							transform: `rotate(${sampled.rotation}deg)`,
						}}
						onPointerDown={(event) =>
							handlePointerDown(event, annotation, sampled.position, width, height)
						}
						onPointerMove={handlePointerMove}
						onPointerUp={(event) => finishDrag(event, true)}
						onPointerCancel={(event) => finishDrag(event, false)}
						onClick={() => onSelect(annotation.id)}
					/>
				);
			})}
		</div>
	);
}
