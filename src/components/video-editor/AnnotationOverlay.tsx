import { useRef, useState } from "react";
import { Rnd } from "react-rnd";
import { cn } from "@/lib/utils";
import { getArrowComponent } from "./ArrowSvgs";
import { type AnnotationRegion, BASE_PREVIEW_WIDTH, BLUR_ANNOTATION_STRENGTH } from "./types";
import {
	interpolateNumericKeyframe,
	interpolatePositionKeyframe,
} from "./keyframeInterpolation";

interface AnnotationOverlayProps {
	annotation: AnnotationRegion;
	isSelected: boolean;
	containerWidth: number;
	containerHeight: number;
	onPositionChange: (id: string, position: { x: number; y: number }) => void;
	onSizeChange: (id: string, size: { width: number; height: number }) => void;
	onClick: (id: string) => void;
	zIndex: number;
	isSelectedBoost: boolean; // Boost z-index when selected for easy editing
	currentTimeMs?: number;
}

export function AnnotationOverlay({
	annotation,
	isSelected,
	containerWidth,
	containerHeight,
	onPositionChange,
	onSizeChange,
	onClick,
	zIndex,
	isSelectedBoost,
	currentTimeMs,
}: AnnotationOverlayProps) {
	const isDraggingRef = useRef(false);
	const [snapGuides, setSnapGuides] = useState<{
		isCenterH?: boolean;
		isCenterV?: boolean;
	}>({});

	// If explicitly set to not visible, don't render
	if (annotation.visible === false && !isSelected) {
		return null;
	}

	// Keyframe-interpolated position, scale, opacity, and rotation
	const hasKeyframes = Array.isArray(annotation.keyframes) && annotation.keyframes.length > 0;
	const activeTime = currentTimeMs ?? annotation.startMs;

	const interpolatedPos = hasKeyframes
		? interpolatePositionKeyframe(annotation.keyframes!, activeTime, annotation.position)
		: annotation.position;

	const interpolatedScale = hasKeyframes
		? interpolateNumericKeyframe(annotation.keyframes!, "scale", activeTime, 1)
		: 1;

	const interpolatedOpacity = hasKeyframes
		? interpolateNumericKeyframe(annotation.keyframes!, "opacity", activeTime, annotation.style.opacity ?? 1)
		: (annotation.style.opacity ?? 1);

	const interpolatedRotation = hasKeyframes
		? interpolateNumericKeyframe(annotation.keyframes!, "rotation", activeTime, annotation.rotationDeg ?? 0)
		: (annotation.rotationDeg ?? 0);

	const x = (interpolatedPos.x / 100) * containerWidth;
	const y = (interpolatedPos.y / 100) * containerHeight;
	const width = (annotation.size.width / 100) * containerWidth * interpolatedScale;
	const height = (annotation.size.height / 100) * containerHeight * interpolatedScale;

	const animDuration = annotation.animationDurationMs ?? 500;
	let animOpacity = interpolatedOpacity;
	let animTranslateY = 0;

	if (currentTimeMs !== undefined && animDuration > 0) {
		const elapsed = currentTimeMs - annotation.startMs;
		const remaining = annotation.endMs - currentTimeMs;

		if (annotation.animationIn === "fade") {
			const progress = Math.min(1, Math.max(0, elapsed / animDuration));
			animOpacity *= progress;
		} else if (annotation.animationIn === "slide-up") {
			const progress = Math.min(1, Math.max(0, elapsed / animDuration));
			animOpacity *= progress;
			animTranslateY = (1 - progress) * 20;
		}

		if (annotation.animationOut === "fade") {
			const progress = Math.min(1, Math.max(0, remaining / animDuration));
			animOpacity *= progress;
		}
	}

	const renderArrow = () => {
		const direction = annotation.figureData?.arrowDirection || "right";
		const color = annotation.figureData?.color || "#2563EB";
		const strokeWidth = annotation.figureData?.strokeWidth || 4;

		const ArrowComponent = getArrowComponent(direction);
		return <ArrowComponent color={color} strokeWidth={strokeWidth} />;
	};

	const renderContent = () => {
		switch (annotation.type) {
			case "text":
				return (
					<div
						className="w-full h-full flex items-center p-2 overflow-hidden"
						style={{
							justifyContent:
								annotation.style.textAlign === "left"
									? "flex-start"
									: annotation.style.textAlign === "right"
										? "flex-end"
										: "center",
							alignItems: "center",
						}}
					>
						<span
							style={{
								color: annotation.style.color,
								backgroundColor: annotation.style.backgroundColor,
								fontSize: `${annotation.style.fontSize}px`,
								fontFamily: annotation.style.fontFamily,
								fontWeight: annotation.style.fontWeight,
								fontStyle: annotation.style.fontStyle,
								textDecoration: annotation.style.textDecoration,
								textAlign: annotation.style.textAlign,
								wordBreak: "break-word",
								whiteSpace: "pre-wrap",
								boxDecorationBreak: "clone",
								WebkitBoxDecorationBreak: "clone",
								padding: "0.1em 0.2em",
								borderRadius: "4px",
								lineHeight: "1.4",
								textShadow: annotation.style.dropShadow
									? `${annotation.style.dropShadowOffsetX ?? 0}px ${annotation.style.dropShadowOffsetY ?? 4}px ${annotation.style.dropShadowBlur ?? 8}px ${annotation.style.dropShadowColor || "rgba(0,0,0,0.5)"}`
									: undefined,
							}}
						>
							{annotation.content}
						</span>
					</div>
				);

			case "image":
				if (annotation.imageContent || annotation.content) {
					const src = annotation.imageContent || annotation.content;
					if (src && src.startsWith("data:image")) {
						const style: React.CSSProperties = {
							opacity: annotation.style?.opacity ?? 1,
						};
						if (annotation.style?.dropShadow) {
							const blur = annotation.style.dropShadowBlur ?? 8;
							const offsetX = annotation.style.dropShadowOffsetX ?? 0;
							const offsetY = annotation.style.dropShadowOffsetY ?? 4;
							const color = annotation.style.dropShadowColor || "rgba(0,0,0,0.5)";
							style.filter = `drop-shadow(${offsetX}px ${offsetY}px ${blur}px ${color})`;
						}
						return (
							<img
								src={src}
								alt="Sticker"
								className="w-full h-full object-contain"
								draggable={false}
								style={style}
							/>
						);
					}
				}
				return (
					<div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
						No image
					</div>
				);

			case "figure":
				if (!annotation.figureData) {
					return (
						<div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
							No arrow data
						</div>
					);
				}

				return (
					<div className="w-full h-full flex items-center justify-center p-2">
						{renderArrow()}
					</div>
				);

			case "blur": {
				const previewScaleFactor = containerWidth / BASE_PREVIEW_WIDTH;
				const currentBlurStrength = annotation.blurIntensity ?? BLUR_ANNOTATION_STRENGTH;
				const blurPx = currentBlurStrength * previewScaleFactor;
				const blurStyle = `blur(${blurPx}px)`;

				return (
					<div
						className="h-full w-full bg-slate-400/10"
						style={{
							backdropFilter: blurStyle,
							WebkitBackdropFilter: blurStyle,
							backgroundColor: annotation.blurColor || "transparent",
							borderRadius: `${(annotation.style.borderRadius ?? 0) * previewScaleFactor}px`,
						}}
					/>
				);
			}

			case "gif":
				if (annotation.gifDataUrl || annotation.gifPath) {
					const style: React.CSSProperties = {
						opacity: annotation.style?.opacity ?? 1,
						imageRendering: 'auto'
					};
					if (annotation.style?.dropShadow) {
						const blur = annotation.style.dropShadowBlur ?? 8;
						const offsetX = annotation.style.dropShadowOffsetX ?? 0;
						const offsetY = annotation.style.dropShadowOffsetY ?? 4;
						const color = annotation.style.dropShadowColor || "rgba(0,0,0,0.5)";
						style.filter = `drop-shadow(${offsetX}px ${offsetY}px ${blur}px ${color})`;
					}
					return (
						<img
							src={annotation.gifDataUrl || ''}
							alt="GIF overlay"
							className="w-full h-full object-contain"
							draggable={false}
							style={style}
						/>
					);
				}
				return (
					<div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
						No GIF loaded
					</div>
				);

			default:
				if (annotation.videoFilePath) {
					const videoSrc = annotation.videoFilePath.startsWith("http") || annotation.videoFilePath.startsWith("file:")
						? annotation.videoFilePath
						: `file://${annotation.videoFilePath.replace(/\\/g, "/")}`;
					return (
						<video
							src={videoSrc}
							className="w-full h-full object-contain pointer-events-none rounded-md"
							autoPlay
							loop
							muted={annotation.muted ?? true}
							playsInline
						/>
					);
				}
				return null;
		}
	};

	return (
		<Rnd
			position={{ x, y }}
			size={{ width, height }}
			onDragStart={() => {
				isDraggingRef.current = true;
				setSnapGuides({});
			}}
			onDrag={(_e, d) => {
				const currentCenterX = d.x + width / 2;
				const currentCenterY = d.y + height / 2;
				const canvasCenterX = containerWidth / 2;
				const canvasCenterY = containerHeight / 2;
				const SNAP_THRESHOLD = 8;

				const isNearCenterH = Math.abs(currentCenterX - canvasCenterX) <= SNAP_THRESHOLD;
				const isNearCenterV = Math.abs(currentCenterY - canvasCenterY) <= SNAP_THRESHOLD;

				setSnapGuides((prev) => {
					if (prev.isCenterH !== isNearCenterH || prev.isCenterV !== isNearCenterV) {
						return { isCenterH: isNearCenterH, isCenterV: isNearCenterV };
					}
					return prev;
				});
			}}
			onDragStop={(_e, d) => {
				const canvasCenterX = containerWidth / 2;
				const canvasCenterY = containerHeight / 2;
				let finalX = d.x;
				let finalY = d.y;

				if (snapGuides.isCenterH) {
					finalX = canvasCenterX - width / 2;
				}
				if (snapGuides.isCenterV) {
					finalY = canvasCenterY - height / 2;
				}

				const xPercent = (finalX / containerWidth) * 100;
				const yPercent = (finalY / containerHeight) * 100;
				onPositionChange(annotation.id, { x: xPercent, y: yPercent });
				setSnapGuides({});

				// Reset dragging flag after a short delay to prevent click event
				setTimeout(() => {
					isDraggingRef.current = false;
				}, 100);
			}}
			onResizeStop={(_e, _direction, ref, _delta, position) => {
				const xPercent = (position.x / containerWidth) * 100;
				const yPercent = (position.y / containerHeight) * 100;
				const widthPercent = (ref.offsetWidth / containerWidth) * 100;
				const heightPercent = (ref.offsetHeight / containerHeight) * 100;
				onPositionChange(annotation.id, { x: xPercent, y: yPercent });
				onSizeChange(annotation.id, { width: widthPercent, height: heightPercent });
			}}
			onClick={() => {
				if (isDraggingRef.current) return;
				onClick(annotation.id);
			}}
			bounds="parent"
			className={cn(
				"cursor-move transition-all",
				isSelected && "ring-2 ring-[#2563EB] ring-offset-2 ring-offset-transparent",
			)}
			style={{
				zIndex: isSelectedBoost ? zIndex + 1000 : zIndex, // Boost selected annotation to ensure it's on top
				pointerEvents: "auto",
				border: isSelected ? "2px solid rgba(37, 99, 235, 0.8)" : "none",
				backgroundColor: isSelected ? "rgba(37, 99, 235, 0.1)" : "transparent",
				boxShadow: isSelected ? "0 0 0 1px rgba(37, 99, 235, 0.35)" : "none",
			}}
			enableResizing={isSelected && !annotation.locked}
			disableDragging={!isSelected || Boolean(annotation.locked)}
			resizeHandleStyles={{
				topLeft: {
					width: "12px",
					height: "12px",
					backgroundColor: isSelected ? "white" : "transparent",
					border: isSelected ? "2px solid #2563EB" : "none",
					borderRadius: "50%",
					left: "-6px",
					top: "-6px",
					cursor: "nwse-resize",
				},
				topRight: {
					width: "12px",
					height: "12px",
					backgroundColor: isSelected ? "white" : "transparent",
					border: isSelected ? "2px solid #2563EB" : "none",
					borderRadius: "50%",
					right: "-6px",
					top: "-6px",
					cursor: "nesw-resize",
				},
				bottomLeft: {
					width: "12px",
					height: "12px",
					backgroundColor: isSelected ? "white" : "transparent",
					border: isSelected ? "2px solid #2563EB" : "none",
					borderRadius: "50%",
					left: "-6px",
					bottom: "-6px",
					cursor: "nesw-resize",
				},
				bottomRight: {
					width: "12px",
					height: "12px",
					backgroundColor: isSelected ? "white" : "transparent",
					border: isSelected ? "2px solid #2563EB" : "none",
					borderRadius: "50%",
					right: "-6px",
					bottom: "-6px",
					cursor: "nwse-resize",
				},
			}}
		>
			<div
				className={cn(
					"w-full h-full rounded-lg",
					annotation.type === "text" && "bg-transparent",
					annotation.type === "image" && "bg-transparent",
					annotation.type === "figure" && "bg-transparent",
					isSelected && "shadow-lg",
				)}
				style={{
					opacity: animOpacity,
					mixBlendMode: annotation.blendMode ?? "normal",
					transform: [
						animTranslateY !== 0 ? `translateY(${animTranslateY}px)` : "",
						interpolatedRotation !== 0 ? `rotate(${interpolatedRotation}deg)` : "",
					]
						.filter(Boolean)
						.join(" ") || undefined,
				}}
			>
				{renderContent()}
			</div>

			{/* Sub-Phase 7.1: Snapping Visual Guides */}
			{isSelected && snapGuides.isCenterH && (
				<div
					className="pointer-events-none fixed z-[9999] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
					style={{
						position: "absolute",
						left: `${containerWidth / 2 - (interpolatedPos.x / 100) * containerWidth}px`,
						top: `-${(interpolatedPos.y / 100) * containerHeight}px`,
						width: "1.5px",
						height: `${containerHeight}px`,
					}}
				>
					<span className="absolute top-2 -left-6 bg-cyan-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
						CENTER
					</span>
				</div>
			)}
			{isSelected && snapGuides.isCenterV && (
				<div
					className="pointer-events-none fixed z-[9999] bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]"
					style={{
						position: "absolute",
						top: `${containerHeight / 2 - (interpolatedPos.y / 100) * containerHeight}px`,
						left: `-${(interpolatedPos.x / 100) * containerWidth}px`,
						height: "1.5px",
						width: `${containerWidth}px`,
					}}
				>
					<span className="absolute left-2 -top-5 bg-cyan-500 text-black text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
						CENTER
					</span>
				</div>
			)}
		</Rnd>
	);
}
