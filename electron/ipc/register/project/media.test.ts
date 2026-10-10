import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
	handlers: new Map<string, (...args: any[]) => any>(),
	root: "",
	rememberApprovedLocalReadPath: vi.fn(),
}));

vi.mock("electron", () => ({
	ipcMain: {
		handle: (name: string, handler: (...args: any[]) => any) =>
			mock.handlers.set(name, handler),
	},
	dialog: { showOpenDialog: vi.fn() },
}));
vi.mock("../../project/manager", () => ({
	rememberApprovedLocalReadPath: mock.rememberApprovedLocalReadPath,
	resolveApprovedLocalMediaPath: vi.fn(async () => null),
}));
vi.mock("../../../mediaServer", () => ({
	buildMediaUrl: vi.fn(),
	getMediaServerBaseUrl: vi.fn(() => null),
}));
vi.mock("../../utils", () => ({
	getRecordingsDir: vi.fn(async () => mock.root),
	normalizePath: (filePath: string) => filePath,
}));

import { registerProjectMediaHandlers } from "./media";

beforeEach(async () => {
	mock.root = await fs.mkdtemp(path.join(os.tmpdir(), "captr-media-ipc-test-"));
	mock.handlers.clear();
	mock.rememberApprovedLocalReadPath.mockReset();
	registerProjectMediaHandlers();
});

afterEach(async () => {
	if (path.dirname(path.resolve(mock.root)) !== path.resolve(os.tmpdir()))
		throw new Error("Unsafe test cleanup path");
	await fs.rm(mock.root, { recursive: true, force: true });
});

it("approves the path returned by a successful recorded-audio save", async () => {
	const save = mock.handlers.get("save-recorded-audio");
	expect(save).toBeTypeOf("function");
	const result = await save!(null, { audioBuffer: new Uint8Array([1, 2, 3]), extension: "webm" });

	expect(result.success).toBe(true);
	expect(result.filePath).toContain(path.join("voiceovers", "voiceover-"));
	expect(mock.rememberApprovedLocalReadPath).toHaveBeenCalledOnce();
	expect(mock.rememberApprovedLocalReadPath).toHaveBeenCalledWith(result.filePath);
});

it("registers a temporary-audio discard handler rooted at the recordings directory", async () => {
	const save = mock.handlers.get("save-recorded-audio");
	const discard = mock.handlers.get("discard-recorded-audio");
	expect(discard).toBeTypeOf("function");
	const saved = await save!(null, { audioBuffer: [1], extension: "wav" });

	const result = await discard!(null, saved.filePath);
	expect(result.success).toBe(true);
	expect(result.deleted).toBe(true);
	expect(await fs.stat(saved.filePath).catch(() => null)).toBeNull();
});
