import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { WebContents } from "electron";
import { getMcpProjectContext, getMcpServerInfo } from "../agent/mcpServer";
import { getProjectsDir } from "../project/manager";
import { ensureProjectWorkspace } from "../project/projectWorkspace";
import { currentProjectPath } from "../state";

interface TerminalSession {
	id: string;
	process: ChildProcessWithoutNullStreams;
	shell: string;
	cwd: string;
}

const activeSessions = new Map<string, TerminalSession>();

export interface TerminalStartOptions {
	shell?: "powershell" | "cmd" | "bash" | "default";
}

export interface TerminalStartResult {
	sessionId: string;
	cwd: string;
	shell: string;
	mcpPort: number;
	mcpUrl: string;
	projectName: string | null;
}

/**
 * Resolves the appropriate shell executable and arguments for the current OS.
 */
function resolveShell(requested?: string): { command: string; args: string[]; label: string } {
	const isWin = process.platform === "win32";

	if (isWin) {
		if (requested === "cmd") {
			return { command: "cmd.exe", args: [], label: "Command Prompt" };
		}
		if (requested === "bash") {
			const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";
			if (existsSync(gitBash)) {
				return { command: gitBash, args: ["-i"], label: "Git Bash" };
			}
			return { command: "bash.exe", args: [], label: "WSL Bash" };
		}
		// Default Windows is PowerShell
		return { command: "powershell.exe", args: ["-NoLogo", "-NoExit"], label: "PowerShell" };
	}

	// macOS & Linux
	const envShell = process.env.SHELL || "/bin/bash";
	return { command: envShell, args: ["-l"], label: path.basename(envShell) };
}

/**
 * Prepares the active project workspace on disk so terminal sessions can operate on actual files.
 */
async function prepareProjectWorkingDirectory(): Promise<{ cwd: string; projectName: string | null }> {
	const mcpContext = getMcpProjectContext();
	const mcpInfo = getMcpServerInfo();

	if (mcpContext?.project) {
		const projectId = mcpContext.project.projectId;
		const workspaceDir = await ensureProjectWorkspace(projectId);

		// Synchronize authoritative project.json into workspace folder
		try {
			const projectJsonPath = path.join(workspaceDir, "project.json");
			await fs.writeFile(projectJsonPath, JSON.stringify(mcpContext.project, null, 2), "utf8");

			// Write standard MCP config for external CLI agents (Claude Code, agy, Cursor, Codex)
			const mcpConfigPath = path.join(workspaceDir, ".mcp.json");
			const configContent = {
				mcpServers: {
					"captr-studio": {
						url: mcpInfo.sseUrl || `http://127.0.0.1:${mcpInfo.port}/sse`,
					},
				},
			};
			await fs.writeFile(mcpConfigPath, JSON.stringify(configContent, null, 2), "utf8");
		} catch (err) {
			console.warn("[Terminal] Failed to write workspace project sync files:", err);
		}

		return {
			cwd: workspaceDir,
			projectName: mcpContext.project.title || "Untitled Project",
		};
	}

	// If a .captr project path exists, use its directory
	if (currentProjectPath) {
		return {
			cwd: path.dirname(currentProjectPath),
			projectName: path.basename(currentProjectPath).replace(/\.captr$/i, ""),
		};
	}

	// Fallback to Captr projects directory or user home
	try {
		const projectsDir = await getProjectsDir();
		return { cwd: projectsDir, projectName: null };
	} catch {
		return { cwd: os.homedir(), projectName: null };
	}
}

/**
 * Starts an interactive terminal process attached to the current project context.
 */
