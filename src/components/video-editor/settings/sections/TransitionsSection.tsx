import React from "react";
import {
	ArrowsLeftRight,
	Check,
	Sparkle,
	X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { SliderControl } from "../../SliderControl";
import { SectionLabel } from "../components/SettingsSectionLabel";
import type { ClipTransitionType } from "../../types";

export interface TransitionsSectionProps {
	selectedClipTransitionIn?: ClipTransitionType | null;
	selectedClipTransitionInDurationMs?: number | null;
	onClipTransitionInChange?: (transition: ClipTransitionType) => void;
	onClipTransitionInDurationChange?: (duration: number) => void;
	tSettings: (key: string, fallback?: string) => string;
}

export const TransitionsSection: React.FC<TransitionsSectionProps> = ({
	selectedClipTransitionIn = "none",
	selectedClipTransitionInDurationMs = 400,
	onClipTransitionInChange,
	onClipTransitionInDurationChange,
	tSettings,
}) => {
	return (
		<section className="flex flex-col gap-3">
			<div>
				<SectionLabel>{tSettings("sections.transitions", "Transitions")}</SectionLabel>
				<p className="mt-0.5 text-[10px] text-muted-foreground">
					{tSettings(
						"transitions.description",
						"Choose transition effect and duration for this slide",
					)}
				</p>
			</div>

			{/* Transition Effect Choices */}
			<div className="grid grid-cols-2 gap-2">
				{[
					{ id: "none" as const, label: "Cut (None)", desc: "Instant transition", icon: X },
					{ id: "fade-black" as const, label: "Fade Black", desc: "Cinematic black dip", icon: Sparkle },
					{ id: "fade-white" as const, label: "Fade White", desc: "Luminous flash", icon: Sparkle },
					{ id: "slide-left" as const, label: "Slide Left", desc: "Push left transition", icon: ArrowsLeftRight },
					{ id: "slide-right" as const, label: "Slide Right", desc: "Push right transition", icon: ArrowsLeftRight },
					{ id: "zoom-push" as const, label: "Zoom Push", desc: "Dynamic zoom perspective", icon: Sparkle },
				].map((opt) => {
					const isCurrent = (selectedClipTransitionIn ?? "none") === opt.id;
					const IconComp = opt.icon;
					return (
						<button
							key={opt.id}
							type="button"
							onClick={() => onClipTransitionInChange?.(opt.id)}
							className={cn(
								"flex flex-col items-start gap-1 p-2.5 rounded-xl border text-left transition-all cursor-pointer",
								isCurrent
									? "border-primary/50 bg-primary/15 text-primary shadow-sm ring-1 ring-primary/30"
									: "border-foreground/10 bg-foreground/[0.02] text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground",
							)}
						>
							<div className="flex items-center justify-between w-full">
								<IconComp className="w-3.5 h-3.5" />
								{isCurrent && <Check className="w-3 h-3 text-primary" />}
							</div>
							<span className="text-xs font-semibold text-foreground mt-1">
								{opt.label}
							</span>
							<span className="text-[9.5px] text-muted-foreground leading-tight">
								{opt.desc}
							</span>
						</button>
					);
				})}
			</div>

			{/* Duration Slider */}
			{(selectedClipTransitionIn ?? "none") !== "none" && (
				<div className="pt-2 border-t border-foreground/10 space-y-2">
					<SliderControl
						label={tSettings("clip.transitionDuration", "Transition Duration")}
						value={selectedClipTransitionInDurationMs ?? 400}
						defaultValue={400}
						min={100}
						max={1500}
						step={50}
						onChange={(v: number) => onClipTransitionInDurationChange?.(v)}
						formatValue={(v: number) => `${(v / 1000).toFixed(2)}s`}
						parseInput={(t: string) => Math.round(parseFloat(t.replace(/s$/, "")) * 1000) || 400}
					/>
					<div className="flex items-center gap-1">
						{[200, 400, 600, 800, 1000].map((dur) => (
							<button
								key={dur}
								type="button"
								onClick={() => onClipTransitionInDurationChange?.(dur)}
								className={cn(
									"flex-1 py-1 rounded-md text-[10px] font-semibold transition-all cursor-pointer",
									selectedClipTransitionInDurationMs === dur
										? "bg-primary text-white shadow-xs"
										: "bg-foreground/5 text-muted-foreground hover:bg-foreground/10",
								)}
							>
								{dur / 1000}s
							</button>
						))}
					</div>
				</div>
			)}
		</section>
	);
};
