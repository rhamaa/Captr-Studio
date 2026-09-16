import { useEffect, useMemo, useState } from "react";
import {
	ImageSquare as ImageIcon,
	Info,
	BoundingBox as SquareDashed,
	Trash as Trash2,
	TextT as Type,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type CustomFont, getCustomFonts } from "@/lib/customFonts";
import { useScopedT } from "../../contexts/I18nContext";
import type {
	AnnotationRegion,
	AnnotationType,
	FigureData,
} from "./types";
import {
	COLOR_PALETTE,
	FONT_FAMILY_VALUES,
	FONT_SIZES,
} from "./annotations/annotationConstants";
import { AnnotationHeader } from "./annotations/AnnotationHeader";
import { AnnotationTextTab } from "./annotations/AnnotationTextTab";
import { AnnotationMediaTab } from "./annotations/AnnotationMediaTab";
import { AnnotationFigureTab } from "./annotations/AnnotationFigureTab";
import { AnnotationBlurTab } from "./annotations/AnnotationBlurTab";
import { AnnotationEffectsSection } from "./annotations/AnnotationEffectsSection";
import { AnnotationKeyframeSection } from "./annotations/AnnotationKeyframeSection";

export { FONT_FAMILY_VALUES, FONT_SIZES };

export interface AnnotationSettingsPanelProps {
	annotation: AnnotationRegion;
	onContentChange: (content: string) => void;
	onTypeChange: (type: AnnotationType) => void;
	onStyleChange: (style: Partial<AnnotationRegion["style"]>) => void;
	onFigureDataChange?: (figureData: FigureData) => void;
	onBlurIntensityChange?: (intensity: number) => void;
	onBlurColorChange?: (color: string) => void;
	onAnimationChange?: (anim: {
		animationIn?: "none" | "fade" | "slide-up";
		animationOut?: "none" | "fade";
		animationDurationMs?: number;
	}) => void;
	onLayerChange?: (changes: Partial<AnnotationRegion>) => void;
	currentTimeMs?: number;
	onDelete: () => void;
}

export function AnnotationSettingsPanel({
	annotation,
	onContentChange,
	onTypeChange,
	onStyleChange,
	onFigureDataChange,
	onBlurIntensityChange,
	onBlurColorChange,
	onAnimationChange,
	onLayerChange,
	currentTimeMs,
	onDelete,
}: AnnotationSettingsPanelProps) {
	const t = useScopedT("editor");
	const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);

	const fontFamilies = useMemo(
		() => FONT_FAMILY_VALUES.map((f) => ({ value: f.value, label: t(f.labelKey) })),
		[t],
	);

	// Load custom fonts on mount
	useEffect(() => {
		setCustomFonts(getCustomFonts());
	}, []);

	return (
		<div className="flex-[2] min-w-0 bg-editor-panel border border-foreground/10 rounded-2xl flex flex-col shadow-xl h-full overflow-hidden">
			<div className="flex-1 min-h-0 p-4 overflow-y-auto custom-scrollbar">
				<div className="mb-6">
					<AnnotationHeader
						annotation={annotation}
						onLayerChange={onLayerChange}
						t={t}
					/>

					{/* Type Selector */}
					<Tabs
						value={annotation.type}
						onValueChange={(value) => onTypeChange(value as AnnotationType)}
						className="mb-6"
					>
						<TabsList className="mb-4 bg-foreground/5 border border-foreground/5 p-1 w-full grid grid-cols-4 h-auto rounded-xl">
							<TabsTrigger
								value="text"
								className="data-[state=active]:bg-[#2563EB] data-[state=active]:text-white text-muted-foreground py-2 rounded-lg transition-all gap-2"
							>
								<Type className="w-4 h-4" />
								{t("annotations.text")}
							</TabsTrigger>
							<TabsTrigger
								value="image"
								className="data-[state=active]:bg-[#2563EB] data-[state=active]:text-white text-muted-foreground py-2 rounded-lg transition-all gap-2"
							>
								<ImageIcon className="w-4 h-4" />
								{t("annotations.image")}
							</TabsTrigger>
							<TabsTrigger
								value="figure"
								className="data-[state=active]:bg-[#2563EB] data-[state=active]:text-white text-muted-foreground py-2 rounded-lg transition-all gap-2"
							>
								<svg
									className="w-4 h-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
								>
									<path
										d="M4 12h16m0 0l-6-6m6 6l-6 6"
										strokeLinecap="round"
										strokeLinejoin="round"
									/>
								</svg>
								{t("annotations.arrow")}
							</TabsTrigger>
							<TabsTrigger
								value="blur"
								className="data-[state=active]:bg-[#2563EB] data-[state=active]:text-white text-muted-foreground py-2 rounded-lg transition-all gap-2"
							>
								<SquareDashed className="w-4 h-4" />
								{t("annotations.blur")}
							</TabsTrigger>
						</TabsList>

						<TabsContent value="text">
							<AnnotationTextTab
								annotation={annotation}
								onContentChange={onContentChange}
								onStyleChange={onStyleChange}
								fontFamilies={fontFamilies}
								customFonts={customFonts}
								setCustomFonts={setCustomFonts}
								colorPalette={COLOR_PALETTE}
								t={t}
							/>
						</TabsContent>

						<TabsContent value="image">
							<AnnotationMediaTab
								annotation={annotation}
								onContentChange={onContentChange}
								onLayerChange={onLayerChange}
								t={t}
							/>
						</TabsContent>

						<TabsContent value="figure">
							<AnnotationFigureTab
								annotation={annotation}
								onFigureDataChange={onFigureDataChange}
								colorPalette={COLOR_PALETTE}
								t={t}
							/>
						</TabsContent>

						<TabsContent value="blur">
							<AnnotationBlurTab
								annotation={annotation}
								onBlurIntensityChange={onBlurIntensityChange}
								onBlurColorChange={onBlurColorChange}
								colorPalette={COLOR_PALETTE}
								t={t}
							/>
						</TabsContent>
					</Tabs>

					<AnnotationEffectsSection
						annotation={annotation}
						onStyleChange={onStyleChange}
						onAnimationChange={onAnimationChange}
						onLayerChange={onLayerChange}
						colorPalette={COLOR_PALETTE}
					/>

					<AnnotationKeyframeSection
						annotation={annotation}
						onLayerChange={onLayerChange}
						currentTimeMs={currentTimeMs}
					/>

					<div className="mt-6 p-3 bg-foreground/5 rounded-lg border border-foreground/5">
						<div className="flex items-center gap-2 mb-2 text-muted-foreground">
							<Info className="w-3.5 h-3.5" />
							<span className="text-xs font-medium">
								{t("annotations.shortcutsAndTips")}
							</span>
						</div>
						<ul className="text-[10px] text-muted-foreground space-y-1.5 list-disc pl-3 leading-relaxed">
							<li>{t("annotations.tipSelectAnnotation")}</li>
							<li>{t("annotations.tipCycleForward")}</li>
							<li>{t("annotations.tipCycleBackward")}</li>
						</ul>
					</div>
				</div>
			</div>
			<div className="flex-shrink-0 border-t border-foreground/10 bg-editor-panel p-4 pt-3">
				<Button
					onClick={onDelete}
					variant="destructive"
					size="sm"
					className="w-full gap-2 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/30 transition-all"
				>
					<Trash2 className="w-4 h-4" />
					{t("annotations.deleteAnnotation")}
				</Button>
			</div>
		</div>
	);
}
