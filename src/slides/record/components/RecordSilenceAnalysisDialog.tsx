import { Scissors, SpeakerX as VolumeX } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/contexts/I18nContext";
import type { SilenceRegion } from "@/slides/record/silenceDetector";

export interface RecordSilenceAnalysisDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	detectedSilences: SilenceRegion[];
	silenceTotalSavedMs: number;
	silenceMinDurationMs: number;
	onSilenceMinDurationChange: (durationMs: number) => void;
	silenceThresholdDb: number;
	onSilenceThresholdChange: (thresholdDb: number) => void;
	onAnalyze: (minDurationMs: number, thresholdDb: number) => void;
	onApply: () => void;
	formatTime: (seconds: number) => string;
}

export function RecordSilenceAnalysisDialog({
	open,
	onOpenChange,
	detectedSilences,
	silenceTotalSavedMs,
	silenceMinDurationMs,
	onSilenceMinDurationChange,
	silenceThresholdDb,
	onSilenceThresholdChange,
	onAnalyze,
	onApply,
	formatTime,
}: RecordSilenceAnalysisDialogProps) {
	const { t } = useI18n();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[480px] border-foreground/10 bg-editor-surface text-foreground shadow-2xl">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-base font-semibold">
						<VolumeX className="w-5 h-5 text-[#8DDB9B]" />
						{t("editor.silence.modalTitle", "Clean Pauses & Dead-Air (1-Click Cut)")}
					</DialogTitle>
					<DialogDescription className="text-xs text-muted-foreground">
						{t(
							"editor.silence.modalDescription",
							"Automatically cut silent gaps and dead air to keep your video engaging and fast-paced.",
						)}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-2">
					<div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-foreground/[0.04] border border-foreground/10">
						<div>
							<div className="text-[10px] uppercase font-semibold text-muted-foreground">
								{t("editor.silence.detectedCount", "Pauses Found")}
							</div>
							<div className="text-2xl font-bold text-foreground mt-0.5">
								{detectedSilences.length}
							</div>
						</div>
						<div>
							<div className="text-[10px] uppercase font-semibold text-muted-foreground">
								{t("editor.silence.timeSaved", "Time Saved")}
							</div>
							<div className="text-2xl font-bold text-[#8DDB9B] mt-0.5">
								-{(silenceTotalSavedMs / 1000).toFixed(1)}s
							</div>
						</div>
					</div>

					<div className="space-y-2.5 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
						<div className="flex items-center justify-between text-xs">
							<span className="font-medium text-foreground">
								{t("editor.silence.minDurationLabel", "Min Pause Duration")}
							</span>
							<span className="font-mono text-muted-foreground">
								{(silenceMinDurationMs / 1000).toFixed(1)}s
							</span>
						</div>
						<input
							type="range"
							min="600"
							max="3000"
							step="100"
							value={silenceMinDurationMs}
							onChange={(event) => onSilenceMinDurationChange(Number(event.target.value))}
							onMouseUp={() => onAnalyze(silenceMinDurationMs, silenceThresholdDb)}
							className="w-full h-1.5 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-[#8DDB9B]"
						/>
						<div className="flex justify-between text-[10px] text-muted-foreground/60">
							<span>Aggressive (0.6s)</span>
							<span>Default (1.0s)</span>
							<span>Relaxed (3.0s)</span>
						</div>
					</div>

					<div className="space-y-2.5 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-3">
						<div className="flex items-center justify-between text-xs">
							<span className="font-medium text-foreground">
								{t("editor.silence.thresholdLabel", "Silence Volume Threshold")}
							</span>
							<span className="font-mono text-muted-foreground">
								{silenceThresholdDb} dB
							</span>
						</div>
						<input
							type="range"
							min="-50"
							max="-20"
							step="2"
							value={silenceThresholdDb}
							onChange={(event) => onSilenceThresholdChange(Number(event.target.value))}
							onMouseUp={() => onAnalyze(silenceMinDurationMs, silenceThresholdDb)}
							className="w-full h-1.5 bg-foreground/10 rounded-lg appearance-none cursor-pointer accent-[#8DDB9B]"
						/>
						<div className="flex justify-between text-[10px] text-muted-foreground/60">
							<span>Sensitive (-50dB)</span>
							<span>Default (-36dB)</span>
							<span>Aggressive (-20dB)</span>
						</div>
					</div>

					{detectedSilences.length > 0 ? (
						<div className="space-y-1">
							<div className="text-[11px] font-medium text-muted-foreground">
								{t("editor.silence.previewList", "Detected pauses:")}
							</div>
							<div className="max-h-32 overflow-y-auto space-y-1 pr-1 text-xs font-mono">
								{detectedSilences.slice(0, 8).map((silence) => (
									<div
										key={silence.id}
										className="flex justify-between items-center px-2.5 py-1 rounded bg-foreground/[0.03] text-muted-foreground"
									>
										<span>
											{formatTime(silence.startMs / 1000)} → {formatTime(silence.endMs / 1000)}
										</span>
										<span className="text-[#8DDB9B] font-semibold">
											-{(silence.durationMs / 1000).toFixed(1)}s
										</span>
									</div>
								))}
								{detectedSilences.length > 8 ? (
									<div className="text-center text-[10px] text-muted-foreground/60 py-0.5">
										+{detectedSilences.length - 8} more pauses
									</div>
								) : null}
							</div>
						</div>
					) : (
						<div className="text-center py-4 text-xs text-muted-foreground">
							{t("editor.silence.noPauses", "No dead-air pauses detected matching criteria.")}
						</div>
					)}
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						className="text-xs"
					>
						{t("common.actions.cancel", "Cancel")}
					</Button>
					<Button
						disabled={detectedSilences.length === 0}
						onClick={onApply}
						className="bg-[#8DDB9B] hover:bg-[#a3e4af] text-[#172033] text-xs font-semibold gap-1.5"
					>
						<Scissors className="w-3.5 h-3.5" />
						{t("editor.silence.cutAllButton", "Cut All Pauses & Ripple Timeline")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
