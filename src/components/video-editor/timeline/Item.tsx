import {
	Desktop as DesktopIcon,
	Gauge,
	SquaresFour as LayoutIcon,
	ChatCircle as MessageSquare,
	Microphone as MicrophoneIcon,
	MicrophoneSlash as MicrophoneSlashIcon,
	MusicNotes as Music,
	MouseLeftClickIcon as PhMouseLeftClick,
	Scissors,
	SpeakerHigh as SpeakerHighIcon,
	SpeakerX,
	Sparkle,
	VideoCamera as VideoCameraIcon,
	VideoCameraSlash as VideoCameraSlashIcon,
	MagnifyingGlassPlus as ZoomIn,
} from "@phosphor-icons/react";
import type { Span } from "dnd-timeline";
import { useItem } from "dnd-timeline";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import AudioWaveform from "./components/waveform/AudioWaveform";
import type { AudioPeaksData, SlideMedia4in1 } from "./core/timelineTypes";
import { toFileUrl } from "../projectPersistence";
import glassStyles from "./ItemGlass.module.css";

interface ItemProps {
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

// Map zoom depth to multiplier labels
const ZOOM_LABELS: Record<number, string> = {
	1: "1.25×",
	2: "1.5×",
	3: "1.8×",
	4: "2.2×",
	5: "3.5×",
	6: "5×",
};

function formatMs(ms: number): string {
	const totalSeconds = ms / 1000;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	if (minutes > 0) {
		return `${minutes}:${seconds.toFixed(1).padStart(4, "0")}`;
	}
	return `${seconds.toFixed(1)}s`;
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

	const isZoom = variant === "zoom";
	const isTrim = variant === "trim";
	const isClip = variant === "clip";
	const isLayout = variant === "layout";
	const isSpeed = variant === "speed";
	const isAudio = variant === "audio";
	const showAudioWaveform = isAudio && Boolean(waveformPeaks);

	const glassClass = isZoom
		? glassStyles.glassPurple
		: isTrim
			? glassStyles.glassRed
			: isClip
				? glassStyles.glassCyan
				: isLayout
					? glassStyles.glassPurple
				: isSpeed
					? glassStyles.glassAmber
					: isAudio
						? glassStyles.glassDarkGreen
						: glassStyles.glassYellow;

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
						<>
							{/* Trim Resize Handles */}
							<div
								className={cn(glassStyles.zoomEndCap, glassStyles.left)}
								style={{ cursor: "col-resize", pointerEvents: "auto" }}
								title="Trim clip start"
							/>
							<div
								className={cn(glassStyles.zoomEndCap, glassStyles.right)}
								style={{ cursor: "col-resize", pointerEvents: "auto" }}
								title="Trim clip end"
							/>

							{/* Video Frame Thumbnail Background */}
							{videoSrc && (
								<div className="absolute inset-0 pointer-events-none overflow-hidden rounded-md opacity-20">
									<video
										src={videoSrc}
										muted
										playsInline
										preload="metadata"
										className="w-full h-full object-cover filter saturate-150 contrast-125"
									/>
									<div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/75 to-slate-950/90" />
								</div>
							)}

							{/* 4-in-1 Unified Content Container */}
							<div className="w-full h-full flex flex-col justify-between p-1.5 px-3 overflow-hidden relative z-10 select-none pointer-events-none">
								{/* Top Row: Slide Identity + Visual Previews (Screen & Webcam) + Duration */}
								<div className="flex items-center justify-between gap-1 w-full min-h-[20px]">
									{/* Left: Badges */}
									<div className="flex items-center gap-1.5 overflow-hidden">
										<span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-tight bg-blue-600/40 border border-blue-400/40 text-blue-200 shrink-0">
											{children || "Slide"}
										</span>

										{/* 1. Screen Record Preview Badge */}
										{media4in1?.videoPath ? (
											<div
												className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-950/70 border border-sky-400/30 text-sky-300 text-[9px] font-medium shrink-0"
												title="Screen Recording Video Track"
											>
												<DesktopIcon size={11} weight="fill" className="text-sky-400 shrink-0" />
												<span className="truncate max-w-[70px]">Screen</span>
											</div>
										) : (
											<div
												className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-foreground/5 border border-foreground/10 text-muted-foreground/50 text-[9px] shrink-0"
												title="No Screen Recording Video Track"
											>
												<DesktopIcon size={11} className="shrink-0" />
												<span className="truncate max-w-[70px]">No Screen</span>
											</div>
										)}

										{/* 2. Webcam Video Preview Badge */}
										{media4in1?.webcamPath ? (
											media4in1.webcamEnabled !== false ? (
												<div
													className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-950/70 border border-purple-400/40 text-purple-200 text-[9px] font-medium shrink-0"
													title="Webcam Video Preview (Active)"
												>
													<div className="relative w-4 h-3 rounded overflow-hidden bg-black/60 border border-purple-400/40 shrink-0">
														{webcamSrc && (
															<video
																src={webcamSrc}
																muted
																playsInline
																preload="metadata"
																className="w-full h-full object-cover"
															/>
														)}
													</div>
													<VideoCameraIcon size={11} weight="fill" className="text-purple-300 shrink-0" />
													<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
													<span className="hidden sm:inline">Cam</span>
												</div>
											) : (
												<div
													className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[9px] font-medium shrink-0"
													title="Webcam Video Present (Overlay Muted/Disabled in Settings)"
												>
													<VideoCameraSlashIcon size={11} className="text-amber-400 shrink-0" />
													<span className="hidden sm:inline">Cam Off</span>
												</div>
											)
										) : (
											<div
												className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-foreground/5 border border-foreground/10 text-muted-foreground/50 text-[9px] shrink-0"
												title="No Companion Webcam Video"
											>
												<VideoCameraSlashIcon size={11} className="shrink-0" />
												<span className="hidden sm:inline">No Cam</span>
											</div>
										)}

										{/* Transition In Badge if set */}
										{transitionIn && transitionIn !== "none" && (
											<div
												className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-400/30 text-[8.5px] font-semibold text-cyan-300 shrink-0"
												title={`Transition In: ${transitionIn}`}
											>
												<span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
												<span className="capitalize">{transitionIn.replace("-", " ")}</span>
											</div>
										)}
									</div>

									{/* Right: Duration */}
									<div className="flex items-center shrink-0 ml-auto pl-2 text-white/70 text-[9.5px] font-mono tabular-nums">
										{timeLabel}
									</div>
								</div>

								{/* Bottom Row: Dual Audio Previews (3. System Audio + 4. Mic Audio) */}
								<div className="flex flex-col gap-1.5 w-full pt-1.5">
									{/* 3. System Audio Track Lane */}
									<div className="relative w-full h-[20px] rounded-md bg-sky-950/60 border border-sky-400/30 overflow-hidden flex items-center px-1.5">
										<div className="flex items-center gap-1 text-sky-300 z-10 shrink-0 mr-1.5 pointer-events-none select-none">
											<SpeakerHighIcon size={11} weight="fill" />
											<span className="text-[8px] font-bold font-mono tracking-wider">SYS</span>
										</div>
										{media4in1?.systemPeaks ? (
											<AudioWaveform
												peaks={media4in1.systemPeaks}
												segmentStartMs={waveformSegmentSpan?.start ?? span.start}
												segmentEndMs={waveformSegmentSpan?.end ?? span.end}
												waveColor="rgba(56, 189, 248, 0.85)"
												className="absolute inset-0 w-full h-full pointer-events-none"
											/>
										) : (
											<div className="flex-1 h-[1px] bg-sky-400/20" />
										)}
										{media4in1?.systemMuted && (
											<SpeakerX className="w-3 h-3 text-red-400 ml-auto z-10 shrink-0" />
										)}
									</div>

									{/* 4. Mic Audio Track Lane */}
									<div className="relative w-full h-[20px] rounded-md bg-emerald-950/60 border border-emerald-400/30 overflow-hidden flex items-center px-1.5">
										<div className="flex items-center gap-1 text-emerald-300 z-10 shrink-0 mr-1.5 pointer-events-none select-none">
											<MicrophoneIcon size={11} weight="fill" />
											<span className="text-[8px] font-bold font-mono tracking-wider">MIC</span>
										</div>
										{media4in1?.micPeaks ? (
											<AudioWaveform
												peaks={media4in1.micPeaks}
												segmentStartMs={waveformSegmentSpan?.start ?? span.start}
												segmentEndMs={waveformSegmentSpan?.end ?? span.end}
												waveColor="rgba(52, 211, 153, 0.85)"
												className="absolute inset-0 w-full h-full pointer-events-none"
											/>
										) : waveformPeaks ? (
											<AudioWaveform
												peaks={waveformPeaks}
												segmentStartMs={waveformSegmentSpan?.start ?? span.start}
												segmentEndMs={waveformSegmentSpan?.end ?? span.end}
												waveColor="rgba(52, 211, 153, 0.85)"
												className="absolute inset-0 w-full h-full pointer-events-none"
											/>
										) : (
											<div className="flex-1 h-[1px] bg-emerald-400/20" />
										)}
										{media4in1?.micMuted && (
											<MicrophoneSlashIcon className="w-3 h-3 text-red-400 ml-auto z-10 shrink-0" />
										)}
									</div>
								</div>
							</div>
						</>
					) : (
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
												Trim
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
												<VideoCameraIcon className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
											) : typeof children === "string" && children.includes("GIF") ? (
												<Sparkle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
											) : (
												<MessageSquare className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
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
											isSelected ? "opacity-60" : "opacity-0 group-hover:opacity-40"
										}`}
									>
										{timeLabel}
									</span>
								)}
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
}
