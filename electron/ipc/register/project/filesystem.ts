import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { dialog, ipcMain, shell } from "electron";
import { RECORDINGS_DIR } from "../../../appPaths";
import { persistRecordingsDirectorySetting } from "../../project/manager";
import { getRecordingsDir } from "../../utils";

export function registerProjectFilesystemHandlers() {
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
}
