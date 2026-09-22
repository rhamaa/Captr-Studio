import { cn } from "@/lib/utils";
import { COLOR_FILTER_PRESETS } from "../../colorGrading";
import { SliderControl } from "../../SliderControl";
import { type ColorGradingSettings, DEFAULT_COLOR_GRADING } from "../../types";
import { SectionLabel } from "../components/SettingsSectionLabel";

export interface ColorGradingSectionProps {
	colorGrading?: ColorGradingSettings;
	onColorGradingChange?: (colorGrading: ColorGradingSettings) => void;
	borderRadius?: number;
	onBorderRadiusChange?: (radius: number) => void;
	tSettings: (key: string, fallback?: string) => string;
	t?: (key: string, fallback?: string) => string;
}

export function ColorGradingSection({
	colorGrading,
	onColorGradingChange,
	borderRadius = 12.5,
	onBorderRadiusChange,
	tSettings,
	t = (_k, fallback) => fallback ?? "",
}: ColorGradingSectionProps) {
	return (
		<div className="space-y-4">
			<section className="flex flex-col gap-2">
				<div className="flex items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<SectionLabel>
							{tSettings("colorGrading.title", "Color Grading & Filters")}
						</SectionLabel>
						<button
							type="button"
							onClick={() => onColorGradingChange?.(DEFAULT_COLOR_GRADING)}
							className="text-[10px] text-[#06b6d4] transition-opacity hover:opacity-80 cursor-pointer"
						>
							{t("common.actions.reset", "Reset")}
						</button>
					</div>
				</div>

				{/* Presets Grid */}
				<div className="flex items-center gap-3 mt-1">
					<SectionLabel>
						{tSettings("colorGrading.presets", "Style Presets")}
					</SectionLabel>
				</div>
				<div className="grid grid-cols-2 gap-2">
					{COLOR_FILTER_PRESETS.map((preset) => {
						const isActive = (colorGrading?.preset ?? "none") === preset.id;
						return (
							<button
								key={preset.id}
								type="button"
								onClick={() =>
									onColorGradingChange?.({
										...(colorGrading ?? DEFAULT_COLOR_GRADING),
										preset: preset.id,
									})
								}
								className={cn(
									"group flex flex-col items-start p-2.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden",
									isActive
										? "border-[#06b6d4] bg-[#06b6d4]/10 shadow-sm"
										: "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.06] hover:border-foreground/20",
								)}
							>
								<div className="flex items-center gap-2 w-full mb-1">
									<span
										className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-sm shrink-0"
										style={{ background: preset.previewGradient }}
									/>
									<span className="text-xs font-semibold truncate text-foreground">
										{preset.name}
									</span>
								</div>
								<span className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
									{preset.description}
								</span>
							</button>
						);
					})}
				</div>
			</section>

			{/* Manual Adjustments */}
			<section className="flex flex-col gap-2 pt-2 border-t border-foreground/10">
				<SectionLabel>
					{tSettings("colorGrading.adjustments", "Manual Adjustments")}
				</SectionLabel>

				<SliderControl
					label={tSettings("colorGrading.exposure", "Exposure")}
					value={colorGrading?.exposure ?? 0}
					defaultValue={0}
					min={-100}
					max={100}
					step={1}
					onChange={(v) =>
						onColorGradingChange?.({
							...(colorGrading ?? DEFAULT_COLOR_GRADING),
							exposure: v,
						})
					}
					formatValue={(v) => (v > 0 ? `+${Math.round(v)}%` : `${Math.round(v)}%`)}
					parseInput={(text) => parseFloat(text.replace(/[%+]/g, ""))}
					accentColor="blue"
				/>

				<SliderControl
					label={tSettings("colorGrading.contrast", "Contrast")}
					value={colorGrading?.contrast ?? 0}
					defaultValue={0}
					min={-100}
					max={100}
					step={1}
					onChange={(v) =>
						onColorGradingChange?.({
							...(colorGrading ?? DEFAULT_COLOR_GRADING),
							contrast: v,
						})
					}
					formatValue={(v) => (v > 0 ? `+${Math.round(v)}%` : `${Math.round(v)}%`)}
					parseInput={(text) => parseFloat(text.replace(/[%+]/g, ""))}
					accentColor="blue"
				/>

				<SliderControl
					label={tSettings("colorGrading.saturation", "Saturation")}
					value={colorGrading?.saturation ?? 0}
					defaultValue={0}
					min={-100}
					max={100}
					step={1}
					onChange={(v) =>
						onColorGradingChange?.({
							...(colorGrading ?? DEFAULT_COLOR_GRADING),
							saturation: v,
						})
					}
					formatValue={(v) => (v > 0 ? `+${Math.round(v)}%` : `${Math.round(v)}%`)}
					parseInput={(text) => parseFloat(text.replace(/[%+]/g, ""))}
					accentColor="blue"
				/>

				<SliderControl
					label={tSettings("colorGrading.vignette", "Vignette")}
					value={colorGrading?.vignette ?? 0}
					defaultValue={0}
					min={0}
					max={100}
					step={1}
					onChange={(v) =>
						onColorGradingChange?.({
							...(colorGrading ?? DEFAULT_COLOR_GRADING),
							vignette: v,
						})
					}
					formatValue={(v) => `${Math.round(v)}%`}
					parseInput={(text) => parseFloat(text.replace(/%$/, ""))}
					accentColor="blue"
				/>

				<SliderControl
					label={tSettings("colorGrading.rounding", "Corner Rounding")}
					value={borderRadius}
					defaultValue={12.5}
					min={0}
					max={50}
					step={0.5}
					onChange={(v) => onBorderRadiusChange?.(v)}
					formatValue={(v) => `${v.toFixed(1)}px`}
					parseInput={(text) => parseFloat(text.replace(/px$/, ""))}
					accentColor="blue"
				/>
			</section>
		</div>
	);
}
