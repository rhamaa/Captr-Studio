import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("pruneAutoRecordings", () => {
	let tempRoot: string;
	let appDataPath: string;
	let userDataPath: string;
	let tempPath: string;
	let appPath: string;

	beforeEach(async () => {
		tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "recordly-prune-"));
		appDataPath = path.join(tempRoot, "AppData");
		userDataPath = path.join(tempRoot, "UserData");
		tempPath = path.join(tempRoot, "Temp");
		appPath = path.join(tempRoot, "App");

		await Promise.all(
			[appDataPath, userDataPath, tempPath, appPath].map((dirPath) =>
				fs.mkdir(dirPath, { recursive: true }),
			),
		);

		vi.resetModules();
		vi.doMock("electron", () => ({
			app: {
				isPackaged: false,
				getAppPath: () => appPath,
				getPath: (name: string) => {
					if (name === "appData") return appDataPath;
					if (name === "userData") return userDataPath;
					if (name === "temp") return tempPath;
					return tempRoot;
				},
				setPath: () => undefined,
			},
		}));
	});

	afterEach(async () => {
		vi.resetModules();
		vi.doUnmock("electron");
		if (tempRoot) {
			await fs.rm(tempRoot, { recursive: true, force: true });
		}
	});

	it("preserves recordings referenced by saved projects in the Projects directory", async () => {
		const { getRecordingsDir } = await import("../utils");
		const { PROJECTS_DIRECTORY_NAME, PROJECT_FILE_EXTENSION } = await import("../constants");
		const { pruneAutoRecordings } = await import("./prune");

		const recordingsDir = await getRecordingsDir();
		const projectsDir = path.join(recordingsDir, PROJECTS_DIRECTORY_NAME);
		await fs.mkdir(projectsDir, { recursive: true });

		const recordingPaths: string[] = [];
		for (let index = 0; index < 23; index += 1) {
			const recordingPath = path.join(recordingsDir, `recording-${index}.mp4`);
			recordingPaths.push(recordingPath);
			await fs.writeFile(recordingPath, `video-${index}`);
			const timestamp = new Date(Date.now() - index * 60_000);
			await fs.utimes(recordingPath, timestamp, timestamp);
		}

		const protectedVideoRecordingPath = recordingPaths.at(-3);
		const protectedWebcamRecordingPath = recordingPaths.at(-2);
		const prunableRecordingPath = recordingPaths.at(-1);

		// prune.ts reads plain JSON project files to collect media paths for protection.
		// (Separate from the loadProjectFromPath restriction — prune and load are independent.)
		await fs.writeFile(
			path.join(projectsDir, `saved-project-video.${PROJECT_FILE_EXTENSION}`),
			JSON.stringify({ videoPath: protectedVideoRecordingPath }, null, 2),
			"utf-8",
		);

		await fs.writeFile(
			path.join(projectsDir, `saved-project-webcam.${PROJECT_FILE_EXTENSION}`),
			JSON.stringify({ editor: { webcam: { sourcePath: protectedWebcamRecordingPath } } }, null, 2),
			"utf-8",
		);

		await pruneAutoRecordings();

		await expect(fs.access(protectedVideoRecordingPath!)).resolves.toBeUndefined();
		await expect(fs.access(protectedWebcamRecordingPath!)).resolves.toBeUndefined();
		await expect(fs.access(prunableRecordingPath!)).rejects.toThrow();
	});

	it("preserves old recordings used only by a later scene or its media layer", async () => {
		const { getRecordingsDir } = await import("../utils");
		const { PROJECTS_DIRECTORY_NAME, AUTO_RECORDING_MAX_AGE_MS } = await import("../constants");
		const { pruneAutoRecordings } = await import("./prune");
		const recordingsDir = await getRecordingsDir();
		const projectsDir = path.join(recordingsDir, PROJECTS_DIRECTORY_NAME);
		await fs.mkdir(projectsDir, { recursive: true });
		const files = ["intro", "scene", "broll", "unused"].map((name) => path.join(recordingsDir, `recording-${name}.mp4`));
		for (const file of files) {
			await fs.writeFile(file, "video");
			const old = new Date(Date.now() - AUTO_RECORDING_MAX_AGE_MS - 60000);
			await fs.utimes(file, old, old);
		}
		// plain JSON project — prune reads these to protect referenced recordings
		await fs.writeFile(
			path.join(projectsDir, "story.captr"),
			JSON.stringify({ videoPath: files[0], clips: [{ videoPath: files[1], mediaTrackLayers: [{ sourcePath: files[2] }] }] }),
		);
		await pruneAutoRecordings();
		for (const file of files.slice(0, 3)) await expect(fs.access(file)).resolves.toBeUndefined();
		await expect(fs.access(files[3])).rejects.toThrow();
	});

	it("skips unreadable/corrupt project files gracefully without aborting the prune", async () => {
		const { getRecordingsDir } = await import("../utils");
		const { PROJECTS_DIRECTORY_NAME, PROJECT_FILE_EXTENSION, AUTO_RECORDING_MAX_AGE_MS } = await import("../constants");
		const { pruneAutoRecordings } = await import("./prune");

		const recordingsDir = await getRecordingsDir();
		const projectsDir = path.join(recordingsDir, PROJECTS_DIRECTORY_NAME);
		await fs.mkdir(projectsDir, { recursive: true });

		const recordingPath = path.join(recordingsDir, "recording-stale.mp4");
		await fs.writeFile(recordingPath, "video");
		const staleTimestamp = new Date(Date.now() - AUTO_RECORDING_MAX_AGE_MS - 60000);
		await fs.utimes(recordingPath, staleTimestamp, staleTimestamp);

		// Write a corrupt (invalid JSON, non-ZIP) project file — should be skipped gracefully
		await fs.writeFile(
			path.join(projectsDir, `broken-project.${PROJECT_FILE_EXTENSION}`),
			"{ invalid json",
			"utf-8",
		);

		// Should NOT throw — corrupt files are skipped gracefully
		await expect(pruneAutoRecordings()).resolves.toBeUndefined();
		// The stale recording is not protected by any project, so it should be pruned
		await expect(fs.access(recordingPath)).rejects.toThrow();
	});
});
