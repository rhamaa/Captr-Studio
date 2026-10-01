import { beforeEach, describe, expect, it, vi } from "vitest";
const handlers = vi.hoisted(() => new Map<string, (...args: any[]) => any>());
vi.mock("electron", () => ({
	app: { getPath: () => "C:/mock", isPackaged: false },
	ipcMain: { handle: (name: string, fn: (...args: any[]) => any) => handlers.set(name, fn) },
	BrowserWindow: { getAllWindows: () => [] },
}));
vi.mock("../../project/manager", () => ({
	isPathInsideDirectory: () => true,
	rememberApprovedLocalReadPath: vi.fn(),
	replaceApprovedSessionLocalReadPaths: vi.fn(),
}));
vi.mock("../../project/session", () => ({
	persistRecordingSessionManifest: vi.fn(),
	resolveRecordingSession: vi.fn(async () => null),
}));
vi.mock("../../utils", () => ({
	approveUserPath: vi.fn(),
	getRecordingsDir: vi.fn(),
	getTelemetryPathForVideo: vi.fn(),
	isAutoRecordingPath: vi.fn(),
	normalizeVideoSourcePath: (p: string | null) => p,
}));
import { registerProjectSessionHandlers } from "./session";
import * as state from "../../state";

describe("Record session project destination", () => {
	beforeEach(() => {
		handlers.clear();
		registerProjectSessionHandlers();
		state.setCurrentProjectPath("C:/projects/Test 2.captr");
		state.setPreserveProjectPathForNextNativeRecording(false);
	});
	it.each([
		"set-current-video-path",
		"set-current-recording-session",
	])("%s consumes native HUD preservation once, including Windows finalization", async (name) => {
		state.setPreserveProjectPathForNextNativeRecording(true);
		const media =
			name === "set-current-video-path"
				? "C:/recordings/second.mp4"
				: { videoPath: "C:/recordings/second.mp4", webcamPath: "C:/recordings/webcam.mp4" };
		await handlers.get(name)!(null, media);
		expect(state.currentProjectPath).toBe("C:/projects/Test 2.captr");
		expect(state.currentVideoPath).toBe("C:/recordings/second.mp4");
		await handlers.get(name)!(null, media);
		expect(state.currentProjectPath).toBeNull();
	});
	it.each([
		"set-current-video-path",
		"set-current-recording-session",
	])("%s preserves browser/explicit project context", async (name) => {
		const media =
			name === "set-current-video-path"
				? "C:/recordings/second.mp4"
				: { videoPath: "C:/recordings/second.mp4" };
		await handlers.get(name)!(null, media, { preserveProjectPath: true });
		expect(state.currentProjectPath).toBe("C:/projects/Test 2.captr");
	});
});
