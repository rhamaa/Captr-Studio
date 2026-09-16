import { CursorClick, PresentationChart } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { CursorMotionPresetId } from "../../cursorMotionPresets";

export const MOTION_PRESET_ORDER: CursorMotionPresetId[] = ["focused", "smooth"];

export interface MotionPresetCardsProps {
	title: string;
	activePresetId: CursorMotionPresetId | null;
	onApply: (presetId: CursorMotionPresetId) => void;
	tSettings: (key: string, fallback?: string) => string;
}

export function MotionPresetCards({
	title,
	activePresetId,
	onApply,
	tSettings,
}: MotionPresetCardsProps) {
	return (
		<div className="flex flex-col gap-2">
			<div className="text-[10px] text-muted-foreground">{title}</div>
			<div className="grid grid-cols-2 gap-2">
				{MOTION_PRESET_ORDER.map((presetId) => {
					const Icon = presetId === "focused" ? CursorClick : PresentationChart;
					const isActive = activePresetId === presetId;

					return (
						<button
							key={presetId}
							type="button"
							onClick={() => onApply(presetId)}
							className={cn(
								"rounded-xl border px-3 py-3 text-left transition-all",
								"border-foreground/10 bg-foreground/[0.03] hover:border-foreground/20 hover:bg-foreground/[0.06]",
								isActive &&
									"border-[#2563EB]/70 bg-[#2563EB]/12 shadow-[inset_0_0_0_1px_rgba(37,99,235,0.15)]",
							)}
						>
							<div className="flex items-start gap-3">
								<div
									className={cn(
										"mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-foreground/10 bg-black/10 text-muted-foreground",
										isActive &&
											"border-[#2563EB]/30 bg-[#2563EB]/10 text-[#75A6FF]",
									)}
								>
									<Icon className="h-4 w-4" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="text-[12px] font-medium text-foreground">
										{tSettings(`effects.motionPresets.${presetId}.label`)}
									</div>
								</div>
							</div>
							<div className="mt-2 text-[10px] leading-4 text-muted-foreground">
								{tSettings(`effects.motionPresets.${presetId}.description`)}
							</div>
						</button>
					);
				})}
			</div>
		</div>
	);
}
