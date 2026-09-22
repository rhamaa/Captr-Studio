import React from "react";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { SliderControl } from "../../SliderControl";
import type { CursorStyle } from "../../types";
import {
	DEFAULT_CAMERA_PERSPECTIVE_TILT,
	DEFAULT_CURSOR_CLICK_BOUNCE,
	DEFAULT_CURSOR_CLICK_BOUNCE_DURATION,
	DEFAULT_CURSOR_MOTION_BLUR,
	DEFAULT_CURSOR_SIZE,
	DEFAULT_CURSOR_SWAY,
} from "../../types";
import { fromCursorSwaySliderValue, toCursorSwaySliderValue } from "../../videoPlayback/cursorSway";
import { CursorStylePreview } from "../components/CursorStylePreview";
import { SectionLabel } from "../components/SettingsSectionLabel";

export interface CursorStyleOption {
	value: CursorStyle;
	label: string;
}

export interface CursorSectionProps {
	showCursor: boolean;
	onShowCursorChange?: (show: boolean) => void;
	loopCursor: boolean;
	onLoopCursorChange?: (loop: boolean) => void;
	cursorStyle: CursorStyle;
	onCursorStyleChange?: (style: CursorStyle) => void;
	cursorStyleOptions: CursorStyleOption[];
	cursorPreviewUrls: Partial<Record<string, string>>;
	cursorSize: number;
	onCursorSizeChange?: (size: number) => void;
	cursorSmoothing?: number;
	onCursorSmoothingChange?: (smoothing: number) => void;
	cursorMotionBlur: number;
	onCursorMotionBlurChange?: (blur: number) => void;
	cursorClickBounce: number;
	onCursorClickBounceChange?: (bounce: number) => void;
	cursorClickBounceDuration: number;
	onCursorClickBounceDurationChange?: (duration: number) => void;
	cursorSway: number;
	onCursorSwayChange?: (sway: number) => void;
	cameraPerspectiveTilt?: number;
	onCameraPerspectiveTiltChange?: (tilt: number) => void;
	resetCursorSection: () => void;
	showDevMotionControls?: boolean;
	renderExtensionPanelsForSections?: (...sections: string[]) => React.ReactNode;
	renderExtensionPanels?: (section: string) => React.ReactNode;
	initialEditorPreferences?: unknown;
	tSettings: (key: string, fallback?: string) => string;
	t: (key: string, fallback?: string) => string;
}

