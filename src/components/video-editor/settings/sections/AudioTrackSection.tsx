import { Trash as Trash2 } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SliderControl } from "../../SliderControl";
import { SectionLabel } from "../components/SettingsSectionLabel";
import type { AudioDuckingSettings } from "../../types";

export interface AudioTrackSectionProps {
	selectedAudioId?: string | null;
	selectedAudioVolume?: number | null;
	selectedAudioNormalize?: boolean | null;
	selectedAudioDucking?: boolean | null;
	onAudioVolumeChange?: (volume: number) => void;
	onAudioNormalizeChange?: (normalize: boolean) => void;
	onAudioDuckingChange?: (ducking: boolean) => void;
	onAudioDelete?: (id: string) => void;
	audioDuckingSettings?: AudioDuckingSettings;
	onAudioDuckingSettingsChange?: (settings: AudioDuckingSettings) => void;
	tSettings: (key: string, fallback?: string) => string;
	t: (key: string, fallback?: string) => string;
}

export function AudioTrackSection({
	selectedAudioId,
	selectedAudioVolume,
	selectedAudioNormalize,
	selectedAudioDucking,
	onAudioVolumeChange,
	onAudioNormalizeChange,
	onAudioDuckingChange,
	onAudioDelete,
	audioDuckingSettings,
	onAudioDuckingSettingsChange,
	tSettings,
	t,
}: AudioTrackSectionProps) {
	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-3">
				<SectionLabel>{tSettings("audio.volumeTitle", "Audio")}</SectionLabel>
				<button
					type="button"
					onClick={() => {
						onAudioVolumeChange?.(1);
						onAudioNormalizeChange?.(false);
						onAudioDuckingChange?.(true);
					}}
					className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
				>
					{t("common.actions.reset", "Reset")}
				</button>
			</div>
			<SliderControl
				label={tSettings("audio.volume", "Volume")}
				value={selectedAudioVolume ?? 1}
				defaultValue={1}
				min={0}
				max={1}
				step={0.01}
				onChange={(v: number) => onAudioVolumeChange?.(v)}
				formatValue={(v: number) => `${Math.round(v * 100)}%`}
				parseInput={(text: string) => parseFloat(text.replace(/%$/, "")) / 100}
			/>
			<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
				<span className="text-[10px] text-muted-foreground">
					{tSettings("audio.normalize", "Normalize")}
				</span>
				<Switch
					checked={Boolean(selectedAudioNormalize)}
					onCheckedChange={(v: boolean) => onAudioNormalizeChange?.(v)}
					className="data-[state=checked]:bg-[#2563EB] scale-75"
				/>
			</div>
			<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
				<div className="flex flex-col">
					<span className="text-[10px] text-muted-foreground">
						{tSettings("audio.ducking", "Auto-Ducking")}
					</span>
					<span className="text-[9px] text-muted-foreground/70">
						{tSettings("audio.duckingDesc", "Lower volume when voice is detected")}
					</span>
				</div>
				<Switch
					checked={Boolean(selectedAudioDucking ?? true)}
					onCheckedChange={(v) => onAudioDuckingChange?.(v)}
					className="data-[state=checked]:bg-[#2563EB] scale-75"
				/>
			</div>
			{audioDuckingSettings && onAudioDuckingSettingsChange && (
				<div className="flex flex-col gap-2 pt-2 border-t border-border/40">
					<div className="flex items-center justify-between">
						<span className="text-[10px] font-medium text-muted-foreground">
							{tSettings("audio.duckingSettings", "Ducking Reduction")}
						</span>
						<span className="text-[10px] text-muted-foreground font-mono">
							{audioDuckingSettings.duckingAmountDb} dB
						</span>
					</div>
					<SliderControl
						label={tSettings("audio.duckingAmount", "Reduction")}
						value={Math.abs(audioDuckingSettings.duckingAmountDb)}
						defaultValue={14}
						min={6}
						max={26}
						step={1}
						onChange={(v: number) =>
							onAudioDuckingSettingsChange({
								...audioDuckingSettings,
								duckingAmountDb: -Math.abs(v),
							})
						}
						formatValue={(v: number) => `-${v} dB`}
						parseInput={(text: string) =>
							parseFloat(text.replace(/^-/, "").replace(/ dB$/, ""))
						}
					/>
				</div>
			)}
			{selectedAudioId && onAudioDelete && (
				<Button
					variant="outline"
					size="sm"
					onClick={() => onAudioDelete(selectedAudioId)}
					className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 text-xs h-8 mt-1"
				>
					<Trash2 className="w-3.5 h-3.5 mr-1.5" />
					{tSettings("audio.deleteRegion", "Delete Audio")}
				</Button>
			)}
		</section>
	);
}
