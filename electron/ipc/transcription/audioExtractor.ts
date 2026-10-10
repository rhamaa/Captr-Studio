import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getFfmpegBinaryPath } from "../ffmpeg/binary";

export interface ExtractAudioOptions {
	outputWavPath?: string;
}

async function resolveAudioSourcePath(inputPath: string): Promise<string> {
	const ext = path.extname(inputPath).toLowerCase();
	if ([".wav", ".m4a", ".mp3", ".aac", ".ogg", ".flac"].includes(ext)) {
		return inputPath;
	}

	const dir = path.dirname(inputPath);
	const baseName = path.basename(inputPath, ext);

	// Check companion audio candidates
	const candidates = [
		`${path.join(dir, baseName)}.mic.wav`,
		`${path.join(dir, baseName)}.mic.m4a`,
		`${path.join(dir, baseName)}.mic.webm`,
		path.join(dir, "mic.wav"),
		path.join(dir, "main.mic.wav"),
		`${path.join(dir, baseName)}.system.wav`,
		`${path.join(dir, baseName)}.system.m4a`,
		`${path.join(dir, baseName)}.system.webm`,
		path.join(dir, "system.wav"),
		path.join(dir, "main.system.wav"),
	];

	for (const candidate of candidates) {
		try {
			await fs.access(candidate);
			return candidate;
		} catch {}
	}

	return inputPath;
}

/**
 * Extracts audio track from media file (video/audio) and converts to 16kHz mono 16-bit PCM WAV.
 * This format is optimal for Whisper speech recognition.
 */
export async function extractAudioToWav(
	inputMediaFilePath: string,
	options: ExtractAudioOptions = {},
): Promise<string> {
	const ffmpegBin = getFfmpegBinaryPath();
	const audioSourcePath = await resolveAudioSourcePath(inputMediaFilePath);
	const targetPath =
		options.outputWavPath ??
		path.join(
			os.tmpdir(),
			`captr-stt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.wav`,
		);

	await fs.mkdir(path.dirname(targetPath), { recursive: true });

	const args = [
		"-y",
		"-i",
		audioSourcePath,
		"-vn",
		"-ar",
		"16000",
		"-ac",
		"1",
		"-c:a",
		"pcm_s16le",
		targetPath,
	];

	return new Promise<string>((resolve, reject) => {
		const proc = spawn(ffmpegBin, args, { windowsHide: true });
		let stderr = "";

		proc.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});

		proc.on("error", (err) => {
			reject(new Error(`Failed to execute FFmpeg for audio extraction: ${err.message}`));
		});

		proc.on("close", (code) => {
			if (code === 0) {
				resolve(targetPath);
			} else {
				if (
					stderr.includes("does not contain any stream") ||
					stderr.includes("does not contain any audio stream")
				) {
					reject(
						new Error(
							"No audio stream found. The recording or video has no microphone or audio track.",
						),
					);
				} else {
					reject(
						new Error(`FFmpeg audio extraction failed (code ${code}): ${stderr.slice(-300)}`),
					);
				}
			}
		});
	});
}
