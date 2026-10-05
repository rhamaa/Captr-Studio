import { ipcMain } from "electron";
import {
	type WhisperModelVariant,
	downloadWhisperModel,
	getAvailableWhisperModels,
} from "../transcription/modelDownloader";
import {
	type TranscribeAssetParams,
	type TranscribeAssetResult,
	loadAssetTranscript,
	transcribeAsset,
} from "../transcription/transcriptionService";
import {
	resolveWhisperCliExecutable,
	resolveWhisperModelPath,
} from "../transcription/whisperRunner";

export function registerTranscriptionHandlers() {
	ipcMain.handle(
		"transcribe-asset",
		async (_event, params: TranscribeAssetParams): Promise<TranscribeAssetResult> => {
			return transcribeAsset(params);
		},
	);

	ipcMain.handle(
		"load-asset-transcript",
		async (_event, assetDir: string) => {
			return loadAssetTranscript(assetDir);
		},
	);

	ipcMain.handle("get-transcription-engine-status", async () => {
		const cliPath = resolveWhisperCliExecutable();
		const modelPath = resolveWhisperModelPath();
		const availableModels = await getAvailableWhisperModels();
		return {
			hasLocalWhisperCli: Boolean(cliPath),
			cliPath,
			hasLocalModel: Boolean(modelPath),
			modelPath,
			availableModels,
		};
	});

	ipcMain.handle(
		"download-whisper-model",
		async (event, modelName: WhisperModelVariant = "base") => {
			try {
				const result = await downloadWhisperModel(modelName, (progress) => {
					if (!event.sender.isDestroyed()) {
						event.sender.send("whisper-model-download-progress", {
							modelName,
							...progress,
						});
					}
				});
				return result;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return {
					success: false,
					error: message,
				};
			}
		},
	);
}