export async function startTerminalSession(
	webContents: WebContents,
	options?: TerminalStartOptions,
): Promise<TerminalStartResult> {
	const sessionId = crypto.randomUUID();
	const mcpContext = getMcpProjectContext();
	const projectTerminalConfig = mcpContext?.project?.terminalConfig;
	const { cwd, projectName } = await prepareProjectWorkingDirectory();

	const selectedShell =
		options?.shell && options.shell !== "default"
			? options.shell
			: projectTerminalConfig?.preferredShell && projectTerminalConfig.preferredShell !== "default"
				? projectTerminalConfig.preferredShell
				: "default";

	const { command, args, label } = resolveShell(selectedShell);
	const mcpInfo = getMcpServerInfo();

	const env: NodeJS.ProcessEnv = {
		...process.env,
		...(projectTerminalConfig?.customEnv ?? {}),
		CAPTR_PROJECT_PATH: currentProjectPath ?? "",
		CAPTR_PROJECT_ID: mcpContext?.project.projectId ?? "",
		CAPTR_WORKSPACE_DIR: cwd,
		CAPTR_MCP_PORT: String(mcpInfo.port),
		CAPTR_MCP_URL: mcpInfo.endpoint,
		CAPTR_MCP_SSE: mcpInfo.sseUrl,
		TERM: "xterm-256color",
		COLORTERM: "truecolor",
	};

	const child = spawn(command, args, {
		cwd,
		env,
		stdio: ["pipe", "pipe", "pipe"],
		windowsHide: true,
	});

	if (projectTerminalConfig?.startupCommand) {
		const cmd = projectTerminalConfig.startupCommand.trim();
		if (cmd) {
			setTimeout(() => {
				if (child.stdin.writable) {
					child.stdin.write(`${cmd}\r\n`);
				}
			}, 350);
		}
	}

	activeSessions.set(sessionId, {
		id: sessionId,
		process: child,
		shell: label,
		cwd,
	});

	child.stdout.on("data", (chunk: Buffer) => {
		if (!webContents.isDestroyed()) {
			webContents.send("terminal:data", { sessionId, data: chunk.toString("utf8") });
		}
	});

	child.stderr.on("data", (chunk: Buffer) => {
		if (!webContents.isDestroyed()) {
			webContents.send("terminal:data", { sessionId, data: chunk.toString("utf8") });
		}
	});

	child.on("exit", (code) => {
		activeSessions.delete(sessionId);
		if (!webContents.isDestroyed()) {
			webContents.send("terminal:exit", { sessionId, code: code ?? 0 });
		}
	});

	child.on("error", (err) => {
		if (!webContents.isDestroyed()) {
			webContents.send("terminal:data", {
				sessionId,
				data: `\r\n\x1b[31m[Process Error]: ${err.message}\x1b[0m\r\n`,
			});
		}
	});

	return {
		sessionId,
		cwd,
		shell: label,
		mcpPort: mcpInfo.port,
		mcpUrl: mcpInfo.endpoint,
		projectName,
	};
}

/**
 * Sends user input characters/keystrokes to the terminal session stdin.
 */
export function writeTerminalSession(sessionId: string, data: string): boolean {
	const session = activeSessions.get(sessionId);
	if (!session || !session.process.stdin.writable) return false;
	session.process.stdin.write(data);
	return true;
}

/**
 * Terminates an active terminal session.
 */
export function killTerminalSession(sessionId: string): boolean {
	const session = activeSessions.get(sessionId);
	if (!session) return false;
	try {
		session.process.kill();
	} catch {
		// Ignore kill error if already exited
	}
	activeSessions.delete(sessionId);
	return true;
}

/**
 * Opens the current working directory in an external native system terminal.
 */
export async function openExternalTerminal(customCwd?: string): Promise<{ success: boolean; error?: string }> {
	const targetCwd = customCwd || (await prepareProjectWorkingDirectory()).cwd;
	const isWin = process.platform === "win32";

	try {
		if (isWin) {
			// Try Windows Terminal first (wt.exe)
			const wt = spawn("cmd.exe", ["/c", "start", "wt.exe", "-d", targetCwd], {
				detached: true,
				stdio: "ignore",
			});
			wt.on("error", () => {
				// Fallback to powershell.exe
				spawn("cmd.exe", ["/c", "start", "powershell.exe", "-NoExit", "-Command", `Set-Location '${targetCwd}'`], {
					detached: true,
					stdio: "ignore",
				});
			});
			wt.unref();
		} else if (process.platform === "darwin") {
			spawn("open", ["-a", "Terminal", targetCwd], { detached: true, stdio: "ignore" }).unref();
		} else {
			spawn("x-terminal-emulator", [`--working-directory=${targetCwd}`], { detached: true, stdio: "ignore" }).unref();
		}
		return { success: true };
	} catch (err) {
		return { success: false, error: err instanceof Error ? err.message : String(err) };
	}
}

/**
 * Opens the current working directory in VS Code / Cursor if installed.
 */
export async function openInCodeEditor(customCwd?: string): Promise<{ success: boolean; error?: string }> {
	const targetCwd = customCwd || (await prepareProjectWorkingDirectory()).cwd;
	try {
		const child = spawn("code", [targetCwd], { shell: true, detached: true, stdio: "ignore" });
		child.unref();
		return { success: true };
	} catch (err) {
		return { success: false, error: err instanceof Error ? err.message : String(err) };
	}
}
