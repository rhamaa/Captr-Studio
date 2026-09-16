import React from "react";
import { UploadSimple as Upload } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { AssetExplorer } from "../../assets/AssetExplorer";
import { SectionLabel } from "../components/SettingsSectionLabel";
import type { ClipEntry } from "../../types";

export interface MediaSectionProps {
	slides?: ClipEntry[];
	selectedClipId?: string | null;
	onAddAsSlide?: (filePath: string, label?: string) => void;
	onImportMedia?: () => void;
	tSettings: (key: string, fallback?: string) => string;
}

export const MediaSection: React.FC<MediaSectionProps> = ({
	slides = [],
	selectedClipId,
	onAddAsSlide,
	onImportMedia,
	tSettings,
}) => {
	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<div>
					<SectionLabel>{tSettings("sections.media", "Media & Files")}</SectionLabel>
					<p className="mt-0.5 text-[10px] text-muted-foreground">
						{tSettings("media.description", "Project assets, recordings, and media files")}
					</p>
				</div>
				{onImportMedia && (
					<Button
						type="button"
						size="sm"
						onClick={onImportMedia}
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
					onAddAsSlide={onAddAsSlide ?? (() => {})}
					onImportMedia={onImportMedia}
					currentActivePath={
						selectedClipId
							? slides?.find((c) => c.id === selectedClipId)?.videoPath
							: null
					}
				/>
			</div>
		</section>
	);
};
