import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { dialog, ipcMain } from "electron";
import { buildMediaUrl, getMediaServerBaseUrl } from "../../../mediaServer";
import {
	rememberApprovedLocalReadPath,
	resolveApprovedLocalMediaPath,
} from "../../project/manager";
import { discardRecordedAudioFile, writeRecordedAudio } from "../../project/recordedAudioFile";
import { getRecordingsDir, normalizePath } from "../../utils";

export function registerProjectMediaHandlers() {
	ipcMain.handle("import-project-media", async (_, suppliedPaths?:string[]) => {
		try {
			const result=suppliedPaths?{canceled:false,filePaths:suppliedPaths}:await dialog.showOpenDialog({title:"Import media",properties:["openFile","multiSelections"],filters:[{name:"Media",extensions:["mp4","webm","mov","mkv","png","jpg","jpeg","webp","gif","wav","mp3","m4a","ogg","aac","flac"]}]});
			if(result.canceled)return {success:false,canceled:true,paths:[]};
			const paths:string[]=[];
			for(const file of result.filePaths){if(!/\.(mp4|webm|mov|mkv|png|jpe?g|webp|gif|wav|mp3|m4a|ogg|aac|flac)$/i.test(file))throw new Error("Unsupported media type");const real=await fs.realpath(file);if(!(await fs.stat(real)).isFile())throw new Error("Media source must be a file");paths.push(real);}
			for(const file of paths)await rememberApprovedLocalReadPath(file);
			return {success:true,paths};
		} catch(error){return {success:false,error:String(error),paths:[]};}
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
				extension?: string;
			},
		) => {
			let filePath: string | undefined;
			try {
				filePath = await writeRecordedAudio(await getRecordingsDir(), payload);
				const approvedPath = normalizePath(filePath);
				await rememberApprovedLocalReadPath(approvedPath);
				return { success: true, filePath: approvedPath };
			} catch (error) {
				if (filePath) {
					await discardRecordedAudioFile(await getRecordingsDir(), filePath).catch(() => false);
				}
				console.error("Failed to save recorded audio:", error);
				return { success: false, error: String(error) };
			}
		},
	);

	ipcMain.handle("discard-recorded-audio", async (_, filePath: string) => {
		try {
			const deleted = await discardRecordedAudioFile(await getRecordingsDir(), filePath);
			return { success: true, deleted };
		} catch (error) {
			return { success: false, deleted: false, error: String(error) };
		}
	});
}
