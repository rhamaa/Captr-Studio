import { UploadSimple as Upload } from "@phosphor-icons/react";
import React from "react";
import { Button } from "@/components/ui/button";
import { AssetExplorer } from "../../assets/AssetExplorer";
import type { ClipEntry, SlideAssetFile } from "../../types";
import { SectionLabel } from "../components/SettingsSectionLabel";

export interface MediaSectionProps {
	slides?: ClipEntry[];
	selectedClipId?: string | null;
	onAddAsSlide?: (filePath: string, label?: string) => void;
	onImportMedia?: (subfolder?: string) => void;
	onUseAsset?: (
		asset: SlideAssetFile,
		action: "set-main" | "add-video-layer" | "add-audio" | "add-overlay",
	) => void;
	onRemoveAsset?: (assetId: string) => void;
	tSettings: (key: string, fallback?: string) => string;
}

export const MediaSection: React.FC<MediaSectionProps> = ({
	slides = [],
	selectedClipId,
	onAddAsSlide,
	onImportMedia,
	onUseAsset,
	onRemoveAsset,
	tSettings,
}) => {
	const activeClip = slides.find((c) => c.id === selectedClipId) ?? slides[0] ?? null;

	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<div>
					<SectionLabel>
						{tSettings("sections.media", "Slide Media & Assets")}
					</SectionLabel>
					<p className="mt-0.5 text-[10px] text-muted-foreground">
						{tSettings(
							"media.description",
							"Exclusive media assets and subfolders for this video slide",
						)}
					</p>
				</div>
				{onImportMedia && (
					<Button
						type="button"
						size="sm"
						onClick={() => onImportMedia("Imported Media")}
						className="h-7 px-2.5 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg shadow-xs cursor-pointer"
					>
						<Upload className="w-3.5 h-3.5" />
						<span>Import</span>
					</Button>
				)}
			</div>
			<div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] overflow-hidden">
				<AssetExplorer
					className="h-[440px]"
					activeClip={activeClip}
					onAddAsSlide={onAddAsSlide}
					onImportMedia={onImportMedia}
					onUseAsset={onUseAsset}
					onRemoveAsset={onRemoveAsset}
					currentActivePath={activeClip?.videoPath ?? null}
				/>
			</div>
		</section>
	);
};
