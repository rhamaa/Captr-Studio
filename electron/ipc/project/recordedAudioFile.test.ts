import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { discardRecordedAudioFile, writeRecordedAudio } from "./recordedAudioFile";

let root = "";
let outside = "";

beforeEach(async () => {
	root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-voiceover-test-"));
	outside = path.join(root, "outside");
	await fs.mkdir(outside);
});

afterEach(async () => {
	if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()))
		throw new Error("Unsafe test cleanup path");
	await fs.rm(root, { recursive: true, force: true });
});

describe("recorded voiceover files", () => {
	it("writes audio bytes under the voiceovers directory with a normalized allowed extension", async () => {
		const filePath = await writeRecordedAudio(root, {
			audioBuffer: new Uint8Array([1, 2, 3]),
			extension: ".WAV",
		});

		expect(path.dirname(filePath)).toBe(path.join(root, "voiceovers"));
		expect(filePath).toMatch(/\.wav$/);
		expect(await fs.readFile(filePath)).toEqual(Buffer.from([1, 2, 3]));
	});

	it("rejects an unsupported extension without creating a file", async () => {
		await expect(
			writeRecordedAudio(root, { audioBuffer: [1, 2, 3], extension: ".exe" }),
		).rejects.toThrow(/extension|audio/i);
		expect(await fs.readdir(root)).toEqual(["outside"]);
	});

	it("deletes a temporary audio file it owns", async () => {
		const filePath = await writeRecordedAudio(root, {
			audioBuffer: [4, 5],
			extension: "webm",
		});

		expect(await discardRecordedAudioFile(root, filePath)).toBe(true);
		expect(await fs.stat(filePath).catch(() => null)).toBeNull();
	});

	it("rejects a file outside voiceovers and leaves its bytes unchanged", async () => {
		const filePath = path.join(outside, "keep.wav");
		await fs.writeFile(filePath, "keep me");

		await expect(discardRecordedAudioFile(root, filePath)).rejects.toThrow(
			/voiceover|owned|path/i,
		);
		expect(await fs.readFile(filePath, "utf8")).toBe("keep me");
	});

	it("rejects traversal and a directory link that escapes voiceovers", async () => {
		const outsideFile = path.join(outside, "keep.wav");
		await fs.writeFile(outsideFile, "keep me");
		const traversal = path.join(root, "voiceovers", "..", "outside", "keep.wav");
		await expect(discardRecordedAudioFile(root, traversal)).rejects.toThrow(
			/voiceover|owned|path/i,
		);

		const voiceovers = path.join(root, "voiceovers");
		await fs.mkdir(voiceovers);
		const link = path.join(voiceovers, "escape");
		await fs.symlink(outside, link, process.platform === "win32" ? "junction" : "dir");
		await expect(discardRecordedAudioFile(root, path.join(link, "keep.wav"))).rejects.toThrow(
			/voiceover|owned|path/i,
		);
		expect(await fs.readFile(outsideFile, "utf8")).toBe("keep me");
	});
});
