import React from "react";
import { cn } from "@/lib/utils";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { SliderControl } from "../../SliderControl";
import { SectionLabel } from "../components/SettingsSectionLabel";
import type { Padding } from "../../types";
import { ClipItemSection, type ClipItemSectionProps } from "./ClipItemSection";

export interface VideoAdjustSectionProps extends ClipItemSectionProps {
	aspectRatio?: AspectRatio;
	onAspectRatioChange?: (ratio: AspectRatio) => void;
	padding?: Padding;
	onPaddingChange?: (padding: Padding) => void;
	borderRadius?: number;
	onBorderRadiusChange?: (radius: number) => void;
	shadowIntensity?: number;
	onShadowChange?: (shadow: number) => void;
}

export const VideoAdjustSection: React.FC<VideoAdjustSectionProps> = ({
	aspectRatio,
	onAspectRatioChange,
	padding,
	onPaddingChange,
	borderRadius = 12,
	onBorderRadiusChange,
	shadowIntensity = 0.5,
	onShadowChange,
	tSettings,
	t,
	...clipProps
}) => {
	return (
		<section className="flex flex-col gap-3">
			<div>
				<SectionLabel>{tSettings("sections.videoAdjust", "Transform & Adjust")}</SectionLabel>
				<p className="mt-0.5 text-[10px] text-muted-foreground">
					{tSettings(
						"videoAdjust.description",
						"Playback speed, aspect ratio, padding framing & crop",
					)}
				</p>
			</div>

			{/* Speed controls */}
			<ClipItemSection tSettings={tSettings} t={t} {...clipProps} />

			{/* Aspect ratio & Framing */}
			<div className="pt-2 border-t border-foreground/10">
				<div className="flex items-center justify-between mb-2">
					<SectionLabel>{tSettings("scene.aspectRatio", "Canvas Ratio")}</SectionLabel>
				</div>
				<div className="grid grid-cols-3 gap-1.5">
					{[
						{ ratio: "16:9" as const, label: "16:9 (Landscape)" },
						{ ratio: "9:16" as const, label: "9:16 (Portrait / Reel)" },
						{ ratio: "1:1" as const, label: "1:1 (Square)" },
						{ ratio: "4:3" as const, label: "4:3 (Classic)" },
						{ ratio: "4:5" as const, label: "4:5 (Post)" },
						{ ratio: "native" as const, label: "Auto (Source)" },
					].map((opt) => (
						<button
							key={opt.ratio}
							type="button"
							onClick={() => onAspectRatioChange?.(opt.ratio)}
							className={cn(
								"px-2 py-1.5 rounded-lg border text-left text-xs font-semibold transition-all cursor-pointer",
								aspectRatio === opt.ratio
									? "border-primary bg-primary/10 text-primary shadow-xs"
									: "border-foreground/10 bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
							)}
						>
							{opt.label}
						</button>
					))}
				</div>
			</div>

			{/* Padding & Frame Scale */}
			<div className="pt-2 border-t border-foreground/10">
				<SliderControl
					label={tSettings("scene.padding", "Framing Padding")}
					value={padding?.left ?? 20}
					defaultValue={20}
					min={0}
					max={120}
					step={2}
					onChange={(val: number) =>
						onPaddingChange?.({
							top: val,
							bottom: val,
							left: val,
							right: val,
							linked: true,
						})
					}
					formatValue={(v: number) => `${v}px`}
					parseInput={(text: string) => parseInt(text.replace(/px$/, ""), 10) || 0}
				/>
			</div>

			{/* Corner Radius & Shadow */}
			<div className="pt-2 border-t border-foreground/10 space-y-2">
				<SliderControl
					label={tSettings("scene.borderRadius", "Corner Radius")}
					value={borderRadius ?? 12}
					defaultValue={12}
					min={0}
					max={48}
					step={1}
					onChange={(val: number) => onBorderRadiusChange?.(val)}
					formatValue={(v: number) => `${v}px`}
					parseInput={(text: string) => parseInt(text.replace(/px$/, ""), 10) || 0}
				/>
				<SliderControl
					label={tSettings("scene.shadow", "Shadow Intensity")}
					value={shadowIntensity ?? 0.5}
					defaultValue={0.5}
					min={0}
					max={1}
					step={0.02}
					onChange={(val: number) => onShadowChange?.(val)}
					formatValue={(v: number) => `${Math.round(v * 100)}%`}
					parseInput={(text: string) => parseFloat(text.replace(/%$/, "")) / 100}
				/>
			</div>
		</section>
	);
};
