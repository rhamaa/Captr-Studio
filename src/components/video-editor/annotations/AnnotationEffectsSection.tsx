import { ArrowsClockwise, SlidersHorizontal } from "@phosphor-icons/react";
import Block from "@uiw/react-color-block";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import type { AnnotationRegion, MediaBlendMode } from "../types";
import { COLOR_PALETTE } from "./annotationConstants";

export interface AnnotationEffectsSectionProps {
	annotation: AnnotationRegion;
	onStyleChange: (style: Partial<AnnotationRegion["style"]>) => void;
	onAnimationChange?: (anim: {
		animationIn?: "none" | "fade" | "slide-up";
		animationOut?: "none" | "fade";
		animationDurationMs?: number;
	}) => void;
	onLayerChange?: (changes: Partial<AnnotationRegion>) => void;
	colorPalette?: string[];
}

export function AnnotationEffectsSection({
	annotation,
	onStyleChange,
	onAnimationChange,
	onLayerChange,
	colorPalette = COLOR_PALETTE,
}: AnnotationEffectsSectionProps) {
	const isMediaOrText =
		annotation.type === "image" || annotation.type === "gif" || annotation.type === "text";

	return (
		<>
			{isMediaOrText && (
				<div className="mt-4 space-y-4">
					<div>
						<label className="text-xs font-medium text-foreground mb-2 block">
							Opacity ({Math.round((annotation.style.opacity ?? 1) * 100)}%)
						</label>
						<Slider
							value={[annotation.style.opacity ?? 1]}
							onValueChange={([value]) => onStyleChange({ opacity: value })}
							min={0}
							max={1}
							step={0.01}
							className="w-full"
						/>
					</div>
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<label className="text-xs font-medium text-foreground">
								Drop Shadow
							</label>
							<input
								type="checkbox"
								checked={annotation.style.dropShadow ?? false}
								onChange={(e) => onStyleChange({ dropShadow: e.target.checked })}
								className="w-4 h-4 rounded border-foreground/20 text-[#2563EB] focus:ring-[#2563EB] focus:ring-offset-editor-panel bg-foreground/5 cursor-pointer"
							/>
						</div>
						{(annotation.style.dropShadow ?? false) && (
							<div className="pl-2 border-l-2 border-[#2563EB]/20 space-y-4 ml-1">
								<div>
									<label className="text-[10px] font-medium text-muted-foreground mb-2 block">
										Blur ({annotation.style.dropShadowBlur ?? 8}px)
									</label>
									<Slider
										value={[annotation.style.dropShadowBlur ?? 8]}
										onValueChange={([value]) =>
											onStyleChange({ dropShadowBlur: value })
										}
										min={0}
										max={20}
										step={1}
										className="w-full"
									/>
								</div>
								<div>
									<label className="text-[10px] font-medium text-muted-foreground mb-2 block">
										Offset X ({annotation.style.dropShadowOffsetX ?? 0}px)
									</label>
									<Slider
										value={[annotation.style.dropShadowOffsetX ?? 0]}
										onValueChange={([value]) =>
											onStyleChange({ dropShadowOffsetX: value })
										}
										min={-20}
										max={20}
										step={1}
										className="w-full"
									/>
								</div>
								<div>
									<label className="text-[10px] font-medium text-muted-foreground mb-2 block">
										Offset Y ({annotation.style.dropShadowOffsetY ?? 4}px)
									</label>
									<Slider
										value={[annotation.style.dropShadowOffsetY ?? 4]}
										onValueChange={([value]) =>
											onStyleChange({ dropShadowOffsetY: value })
										}
										min={-20}
										max={20}
										step={1}
										className="w-full"
									/>
								</div>
								<div>
									<label className="text-[10px] font-medium text-muted-foreground mb-2 block">
										Shadow Color
									</label>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												variant="outline"
												className="w-full h-8 justify-start gap-2 bg-foreground/5 border-foreground/10 hover:bg-foreground/10 px-2"
											>
												<div
													className="w-3 h-3 rounded-full border border-foreground/20"
													style={{
														backgroundColor:
															annotation.style.dropShadowColor ||
															"rgba(0,0,0,0.5)",
													}}
												/>
												<span className="text-[10px] text-muted-foreground truncate flex-1 text-left">
													{annotation.style.dropShadowColor ||
														"rgba(0,0,0,0.5)"}
												</span>
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-[260px] p-3 bg-editor-surface-alt border border-foreground/10 rounded-xl shadow-xl">
											<Block
												color={
													annotation.style.dropShadowColor ||
													"rgba(0,0,0,0.5)"
												}
												colors={colorPalette}
												onChange={(color) => {
													onStyleChange({
														dropShadowColor: color.hex,
													});
												}}
												style={{ borderRadius: "8px" }}
											/>
										</PopoverContent>
									</Popover>
								</div>
							</div>
						)}
					</div>
				</div>
			)}

			{isMediaOrText && (
				<div className="mt-4 space-y-4 pt-4 border-t border-foreground/10">
					<div className="grid grid-cols-2 gap-2">
						<div>
							<label className="text-xs font-medium text-foreground mb-2 block">
								Animation In
							</label>
							<Select
								value={annotation.animationIn || "none"}
								onValueChange={(value) =>
									onAnimationChange?.({
										animationIn: value as "none" | "fade" | "slide-up",
									})
								}
							>
								<SelectTrigger className="w-full bg-foreground/5 border-foreground/10 text-foreground h-9 text-xs">
									<SelectValue placeholder="None" />
								</SelectTrigger>
								<SelectContent className="bg-editor-surface-alt border-foreground/10 text-foreground">
									<SelectItem value="none">None</SelectItem>
									<SelectItem value="fade">Fade</SelectItem>
									<SelectItem value="slide-up">Slide Up</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div>
							<label className="text-xs font-medium text-foreground mb-2 block">
								Animation Out
							</label>
							<Select
								value={annotation.animationOut || "none"}
								onValueChange={(value) =>
									onAnimationChange?.({
										animationOut: value as "none" | "fade",
									})
								}
							>
								<SelectTrigger className="w-full bg-foreground/5 border-foreground/10 text-foreground h-9 text-xs">
									<SelectValue placeholder="None" />
								</SelectTrigger>
								<SelectContent className="bg-editor-surface-alt border-foreground/10 text-foreground">
									<SelectItem value="none">None</SelectItem>
									<SelectItem value="fade">Fade</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					{((annotation.animationIn && annotation.animationIn !== "none") ||
						(annotation.animationOut && annotation.animationOut !== "none")) && (
						<div>
							<label className="text-[10px] font-medium text-muted-foreground mb-2 block">
								Duration ({annotation.animationDurationMs ?? 500}ms)
							</label>
							<Slider
								value={[annotation.animationDurationMs ?? 500]}
								onValueChange={([value]) =>
									onAnimationChange?.({ animationDurationMs: value })
								}
								min={100}
								max={2000}
								step={50}
								className="w-full"
							/>
						</div>
					)}
				</div>
			)}

			{/* Layer Controls & Blend Modes */}
			<div className="mt-6 pt-4 border-t border-foreground/10 space-y-4">
				<div className="flex items-center justify-between">
					<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
						<SlidersHorizontal className="w-3.5 h-3.5 text-[#2563EB]" />
						Compositing & Transform
					</span>
				</div>

				<div className="space-y-3">
					{/* Opacity Slider */}
					<div>
						<div className="flex items-center justify-between mb-1.5">
							<label className="text-xs text-foreground font-medium">Opacity</label>
							<span className="text-xs text-muted-foreground">
								{Math.round((annotation.style?.opacity ?? 1) * 100)}%
							</span>
						</div>
						<Slider
							value={[Math.round((annotation.style?.opacity ?? 1) * 100)]}
							onValueChange={([val]) => onStyleChange({ opacity: val / 100 })}
							min={0}
							max={100}
							step={1}
							className="w-full"
						/>
					</div>

					{/* Rotation Slider */}
					<div>
						<div className="flex items-center justify-between mb-1.5">
							<label className="text-xs text-foreground font-medium flex items-center gap-1">
								<ArrowsClockwise className="w-3 h-3 text-muted-foreground" />
								Rotation
							</label>
							<span className="text-xs text-muted-foreground">
								{annotation.rotationDeg ?? 0}°
							</span>
						</div>
						<Slider
							value={[annotation.rotationDeg ?? 0]}
							onValueChange={([val]) => onLayerChange?.({ rotationDeg: val })}
							min={-180}
							max={180}
							step={1}
							className="w-full"
						/>
					</div>

					{/* Blend Mode Selector */}
					<div>
						<label className="text-xs text-foreground font-medium mb-1.5 block">
							Blend Mode
						</label>
						<Select
							value={annotation.blendMode ?? "normal"}
							onValueChange={(value) =>
								onLayerChange?.({ blendMode: value as MediaBlendMode })
							}
						>
							<SelectTrigger className="w-full bg-foreground/5 border-foreground/10 text-foreground h-9 text-xs">
								<SelectValue placeholder="Normal" />
							</SelectTrigger>
							<SelectContent className="bg-editor-surface-alt border-foreground/10 text-foreground">
								<SelectItem value="normal">Normal</SelectItem>
								<SelectItem value="multiply">Multiply (Darken)</SelectItem>
								<SelectItem value="screen">Screen (Lighten)</SelectItem>
								<SelectItem value="overlay">Overlay (Contrast)</SelectItem>
								<SelectItem value="darken">Darken</SelectItem>
								<SelectItem value="lighten">Lighten</SelectItem>
								<SelectItem value="color-dodge">Color Dodge</SelectItem>
								<SelectItem value="color-burn">Color Burn</SelectItem>
								<SelectItem value="difference">Difference</SelectItem>
								<SelectItem value="exclusion">Exclusion</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>
		</>
	);
}
