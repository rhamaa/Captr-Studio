import { ipcMain } from "electron";
import { detectAvailableAgents } from "../agent/agentDetector";
import {
	type RunAgentTaskParams,
	type RunAgentTaskResult,
	cancelAgentTask,
	runAgentTask,
} from "../agent/agentRunner";

export function registerAgentHandlers() {
	ipcMain.handle("agent:get-available", async () => {
		return detectAvailableAgents();
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
}
