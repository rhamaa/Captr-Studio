import type { Span } from "dnd-timeline";
import { useItem } from "dnd-timeline";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { AudioPeaksData, SlideMedia4in1 } from "./core/timelineTypes";
import { toFileUrl } from "../projectPersistence";
import glassStyles from "./ItemGlass.module.css";
import { formatMs, getGlassClass } from "./items/itemUtils";
import { ClipTimelineItem } from "./items/ClipTimelineItem";
import { StandardTimelineItem } from "./items/StandardTimelineItem";

export interface ItemProps {
	id: string;
	span: Span;
	rowId: string;
	disabled?: boolean;
	children: React.ReactNode;
	isSelected?: boolean;
	onSelect?: () => void;
	onSelectId?: (id: string) => void;
	zoomDepth?: number;
	zoomMode?: "auto" | "manual";
	speedValue?: number;
	waveformPeaks?: AudioPeaksData | null;
	waveformSegmentSpan?: Span;
	waveformGain?: number;
	waveformNormalize?: boolean;
	muted?: boolean;
	transitionIn?: import("../types").ClipTransitionType;
	media4in1?: SlideMedia4in1;
	variant?: "zoom" | "trim" | "clip" | "annotation" | "speed" | "audio" | "layout";
	isLoading?: boolean;
	loadingLabel?: string;
}

export default function Item({
	id,
	span,
	rowId,
	disabled = false,
	isSelected = false,
	onSelect,
	onSelectId,
	zoomDepth = 1,
	zoomMode = "auto",
	speedValue,
	waveformPeaks = null,
	waveformSegmentSpan,
	waveformGain = 1,
	waveformNormalize = false,
	muted = false,
	transitionIn,
	media4in1,
	variant = "zoom",
	isLoading = false,
	loadingLabel,
	children,
}: ItemProps) {
	const { setNodeRef, attributes, listeners, itemStyle, itemContentStyle } = useItem({
		id,
		span,
		disabled: disabled || isLoading,
		data: { rowId },
	});

	const timeLabel = useMemo(
		() => `${formatMs(span.start)} – ${formatMs(span.end)}`,
		[span.start, span.end],
	);

	const webcamSrc = useMemo(() => {
		if (!media4in1?.webcamPath || typeof media4in1.webcamPath !== "string") return null;
		if (
			media4in1.webcamPath.startsWith("http://") ||
			media4in1.webcamPath.startsWith("https://") ||
			media4in1.webcamPath.startsWith("file://")
		) {
			return media4in1.webcamPath;
		}
		return toFileUrl(media4in1.webcamPath);
	}, [media4in1?.webcamPath]);

	const videoSrc = useMemo(() => {
		if (!media4in1?.videoPath || typeof media4in1.videoPath !== "string") return null;
		if (
			media4in1.videoPath.startsWith("http://") ||
			media4in1.videoPath.startsWith("https://") ||
			media4in1.videoPath.startsWith("file://")
		) {
			return media4in1.videoPath;
		}
		return toFileUrl(media4in1.videoPath);
	}, [media4in1?.videoPath]);

	if (isLoading) {
		return (
			<div
				ref={setNodeRef}
				style={{
					...itemStyle,
					height: "100%",
					display: "flex",
					alignItems: "center",
				}}
				{...listeners}
				{...attributes}
				data-timeline-item="true"
				onMouseDownCapture={(event) => event.stopPropagation()}
				onClickCapture={(event) => event.stopPropagation()}
			>
				<Skeleton
					variant="clip"
					animation="shimmer-premium"
					label={loadingLabel || "Loading..."}
					className="w-full"
					style={{ height: "85%", minHeight: 22 }}
				/>
			</div>
		);
	}

	const isClip = variant === "clip";
	const glassClass = getGlassClass(variant);

	const MIN_ITEM_PX = 6;
	const handleSelect = () => {
		onSelect?.();
		onSelectId?.(id);
	};
	const safeItemStyle = {
		...itemStyle,
		minWidth: MIN_ITEM_PX,
		height: "100%",
		overflow: "hidden",
	};

	return (
		<div
			ref={setNodeRef}
			style={safeItemStyle}
			{...listeners}
			{...attributes}
			data-timeline-item="true"
			onPointerDownCapture={handleSelect}
			className="group h-full"
		>
			<div
				className="h-full"
				style={{
					...itemContentStyle,
					minWidth: MIN_ITEM_PX,
					height: "100%",
					display: "flex",
					alignItems: "center",
				}}
			>
				<div
					className={cn(
						glassClass,
						"w-full overflow-hidden flex items-center justify-center gap-1.5 cursor-grab active:cursor-grabbing relative rounded-lg",
						isSelected && glassStyles.selected,
						isClip && "h-full min-h-[74px] bg-slate-900/90 border border-blue-500/40 shadow-sm",
					)}
					style={{
						height: isClip ? "100%" : "85%",
						minHeight: isClip ? 74 : 22,
						minWidth: MIN_ITEM_PX,
					}}
					onClick={(event) => {
						event.stopPropagation();
						handleSelect();
					}}
				>
					{isClip ? (
						<ClipTimelineItem
							videoSrc={videoSrc}
							webcamSrc={webcamSrc}
							media4in1={media4in1}
							transitionIn={transitionIn}
							timeLabel={timeLabel}
							span={span}
							waveformSegmentSpan={waveformSegmentSpan}
						>
							{children}
						</ClipTimelineItem>
					) : (
						<StandardTimelineItem
							variant={variant}
							span={span}
							waveformPeaks={waveformPeaks}
							waveformSegmentSpan={waveformSegmentSpan}
							waveformGain={waveformGain}
							waveformNormalize={waveformNormalize}
							muted={muted}
							zoomDepth={zoomDepth}
							zoomMode={zoomMode}
							speedValue={speedValue}
							timeLabel={timeLabel}
							isSelected={isSelected}
						>
							{children}
						</StandardTimelineItem>
					)}
				</div>
			</div>
		</div>
	);
}
