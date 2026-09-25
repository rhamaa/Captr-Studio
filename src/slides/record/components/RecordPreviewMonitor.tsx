import { ArrowsClockwise, Trash, UploadSimple, VideoCamera } from "@phosphor-icons/react";
import React from "react";
import type {
	CursorTelemetryPoint,
	WebcamOverlaySettings,
	ZoomFocus,
} from "@/components/video-editor/types";
import VideoPlayback, { type VideoPlaybackRef } from "@/components/video-editor/VideoPlayback";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type { RecordSlideMeta } from "../schema";

export interface RecordPreviewMonitorProps {
	videoPath?: string;
	resolvedVideoSrc: string;
	canvasDimensions: { width: number; height: number; fps: number };
	videoPlaybackRef: React.RefObject<VideoPlaybackRef | null>;
	currentTimeMs: number;
	isPlaying: boolean;
	onTimeUpdate: (ms: number) => void;
	onDurationChange: (durMs: number) => void;
	onPlayStateChange: (playing: boolean) => void;
	meta: RecordSlideMeta;
	normalizedTelemetry: CursorTelemetryPoint[];
	effectiveWebcam?: WebcamOverlaySettings;
	currentAspectRatio: AspectRatio;
	selectedZoomId: string | null;
	onSelectZoom: (id: string | null) => void;
	onZoomFocusChange: (id: string, focus: ZoomFocus) => void;
	onImportVideoPicker: () => void;
	onClearVideo: () => void;
	onOpenRecorderHud: () => void;
}

export const RecordPreviewMonitor: React.FC<RecordPreviewMonitorProps> = ({
	videoPath,
	resolvedVideoSrc,
	canvasDimensions,
	videoPlaybackRef,
	currentTimeMs,
	isPlaying,
	onTimeUpdate,
	onDurationChange,
	onPlayStateChange,
	meta,
	normalizedTelemetry,
	effectiveWebcam,
	currentAspectRatio,
	selectedZoomId,
	onSelectZoom,
	onZoomFocusChange,
	onImportVideoPicker,
	onClearVideo,
	onOpenRecorderHud,
}) => {
	return (
		<div className="flex flex-1 flex-col items-center justify-between p-6 relative overflow-hidden w-full">
			{/* Top Canvas Header Bar */}
			<div className="w-full flex items-center justify-between pb-3 px-2">
				<div className="flex items-center gap-2">
					<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
						<VideoCamera size={14} weight="bold" />
						<span>Screen Studio Canvas</span>
					</span>
					{videoPath && (
						<span className="text-xs text-slate-400 font-mono truncate max-w-[280px]">
							{videoPath.split(/[/\\]/).pop()}
						</span>
					)}
				</div>
				{videoPath && (
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={onImportVideoPicker}
							className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
							title="Change Video Source"
						>
							<ArrowsClockwise size={13} />
							<span>Ganti Video</span>
						</button>
						<button
							type="button"
							onClick={onClearVideo}
							className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
							title="Hapus Video"
						>
							<Trash size={13} />
						</button>
					</div>
				)}
			</div>

			{/* Tahap 1: PixiJS WebGL Canvas Compositor via VideoPlayback */}
			<div className="flex flex-1 items-center justify-center w-full min-h-0 relative">
				{videoPath && resolvedVideoSrc ? (
					<div
						className="relative flex items-center justify-center overflow-hidden rounded-2xl shadow-2xl border border-slate-800"
						style={{
							aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}`,
							width: "100%",
							maxWidth: "92vw",
							height: "100%",
							maxHeight: "68vh",
						}}
					>
						<VideoPlayback
							ref={videoPlaybackRef}
							videoPath={resolvedVideoSrc}
							currentTime={currentTimeMs / 1000}
							isPlaying={isPlaying}
							onTimeUpdate={(sec) => onTimeUpdate(Math.round(sec * 1000))}
							onDurationChange={(sec) => onDurationChange(Math.round(sec * 1000))}
							onPlayStateChange={onPlayStateChange}
							onError={(err) =>
								console.warn("[RecordSlide VideoPlayback error]:", err)
							}
							wallpaper={meta.wallpaper}
							zoomRegions={meta.zoomRegions}
							clipRegions={meta.clipRegions ?? []}
							selectedZoomId={selectedZoomId}
							onSelectZoom={onSelectZoom}
							onZoomFocusChange={onZoomFocusChange}
							showShadow={meta.shadowIntensity > 0}
							shadowIntensity={meta.shadowIntensity}
							backgroundBlur={meta.backgroundBlur}
							borderRadius={meta.borderRadius}
							padding={meta.padding}
							frame={meta.frame}
							cursorTelemetry={normalizedTelemetry}
							showCursor={meta.showCursor}
							cursorStyle={meta.cursorStyle ?? "macos"}
							cursorSize={meta.cursorSize ?? 2.5}
							cursorSmoothing={meta.cursorSmoothing ?? 0.67}
							cursorClickBounce={meta.cursorClickBounce ?? 2.5}
							cursorSway={meta.cursorSway ?? 0.4}
							cameraPerspectiveTilt={meta.cameraPerspectiveTilt ?? 0}
							zoomMotionBlur={meta.zoomMotionBlur ?? 0.35}
							connectZooms={meta.connectZooms ?? true}
							zoomInDurationMs={meta.zoomInDurationMs ?? 200}
							zoomOutDurationMs={meta.zoomOutDurationMs ?? 200}
							webcam={effectiveWebcam}
							webcamVideoPath={meta.webcam?.sourcePath ?? meta.webcamPath ?? null}
							aspectRatio={currentAspectRatio}
						/>
					</div>
				) : (
					/* Empty State with Direct Ingest Triggers */
					<div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-slate-700/60 bg-slate-900/60 p-10 text-center backdrop-blur-md max-w-md mx-auto">
						<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
							<VideoCamera size={36} weight="duotone" />
						</div>
						<div>
							<h4 className="text-base font-bold text-white tracking-tight">
								Screen Studio Slide Mode
							</h4>
							<p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
								Rekam layar langsung ke slide ini atau import rekaman untuk
								mengaktifkan PixiJS WebGL canvas, spring camera auto-zoom, dan
								cursor smoothing.
							</p>
						</div>
						<div className="flex flex-col sm:flex-row items-center gap-2.5 w-full justify-center pt-2">
							<button
								type="button"
								onClick={onOpenRecorderHud}
								className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-xs font-semibold shadow-lg shadow-red-600/30 transition-all cursor-pointer"
							>
								<VideoCamera size={16} weight="fill" />
								<span>Rekam Layar (HUD)</span>
							</button>
							<button
								type="button"
								onClick={onImportVideoPicker}
								className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer"
							>
								<UploadSimple size={16} weight="bold" />
								<span>Pilih File Video</span>
							</button>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};
