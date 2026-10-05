import { ipcMain } from "electron";
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

	ipcMain.handle("get-transcription-engine-status", () => {
		const cliPath = resolveWhisperCliExecutable();
		const modelPath = resolveWhisperModelPath();
		return {
			hasLocalWhisperCli: Boolean(cliPath),
			cliPath,
			hasLocalModel: Boolean(modelPath),
			modelPath,
		};
	});
}
