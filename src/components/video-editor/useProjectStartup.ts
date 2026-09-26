import { useEffect, type Dispatch, type SetStateAction } from "react";
import { loadEditorPreferences } from "./editorPreferences";
import { fromFileUrl, resolveVideoUrl } from "./projectPaths";
import { getDevOpenRecordingConfig, getSmokeExportConfig } from "./smokeExportConfig";
import type { EditorProjectData, ProjectEditorState } from "./projectPersistence";
import {
	DEFAULT_WEBCAM_TIME_OFFSET_MS,
	type ClipEntry,
} from "./types";

type SmokeExportConfig = ReturnType<typeof getSmokeExportConfig>;
type DevOpenRecordingConfig = ReturnType<typeof getDevOpenRecordingConfig>;
type InitialEditorPreferences = ReturnType<typeof loadEditorPreferences>;

interface UseProjectStartupOptions {
	autoApplyFreshRecordingAutoZooms: boolean;
	applyInitialEditorPreferences: () => void;
	applyLoadedProject: (candidate: unknown, path?: string | null) => Promise<boolean>;
	clearPendingFreshRecordingAutoZoom: () => void;
	devOpenRecordingConfig: DevOpenRecordingConfig;
	initialEditorPreferences: InitialEditorPreferences;
	requestFreshRecordingAutoZoom: (sourceUrl: string | null) => void;
	setClipRegions: Dispatch<SetStateAction<ProjectEditorState["clipRegions"]>>;
	setClips: Dispatch<SetStateAction<ClipEntry[]>>;
	setCurrentProjectPath: Dispatch<SetStateAction<string | null>>;
	setError: Dispatch<SetStateAction<string | null>>;
	setLastSavedSnapshot: Dispatch<SetStateAction<EditorProjectData | null>>;
	setLoading: Dispatch<SetStateAction<boolean>>;
	setSelectedClipId: Dispatch<SetStateAction<string | null>>;
	setVideoPath: Dispatch<SetStateAction<string | null>>;
	setVideoSourcePath: Dispatch<SetStateAction<string | null>>;
	setViewMode: Dispatch<SetStateAction<"welcome" | "editor">>;
	setWebcam: Dispatch<SetStateAction<ProjectEditorState["webcam"]>>;
	smokeExportConfig: SmokeExportConfig;
}

