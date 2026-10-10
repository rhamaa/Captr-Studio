import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ALLOWED_EXTENSIONS = new Set(["webm", "wav", "mp3", "m4a", "ogg"]);

function isWithinDirectory(directory: string, candidate: string): boolean {
	const relative = path.relative(directory, candidate);
	return (
		relative !== "" &&
		relative !== ".." &&
		!relative.startsWith(`..${path.sep}`) &&
		!path.isAbsolute(relative)
	);
}

async function resolveVoiceoversDirectory(recordingsDir: string) {
	const recordingsRoot = path.resolve(recordingsDir);
	await fs.mkdir(recordingsRoot, { recursive: true });
	const recordingsRealPath = await fs.realpath(recordingsRoot);
	const voiceoversPath = path.join(recordingsRoot, "voiceovers");
	await fs.mkdir(voiceoversPath, { recursive: true });
	const voiceoversRealPath = await fs.realpath(voiceoversPath);
	if (!isWithinDirectory(recordingsRealPath, voiceoversRealPath))
		throw new Error("Voiceover directory is outside the recordings directory");
	return { voiceoversPath, voiceoversRealPath };
}

function toBuffer(audioBuffer: ArrayBuffer | Uint8Array | number[]): Buffer {
	if (audioBuffer instanceof Uint8Array) {
		return Buffer.from(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.byteLength);
	}
	if (audioBuffer instanceof ArrayBuffer) return Buffer.from(audioBuffer);
	if (Array.isArray(audioBuffer)) return Buffer.from(audioBuffer);
	throw new Error("No audio buffer provided");
}

export async function writeRecordedAudio(
	recordingsDir: string,
	payload: { audioBuffer: ArrayBuffer | Uint8Array | number[]; extension?: string },
): Promise<string> {
	if (!payload || !payload.audioBuffer) throw new Error("No audio buffer provided");
	const extension = (payload.extension ?? "webm").replace(/^\./, "").toLowerCase();
	if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error("Unsupported audio extension");
	const buffer = toBuffer(payload.audioBuffer);
	if (buffer.byteLength === 0) throw new Error("Recorded audio buffer is empty");

	const { voiceoversPath } = await resolveVoiceoversDirectory(recordingsDir);
	const filePath = path.join(
		voiceoversPath,
		`voiceover-${Date.now()}-${randomUUID()}.${extension}`,
	);
	await fs.writeFile(filePath, buffer, { flag: "wx" });
	return filePath;
}

export async function discardRecordedAudioFile(
	recordingsDir: string,
	filePath: string,
): Promise<boolean> {
	if (typeof filePath !== "string" || !filePath.trim())
		throw new Error("Invalid voiceover file path");
	const recordingsRealPath = await fs.realpath(path.resolve(recordingsDir));
	const voiceoversPath = path.resolve(recordingsRealPath, "voiceovers");
	const candidatePath = path.resolve(filePath);
	if (!isWithinDirectory(voiceoversPath, candidatePath))
		throw new Error("File path is not owned by the voiceovers directory");
	let voiceoversRealPath: string;
	try {
		voiceoversRealPath = await fs.realpath(voiceoversPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw error;
	}
	if (!isWithinDirectory(recordingsRealPath, voiceoversRealPath))
		throw new Error("Voiceover directory is outside the recordings directory");

	let candidateRealPath: string;
	try {
		candidateRealPath = await fs.realpath(candidatePath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw error;
	}
	if (!isWithinDirectory(voiceoversRealPath, candidateRealPath))
		throw new Error("Voiceover file resolves outside its owned directory");
	const info = await fs.stat(candidateRealPath);
	if (!info.isFile()) throw new Error("Only temporary voiceover files can be discarded");
	await fs.rm(candidatePath);
	return true;
}
