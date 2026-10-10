import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTimelineProject, placeAsset, registerRecording } from "../../../../src/core/timeline/commands";
import type { CompletedRecording } from "../../../../src/core/timeline/types";
import { loadProjectFromPath } from "../../project/manager";
import { unpackProjectBundle } from "../../project/projectBundle";

const mock = vi.hoisted(() => ({
	handlers: new Map<string, (...args: any[]) => Promise<any>>(),
	root: "",
	saveDialog: vi.fn(),
	trusted: false,
}));

vi.mock("electron", () => ({
	app: {
		getPath: (name: string) => (name === "temp" ? path.join(mock.root, "temp") : mock.root),
		getAppPath: () => mock.root,
		isPackaged: false,
	},
	ipcMain: {
		handle: (name: string, handler: any) => mock.handlers.set(name, handler),
	},
	dialog: {
		showSaveDialog: mock.saveDialog,
	},
}));

// Workspace and Home metadata must follow each test's temporary root.
vi.mock("../../../appPaths", () => ({
	get USER_DATA_PATH() { return mock.root; },
	get RECORDINGS_DIR() { return path.join(mock.root, "recordings"); },
}));
vi.mock("../../constants", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../constants")>();
	return {
		...actual,
		get RECENT_PROJECTS_FILE() { return path.join(mock.root, "recent-projects.json"); },
		get RECORDINGS_SETTINGS_FILE() { return path.join(mock.root, "recordings-settings.json"); },
	};
});

import * as state from "../../state";
import { registerProjectSaveHandlers } from "./save";

