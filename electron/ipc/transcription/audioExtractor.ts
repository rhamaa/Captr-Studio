import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getFfmpegBinaryPath } from "../ffmpeg/binary";

export interface ExtractAudioOptions {
	outputWavPath?: string;
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
		inputMediaFilePath,
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
				reject(
					new Error(`FFmpeg audio extraction failed (code ${code}): ${stderr.slice(-300)}`),
				);
			}
		});
	});
}
