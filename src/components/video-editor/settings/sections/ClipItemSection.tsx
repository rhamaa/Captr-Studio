import React from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SliderControl } from "../../SliderControl";
import { SectionLabel } from "../components/SettingsSectionLabel";
import type { ClipTransitionType } from "../../types";

export interface ClipItemSectionProps {
	selectedClipSpeed?: number | null;
	onClipSpeedChange?: (speed: number) => void;
	selectedClipMuted?: boolean | null;
	onClipMutedChange?: (muted: boolean) => void;
	hasClipSourceAudio?: boolean;
	selectedClipShowSourceAudio?: boolean | null;
	onClipShowSourceAudioChange?: (show: boolean) => void;
	selectedClipId?: string | null;
	sourceAudioTrackMeta?: Array<{ id: string; label: string }>;
	sourceAudioTrackSettings?: Record<string, { volume: number; normalize: boolean }>;
	onSourceAudioTrackVolumeChange?: (trackId: string, volume: number) => void;
	onSourceAudioTrackNormalizeChange?: (trackId: string, normalize: boolean) => void;
	selectedClipTransitionIn?: ClipTransitionType | null;
	selectedClipTransitionInDurationMs?: number | null;
	onClipTransitionInChange?: (transition: ClipTransitionType) => void;
	onClipTransitionInDurationChange?: (duration: number) => void;
	tSettings: (key: string, fallback?: string) => string;
	t: (key: string, fallback?: string) => string;
}