describe("Template Background Save and .captr Self-Containment", () => {
	let testDir: string;
	let publicWallpapersDir: string;

	beforeEach(async () => {
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), "captr-template-bg-test-"));
		mock.root = testDir;
		mock.trusted = false;
		mock.handlers.clear();
		mock.saveDialog.mockReset();
		mock.saveDialog.mockResolvedValue({ canceled: true });
		state.setCurrentProjectPath(null);
		await fs.mkdir(path.join(testDir, "temp"), { recursive: true });

		// Prepare mock public wallpapers directory
		publicWallpapersDir = path.join(testDir, "public", "wallpapers");
		await fs.mkdir(publicWallpapersDir, { recursive: true });
		await fs.writeFile(
			path.join(publicWallpapersDir, "ipad-17-dark.jpg"),
			"mock-ipad-17-dark-image-bytes",
		);
		await fs.writeFile(
			path.join(publicWallpapersDir, "tahoe-light.jpg"),
			"mock-tahoe-light-image-bytes",
		);

		registerProjectSaveHandlers();
	});

	afterEach(async () => {
		if (path.dirname(path.resolve(testDir)) !== path.resolve(os.tmpdir())) {
			throw new Error("Unsafe test cleanup");
		}
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it("copies template wallpaper into assets/<assetId>/ and saves self-contained .captr bundle", async () => {
		// Create a recording video source
		const videoFile = path.join(testDir, "screen.mp4");
		await fs.writeFile(videoFile, "mock video stream");

		const recordingInput: CompletedRecording = {
			captureId: "cap-1",
			name: "Demo Recording",
			durationUs: 2_000_000,
			width: 1920,
			height: 1080,
			screen: { path: videoFile, durationUs: 2_000_000, offsetUs: 0 },
			settings: {
				wallpaper: "/wallpapers/ipad-17-dark.jpg",
			},
		};

		const projId1 = crypto.randomUUID();
		let project = registerRecording(createTimelineProject(projId1, "Template BG Project"), recordingInput, {
			assetId: "asset-1",
			packageId: "pkg-1",
		});
		project = placeAsset(project, "asset-1", "visual-1", 0, { clipId: "clip-1", compositionId: "comp-1" });

		// Explicitly ensure the composition also has the template wallpaper
		expect(project.compositions[0]).toBeDefined();
		project.compositions[0].settings = {
			...project.compositions[0].settings,
			wallpaper: "/wallpapers/ipad-17-dark.jpg",
		};

		const targetBundlePath = path.join(testDir, "test-output.captr");
		mock.saveDialog.mockResolvedValue({ canceled: false, filePath: targetBundlePath });

		const saveHandler = mock.handlers.get("save-project-file");
		expect(saveHandler).toBeDefined();

		// Trigger save
		const saveResult = await saveHandler!(null, project, "Template BG Project");
		expect(saveResult.success).toBe(true);
		expect(saveResult.path).toBe(targetBundlePath);

		// Unpack the saved .captr bundle into an extract directory to inspect contents
		const extractDir = path.join(testDir, "unpacked");
		await unpackProjectBundle(targetBundlePath, extractDir);

		// Verify asset directory contains the copied wallpaper file
		const assetDir = path.join(extractDir, "assets", "asset-1");
		const assetFiles = await fs.readdir(assetDir);
		const wallpaperFile = assetFiles.find((f) => f.includes("ipad-17-dark.jpg"));
		expect(wallpaperFile).toBeDefined();

		const copiedContent = await fs.readFile(path.join(assetDir, wallpaperFile!), "utf8");
		expect(copiedContent).toBe("mock-ipad-17-dark-image-bytes");

		// Verify project.json has the updated relative bundle path
		const savedProjectJson = JSON.parse(
			await fs.readFile(path.join(extractDir, "project.json"), "utf8"),
		);
		const savedPkg = savedProjectJson.packages.find((p: any) => p.id === "pkg-1");
		expect(savedPkg.settings.wallpaper).toBe(`assets/asset-1/${wallpaperFile}`);

		const savedComp = savedProjectJson.compositions.find((c: any) => c.packageId === "pkg-1");
		expect(savedComp.settings.wallpaper).toBe(`assets/asset-1/${wallpaperFile}`);

		// Verify reopening via loadProjectFromPath succeeds and validates all bundle media
		const loadResult = await loadProjectFromPath(targetBundlePath);
		expect(loadResult.success).toBe(true);
	});

	it("supports wallpapers without leading slash (e.g. wallpapers/tahoe-light.jpg)", async () => {
		const videoFile = path.join(testDir, "screen-2.mp4");
		await fs.writeFile(videoFile, "mock video stream 2");

		const recordingInput: CompletedRecording = {
			captureId: "cap-2",
			name: "Demo Recording 2",
			durationUs: 2_000_000,
			width: 1920,
			height: 1080,
			screen: { path: videoFile, durationUs: 2_000_000, offsetUs: 0 },
			settings: {
				wallpaper: "wallpapers/tahoe-light.jpg",
			},
		};

		const projId2 = crypto.randomUUID();
		const project = registerRecording(createTimelineProject(projId2, "Tahoe Light Project"), recordingInput, {
			assetId: "asset-2",
			packageId: "pkg-2",
		});

		const targetBundlePath = path.join(testDir, "tahoe-output.captr");
		mock.saveDialog.mockResolvedValue({ canceled: false, filePath: targetBundlePath });

		const saveHandler = mock.handlers.get("save-project-file");
		const saveResult = await saveHandler!(null, project, "Tahoe Light Project");
		expect(saveResult.success).toBe(true);

		const extractDir = path.join(testDir, "unpacked-2");
		await unpackProjectBundle(targetBundlePath, extractDir);

		const assetDir = path.join(extractDir, "assets", "asset-2");
		const assetFiles = await fs.readdir(assetDir);
		const wallpaperFile = assetFiles.find((f) => f.includes("tahoe-light.jpg"));
		expect(wallpaperFile).toBeDefined();

		const copiedContent = await fs.readFile(path.join(assetDir, wallpaperFile!), "utf8");
		expect(copiedContent).toBe("mock-tahoe-light-image-bytes");
	});
});
