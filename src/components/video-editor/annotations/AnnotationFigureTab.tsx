import Block from "@uiw/react-color-block";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { getArrowComponent } from "../ArrowSvgs";
import type { AnnotationRegion, ArrowDirection, FigureData } from "../types";
import { COLOR_PALETTE } from "./annotationConstants";

export interface AnnotationFigureTabProps {
	annotation: AnnotationRegion;
	onFigureDataChange?: (figureData: FigureData) => void;
	colorPalette?: string[];
	t: (key: string, defaultVal?: string, params?: Record<string, string | number>) => string;
}

const ARROW_DIRECTIONS: ArrowDirection[] = [
	"up",
	"down",
	"left",
	"right",
	"up-right",
	"up-left",
	"down-right",
	"down-left",
];

export function AnnotationFigureTab({
	annotation,
	onFigureDataChange,
	colorPalette = COLOR_PALETTE,
	t,
}: AnnotationFigureTabProps) {
	return (
		<div className="mt-0 space-y-4">
			<div>
				<label className="text-xs font-medium text-foreground mb-3 block">
					{t("annotations.arrowDirection")}
				</label>
				<div className="grid grid-cols-4 gap-2">
					{ARROW_DIRECTIONS.map((direction) => {
						const ArrowComponent = getArrowComponent(direction);
						return (
							<button
								key={direction}
								onClick={() => {
									const newFigureData: FigureData = {
										...annotation.figureData!,
										arrowDirection: direction,
									};
									onFigureDataChange?.(newFigureData);
								}}
								aria-label={t(
									"annotations.arrowDirectionOption",
									"Arrow direction: {{direction}}",
									{ direction: direction.replace(/-/g, " ") },
								)}
								className={cn(
									"h-16 rounded-lg border flex items-center justify-center transition-all p-2",
									annotation.figureData?.arrowDirection === direction
										? "bg-[#2563EB] border-[#2563EB]"
										: "bg-foreground/5 border-foreground/10 hover:bg-foreground/10 hover:border-foreground/20",
								)}
							>
								<ArrowComponent
									color={
										annotation.figureData?.arrowDirection === direction
											? "#ffffff"
											: "#94a3b8"
									}
									strokeWidth={3}
								/>
							</button>
						);
					})}
				</div>
			</div>

			<div>
				<label className="text-xs font-medium text-foreground mb-2 block">
					{t("annotations.strokeWidth", undefined, {
						width: annotation.figureData?.strokeWidth || 4,
					})}
				</label>
				<Slider
					value={[annotation.figureData?.strokeWidth || 4]}
					onValueChange={([value]) => {
						const newFigureData: FigureData = {
							...annotation.figureData!,
							strokeWidth: value,
						};
						onFigureDataChange?.(newFigureData);
					}}
					min={1}
					max={6}
					step={1}
					className="w-full"
				/>
			</div>

			<div>
				<label className="text-xs font-medium text-foreground mb-2 block">
					{t("annotations.arrowColor")}
				</label>
				<Popover>
					<PopoverTrigger asChild>
						<Button
							variant="outline"
							className="w-full h-10 justify-start gap-2 bg-foreground/5 border-foreground/10 hover:bg-foreground/10"
						>
							<div
								className="w-5 h-5 rounded-full border border-foreground/20"
								style={{
									backgroundColor: annotation.figureData?.color || "#2563EB",
								}}
							/>
							<span className="text-xs text-muted-foreground">
								{annotation.figureData?.color || "#2563EB"}
							</span>
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-[260px] p-3 bg-editor-surface-alt border border-foreground/10 rounded-xl shadow-xl">
						<Block
							color={annotation.figureData?.color || "#2563EB"}
							colors={colorPalette}
							onChange={(color) => {
								const newFigureData: FigureData = {
									...annotation.figureData!,
									color: color.hex,
								};
								onFigureDataChange?.(newFigureData);
							}}
							style={{
								borderRadius: "8px",
							}}
						/>
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);
}
