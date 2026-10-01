import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { dialog, ipcMain } from "electron";
import { PROJECT_FILE_EXTENSION } from "../../constants";
import { stageTimelineProject } from "../../project/timelineBundle";
import { validateTimelineProject } from "../../../../src/core/timeline/validation";
import { getProjectsDir, isTrustedProjectPath, rememberRecentProject } from "../../project/manager";
import { inspectProjectBundle, packProjectWorkspace } from "../../project/projectBundle";
import { setCurrentProjectPath } from "../../state";
import { ensureProjectDataHasProjectId, normalizeProjectSaveName } from "./shared";
export function registerProjectSaveHandlers() {
	async function saveAndBundleProject(
		targetPath: string,
		preparedProject: { projectId: string; projectData: Record<string, unknown> },
		thumbnailDataUrl?: string | null,
	) {
		if (preparedProject.projectData.version === 3) {
			const project = validateTimelineProject(preparedProject.projectData);
			const staging = await fs.mkdtemp(path.join(os.tmpdir(), "captr-save-v3-"));
			try {
				await stageTimelineProject(project, staging);
				if (thumbnailDataUrl?.startsWith("data:image/png;base64,"))
					await fs.writeFile(
						path.join(staging, "thumbnail.png"),
						Buffer.from(thumbnailDataUrl.split(",")[1], "base64"),
					);
				await packProjectWorkspace(staging, targetPath);
			} finally {
				if (path.dirname(path.resolve(staging)) !== path.resolve(os.tmpdir()))
					throw new Error("Unsafe staging cleanup path");
				await fs.rm(staging, { recursive: true, force: true });
			}
			setCurrentProjectPath(targetPath);
			await rememberRecentProject(targetPath);
			return project;
		}
		throw new Error("Legacy project must be converted to an Assets project before saving");
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
				let targetProjectPath: string | null = null;
				if (
					typeof existingProjectPath === "string" &&
					existingProjectPath.trim() &&
					preparedProject.projectId
				) {
					const inspection = await inspectProjectBundle(existingProjectPath);
					if (
						inspection.success &&
						inspection.isBundle &&
						inspection.projectData?.projectId === preparedProject.projectId
					) {
						targetProjectPath = existingProjectPath;
					}
				}

				if (targetProjectPath) {
					if (!trustedExistingProjectPath) {
						console.warn(
							"[save-project-file] Restoring active project path after matching the saved project ID.",
						);
					}
					await saveAndBundleProject(
						targetProjectPath,
						preparedProject,
						thumbnailDataUrl,
					);
					return {
						success: true,
						path: targetProjectPath,
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
}
