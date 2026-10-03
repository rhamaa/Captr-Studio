import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createTimelineProject,
	placeAsset,
	registerMedia,
	registerRecording,
	splitClip,
} from "../../../../src/core/timeline/commands";
import type { CompletedRecording, TimelineProject } from "../../../../src/core/timeline/types";
import {
	inspectProjectBundle,
	packProjectWorkspace,
	unpackProjectBundle,
} from "../../project/projectBundle";

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
	BrowserWindow: {
		getAllWindows: () => [],
	},
}));

vi.mock("../../utils", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../utils")>();
	return {
		...actual,
		getRecordingsDir: async () => path.join(mock.root, "Recordings"),
	};
});

import { loadProjectFromPath } from "../../project/manager";
import * as state from "../../state";
import { registerProjectSaveHandlers } from "./save";
import { registerProjectSessionHandlers } from "./session";

describe("V3 Lifecycle & Regression Verification Suite", () => {
	beforeEach(async () => {
		mock.root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-v3-verification-"));
		mock.trusted = false;
		mock.handlers.clear();
		mock.saveDialog.mockReset();
		mock.saveDialog.mockResolvedValue({ canceled: true });

		await fs.mkdir(path.join(mock.root, "temp"), { recursive: true });
		await fs.mkdir(path.join(mock.root, "Recordings"), { recursive: true });
		await fs.mkdir(path.join(mock.root, "Projects"), { recursive: true });

		state.setCurrentProjectPath(null);
		state.setCurrentVideoPath(null);
		state.setCurrentRecordingSession(null);
		state.setPreserveProjectPathForNextNativeRecording(false);

		registerProjectSaveHandlers();
		registerProjectSessionHandlers();
	});

	afterEach(async () => {
		if (path.dirname(path.resolve(mock.root)) !== path.resolve(os.tmpdir())) {
			throw new Error("Unsafe test cleanup");
		}
		await fs.rm(mock.root, { recursive: true, force: true }).catch(() => undefined);
	});

	const makeSourceFiles = async (prefix: string) => {
		const dir = path.join(mock.root, "temp", prefix);
		await fs.mkdir(dir, { recursive: true });
		const screenPath = path.join(dir, "screen.mp4");
		const webcamPath = path.join(dir, "webcam.mp4");
		const micPath = path.join(dir, "mic.wav");
		const systemPath = path.join(dir, "system.wav");
		const cursorPath = path.join(dir, "cursor.json");

		await fs.writeFile(screenPath, `video-data-${prefix}`);
		await fs.writeFile(webcamPath, `webcam-data-${prefix}`);
		await fs.writeFile(micPath, `mic-data-${prefix}`);
		await fs.writeFile(systemPath, `system-data-${prefix}`);
		await fs.writeFile(cursorPath, JSON.stringify({ events: [prefix] }));

		return { screenPath, webcamPath, micPath, systemPath, cursorPath };
	};

	const createCompletedRecording = (
		captureId: string,
		name: string,
		sources: Awaited<ReturnType<typeof makeSourceFiles>>,
	): CompletedRecording => ({
		captureId,
		name,
		durationUs: 10_000_000,
		width: 1920,
		height: 1080,
		screen: { path: sources.screenPath, durationUs: 10_000_000, offsetUs: 0 },
		webcam: { path: sources.webcamPath, durationUs: 10_000_000, offsetUs: 0 },
		microphone: { path: sources.micPath, durationUs: 10_000_000, offsetUs: 0 },
		system: { path: sources.systemPath, durationUs: 10_000_000, offsetUs: 0 },
		cursorPath: sources.cursorPath,
		settings: { autoZoom: true },
	});

	it("QA 1: Record dua kali pada .captr aktif, Ctrl+S tanpa Save As, buka ulang Assets tanpa timeline dan semua sidecar utuh", async () => {
		// 1. Initial saved active project: Test 2.captr
		const initialProject = createTimelineProject("test-2-proj", "Test 2");
		const test2Path = path.join(mock.root, "Projects", "Test 2.captr");
		mock.saveDialog.mockResolvedValueOnce({ filePath: test2Path, canceled: false });

		const saveHandler = mock.handlers.get("save-project-file")!;
		const initSaveResult = await saveHandler(null, initialProject, "Test 2");
		expect(initSaveResult.success).toBe(true);
		expect(state.currentProjectPath).toBe(test2Path);

		// 2. First recording take: Recorder HUD sets preserveProjectPath flag
		const sources1 = await makeSourceFiles("take-1");
		state.setPreserveProjectPathForNextNativeRecording(true);

		const sessionHandler = mock.handlers.get("set-current-recording-session")!;
		await sessionHandler(
			null,
			{ videoPath: sources1.screenPath, webcamPath: sources1.webcamPath },
			{ preserveProjectPath: true, captureId: "take-1", projectId: "test-2-proj" },
		);

		// currentProjectPath is preserved!
		expect(state.currentProjectPath).toBe(test2Path);

		// Register take 1 into project
		let currentProject: TimelineProject = registerRecording(
			initialProject,
			createCompletedRecording("take-1", "Recording Take 1", sources1),
			{ assetId: "asset-take-1", packageId: "pkg-take-1" },
		);

		// 3. Second recording take: Recorder HUD sets preserveProjectPath flag
		const sources2 = await makeSourceFiles("take-2");
		state.setPreserveProjectPathForNextNativeRecording(true);

		await sessionHandler(
			null,
			{ videoPath: sources2.screenPath, webcamPath: sources2.webcamPath },
			{ preserveProjectPath: true, captureId: "take-2", projectId: "test-2-proj" },
		);

		// currentProjectPath still preserved!
		expect(state.currentProjectPath).toBe(test2Path);

		// Register take 2 into project
		currentProject = registerRecording(
			currentProject,
			createCompletedRecording("take-2", "Recording Take 2", sources2),
			{ assetId: "asset-take-2", packageId: "pkg-take-2" },
		);

		// Verify zero clips on timeline
		expect(currentProject.tracks.flatMap((t) => t.clips)).toHaveLength(0);
		expect(currentProject.assets).toHaveLength(2);
		expect(currentProject.packages).toHaveLength(2);

		// 4. Ctrl+S: save-project-file with existingProjectPath = state.currentProjectPath
		mock.saveDialog.mockReset(); // Should NEVER be called during in-place save
		const ctrlSSaveResult = await saveHandler(
			null,
			currentProject,
			"Test 2",
			state.currentProjectPath,
		);

		expect(ctrlSSaveResult.success).toBe(true);
		expect(ctrlSSaveResult.path).toBe(test2Path);
		expect(mock.saveDialog).not.toHaveBeenCalled();

		// 5. Reopen the saved bundle and verify all assets and sidecars are intact
		const loadedResult = await loadProjectFromPath(test2Path);
		expect(loadedResult.success).toBe(true);
		const reopened = loadedResult.project as TimelineProject;

		expect(reopened.version).toBe(3);
		expect(reopened.projectId).toBe("test-2-proj");
		expect(reopened.assets).toHaveLength(2);
		expect(reopened.packages).toHaveLength(2);
		expect(reopened.tracks.flatMap((t) => t.clips)).toHaveLength(0);

		// Inspect extracted files in workspace
		const pkg1 = reopened.packages.find((p) => p.captureId === "take-1")!;
		expect(pkg1).toBeDefined();
		expect(await fs.readFile(pkg1.screen.path, "utf8")).toBe("video-data-take-1");
		expect(await fs.readFile(pkg1.webcam!.path, "utf8")).toBe("webcam-data-take-1");
		expect(await fs.readFile(pkg1.microphone!.path, "utf8")).toBe("mic-data-take-1");
		expect(await fs.readFile(pkg1.system!.path, "utf8")).toBe("system-data-take-1");
		expect(await fs.readFile(pkg1.cursorPath!, "utf8")).toContain("take-1");

		const pkg2 = reopened.packages.find((p) => p.captureId === "take-2")!;
		expect(pkg2).toBeDefined();
		expect(await fs.readFile(pkg2.screen.path, "utf8")).toBe("video-data-take-2");
		expect(await fs.readFile(pkg2.webcam!.path, "utf8")).toBe("webcam-data-take-2");
		expect(await fs.readFile(pkg2.microphone!.path, "utf8")).toBe("mic-data-take-2");
		expect(await fs.readFile(pkg2.system!.path, "utf8")).toBe("system-data-take-2");
		expect(await fs.readFile(pkg2.cursorPath!, "utf8")).toContain("take-2");

		// Inspect bundle ZIP to ensure no slides directory
		const inspection = await inspectProjectBundle(test2Path);
		expect(inspection.success).toBe(true);
		expect(inspection.projectData).not.toHaveProperty("slides");
	}, 20_000);

	it("QA 2: Tempatkan Record dua kali, split/trim/rate/edit independen, import media, dan verifikasi reopen parity", async () => {
		const sources = await makeSourceFiles("dual-placement");
		let project = createTimelineProject("dual-proj", "Dual Placement");

		project = registerRecording(
			project,
			createCompletedRecording("dual-take", "Dual Take", sources),
			{ assetId: "dual-asset", packageId: "dual-pkg" },
		);

		// Place asset twice on visual-1 track with separate composition IDs
		project = placeAsset(project, "dual-asset", "visual-1", 0, {
			clipId: "clip-1",
			compositionId: "comp-1",
		});
		project = placeAsset(project, "dual-asset", "visual-1", 10_000_000, {
			clipId: "clip-2",
			compositionId: "comp-2",
		});

		// Edit clip 1 independently: trim, speed 1.5x
		const track = project.tracks.find((t) => t.id === "visual-1")!;
		const clip1 = track.clips.find((c) => c.id === "clip-1")!;
		clip1.trimInUs = 1_000_000;
		clip1.durationUs = 4_000_000;
		clip1.speed = 1.5;

		// Edit clip 2 independently: trim, speed 0.5x
		const clip2 = track.clips.find((c) => c.id === "clip-2")!;
		clip2.trimInUs = 3_000_000;
		clip2.durationUs = 6_000_000;
		clip2.speed = 0.5;

		// Import external image asset
		const imageFile = path.join(mock.root, "temp", "logo.png");
		await fs.writeFile(imageFile, "fake-image-bytes");
		project = registerMedia(project, {
			id: "img-asset",
			kind: "image",
			name: "Logo",
			durationUs: 5_000_000,
			width: 500,
			height: 500,
			source: { path: imageFile, durationUs: 5_000_000, offsetUs: 0 },
		});

		// Import external audio asset
		const audioFile = path.join(mock.root, "temp", "bgm.mp3");
		await fs.writeFile(audioFile, "fake-audio-bytes");
		project = registerMedia(project, {
			id: "audio-asset",
			kind: "audio",
			name: "BGM",
			durationUs: 30_000_000,
			width: 0,
			height: 0,
			source: { path: audioFile, durationUs: 30_000_000, offsetUs: 0 },
		});

		// Save project
		const saveTarget = path.join(mock.root, "Projects", "Dual.captr");
		mock.saveDialog.mockResolvedValueOnce({ filePath: saveTarget, canceled: false });
		const saveHandler = mock.handlers.get("save-project-file")!;
		const saveResult = await saveHandler(null, project, "Dual");
		expect(saveResult.success).toBe(true);

		// Reopen project
		const loaded = await loadProjectFromPath(saveTarget);
		expect(loaded.success).toBe(true);
		const reopened = loaded.project as TimelineProject;

		// Validate independent clips
		const reopenedTrack = reopened.tracks.find((t) => t.id === "visual-1")!;
		const reopenedClip1 = reopenedTrack.clips.find((c) => c.id === "clip-1")!;
		const reopenedClip2 = reopenedTrack.clips.find((c) => c.id === "clip-2")!;

		expect(reopenedClip1.trimInUs).toBe(1_000_000);
		expect(reopenedClip1.durationUs).toBe(4_000_000);
		expect(reopenedClip1.speed).toBe(1.5);

		expect(reopenedClip2.trimInUs).toBe(3_000_000);
		expect(reopenedClip2.durationUs).toBe(6_000_000);
		expect(reopenedClip2.speed).toBe(0.5);

		// Validate imported image & audio media inside workspace
		const imgAsset = reopened.assets.find((a) => a.id === "img-asset")!;
		expect(imgAsset).toBeDefined();
		expect(await fs.readFile(imgAsset.source!.path, "utf8")).toBe("fake-image-bytes");

		const audAsset = reopened.assets.find((a) => a.id === "audio-asset")!;
		expect(audAsset).toBeDefined();
		expect(await fs.readFile(audAsset.source!.path, "utf8")).toBe("fake-audio-bytes");
	}, 20_000);

	it("QA 3: Save As dan New Project mempertahankan perbedaan path/identitas, dan konversi eksplisit memakai file baru", async () => {
		const originalProject = createTimelineProject("orig-proj", "Original");
		const originalPath = path.join(mock.root, "Projects", "Original.captr");
		mock.saveDialog.mockResolvedValueOnce({ filePath: originalPath, canceled: false });

		const saveHandler = mock.handlers.get("save-project-file")!;
		await saveHandler(null, originalProject, "Original");
		expect(state.currentProjectPath).toBe(originalPath);

		// 1. Save As: explicit save with a new project identity and path
		const saveAsProject = { ...originalProject, projectId: "save-as-proj", title: "Saved As" };
		const saveAsPath = path.join(mock.root, "Projects", "Saved As.captr");
		mock.saveDialog.mockResolvedValueOnce({ filePath: saveAsPath, canceled: false });

		// When saving without existingProjectPath or with differing projectId, dialog is triggered
		const saveAsResult = await saveHandler(null, saveAsProject, "Saved As");
		expect(saveAsResult.success).toBe(true);
		expect(saveAsResult.path).toBe(saveAsPath);
		expect(state.currentProjectPath).toBe(saveAsPath);

		// Original project file must still exist and be intact
		expect(await fs.stat(originalPath)).toBeDefined();
		const origInspection = await inspectProjectBundle(originalPath);
		expect(origInspection.projectData?.projectId).toBe("orig-proj");

		// 2. New Project: activate-timeline-project with resetPath = true
		const sessionHandlers = mock.handlers.get("activate-timeline-project")!;
		await sessionHandlers(null, "new-fresh-proj", true);
		expect(state.currentProjectPath).toBeNull();
		expect(state.currentVideoPath).toBeNull();
		expect(state.currentRecordingSession).toBeNull();

		// 3. Reject legacy Video/Motion slide bundle
		const legacyMotionBundle = path.join(mock.root, "Projects", "legacy-motion.captr");
		const wsDir = path.join(mock.root, "temp", "ws-motion");
		await fs.mkdir(wsDir, { recursive: true });
		await fs.writeFile(
			path.join(wsDir, "project.json"),
			JSON.stringify({
				version: 1,
				projectId: "legacy-motion",
				slides: [{ id: "m1", type: "motion", title: "Motion Slide" }],
			}),
		);
		await packProjectWorkspace(wsDir, legacyMotionBundle);

		// Attempting to load legacy motion bundle fails
		const motionLoadResult = await loadProjectFromPath(legacyMotionBundle);
		expect(motionLoadResult.success).toBe(false);
		expect(motionLoadResult.message).toMatch(/retired Video\/Motion slides/i);

		// 4. Legacy Record project explicit conversion creates new copy
		const legacyRecordBundle = path.join(mock.root, "Projects", "legacy-record.captr");
		const wsRecordDir = path.join(mock.root, "temp", "ws-record");
		await fs.mkdir(wsRecordDir, { recursive: true });
		await fs.writeFile(path.join(wsRecordDir, "take.mp4"), "legacy-media");
		await fs.writeFile(
			path.join(wsRecordDir, "project.json"),
			JSON.stringify({
				version: 1,
				projectId: "legacy-record-id",
				videoPath: "take.mp4",
				clips: [{ id: "rec1", type: "record", videoPath: "take.mp4", durationMs: 5000 }],
			}),
		);
		await packProjectWorkspace(wsRecordDir, legacyRecordBundle);
		const originalRecordBytes = await fs.readFile(legacyRecordBundle);

		const recordLoadResult = await loadProjectFromPath(legacyRecordBundle);
		expect(recordLoadResult.success).toBe(true);
		expect(recordLoadResult).toMatchObject({ conversionRequired: true });

		const conversionHandler = mock.handlers.get("save-converted-project-copy")!;
		const convertedV3Project = createTimelineProject("converted-v3-id", "Converted Record");
		const convertedPath = path.join(mock.root, "Projects", "Converted Record copy.captr");

		mock.saveDialog.mockResolvedValueOnce({ filePath: convertedPath, canceled: false });
		const convResult = await conversionHandler(
			null,
			convertedV3Project,
			recordLoadResult.conversionToken,
		);

		expect(convResult.success).toBe(true);
		expect(convResult.path).toBe(convertedPath);

		// Original legacy file must NOT be mutated
		const afterBytes = await fs.readFile(legacyRecordBundle);
		expect(afterBytes).toEqual(originalRecordBytes);

		// Converted file is a valid V3 bundle
		const convInspection = await inspectProjectBundle(convertedPath);
		expect(convInspection.success).toBe(true);
		expect(convInspection.projectData?.version).toBe(3);
		expect(convInspection.projectData?.projectId).toBe("converted-v3-id");
	});
});
