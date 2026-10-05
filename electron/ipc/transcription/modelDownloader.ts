import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { app } from "electron";

export type WhisperModelVariant = "tiny" | "base" | "small";

export const MODEL_URLS: Record<WhisperModelVariant, string> = {
	tiny: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
	base: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin",
	small: "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin",
};

export const MODEL_APPROX_SIZES_MB: Record<WhisperModelVariant, number> = {
	tiny: 75,
	base: 142,
	small: 466,
};

export function getModelsDirectory(): string {
	try {
		return path.join(app.getPath("userData"), "models");
	} catch {
		return path.join(process.cwd(), "models");
	}
}

const activeDownloads = new Map<
	string,
	Promise<{ success: boolean; modelPath?: string; error?: string }>
>();

/**
 * Downloads a Whisper GGML model from Hugging Face with progress callbacks.
 */
export async function downloadWhisperModel(
	modelName: WhisperModelVariant = "base",
	onProgress?: (progress: {
		percent: number;
		downloadedBytes: number;
		totalBytes: number;
	}) => void,
): Promise<{ success: boolean; modelPath?: string; error?: string }> {
	const existing = activeDownloads.get(modelName);
	if (existing) {
		return existing;
	}

	const task = (async () => {
		const modelsDir = getModelsDirectory();
		await fsPromises.mkdir(modelsDir, { recursive: true });

		const targetPath = path.join(modelsDir, `ggml-${modelName}.bin`);
		const tempPath = path.join(modelsDir, `ggml-${modelName}.bin.downloading`);

		// Check if valid model already exists
		try {
			const stat = await fsPromises.stat(targetPath);
			if (stat.size > 10 * 1024 * 1024) {
				onProgress?.({ percent: 100, downloadedBytes: stat.size, totalBytes: stat.size });
				return { success: true, modelPath: targetPath };
			}
		} catch {}

		const url = MODEL_URLS[modelName] || MODEL_URLS.base;
		const res = await fetch(url, { redirect: "follow" });

		if (!res.ok) {
			throw new Error(`Failed to download model: HTTP ${res.status} ${res.statusText}`);
		}

		const totalBytes = Number(res.headers.get("content-length") || 0);
		if (!res.body) {
			throw new Error("Download stream was empty");
		}

		const reader = res.body.getReader();
		const fileStream = fs.createWriteStream(tempPath);

		let downloadedBytes = 0;
		let lastEmitTime = 0;

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const canContinue = fileStream.write(Buffer.from(value));
				if (!canContinue) {
					await new Promise((resolve) => fileStream.once("drain", resolve));
				}

				downloadedBytes += value.length;
				const now = Date.now();
				if (now - lastEmitTime > 150 || (totalBytes > 0 && downloadedBytes >= totalBytes)) {
					lastEmitTime = now;
					const percent =
						totalBytes > 0
							? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
							: 0;
					onProgress?.({ percent, downloadedBytes, totalBytes });
				}
			}

			await new Promise<void>((resolve, reject) => {
				fileStream.end((err?: Error | null) => {
					if (err) reject(err);
					else resolve();
				});
			});

			// Finalize atomic move
			await fsPromises.rename(tempPath, targetPath);

			onProgress?.({ percent: 100, downloadedBytes, totalBytes: downloadedBytes });
			return { success: true, modelPath: targetPath };
		} catch (err) {
			fileStream.destroy();
			await fsPromises.rm(tempPath, { force: true }).catch(() => undefined);
			throw err;
		}
	})();

	activeDownloads.set(modelName, task);
	try {
		const result = await task;
		return result;
	} finally {
		activeDownloads.delete(modelName);
	}
}

/**
 * Returns all whisper GGML models downloaded in the models directory.
 */
export async function getAvailableWhisperModels(): Promise<
	Array<{ name: string; path: string; sizeBytes: number }>
> {
	const modelsDir = getModelsDirectory();
	const result: Array<{ name: string; path: string; sizeBytes: number }> = [];
	try {
		const files = await fsPromises.readdir(modelsDir);
		for (const file of files) {
			if (file.startsWith("ggml-") && file.endsWith(".bin")) {
				const fullPath = path.join(modelsDir, file);
				try {
					const stat = await fsPromises.stat(fullPath);
					const name = file.replace(/^ggml-/, "").replace(/\.bin$/, "");
					result.push({ name, path: fullPath, sizeBytes: stat.size });
				} catch {}
			}
		}
	} catch {}
	return result;
}
