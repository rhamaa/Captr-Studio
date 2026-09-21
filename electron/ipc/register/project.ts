import { randomUUID } from "node:crypto";
import { constants as fsConstants, existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import { RECORDINGS_DIR } from "../../appPaths";
import { buildMediaUrl, getMediaServerBaseUrl } from "../../mediaServer";
import { LEGACY_PROJECT_FILE_EXTENSIONS, PROJECT_FILE_EXTENSION } from "../constants";
import {
	getProjectsDir,
	getProjectThumbnailPath,
	isPathInsideDirectory,
	isTrustedProjectPath,
	listProjectLibraryEntries,
	loadProjectFromPath,
	loadRecentProjectPaths,
	persistRecordingsDirectorySetting,
	rememberApprovedLocalReadPath,
	rememberRecentProject,
	replaceApprovedSessionLocalReadPaths,
	resolveApprovedLocalMediaPath,
	saveRecentProjectPaths,
} from "../project/manager";
import { inspectProjectBundle, packProjectWorkspace } from "../project/projectBundle";
import {
	assignRecordingToSlide,
	convertProjectToBundleRelative,
	copyAssetToSlideWorkspace,
	ensureProjectWorkspace,
	stageCompanionAudioForRecording,
} from "../project/projectWorkspace";
import { persistRecordingSessionManifest, resolveRecordingSession } from "../project/session";
import {
	currentProjectPath,
	currentRecordingSession,
	currentVideoPath,
	setCurrentProjectPath,
	setCurrentRecordingSession,
	setCurrentVideoPath,
} from "../state";
import {
	approveUserPath,
	getRecordingsDir,
	getTelemetryPathForVideo,
	isAutoRecordingPath,
	normalizePath,
	normalizeVideoSourcePath,
	parseJsonWithByteOrderMark,
} from "../utils";

function normalizeRecordingTimeOffsetMs(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
	return typeof value === "boolean" ? value : fallback;
}

/**
 * Produces a filesystem-safe project base name without the project extension.
 */
function normalizeProjectSaveName(projectName?: string | null) {
	if (typeof projectName !== "string") {
		return null;
	}

	const trimmedName = projectName.trim();
	if (!trimmedName) {
		return null;
	}

	const withoutExtension = trimmedName.replace(
		new RegExp(`\\.${PROJECT_FILE_EXTENSION}$`, "i"),
		"",
	);
	const withoutInvalidFilesystemChars = withoutExtension.replace(/[<>:"/\\|?*]/g, "");
	const withoutControlChars = Array.from(withoutInvalidFilesystemChars)
		.filter((character) => character.charCodeAt(0) > 31)
		.join("");
	const sanitizedName = withoutControlChars
		.replace(/\s+/g, " ")
		.replace(/[. ]+$/g, "")
		.trim();

	return sanitizedName || null;
}

/**
 * Extracts the persisted source video path from a saved project payload.
 */
function getProjectVideoPath(projectData: unknown) {
	if (!projectData || typeof projectData !== "object") {
		return null;
	}

	const candidate = projectData as { videoPath?: unknown; clips?: unknown };
	if (typeof candidate.videoPath === "string" && candidate.videoPath) {
		return candidate.videoPath;
	}
	if (Array.isArray(candidate.clips) && candidate.clips.length > 0) {
		const firstClip = candidate.clips[0] as { videoPath?: unknown };
		if (typeof firstClip?.videoPath === "string" && firstClip.videoPath) {
			return firstClip.videoPath;
		}
	}
	return null;
}

function getProjectId(projectData: unknown) {
	if (!projectData || typeof projectData !== "object") {
		return null;
	}

	const candidate = projectData as { projectId?: unknown };
	return typeof candidate.projectId === "string" && candidate.projectId.trim().length > 0
		? candidate.projectId
		: null;
}

function withProjectId(projectData: unknown, projectId: string) {
	if (!projectData || typeof projectData !== "object" || Array.isArray(projectData)) {
		return projectData;
	}

	return {
		...projectData,
		projectId,
	};
}

function ensureProjectDataHasProjectId(projectData: unknown): {
	projectId: string;
	projectData: Record<string, unknown>;
} {
	const safeData =
		projectData && typeof projectData === "object" && !Array.isArray(projectData)
			? (projectData as Record<string, unknown>)
			: {};
	const existingProjectId = getProjectId(safeData);
	if (existingProjectId) {
		return {
			projectId: existingProjectId,
			projectData: safeData,
		};
	}

	const projectId = randomUUID();
	return {
		projectId,
		projectData: withProjectId(safeData, projectId) as Record<string, unknown>,
	};
}

async function resolveComparablePath(filePath: string) {
	return fs.realpath(filePath).catch(() => path.resolve(filePath));
}

/**
 * Prevents a named save from silently overwriting a different project file.
 */
async function ensureNamedProjectSaveDoesNotOverwriteDifferentProject(
	targetProjectPath: string,
	projectData: unknown,
	activeProjectPath?: string | null,
) {
	try {
		await fs.stat(targetProjectPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
			return { success: true };
		}
		throw error;
	}

	const targetResolvedPath = await resolveComparablePath(targetProjectPath);
	if (activeProjectPath) {
		const activeResolvedPath = await resolveComparablePath(activeProjectPath);
		if (activeResolvedPath === targetResolvedPath) {
			return { success: true };
		}
	}

	const incomingProjectId = getProjectId(projectData);
	const incomingVideoPath = getProjectVideoPath(projectData);

	try {
		const existingProjectRaw = await fs.readFile(targetProjectPath, "utf-8");
		const existingProjectData = parseJsonWithByteOrderMark(existingProjectRaw);
		const existingProjectId = getProjectId(existingProjectData);
		const existingVideoPath = getProjectVideoPath(existingProjectData);

		if (existingProjectId && incomingProjectId) {
			if (existingProjectId === incomingProjectId) {
				return { success: true };
			}

			return {
				success: false,
				message: "A different project already uses this name",
			};
		}

		if (existingVideoPath && incomingVideoPath && existingVideoPath !== incomingVideoPath) {
			return {
				success: false,
				message: "A different project already uses this name",
			};
		}

		if (!existingProjectId && !incomingProjectId && existingVideoPath && incomingVideoPath) {
			return {
				success: false,
				message: "Unable to verify project identity for the chosen name",
			};
		}

		return {
			success: false,
			message: "Unable to verify project identity for the chosen name",
		};
	} catch (error) {
		console.error("Failed to verify existing named project before overwrite:", error);
		return {
			success: false,
			message: "Unable to verify project identity for the chosen name",
		};
	}
}

export function registerProjectHandlers() {
	ipcMain.handle("reveal-in-folder", async (_, filePath: string) => {
		try {
			// shell.showItemInFolder doesn't return a value, it throws on error
			shell.showItemInFolder(filePath);
			return { success: true };
		} catch (error) {
			console.error(`Error revealing item in folder: ${filePath}`, error);
			// Fallback to open the directory if revealing the item fails
			// This might happen if the file was moved or deleted after export,
			// or if the path is somehow invalid for showItemInFolder
			try {
				const openPathResult = await shell.openPath(path.dirname(filePath));
				if (openPathResult) {
					// openPath returned an error message
					return { success: false, error: openPathResult };
				}
				return { success: true, message: "Could not reveal item, but opened directory." };
			} catch (openError) {
				console.error(`Error opening directory: ${path.dirname(filePath)}`, openError);
				return { success: false, error: String(error) };
			}
		}
	});

	ipcMain.handle("open-path", async (_, targetPath: string) => {
		try {
			const errorMsg = await shell.openPath(targetPath);
			if (errorMsg) {
				return { success: false, error: errorMsg };
			}
			return { success: true };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("open-recordings-folder", async () => {
		try {
			const recordingsDir = await getRecordingsDir();
			const openPathResult = await shell.openPath(recordingsDir);
			if (openPathResult) {
				return {
					success: false,
					error: openPathResult,
					message: "Failed to open recordings folder.",
				};
			}

			return { success: true };
		} catch (error) {
			console.error("Failed to open recordings folder:", error);
			return {
				success: false,
				error: String(error),
				message: "Failed to open recordings folder.",
			};
		}
	});

	ipcMain.handle("get-recordings-directory", async () => {
		try {
			const recordingsDir = await getRecordingsDir();
			return {
				success: true,
				path: recordingsDir,
				isDefault: recordingsDir === RECORDINGS_DIR,
			};
		} catch (error) {
			return {
				success: false,
				path: RECORDINGS_DIR,
				isDefault: true,
				error: String(error),
			};
		}
	});

	ipcMain.handle("choose-recordings-directory", async () => {
		try {
			const current = await getRecordingsDir();
			const result = await dialog.showOpenDialog({
				title: "Choose recordings folder",
				defaultPath: current,
				properties: ["openDirectory", "createDirectory", "promptToCreate"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true, path: current };
			}

			const selectedPath = path.resolve(result.filePaths[0]);
			await fs.mkdir(selectedPath, { recursive: true });
			await fs.access(selectedPath, fsConstants.W_OK);
			await persistRecordingsDirectorySetting(selectedPath);

			return {
				success: true,
				path: selectedPath,
				isDefault: selectedPath === RECORDINGS_DIR,
			};
		} catch (error) {
			return {
				success: false,
				error: String(error),
				message: "Failed to set recordings folder",
			};
		}
	});

	async function saveAndBundleProject(
		targetPath: string,
		preparedProject: { projectId: string; projectData: Record<string, unknown> },
		thumbnailDataUrl?: string | null,
	) {
		const projectId = preparedProject.projectId;
		const workspaceDir = await ensureProjectWorkspace(projectId);

		// Ensure any external files in clips are copied into their respective slide folders
		const stagedProjectData = JSON.parse(JSON.stringify(preparedProject.projectData));
		const normWorkspace = workspaceDir.replace(/\\/g, "/").toLowerCase();

		if (Array.isArray(stagedProjectData.clips)) {
			for (const clip of stagedProjectData.clips) {
				const slideId = clip.id || "slide-1";
				// Keep the original source path so companion sidecar audio can be
				// located even after the video is staged into the workspace.
				const originalVideoPath =
					typeof clip.videoPath === "string" ? clip.videoPath : null;
				// Stages an external file reference into the slide workspace so the
				// .captr bundle stays self-contained (portable across devices).
				const stageExternalFile = async (
					value: unknown,
					subfolder: string,
				): Promise<string | null> => {
					if (typeof value !== "string" || !value) {
						return null;
					}
					if (value.replace(/\\/g, "/").toLowerCase().startsWith(normWorkspace)) {
						return value;
					}
					try {
						await fs.access(value);
						const res = await copyAssetToSlideWorkspace(
							workspaceDir,
							slideId,
							value,
							subfolder,
						);
						return res.absolutePath;
					} catch {
						return value; // keep original when the source is inaccessible
					}
				};
				if (
					clip.videoPath &&
					!clip.videoPath.replace(/\\/g, "/").toLowerCase().startsWith(normWorkspace)
				) {
					try {
						await fs.access(clip.videoPath);
						const res = await assignRecordingToSlide(
							workspaceDir,
							slideId,
							clip.videoPath,
							"main",
						);
						clip.videoPath = res.absolutePath;
					} catch {
						// keep original
					}
				}
				if (
					clip.webcamPath &&
					!clip.webcamPath.replace(/\\/g, "/").toLowerCase().startsWith(normWorkspace)
				) {
					try {
						await fs.access(clip.webcamPath);
						const res = await assignRecordingToSlide(
							workspaceDir,
							slideId,
							clip.webcamPath,
							"webcam",
						);
						clip.webcamPath = res.absolutePath;
					} catch {
						// keep original
					}
				}
				if (
					clip.cursorTelemetryPath &&
					!clip.cursorTelemetryPath
						.replace(/\\/g, "/")
						.toLowerCase()
						.startsWith(normWorkspace)
				) {
					try {
						await fs.access(clip.cursorTelemetryPath);
						const res = await assignRecordingToSlide(
							workspaceDir,
							slideId,
							clip.cursorTelemetryPath,
							"cursor",
						);
						clip.cursorTelemetryPath = res.absolutePath;
					} catch {
						// keep original
					}
				}
				if (Array.isArray(clip.assetFiles)) {
					for (const asset of clip.assetFiles) {
						if (
							asset.path &&
							!asset.path.replace(/\\/g, "/").toLowerCase().startsWith(normWorkspace)
						) {
							try {
								await fs.access(asset.path);
								const res = await copyAssetToSlideWorkspace(
									workspaceDir,
									slideId,
									asset.path,
									asset.subfolder,
								);
								asset.path = res.absolutePath;
							} catch {
								// keep original
							}
						}
					}
				}
				// Custom webcam replacement footage (clip-level and editor-level)
				if (clip.webcam && typeof clip.webcam === "object" && !Array.isArray(clip.webcam)) {
					const stagedWebcamSource = await stageExternalFile(clip.webcam.sourcePath, "webcam");
					if (stagedWebcamSource !== null) {
						clip.webcam.sourcePath = stagedWebcamSource;
					}
				}
				// Legacy media track layers (per-clip overlay media)
				if (Array.isArray(clip.mediaTrackLayers)) {
					for (const layer of clip.mediaTrackLayers) {
						if (!layer) continue;
						const stagedLayerSource = await stageExternalFile(layer.sourcePath, "layers");
						if (stagedLayerSource !== null) {
							layer.sourcePath = stagedLayerSource;
						}
					}
				}
				// Legacy audio tracks
				if (Array.isArray(clip.audioTracks)) {
					for (const track of clip.audioTracks) {
						if (!track) continue;
						const stagedTrackSource = await stageExternalFile(track.sourcePath, "audio");
						if (stagedTrackSource !== null) {
							track.sourcePath = stagedTrackSource;
						}
					}
				}
				if (Array.isArray(clip.audioRegions)) {
					for (const audio of clip.audioRegions) {
						if (
							audio.audioPath &&
							!audio.audioPath
								.replace(/\\/g, "/")
								.toLowerCase()
								.startsWith(normWorkspace)
						) {
							try {
								await fs.access(audio.audioPath);
								const res = await copyAssetToSlideWorkspace(
									workspaceDir,
									slideId,
									audio.audioPath,
									"audio",
								);
								audio.audioPath = res.absolutePath;
							} catch {
								// keep original
							}
						}
					}
				}
				if (
					clip.microphoneAudioPath &&
					!clip.microphoneAudioPath
						.replace(/\\/g, "/")
						.toLowerCase()
						.startsWith(normWorkspace)
				) {
					try {
						await fs.access(clip.microphoneAudioPath);
						const res = await copyAssetToSlideWorkspace(
							workspaceDir,
							slideId,
							clip.microphoneAudioPath,
							"audio",
						);
						clip.microphoneAudioPath = res.absolutePath;
					} catch {
						// keep original
					}
				}
				if (
					clip.systemAudioPath &&
					!clip.systemAudioPath
						.replace(/\\/g, "/")
						.toLowerCase()
						.startsWith(normWorkspace)
				) {
					try {
						await fs.access(clip.systemAudioPath);
						const res = await copyAssetToSlideWorkspace(
							workspaceDir,
							slideId,
							clip.systemAudioPath,
							"audio",
						);
						clip.systemAudioPath = res.absolutePath;
					} catch {
						// keep original
					}
				}
				// Stage companion sidecar audio (mic/system) recorded alongside the
				// clip's video. Fresh recordings keep these files next to the source
				// video and the editor discovers them by deriving sidecar names from
				// videoPath — without copying them into the workspace they would be
				// missing from the .captr bundle and audio would be lost on reload.
				if (
					(!clip.microphoneAudioPath || !clip.systemAudioPath) &&
					typeof clip.videoPath === "string" &&
					clip.videoPath.replace(/\\/g, "/").toLowerCase().startsWith(normWorkspace)
				) {
					try {
						const stagedAudio = await stageCompanionAudioForRecording(
							originalVideoPath ?? clip.videoPath,
							clip.videoPath,
						);
						if (!clip.microphoneAudioPath && stagedAudio.microphoneAudioPath) {
							clip.microphoneAudioPath = stagedAudio.microphoneAudioPath;
						}
						if (!clip.systemAudioPath && stagedAudio.systemAudioPath) {
							clip.systemAudioPath = stagedAudio.systemAudioPath;
						}
					} catch {
						// Missing sidecar audio must not break saving.
					}
				}
			}
		}

		// Editor-level custom webcam replacement footage
		const editorState = stagedProjectData.editor;
		if (
			editorState &&
			typeof editorState === "object" &&
			editorState.webcam &&
			typeof editorState.webcam === "object" &&
			!Array.isArray(editorState.webcam)
		) {
			const editorWebcam = editorState.webcam as { sourcePath?: unknown };
			const sourcePath = editorWebcam.sourcePath;
			if (
				typeof sourcePath === "string" &&
				sourcePath &&
				!sourcePath.replace(/\\/g, "/").toLowerCase().startsWith(normWorkspace)
			) {
				try {
					await fs.access(sourcePath);
					const slideDir = Array.isArray(stagedProjectData.clips)
						? (stagedProjectData.clips[0] as { id?: string } | undefined)?.id || "slide-1"
						: "slide-1";
					const res = await copyAssetToSlideWorkspace(
						workspaceDir,
						slideDir,
						sourcePath,
						"webcam",
					);
					editorWebcam.sourcePath = res.absolutePath;
				} catch {
					// keep original when the source is inaccessible
				}
			}
		}

		// Write thumbnail into workspace if provided
		if (thumbnailDataUrl) {
			const match = thumbnailDataUrl.match(/^data:image\/png;base64,(.+)$/);
			if (match) {
				await fs
					.writeFile(
						path.join(workspaceDir, "thumbnail.png"),
						Buffer.from(match[1], "base64"),
					)
					.catch(() => undefined);
			}
		} else if (thumbnailDataUrl === null) {
			// Explicit clear — drop any previously embedded thumbnail.
			await fs
				.rm(path.join(workspaceDir, "thumbnail.png"), { force: true })
				.catch(() => undefined);
		}

		// Write project.json with bundle-relative paths for serialization
		const bundleRelativeData = convertProjectToBundleRelative(stagedProjectData, workspaceDir);
		await fs.writeFile(
			path.join(workspaceDir, "project.json"),
			JSON.stringify(bundleRelativeData, null, 2),
			"utf-8",
		);

		// Pack workspace into .captr ZIP bundle
		await packProjectWorkspace(workspaceDir, targetPath);

		setCurrentProjectPath(targetPath);
		// The preview thumbnail is embedded in the bundle as thumbnail.png.
		// Remove any loose legacy ".preview.png" sidecar left by older saves.
		await fs.rm(getProjectThumbnailPath(targetPath), { force: true }).catch(() => undefined);
		await rememberRecentProject(targetPath);

		return stagedProjectData;
	}

	ipcMain.handle(
		"save-project-file",
		async (
			_,
			projectData: unknown,
			suggestedName?: string,
			existingProjectPath?: string,
			thumbnailDataUrl?: string | null,
		) => {
			try {
				const projectsDir = await getProjectsDir();
				const preparedProject = ensureProjectDataHasProjectId(projectData);
				const trustedExistingProjectPath = isTrustedProjectPath(existingProjectPath)
					? existingProjectPath
					: null;

				if (trustedExistingProjectPath) {
					await saveAndBundleProject(
						trustedExistingProjectPath,
						preparedProject,
						thumbnailDataUrl,
					);
					return {
						success: true,
						path: trustedExistingProjectPath,
						projectId: preparedProject.projectId,
						message: "Project saved successfully",
					};
				}

				const safeName = normalizeProjectSaveName(suggestedName) || `project-${Date.now()}`;
				const defaultName = `${safeName}.${PROJECT_FILE_EXTENSION}`;

				const result = await dialog.showSaveDialog({
					title: "Save Captr Studio Project",
					defaultPath: path.join(projectsDir, defaultName),
					filters: [
						{ name: "Captr Studio Project", extensions: [PROJECT_FILE_EXTENSION] },
						{ name: "JSON", extensions: ["json"] },
					],
					properties: ["createDirectory", "showOverwriteConfirmation"],
				});

				if (result.canceled || !result.filePath) {
					return {
						success: false,
						canceled: true,
						message: "Save project canceled",
					};
				}

				await saveAndBundleProject(result.filePath, preparedProject, thumbnailDataUrl);

				return {
					success: true,
					path: result.filePath,
					projectId: preparedProject.projectId,
					message: "Project saved successfully",
				};
			} catch (error) {
				console.error("Failed to save project file:", error);
				return {
					success: false,
					message: "Failed to save project file",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle(
		"save-project-file-named",
		async (_, projectData: unknown, projectName: string, thumbnailDataUrl?: string | null) => {
			try {
				const normalizedProjectName = normalizeProjectSaveName(projectName);
				if (!normalizedProjectName) {
					return {
						success: false,
						message: "Project name is required",
					};
				}

				const projectsDir = await getProjectsDir();
				const preparedProject = ensureProjectDataHasProjectId(projectData);
				const activeProjectPath = isTrustedProjectPath(currentProjectPath)
					? currentProjectPath
					: null;
				const targetProjectPath = path.join(
					projectsDir,
					`${normalizedProjectName}.${PROJECT_FILE_EXTENSION}`,
				);

				const overwriteCheck = await ensureNamedProjectSaveDoesNotOverwriteDifferentProject(
					targetProjectPath,
					preparedProject.projectData,
					activeProjectPath,
				);
				if (!overwriteCheck.success) {
					return overwriteCheck;
				}

				await saveAndBundleProject(targetProjectPath, preparedProject, thumbnailDataUrl);

				if (activeProjectPath) {
					const [activeResolvedPath, targetResolvedPath] = await Promise.all([
						resolveComparablePath(activeProjectPath),
						resolveComparablePath(targetProjectPath),
					]);

					if (activeResolvedPath !== targetResolvedPath) {
						await fs
							.unlink(activeProjectPath)
							.catch((unlinkError: NodeJS.ErrnoException) => {
								if (unlinkError.code !== "ENOENT") {
									throw unlinkError;
								}
							});
						await fs
							.rm(getProjectThumbnailPath(activeProjectPath), { force: true })
							.catch(() => undefined);

						const recentProjectPaths = await loadRecentProjectPaths();
						const filteredRecentProjectPaths: string[] = [];
						for (const recentProjectPath of recentProjectPaths) {
							const recentResolvedPath =
								await resolveComparablePath(recentProjectPath);
							if (recentResolvedPath !== activeResolvedPath) {
								filteredRecentProjectPaths.push(recentProjectPath);
							}
						}
						await saveRecentProjectPaths(filteredRecentProjectPaths);
					}
				}

				setCurrentProjectPath(targetProjectPath);

				return {
					success: true,
					path: targetProjectPath,
					projectId: preparedProject.projectId,
					message: "Project saved successfully",
				};
			} catch (error) {
				console.error("Failed to save named project file:", error);
				return {
					success: false,
					message: "Failed to save project file",
					error: String(error),
				};
			}
		},
	);

	ipcMain.handle("load-project-file", async () => {
		try {
			const projectsDir = await getProjectsDir();
			const result = await dialog.showOpenDialog({
				title: "Open Captr Studio Project",
				defaultPath: projectsDir,
				filters: [
					{
						name: "Captr Studio Project",
						extensions: [PROJECT_FILE_EXTENSION, ...LEGACY_PROJECT_FILE_EXTENSIONS],
					},
					{ name: "JSON", extensions: ["json"] },
					{ name: "All Files", extensions: ["*"] },
				],
				properties: ["openFile"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true, message: "Open project canceled" };
			}

			return await loadProjectFromPath(result.filePaths[0]);
		} catch (error) {
			console.error("Failed to load project file:", error);
			return {
				success: false,
				message: "Failed to load project file",
				error: String(error),
			};
		}
	});

	ipcMain.handle("load-current-project-file", async () => {
		try {
			if (!currentProjectPath) {
				return { success: false, message: "No active project" };
			}

			return await loadProjectFromPath(currentProjectPath);
		} catch (error) {
			console.error("Failed to load current project file:", error);
			return {
				success: false,
				message: "Failed to load current project file",
				error: String(error),
			};
		}
	});

	ipcMain.handle("get-projects-directory", async () => {
		try {
			return {
				success: true,
				path: await getProjectsDir(),
			};
		} catch (error) {
			return {
				success: false,
				error: String(error),
			};
		}
	});

	ipcMain.handle("list-project-files", async () => {
		try {
			const library = await listProjectLibraryEntries();
			return {
				success: true,
				projectsDir: library.projectsDir,
				entries: library.entries,
			};
		} catch (error) {
			return {
				success: false,
				projectsDir: null,
				entries: [],
				error: String(error),
			};
		}
	});

	ipcMain.handle("open-project-file-at-path", async (_, filePath: string) => {
		try {
			return await loadProjectFromPath(filePath);
		} catch (error) {
			console.error("Failed to open project file at path:", error);
			return {
				success: false,
				message: "Failed to open project file",
				error: String(error),
			};
		}
	});

	ipcMain.handle("open-projects-directory", async () => {
		try {
			const projectsDir = await getProjectsDir();
			const openPathResult = await shell.openPath(projectsDir);
			if (openPathResult) {
				return {
					success: false,
					error: openPathResult,
					message: "Failed to open projects folder.",
				};
			}

			return { success: true, path: projectsDir };
		} catch (error) {
			console.error("Failed to open projects folder:", error);
			return {
				success: false,
				error: String(error),
				message: "Failed to open projects folder.",
			};
		}
	});

	ipcMain.handle("inspect-project-file", async (_, filePath: string) => {
		try {
			if (!filePath) {
				return { success: false, error: "Project file path is required" };
			}
			return await inspectProjectBundle(filePath);
		} catch (error) {
			console.error("Failed to inspect project file:", error);
			return {
				success: false,
				filePath,
				fileName: path.basename(filePath),
				fileSize: 0,
				lastModified: 0,
				isBundle: false,
				entries: [],
				error: String(error),
			};
		}
	});

	ipcMain.handle("pick-and-inspect-project-file", async () => {
		try {
			const projectsDir = await getProjectsDir();
			const result = await dialog.showOpenDialog({
				title: "Select Captr Project to Preview",
				defaultPath: projectsDir,
				filters: [
					{
						name: "Captr Studio Project",
						extensions: [PROJECT_FILE_EXTENSION, ...LEGACY_PROJECT_FILE_EXTENSIONS],
					},
					{ name: "JSON", extensions: ["json"] },
					{ name: "All Files", extensions: ["*"] },
				],
				properties: ["openFile"],
			});

			if (result.canceled || result.filePaths.length === 0) {
				return { success: false, canceled: true };
			}

			return await inspectProjectBundle(result.filePaths[0]);
		} catch (error) {
			console.error("Failed to pick and inspect project file:", error);
			return {
				success: false,
				error: String(error),
			};
		}
	});

	ipcMain.handle(
		"import-asset-to-slide",
		async (_, projectId: string, slideId: string, sourcePath: string, subfolder?: string) => {
			try {
				const workspaceDir = await ensureProjectWorkspace(projectId);
				const result = await copyAssetToSlideWorkspace(
					workspaceDir,
					slideId,
					sourcePath,
					subfolder,
				);
				await rememberApprovedLocalReadPath(result.absolutePath);
				return {
					success: true,
					...result,
				};
			} catch (error) {
				return {
					success: false,
					error: String(error),
				};
			}
		},
	);
	ipcMain.handle(
		"set-current-video-path",
		async (
			_,
			path: string,
			options?: { preserveProjectPath?: boolean; hideOverlayCursorByDefault?: boolean },
		) => {
			setCurrentVideoPath(normalizeVideoSourcePath(path) ?? path);
			approveUserPath(currentVideoPath);
			const resolvedSession = (await resolveRecordingSession(currentVideoPath)) ?? {
				videoPath: currentVideoPath!,
				webcamPath: null,
				timeOffsetMs: 0,
			};

			const nextSession = {
				...resolvedSession,
				hideOverlayCursorByDefault:
					normalizeBoolean(options?.hideOverlayCursorByDefault) ||
					normalizeBoolean(resolvedSession.hideOverlayCursorByDefault),
			};

			setCurrentRecordingSession(nextSession);
			await replaceApprovedSessionLocalReadPaths(
				[resolvedSession.videoPath, resolvedSession.webcamPath],
				options?.preserveProjectPath,
			);

			if (nextSession.webcamPath) {
				await persistRecordingSessionManifest(nextSession);
			}

			if (!options?.preserveProjectPath) {
				setCurrentProjectPath(null);
			}

			for (const window of BrowserWindow.getAllWindows()) {
				if (!window.isDestroyed()) {
					window.webContents.send("recording-session-changed", nextSession);
				}
			}

			return { success: true, webcamPath: nextSession.webcamPath ?? null };
		},
	);

	ipcMain.handle(
		"set-current-recording-session",
		async (
			_,
			session: {
				videoPath: string;
				webcamPath?: string | null;
				timeOffsetMs?: number;
				hideOverlayCursorByDefault?: boolean;
			},
			options?: { preserveProjectPath?: boolean },
		) => {
			const normalizedVideoPath =
				normalizeVideoSourcePath(session.videoPath) ?? session.videoPath;
			setCurrentVideoPath(normalizedVideoPath);
			setCurrentRecordingSession({
				videoPath: normalizedVideoPath,
				webcamPath: normalizeVideoSourcePath(session.webcamPath ?? null),
				timeOffsetMs: normalizeRecordingTimeOffsetMs(session.timeOffsetMs),
				hideOverlayCursorByDefault: normalizeBoolean(session.hideOverlayCursorByDefault),
			});
			await rememberApprovedLocalReadPath(currentRecordingSession!.videoPath);
			await rememberApprovedLocalReadPath(currentRecordingSession!.webcamPath);
			if (!options?.preserveProjectPath) {
				setCurrentProjectPath(null);
			}
			await persistRecordingSessionManifest(currentRecordingSession!);

			for (const window of BrowserWindow.getAllWindows()) {
				if (!window.isDestroyed()) {
					window.webContents.send("recording-session-changed", currentRecordingSession);
				}
			}

			return { success: true };
		},
	);

	ipcMain.handle("get-current-recording-session", () => {
		if (!currentRecordingSession) {
			return { success: false };
		}

		return {
			success: true,
			session: currentRecordingSession,
		};
	});

	ipcMain.handle("get-current-video-path", () => {
		return currentVideoPath ? { success: true, path: currentVideoPath } : { success: false };
	});

	ipcMain.handle("clear-current-video-path", () => {
		setCurrentVideoPath(null);
		setCurrentRecordingSession(null);
		return { success: true };
	});

	ipcMain.handle("delete-recording-file", async (_, filePath: string) => {
		try {
			if (!filePath) {
				return { success: false, error: "Only auto-generated recordings can be deleted" };
			}
			const resolvedPath = await fs.realpath(filePath).catch(() => path.resolve(filePath));
			const recordingsDirRaw = await getRecordingsDir();
			const recordingsDir = await fs
				.realpath(recordingsDirRaw)
				.catch(() => path.resolve(recordingsDirRaw));
			if (
				!isPathInsideDirectory(resolvedPath, recordingsDir) ||
				!isAutoRecordingPath(resolvedPath)
			) {
				return { success: false, error: "Only auto-generated recordings can be deleted" };
			}
			await fs.unlink(resolvedPath);
			// Also delete the cursor telemetry sidecar if it exists
			const telemetryPath = getTelemetryPathForVideo(resolvedPath);
			await fs.unlink(telemetryPath).catch(() => undefined);
			const currentResolved = currentVideoPath
				? await fs.realpath(currentVideoPath).catch(() => currentVideoPath)
				: null;
			if (currentResolved === resolvedPath) {
				setCurrentVideoPath(null);
				setCurrentRecordingSession(null);
			}
			return { success: true };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});

	ipcMain.handle("get-local-media-url", async (_, filePath: string) => {
		const baseUrl = getMediaServerBaseUrl();
		if (!baseUrl || !filePath) {
			return { success: false as const };
		}
		const resolved = await resolveApprovedLocalMediaPath(filePath);
		if (!resolved) {
			const normalized = path.resolve(filePath);
			if (existsSync(normalized)) {
				console.warn(`[get-local-media-url] Blocked disallowed path: ${normalized}`);
			}
			return { success: false as const };
		}
		return { success: true as const, url: buildMediaUrl(baseUrl, resolved) };
	});

	ipcMain.handle("open-video-file-picker", async () => {
		const result = await dialog.showOpenDialog({
			title: "Select Video File",
			filters: [{ name: "Videos", extensions: ["mp4", "webm", "mov", "mkv"] }],
			properties: ["openFile"],
		});
		if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
			return { canceled: true, filePath: null };
		}
		const chosen = result.filePaths[0];
		await rememberApprovedLocalReadPath(chosen);
		return { canceled: false, filePath: chosen };
	});

	ipcMain.handle("open-audio-file-picker", async () => {
		const result = await dialog.showOpenDialog({
			title: "Select Audio File",
			filters: [{ name: "Audio", extensions: ["mp3", "wav", "aac", "m4a", "ogg"] }],
			properties: ["openFile"],
		});
		if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
			return { canceled: true, filePath: null };
		}
		const chosen = result.filePaths[0];
		await rememberApprovedLocalReadPath(chosen);
		return { canceled: false, filePath: chosen };
	});

	ipcMain.handle("approve-local-media-path", async (_, filePath: string) => {
		if (typeof filePath === "string" && filePath.trim()) {
			await rememberApprovedLocalReadPath(filePath);
			return { success: true };
		}
		return { success: false };
	});

	ipcMain.handle(
		"save-recorded-audio",
		async (
			_,
			payload: {
				audioBuffer: ArrayBuffer | Uint8Array | number[];
				slideId?: string | null;
				extension?: string;
			},
		) => {
			try {
				if (!payload || !payload.audioBuffer) {
					return { success: false, error: "No audio buffer provided" };
				}

				const ext = payload.extension ? payload.extension.replace(/^\./, "") : "webm";
				const fileName = `voiceover-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

				let targetDir: string;
				if (currentProjectPath) {
					const workspaceDir = await ensureProjectWorkspace(currentProjectPath);
					if (payload.slideId) {
						targetDir = path.join(workspaceDir, "slides", payload.slideId, "audio");
					} else {
						targetDir = path.join(workspaceDir, "audio");
					}
				} else {
					const recordingsDir = await getRecordingsDir();
					targetDir = path.join(recordingsDir, "voiceovers");
				}

				await fs.mkdir(targetDir, { recursive: true });
				const filePath = path.join(targetDir, fileName);

				const buffer = Buffer.isBuffer(payload.audioBuffer)
					? payload.audioBuffer
					: Buffer.from(payload.audioBuffer as ArrayBuffer);

				await fs.writeFile(filePath, buffer);
				await rememberApprovedLocalReadPath(filePath);

				return { success: true, filePath: normalizePath(filePath) };
			} catch (error) {
				console.error("Failed to save recorded audio:", error);
				return { success: false, error: String(error) };
			}
		},
	);
}
