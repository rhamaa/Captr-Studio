import React, { createContext, useContext } from "react";
import type { TimelineProject } from "@/core/timeline/types";
import type { RepurposeArtboardFraming } from "@/core/timeline/repurposeTypes";

export interface WhiteboardContextValue {
	project: TimelineProject;
	boardProject: TimelineProject;
	artboardProjectViews: Map<string, TimelineProject>;
	activePlayingId: string | null;
	setActivePlayingId: (id: string | null) => void;
	onOpenArtboardEditor?: (artboardId: string) => void;
	onOpenHyperframeEditor?: (hyperframeId: string) => void;
	onUpdateFraming: (artboardId: string, patch: Partial<RepurposeArtboardFraming>) => void;
	onResetFraming: (artboardId: string) => void;
	onRemoveArtboard: (artboardId: string) => void;
	onDuplicateArtboard: (artboardId: string) => void;
	onRenameArtboard: (artboardId: string, newName: string) => void;
	onRemoveHyperframe: (hyperframeId: string) => void;
	onDuplicateHyperframe: (hyperframeId: string) => void;
	onRenameHyperframe: (hyperframeId: string, newName: string) => void;
	onDropAsset?: (artboardId: string, assetId: string) => void;
}

export const WhiteboardContext = createContext<WhiteboardContextValue | null>(null);

export function useWhiteboardContext(): WhiteboardContextValue | null {
	return useContext(WhiteboardContext);
}
