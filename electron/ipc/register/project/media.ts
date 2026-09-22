import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { dialog, ipcMain } from "electron";
import { buildMediaUrl, getMediaServerBaseUrl } from "../../../mediaServer";
import {
	rememberApprovedLocalReadPath,
	resolveApprovedLocalMediaPath,
} from "../../project/manager";
import { copyAssetToSlideWorkspace, ensureProjectWorkspace } from "../../project/projectWorkspace";
import { currentProjectPath } from "../../state";
import { getRecordingsDir, normalizePath } from "../../utils";

export function registerProjectMediaHandlers() {
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
