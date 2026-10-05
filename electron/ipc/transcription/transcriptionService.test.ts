import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetTranscript } from "../../../src/core/timeline/transcriptTypes";
import * as audioExtractor from "./audioExtractor";
import {
	loadAssetTranscript,
	transcribeAsset,
} from "./transcriptionService";
import * as whisperRunner from "./whisperRunner";

describe("transcriptionService", () => {
	let testDir: string;

	beforeEach(async () => {
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), "captr-test-transcribe-"));
	});

	afterEach(async () => {
		await fs.rm(testDir, { recursive: true, force: true }).catch(() => undefined);
		vi.restoreAllMocks();
	});

	const mockTranscript: AssetTranscript = {
		assetId: "test-asset",
		language: "id",
		durationUs: 5_000_000,
		segments: [
			{
				id: 0,
				text: "Halo dunia",
				startUs: 1_000_000,
				endUs: 4_000_000,
				words: [
					{ word: "Halo", startUs: 1_000_000, endUs: 2_000_000 },
					{ word: "dunia", startUs: 2_500_000, endUs: 4_000_000 },
				],
			},
		],
	};

	it("extracts audio, transcribes, and writes transcript.json & captions.vtt to asset directory", async () => {
		const tempWav = path.join(testDir, "temp.wav");
		await fs.writeFile(tempWav, "RIFF dummy wav data");

		vi.spyOn(audioExtractor, "extractAudioToWav").mockResolvedValue(tempWav);
		vi.spyOn(whisperRunner, "runLocalWhisper").mockResolvedValue(mockTranscript);

		const assetDir = path.join(testDir, "assets", "test-asset");
		const result = await transcribeAsset({
			assetId: "test-asset",
			assetMediaFilePath: path.join(testDir, "video.mp4"),
			assetDir,
		});

		expect(result.success).toBe(true);
		expect(result.transcript).toEqual(mockTranscript);

		// Check transcript.json exists
		const jsonPath = path.join(assetDir, "transcript.json");
		const jsonContent = await fs.readFile(jsonPath, "utf-8");
		const parsedJson = JSON.parse(jsonContent);
		expect(parsedJson.assetId).toBe("test-asset");
		expect(parsedJson.segments).toHaveLength(1);

		// Check captions.vtt exists
		const vttPath = path.join(assetDir, "captions.vtt");
		const vttContent = await fs.readFile(vttPath, "utf-8");
		expect(vttContent).toContain("WEBVTT");
		expect(vttContent).toContain("Halo dunia");

		// Load transcript
		const loaded = await loadAssetTranscript(assetDir);
		expect(loaded).toEqual(mockTranscript);
	});

	it("returns failure when extraction fails", async () => {
		vi.spyOn(audioExtractor, "extractAudioToWav").mockRejectedValue(
			new Error("FFmpeg not found"),
		);

		const assetDir = path.join(testDir, "assets", "bad-asset");
		const result = await transcribeAsset({
			assetId: "bad-asset",
			assetMediaFilePath: "bad.mp4",
			assetDir,
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain("FFmpeg not found");
	});
});
