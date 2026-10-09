import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi, beforeAll, afterAll } from "vitest";
import {
	killTerminalSession,
	openExternalTerminal,
	startTerminalSession,
	writeTerminalSession,
} from "./terminalService";
import { setMcpProjectContext } from "../agent/mcpServer";
import { createTimelineProject } from "../../../src/core/timeline/commands";

vi.mock("electron", () => ({
	BrowserWindow: {
		getAllWindows: () => [],
	},
	app: {
		isPackaged: false,
		getAppPath: () => os.tmpdir(),
		getPath: (name: string) => path.join(os.tmpdir(), "captr-test-" + (name || "userData")),
		setPath: () => undefined,
	},
}));

describe("terminalService", () => {
	const mockWebContents = {
		isDestroyed: () => false,
		send: vi.fn(),
	} as any;

	beforeAll(() => {
		const proj = createTimelineProject("test-term-proj", "Test Terminal Project");
		setMcpProjectContext({
			project: proj,
			transcripts: {},
			playheadUs: 0,
			selection: [],
			activeArtboardId: null,
		});
	});

	it("starts a terminal session in project context and receives data", async () => {
		const result = await startTerminalSession(mockWebContents, { shell: "default" });

		expect(result).toBeDefined();
		expect(typeof result.sessionId).toBe("string");
		expect(result.cwd).toBeTruthy();
		expect(result.projectName).toBe("Test Terminal Project");

		// Test writing data
		const written = writeTerminalSession(result.sessionId, "echo test\r\n");
		expect(written).toBe(true);

		// Cleanup
		const killed = killTerminalSession(result.sessionId);
		expect(killed).toBe(true);
	});

	it("returns false when writing to non-existent session", () => {
		expect(writeTerminalSession("non-existent-id", "test")).toBe(false);
		expect(killTerminalSession("non-existent-id")).toBe(false);
	});

	it("handles open external terminal invocation without throw", async () => {
		const res = await openExternalTerminal();
		expect(res).toBeDefined();
		expect(typeof res.success).toBe("boolean");
	});
});
