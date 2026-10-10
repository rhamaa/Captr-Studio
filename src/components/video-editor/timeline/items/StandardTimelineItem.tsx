import {
	Gauge,
	SquaresFour as LayoutIcon,
	ChatCircle as MessageSquare,
	MusicNotes as Music,
	MouseLeftClickIcon as PhMouseLeftClick,
	Scissors,
	Sparkle,
	SpeakerX,
	Trash,
	VideoCamera as VideoCameraIcon,
	MagnifyingGlassPlus as ZoomIn,
} from "@phosphor-icons/react";
import type { Span } from "dnd-timeline";
import React from "react";
import { cn } from "@/lib/utils";
import AudioWaveform from "../components/waveform/AudioWaveform";
import type { AudioPeaksData } from "../core/timelineTypes";
import glassStyles from "../ItemGlass.module.css";
import { ZOOM_LABELS } from "./itemUtils";

export interface StandardTimelineItemProps {
	variant?: "zoom" | "trim" | "clip" | "annotation" | "speed" | "audio" | "layout";
	span: Span;
	waveformPeaks?: AudioPeaksData | null;
	waveformSegmentSpan?: Span;
	waveformGain?: number;
	waveformNormalize?: boolean;
	muted?: boolean;
	zoomDepth?: number;
	zoomMode?: "auto" | "manual";
	speedValue?: number;
	timeLabel: string;
	isSelected?: boolean;
	keyframes?: import("../../types").PropertyKeyframe[];
	locked?: boolean;
	onDelete?: () => void;
	children?: React.ReactNode;
}

const KEYFRAME_COLORS: Record<string, string> = {
	position: "#6FA8FF", // Captr Blue
	scale: "#F6C768", // Captr Yellow
	rotation: "#A879F5", // Captr Purple
	opacity: "#8DDB9B", // Captr Green
};

