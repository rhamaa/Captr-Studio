/**
 * Regression Tests — Companion Audio Sidecar Staging
 *
 * Bug: audio from a fresh "Video Record" session plays in the editor, but after
 * saving the project as a .captr bundle, closing the app, and reloading the
 * project, the recorded audio is gone.
 *
 * Root cause: sidecar audio files (`<video>.mic.wav`, `<video>.system.wav`,
 * and their `<sidecar>.json` timing metadata) live next to the source video in
 * the recordings directory. `saveAndBundleProject` staged only the video into
 * the workspace (`slides/<id>/main.mp4`), so the sidecars were never packed
 * into the bundle. On reload, sidecar candidates derived from the workspace
 * video path (`slides/<id>/main.mic.wav`, ...) did not exist.
 *
 * These tests validate that `stageCompanionAudioForRecording` copies every
 * supported sidecar layout (and its timing metadata) next to the staged video.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
	app: {
		isPackaged: false,
		getAppPath: () => os.tmpdir(),
		getPath: (name: string) => path.join(os.tmpdir(), name),
		setPath: () => undefined,
	},
}));

import { stageCompanionAudioForRecording } from "./projectWorkspace";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tempRoot: string;
let recordingsDir: string;
let workspaceDir: string;
let slideDir: string;

async function writeFile(dir: string, name: string, contents: string | Buffer) {
	const filePath = path.join(dir, name);
	await fs.mkdir(path.dirname(filePath), { recursive: true });
	await fs.writeFile(filePath, contents);
	return filePath;
}

async function exists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

// Returned paths are normalized via path.resolve (OS-native separators),
// matching assignRecordingToSlide.
const norm = (p: string) => path.resolve(p);

beforeEach(async () => {
	tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "captr-companion-audio-"));
	recordingsDir = path.join(tempRoot, "recordings");
	workspaceDir = path.join(tempRoot, "workspaces", "proj-1");
	slideDir = path.join(workspaceDir, "slides", "s1");
	await fs.mkdir(recordingsDir, { recursive: true });
	await fs.mkdir(slideDir, { recursive: true });
});

afterEach(async () => {
	await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
});

// ---------------------------------------------------------------------------
// Bug condition: fresh recording staged into the workspace
// ---------------------------------------------------------------------------

describe("stageCompanionAudioForRecording — fresh recording staged into workspace", () => {
	it("copies Windows .wav sidecars and timing metadata next to the staged video", async () => {
		const sourceVideo = await writeFile(recordingsDir, "recording-1.mp4", "video");
		await writeFile(recordingsDir, "recording-1.mic.wav", Buffer.from([1, 2, 3]));
		await writeFile(recordingsDir, "recording-1.system.wav", Buffer.from([4, 5, 6]));
		await writeFile(
			recordingsDir,
			"recording-1.mic.wav.json",
			JSON.stringify({ startDelayMs: 120 }),
		);

		const stagedVideo = await writeFile(slideDir, "main.mp4", "video");

		const result = await stageCompanionAudioForRecording(sourceVideo, stagedVideo);

		const stagedMic = path.join(slideDir, "main.mic.wav");
		const stagedSystem = path.join(slideDir, "main.system.wav");

		expect(result.microphoneAudioPath).toBe(norm(stagedMic));
		expect(result.systemAudioPath).toBe(norm(stagedSystem));

		// Sidecar contents staged next to the workspace video
		expect(await fs.readFile(stagedMic)).toEqual(Buffer.from([1, 2, 3]));
		expect(await fs.readFile(stagedSystem)).toEqual(Buffer.from([4, 5, 6]));

		// Timing metadata follows the sidecar so start-delay alignment survives
		const stagedMetadata = `${stagedMic}.json`;
		expect(await exists(stagedMetadata)).toBe(true);
		const metadata = JSON.parse(await fs.readFile(stagedMetadata, "utf-8"));
		expect(metadata.startDelayMs).toBe(120);
	});

	it("copies macOS .m4a sidecars when those are the ones present", async () => {
		const sourceVideo = await writeFile(recordingsDir, "recording-2.mp4", "video");
		await writeFile(recordingsDir, "recording-2.mic.m4a", Buffer.from([7]));

		const stagedVideo = await writeFile(slideDir, "main.mp4", "video");

		const result = await stageCompanionAudioForRecording(sourceVideo, stagedVideo);

		expect(result.microphoneAudioPath).toBe(norm(path.join(slideDir, "main.mic.m4a")));
		expect(result.systemAudioPath).toBeNull();
	});

	it("returns nulls when the recording has no sidecar audio", async () => {
		const sourceVideo = await writeFile(recordingsDir, "recording-3.mp4", "video");
		const stagedVideo = await writeFile(slideDir, "main.mp4", "video");

		const result = await stageCompanionAudioForRecording(sourceVideo, stagedVideo);

		expect(result.microphoneAudioPath).toBeNull();
		expect(result.systemAudioPath).toBeNull();
	});

	it("ignores zero-byte sidecar files (mirrors usable-candidate semantics)", async () => {
		const sourceVideo = await writeFile(recordingsDir, "recording-4.mp4", "video");
		await writeFile(recordingsDir, "recording-4.mic.wav", Buffer.alloc(0));

		const stagedVideo = await writeFile(slideDir, "main.mp4", "video");

		const result = await stageCompanionAudioForRecording(sourceVideo, stagedVideo);

		expect(result.microphoneAudioPath).toBeNull();
		expect(await exists(path.join(slideDir, "main.mic.wav"))).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Preservation: re-saving an already-bundled project keeps existing audio
// ---------------------------------------------------------------------------

describe("stageCompanionAudioForRecording — already-staged workspace video", () => {
	it("reuses sidecars already next to the workspace video without a source copy", async () => {
		// Simulates a project that was unpacked from a bundle: video and sidecars
		// already live inside the workspace; the original recordings-dir source
		// may no longer exist.
		const stagedVideo = await writeFile(slideDir, "main.mp4", "video");
		await writeFile(slideDir, "main.mic.wav", Buffer.from([9]));

		const result = await stageCompanionAudioForRecording(stagedVideo, stagedVideo);

		expect(result.microphoneAudioPath).toBe(norm(path.join(slideDir, "main.mic.wav")));
		expect(result.systemAudioPath).toBeNull();
	});
});
