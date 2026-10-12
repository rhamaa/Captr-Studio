import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordingFramePreset } from "../../../src/recording/editor/recordingFramePresets";
import {
	parseRecordingFramePreset,
	serializeRecordingFramePreset,
} from "../../../src/recording/editor/recordingFramePresets";
import type { RecordingFrameAppearance } from "../../../src/recording/schema";

const mock = vi.hoisted(() => ({
	handlers: new Map<string, (...args: any[]) => Promise<any>>(),
	userData: "",
	openDialog: vi.fn(),
	saveDialog: vi.fn(),
}));

vi.mock("electron", () => ({
	app: { getPath: () => mock.userData },
	ipcMain: {
		handle: (channel: string, handler: (...args: any[]) => Promise<any>) =>
			mock.handlers.set(channel, handler),
	},
	dialog: { showOpenDialog: mock.openDialog, showSaveDialog: mock.saveDialog },
}));

import { registerRecordFramePresetHandlers } from "./recordFramePresets";

const appearance: RecordingFrameAppearance = {
	framePadding: 12,
	borderWidth: 2,
	borderColor: "#ffffff",
	borderOpacity: 0.8,
	cornerRadius: 24,
	surfaceColor: "#111827",
	surfaceOpacity: 0.65,
	backdropBlur: 12,
	shadow: { color: "#000000", opacity: 0.4, blur: 20, offsetX: 0, offsetY: 8 },
};

let testDir = "";

async function invoke(channel: string, ...args: unknown[]) {
	const handler = mock.handlers.get(channel);
	if (!handler) throw new Error(`Missing IPC handler: ${channel}`);
	return handler({}, ...args);
}

async function readPresets(): Promise<RecordingFramePreset[]> {
	const result = await invoke("record-frame-presets:list");
	if (!result.success) throw new Error(result.error);
	return result.value;
}

describe("record frame preset IPC library", () => {
	beforeEach(async () => {
		testDir = await fs.mkdtemp(path.join(os.tmpdir(), "captr-frame-presets-"));
		mock.userData = testDir;
		mock.handlers.clear();
		mock.openDialog.mockReset().mockResolvedValue({ canceled: true, filePaths: [] });
		mock.saveDialog.mockReset().mockResolvedValue({ canceled: true, filePath: undefined });
		registerRecordFramePresetHandlers();
	});

	afterEach(async () => {
		vi.restoreAllMocks();
		await fs.rm(testDir, { recursive: true, force: true });
	});

	it("stores in app userData and supports list, rename, and delete", async () => {
		const created = await invoke("record-frame-presets:save", "Clean Frame", appearance);
		expect(created.success).toBe(true);
		expect(created.value.id).toMatch(/^[0-9a-f-]{36}$/i);
		expect(
			await fs.readFile(
				path.join(testDir, "record-frame-presets", `${created.value.id}.json`),
				"utf8",
			),
		).toBe(serializeRecordingFramePreset(created.value));
		expect(await fs.readdir(path.join(testDir, "record-frame-presets"))).toEqual([
			`${created.value.id}.json`,
		]);
		expect(await readPresets()).toEqual([created.value]);

		const renamed = await invoke(
			"record-frame-presets:rename",
			created.value.id,
			"  New Name  ",
		);
		expect(renamed.success).toBe(true);
		expect(renamed.value.name).toBe("New Name");
		const deleted = await invoke("record-frame-presets:delete", created.value.id);
		expect(deleted).toEqual({ success: true, value: { id: created.value.id } });
		expect(await readPresets()).toEqual([]);
	});

	it("assigns unique IDs and resolves duplicate names", async () => {
		const first = await invoke("record-frame-presets:save", "Tutorial", appearance);
		const second = await invoke("record-frame-presets:save", "Tutorial", appearance);
		expect(first.success && second.success).toBe(true);
		expect(first.value.id).not.toBe(second.value.id);
		expect(second.value.name).toBe("Tutorial (2)");
	});

	it("writes atomically and removes temporary files after a failed replacement", async () => {
		const rename = vi.spyOn(fs, "rename").mockRejectedValueOnce(new Error("disk full"));
		const failed = await invoke("record-frame-presets:save", "Broken", appearance);
		expect(rename).toHaveBeenCalledOnce();
		expect(failed).toMatchObject({ success: false, error: expect.any(String) });
		expect(await fs.readdir(path.join(testDir, "record-frame-presets"))).toEqual([]);
	});

	it("imports with a fresh ID and resolves duplicate names", async () => {
		const existing = await invoke("record-frame-presets:save", "Tutorial", appearance);
		const importPath = path.join(testDir, "incoming.json");
		const source: RecordingFramePreset = {
			schemaVersion: 1,
			id: "original-preset",
			name: "Tutorial",
			createdAt: "2026-10-12T00:00:00.000Z",
			updatedAt: "2026-10-12T00:00:00.000Z",
			appearance,
		};
		await fs.writeFile(importPath, serializeRecordingFramePreset(source));
		mock.openDialog.mockResolvedValueOnce({ canceled: false, filePaths: [importPath] });

		const imported = await invoke("record-frame-presets:import");
		expect(imported.success).toBe(true);
		expect(imported.value.id).not.toBe(source.id);
		expect(imported.value.id).not.toBe(existing.value.id);
		expect(imported.value.name).toBe("Tutorial (2)");
		expect(await readPresets()).toHaveLength(2);
	});

	it("exports a selected preset as a round-trippable JSON file", async () => {
		const saved = await invoke("record-frame-presets:save", "Export Me", appearance);
		const exportPath = path.join(testDir, "exported.json");
		mock.saveDialog.mockResolvedValueOnce({ canceled: false, filePath: exportPath });

		const exported = await invoke("record-frame-presets:export", saved.value.id);
		expect(exported).toEqual({ success: true, value: { exported: true } });
		expect(
			parseRecordingFramePreset(JSON.parse(await fs.readFile(exportPath, "utf8"))),
		).toEqual(saved.value);
	});

	it("returns cancellation without changing the library", async () => {
		const imported = await invoke("record-frame-presets:import");
		expect(imported).toEqual({ success: true, canceled: true });
		expect(await readPresets()).toEqual([]);

		const saved = await invoke("record-frame-presets:save", "Keep", appearance);
		const exported = await invoke("record-frame-presets:export", saved.value.id);
		expect(exported).toEqual({ success: true, canceled: true });
		expect(await readPresets()).toEqual([saved.value]);
	});

	it("rejects unsafe IDs and malformed input without mutating storage", async () => {
		expect(await invoke("record-frame-presets:rename", "../outside", "Changed")).toMatchObject({
			success: false,
		});
		expect(await invoke("record-frame-presets:delete", "../../outside")).toMatchObject({
			success: false,
		});
		expect(
			await invoke("record-frame-presets:save", "Invalid", {
				...appearance,
				borderOpacity: 4,
			}),
		).toMatchObject({
			success: false,
		});
		const importPath = path.join(testDir, "invalid.json");
		await fs.writeFile(importPath, "{broken json");
		mock.openDialog.mockResolvedValueOnce({ canceled: false, filePaths: [importPath] });
		expect(await invoke("record-frame-presets:import")).toMatchObject({ success: false });
		expect(await readPresets()).toEqual([]);
	});
});
