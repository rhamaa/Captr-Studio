import { FilmSlate } from "@phosphor-icons/react";
import React from "react";
import type { CanvasDimensions } from "@/core/slides/types";

function formatTime(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	const tenths = Math.floor((ms % 1000) / 100);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

interface VideoPreviewMonitorProps {
	videoRef: React.RefObject<HTMLVideoElement>;
	previewVideoSrc: string;
	isAudioMuted: boolean;
	isRecording: boolean;
	currentTimeMs: number;
	durationMs: number;
	canvasDimensions: CanvasDimensions;
}

export const VideoPreviewMonitor: React.FC<VideoPreviewMonitorProps> = ({
	videoRef,
	previewVideoSrc,
	isAudioMuted,
	isRecording,
	currentTimeMs,
	durationMs,
	canvasDimensions,
}) => {
	return (
		<div className="flex flex-1 flex-col items-center justify-center p-6 bg-slate-950/60 relative select-none overflow-hidden">
			<div
				className={`relative flex items-center justify-center overflow-hidden rounded-lg bg-black shadow-2xl border transition-colors ${
					isRecording ? "border-rose-500 ring-2 ring-rose-500/40" : "border-slate-800"
				}`}
				style={{
					aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}`,
					maxHeight: "45vh",
					maxWidth: "65vw",
				}}
			>
				{previewVideoSrc ? (
					<video
						ref={videoRef}
						src={previewVideoSrc}
						className="h-full w-full object-contain"
						muted={isAudioMuted}
					/>
				) : (
					<div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
						<FilmSlate size={36} className="text-blue-400 opacity-60" />
						<span className="text-xs text-slate-400">
							Preview Video NLE ({canvasDimensions.width}x{canvasDimensions.height} @{" "}
							{canvasDimensions.fps}fps)
						</span>
					</div>
				)}

				{/* Recording Banner Overlay */}
				{isRecording && (
					<div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-rose-950/90 border border-rose-500/60 px-3 py-1 shadow-lg backdrop-blur">
						<span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
						<span className="text-[11px] font-bold text-rose-300 uppercase tracking-wider">
							Recording Audio · {formatTime(currentTimeMs)}
						</span>
					</div>
				)}

				{/* Current Time Badge */}
				<div className="absolute bottom-3 right-3 rounded bg-slate-950/80 px-2 py-0.5 font-mono text-[11px] text-slate-300 border border-slate-800">
					{formatTime(currentTimeMs)} / {formatTime(durationMs)}
				</div>
			</div>
		</div>
	);
};
