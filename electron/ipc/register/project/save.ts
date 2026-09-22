import fs from "node:fs/promises";
import path from "node:path";
import { dialog, ipcMain } from "electron";
import { PROJECT_FILE_EXTENSION } from "../../constants";
import {
	getProjectsDir,
	getProjectThumbnailPath,
	isTrustedProjectPath,
	loadRecentProjectPaths,
	rememberRecentProject,
	saveRecentProjectPaths,
} from "../../project/manager";
import { packProjectWorkspace } from "../../project/projectBundle";
import {
	assignRecordingToSlide,
	convertProjectToBundleRelative,
	copyAssetToSlideWorkspace,
	ensureProjectWorkspace,
	stageCompanionAudioForRecording,
} from "../../project/projectWorkspace";
import { currentProjectPath, setCurrentProjectPath } from "../../state";
import {
	ensureNamedProjectSaveDoesNotOverwriteDifferentProject,
	ensureProjectDataHasProjectId,
	normalizeProjectSaveName,
	resolveComparablePath,
} from "./shared";

export function registerProjectSaveHandlers() {
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
		// Tracks each clip's media paths BEFORE staging so root-level legacy fields
		// (which duplicate the first clip's paths) can be mirrored afterwards.
		const originalMediaPathsByClip = new Map<object, Record<string, string | null>>();

		if (Array.isArray(stagedProjectData.clips)) {
			for (const clip of stagedProjectData.clips) {
				const slideId = clip.id || "slide-1";
				// Keep the original source path so companion sidecar audio can be
				// located even after the video is staged into the workspace.
				const originalVideoPath =
					typeof clip.videoPath === "string" ? clip.videoPath : null;
				originalMediaPathsByClip.set(clip, {
					videoPath: originalVideoPath,
					webcamPath: typeof clip.webcamPath === "string" ? clip.webcamPath : null,
					cursorTelemetryPath:
						typeof clip.cursorTelemetryPath === "string"
							? clip.cursorTelemetryPath
							: null,
					microphoneAudioPath:
						typeof clip.microphoneAudioPath === "string"
							? clip.microphoneAudioPath
							: null,
					systemAudioPath:
						typeof clip.systemAudioPath === "string" ? clip.systemAudioPath : null,
				});

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
					const stagedWebcamSource = await stageExternalFile(
						clip.webcam.sourcePath,
						"webcam",
					);
					if (stagedWebcamSource !== null) {
						clip.webcam.sourcePath = stagedWebcamSource;
					}
				}
				// Legacy media track layers (per-clip overlay media)
				if (Array.isArray(clip.mediaTrackLayers)) {
					for (const layer of clip.mediaTrackLayers) {
						if (!layer) continue;
						const stagedLayerSource = await stageExternalFile(
							layer.sourcePath,
							"layers",
						);
						if (stagedLayerSource !== null) {
							layer.sourcePath = stagedLayerSource;
						}
					}
				}
				// Legacy audio tracks
				if (Array.isArray(clip.audioTracks)) {
					for (const track of clip.audioTracks) {
						if (!track) continue;
						const stagedTrackSource = await stageExternalFile(
							track.sourcePath,
							"audio",
						);
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

		// Root-level legacy media fields duplicate the first clip's paths. Mirror
		// each one to the staged workspace copy of whichever clip originally
		// referenced the same file, so the serialized project never points outside
		// the bundle. When no clip references the file, stage it directly.
		const ROOT_MEDIA_FIELDS = [
			"videoPath",
			"webcamPath",
			"cursorTelemetryPath",
			"microphoneAudioPath",
			"systemAudioPath",
		] as const;
		for (const field of ROOT_MEDIA_FIELDS) {
			const rootValue = stagedProjectData[field];
			if (typeof rootValue !== "string" || !rootValue) {
				continue;
			}
			if (rootValue.replace(/\\/g, "/").toLowerCase().startsWith(normWorkspace)) {
				continue;
			}

			let mirrored = false;
			if (Array.isArray(stagedProjectData.clips)) {
				for (const clip of stagedProjectData.clips) {
					const originals = originalMediaPathsByClip.get(clip);
					if (originals?.[field] === rootValue && typeof clip[field] === "string") {
						stagedProjectData[field] = clip[field];
						mirrored = true;
						break;
					}
				}
			}

			if (!mirrored && (field === "videoPath" || field === "webcamPath")) {
				try {
					await fs.access(rootValue);
					const firstSlideId =
						Array.isArray(stagedProjectData.clips) && stagedProjectData.clips.length > 0
							? ((stagedProjectData.clips[0] as { id?: string }).id ?? "slide-1")
							: "slide-1";
					const res = await assignRecordingToSlide(
						workspaceDir,
						firstSlideId,
						rootValue,
						field === "videoPath" ? "main" : "webcam",
					);
					stagedProjectData[field] = res.absolutePath;
				} catch {
					// keep original — load-time bundle validation surfaces a clear error
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
						? (stagedProjectData.clips[0] as { id?: string } | undefined)?.id ||
							"slide-1"
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
}
