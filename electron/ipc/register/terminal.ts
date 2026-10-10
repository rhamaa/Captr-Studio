import { ipcMain } from "electron";
import {
	killTerminalSession,
	openExternalTerminal,
	openInCodeEditor,
	startTerminalSession,
	type TerminalStartOptions,
	writeTerminalSession,
} from "../terminal/terminalService";

export function registerTerminalHandlers() {
	ipcMain.handle("terminal:start", async (event, options?: TerminalStartOptions) => {
		return startTerminalSession(event.sender, options);
	});

	ipcMain.handle("terminal:write", (_, sessionId: string, data: string) => {
		return writeTerminalSession(sessionId, data);
	});

	ipcMain.handle("terminal:kill", (_, sessionId: string) => {
		return killTerminalSession(sessionId);
	});

	ipcMain.handle("terminal:open-external", async (_, cwd?: string) => {
		return openExternalTerminal(cwd);
	});

	ipcMain.handle("terminal:open-code", async (_, cwd?: string) => {
		return openInCodeEditor(cwd);
	});
}
