import { Check, Scissors, Spinner, Waveform, X } from "@phosphor-icons/react";
import React from "react";
import type { SilenceRegion } from "@/components/video-editor/audio/silenceDetector";
import { formatTime } from "./recordConstants";

export interface RecordSilenceModalProps {
	isOpen: boolean;
	detectedSilences: SilenceRegion[];
	selectedSilenceIds: Set<string>;
	silenceThresholdDb: number;
	silenceMinDurationMs: number;
	isAnalyzingSilence: boolean;
	onClose: () => void;
	onThresholdChange: (db: number) => void;
	onMinDurationChange: (ms: number) => void;
	onToggleSilenceSelection: (id: string) => void;
	onReanalyze: () => void;
	onApplyRemoval: () => void;
}

export const RecordSilenceModal: React.FC<RecordSilenceModalProps> = ({
	isOpen,
	detectedSilences,
	selectedSilenceIds,
	silenceThresholdDb,
	silenceMinDurationMs,
	isAnalyzingSilence,
	onClose,
	onThresholdChange,
	onMinDurationChange,
	onToggleSilenceSelection,
	onReanalyze,
	onApplyRemoval,
}) => {
	if (!isOpen) return null;

	const totalSilenceMs = detectedSilences.reduce((acc, s) => acc + s.durationMs, 0);

	return (
		<div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
			<div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl flex flex-col gap-4 text-slate-200">
				{/* Modal Header */}
				<div className="flex items-center justify-between border-b border-slate-800 pb-3">
					<div className="flex items-center gap-2">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
							<Scissors size={18} weight="bold" />
						</div>
						<div>
							<h3 className="text-sm font-bold text-white">
								Clean Pauses / Dead-Air
							</h3>
							<p className="text-[11px] text-slate-400">
								{detectedSilences.length} jeda hening terdeteksi (hemat{" "}
								{(totalSilenceMs / 1000).toFixed(1)}s)
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
					>
						<X size={16} />
					</button>
				</div>

				{/* Sensitivity Sliders */}
				<div className="space-y-3 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
					<div>
						<div className="flex justify-between text-[11px] text-slate-400 mb-1">
							<span>Threshold Sensitivitas Hening</span>
							<span className="font-mono text-white font-semibold">
								{silenceThresholdDb} dB
							</span>
						</div>
						<input
							type="range"
							min="-50"
							max="-20"
							step="2"
							value={silenceThresholdDb}
							onChange={(e) => onThresholdChange(Number(e.target.value))}
							className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
						/>
						<div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
							<span>Sensitif (-50dB)</span>
							<span>Ketat (-20dB)</span>
						</div>
					</div>

					<div>
						<div className="flex justify-between text-[11px] text-slate-400 mb-1">
							<span>Durasi Minimum Jeda</span>
							<span className="font-mono text-white font-semibold">
								{(silenceMinDurationMs / 1000).toFixed(1)}s
							</span>
						</div>
						<input
							type="range"
							min="500"
							max="3000"
							step="100"
							value={silenceMinDurationMs}
							onChange={(e) => onMinDurationChange(Number(e.target.value))}
							className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
						/>
					</div>

					<button
						type="button"
						onClick={onReanalyze}
						disabled={isAnalyzingSilence}
						className="w-full py-1.5 px-3 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
					>
						{isAnalyzingSilence ? (
							<Spinner size={13} className="animate-spin text-rose-400" />
						) : (
							<Waveform size={13} />
						)}
						<span>Pindai Ulang Audio</span>
					</button>
				</div>

				{/* Detected Silences List */}
				<div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
					{detectedSilences.map((silence, idx) => {
						const isChecked = selectedSilenceIds.has(silence.id);
						return (
							<div
								key={silence.id}
								onClick={() => onToggleSilenceSelection(silence.id)}
								className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
									isChecked
										? "border-rose-500/40 bg-rose-500/10 text-white"
										: "border-slate-800 bg-slate-800/30 text-slate-500"
								}`}
							>
								<div className="flex items-center gap-2">
									<input
										type="checkbox"
										checked={isChecked}
										onChange={() => onToggleSilenceSelection(silence.id)}
										className="accent-rose-500 cursor-pointer rounded"
									/>
									<span className="font-medium">Jeda #{idx + 1}</span>
								</div>
								<div className="font-mono text-[11px] text-slate-400">
									{formatTime(silence.startMs)} - {formatTime(silence.endMs)} (
									<span className="text-rose-400 font-semibold">
										{(silence.durationMs / 1000).toFixed(1)}s
									</span>
									)
								</div>
							</div>
						);
					})}
				</div>

				{/* Modal Footer */}
				<div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
					<button
						type="button"
						onClick={onClose}
						className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
					>
						Batal
					</button>
					<button
						type="button"
						onClick={onApplyRemoval}
						disabled={selectedSilenceIds.size === 0}
						className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
					>
						<Check size={14} weight="bold" />
						<span>Potong {selectedSilenceIds.size} Jeda (Ripple Cut)</span>
					</button>
				</div>
			</div>
		</div>
	);
};
