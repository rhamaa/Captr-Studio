import { Clock, Pause, Play, Repeat, Rewind, Sparkle } from "@phosphor-icons/react";
import React, { useCallback, useEffect, useRef, useState } from "react";

export interface MotionSlideTimelineProps {
	currentTimeMs: number;
	durationMs: number;
	isPlaying: boolean;
	isLoop?: boolean;
	playbackRate?: number;
	onSeek: (timeMs: number) => void;
	onTogglePlay: () => void;
	onRewind: () => void;
	onToggleLoop?: () => void;
	onChangePlaybackRate?: (rate: number) => void;
	onChangeDuration?: (durationMs: number) => void;
	className?: string;
}

function formatTimeCode(ms: number): string {
	const clamped = Math.max(0, ms);
	const totalSec = Math.floor(clamped / 1000);
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	const hundredths = Math.floor((clamped % 1000) / 10);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

export const MotionSlideTimeline: React.FC<MotionSlideTimelineProps> = ({
	currentTimeMs,
	durationMs,
	isPlaying,
	isLoop = true,
	playbackRate = 1,
	onSeek,
	onTogglePlay,
	onRewind,
	onToggleLoop,
	onChangePlaybackRate,
	onChangeDuration,
	className = "",
}) => {
	const rulerRef = useRef<HTMLDivElement | null>(null);
	const isDraggingRef = useRef(false);
	const [durationInputVal, setDurationInputVal] = useState(
		((durationMs || 5000) / 1000).toFixed(1),
	);

	useEffect(() => {
		setDurationInputVal(((durationMs || 5000) / 1000).toFixed(1));
	}, [durationMs]);

	const safeDurationMs = Math.max(500, durationMs || 5000);
	const progressRatio = Math.min(1, Math.max(0, currentTimeMs / safeDurationMs));
	const progressPercent = progressRatio * 100;

	// Scrub calculation from mouse event
	const handleSeekAtMouse = useCallback(
		(clientX: number) => {
			if (!rulerRef.current) return;
			const rect = rulerRef.current.getBoundingClientRect();
			const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
			const ratio = rect.width > 0 ? offsetX / rect.width : 0;
			const targetMs = Math.round(ratio * safeDurationMs);
			onSeek(targetMs);
		},
		[onSeek, safeDurationMs],
	);

	const handleMouseDown = (e: React.MouseEvent) => {
		isDraggingRef.current = true;
		handleSeekAtMouse(e.clientX);

		const handleMouseMove = (moveEvent: MouseEvent) => {
			if (isDraggingRef.current) {
				handleSeekAtMouse(moveEvent.clientX);
			}
		};

		const handleMouseUp = () => {
			isDraggingRef.current = false;
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);
	};

	const handleDurationCommit = () => {
		const val = parseFloat(durationInputVal);
		if (Number.isFinite(val) && val >= 0.5 && val <= 300) {
			onChangeDuration?.(Math.round(val * 1000));
		} else {
			setDurationInputVal((safeDurationMs / 1000).toFixed(1));
		}
	};

	// Generate 10 tick marks across ruler
	const ticks = Array.from({ length: 11 }, (_, i) => {
		const ratio = i / 10;
		const sec = ((ratio * safeDurationMs) / 1000).toFixed(1);
		return { ratio, sec };
	});

	return (
		<div
			className={`flex flex-col h-[180px] w-full border-t border-foreground/10 bg-editor-surface/90 text-slate-200 select-none backdrop-blur-xl shadow-2xl ${className}`}
		>
			{/* Top Bar: Playback Controls, Timecode, Rates, & Duration */}
			<div className="flex h-12 items-center justify-between px-5 border-b border-foreground/[0.08] bg-foreground/[0.02]">
				{/* Left: Transport Buttons */}
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onRewind}
						title="Rewind to start (Home)"
						className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/10 bg-foreground/5 text-foreground/80 hover:bg-foreground/10 hover:text-foreground transition cursor-pointer"
					>
						<Rewind size={15} weight="bold" />
					</button>

					<button
						type="button"
						onClick={onTogglePlay}
						title={isPlaying ? "Pause (Space)" : "Play (Space)"}
						className="flex h-8 items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 text-xs font-semibold text-slate-950 shadow-md hover:bg-amber-400 transition cursor-pointer"
					>
						{isPlaying ? (
							<>
								<Pause size={14} weight="fill" />
								<span>Pause</span>
							</>
						) : (
							<>
								<Play size={14} weight="fill" />
								<span>Play</span>
							</>
						)}
					</button>

					{onToggleLoop && (
						<button
							type="button"
							onClick={onToggleLoop}
							title={isLoop ? "Looping Enabled" : "Looping Disabled"}
							className={`flex h-8 w-8 items-center justify-center rounded-lg border transition cursor-pointer ${
								isLoop
									? "border-amber-500/40 bg-amber-500/10 text-amber-400"
									: "border-foreground/10 bg-foreground/5 text-foreground/50 hover:text-foreground/80"
							}`}
						>
							<Repeat size={14} weight="bold" />
						</button>
					)}

					{/* Playback speed multiplier */}
					{onChangePlaybackRate && (
						<div className="flex items-center rounded-lg border border-foreground/10 bg-foreground/5 p-0.5 ml-1">
							{[0.5, 1, 2].map((rate) => (
								<button
									key={rate}
									type="button"
									onClick={() => onChangePlaybackRate(rate)}
									className={`px-2 py-0.5 text-[11px] font-semibold rounded cursor-pointer transition ${
										playbackRate === rate
											? "bg-amber-500 text-slate-950"
											: "text-foreground/60 hover:text-foreground"
									}`}
								>
									{rate}x
								</button>
							))}
						</div>
					)}
				</div>

				{/* Center: Precision Timecode & Percentage */}
				<div className="flex items-center gap-3">
					<div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-foreground/5 border border-foreground/10 font-mono text-xs">
						<Clock size={13} className="text-amber-400" />
						<span className="font-semibold text-amber-400">
							{formatTimeCode(currentTimeMs)}
						</span>
						<span className="text-foreground/30">/</span>
						<span className="text-foreground/60">{formatTimeCode(safeDurationMs)}</span>
					</div>

					<span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400">
						{Math.round(progressPercent)}%
					</span>
				</div>

				{/* Right: Duration Input & Sync Status */}
				<div className="flex items-center gap-3">
					{onChangeDuration && (
						<div className="flex items-center gap-1.5 text-xs text-foreground/70">
							<span className="text-[11px] font-medium text-foreground/50">
								Durasi:
							</span>
							<div className="relative flex items-center">
								<input
									type="number"
									step="0.5"
									min="0.5"
									max="300"
									value={durationInputVal}
									onChange={(e) => setDurationInputVal(e.target.value)}
									onBlur={handleDurationCommit}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleDurationCommit();
									}}
									className="w-16 rounded-md border border-foreground/15 bg-foreground/5 px-2 py-1 text-center font-mono text-xs text-foreground focus:border-amber-500 focus:outline-none"
								/>
								<span className="ml-1 text-[11px] text-foreground/40 font-mono">
									s
								</span>
							</div>
						</div>
					)}

					<div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold tracking-wide">
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
						<span>SETSEEKTIME ACTIVE</span>
					</div>
				</div>
			</div>

			{/* Main Scrubber Track Area */}
			<div className="relative flex-1 flex flex-col justify-center px-6 py-4">
				{/* Timeline Ruler Box */}
				<div
					ref={rulerRef}
					onMouseDown={handleMouseDown}
					className="relative h-16 w-full cursor-pointer rounded-xl bg-slate-950/70 border border-foreground/10 overflow-hidden shadow-inner group select-none"
				>
					{/* Progress Fill Background */}
					<div
						className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-amber-500/15 to-amber-500/25 pointer-events-none transition-all duration-75"
						style={{ width: `${progressPercent}%` }}
					/>

					{/* Tick marks and labels */}
					<div className="absolute inset-0 flex pointer-events-none">
						{ticks.map((tick, i) => (
							<div
								key={i}
								className="absolute top-0 bottom-0 flex flex-col justify-between pt-1 pb-1.5"
								style={{ left: `${tick.ratio * 100}%` }}
							>
								<div className="h-2 w-[1px] bg-foreground/15" />
								<span className="text-[10px] font-mono text-foreground/40 -translate-x-1/2">
									{tick.sec}s
								</span>
								<div className="h-2 w-[1px] bg-foreground/15" />
							</div>
						))}
					</div>

					{/* Motion Wave Graphic Motif */}
					<div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
						<Sparkle size={32} weight="fill" className="text-amber-400" />
					</div>

					{/* Playhead Needle */}
					<div
						className="absolute top-0 bottom-0 z-30 pointer-events-none -translate-x-1/2 transition-transform duration-75"
						style={{ left: `${progressPercent}%` }}
					>
						{/* Needle Line */}
						<div className="h-full w-[2px] bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]" />
						{/* Top Playhead Badge */}
						<div className="absolute -top-1 left-1/2 -translate-x-1/2 flex items-center justify-center h-4 w-4 rotate-45 rounded-sm bg-amber-400 shadow-md" />
					</div>
				</div>

				{/* Help tip footer */}
				<div className="flex items-center justify-between pt-2 px-1 text-[11px] text-foreground/40 font-sans">
					<span>
						💡 Geser scrubber untuk melihat frame animasi web HTML & CSS Anda secara
						real-time.
					</span>
					<span className="font-mono text-[10px]">Canvas Mode: 60 FPS Export</span>
				</div>
			</div>
		</div>
	);
};