export const ClipItemSection: React.FC<ClipItemSectionProps> = ({
	selectedClipSpeed,
	onClipSpeedChange,
	selectedClipMuted,
	onClipMutedChange,
	hasClipSourceAudio = false,
	selectedClipShowSourceAudio = false,
	onClipShowSourceAudioChange,
	selectedClipId,
	sourceAudioTrackMeta = [],
	sourceAudioTrackSettings = {},
	onSourceAudioTrackVolumeChange,
	onSourceAudioTrackNormalizeChange,
	selectedClipTransitionIn = "none",
	selectedClipTransitionInDurationMs = 400,
	onClipTransitionInChange,
	onClipTransitionInDurationChange,
	tSettings,
	t,
}) => {
	return (
		<section className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<SectionLabel>{tSettings("clip.title", "Clip")}</SectionLabel>
				{selectedClipSpeed != null && selectedClipSpeed !== 1 && (
					<span className="rounded-full bg-[#06b6d4]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#06b6d4]">
						{selectedClipSpeed}×
					</span>
				)}
			</div>

			<div className="flex items-center justify-between gap-3">
				<SectionLabel>{tSettings("speed.label", "Speed")}</SectionLabel>
				{selectedClipSpeed != null && selectedClipSpeed !== 1 && (
					<button
						type="button"
						onClick={() => onClipSpeedChange?.(1)}
						className="text-[10px] text-[#06b6d4] transition-opacity hover:opacity-80 cursor-pointer"
					>
						{t("common.actions.reset", "Reset")}
					</button>
				)}
			</div>
			<SliderControl
				label={tSettings("speed.playbackRate", "Playback Rate")}
				value={selectedClipSpeed ?? 1}
				defaultValue={1}
				min={0.25}
				max={8}
				step={0.05}
				onChange={(v: number) => onClipSpeedChange?.(Number(v.toFixed(2)))}
				formatValue={(v: number) => `${v.toFixed(2)}×`}
				parseInput={(text: string) => {
					const num = parseFloat(text.replace(/×$/, ""));
					return isNaN(num) ? null : num;
				}}
				accentColor="blue"
			/>
			<div className="grid grid-cols-4 gap-1.5">
				{[
					{ speed: 0.25, label: "0.25×" },
					{ speed: 0.5, label: "0.5×" },
					{ speed: 0.75, label: "0.75×" },
					{ speed: 1, label: "1×" },
					{ speed: 1.25, label: "1.25×" },
					{ speed: 1.5, label: "1.5×" },
					{ speed: 2, label: "2×" },
					{ speed: 2.5, label: "2.5×" },
					{ speed: 3, label: "3×" },
					{ speed: 4, label: "4×" },
					{ speed: 5, label: "5×" },
					{ speed: 8, label: "8×" },
					{ speed: 10, label: "10×" },
					{ speed: 15, label: "15×" },
					{ speed: 20, label: "20×" },
					{ speed: 30, label: "30×" },
				].map((option) => {
					const isActive = selectedClipSpeed === option.speed;
					return (
						<Button
							key={option.speed}
							type="button"
							onClick={() => onClipSpeedChange?.(option.speed)}
							className={cn(
								"h-auto w-full rounded-lg border px-0.5 py-2 text-center shadow-sm transition-all duration-200 ease-out cursor-pointer",
								isActive
									? "border-[#06b6d4] bg-[#06b6d4] text-white"
									: "border-foreground/5 bg-foreground/5 text-muted-foreground hover:bg-foreground/10 hover:border-foreground/10 hover:text-foreground",
							)}
						>
							<span className="text-[10px] font-semibold">{option.label}</span>
						</Button>
					);
				})}
			</div>

			<div className="mt-2 flex flex-col gap-2 border-t border-foreground/5 pt-3">
				<SectionLabel>{tSettings("audio.title", "Audio")}</SectionLabel>

				<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
					<div>
						<span className="text-[10px] text-muted-foreground">
							{tSettings("clip.mute", "Mute")}
						</span>
						<p className="text-[9px] text-muted-foreground/50 mt-0.5">
							{selectedClipMuted
								? tSettings("clip.mutedState", "Audio is muted")
								: tSettings("clip.unmutedState", "Audio is playing")}
						</p>
					</div>
					<Switch
						checked={selectedClipMuted ?? false}
						onCheckedChange={(v) => onClipMutedChange?.(v)}
						className="data-[state=checked]:bg-[#06b6d4] scale-75"
					/>
				</div>
				{hasClipSourceAudio && (
					<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
						<span className="text-[10px] text-muted-foreground">
							{tSettings(
								"clip.separateClipFromAudio",
								"Separate clip from audio",
							)}
						</span>
						<Switch
							checked={selectedClipShowSourceAudio ?? false}
							onCheckedChange={(v) => onClipShowSourceAudioChange?.(v)}
							className="data-[state=checked]:bg-[#06b6d4] scale-75"
						/>
					</div>
				)}
			</div>

			{selectedClipId && hasClipSourceAudio && sourceAudioTrackMeta.length > 0 && (
				<div className="mt-1 flex flex-col gap-3">
					{sourceAudioTrackMeta.map((track) => {
						const settings = sourceAudioTrackSettings[track.id] ?? {
							volume: 1,
							normalize: false,
						};
						return (
							<div
								key={track.id}
								className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-2"
							>
								<div className="mb-2 flex items-center justify-between">
									<span className="text-[11px] font-medium text-foreground">
										{track.label}
									</span>
									<button
										type="button"
										onClick={() => {
											onSourceAudioTrackVolumeChange?.(track.id, 1);
											onSourceAudioTrackNormalizeChange?.(
												track.id,
												false,
											);
										}}
										className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
									>
										{t("common.actions.reset", "Reset")}
									</button>
								</div>
								<div className="mb-2 flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
									<span className="text-[10px] text-muted-foreground">
										{tSettings("audio.normalize", "Normalize")}
									</span>
									<Switch
										checked={settings.normalize}
										onCheckedChange={(v) =>
											onSourceAudioTrackNormalizeChange?.(track.id, v)
										}
										className="data-[state=checked]:bg-[#06b6d4] scale-75"
									/>
								</div>
								<SliderControl
									label={tSettings("audio.volume", "Volume")}
									value={settings.volume}
									defaultValue={1}
									min={0}
									max={1}
									step={0.01}
									onChange={(v: number) =>
										onSourceAudioTrackVolumeChange?.(track.id, v)
									}
									formatValue={(v: number) => `${Math.round(v * 100)}%`}
									parseInput={(text: string) =>
										parseFloat(text.replace(/%$/, "")) / 100
									}
								/>
							</div>
						);
					})}
				</div>
			)}

			<div className="mt-2 flex flex-col gap-2 border-t border-foreground/5 pt-3">
				<SectionLabel>{tSettings("clip.transition", "Transition In")}</SectionLabel>

				<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
					<div>
						<span className="text-[10px] text-muted-foreground">
							{tSettings("clip.transitionType", "Effect")}
						</span>
						<p className="text-[9px] text-muted-foreground/50 mt-0.5">
							{selectedClipTransitionIn && selectedClipTransitionIn !== "none"
								? tSettings("clip.transitionActive", "Transition on clip start")
								: tSettings("clip.transitionNone", "Cut (No transition)")}
						</p>
					</div>
					<Select
						value={selectedClipTransitionIn ?? "none"}
						onValueChange={(val) =>
							onClipTransitionInChange?.(val as ClipTransitionType)
						}
					>
						<SelectTrigger className="h-7 w-32 border-foreground/10 bg-foreground/[0.03] text-[10px]">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="none">None (Cut)</SelectItem>
							<SelectItem value="fade-black">Dip to Black</SelectItem>
							<SelectItem value="fade-white">Dip to White</SelectItem>
							<SelectItem value="slide-left">Slide Left</SelectItem>
							<SelectItem value="slide-right">Slide Right</SelectItem>
							<SelectItem value="zoom-push">Zoom Push</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{selectedClipTransitionIn && selectedClipTransitionIn !== "none" && (
					<SliderControl
						label={tSettings("clip.transitionDuration", "Duration")}
						value={selectedClipTransitionInDurationMs ?? 400}
						defaultValue={400}
						min={100}
						max={1500}
						step={50}
						onChange={(v: number) => onClipTransitionInDurationChange?.(v)}
						formatValue={(v: number) => `${v}ms`}
						parseInput={(text: string) => parseInt(text.replace(/ms$/, ""), 10) || 400}
					/>
				)}
			</div>
		</section>
	);
};
