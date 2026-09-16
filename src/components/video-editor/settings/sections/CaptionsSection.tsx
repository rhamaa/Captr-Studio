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
import type {
	AutoCaptionAnimation,
	AutoCaptionSettings,
	CaptionHighlightStyle,
} from "../../types";
import { DEFAULT_AUTO_CAPTION_SETTINGS } from "../../types";

export const CAPTION_LANGUAGE_OPTIONS = [
	{ value: "auto", label: "Auto Detect" },
	{ value: "id", label: "Indonesian (Bahasa Indonesia)" },
	{ value: "en", label: "English" },
	{ value: "es", label: "Spanish" },
	{ value: "fr", label: "French" },
	{ value: "de", label: "German" },
	{ value: "it", label: "Italian" },
	{ value: "pt", label: "Portuguese" },
	{ value: "zh", label: "Chinese (Simplified)" },
	{ value: "ja", label: "Japanese" },
	{ value: "ko", label: "Korean" },
] as const;

export const CAPTION_ANIMATION_OPTIONS: Array<{ value: AutoCaptionAnimation; label: string }> = [
	{ value: "none", label: "Off" },
	{ value: "fade", label: "Fade" },
	{ value: "rise", label: "Rise" },
	{ value: "pop", label: "Pop" },
];

export const CAPTION_HIGHLIGHT_STYLE_OPTIONS: Array<{
	value: CaptionHighlightStyle;
	label: string;
}> = [
	{ value: "karaoke-pop", label: "Karaoke Pop (Zoom & Highlight)" },
	{ value: "hormozi", label: "Alex Hormozi (Bold Contrast)" },
	{ value: "neon-glow", label: "Neon Glow (Cyberpunk)" },
	{ value: "box-highlight", label: "Box Pill (Filled Pill)" },
	{ value: "classic", label: "Classic (Color Transition)" },
];

export const CAPTION_HIGHLIGHT_COLOR_PRESETS = [
	{ name: "Neon Yellow", value: "#FFE600" },
	{ name: "Lime Green", value: "#22C55E" },
	{ name: "Electric Cyan", value: "#06B6D4" },
	{ name: "Hot Pink", value: "#EC4899" },
	{ name: "Flame Orange", value: "#F97316" },
];

export interface CaptionsSectionProps {
	autoCaptionSettings: AutoCaptionSettings;
	updateAutoCaptionSettings: (patch: Partial<AutoCaptionSettings>) => void;
	onAutoCaptionSettingsChange?: (settings: AutoCaptionSettings) => void;
	whisperModelPath?: string | null;
	whisperModelDownloadStatus?: "idle" | "downloading" | "extracting" | "ready" | "error" | "downloaded";
	whisperModelDownloadProgress?: number;
	isGeneratingCaptions?: boolean;
	captionCueCount?: number;
	onPickWhisperModel?: () => void;
	onDownloadWhisperSmallModel?: () => void;
	onDeleteWhisperSmallModel?: () => void;
	onClearAutoCaptions?: () => void;
	onGenerateAutoCaptions?: () => void;
	renderExtensionPanelsForSections?: (section: string) => React.ReactNode;
	tSettings: (key: string, fallback?: string) => string;
	t: (key: string, fallback?: string) => string;
}

