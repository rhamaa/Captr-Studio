import React from "react";
import {
	Microphone,
	Record,
	Stop,
	X,
} from "@phosphor-icons/react";

export interface SlideVoiceoverBarProps {
	isRecording: boolean;
	countdown: number | null;
	audioLevel: number;
	recordingDurationMs: number;
	startPlayheadMs: number;
	currentTimeMs: number;
	availableDevices: MediaDeviceInfo[];
	selectedDeviceId: string;
	onSelectDeviceId: (id: string) => void;
	onStartRecord: () => void;
	onStopRecord: () => void;
	onCancelRecord: () => void;
	className?: string;
}

function formatTime(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	const tenths = Math.floor((ms % 1000) / 100);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

export const SlideVoiceoverBar: React.FC<SlideVoiceoverBarProps> = ({
	isRecording,
	countdown,
	audioLevel,
	recordingDurationMs,
	startPlayheadMs,
	currentTimeMs,
	availableDevices,
	selectedDeviceId,
	onSelectDeviceId,
	onStartRecord,
	onStopRecord,
	onCancelRecord,
	className,
}) => {
	return (
		<div
			className={`flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 backdrop-blur shadow-sm select-none ${
				isRecording ? "border-rose-500/50 bg-rose-950/20" : ""
			} ${className || ""}`}
		>
			{/* Left: Mic Selector & Live Level */}
			<div className="flex items-center gap-2">
				<div
					className={`flex h-7 w-7 items-center justify-center rounded-md ${
						isRecording
							? "bg-rose-500/20 text-rose-400"
							: "bg-slate-800 text-slate-300"
					}`}
				>
					<Microphone size={15} weight={isRecording ? "fill" : "bold"} />
				</div>

				{/* Device Picker (only visible when not recording) */}
				{!isRecording ? (
					<select
						value={selectedDeviceId}
						onChange={(e) => onSelectDeviceId(e.target.value)}
						className="max-w-[140px] truncate rounded border border-slate-750 bg-slate-800 px-2 py-1 text-[11px] text-slate-300 focus:border-blue-500 focus:outline-none"
					>
						{availableDevices.length === 0 ? (
							<option value="">Default Microphone</option>
						) : (
							availableDevices.map((dev, i) => (
								<option key={dev.deviceId || i} value={dev.deviceId}>
									{dev.label || `Microphone ${i + 1}`}
								</option>
							))
						)}
					</select>
				) : (
					<div className="flex items-center gap-1.5">
						<span className="flex h-2 w-2 relative">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
							<span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
						</span>
						<span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider">
							REC
						</span>
					</div>
				)}

				{/* VU Meter Bars */}
				<div className="flex items-center gap-0.5 h-3.5 px-1 bg-slate-950/60 rounded border border-slate-800">
					{[...Array(6)].map((_, i) => {
						const threshold = (i + 1) / 6;
						const active = audioLevel >= threshold;
						let barColor = "bg-emerald-500";
						if (i >= 4) barColor = "bg-rose-500";
						else if (i >= 3) barColor = "bg-amber-400";

						return (
							<div
								key={i}
								className={`w-1 rounded-sm transition-all duration-75 ${
									active ? barColor : "bg-slate-800"
								}`}
								style={{ height: `${(i + 2) * 16}%` }}
							/>
						);
					})}
				</div>
			</div>

			{/* Center: Live Time & Playhead Position */}
			<div className="flex items-center gap-3 text-xs">
				{isRecording ? (
					<div className="flex items-center gap-2">
						<span className="font-mono text-rose-300 font-bold">
							+{formatTime(recordingDurationMs)}
						</span>
						<span className="text-[10px] text-slate-400 font-mono">
							(mulai @ {formatTime(startPlayheadMs)} $\to$ {formatTime(currentTimeMs)})
						</span>
					</div>
				) : countdown !== null ? (
					<div className="flex items-center gap-1.5 text-amber-400 font-bold animate-pulse">
						<span>Mulai dalam {countdown}...</span>
					</div>
				) : (
					<span className="text-[11px] text-slate-400">
						Playhead di <span className="font-mono text-slate-200">{formatTime(currentTimeMs)}</span>
					</span>
				)}
			</div>

			{/* Right: Record / Stop Controls */}
			<div className="flex items-center gap-1.5">
				{isRecording ? (
					<>
						<button
							type="button"
							onClick={onStopRecord}
							className="flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-rose-500 transition-colors"
						>
							<Stop size={12} weight="fill" />
							<span>Stop & Simpan</span>
						</button>
						<button
							type="button"
							onClick={onCancelRecord}
							title="Batal Rekam"
							className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
						>
							<X size={14} />
						</button>
					</>
				) : (
					<button
						type="button"
						onClick={onStartRecord}
						disabled={countdown !== null}
						className="flex items-center gap-1.5 rounded bg-rose-600/90 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-rose-500 transition-colors disabled:opacity-50"
					>
						<Record size={13} weight="fill" className="text-white" />
						<span>{countdown !== null ? `Mulai (${countdown})` : "Record Audio"}</span>
					</button>
				)}
			</div>
		</div>
	);
};
