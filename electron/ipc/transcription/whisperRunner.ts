import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { app } from "electron";
import type { AssetTranscript } from "../../../src/core/timeline/transcriptTypes";
import { getBundledWhisperExecutableCandidates } from "../paths/binaries";
import { parseCloudWhisperJson, parseWhisperCliJson } from "./whisperParser";

export interface WhisperRunOptions {
	language?: string; // 'auto', 'id', 'en', etc.
	modelPath?: string;
	cloudApiKey?: string;
	cloudProvider?: "groq" | "openai";
}

/**
 * Resolves the bundled whisper-cli executable.
 */
export function resolveWhisperCliExecutable(): string | null {
	const candidates = getBundledWhisperExecutableCandidates();
	for (const candidate of candidates) {
		if (existsSync(candidate)) {
			return candidate;
		}
	}
	return null;
}

/**
 * Resolves default Whisper GGML model path in userData or app directory.
 */
export function resolveWhisperModelPath(customPath?: string): string | null {
	if (customPath && existsSync(customPath)) {
		return customPath;
	}

	let modelsDir = path.join(process.cwd(), "models");
	try {
		modelsDir = path.join(app.getPath("userData"), "models");
	} catch {}

	if (customPath) {
		const namedPath = path.join(modelsDir, `ggml-${customPath}.bin`);
		if (existsSync(namedPath)) return namedPath;
	}

	const candidates = [
		path.join(modelsDir, "ggml-base.bin"),
		path.join(modelsDir, "ggml-tiny.bin"),
		path.join(modelsDir, "ggml-small.bin"),
		path.join(process.cwd(), "models", "ggml-base.bin"),
		path.join(process.cwd(), "models", "ggml-tiny.bin"),
		path.join(process.cwd(), "models", "ggml-small.bin"),
	];

	for (const p of candidates) {
		if (existsSync(p)) return p;
	}

	return null;
}

/**
 * Transcribes audio via local whisper-cli executable.
 */
export async function runLocalWhisper(
	wavAudioPath: string,
	assetId: string,
	options: WhisperRunOptions = {},
): Promise<AssetTranscript> {
	const cliBinary = resolveWhisperCliExecutable();
	if (!cliBinary) {
		throw new Error(
			"Whisper binary not found. Local speech-to-text requires bundled whisper-cli.",
		);
	}

	const modelPath = resolveWhisperModelPath(options.modelPath);
	if (!modelPath) {
		throw new Error(
			"Whisper model (.bin) not found. Please provide a GGML model (e.g. ggml-base.bin) or use Cloud API key.",
		);
	}

	const outputBasename = path.join(
		os.tmpdir(),
		`whisper-out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
	);

	const args = [
		"-m",
		modelPath,
		"-f",
		wavAudioPath,
		"-oj",
		"-sow",
		"-of",
		outputBasename,
		"-l",
		options.language || "auto",
		"-t",
		"4",
	];

	await new Promise<void>((resolve, reject) => {
		const proc = spawn(cliBinary, args, { windowsHide: true });
		let stderr = "";

		proc.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		proc.on("error", (err) => {
			reject(new Error(`Failed to start whisper-cli: ${err.message}`));
		});

		proc.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`whisper-cli failed (code ${code}): ${stderr.slice(-300)}`));
			}
		});
	});

	const jsonFile = `${outputBasename}.json`;
	try {
		const content = await fs.readFile(jsonFile, "utf-8");
		const parsed = JSON.parse(content);
		return parseWhisperCliJson(parsed, assetId);
	} finally {
		// Clean up temporary output files
		await fs.rm(jsonFile, { force: true }).catch(() => undefined);
		await fs.rm(`${outputBasename}.vtt`, { force: true }).catch(() => undefined);
	}
}

/**
 * Transcribes audio via Cloud Whisper API (Groq or OpenAI) for lightning-fast STT.
 */
export async function runCloudWhisper(
	wavAudioPath: string,
	assetId: string,
	options: WhisperRunOptions,
): Promise<AssetTranscript> {
	const apiKey = options.cloudApiKey?.trim();
	if (!apiKey) {
		throw new Error("Cloud API key is required for cloud transcription.");
	}

	const isGroq = options.cloudProvider === "groq" || apiKey.startsWith("gsk_");
	const endpoint = isGroq
		? "https://api.groq.com/openai/v1/audio/transcriptions"
		: "https://api.openai.com/v1/audio/transcriptions";
	const model = isGroq ? "whisper-large-v3-turbo" : "whisper-1";

	const fileBuffer = await fs.readFile(wavAudioPath);
	const blob = new Blob([fileBuffer], { type: "audio/wav" });

	const formData = new FormData();
	formData.append("file", blob, "audio.wav");
	formData.append("model", model);
	formData.append("response_format", "verbose_json");
	if (options.language && options.language !== "auto") {
		formData.append("language", options.language);
	}

	const response = await fetch(endpoint, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
		body: formData,
	});

	if (!response.ok) {
		const errText = await response.text();
		throw new Error(`Cloud Whisper API error (${response.status}): ${errText}`);
	}

	const json = (await response.json()) as Record<string, unknown>;
	return parseCloudWhisperJson(json, assetId);
}
