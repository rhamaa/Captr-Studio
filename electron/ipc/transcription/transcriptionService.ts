import fs from "node:fs/promises";
import path from "node:path";
import {
	type AssetTranscript,
	generateVttFromTranscript,
} from "../../../src/core/timeline/transcriptTypes";
import { extractAudioToWav } from "./audioExtractor";
import {
	type WhisperRunOptions,
	runCloudWhisper,
	runLocalWhisper,
} from "./whisperRunner";

export interface TranscribeAssetParams {
	assetId: string;
	assetMediaFilePath: string;
	assetDir?: string;
	options?: WhisperRunOptions;
}

export interface TranscribeAssetResult {
	success: boolean;
	transcript?: AssetTranscript;
	vttPath?: string;
	jsonPath?: string;
	error?: string;
}

/**
 * High-level service: extracts audio from media, runs speech recognition,
 * and writes transcript.json & captions.vtt directly into the asset's directory.
 */
export async function transcribeAsset(
	params: TranscribeAssetParams,
): Promise<TranscribeAssetResult> {
	let tempWavPath: string | null = null;
	try {
		// 1. Extract audio track to 16kHz mono WAV
		tempWavPath = await extractAudioToWav(params.assetMediaFilePath);

		// 2. Perform Speech-to-Text inference
		let transcript: AssetTranscript;
		if (params.options?.cloudApiKey?.trim()) {
			transcript = await runCloudWhisper(tempWavPath, params.assetId, params.options);
		} else {
			transcript = await runLocalWhisper(tempWavPath, params.assetId, params.options ?? {});
		}

		// 3. Ensure target asset directory exists
		const targetDir = params.assetDir?.trim() || path.dirname(params.assetMediaFilePath);
		await fs.mkdir(targetDir, { recursive: true });

		const jsonPath = path.join(targetDir, "transcript.json");
		const vttPath = path.join(targetDir, "captions.vtt");

		// 4. Save transcript.json and captions.vtt
		await fs.writeFile(jsonPath, JSON.stringify(transcript, null, 2), "utf-8");
		const vttContent = generateVttFromTranscript(transcript);
		await fs.writeFile(vttPath, vttContent, "utf-8");

		return {
			success: true,
			transcript,
			jsonPath,
			vttPath,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			error: message,
		};
	} finally {
		if (tempWavPath) {
			await fs.rm(tempWavPath, { force: true }).catch(() => undefined);
		}
	}
}

/**
 * Loads an existing transcript for an asset if present.
 * Accepts either an asset directory or a media/json file path.
 */
export async function loadAssetTranscript(
	assetDirOrPath: string,
): Promise<AssetTranscript | null> {
	try {
		if (!assetDirOrPath) return null;
		let jsonPath = assetDirOrPath;
		if (!jsonPath.endsWith(".json")) {
			try {
				const stat = await fs.stat(assetDirOrPath);
				if (stat.isDirectory()) {
					jsonPath = path.join(assetDirOrPath, "transcript.json");
				} else {
					jsonPath = path.join(path.dirname(assetDirOrPath), "transcript.json");
				}
			} catch {
				jsonPath = path.join(path.dirname(assetDirOrPath), "transcript.json");
			}
		}
		const content = await fs.readFile(jsonPath, "utf-8");
		return JSON.parse(content) as AssetTranscript;
	} catch {
		return null;
	}
}