export function CursorSection({
	showCursor,
	onShowCursorChange,
	loopCursor,
	onLoopCursorChange,
	cursorStyle,
	onCursorStyleChange,
	cursorStyleOptions,
	cursorPreviewUrls,
	cursorSize,
	onCursorSizeChange,
	cursorSmoothing,
	onCursorSmoothingChange,
	cursorMotionBlur,
	onCursorMotionBlurChange,
	cursorClickBounce,
	onCursorClickBounceChange,
	cursorClickBounceDuration,
	onCursorClickBounceDurationChange,
	cursorSway,
	onCursorSwayChange,
	cameraPerspectiveTilt,
	onCameraPerspectiveTiltChange,
	resetCursorSection,
	showDevMotionControls,
	renderExtensionPanelsForSections,
	renderExtensionPanels,
	tSettings,
	t,
}: CursorSectionProps) {
	return (
		<section className="flex flex-col gap-2">
			<div className="flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<SectionLabel>{tSettings("sections.cursor", "Cursor")}</SectionLabel>
					<button
						type="button"
						onClick={resetCursorSection}
						className="text-[10px] text-[#2563EB] transition-opacity hover:opacity-80"
					>
						{t("common.actions.reset", "Reset")}
					</button>
				</div>
				<div className="flex items-center gap-3">
					<label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
						<span>{tSettings("effects.showCursor")}</span>
						<Switch
							checked={showCursor}
							onCheckedChange={onShowCursorChange}
							className="data-[state=checked]:bg-[#2563EB] scale-75"
						/>
					</label>
					<label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
						<span>{tSettings("effects.loopCursor")}</span>
						<Switch
							checked={loopCursor}
							onCheckedChange={onLoopCursorChange}
							className="data-[state=checked]:bg-[#2563EB] scale-75"
						/>
					</label>
				</div>
			</div>
			<div className="flex flex-col gap-1.5">
				<div className="space-y-1.5">
					<ToggleGroup
						type="single"
						value={cursorStyle}
						onValueChange={(value) => {
							if (value) {
								onCursorStyleChange?.(value as CursorStyle);
							}
						}}
						className="grid grid-cols-4 gap-2"
						aria-label={tSettings("effects.cursorStyle", "Cursor Style")}
					>
						{cursorStyleOptions.map((option) => (
							<ToggleGroupItem
								key={option.value}
								value={option.value}
								title={option.label}
								aria-label={option.label}
								className={cn(
									"group aspect-square h-auto min-w-0 rounded-[10px] border border-foreground/10 bg-foreground/[0.03] p-3 text-left text-foreground shadow-none transition-all hover:border-foreground/20 hover:bg-foreground/[0.06]",
									"data-[state=on]:border-[#2563EB]/70 data-[state=on]:bg-[#2563EB]/12 data-[state=on]:text-foreground",
								)}
							>
								<div className="flex h-full flex-col items-center justify-between gap-3">
									<div className="flex min-h-0 flex-1 items-center justify-center rounded-lg px-2 py-1.5">
										<CursorStylePreview
											style={option.value}
											previewUrls={cursorPreviewUrls}
										/>
									</div>
								</div>
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</div>
				<SliderControl
					label={tSettings("effects.cursorSize")}
					value={cursorSize}
					defaultValue={DEFAULT_CURSOR_SIZE}
					min={0.5}
					max={10}
					step={0.05}
					onChange={(v: number) => onCursorSizeChange?.(v)}
					formatValue={(v: number) => `${v.toFixed(2)}×`}
					parseInput={(text: string) => parseFloat(text.replace(/×$/, ""))}
				/>
				{onCursorSmoothingChange && (
					<SliderControl
						label={tSettings("effects.cursorSmoothing", "Cursor Smoothing")}
						value={cursorSmoothing ?? 0.67}
						defaultValue={0.67}
						min={0}
						max={1}
						step={0.01}
						onChange={(v: number) => onCursorSmoothingChange(v)}
						formatValue={(v: number) => `${Math.round(v * 100)}%`}
						parseInput={(text: string) => parseFloat(text.replace(/%$/, "")) / 100}
					/>
				)}
				<SliderControl
					label={tSettings("effects.cursorMotionBlur")}
					value={cursorMotionBlur}
					defaultValue={DEFAULT_CURSOR_MOTION_BLUR}
					min={0}
					max={2}
					step={0.05}
					onChange={(v: number) => onCursorMotionBlurChange?.(v)}
					formatValue={(v: number) => `${v.toFixed(2)}×`}
					parseInput={(text: string) => parseFloat(text.replace(/×$/, ""))}
				/>
				<SliderControl
					label={tSettings("effects.cursorClickBounce")}
					value={cursorClickBounce}
					defaultValue={DEFAULT_CURSOR_CLICK_BOUNCE}
					min={0}
					max={5}
					step={0.05}
					onChange={(v: number) => onCursorClickBounceChange?.(v)}
					formatValue={(v: number) => `${v.toFixed(2)}×`}
					parseInput={(text: string) => parseFloat(text.replace(/×$/, ""))}
				/>
				<SliderControl
					label={tSettings("effects.cursorClickBounceDuration", "Bounce Speed")}
					value={cursorClickBounceDuration}
					defaultValue={DEFAULT_CURSOR_CLICK_BOUNCE_DURATION}
					min={60}
					max={500}
					step={5}
					onChange={(v: number) => onCursorClickBounceDurationChange?.(v)}
					formatValue={(v: number) => `${Math.round(v)} ms`}
					parseInput={(text: string) => parseFloat(text.replace(/ms$/i, "").trim())}
				/>
				<SliderControl
					label={tSettings("effects.cursorSway")}
					value={toCursorSwaySliderValue(cursorSway)}
					defaultValue={toCursorSwaySliderValue(DEFAULT_CURSOR_SWAY)}
					min={0}
					max={toCursorSwaySliderValue(2)}
					step={toCursorSwaySliderValue(0.05)}
					onChange={(v: number) => onCursorSwayChange?.(fromCursorSwaySliderValue(v))}
					formatValue={(v: number) =>
						v <= 0 ? tSettings("effects.off") : `${v.toFixed(2)}×`
					}
					parseInput={(text: string) => {
						const normalized = text.trim().toLowerCase();
						if (normalized === "off") return 0;
						return parseFloat(text.replace(/×$/, ""));
					}}
				/>
				<SliderControl
					label={tSettings("effects.perspectiveTilt", "3D Perspective Tilt")}
					value={Math.round((cameraPerspectiveTilt ?? 0) * 100)}
					defaultValue={Math.round(DEFAULT_CAMERA_PERSPECTIVE_TILT * 100)}
					min={0}
					max={100}
					step={5}
					onChange={(v: number) => onCameraPerspectiveTiltChange?.(v / 100)}
					formatValue={(v: number) =>
						v <= 0 ? tSettings("effects.off", "Off") : `${Math.round(v)}%`
					}
					parseInput={(text: string) => {
						const normalized = text.trim().toLowerCase();
						if (normalized === "off") return 0;
						return parseFloat(text.replace(/%$/, ""));
					}}
				/>
				{showDevMotionControls ? (
					<div className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-3 py-2">
						<div className="text-[10px] text-muted-foreground">
							{tSettings(
								"effects.cursorDebugMovedToDev",
								"Cursor spring tuning is available in Settings > Dev.",
							)}
						</div>
					</div>
				) : null}
			</div>
			{renderExtensionPanelsForSections
				? renderExtensionPanelsForSections("cursor")
				: renderExtensionPanels?.("cursor")}
		</section>
	);
}