export function useProjectStartup({
	autoApplyFreshRecordingAutoZooms,
	applyInitialEditorPreferences,
	applyLoadedProject,
	clearPendingFreshRecordingAutoZoom,
	devOpenRecordingConfig,
	initialEditorPreferences,
	requestFreshRecordingAutoZoom,
	setClipRegions,
	setClips,
	setCurrentProjectPath,
	setError,
	setLastSavedSnapshot,
	setLoading,
	setSelectedClipId,
	setVideoPath,
	setVideoSourcePath,
	setViewMode,
	setWebcam,
	smokeExportConfig,
}: UseProjectStartupOptions) {
	useEffect(() => {
		async function loadInitialData() {
			try {
				if (smokeExportConfig.enabled && smokeExportConfig.projectPath) {
					const projectResult = await window.electronAPI.openProjectFileAtPath(
						smokeExportConfig.projectPath,
					);
					if (!projectResult.success || !projectResult.project) {
						setError(
							`Smoke export failed to load project ${smokeExportConfig.projectPath}: ${
								projectResult.error || projectResult.message || "unknown error"
							}`,
						);
						return;
					}
					const restored = await applyLoadedProject(
						projectResult.project,
						projectResult.path ?? smokeExportConfig.projectPath,
					);
					if (!restored) {
						setError(
							`Smoke export could not apply project ${smokeExportConfig.projectPath}`,
						);
						return;
					}
					setError(null);
					return;
				}

				if (!smokeExportConfig.enabled && devOpenRecordingConfig.inputPath) {
					const sourcePath = fromFileUrl(devOpenRecordingConfig.inputPath);
					const sourceVideoUrl = await resolveVideoUrl(sourcePath);
					const webcamSourcePath = devOpenRecordingConfig.webcamInputPath
						? fromFileUrl(devOpenRecordingConfig.webcamInputPath)
						: null;
					setVideoSourcePath(sourcePath);
					setVideoPath(sourceVideoUrl);
					setCurrentProjectPath(null);
					setLastSavedSnapshot(null);
					requestFreshRecordingAutoZoom(
						autoApplyFreshRecordingAutoZooms ? sourceVideoUrl : null,
					);
					setWebcam((prev) => ({
						...prev,
						enabled: Boolean(webcamSourcePath),
						sourcePath: webcamSourcePath,
						timeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
					}));
					setError(null);
					return;
				}

				if (smokeExportConfig.enabled) {
					if (!smokeExportConfig.inputPath) {
						setError("Smoke export input path is missing.");
						return;
					}

					const sourcePath = fromFileUrl(smokeExportConfig.inputPath);
					const sourceVideoUrl = await resolveVideoUrl(sourcePath);
					const smokeWebcamSourcePath = smokeExportConfig.webcamInputPath
						? fromFileUrl(smokeExportConfig.webcamInputPath)
						: null;
					setVideoSourcePath(sourcePath);
					setVideoPath(sourceVideoUrl);
					setCurrentProjectPath(null);
					setLastSavedSnapshot(null);
					clearPendingFreshRecordingAutoZoom();
					setWebcam((prev) => ({
						...prev,
						enabled: !!smokeWebcamSourcePath,
						sourcePath: smokeWebcamSourcePath,
						timeOffsetMs: DEFAULT_WEBCAM_TIME_OFFSET_MS,
						shadow:
							smokeExportConfig.webcamShadow === undefined
								? prev.shadow
								: smokeExportConfig.webcamShadow,
						size:
							smokeExportConfig.webcamSize === undefined
								? prev.size
								: smokeExportConfig.webcamSize,
					}));
					setError(null);
					return;
				}

				const currentProjectResult = await window.electronAPI.loadCurrentProjectFile();
				if (currentProjectResult.success && currentProjectResult.project) {
					const restored = await applyLoadedProject(
						currentProjectResult.project,
						currentProjectResult.path ?? null,
					);
					if (restored) {
						// Re-apply user preferences so stale project data does not
						// overwrite the last-used padding, aspect ratio, export
						// settings, etc. that were saved to localStorage.
						applyInitialEditorPreferences();
						setViewMode("editor");
						return;
					}
				}

				// Fresh / empty studio startup in Captr Studio:
				// Clear any leftover stale recording session from main process memory
				// and present the Welcome / Home screen to the user.
				await window.electronAPI.clearCurrentVideoPath?.();
				setVideoSourcePath(null);
				setVideoPath(null);
				setClips([]);
				setClipRegions([]);
				setSelectedClipId(null);
				setError(null);
				setViewMode("welcome");
			} catch (err) {
				setError("Error loading video: " + String(err));
			} finally {
				setLoading(false);
			}
		}

		loadInitialData();
	}, [
		applyInitialEditorPreferences,
		applyLoadedProject,
		autoApplyFreshRecordingAutoZooms,
		clearPendingFreshRecordingAutoZoom,
		devOpenRecordingConfig.inputPath,
		devOpenRecordingConfig.webcamInputPath,
		initialEditorPreferences,
		requestFreshRecordingAutoZoom,
		setClipRegions,
		setClips,
		setCurrentProjectPath,
		setError,
		setLastSavedSnapshot,
		setLoading,
		setSelectedClipId,
		setVideoPath,
		setVideoSourcePath,
		setViewMode,
		setWebcam,
		smokeExportConfig.enabled,
		smokeExportConfig.inputPath,
		smokeExportConfig.projectPath,
		smokeExportConfig.webcamInputPath,
		smokeExportConfig.webcamShadow,
		smokeExportConfig.webcamSize,
	]);
}
