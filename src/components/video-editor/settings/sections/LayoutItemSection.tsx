import React from "react";
import { SquaresFour as LayoutIcon } from "@phosphor-icons/react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SliderControl } from "../../SliderControl";
import { SectionLabel } from "../components/SettingsSectionLabel";
import {
	getLayoutSceneCategory,
	LAYOUT_SCENE_CATEGORIES,
	LAYOUT_SCENE_CATEGORY_DETAILS,
} from "../../layoutScenes";
import type { LayoutSceneEasing, LayoutScenePreset } from "../../types";

export interface LayoutItemSectionProps {
	selectedLayoutId?: string | null;
	selectedLayoutPreset?: LayoutScenePreset | null;
	selectedLayoutTransitionMs?: number | null;
	selectedLayoutEasing?: LayoutSceneEasing | null;
	onLayoutPresetChange?: (preset: LayoutScenePreset) => void;
	onLayoutTransitionChange?: (transitionMs: number) => void;
	onLayoutEasingChange?: (easing: LayoutSceneEasing) => void;
	tSettings: (key: string, fallback?: string) => string;
	t: (key: string, fallback?: string) => string;
}

export const LayoutItemSection: React.FC<LayoutItemSectionProps> = ({
	selectedLayoutId,
	selectedLayoutPreset,
	selectedLayoutTransitionMs,
	selectedLayoutEasing,
	onLayoutPresetChange,
	onLayoutTransitionChange,
	onLayoutEasingChange,
	tSettings,
}) => {
	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center gap-3">
				<div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#60A5FA]/20 bg-[#60A5FA]/10 text-[#93C5FD]">
					<LayoutIcon className="h-4 w-4" />
				</div>
				<div>
					<SectionLabel>{tSettings("layout.title", "Layout scene")}</SectionLabel>
					<p className="mt-0.5 text-[10px] text-muted-foreground/70">
						{tSettings("layout.subtitle", "Screen and webcam composition")}
					</p>
				</div>
			</div>

			{selectedLayoutId ? (
				<>
					<div className="flex flex-col gap-3">
						<div className="flex flex-col gap-1.5">
							<SectionLabel>
								{tSettings("layout.category", "Layout")}
							</SectionLabel>
							<div className="grid grid-cols-2 gap-2">
								{LAYOUT_SCENE_CATEGORIES.map((category: (typeof LAYOUT_SCENE_CATEGORIES)[number]) => {
									const activeCategory = getLayoutSceneCategory(
										selectedLayoutPreset ?? "bubble",
									);
									const isActive = activeCategory.id === category.id;
									return (
										<button
											key={category.id}
											type="button"
											onClick={() =>
												onLayoutPresetChange?.(category.value)
											}
											className={cn(
												"rounded-xl border px-3 py-2 text-left transition-all",
												"border-foreground/10 bg-foreground/[0.03] hover:border-foreground/20 hover:bg-foreground/[0.06]",
												isActive &&
													"border-[#2563EB]/70 bg-[#2563EB]/12 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.15)]",
											)}
										>
											<div className="text-[11px] font-medium text-foreground">
												{tSettings(`layout.categories.${category.id}.label`)}
											</div>
											<div className="mt-0.5 text-[9px] text-muted-foreground">
												{tSettings(
													`layout.categories.${category.id}.description`,
												)}
											</div>
										</button>
									);
								})}
							</div>
						</div>

						{(() => {
							const activeCategory = getLayoutSceneCategory(
								selectedLayoutPreset ?? "bubble",
							);
							const detailOptions =
								LAYOUT_SCENE_CATEGORY_DETAILS[activeCategory.id];
							if (detailOptions.length <= 1) return null;
							return (
								<div className="flex flex-col gap-1.5">
									<SectionLabel>
										{tSettings("layout.details", "Details")}
									</SectionLabel>
									<div className="grid grid-cols-2 gap-2">
										{detailOptions.map((preset: (typeof detailOptions)[number]) => {
											const isActive =
												selectedLayoutPreset === preset.value;
											return (
												<button
													key={preset.value}
													type="button"
													onClick={() =>
														onLayoutPresetChange?.(preset.value)
													}
													className={cn(
														"rounded-xl border px-3 py-2 text-left text-[11px] font-medium transition-all",
														"border-foreground/10 bg-foreground/[0.03] text-muted-foreground hover:border-foreground/20 hover:bg-foreground/[0.06] hover:text-foreground",
														isActive &&
															"border-[#60A5FA]/60 bg-[#60A5FA]/12 text-foreground shadow-[inset_0_0_0_1px_rgba(96,165,250,0.12)]",
													)}
												>
													{preset.label}
												</button>
											);
										})}
									</div>
								</div>
							);
						})()}
					</div>

					<SliderControl
						label={tSettings("layout.transition", "Transition")}
						value={selectedLayoutTransitionMs ?? 600}
						defaultValue={600}
						min={0}
						max={2000}
						step={50}
						onChange={(value: number) => onLayoutTransitionChange?.(value)}
						formatValue={(value: number) => `${Math.round(value)}ms`}
						parseInput={(text: string) => parseFloat(text.replace(/ms$/, ""))}
					/>

					<div className="flex items-center justify-between gap-2 rounded-lg bg-foreground/[0.03] px-2.5 py-1.5">
						<span className="text-[11px] text-muted-foreground">
							{tSettings("layout.easing", "Easing")}
						</span>
						<Select
							value={selectedLayoutEasing ?? "smooth"}
							onValueChange={(value) =>
								onLayoutEasingChange?.(value as LayoutSceneEasing)
							}
						>
							<SelectTrigger className="h-7 w-28 border-foreground/10 bg-foreground/[0.03] text-[10px]">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="smooth">Smooth</SelectItem>
								<SelectItem value="snappy">Snappy</SelectItem>
								<SelectItem value="linear">Linear</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</>
			) : (
				<div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] px-3 py-4 text-center text-[11px] text-muted-foreground">
					{tSettings("layout.empty", "Select or add a layout scene on the timeline.")}
				</div>
			)}
		</section>
	);
};
