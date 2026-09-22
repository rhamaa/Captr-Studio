import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { packProjectWorkspace } from "./projectBundle";

/**
 * Helper: write project.json into a temp workspace dir and pack it as a .captr ZIP bundle.
 * Returns the path to the .captr file.
 */
async function makeBundle(
	tmpDir: string,
	captrPath: string,
	projectData: Record<string, unknown>,
): Promise<string> {
	const workspaceDir = path.join(
		tmpDir,
		`ws-${Date.now()}-${Math.random().toString(36).slice(2)}`,
	);
	await fs.mkdir(workspaceDir, { recursive: true });
	await fs.writeFile(
		path.join(workspaceDir, "project.json"),
		JSON.stringify(projectData),
		"utf-8",
	);
	await packProjectWorkspace(workspaceDir, captrPath);
	await fs.rm(workspaceDir, { recursive: true, force: true });
	return captrPath;
}

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
		await Promise.all([first, second].map((file) => fs.writeFile(file, "media")));
		const { replaceApprovedSessionLocalReadPaths, isAllowedLocalMediaPath } = await import(
			"./manager"
		);
		await replaceApprovedSessionLocalReadPaths([first, second]);
		await replaceApprovedSessionLocalReadPaths([first], true);
		expect(await isAllowedLocalMediaPath(second)).toBe(true);
		await replaceApprovedSessionLocalReadPaths([first]);
		expect(await isAllowedLocalMediaPath(second)).toBe(false);
	});

	it("opens scene-only projects (bundle) and approves media from every scene without approving unrelated files", async () => {
		// Bundles must be self-contained: all scene media lives inside the bundle.
		const wsDir = path.join(tempPath, "story-workspace");
		const slideDir = path.join(wsDir, "slides", "clip-1");
		await fs.mkdir(slideDir, { recursive: true });
		for (const name of ["main.mp4", "demo.mp4", "webcam.mp4", "broll.mp4", "mic.wav"]) {
			await fs.writeFile(path.join(slideDir, name), "media");
		}
		await fs.writeFile(
			path.join(wsDir, "project.json"),
			JSON.stringify({
				videoPath: "",
				clips: [
					{ videoPath: "slides/clip-1/main.mp4" },
					{
						videoPath: "slides/clip-1/demo.mp4",
						webcamPath: "slides/clip-1/webcam.mp4",
						microphoneAudioPath: "slides/clip-1/mic.wav",
						mediaTrackLayers: [{ sourcePath: "slides/clip-1/broll.mp4" }],
					},
				],
				editor: {},
			}),
			"utf-8",
		);

		const unrelated = path.join(tempRoot, "External", "unrelated.mp4");
		await fs.mkdir(path.dirname(unrelated), { recursive: true });
		await fs.writeFile(unrelated, "unrelated");

		const projectPath = path.join(tempRoot, "story.captr");
		await packProjectWorkspace(wsDir, projectPath);
		await fs.rm(wsDir, { recursive: true, force: true });

		const { loadProjectFromPath, resolveApprovedLocalMediaPath } = await import("./manager");
		const result = await loadProjectFromPath(projectPath);
		expect(result.success).toBe(true);

		// Every scene media file now lives inside the unpacked workspace and is approved
		const loadedProject = result.project as {
			clips: Array<{
				videoPath: string;
				webcamPath?: string;
				microphoneAudioPath?: string;
				mediaTrackLayers?: Array<{ sourcePath?: string }>;
			}>;
		};
		const secondClip = loadedProject.clips[1];
		const referencedPaths = [
			loadedProject.clips[0].videoPath,
			secondClip.videoPath,
			secondClip.webcamPath,
			secondClip.microphoneAudioPath,
			secondClip.mediaTrackLayers?.[0]?.sourcePath,
		].filter((value): value is string => typeof value === "string");
		for (const referencedPath of referencedPaths) {
			await expect(resolveApprovedLocalMediaPath(referencedPath)).resolves.toBe(
				await fs.realpath(referencedPath),
			);
		}
		await expect(resolveApprovedLocalMediaPath(unrelated)).resolves.toBeNull();
	});

	it("automatically approves companion audio candidate files when loading bundle projects", async () => {
		// Bundle contains the video and its companion sidecar audio files.
		const wsDir = path.join(tempPath, "companion-workspace");
		await fs.mkdir(wsDir, { recursive: true });
		await fs.writeFile(path.join(wsDir, "recording.mp4"), "video-content");
		await fs.writeFile(path.join(wsDir, "recording.system.wav"), "system-audio-content");
		await fs.writeFile(path.join(wsDir, "recording.mic.wav"), "mic-audio-content");
		await fs.writeFile(
			path.join(wsDir, "project.json"),
			JSON.stringify({
				videoPath: "recording.mp4",
				clips: [{ videoPath: "recording.mp4" }],
				editor: {},
			}),
			"utf-8",
		);

		const projectPath = path.join(tempRoot, "bundle-companion.captr");
		await packProjectWorkspace(wsDir, projectPath);
		await fs.rm(wsDir, { recursive: true, force: true });

		const { loadProjectFromPath, resolveApprovedLocalMediaPath } = await import("./manager");
		const result = await loadProjectFromPath(projectPath);
		expect(result.success).toBe(true);

		// Video and both companion audio files should now be approved
		const loadedVideoPath = (result.project as { videoPath: string }).videoPath;
		const companionBase = loadedVideoPath.replace(/\.[^.]+$/u, "");
		await expect(resolveApprovedLocalMediaPath(loadedVideoPath)).resolves.toBe(
			await fs.realpath(loadedVideoPath),
		);
		await expect(resolveApprovedLocalMediaPath(`${companionBase}.system.wav`)).resolves.toBe(
			await fs.realpath(`${companionBase}.system.wav`),
		);
		await expect(resolveApprovedLocalMediaPath(`${companionBase}.mic.wav`)).resolves.toBe(
			await fs.realpath(`${companionBase}.mic.wav`),
		);
	});

	it("rejects existing media files outside allowed directories until they are approved", async () => {
		const downloadsPath = path.join(tempRoot, "Downloads");
		const exportPath = path.join(downloadsPath, "export-test.mp4");
		await fs.mkdir(downloadsPath, { recursive: true });
		await fs.writeFile(exportPath, "test-video");

		const { isAllowedLocalMediaPath, rememberApprovedLocalReadPath } = await import(
			"./manager"
		);

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
		const { isAllowedLocalMediaPath, rememberApprovedLocalReadPath } = await import(
			"./manager"
		);

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

		const { isAllowedLocalMediaPath, resolveApprovedLocalMediaPath } = await import(
			"./manager"
		);

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

	it("rejects legacy plain JSON .captr files with a clear error message", async () => {
		const videoPath = path.join(tempPath, "recording.mp4");
		const projectPath = path.join(tempPath, "recording.captr");
		await fs.writeFile(videoPath, "test-video");
		await fs.writeFile(
			projectPath,
			JSON.stringify({ version: 1, videoPath, editor: {} }),
			"utf-8",
		);

		const { loadProjectFromPath } = await import("./manager");
		const result = await loadProjectFromPath(projectPath);
		expect(result.success).toBe(false);
		expect(result.message).toContain("old .captr format");
	});

	it("loads bundle project files that start with a UTF-8 byte order mark in project.json", async () => {
		// Self-contained bundle: the video lives inside the workspace.
		const wsDir = path.join(tempPath, "bom-workspace");
		await fs.mkdir(wsDir, { recursive: true });
		await fs.writeFile(path.join(wsDir, "recording.mp4"), "test-video");
		await fs.writeFile(
			path.join(wsDir, "project.json"),
			`\uFEFF${JSON.stringify({ version: 1, videoPath: "recording.mp4", editor: {} })}`,
			"utf-8",
		);

		const projectPath = path.join(tempPath, "recording.captr");
		await packProjectWorkspace(wsDir, projectPath);
		await fs.rm(wsDir, { recursive: true, force: true });

		const { loadProjectFromPath } = await import("./manager");
		const result = await loadProjectFromPath(projectPath);
		expect(result.success).toBe(true);
		expect(result.path).toBe(projectPath);
		expect(result.project).toMatchObject({
			videoPath: expect.stringContaining("recording.mp4"),
		});
	});

	it("approves editor audioRegions audioPath entries when loading a bundle project", async () => {
		// Self-contained bundle: video and the region audio live inside the bundle.
		const wsDir = path.join(tempPath, "audio-regions-workspace");
		await fs.mkdir(wsDir, { recursive: true });
		await fs.writeFile(path.join(wsDir, "recording.mp4"), "test-video");
		await fs.writeFile(path.join(wsDir, "music.ogg"), "test-audio");
		await fs.writeFile(
			path.join(wsDir, "project.json"),
			JSON.stringify({
				version: 1,
				videoPath: "recording.mp4",
				editor: {
					audioRegions: [
						{ id: "a1", startMs: 0, endMs: 1000, audioPath: "music.ogg", volume: 1 },
					],
				},
			}),
			"utf-8",
		);

		const projectPath = path.join(tempPath, "recording.captr");
		await packProjectWorkspace(wsDir, projectPath);
		await fs.rm(wsDir, { recursive: true, force: true });

		const { loadProjectFromPath, resolveApprovedLocalMediaPath } = await import("./manager");

		const result = await loadProjectFromPath(projectPath);
		expect(result.success).toBe(true);

		const loadedEditor = (
			result.project as { editor?: { audioRegions?: Array<{ audioPath: string }> } }
		).editor;
		const loadedAudioPath = loadedEditor?.audioRegions?.[0]?.audioPath as string;
		await expect(resolveApprovedLocalMediaPath(loadedAudioPath)).resolves.toBe(
			await fs.realpath(loadedAudioPath),
		);
	});

	it("library entries expose the bundle-embedded thumbnail as a data URL", async () => {
		const projectPath = path.join(tempPath, "thumb.captr");
		const pngBytes = Buffer.from("fake-png-thumbnail");

		const wsDir = path.join(tempPath, "thumb-workspace");
		await fs.mkdir(wsDir, { recursive: true });
		await fs.writeFile(
			path.join(wsDir, "project.json"),
			JSON.stringify({ version: 1 }),
			"utf-8",
		);
		await fs.writeFile(path.join(wsDir, "thumbnail.png"), pngBytes);
		await packProjectWorkspace(wsDir, projectPath);
		await fs.rm(wsDir, { recursive: true, force: true });

		const { buildProjectLibraryEntry } = await import("./manager");
		const entry = await buildProjectLibraryEntry(projectPath, path.join(tempPath, "Projects"));

		expect(entry).not.toBeNull();
		expect(entry?.thumbnailDataUrl).toBe(
			`data:image/png;base64,${pngBytes.toString("base64")}`,
		);
		// No loose sidecar exists — the preview comes from inside the bundle.
		expect(entry?.thumbnailPath).toBeNull();
	});

	it("rejects bundle projects that reference media missing from the bundle", async () => {
		const projectPath = path.join(tempPath, "incomplete.captr");
		await makeBundle(tempPath, projectPath, {
			version: 1,
			videoPath: "slides/clip-1/main.mp4",
			clips: [{ id: "clip-1", videoPath: "slides/clip-1/main.mp4" }],
		});

		const { loadProjectFromPath } = await import("./manager");
		const result = await loadProjectFromPath(projectPath);

		expect(result.success).toBe(false);
		expect(result.canceled).toBe(false);
		expect(result.message).toContain("not self-contained");
		expect(result.message).toContain("clips[0].videoPath");
		expect(result.message).toContain("main.mp4");
	});
});
