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
import type { AppLocale } from "@/i18n/config";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import { KeyboardShortcutsDialog } from "../../TutorialHelp";
import { SliderControl } from "../../SliderControl";
import { SectionLabel } from "../components/SettingsSectionLabel";
import { MotionPresetCards } from "../components/MotionPresetCards";
import type { CursorMotionPresetId } from "../../cursorMotionPresets";
import type { ZoomMotionBlurTuning } from "../../types";
import type { loadEditorPreferences } from "../../editorPreferences";

export const APP_LANGUAGE_LABELS: Record<AppLocale, string> = {
	en: "English",
	es: "Español",
	fr: "Français",
	it: "Italiano",
	nl: "Nederlands",
	ko: "한국어",
	"pt-BR": "Português",
	"zh-CN": "簡體中文",
	"zh-TW": "繁體中文",
};

export interface GeneralPreferencesSectionProps {
	themePreference: string;
	setThemePreference: (pref: "light" | "dark" | "system") => void;
	locale: AppLocale;
	setLocale: (locale: AppLocale) => void;
	autoApplyFreshRecordingAutoZooms: boolean;
	onAutoApplyFreshRecordingAutoZoomsChange?: (checked: boolean) => void;
	connectZooms: boolean;
	onConnectZoomsChange?: (checked: boolean) => void;
	activeMotionPresetId: CursorMotionPresetId | null;
	applyMotionPreset: (presetId: CursorMotionPresetId) => void;
	showDevMotionControls: boolean;
	nativeCaptureUnavailableSession: boolean;
	onOpenNativeCaptureUnavailableModal?: () => void;
	zoomMotionBlurTuning: ZoomMotionBlurTuning;
	onZoomMotionBlurTuningChange?: (tuning: ZoomMotionBlurTuning) => void;
	initialEditorPreferences: ReturnType<typeof loadEditorPreferences>;
	cameraSpringStiffnessMultiplier: number;
	onCameraSpringStiffnessMultiplierChange?: (value: number) => void;
	cameraSpringDampingMultiplier: number;
	onCameraSpringDampingMultiplierChange?: (value: number) => void;
	cameraSpringMassMultiplier: number;
	onCameraSpringMassMultiplierChange?: (value: number) => void;
	cursorSpringStiffnessMultiplier: number;
	onCursorSpringStiffnessMultiplierChange?: (value: number) => void;
	cursorSpringDampingMultiplier: number;
	onCursorSpringDampingMultiplierChange?: (value: number) => void;
	cursorSpringMassMultiplier: number;
	onCursorSpringMassMultiplierChange?: (value: number) => void;
	tSettings: (key: string, fallback?: string) => string;
	t: (key: string, fallback?: string) => string;
}

