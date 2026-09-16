import React from "react";
import {
	Desktop as DesktopIcon,
	Microphone as MicrophoneIcon,
	MicrophoneSlash as MicrophoneSlashIcon,
	SpeakerHigh as SpeakerHighIcon,
	SpeakerX,
	VideoCamera as VideoCameraIcon,
	VideoCameraSlash as VideoCameraSlashIcon,
} from "@phosphor-icons/react";
import type { Span } from "dnd-timeline";
import { cn } from "@/lib/utils";
import AudioWaveform from "../components/waveform/AudioWaveform";
import type { SlideMedia4in1 } from "../core/timelineTypes";
import type { ClipTransitionType } from "../../types";
import glassStyles from "../ItemGlass.module.css";

export interface ClipTimelineItemProps {
	videoSrc: string | null;
	webcamSrc: string | null;
	media4in1?: SlideMedia4in1;
	transitionIn?: ClipTransitionType;
	children?: React.ReactNode;
	timeLabel: string;
	span: Span;
	waveformSegmentSpan?: Span;
}

export function ClipTimelineItem({
	videoSrc,
	webcamSrc,
	media4in1,
	transitionIn,
	children,
	timeLabel,
	span,
	waveformSegmentSpan,
}: ClipTimelineItemProps) {
	return (
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
									<VideoCameraIcon
										size={11}
										weight="fill"
										className="text-purple-300 shrink-0"
									/>
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
	);
}
