import { ipcMain } from "electron";
import { checkCustomAgent, detectAvailableAgents } from "../agent/agentDetector";
import {
	cancelAgentTask,
	type RunAgentTaskParams,
	type RunAgentTaskResult,
	runAgentTask,
} from "../agent/agentRunner";
import {
	cancelActiveHyperframeAgentTask,
	type RunHyperframeTaskParams,
	type RunHyperframeTaskResult,
	runHyperframeAgentTask,
} from "../agent/hyperframeAgentRunner";
import {
	type ActiveProjectContext,
	clearSpeculativeProject,
	getMcpServerInfo,
	setMcpProjectContext,
	startMcpServer,
	stopMcpServer,
} from "../agent/mcpServer";

export function registerAgentHandlers() {
	// Auto-start local MCP server on app initialization
	void startMcpServer().catch((err) => {
		console.warn("[MCP] Failed to auto-start local MCP server:", err);
	});

	ipcMain.handle("agent:get-available", async () => {
		return detectAvailableAgents();
	});

	ipcMain.handle("agent:check-custom", async (_, command: string) => {
		return checkCustomAgent(command);
	});

	ipcMain.handle("agent:get-mcp-info", async () => {
		return getMcpServerInfo();
	});

	ipcMain.handle("agent:start-mcp-server", async (_, port?: number) => {
		return startMcpServer(port);
	});

	ipcMain.handle("agent:stop-mcp-server", () => {
		stopMcpServer();
		return { success: true };
	});

	ipcMain.handle("agent:sync-project-context", (_, context: ActiveProjectContext) => {
		if (
			context.project.projectId !== context.editContext?.projectId ||
			(context.editContext.scope.kind === "artboard"
				? context.editContext.scope.artboardId
				: null) !== context.activeArtboardId
		) {
			throw new Error("Invalid Story edit context identity");
		}
		setMcpProjectContext(context);
		return { success: true };
	});

	ipcMain.handle("agent:clear-speculative", () => {
		clearSpeculativeProject();
		return { success: true };
	});

	ipcMain.handle(
		"agent:run-task",
		async (event, params: RunAgentTaskParams): Promise<RunAgentTaskResult> => {
			return runAgentTask(params, (chunk) => {
				if (!event.sender.isDestroyed()) {
					event.sender.send("agent:log-stream", chunk);
				}
			});
		},
	);

	ipcMain.handle("agent:cancel-task", () => {
		return cancelAgentTask();
	});

	ipcMain.handle(
		"agent:run-hyperframe-task",
		async (event, params: RunHyperframeTaskParams): Promise<RunHyperframeTaskResult> => {
			return runHyperframeAgentTask(params, (chunk) => {
				if (!event.sender.isDestroyed()) {
					event.sender.send("agent:hyperframe-log-stream", chunk);
				}
			});
		},
	);

	ipcMain.handle("agent:cancel-hyperframe-task", () => {
		return cancelActiveHyperframeAgentTask();
	});
}
