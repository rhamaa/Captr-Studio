import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

/** A renderer-captured take stored in an owned subfolder of the recordings directory. */
interface OwnedTakeKind {
	directory: string;
	filePrefix: string;
	label: string;
	extensions: ReadonlySet<string>;
	defaultExtension: string;
}

const VOICEOVER: OwnedTakeKind = {
	directory: "voiceovers",
	filePrefix: "voiceover",
	label: "voiceover",
	extensions: new Set(["webm", "wav", "mp3", "m4a", "ogg"]),
	defaultExtension: "webm",
};

const MONOLOG: OwnedTakeKind = {
	directory: "monologs",
	filePrefix: "monolog",
	label: "monolog",
	extensions: new Set(["webm", "mp4"]),
	defaultExtension: "webm",
};

function isWithinDirectory(directory: string, candidate: string): boolean {
	const relative = path.relative(directory, candidate);
	return (
		relative !== "" &&
		relative !== ".." &&
		!relative.startsWith(`..${path.sep}`) &&
		!path.isAbsolute(relative)
	);
}

async function resolveOwnedDirectory(recordingsDir: string, kind: OwnedTakeKind) {
	const recordingsRoot = path.resolve(recordingsDir);
	await fs.mkdir(recordingsRoot, { recursive: true });
	const recordingsRealPath = await fs.realpath(recordingsRoot);
	const ownedPath = path.join(recordingsRoot, kind.directory);
	await fs.mkdir(ownedPath, { recursive: true });
	const ownedRealPath = await fs.realpath(ownedPath);
	if (!isWithinDirectory(recordingsRealPath, ownedRealPath))
		throw new Error(`The ${kind.label} directory is outside the recordings directory`);
	return ownedPath;
}

function toBuffer(data: ArrayBuffer | Uint8Array | number[], kind: OwnedTakeKind): Buffer {
	if (data instanceof Uint8Array) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
	if (data instanceof ArrayBuffer) return Buffer.from(data);
	if (Array.isArray(data)) return Buffer.from(data);
	throw new Error(`No ${kind.label} buffer provided`);
}

async function writeOwnedTake(
	recordingsDir: string,
	kind: OwnedTakeKind,
	data: ArrayBuffer | Uint8Array | number[] | undefined,
	rawExtension: string | undefined,
): Promise<string> {
	if (!data) throw new Error(`No ${kind.label} buffer provided`);
	const extension = (rawExtension ?? kind.defaultExtension).replace(/^\./, "").toLowerCase();
	if (!kind.extensions.has(extension)) throw new Error(`Unsupported ${kind.label} extension`);
	const buffer = toBuffer(data, kind);
	if (buffer.byteLength === 0) throw new Error(`Recorded ${kind.label} buffer is empty`);
	const ownedPath = await resolveOwnedDirectory(recordingsDir, kind);
	const filePath = path.join(
		ownedPath,
		`${kind.filePrefix}-${Date.now()}-${randomUUID()}.${extension}`,
	);
	await fs.writeFile(filePath, buffer, { flag: "wx" });
	return filePath;
}

async function discardOwnedTake(
	recordingsDir: string,
	kind: OwnedTakeKind,
	filePath: string,
): Promise<boolean> {
	if (typeof filePath !== "string" || !filePath.trim())
		throw new Error(`Invalid ${kind.label} file path`);
	const recordingsRealPath = await fs.realpath(path.resolve(recordingsDir));
	const ownedPath = path.resolve(recordingsRealPath, kind.directory);
	const candidatePath = path.resolve(filePath);
	if (!isWithinDirectory(ownedPath, candidatePath))
		throw new Error(`File path is not owned by the ${kind.directory} directory`);
	let ownedRealPath: string;
	try {
		ownedRealPath = await fs.realpath(ownedPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw error;
	}
	if (!isWithinDirectory(recordingsRealPath, ownedRealPath))
		throw new Error(`The ${kind.label} directory is outside the recordings directory`);

	let candidateRealPath: string;
	try {
		candidateRealPath = await fs.realpath(candidatePath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
		throw error;
	}
	if (!isWithinDirectory(ownedRealPath, candidateRealPath))
		throw new Error(`The ${kind.label} file resolves outside its owned directory`);
	const info = await fs.stat(candidateRealPath);
	if (!info.isFile()) throw new Error(`Only temporary ${kind.label} files can be discarded`);
	await fs.rm(candidatePath);
	return true;
}

export function writeRecordedAudio(
	recordingsDir: string,
	payload: { audioBuffer: ArrayBuffer | Uint8Array | number[]; extension?: string },
): Promise<string> {
	return writeOwnedTake(recordingsDir, VOICEOVER, payload?.audioBuffer, payload?.extension);
}

export function discardRecordedAudioFile(recordingsDir: string, filePath: string) {
	return discardOwnedTake(recordingsDir, VOICEOVER, filePath);
}

/**
 * Stores a Monolog camera take. Unlike `store-recorded-video`, this has no session,
 * project-path or cursor-telemetry side effects.
 */
export function writeRecordedMonolog(
	recordingsDir: string,
	payload: { videoBuffer: ArrayBuffer | Uint8Array | number[]; extension?: string },
): Promise<string> {
	return writeOwnedTake(recordingsDir, MONOLOG, payload?.videoBuffer, payload?.extension);
}

export function discardRecordedMonologFile(recordingsDir: string, filePath: string) {
	return discardOwnedTake(recordingsDir, MONOLOG, filePath);
}
