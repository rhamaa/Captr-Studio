import Block from "@uiw/react-color-block";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { AnnotationRegion } from "../types";
import { COLOR_PALETTE } from "./annotationConstants";

export interface AnnotationBlurTabProps {
	annotation: AnnotationRegion;
	onBlurIntensityChange?: (intensity: number) => void;
	onBlurColorChange?: (color: string) => void;
	colorPalette?: string[];
	t: (key: string, defaultVal?: string, params?: Record<string, string | number>) => string;
}

export function AnnotationBlurTab({
	annotation,
	onBlurIntensityChange,
	onBlurColorChange,
	colorPalette = COLOR_PALETTE,
	t,
}: AnnotationBlurTabProps) {
	return (
		<div className="mt-0 space-y-4">
			<div>
				<label className="text-xs font-medium text-foreground mb-2 block">
					{t("annotations.blurIntensity", undefined, {
						intensity: annotation.blurIntensity || 10,
					})}
				</label>
				<Slider
					value={[annotation.blurIntensity || 10]}
					onValueChange={([value]) => onBlurIntensityChange?.(value)}
					min={1}
					max={30}
					step={1}
					className="w-full"
				/>
			</div>

			<div>
				<label className="text-xs font-medium text-foreground mb-2 block">
					{t("annotations.colorOverlay", "Color Overlay")}
				</label>
				<div className="flex items-center gap-2">
					<button
						onClick={() => onBlurColorChange?.("transparent")}
						className={cn(
							"w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center p-0.5",
							!annotation.blurColor || annotation.blurColor === "transparent"
								? "border-[#2563EB] scale-110"
								: "border-transparent hover:border-foreground/20",
						)}
						title={t("annotations.none", "None")}
					>
						<div className="w-5 h-5 rounded-full bg-editor-bg flex items-center justify-center overflow-hidden relative">
							<div className="absolute w-full h-0.5 bg-red-500 rotate-45" />
						</div>
					</button>
					<button
						onClick={() => onBlurColorChange?.("#000000")}
						className={cn(
							"w-8 h-8 rounded-full border-2 transition-all bg-black",
							annotation.blurColor === "#000000"
								? "border-[#2563EB] scale-110"
								: "border-transparent hover:border-foreground/20",
						)}
						title="Black"
					/>
					<button
						onClick={() => onBlurColorChange?.("#FFFFFF")}
						className={cn(
							"w-8 h-8 rounded-full border-2 transition-all bg-white",
							annotation.blurColor === "#FFFFFF"
								? "border-[#2563EB] scale-110"
								: "border-transparent hover:border-foreground/20",
						)}
						title="White"
					/>

					<Popover>
						<PopoverTrigger asChild>
							<button
								className={cn(
									"w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center overflow-hidden relative",
									annotation.blurColor &&
										!["#000000", "#FFFFFF", "transparent", ""].includes(
											annotation.blurColor,
										)
										? "border-[#2563EB] scale-110"
										: "border-transparent hover:border-foreground/20",
								)}
								style={{
									backgroundColor:
										annotation.blurColor &&
										!["#000000", "#FFFFFF", "transparent", ""].includes(
											annotation.blurColor,
										)
											? annotation.blurColor
											: "transparent",
								}}
								title="Custom Color"
							>
								{(!annotation.blurColor ||
									["#000000", "#FFFFFF", "transparent", ""].includes(
										annotation.blurColor,
									)) && (
									<div className="w-full h-full flex items-center justify-center bg-foreground/5">
										<div className="w-full h-full bg-gradient-to-tr from-red-500 via-green-500 to-blue-500 opacity-50" />
									</div>
								)}
							</button>
						</PopoverTrigger>
						<PopoverContent className="w-[260px] p-3 bg-editor-surface-alt border border-foreground/10 rounded-xl shadow-xl">
							<Block
								color={annotation.blurColor || "#2563EB"}
								colors={colorPalette}
								onChange={(color) => {
									onBlurColorChange?.(color.hex);
								}}
								style={{
									borderRadius: "8px",
								}}
							/>
						</PopoverContent>
					</Popover>
				</div>
			</div>
		</div>
	);
}
