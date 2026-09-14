import { useTimelineContext } from "dnd-timeline";
import React, { useEffect, useState } from "react";

interface Keyframe {
	id: string;
	time: number;
	property?: "position" | "scale" | "rotation" | "opacity";
	easing?: string;
}

interface KeyframeMarkersProps {
	keyframes: Keyframe[];
	selectedKeyframeId: string | null;
	setSelectedKeyframeId: (id: string | null) => void;
	onKeyframeMove: (id: string, newTime: number) => void;
	videoDurationMs: number;
	timelineRef: React.RefObject<HTMLDivElement>;
}

const PROPERTY_COLORS: Record<string, string> = {
	position: "#06b6d4", // Cyan
	scale: "#eab308",    // Yellow
	rotation: "#a855f7", // Purple
	opacity: "#10b981",  // Emerald
};

const KeyframeMarkers: React.FC<KeyframeMarkersProps> = ({
	keyframes,
	selectedKeyframeId,
	setSelectedKeyframeId,
	onKeyframeMove,
	videoDurationMs,
	timelineRef,
}) => {
	const { sidebarWidth, range, valueToPixels, pixelsToValue } = useTimelineContext();
	const [draggingKeyframeId, setDraggingKeyframeId] = useState<string | null>(null);

	useEffect(() => {
		if (!draggingKeyframeId) return;

		const handleMouseMove = (e: MouseEvent) => {
			if (!timelineRef.current) return;

			const rect = timelineRef.current.getBoundingClientRect();
			const clickX = e.clientX - rect.left - sidebarWidth;
			const relativeMs = pixelsToValue(clickX);
			const absoluteMs = Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));

			// Update the keyframe position in real-time
			onKeyframeMove(draggingKeyframeId, absoluteMs);
		};

		const handleMouseUp = () => {
			setDraggingKeyframeId(null);
			document.body.style.cursor = "";
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
		document.body.style.cursor = "ew-resize";

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
			document.body.style.cursor = "";
		};
	}, [
		draggingKeyframeId,
		onKeyframeMove,
		timelineRef,
		sidebarWidth,
		range.start,
		videoDurationMs,
		pixelsToValue,
	]);

	return (
		<>
			{keyframes.map((kf) => {
				const offset = valueToPixels(kf.time - range.start);
				const isSelected = kf.id === selectedKeyframeId;
				const isDragging = kf.id === draggingKeyframeId;
				const diamondColor = kf.property ? (PROPERTY_COLORS[kf.property] || "#ffe100") : "#ffe100";

				return (
					<div
						key={kf.id}
						className={`absolute top-8 cursor-grab active:cursor-grabbing group ${isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-transparent rounded-xs" : ""}`}
						style={{
							left: `${sidebarWidth + offset - 8}px`,
							zIndex: isDragging ? 50 : 40,
							transition: isDragging ? "none" : "left 0.1s ease-out",
						}}
						onMouseDown={(e) => {
							e.stopPropagation();
							setSelectedKeyframeId(kf.id);
							if (e.button !== 0) {
								return;
							}
							setDraggingKeyframeId(kf.id);
						}}
						onContextMenu={(e) => {
							e.preventDefault();
							e.stopPropagation();
							setSelectedKeyframeId(kf.id);
						}}
						title={`Keyframe [${kf.property || "transform"}] @ ${Math.round(kf.time)}ms (drag to move, Delete/Backspace to remove)`}
					>
						<div
							style={{
								width: "11px",
								height: "11px",
								background: diamondColor,
								transform: "rotate(45deg)",
								boxShadow: isSelected
									? `0 0 8px ${diamondColor}`
									: "0 1px 3px rgba(0,0,0,0.4)",
								opacity: isSelected ? 1 : 0.8,
								transition: "all 0.15s ease",
							}}
							className="group-hover:scale-125"
						/>
					</div>
				);
			})}
		</>
	);
};

export default KeyframeMarkers;
