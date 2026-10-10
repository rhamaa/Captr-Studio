import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProjectTerminal } from "./ProjectTerminal";

describe("ProjectTerminal component", () => {
	it("renders terminal header with shell selector and quick actions", () => {
		vi.stubGlobal("window", {
			electronAPI: {
				startTerminal: vi.fn().mockResolvedValue({
					sessionId: "test-session",
					cwd: "D:/workspaces/test-proj",
					shell: "PowerShell",
					mcpPort: 39420,
					mcpUrl: "http://127.0.0.1:39420",
					projectName: "My Project",
				}),
				killTerminal: vi.fn(),
				writeTerminal: vi.fn(),
				onTerminalData: vi.fn().mockReturnValue(() => undefined),
				onTerminalExit: vi.fn().mockReturnValue(() => undefined),
			},
		});

		const markup = renderToStaticMarkup(createElement(ProjectTerminal));

		expect(markup).toContain("PowerShell");
		expect(markup).toContain("Open External");
		expect(markup).toContain("VS Code");
		vi.unstubAllGlobals();
	});

	it("renders Project Settings button and Close button when props provided", () => {
		const onUpdateTerminalConfig = vi.fn();
		const onClose = vi.fn();

		const markup = renderToStaticMarkup(
			createElement(ProjectTerminal, {
				terminalConfig: {
					preferredShell: "cmd",
					startupCommand: "npm run test",
					customEnv: { FOO: "BAR" },
				},
				onUpdateTerminalConfig,
				onClose,
			}),
		);

		expect(markup).toContain("Project Settings");
		expect(markup).toContain("Close Terminal Drawer");
	});
});
