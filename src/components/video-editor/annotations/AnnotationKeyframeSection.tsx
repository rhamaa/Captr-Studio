import { Diamond, Plus, Trash as Trash2 } from "@phosphor-icons/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { addAnnotationKeyframe, getAnnotationLocalTime } from "../annotationKeyframes";
import type { AnnotationRegion, KeyframeEasing, KeyframeProperty } from "../types";
import { KeyframeValueEditor } from "./KeyframeValueEditor";

export interface AnnotationKeyframeSectionProps {
	annotation: AnnotationRegion;
	onLayerChange?: (changes: Partial<AnnotationRegion>) => void;
	currentTimeMs?: number;
}

export function AnnotationKeyframeSection({
	annotation,
	onLayerChange,
	currentTimeMs,
}: AnnotationKeyframeSectionProps) {
	const handleAddKeyframe = (property: KeyframeProperty) => {
		const currentMs = currentTimeMs ?? annotation.startMs;
		const relativeTimeMs = getAnnotationLocalTime(annotation, currentMs);
		const nextKfs = addAnnotationKeyframe(
			annotation,
			property,
			currentMs,
			`kf_${crypto.randomUUID()}`,
		);
		onLayerChange?.({ keyframes: nextKfs });
		toast.success(`Keyframe ${property} added at ${(relativeTimeMs / 1000).toFixed(2)}s`);
	};

	const handleRemoveKeyframe = (kfId: string) => {
		const nextKfs = (annotation.keyframes || []).filter((k) => k.id !== kfId);
		onLayerChange?.({ keyframes: nextKfs });
		toast.success("Keyframe removed");
	};

	const handleKeyframeEasingChange = (kfId: string, easing: KeyframeEasing) => {
		const nextKfs = (annotation.keyframes || []).map((k) =>
			k.id === kfId ? { ...k, easing } : k,
		);
		onLayerChange?.({ keyframes: nextKfs });
	};

	return (
		<div className="mt-6 pt-4 border-t border-foreground/10 space-y-4">
			<div className="flex items-center justify-between">
				<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
					<Diamond className="w-3.5 h-3.5 text-[#6FA8FF]" />
					Keyframe Engine
				</span>
				<span className="text-[10px] text-muted-foreground bg-foreground/5 px-2 py-0.5 rounded-md font-mono">
					{(((currentTimeMs ?? annotation.startMs) - annotation.startMs) / 1000).toFixed(
						2,
					)}
					s
				</span>
			</div>

			<div className="grid grid-cols-2 gap-1.5">
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={() => handleAddKeyframe("position")}
					className="h-8 text-xs font-medium border-foreground/10 bg-foreground/5 hover:bg-[#6FA8FF]/10 hover:text-[#6FA8FF] hover:border-[#6FA8FF]/30 gap-1.5"
				>
					<Plus className="w-3 h-3" />
					Position
				</Button>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={() => handleAddKeyframe("scale")}
					className="h-8 text-xs font-medium border-foreground/10 bg-foreground/5 hover:bg-[#F6C768]/10 hover:text-[#F6C768] hover:border-[#F6C768]/30 gap-1.5"
				>
					<Plus className="w-3 h-3" />
					Scale
				</Button>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={() => handleAddKeyframe("rotation")}
					className="h-8 text-xs font-medium border-foreground/10 bg-foreground/5 hover:bg-[#A879F5]/10 hover:text-[#A879F5] hover:border-[#A879F5]/30 gap-1.5"
				>
					<Plus className="w-3 h-3" />
					Rotation
				</Button>
				<Button
					type="button"
					size="sm"
					variant="outline"
					onClick={() => handleAddKeyframe("opacity")}
					className="h-8 text-xs font-medium border-foreground/10 bg-foreground/5 hover:bg-[#8DDB9B]/10 hover:text-[#8DDB9B] hover:border-[#8DDB9B]/30 gap-1.5"
				>
					<Plus className="w-3 h-3" />
					Opacity
				</Button>
			</div>

			{/* Keyframe List */}
			{annotation.keyframes && annotation.keyframes.length > 0 && (
				<div className="space-y-2 mt-3">
					<span className="text-[11px] font-medium text-muted-foreground block">
						Active Keyframes ({annotation.keyframes.length})
					</span>
					<div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
						{annotation.keyframes.map((kf) => (
							<div
								key={kf.id}
								className="flex items-center justify-between p-2 rounded-lg bg-foreground/[0.03] border border-foreground/5 text-xs"
							>
								<div className="flex items-center gap-2 min-w-0">
									<span
										className={cn(
											"w-2 h-2 rotate-45 rounded-[1px] flex-shrink-0",
											kf.property === "position" && "bg-[#6FA8FF]",
											kf.property === "scale" && "bg-[#F6C768]",
											kf.property === "rotation" && "bg-[#A879F5]",
											kf.property === "opacity" && "bg-[#8DDB9B]",
										)}
									/>
									<KeyframeValueEditor
										frame={kf}
										disabled={annotation.locked}
										onChange={(changes) =>
											onLayerChange?.({
												keyframes: annotation.keyframes?.map((frame) =>
													frame.id === kf.id
														? { ...frame, ...changes }
														: frame,
												),
											})
										}
									/>
									<span className="capitalize font-medium text-foreground text-[11px] truncate">
										{kf.property}
									</span>
									<span className="text-[10px] text-muted-foreground font-mono">
										{(kf.timeMs / 1000).toFixed(2)}s
									</span>
								</div>

								<div className="flex items-center gap-1">
									<Select
										value={kf.easing || "ease-in-out"}
										onValueChange={(val) =>
											handleKeyframeEasingChange(kf.id, val as KeyframeEasing)
										}
									>
										<SelectTrigger className="h-6 w-20 text-[10px] px-1.5 bg-foreground/5 border-foreground/10">
											<SelectValue />
										</SelectTrigger>
										<SelectContent className="bg-editor-surface-alt border-foreground/10 text-[11px]">
											<SelectItem value="linear">Linear</SelectItem>
											<SelectItem value="ease-in">Ease In</SelectItem>
											<SelectItem value="ease-out">Ease Out</SelectItem>
											<SelectItem value="ease-in-out">Ease In-Out</SelectItem>
											<SelectItem value="cubic-bezier">
												Custom Bezier
											</SelectItem>
											<SelectItem value="spring-bounce">Spring</SelectItem>
										</SelectContent>
									</Select>
									<button
										type="button"
										onClick={() => handleRemoveKeyframe(kf.id)}
										className="p-1 text-muted-foreground hover:text-red-400 transition-colors rounded"
										title="Delete keyframe"
									>
										<Trash2 className="w-3.5 h-3.5" />
									</button>
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
