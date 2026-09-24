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
import {
	isWorkspaceV2,
	listSlideDirectories,
	readProjectManifest,
	readSlideData,
	removeSlideDirectory,
	writeProjectManifest,
	writeSlideData,
} from "./packageHandler";

describe("packageHandler", () => {
	let testWorkspaceDir: string;

	beforeEach(async () => {
		testWorkspaceDir = path.join(
			os.tmpdir(),
			`captr-test-workspace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		);
		await fs.mkdir(testWorkspaceDir, { recursive: true });
	});

	afterEach(async () => {
		try {
			await fs.rm(testWorkspaceDir, { recursive: true, force: true });
		} catch {
			// ignore cleanup error
		}
	});

	it("correctly identifies non-v2 vs v2 workspace", async () => {
		expect(await isWorkspaceV2(testWorkspaceDir)).toBe(false);

		// Legacy v1 project
		await fs.writeFile(
			path.join(testWorkspaceDir, "project.json"),
			JSON.stringify({ version: 1, videoPath: "test.mp4", editor: {} }),
		);
		expect(await isWorkspaceV2(testWorkspaceDir)).toBe(false);

		// V2 project
		await writeProjectManifest(testWorkspaceDir, {
			version: 2,
			projectId: "proj-1",
			title: "V2 Test",
			canvas: { width: 1920, height: 1080, fps: 60 },
			slides: [
				{
					id: "s1",
					type: "record",
					title: "Slide 1",
					order: 0,
					dirName: "slide_01_rec",
					durationMs: 5000,
				},
			],
		});
		expect(await isWorkspaceV2(testWorkspaceDir)).toBe(true);
	});

	it("reads and writes project manifest", async () => {
		await writeProjectManifest(testWorkspaceDir, {
			version: 2,
			projectId: "proj-abc",
			title: "Awesome Video",
			canvas: { width: 1920, height: 1080, fps: 60, aspectRatio: "16:9" },
			slides: [
				{
					id: "s1",
					type: "record",
					title: "Slide 1",
					order: 0,
					dirName: "slide_01_rec",
					durationMs: 4000,
				},
			],
		});

		const manifest = await readProjectManifest(testWorkspaceDir);
		expect(manifest).not.toBeNull();
		expect(manifest?.version).toBe(2);
		expect(manifest?.projectId).toBe("proj-abc");
		expect(manifest?.title).toBe("Awesome Video");
		expect(manifest?.slides.length).toBe(1);
	});

	it("manages per-slide metadata and directories", async () => {
		const slideMeta = {
			zoomRegions: [{ id: "z1", depth: 2 }],
			wallpaper: "gradient-sunset",
		};

		await writeSlideData(testWorkspaceDir, "slide_01_rec", slideMeta);

		const readMeta = await readSlideData<typeof slideMeta>(testWorkspaceDir, "slide_01_rec");
		expect(readMeta).toEqual(slideMeta);

		const slideDirs = await listSlideDirectories(testWorkspaceDir);
		expect(slideDirs).toContain("slide_01_rec");

		const removed = await removeSlideDirectory(testWorkspaceDir, "slide_01_rec");
		expect(removed).toBe(true);

		const afterRemove = await listSlideDirectories(testWorkspaceDir);
		expect(afterRemove).not.toContain("slide_01_rec");
	});
});