export const CaptionsSection: React.FC<CaptionsSectionProps> = ({
	autoCaptionSettings,
	updateAutoCaptionSettings,
	onAutoCaptionSettingsChange,
	whisperModelPath,
	whisperModelDownloadStatus,
	whisperModelDownloadProgress,
	isGeneratingCaptions,
	captionCueCount,
	onPickWhisperModel,
	onDownloadWhisperSmallModel,
	onDeleteWhisperSmallModel,
	onClearAutoCaptions,
	onGenerateAutoCaptions,
	renderExtensionPanelsForSections,
	tSettings,
	t,
}) => {
	return (
		<section className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<SectionLabel>{tSettings("sections.captions", "Captions")}</SectionLabel>
					<button
						type="button"
						onClick={() => onAutoCaptionSettingsChange?.(DEFAULT_AUTO_CAPTION_SETTINGS)}
						className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
					>
						{t("common.actions.reset", "Reset")}
					</button>
				</div>
				<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
					<span>{tSettings("captions.enabled", "Show")}</span>
					<Switch
						checked={autoCaptionSettings.enabled}
						onCheckedChange={(enabled) => updateAutoCaptionSettings({ enabled })}
						className="data-[state=checked]:bg-[#2563EB] scale-75"
					/>
				</div>
			</div>

			<div className="rounded-lg bg-foreground/[0.03] px-2.5 py-2 space-y-3">
				<div>
					<Button
						type="button"
						variant="outline"
						onClick={onPickWhisperModel}
						className="h-10 w-full rounded-xl border-foreground/10 bg-foreground/5 px-4 text-sm text-foreground hover:bg-foreground/10 hover:text-foreground"
					>
						{tSettings("captions.selectModel", "Select Model")}
					</Button>
				</div>
				<div className="flex items-center justify-between gap-3">
					<div className="text-sm font-medium text-foreground">
						{tSettings("captions.language", "Language")}
					</div>
					<Select
						value={autoCaptionSettings.language || "auto"}
						onValueChange={(value) => updateAutoCaptionSettings({ language: value })}
					>
						<SelectTrigger className="h-10 w-[180px] rounded-xl border-foreground/10 bg-foreground/5 text-sm text-foreground hover:bg-foreground/10">
							<SelectValue />
						</SelectTrigger>
						<SelectContent className="border-foreground/10 bg-editor-surface-alt text-foreground">
							{CAPTION_LANGUAGE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="grid w-full grid-cols-2 gap-2">
						{whisperModelDownloadStatus === "downloading" ? (
							<Button
								type="button"
								disabled
								className="h-10 w-full rounded-xl bg-foreground/10 px-4 text-sm font-medium text-foreground hover:bg-foreground/10"
							>
								{tSettings("captions.downloading", "Downloading...")}{" "}
								{Math.round(whisperModelDownloadProgress ?? 0)}%
							</Button>
						) : whisperModelPath ? (
							<Button
								type="button"
								variant="outline"
								onClick={onDeleteWhisperSmallModel}
								className="h-10 w-full rounded-xl border-foreground/10 bg-foreground/5 px-4 text-sm text-foreground hover:bg-foreground/10 hover:text-foreground"
							>
								{tSettings("captions.deleteModel", "Delete Model")}
							</Button>
						) : (
							<Button
								type="button"
								onClick={onDownloadWhisperSmallModel}
								className="h-10 w-full rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white hover:bg-[#2563EB]/90"
							>
								{tSettings("captions.downloadModel", "Download Model")}
							</Button>
						)}
						<Button
							type="button"
							variant="outline"
							onClick={onClearAutoCaptions}
							disabled={captionCueCount === 0}
							className="h-10 w-full rounded-xl border-foreground/10 bg-foreground/5 px-4 text-sm text-foreground hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
						>
							{tSettings("captions.clearFull", "Clear Captions")}
						</Button>
					</div>
					<div className="flex items-center justify-between text-[11px] text-muted-foreground/80 pt-1 px-0.5">
						<div className="flex items-center gap-1.5 truncate">
							<span
								className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${whisperModelPath ? "bg-emerald-500" : "bg-amber-500"}`}
							/>
							<span className="truncate">
								{whisperModelPath
									? whisperModelPath.split(/[\\/]/).pop()
									: tSettings("captions.noModelLoaded", "Belum ada model aktif")}
							</span>
						</div>
						<span className="shrink-0 text-emerald-400 font-medium">
							ID & Multilingual
						</span>
					</div>
				</div>
				<div className="flex flex-col gap-2">
					<Button
						type="button"
						onClick={onGenerateAutoCaptions}
						disabled={isGeneratingCaptions || !whisperModelPath}
						className="h-10 w-full rounded-xl bg-[#2563EB] px-4 text-sm font-medium text-white hover:bg-[#2563EB]/90 disabled:opacity-60"
					>
						{isGeneratingCaptions
							? tSettings("captions.generating", "Generating...")
							: (captionCueCount ?? 0) > 0
								? tSettings("captions.regenerateFull", "Regenerate Captions")
								: tSettings("captions.generateFull", "Generate Captions")}
					</Button>
					{isGeneratingCaptions ? (
						<div className="space-y-1">
							<div className="text-xs text-muted-foreground">
								{tSettings(
									"captions.generatingStatus",
									"Generating captions. This can take a moment.",
								)}
							</div>
							<div className="indeterminate-progress h-2 rounded-full bg-foreground/5" />
						</div>
					) : null}
				</div>
				{whisperModelDownloadStatus === "downloading" ? (
					<div className="h-2 overflow-hidden rounded-full bg-foreground/5">
						<div
							className="h-full rounded-full bg-[#2196f3] transition-all"
							style={{ width: `${whisperModelDownloadProgress}%` }}
						/>
					</div>
				) : null}
			</div>

			<div className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<div className="text-[10px] text-muted-foreground">
						{tSettings("captions.highlightStyle", "Highlight Style")}
					</div>
					<Select
						value={autoCaptionSettings.highlightStyle || "karaoke-pop"}
						onValueChange={(value) =>
							updateAutoCaptionSettings({
								highlightStyle: value as CaptionHighlightStyle,
							})
						}
					>
						<SelectTrigger className="h-9 w-[170px] rounded-xl border-foreground/10 bg-foreground/5 text-sm text-foreground hover:bg-foreground/10">
							<SelectValue />
						</SelectTrigger>
						<SelectContent className="border-foreground/10 bg-editor-surface-alt text-foreground">
							{CAPTION_HIGHLIGHT_STYLE_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="flex flex-col gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<div className="flex items-center justify-between">
						<span className="text-[10px] text-muted-foreground">
							{tSettings("captions.highlightColor", "Active Word Color")}
						</span>
						<div className="flex items-center gap-1.5">
							{CAPTION_HIGHLIGHT_COLOR_PRESETS.map((preset) => {
								const currentActive = (
									autoCaptionSettings.highlightColor ||
									DEFAULT_AUTO_CAPTION_SETTINGS.highlightColor ||
									"#FFE600"
								).toLowerCase();
								const isSelected = currentActive === preset.value.toLowerCase();
								return (
									<button
										key={preset.value}
										type="button"
										title={preset.name}
										onClick={() =>
											updateAutoCaptionSettings({
												highlightColor: preset.value,
											})
										}
										className={cn(
											"h-5 w-5 rounded-full border transition-transform hover:scale-110",
											isSelected
												? "border-white ring-2 ring-blue-500 scale-110"
												: "border-foreground/20",
										)}
										style={{ backgroundColor: preset.value }}
									/>
								);
							})}
							<input
								type="color"
								value={
									autoCaptionSettings.highlightColor ||
									DEFAULT_AUTO_CAPTION_SETTINGS.highlightColor ||
									"#FFE600"
								}
								onChange={(event) =>
									updateAutoCaptionSettings({
										highlightColor: event.target.value,
									})
								}
								className="h-6 w-6 rounded border border-foreground/10 bg-transparent cursor-pointer ml-1"
								title="Custom highlight color"
							/>
						</div>
					</div>
				</div>

				<div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<span className="text-[10px] text-muted-foreground">
						{tSettings("captions.uppercase", "Uppercase (ALL CAPS)")}
					</span>
					<Switch
						checked={Boolean(autoCaptionSettings.uppercase)}
						onCheckedChange={(uppercase) => updateAutoCaptionSettings({ uppercase })}
						className="data-[state=checked]:bg-[#2563EB] scale-75"
					/>
				</div>

				<div className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<div className="text-[10px] text-muted-foreground">
						{tSettings("captions.animation", "Animation")}
					</div>
					<Select
						value={autoCaptionSettings.animationStyle}
						onValueChange={(value) =>
							updateAutoCaptionSettings({
								animationStyle: value as AutoCaptionAnimation,
							})
						}
					>
						<SelectTrigger className="h-9 w-[160px] rounded-xl border-foreground/10 bg-foreground/5 text-sm text-foreground hover:bg-foreground/10">
							<SelectValue />
						</SelectTrigger>
						<SelectContent className="border-foreground/10 bg-editor-surface-alt text-foreground">
							{CAPTION_ANIMATION_OPTIONS.map((option) => (
								<SelectItem key={option.value} value={option.value}>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<label className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<span className="text-[10px] text-muted-foreground">
						{tSettings("captions.textColor", "Text color")}
					</span>
					<input
						type="color"
						value={autoCaptionSettings.textColor}
						onChange={(event) =>
							updateAutoCaptionSettings({ textColor: event.target.value })
						}
						className="h-7 w-10 rounded border border-foreground/10 bg-transparent"
					/>
				</label>
				<label className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<span className="text-[10px] text-muted-foreground">
						{tSettings("captions.inactiveTextColor", "Inactive word color")}
					</span>
					<input
						type="color"
						value={autoCaptionSettings.inactiveTextColor || "#A3A3A3"}
						onChange={(event) =>
							updateAutoCaptionSettings({ inactiveTextColor: event.target.value })
						}
						className="h-7 w-10 rounded border border-foreground/10 bg-transparent cursor-pointer"
					/>
				</label>
				<div className="mb-1 text-sm font-medium text-foreground">
					{tSettings("captions.fontSettings", "Font Settings")}
				</div>
				<SliderControl
					label={tSettings("captions.fontSize", "Font size")}
					value={autoCaptionSettings.fontSize}
					defaultValue={DEFAULT_AUTO_CAPTION_SETTINGS.fontSize}
					min={16}
					max={72}
					step={1}
					onChange={(value) => updateAutoCaptionSettings({ fontSize: value })}
					formatValue={(value) => `${Math.round(value)}px`}
					parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
				/>
				<SliderControl
					label={tSettings("captions.rowCount", "Rows")}
					value={autoCaptionSettings.maxRows}
					defaultValue={DEFAULT_AUTO_CAPTION_SETTINGS.maxRows}
					min={1}
					max={4}
					step={1}
					onChange={(value) => updateAutoCaptionSettings({ maxRows: Math.round(value) })}
					formatValue={(value) => `${Math.round(value)}`}
					parseInput={(text) => parseFloat(text)}
				/>
				<SliderControl
					label={tSettings("captions.bottomOffset", "Bottom offset")}
					value={autoCaptionSettings.bottomOffset}
					defaultValue={DEFAULT_AUTO_CAPTION_SETTINGS.bottomOffset}
					min={0}
					max={30}
					step={1}
					onChange={(value) => updateAutoCaptionSettings({ bottomOffset: value })}
					formatValue={(value) => `${Math.round(value)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
				/>
				<SliderControl
					label={tSettings("captions.maxWidth", "Max width")}
					value={autoCaptionSettings.maxWidth}
					defaultValue={DEFAULT_AUTO_CAPTION_SETTINGS.maxWidth}
					min={40}
					max={95}
					step={1}
					onChange={(value) => updateAutoCaptionSettings({ maxWidth: value })}
					formatValue={(value) => `${Math.round(value)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
				/>
				<SliderControl
					label={tSettings("captions.boxRadius", "Box radius")}
					value={autoCaptionSettings.boxRadius}
					defaultValue={DEFAULT_AUTO_CAPTION_SETTINGS.boxRadius}
					min={0}
					max={40}
					step={0.5}
					onChange={(value) => updateAutoCaptionSettings({ boxRadius: value })}
					formatValue={(value) =>
						`${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}px`
					}
					parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
				/>
				<SliderControl
					label={tSettings("captions.backgroundOpacity", "Background opacity")}
					value={autoCaptionSettings.backgroundOpacity}
					defaultValue={DEFAULT_AUTO_CAPTION_SETTINGS.backgroundOpacity}
					min={0}
					max={1}
					step={0.01}
					onChange={(value) => updateAutoCaptionSettings({ backgroundOpacity: value })}
					formatValue={(value) => `${Math.round(value * 100)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, "")) / 100}
				/>
				{renderExtensionPanelsForSections?.("captions")}
			</div>
		</section>
	);
};
