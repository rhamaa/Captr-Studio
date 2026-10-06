import { ipcMain } from "electron";
import { checkCustomAgent, detectAvailableAgents } from "../agent/agentDetector";
import {
	type RunAgentTaskParams,
	type RunAgentTaskResult,
	cancelAgentTask,
	runAgentTask,
} from "../agent/agentRunner";
import {
	type RunHyperframeTaskParams,
	type RunHyperframeTaskResult,
	cancelActiveHyperframeAgentTask,
	runHyperframeAgentTask,
} from "../agent/hyperframeAgentRunner";

export function registerAgentHandlers() {
	ipcMain.handle("agent:get-available", async () => {
		return detectAvailableAgents();
	});

	ipcMain.handle("agent:check-custom", async (_, command: string) => {
		return checkCustomAgent(command);
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
