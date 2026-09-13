import { createWriteStream } from "node:fs";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import { get as httpsGet } from "node:https";
import type Electron from "electron";
import {
	WHISPER_MODEL_DIR,
	WHISPER_BASE_MODEL_DOWNLOAD_URL,
	WHISPER_BASE_MODEL_PATH,
	WHISPER_SMALL_MODEL_DOWNLOAD_URL,
	WHISPER_SMALL_MODEL_PATH,
} from "../constants";

export type WhisperModelType = "base" | "small";

export function getWhisperModelPath(modelType: WhisperModelType = "small"): string {
	return modelType === "base" ? WHISPER_BASE_MODEL_PATH : WHISPER_SMALL_MODEL_PATH;
}

export function getWhisperModelUrl(modelType: WhisperModelType = "small"): string {
	return modelType === "base"
		? WHISPER_BASE_MODEL_DOWNLOAD_URL
		: WHISPER_SMALL_MODEL_DOWNLOAD_URL;
}

export async function getWhisperModelStatus(modelType: WhisperModelType = "small") {
	const modelPath = getWhisperModelPath(modelType);
	try {
		await fs.access(modelPath, fsConstants.R_OK);
		return {
			success: true,
			exists: true,
			path: modelPath,
		};
	} catch {
		return {
			success: true,
			exists: false,
			path: null,
		};
	}
}

export async function getWhisperSmallModelStatus() {
	return getWhisperModelStatus("small");
}

export function downloadFileWithProgress(
	url: string,
	destinationPath: string,
	onProgress: (progress: number) => void,
): Promise<void> {
	const request = (currentUrl: string, redirectCount = 0): Promise<void> => {
		return new Promise((resolve, reject) => {
			const req = httpsGet(currentUrl, { timeout: 30_000 }, (response) => {
				const statusCode = response.statusCode ?? 0;
				const location = response.headers.location;

				if (statusCode >= 300 && statusCode < 400 && location) {
					response.resume();
					if (redirectCount >= 5) {
						reject(new Error("Too many redirects while downloading Whisper model."));
						return;
					}

					const nextUrl = new URL(location, currentUrl).toString();
					void request(nextUrl, redirectCount + 1)
						.then(resolve)
						.catch(reject);
					return;
				}

				if (statusCode < 200 || statusCode >= 300) {
					response.resume();
					reject(new Error(`Whisper model download failed with status ${statusCode}.`));
					return;
				}

				const totalBytes = Number.parseInt(
					String(response.headers["content-length"] ?? "0"),
					10,
				);
				let downloadedBytes = 0;
				const fileStream = createWriteStream(destinationPath);

				response.on("data", (chunk: Buffer) => {
					downloadedBytes += chunk.length;
					if (Number.isFinite(totalBytes) && totalBytes > 0) {
						onProgress(Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)));
					}
				});

				response.on("error", (error) => {
					fileStream.destroy(error);
				});

				fileStream.on("error", (error) => {
					response.destroy(error);
					reject(error);
				});

				fileStream.on("finish", () => {
					onProgress(100);
					resolve();
				});

				response.pipe(fileStream);
			});

			req.on("error", reject);
			req.on("timeout", () => {
				req.destroy(new Error("Whisper model download timed out."));
			});
		});
	};

	return request(url);
}

export function sendWhisperModelDownloadProgress(
	webContents: Electron.WebContents,
	payload: {
		status: "idle" | "downloading" | "downloaded" | "error";
		progress: number;
		path?: string | null;
		error?: string;
	},
) {
	webContents.send("whisper-small-model-download-progress", payload);
}

export async function downloadWhisperModel(
	webContents: Electron.WebContents,
	modelType: WhisperModelType = "small",
): Promise<string> {
	await fs.mkdir(WHISPER_MODEL_DIR, { recursive: true });
	const modelPath = getWhisperModelPath(modelType);
	const downloadUrl = getWhisperModelUrl(modelType);
	const tempPath = `${modelPath}.download`;

	sendWhisperModelDownloadProgress(webContents, {
		status: "downloading",
		progress: 0,
		path: null,
	});

	try {
		await fs.rm(tempPath, { force: true });
		await downloadFileWithProgress(downloadUrl, tempPath, (progress) => {
			sendWhisperModelDownloadProgress(webContents, {
				status: "downloading",
				progress,
				path: null,
			});
		});
		await fs.rename(tempPath, modelPath);
		sendWhisperModelDownloadProgress(webContents, {
			status: "downloaded",
			progress: 100,
			path: modelPath,
		});
		return modelPath;
	} catch (error) {
		await fs.rm(tempPath, { force: true }).catch(() => undefined);
		sendWhisperModelDownloadProgress(webContents, {
			status: "error",
			progress: 0,
			path: null,
			error: String(error),
		});
		throw error;
	}
}

export async function downloadWhisperSmallModel(webContents: Electron.WebContents): Promise<string> {
	return downloadWhisperModel(webContents, "small");
}

export async function deleteWhisperModel(modelType: WhisperModelType = "small"): Promise<void> {
	await fs.rm(getWhisperModelPath(modelType), { force: true });
}

export async function deleteWhisperSmallModel(): Promise<void> {
	return deleteWhisperModel("small");
}
