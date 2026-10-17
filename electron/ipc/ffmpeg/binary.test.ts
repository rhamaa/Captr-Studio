import { afterEach, describe, expect, it, vi } from "vitest";

const { spawnSyncMock, existsSyncMock, nodeRequireMock } = vi.hoisted(() => ({
	spawnSyncMock: vi.fn(),
	existsSyncMock: vi.fn(),
	nodeRequireMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({ spawnSync: spawnSyncMock }));
vi.mock("node:fs", () => ({ existsSync: existsSyncMock }));
vi.mock("node:module", () => ({ createRequire: () => nodeRequireMock }));
vi.mock("electron", () => ({ app: { isPackaged: false } }));

import { getFfmpegBinaryPath } from "./binary";

describe("getFfmpegBinaryPath", () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("falls back when the bundled executable exists but cannot start", () => {
		nodeRequireMock.mockReturnValue("bundled-ffmpeg.exe");
		existsSyncMock.mockReturnValue(true);
		spawnSyncMock.mockImplementation((command: string) => {
			if (command === "bundled-ffmpeg.exe") {
				return { status: null, error: new Error("not a valid executable") };
			}
			if (command === (process.platform === "win32" ? "where" : "which")) {
				return { status: 0, stdout: "system-ffmpeg.exe\n" };
			}
			if (command === "system-ffmpeg.exe") {
				return { status: 0, error: undefined };
			}
			return { status: 1, error: new Error("unexpected command") };
		});

		expect(getFfmpegBinaryPath()).toBe("system-ffmpeg.exe");
	});
});
