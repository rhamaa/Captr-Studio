import path from "node:path";
import { dialog, ipcMain, shell } from "electron";
import { LEGACY_PROJECT_FILE_EXTENSIONS, PROJECT_FILE_EXTENSION } from "../../constants";
import {
	getProjectsDir,
	listProjectLibraryEntries,
	loadProjectFromPath,
} from "../../project/manager";
import { inspectProjectBundle } from "../../project/projectBundle";
import { currentProjectPath } from "../../state";

export function registerProjectLoadHandlers() {
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
}
