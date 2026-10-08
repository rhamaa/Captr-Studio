import { useEffect, useMemo, useRef, useState } from "react";
import { Tldraw, type Editor } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import "./whiteboardTheme.css";
import { getTldrawOfflineAssetUrls } from "./tldrawAssets";
import {
	customShapeUtils,
	ARTBOARD_CARD_SHAPE_TYPE,
	HYPERFRAME_CARD_SHAPE_TYPE,
} from "./shapes/customShapes";
import { WhiteboardContext, type WhiteboardContextValue } from "./WhiteboardContext";
import { syncProjectCardsToCanvas } from "./whiteboardSync";
import type { TimelineProject } from "@/core/timeline/types";
import type { RepurposeArtboardFraming } from "@/core/timeline/repurposeTypes";
import { setWhiteboardSnapshot } from "@/core/timeline/repurposeCommands";
import { RepurposeArtboardCard } from "../RepurposeArtboardCard";
import { HyperframeCard } from "../HyperframeCard";

const offlineAssetUrls = getTldrawOfflineAssetUrls();

export interface RepurposeWhiteboardCanvasProps {
	project: TimelineProject;
	boardProject: TimelineProject;
	artboardProjectViews: Map<string, TimelineProject>;
	activePlayingId: string | null;
	setActivePlayingId: (id: string | null) => void;
	onChange: (updater: (prev: TimelineProject) => TimelineProject) => void;
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

export function RepurposeWhiteboardCanvas({
	project,
	boardProject,
	artboardProjectViews,
	activePlayingId,
	setActivePlayingId,
	onChange,
	onOpenArtboardEditor,
	onOpenHyperframeEditor,
	onUpdateFraming,
	onResetFraming,
	onRemoveArtboard,
	onDuplicateArtboard,
	onRenameArtboard,
	onRemoveHyperframe,
	onDuplicateHyperframe,
	onRenameHyperframe,
	onDropAsset,
}: RepurposeWhiteboardCanvasProps) {
	const editorRef = useRef<Editor | null>(null);
	const [, setEditorInstance] = useState<Editor | null>(null);
	const initialSnapshotRef = useRef(project.whiteboardSnapshot);
	const onChangeRef = useRef(onChange);
	const projectRef = useRef(project);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		projectRef.current = project;
	}, [project]);

	const contextValue: WhiteboardContextValue = useMemo(
		() => ({
			project,
			boardProject,
			artboardProjectViews,
			activePlayingId,
			setActivePlayingId,
			onOpenArtboardEditor,
			onOpenHyperframeEditor,
			onUpdateFraming,
			onResetFraming,
			onRemoveArtboard,
			onDuplicateArtboard,
			onRenameArtboard,
			onRemoveHyperframe,
			onDuplicateHyperframe,
			onRenameHyperframe,
			onDropAsset,
		}),
		[
			project,
			boardProject,
			artboardProjectViews,
			activePlayingId,
			setActivePlayingId,
			onOpenArtboardEditor,
			onOpenHyperframeEditor,
			onUpdateFraming,
			onResetFraming,
			onRemoveArtboard,
			onDuplicateArtboard,
			onRenameArtboard,
			onRemoveHyperframe,
			onDuplicateHyperframe,
			onRenameHyperframe,
			onDropAsset,
		],
	);

	// Synchronize project artboard/hyperframe card additions or removals with canvas
	useEffect(() => {
		if (editorRef.current) {
			syncProjectCardsToCanvas(editorRef.current, project);
		}
	}, [project.repurposeBoard?.artboards, project.hyperframes]);

	const handleMount = (editor: Editor) => {
		editorRef.current = editor;
		setEditorInstance(editor);

		// Initialize user preferences for dark studio theme and enable dot grid
		editor.user.updateUserPreferences({ colorScheme: "dark" });
		editor.updateInstanceState({ isGridMode: true });

		// Protect video cards from accidental canvas deletion via Backspace/Delete keyboard shortcuts
		const removeBeforeDelete = editor.sideEffects.registerBeforeDeleteHandler(
			"shape",
			(shape, source) => {
				if (
					source === "user" &&
					((shape.type as string) === ARTBOARD_CARD_SHAPE_TYPE ||
						(shape.type as string) === HYPERFRAME_CARD_SHAPE_TYPE)
				) {
					// Disallow deleting cards via whiteboard canvas key; users should use the card's trash button
					return false;
				}
			},
		);

		// Initial synchronization of cards onto canvas
		syncProjectCardsToCanvas(editor, projectRef.current);

		let timeoutId: any = null;
		const removeListener = editor.store.listen(
			() => {
				if (timeoutId) clearTimeout(timeoutId);
				timeoutId = setTimeout(() => {
					const snapshot = editor.store.getStoreSnapshot();
					onChangeRef.current((prev) =>
						setWhiteboardSnapshot(
							prev,
							snapshot as unknown as Record<string, unknown>,
						),
					);
				}, 400);
			},
			{ scope: "document" },
		);

		return () => {
			removeBeforeDelete();
			if (timeoutId) {
				clearTimeout(timeoutId);
				const snapshot = editor.store.getStoreSnapshot();
				onChangeRef.current((prev) =>
					setWhiteboardSnapshot(
						prev,
						snapshot as unknown as Record<string, unknown>,
					),
				);
			}
			removeListener();
		};
	};

	// Headless / SSR fallback for server rendering and unit test harnesses
	if (typeof window === "undefined") {
		return (
			<WhiteboardContext.Provider value={contextValue}>
				<div className="repurpose-board-stage">
					<div className="repurpose-artboards-grid">
						{boardProject.repurposeBoard?.artboards.map((artboard) => (
							<div key={artboard.id} className="repurpose-card-slot">
								<RepurposeArtboardCard
									artboard={artboard}
									rootProject={boardProject}
									artboardProject={artboardProjectViews.get(artboard.id)}
									activePlayingId={activePlayingId}
									displayHeight={360}
									onPlayingChange={(isPlaying) =>
										setActivePlayingId(isPlaying ? artboard.id : null)
									}
									onOpenArtboardEditor={onOpenArtboardEditor}
									onRename={(newName) => onRenameArtboard(artboard.id, newName)}
									onUpdateFraming={(patch) => onUpdateFraming(artboard.id, patch)}
									onResetFraming={() => onResetFraming(artboard.id)}
									onRemove={() => onRemoveArtboard(artboard.id)}
									onDuplicate={() => onDuplicateArtboard(artboard.id)}
									onDropAsset={(assetId) => onDropAsset?.(artboard.id, assetId)}
								/>
							</div>
						))}
						{project.hyperframes?.map((hf) => (
							<div key={hf.id} className="repurpose-card-slot">
								<HyperframeCard
									hyperframe={hf}
									displayHeight={360}
									onOpenEditor={() => onOpenHyperframeEditor?.(hf.id)}
									onRename={(newName) => onRenameHyperframe(hf.id, newName)}
									onDuplicate={() => onDuplicateHyperframe(hf.id)}
									onRemove={() => onRemoveHyperframe(hf.id)}
								/>
							</div>
						))}
					</div>
				</div>
			</WhiteboardContext.Provider>
		);
	}

	return (
		<WhiteboardContext.Provider value={contextValue}>
			<div className="tldraw-whiteboard-wrapper tl-theme__dark">
				<Tldraw
					key={project.projectId}
					assetUrls={offlineAssetUrls}
					shapeUtils={customShapeUtils}
					snapshot={initialSnapshotRef.current as any}
					onMount={handleMount}
				/>
			</div>
		</WhiteboardContext.Provider>
	);
}
