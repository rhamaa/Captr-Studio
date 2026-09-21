import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("local media path policy", () => {
	let tempRoot: string;
	let appDataPath: string;
	let userDataPath: string;
	let tempPath: string;
	let appPath: string;

	beforeEach(async () => {
		tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "recordly-media-policy-"));
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

	it("preserves other scene approvals while selecting a project's source", async () => {
		const external = path.join(tempRoot, "External");
		await fs.mkdir(external);
		const first = path.join(external, "first.mp4");
		const second = path.join(external, "second.mp4");
		await Promise.all([first, second].map(file => fs.writeFile(file, "media")));
		const { replaceApprovedSessionLocalReadPaths, isAllowedLocalMediaPath } = await import("./manager");
		await replaceApprovedSessionLocalReadPaths([first, second]);
		await replaceApprovedSessionLocalReadPaths([first], true);
		expect(await isAllowedLocalMediaPath(second)).toBe(true);
		await replaceApprovedSessionLocalReadPaths([first]);
		expect(await isAllowedLocalMediaPath(second)).toBe(false);
	});

	it("opens scene-only projects and approves media from every scene without approving unrelated files", async () => {
		const external = path.join(tempRoot, "External");
		await fs.mkdir(external, { recursive: true });
		const sources = ["intro.mp4", "demo.mp4", "cam.mp4", "broll.mp4", "mic.wav"].map((name) => path.join(external, name));
		await Promise.all(sources.map((source) => fs.writeFile(source, "media")));
		const unrelated = path.join(external, "unrelated.mp4");
		await fs.writeFile(unrelated, "unrelated");
		const projectPath = path.join(tempRoot, "story.captr");
		await fs.writeFile(projectPath, JSON.stringify({ videoPath: "", unrelated,
			clips: [{ videoPath: sources[0] }, { videoPath: sources[1], webcamPath: sources[2], microphoneAudioPath: sources[4], mediaTrackLayers: [{ sourcePath: sources[3] }] }], editor: {},
		}));
		const { loadProjectFromPath, resolveApprovedLocalMediaPath } = await import("./manager");
		expect((await loadProjectFromPath(projectPath)).success).toBe(true);
		for (const source of sources) await expect(resolveApprovedLocalMediaPath(source)).resolves.toBe(await fs.realpath(source));
		await expect(resolveApprovedLocalMediaPath(unrelated)).resolves.toBeNull();
	});

	it("automatically approves companion audio candidate files when loading legacy projects", async () => {
		const external = path.join(tempRoot, "ExternalCompanion");
		await fs.mkdir(external, { recursive: true });
		const videoFile = path.join(external, "recording.mp4");
		const systemAudio = path.join(external, "recording.system.wav");
		const micAudio = path.join(external, "recording.mic.wav");
		await fs.writeFile(videoFile, "video-content");
		await fs.writeFile(systemAudio, "system-audio-content");
		await fs.writeFile(micAudio, "mic-audio-content");

		// Legacy project only references videoPath, not companion audio files
		const projectPath = path.join(tempRoot, "legacy-project.captr");
		await fs.writeFile(
			projectPath,
			JSON.stringify({
				videoPath: videoFile,
				clips: [{ videoPath: videoFile }],
				editor: {},
			}),
		);

		const { loadProjectFromPath, resolveApprovedLocalMediaPath } = await import("./manager");
		const result = await loadProjectFromPath(projectPath);
		expect(result.success).toBe(true);

		// Video and both companion audio files should now be approved
		await expect(resolveApprovedLocalMediaPath(videoFile)).resolves.toBe(await fs.realpath(videoFile));
		await expect(resolveApprovedLocalMediaPath(systemAudio)).resolves.toBe(await fs.realpath(systemAudio));
		await expect(resolveApprovedLocalMediaPath(micAudio)).resolves.toBe(await fs.realpath(micAudio));
	});

	it("rejects existing media files outside allowed directories until they are approved", async () => {
		const downloadsPath = path.join(tempRoot, "Downloads");
		const exportPath = path.join(downloadsPath, "export-test.mp4");
		await fs.mkdir(downloadsPath, { recursive: true });
		await fs.writeFile(exportPath, "test-video");

		const { isAllowedLocalMediaPath, rememberApprovedLocalReadPath } = await import("./manager");

		await expect(isAllowedLocalMediaPath(exportPath)).resolves.toBe(false);

		await rememberApprovedLocalReadPath(exportPath);

		await expect(isAllowedLocalMediaPath(exportPath)).resolves.toBe(true);
	});

	it("rejects missing media files outside the allowed directories", async () => {
		const missingPath = path.join(tempRoot, "Downloads", "missing.mp4");
		const { isAllowedLocalMediaPath } = await import("./manager");

		await expect(isAllowedLocalMediaPath(missingPath)).resolves.toBe(false);
	});

	it("allows approved media paths before the file exists", async () => {
		const pendingExportPath = path.join(tempRoot, "Downloads", "pending-export.mp4");
		const { isAllowedLocalMediaPath, rememberApprovedLocalReadPath } = await import("./manager");

		await rememberApprovedLocalReadPath(pendingExportPath);

		await expect(isAllowedLocalMediaPath(pendingExportPath)).resolves.toBe(true);
	});

	it("approves media-server access for approved external files resolved through the URL policy", async () => {
		const downloadsPath = path.join(tempRoot, "Downloads");
		const videoPath = path.join(downloadsPath, "external-video.mp4");
		await fs.mkdir(downloadsPath, { recursive: true });
		await fs.writeFile(videoPath, "test-video");
		const resolvedVideoPath = await fs.realpath(videoPath);

		const { resolveApprovedLocalMediaPath, rememberApprovedLocalReadPath } = await import(
			"./manager"
		);
		const { isAllowedMediaPath } = await import("../../mediaServer");

		// Unapproved external paths are rejected before they ever reach the media server.
		expect(isAllowedMediaPath(videoPath)).toBe(false);
		await expect(resolveApprovedLocalMediaPath(videoPath)).resolves.toBeNull();

		// Once the user opts in (via dialog/export/etc.) the path is approved.
		await rememberApprovedLocalReadPath(videoPath);

		await expect(resolveApprovedLocalMediaPath(videoPath)).resolves.toBe(resolvedVideoPath);
		expect(isAllowedMediaPath(videoPath)).toBe(true);
	});

	it("rejects existing non-media files when resolving local media URLs", async () => {
		const downloadsPath = path.join(tempRoot, "Downloads");
		const textPath = path.join(downloadsPath, "notes.txt");
		await fs.mkdir(downloadsPath, { recursive: true });
		await fs.writeFile(textPath, "not media");

		const { resolveApprovedLocalMediaPath } = await import("./manager");
		const { isAllowedMediaPath } = await import("../../mediaServer");

		await expect(resolveApprovedLocalMediaPath(textPath)).resolves.toBeNull();
		expect(isAllowedMediaPath(textPath)).toBe(false);
	});

	it("rejects symlinks under allowed prefixes that point outside the allowlist", async () => {
		const outsideTarget = path.join(tempRoot, "outside-secret.mp4");
		const symlinkInsideUserData = path.join(userDataPath, "shortcut-to-secret.mp4");
		await fs.writeFile(outsideTarget, "secret-bytes");

		try {
			await fs.symlink(outsideTarget, symlinkInsideUserData);
		} catch (error) {
			// Windows requires Developer Mode or admin to create file symlinks. If
			// we can't create one, the bypass we're guarding against also can't be
			// crafted on this machine, so skipping is safe.
			if ((error as NodeJS.ErrnoException).code === "EPERM") {
				return;
			}
			throw error;
		}

		const { isAllowedLocalMediaPath, resolveApprovedLocalMediaPath } = await import("./manager");

		await expect(isAllowedLocalMediaPath(symlinkInsideUserData)).resolves.toBe(false);
		await expect(resolveApprovedLocalMediaPath(symlinkInsideUserData)).resolves.toBeNull();
	});

	it("preserves an existing project thumbnail when no replacement is provided", async () => {
		const projectPath = path.join(tempRoot, "Projects", "demo.recordly");
		const thumbnailDataUrl = `data:image/png;base64,${Buffer.from("png-thumbnail").toString("base64")}`;
		await fs.mkdir(path.dirname(projectPath), { recursive: true });

		const { getProjectThumbnailPath, saveProjectThumbnail } = await import("./manager");
		const thumbnailPath = getProjectThumbnailPath(projectPath);

		await saveProjectThumbnail(projectPath, thumbnailDataUrl);
		await saveProjectThumbnail(projectPath, undefined);

		await expect(fs.readFile(thumbnailPath, "utf8")).resolves.toBe("png-thumbnail");
	});

	it("loads project files that start with a UTF-8 byte order mark", async () => {
		const videoPath = path.join(tempPath, "recording.mp4");
		const projectPath = path.join(tempPath, "recording.recordly");
		await fs.writeFile(videoPath, "test-video");
		await fs.writeFile(
			projectPath,
			`\uFEFF${JSON.stringify({
				version: 1,
				videoPath,
				editor: {},
			})}`,
			"utf-8",
		);

		const { loadProjectFromPath } = await import("./manager");

		const result = await loadProjectFromPath(projectPath);
		expect(result.success).toBe(true);
		expect(result.path).toBe(projectPath);
		expect(result.project).toMatchObject({ videoPath });
	});

	it("approves editor audioRegions audioPath entries when loading a project", async () => {
		const downloadsPath = path.join(tempRoot, "Downloads");
		const videoPath = path.join(tempPath, "recording.mp4");
		const audioPath = path.join(downloadsPath, "music.ogg");
		const projectPath = path.join(tempPath, "recording.recordly");
		await fs.mkdir(downloadsPath, { recursive: true });
		await fs.writeFile(videoPath, "test-video");
		await fs.writeFile(audioPath, "test-audio");
		await fs.writeFile(
			projectPath,
			JSON.stringify({
				version: 1,
				videoPath,
				editor: {
					audioRegions: [
						{ id: "a1", startMs: 0, endMs: 1000, audioPath, volume: 1 },
					],
				},
			}),
			"utf-8",
		);

		const { loadProjectFromPath, resolveApprovedLocalMediaPath } = await import("./manager");
		const resolvedAudioPath = await fs.realpath(audioPath);

		const result = await loadProjectFromPath(projectPath);
		expect(result.success).toBe(true);
		await expect(resolveApprovedLocalMediaPath(audioPath)).resolves.toBe(resolvedAudioPath);
	});
});