export const GeneralPreferencesSection: React.FC<GeneralPreferencesSectionProps> = ({
	themePreference,
	setThemePreference,
	locale,
	setLocale,
	autoApplyFreshRecordingAutoZooms,
	onAutoApplyFreshRecordingAutoZoomsChange,
	connectZooms,
	onConnectZoomsChange,
	activeMotionPresetId,
	applyMotionPreset,
	showDevMotionControls,
	nativeCaptureUnavailableSession,
	onOpenNativeCaptureUnavailableModal,
	zoomMotionBlurTuning,
	onZoomMotionBlurTuningChange,
	initialEditorPreferences,
	cameraSpringStiffnessMultiplier,
	onCameraSpringStiffnessMultiplierChange,
	cameraSpringDampingMultiplier,
	onCameraSpringDampingMultiplierChange,
	cameraSpringMassMultiplier,
	onCameraSpringMassMultiplierChange,
	cursorSpringStiffnessMultiplier,
	onCursorSpringStiffnessMultiplierChange,
	cursorSpringDampingMultiplier,
	onCursorSpringDampingMultiplierChange,
	cursorSpringMassMultiplier,
	onCursorSpringMassMultiplierChange,
	tSettings,
	t,
}) => {
	return (
		<div className="space-y-4">
			<section className="flex flex-col gap-2">
				<SectionLabel>{t("editor.theme.appearance", "Appearance")}</SectionLabel>
				<div className="flex rounded-lg border border-foreground/10 bg-foreground/5 p-0.5">
					{(
						[
							{ value: "light", label: t("editor.theme.light", "Light") },
							{ value: "dark", label: t("editor.theme.dark", "Dark") },
							{ value: "system", label: t("editor.theme.system", "System") },
						] as const
					).map((option) => (
						<button
							key={option.value}
							type="button"
							onClick={() => setThemePreference(option.value)}
							className={cn(
								"flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
								themePreference === option.value
									? "bg-neutral-800 text-white shadow-sm dark:bg-white dark:text-black"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{option.label}
						</button>
					))}
				</div>
			</section>

			<section className="flex flex-col gap-2">
				<SectionLabel>{t("common.app.language", "Language")}</SectionLabel>
				<Select value={locale} onValueChange={(value) => setLocale(value as AppLocale)}>
					<SelectTrigger className="h-10 w-full rounded-xl border-foreground/10 bg-foreground/5 text-sm text-foreground hover:bg-foreground/10">
						<SelectValue />
					</SelectTrigger>
					<SelectContent className="border-foreground/10 bg-editor-surface-alt text-foreground">
						{SUPPORTED_LOCALES.map((candidateLocale: AppLocale) => (
							<SelectItem key={candidateLocale} value={candidateLocale}>
								{APP_LANGUAGE_LABELS[candidateLocale]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</section>

			<section className="flex flex-col gap-1.5">
				<div className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<div>
						<div className="text-[11px] font-medium text-foreground">
							{tSettings(
								"effects.autoApplyFreshRecordingZooms",
								"Auto-apply fresh recording zooms",
							)}
						</div>
						<div className="mt-0.5 text-[10px] text-muted-foreground/70">
							{tSettings(
								"effects.autoApplyFreshRecordingZoomsDescription",
								"Suggest cursor-follow zooms automatically when you open a new recording.",
							)}
						</div>
					</div>
					<Switch
						checked={autoApplyFreshRecordingAutoZooms}
						onCheckedChange={onAutoApplyFreshRecordingAutoZoomsChange}
						className="data-[state=checked]:bg-[#2563EB] scale-75"
					/>
				</div>
				<div className="flex items-center justify-between gap-3 rounded-lg bg-foreground/[0.03] px-2.5 py-2">
					<div>
						<div className="text-[11px] font-medium text-foreground">
							{tSettings("effects.connectZooms", "Connect neighboring zooms")}
						</div>
						<div className="mt-0.5 text-[10px] text-muted-foreground/70">
							{tSettings(
								"effects.connectZoomsDescription",
								"Smooth consecutive zoom regions into a continuous camera move.",
							)}
						</div>
					</div>
					<Switch
						checked={connectZooms}
						onCheckedChange={onConnectZoomsChange}
						className="data-[state=checked]:bg-[#2563EB] scale-75"
					/>
				</div>
			</section>

			<section className="flex flex-col gap-2">
				<MotionPresetCards
					title={tSettings("effects.motionPresetsTitle", "Motion Presets")}
					activePresetId={activeMotionPresetId}
					onApply={applyMotionPreset}
					tSettings={tSettings}
				/>
			</section>

			<section className="flex flex-col gap-2">
				<SectionLabel>{t("editor.keyboardShortcuts.title")}</SectionLabel>
				<KeyboardShortcutsDialog
					triggerLabel={t("editor.keyboardShortcuts.customize")}
					triggerClassName="h-10 w-full justify-start rounded-xl border border-foreground/10 bg-foreground/5 px-3 text-sm text-foreground hover:bg-foreground/10 hover:text-foreground"
				/>
			</section>

			{showDevMotionControls ? (
				<section className="flex flex-col gap-2 rounded-xl border border-[#2563EB]/15 bg-[#2563EB]/5 p-3">
					<div className="flex items-center justify-between gap-3">
						<div>
							<SectionLabel>
								{tSettings("effects.devSection", "Dev")}
							</SectionLabel>
							<div className="mt-0.5 text-[10px] text-muted-foreground">
								{tSettings(
									"effects.devSectionHint",
									"Temporary testing controls for native capture and motion tuning.",
								)}
							</div>
						</div>
						<span className="rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#2563EB]">
							DEV
						</span>
					</div>

					<div className="rounded-lg border border-foreground/10 bg-background/60 px-3 py-3">
						<div className="flex items-start justify-between gap-3">
							<div>
								<div className="text-[11px] font-medium text-foreground">
									{tSettings(
										"effects.nativeCaptureWarningTester",
										"Native capture warning",
									)}
								</div>
								<div className="mt-0.5 text-[10px] text-muted-foreground">
									{nativeCaptureUnavailableSession
										? tSettings(
												"effects.nativeCaptureWarningTesterUnavailable",
												"This project is currently marked as native capture unavailable.",
											)
										: tSettings(
												"effects.nativeCaptureWarningTesterAvailable",
												"This project is not marked as unsupported, but you can still open the modal for UI testing.",
											)}
								</div>
							</div>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => onOpenNativeCaptureUnavailableModal?.()}
								className="h-8 shrink-0 border-[#2563EB]/20 bg-[#2563EB]/10 text-[#2563EB] hover:bg-[#2563EB]/15"
							>
								{tSettings("effects.openNativeCaptureWarning", "Open warning")}
							</Button>
						</div>
					</div>

					<div className="space-y-1.5 rounded-lg border border-foreground/10 bg-background/60 px-3 py-3">
						<div>
							<div className="text-[11px] font-medium text-foreground">
								{tSettings("effects.motionBlurDebug", "Motion Blur Debug")}
							</div>
							<div className="mt-0.5 text-[10px] text-muted-foreground">
								{tSettings(
									"effects.motionBlurDebugHint",
									"Development-only tuning for the split move-vs-zoom blur path. Pan controls drive the streak filter, and zoom controls drive the focus-centered zoom filter.",
								)}
							</div>
						</div>
						<SliderControl
							label={tSettings("effects.motionBlurPanThreshold", "Pan threshold")}
							value={zoomMotionBlurTuning.panVelocityThreshold}
							defaultValue={
								initialEditorPreferences.zoomMotionBlurTuning
									.panVelocityThreshold
							}
							min={0}
							max={240}
							step={1}
							onChange={(value: number) =>
								onZoomMotionBlurTuningChange?.({
									...zoomMotionBlurTuning,
									panVelocityThreshold: value,
								})
							}
							formatValue={(value: number) => `${Math.round(value)} px/s`}
							parseInput={(text: string) =>
								parseFloat(text.replace(/px\/s$/i, "").trim())
							}
						/>
						<SliderControl
							label={tSettings("effects.motionBlurPanStrength", "Pan max blur")}
							value={zoomMotionBlurTuning.maxDirectionalBlurPx}
							defaultValue={
								initialEditorPreferences.zoomMotionBlurTuning
									.maxDirectionalBlurPx
							}
							min={0}
							max={96}
							step={0.1}
							onChange={(value: number) =>
								onZoomMotionBlurTuningChange?.({
									...zoomMotionBlurTuning,
									maxDirectionalBlurPx: value,
								})
							}
							formatValue={(value: number) => `${value.toFixed(1)} px`}
							parseInput={(text: string) => parseFloat(text.replace(/px$/i, "").trim())}
						/>
						<SliderControl
							label={tSettings(
								"effects.motionBlurZoomThreshold",
								"Zoom threshold",
							)}
							value={zoomMotionBlurTuning.zoomVelocityThreshold}
							defaultValue={
								initialEditorPreferences.zoomMotionBlurTuning
									.zoomVelocityThreshold
							}
							min={0}
							max={0.4}
							step={0.005}
							onChange={(value: number) =>
								onZoomMotionBlurTuningChange?.({
									...zoomMotionBlurTuning,
									zoomVelocityThreshold: value,
								})
							}
							formatValue={(value: number) => value.toFixed(3)}
							parseInput={(text: string) => parseFloat(text)}
						/>
						<SliderControl
							label={tSettings(
								"effects.motionBlurZoomStrength",
								"Zoom blur strength",
							)}
							value={zoomMotionBlurTuning.maxRadialBlurStrength}
							defaultValue={
								initialEditorPreferences.zoomMotionBlurTuning
									.maxRadialBlurStrength
							}
							min={0}
							max={1.5}
							step={0.005}
							onChange={(value: number) =>
								onZoomMotionBlurTuningChange?.({
									...zoomMotionBlurTuning,
									maxRadialBlurStrength: value,
								})
							}
							formatValue={(value: number) => value.toFixed(3)}
							parseInput={(text: string) => parseFloat(text)}
						/>
					</div>

					<div className="space-y-1.5 rounded-lg border border-foreground/10 bg-background/60 px-3 py-3">
						<div>
							<div className="text-[11px] font-medium text-foreground">
								{tSettings("effects.cameraDebugTuning", "Camera Debug Tuning")}
							</div>
							<div className="mt-0.5 text-[10px] text-muted-foreground">
								{tSettings(
									"effects.cameraDebugTuningHint",
									"Development-only spring tuning controls for camera motion.",
								)}
							</div>
						</div>
						<SliderControl
							label={tSettings(
								"effects.cameraSpringStiffnessMultiplier",
								"Camera stiffness",
							)}
							value={cameraSpringStiffnessMultiplier}
							defaultValue={
								initialEditorPreferences.cameraSpringStiffnessMultiplier
							}
							min={0.25}
							max={3}
							step={0.01}
							onChange={(value: number) =>
								onCameraSpringStiffnessMultiplierChange?.(value)
							}
							formatValue={(value: number) => `${value.toFixed(2)}×`}
							parseInput={(text: string) => parseFloat(text.replace(/×$/, ""))}
						/>
						<SliderControl
							label={tSettings(
								"effects.cameraSpringDampingMultiplier",
								"Camera damping",
							)}
							value={cameraSpringDampingMultiplier}
							defaultValue={
								initialEditorPreferences.cameraSpringDampingMultiplier
							}
							min={0.25}
							max={3}
							step={0.01}
							onChange={(value: number) => onCameraSpringDampingMultiplierChange?.(value)}
							formatValue={(value: number) => `${value.toFixed(2)}×`}
							parseInput={(text: string) => parseFloat(text.replace(/×$/, ""))}
						/>
						<SliderControl
							label={tSettings(
								"effects.cameraSpringMassMultiplier",
								"Camera mass",
							)}
							value={cameraSpringMassMultiplier}
							defaultValue={initialEditorPreferences.cameraSpringMassMultiplier}
							min={0.25}
							max={3}
							step={0.01}
							onChange={(value: number) => onCameraSpringMassMultiplierChange?.(value)}
							formatValue={(value: number) => `${value.toFixed(2)}×`}
							parseInput={(text: string) => parseFloat(text.replace(/×$/, ""))}
						/>
					</div>

					<div className="space-y-1.5 rounded-lg border border-foreground/10 bg-background/60 px-3 py-3">
						<div>
							<div className="text-[11px] font-medium text-foreground">
								{tSettings("effects.cursorDebugTuning", "Cursor Debug Tuning")}
							</div>
							<div className="mt-0.5 text-[10px] text-muted-foreground">
								{tSettings(
									"effects.cursorDebugTuningHint",
									"Development-only spring tuning controls.",
								)}
							</div>
						</div>
						<SliderControl
							label={tSettings(
								"effects.cursorSpringStiffnessMultiplier",
								"Spring stiffness",
							)}
							value={cursorSpringStiffnessMultiplier}
							defaultValue={
								initialEditorPreferences.cursorSpringStiffnessMultiplier
							}
							min={0.25}
							max={3}
							step={0.01}
							onChange={(value: number) =>
								onCursorSpringStiffnessMultiplierChange?.(value)
							}
							formatValue={(value: number) => `${value.toFixed(2)}×`}
							parseInput={(text: string) => parseFloat(text.replace(/×$/, ""))}
						/>
						<SliderControl
							label={tSettings(
								"effects.cursorSpringDampingMultiplier",
								"Spring damping",
							)}
							value={cursorSpringDampingMultiplier}
							defaultValue={
								initialEditorPreferences.cursorSpringDampingMultiplier
							}
							min={0.25}
							max={3}
							step={0.01}
							onChange={(value: number) => onCursorSpringDampingMultiplierChange?.(value)}
							formatValue={(value: number) => `${value.toFixed(2)}×`}
							parseInput={(text: string) => parseFloat(text.replace(/×$/, ""))}
						/>
						<SliderControl
							label={tSettings(
								"effects.cursorSpringMassMultiplier",
								"Spring mass",
							)}
							value={cursorSpringMassMultiplier}
							defaultValue={initialEditorPreferences.cursorSpringMassMultiplier}
							min={0.25}
							max={3}
							step={0.01}
							onChange={(value: number) => onCursorSpringMassMultiplierChange?.(value)}
							formatValue={(value: number) => `${value.toFixed(2)}×`}
							parseInput={(text: string) => parseFloat(text.replace(/×$/, ""))}
						/>
					</div>
				</section>
			) : null}
		</div>
	);
};
