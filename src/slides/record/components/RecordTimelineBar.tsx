import {
	ArrowsClockwise,
	Check,
	Pause,
	Play,
	Plus,
	Rewind,
	Scissors,
	Spinner,
	MagicWand as WandSparkles,
} from "@phosphor-icons/react";
import React, { useRef } from "react";
import type { RecordSlideMeta } from "../schema";
import { formatTime } from "./recordConstants";

export interface RecordTimelineBarProps {
	meta: RecordSlideMeta;
	durationMs: number;
	currentTimeMs: number;
	isPlaying: boolean;
	selectedZoomId: string | null;
	isAnalyzingSilence: boolean;
	silenceSuccessMessage: string | null;
	onSeek: (ms: number) => void;
	onTogglePlayPause: () => void;
	onRewind: () => void;
	onAnalyzeSilence: () => void;
	onResetSilenceCuts: () => void;
	onAutoSuggestZooms: () => void;
	onAddZoomAtPlayhead: () => void;
}

export const RecordTimelineBar: React.FC<RecordTimelineBarProps> = ({
	meta,
	durationMs,
	currentTimeMs,
	isPlaying,
	selectedZoomId,
	isAnalyzingSilence,
	silenceSuccessMessage,
	onSeek,
	onTogglePlayPause,
	onRewind,
	onAnalyzeSilence,
	onResetSilenceCuts,
	onAutoSuggestZooms,
	onAddZoomAtPlayhead,
}) => {
	const timelineScrubRef = useRef<HTMLDivElement | null>(null);

	const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!timelineScrubRef.current || durationMs <= 0) return;
		const rect = timelineScrubRef.current.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const ratio = Math.max(0, Math.min(1, clickX / rect.width));
		onSeek(ratio * durationMs);
	};

	return (
		<div className="w-full max-w-3xl flex flex-col gap-2 pt-4">
			{/* Scrubber Bar with Visual Zoom Span Highlights */}
			<div
				ref={timelineScrubRef}
				onClick={handleTimelineClick}
				className="relative h-6 w-full rounded-lg bg-slate-900 border border-slate-800 cursor-pointer overflow-hidden group flex items-center"
			>
				{/* Dead-Air Cut Highlights */}
				{meta.trimRegions?.map((trim) => {
					const startPct = durationMs > 0 ? (trim.startMs / durationMs) * 100 : 0;
					const widthPct =
						durationMs > 0 ? ((trim.endMs - trim.startMs) / durationMs) * 100 : 0;
					return (
						<div
							key={trim.id}
							style={{ left: `${startPct}%`, width: `${widthPct}%` }}
							className="absolute top-0 bottom-0 bg-red-500/30 border-x border-red-500/60 z-5 pointer-events-none"
							title={`Dead-air cut: ${((trim.endMs - trim.startMs) / 1000).toFixed(1)}s`}
						/>
					);
				})}

				{/* Zoom Span Highlights */}
				{meta.zoomRegions.map((zoom) => {
					const startPct = durationMs > 0 ? (zoom.startMs / durationMs) * 100 : 0;
					const widthPct =
						durationMs > 0 ? ((zoom.endMs - zoom.startMs) / durationMs) * 100 : 0;
					const isSelected = selectedZoomId === zoom.id;
					return (
						<div
							key={zoom.id}
							style={{ left: `${startPct}%`, width: `${widthPct}%` }}
							className={`absolute top-1 bottom-1 rounded border z-10 pointer-events-none transition-all ${
								isSelected
									? "bg-emerald-500/50 border-emerald-400 shadow-sm"
									: "bg-emerald-500/25 border-emerald-500/50"
							}`}
							title={`Zoom ${zoom.depth}x`}
						/>
					);
				})}

				{/* Progress Bar */}
				<div
					style={{
						width: durationMs > 0 ? `${(currentTimeMs / durationMs) * 100}%` : "0%",
					}}
					className="h-full bg-blue-600/40 pointer-events-none"
				/>

				{/* Playhead Pin */}
				<div
					style={{
						left: durationMs > 0 ? `${(currentTimeMs / durationMs) * 100}%` : "0%",
					}}
					className="absolute top-0 bottom-0 w-1 bg-white shadow-md z-20 pointer-events-none -ml-0.5"
				/>
			</div>

			{/* Success Message Banner */}
			{silenceSuccessMessage && (
				<div className="flex items-center justify-center gap-1.5 py-1 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium animate-fadeIn">
					<Check size={14} weight="bold" />
					<span>{silenceSuccessMessage}</span>
				</div>
			)}

			{/* Transport Action Bar */}
			<div className="flex items-center justify-between px-1">
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onRewind}
						className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
						title="Rewind (0s)"
					>
						<Rewind size={16} weight="fill" />
					</button>
					<button
						type="button"
						onClick={onTogglePlayPause}
						className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors cursor-pointer"
						title={isPlaying ? "Pause" : "Play"}
					>
						{isPlaying ? (
							<Pause size={16} weight="fill" />
						) : (
							<Play size={16} weight="fill" />
						)}
					</button>
					<span className="text-xs font-mono text-slate-400 pl-2">
						<span className="text-white font-semibold">
							{formatTime(currentTimeMs)}
						</span>
						{" / "}
						<span>{formatTime(durationMs)}</span>
					</span>
				</div>

				<div className="flex items-center gap-2">
					{/* Tahap 4: Descript-style Silence Removal Button */}
					<button
						type="button"
						onClick={onAnalyzeSilence}
						disabled={isAnalyzingSilence}
						className="flex items-center gap-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 px-3 py-1.5 text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
						title="Deteksi dan potong jeda dead-air hening 1-klik ala Descript & Screen Studio"
					>
						{isAnalyzingSilence ? (
							<Spinner size={14} className="animate-spin text-rose-400" />
						) : (
							<Scissors size={14} weight="bold" />
						)}
						<span>{isAnalyzingSilence ? "Menganalisis..." : "Clean Pauses"}</span>
					</button>

					{/* Reset Cuts Button */}
					{((meta.clipRegions && meta.clipRegions.length > 0) ||
						(meta.trimRegions && meta.trimRegions.length > 0)) && (
						<button
							type="button"
							onClick={onResetSilenceCuts}
							className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
							title="Reset potongan jeda hening ke durasi video utuh"
						>
							<ArrowsClockwise size={13} />
							<span>Reset Cuts</span>
						</button>
					)}

					{/* Tahap 2: Auto-Suggest Zooms button */}
					<button
						type="button"
						onClick={onAutoSuggestZooms}
						className="flex items-center gap-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 px-3 py-1.5 text-xs font-semibold transition-all shadow-sm cursor-pointer"
						title="Auto-detect klik kursor untuk membuat zoom otomatis ala Screen Studio"
					>
						<WandSparkles size={14} weight="bold" />
						<span>Auto-Suggest Zooms</span>
					</button>

					<button
						type="button"
						onClick={onAddZoomAtPlayhead}
						className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold transition-all shadow-sm cursor-pointer"
					>
						<Plus size={14} weight="bold" />
						<span>Add Zoom</span>
					</button>
				</div>
			</div>
		</div>
	);
};
