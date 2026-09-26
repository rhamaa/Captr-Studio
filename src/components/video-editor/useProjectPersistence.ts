import { useCallback, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { foldActiveAudioRegionsIntoClips } from "./clipsUtils";
import {
	createProjectData,
	type EditorProjectData,
	type ProjectEditorState,
} from "./projectPersistence";
import type { ClipEntry } from "./types";

export type SaveProjectOptions = {
	silent?: boolean;
	remountPreviewAfterSave?: boolean;
	refreshLibraryAfterSave?: boolean;
	captureThumbnail?: boolean;
};

interface UseProjectPersistenceOptions {
	activeSceneId: string | null;
	audioRegions: ProjectEditorState["audioRegions"];
	captureProjectThumbnail: () => Promise<string | null | undefined>;
	clearPendingProjectAutosave: () => void;
	clips: ClipEntry[];
	cloneProjectData: <T>(value: T) => T;
	currentPersistedEditorState: Partial<ProjectEditorState>;
	currentProjectPath: string | null;
	currentProjectSnapshot: EditorProjectData | null;
	currentSourcePath: string | null;
	lastSavedSnapshot: EditorProjectData | null;
	queueProjectSave: (task: () => Promise<boolean>) => Promise<boolean>;
	refreshProjectLibrary: () => Promise<void>;
	remountPreview: () => void;
	setCurrentProjectPath: Dispatch<SetStateAction<string | null>>;
	setLastSavedSnapshot: Dispatch<SetStateAction<EditorProjectData | null>>;
}

export function useProjectPersistence({
	activeSceneId,
	audioRegions,
	captureProjectThumbnail,
	clearPendingProjectAutosave,
	clips,
	cloneProjectData,
	currentPersistedEditorState,
	currentProjectPath,
	currentProjectSnapshot,
	currentSourcePath,
	lastSavedSnapshot,
	queueProjectSave,
	refreshProjectLibrary,
	remountPreview,
	setCurrentProjectPath,
	setLastSavedSnapshot,
}: UseProjectPersistenceOptions) {
	const saveProject = useCallback(
		async (forceSaveAs: boolean, options?: SaveProjectOptions) => {
			clearPendingProjectAutosave();
			return queueProjectSave(async () => {
				if (!currentSourcePath) {
					if (!options?.silent) {
						toast.error("No video loaded");
					}
					return false;
				}

				const shouldCaptureThumbnail = options?.captureThumbnail ?? true;
				const shouldRefreshLibrary = options?.refreshLibraryAfterSave ?? true;
				const shouldRemountPreview = options?.remountPreviewAfterSave ?? true;

				try {
					const projectData =
						currentProjectSnapshot?.videoPath === currentSourcePath && !forceSaveAs
							? currentProjectSnapshot
							: createProjectData(
									currentSourcePath,
									currentPersistedEditorState,
									forceSaveAs ? null : (lastSavedSnapshot?.projectId ?? null),
									foldActiveAudioRegionsIntoClips(
										clips,
										activeSceneId,
										audioRegions,
									),
								);

					const fileNameBase =
						currentSourcePath
							.split(/[\\/]/)
							.pop()
							?.replace(/\.[^.]+$/, "") || `project-${Date.now()}`;
					let targetProjectPath = forceSaveAs
						? undefined
						: (currentProjectPath ?? undefined);

					if (!forceSaveAs && !targetProjectPath) {
						const activeProjectResult =
							await window.electronAPI.loadCurrentProjectFile();
						if (activeProjectResult.success && activeProjectResult.path) {
							targetProjectPath = activeProjectResult.path;
							setCurrentProjectPath(activeProjectResult.path);
						}
					}

					const thumbnailDataUrl = shouldCaptureThumbnail
						? await captureProjectThumbnail()
						: undefined;

					const result = await window.electronAPI.saveProjectFile(
						projectData,
						fileNameBase,
						targetProjectPath,
						thumbnailDataUrl,
					);

					if (result.canceled) {
						if (!options?.silent) {
							toast.info("Project save canceled");
						}
						return false;
					}

					if (!result.success) {
						if (!options?.silent) {
							toast.error(result.message || "Failed to save project");
						}
						return false;
					}

					if (result.path) {
						setCurrentProjectPath(result.path);
					}
					setLastSavedSnapshot(
						cloneProjectData(
							createProjectData(
								projectData.videoPath,
								projectData.editor,
								result.projectId ?? projectData.projectId ?? null,
								projectData.clips,
							),
						),
					);
					if (shouldRefreshLibrary) {
						await refreshProjectLibrary();
					}

					if (!options?.silent) {
						toast.success(`Project saved to ${result.path}`);
					}
					return true;
				} finally {
					if (shouldRemountPreview) {
						remountPreview();
					}
				}
			});
		},
		[
			activeSceneId,
			audioRegions,
			captureProjectThumbnail,
			clearPendingProjectAutosave,
			clips,
			cloneProjectData,
			currentSourcePath,
			currentProjectPath,
			currentProjectSnapshot,
			currentPersistedEditorState,
			lastSavedSnapshot?.projectId,
			queueProjectSave,
			refreshProjectLibrary,
			remountPreview,
		],
	);

	const saveProjectWithName = useCallback(
		async (projectName: string) => {
			const trimmedProjectName = projectName.trim();
			if (!trimmedProjectName) {
				toast.error("Project name is required");
				return false;
			}

			if (!currentSourcePath) {
				toast.error("No video loaded");
				return false;
			}

			try {
				const projectData =
					currentProjectSnapshot?.videoPath === currentSourcePath
						? currentProjectSnapshot
						: createProjectData(
								currentSourcePath,
								currentPersistedEditorState,
								lastSavedSnapshot?.projectId ?? null,
								foldActiveAudioRegionsIntoClips(clips, activeSceneId, audioRegions),
							);
				const thumbnailDataUrl = await captureProjectThumbnail();
				const result = await window.electronAPI.saveProjectFileNamed(
					projectData,
					trimmedProjectName,
					thumbnailDataUrl,
				);

				if (result.canceled) {
					toast.info("Project save canceled");
					return false;
				}

				if (!result.success) {
					toast.error(result.message || "Failed to save project");
					return false;
				}

				if (result.path) {
					setCurrentProjectPath(result.path);
				}
				setLastSavedSnapshot(
					cloneProjectData(
						createProjectData(
							projectData.videoPath,
							projectData.editor,
							result.projectId ?? projectData.projectId ?? null,
							projectData.clips,
						),
					),
				);
				await refreshProjectLibrary();
				toast.success(result.path ? `Project saved to ${result.path}` : "Project saved");
				return true;
			} finally {
				remountPreview();
			}
		},
		[
			activeSceneId,
			audioRegions,
			captureProjectThumbnail,
			clips,
			cloneProjectData,
			currentPersistedEditorState,
			currentProjectSnapshot,
			currentSourcePath,
			lastSavedSnapshot?.projectId,
			refreshProjectLibrary,
			remountPreview,
		],
	);

	return { saveProject, saveProjectWithName };
}