export function StandardTimelineItem({
	variant = "zoom",
	span,
	waveformPeaks = null,
	waveformSegmentSpan,
	waveformGain = 1,
	waveformNormalize = false,
	muted = false,
	zoomDepth = 1,
	zoomMode = "auto",
	speedValue,
	timeLabel,
	isSelected = false,
	keyframes = [],
	locked: _locked = false,
	onDelete,
	children,
}: StandardTimelineItemProps) {
	const isZoom = variant === "zoom";
	const isTrim = variant === "trim";
	const isLayout = variant === "layout";
	const isSpeed = variant === "speed";
	const isAudio = variant === "audio";
	const isAnnotation = variant === "annotation";
	const showAudioWaveform = isAudio && Boolean(waveformPeaks);

	return (
		<>
			<div
				className={cn(glassStyles.zoomEndCap, glassStyles.left)}
				style={{ cursor: "col-resize", pointerEvents: "auto" }}
				title="Resize left"
			/>
			<div
				className={cn(glassStyles.zoomEndCap, glassStyles.right)}
				style={{ cursor: "col-resize", pointerEvents: "auto" }}
				title="Resize right"
			/>

			{showAudioWaveform && waveformPeaks && (
				<AudioWaveform
					peaks={waveformPeaks}
					segmentStartMs={waveformSegmentSpan?.start ?? span.start}
					segmentEndMs={waveformSegmentSpan?.end ?? span.end}
					gain={waveformGain}
					normalize={waveformNormalize}
					className="absolute inset-0 w-full h-full pointer-events-none opacity-45"
				/>
			)}
			{/* Muted overlay for source audio track items */}
			{isAudio && muted && (
				<div className="absolute inset-0 z-20 flex items-center justify-center gap-1 bg-red-900/40 pointer-events-none">
					<SpeakerX className="w-3 h-3 text-red-300/90 shrink-0" />
				</div>
			)}
			{/* Content */}
			<div className="relative z-10 flex flex-col items-center justify-center text-black/70 dark:text-white/90 opacity-80 group-hover:opacity-100 transition-opacity select-none overflow-hidden">
				<div className="flex items-center gap-1.5">
					{isZoom ? (
						<>
							<ZoomIn className="w-3.5 h-3.5 shrink-0" />
							<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
								{ZOOM_LABELS[zoomDepth] || `${zoomDepth}×`}
							</span>
						</>
					) : isTrim ? (
						<>
							<Scissors className="w-3.5 h-3.5 shrink-0" />
							<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
								Cut
							</span>
						</>
					) : isLayout ? (
						<>
							<LayoutIcon className="w-3.5 h-3.5 shrink-0" />
							<span className="text-[11px] font-semibold tracking-tight truncate max-w-full">
								{children}
							</span>
						</>
					) : isSpeed ? (
						<>
							<Gauge className="w-3.5 h-3.5 shrink-0" />
							<span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
								{speedValue !== undefined ? `${speedValue}×` : "Speed"}
							</span>
						</>
					) : isAudio ? (
						<>
							<Music className="w-3.5 h-3.5 shrink-0" />
							<span className="text-[11px] font-semibold tracking-tight truncate max-w-full">
								{children}
							</span>
						</>
					) : (
						<>
							{typeof children === "string" && children.startsWith("Video:") ? (
								<VideoCameraIcon className="w-3.5 h-3.5 shrink-0 text-[#6FA8FF]" />
							) : typeof children === "string" && children.includes("GIF") ? (
								<Sparkle className="w-3.5 h-3.5 shrink-0 text-[#F6C768]" />
							) : (
								<MessageSquare className="w-3.5 h-3.5 shrink-0 text-[#A879F5]" />
							)}
							<span className="text-[11px] font-semibold tracking-tight truncate max-w-[140px]">
								{children}
							</span>
						</>
					)}
				</div>
				{isZoom ? (
					<div
						className={`flex items-center gap-0.5 transition-opacity ${isSelected ? "opacity-70" : "opacity-0 group-hover:opacity-50"}`}
					>
						<PhMouseLeftClick
							className="w-2.5 h-2.5 shrink-0"
							weight={zoomMode === "manual" ? "regular" : "fill"}
						/>
						<span className="text-[9px] font-medium tracking-tight whitespace-nowrap">
							{zoomMode === "manual" ? "Manual" : "Auto"}
						</span>
					</div>
				) : (
					<span
						className={`text-[9px] tabular-nums tracking-tight whitespace-nowrap transition-opacity ${
							isTrim
								? "opacity-75"
								: isSelected
									? "opacity-60"
									: "opacity-0 group-hover:opacity-40"
						}`}
					>
						{timeLabel}
					</span>
				)}
			</div>
			{isTrim && onDelete && (
				<button
					type="button"
					aria-label={`Remove cut ${timeLabel}`}
					title={`Remove cut ${timeLabel}`}
					className="absolute right-1 top-1/2 z-30 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded bg-red-950/70 text-red-100 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-red-700"
					onPointerDown={(event) => event.stopPropagation()}
					onMouseDown={(event) => event.stopPropagation()}
					onClick={(event) => {
						event.stopPropagation();
						onDelete();
					}}
				>
					<Trash className="h-2.5 w-2.5" />
				</button>
			)}

			{/* In-block Keyframe Dots for Annotations */}
			{isAnnotation && keyframes.length > 0 && (
				<div className="absolute bottom-1 left-0 right-0 h-1.5 pointer-events-none z-20">
					{keyframes.map((kf) => {
						const spanDuration = Math.max(1, span.end - span.start);
						const percent = Math.max(
							0,
							Math.min(100, (kf.timeMs / spanDuration) * 100),
						);
						const dotColor = KEYFRAME_COLORS[kf.property] || "#6FA8FF";
						return (
							<div
								key={kf.id}
								className="absolute -translate-x-1/2 rounded-[1px] shadow-xs"
								style={{
									left: `${percent}%`,
									width: "5px",
									height: "5px",
									backgroundColor: dotColor,
									transform: "translateX(-50%) rotate(45deg)",
								}}
								title={`Keyframe: ${kf.property} @ ${(kf.timeMs / 1000).toFixed(2)}s`}
							/>
						);
					})}
				</div>
			)}
		</>
	);
}
