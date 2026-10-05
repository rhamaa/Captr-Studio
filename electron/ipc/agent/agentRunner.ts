import { type ChildProcess, spawn } from "node:child_process";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	type AgentDiffSummary,
	assembleAgentEditingContext,
	parseAgentProjectOutput,
	summarizeProjectDiff,
} from "../../../src/core/timeline/agentPayload";
import type { AssetTranscript } from "../../../src/core/timeline/transcriptTypes";
import type { TimelineProject } from "../../../src/core/timeline/types";
import { KNOWN_AGENTS } from "./agentDetector";

export interface RunAgentTaskParams {
	agentId: string;
	customCommand?: string;
	userPrompt: string;
	project: TimelineProject;
	transcripts: Record<string, AssetTranscript>;
}

export interface RunAgentTaskResult {
	success: boolean;
	project?: TimelineProject;
	diff?: AgentDiffSummary;
	logs: string[];
	error?: string;
}

let activeProcess: ChildProcess | null = null;

export function formatAgentTaskPrompt(userPrompt: string, draftFileName: string): string {
	return `You are editing a Captr Studio video timeline project.
The current project state is stored in "${draftFileName}".
Also read "CONTEXT.md" which contains clip summaries and speech transcripts with word timestamps.

USER REQUEST:
"${userPrompt}"

INSTRUCTIONS:
1. Open and inspect "${draftFileName}".
2. Apply the requested edits (trimming clips, cutting pauses, deleting or reordering clips).
3. Ensure all clip startUs, duration, and source range properties match the TimelineProject schema and do not overlap.
4. Save the modified JSON directly back to "${draftFileName}" OR print the updated JSON as your final response.`;
}

/**
 * Executes a CLI agent in a dedicated workspace directory to edit the timeline project.
 */
export async function runAgentTask(
	params: RunAgentTaskParams,
	onLog?: (chunk: string) => void,
): Promise<RunAgentTaskResult> {
	if (activeProcess) {
		return {
			success: false,
			logs: [],
			error: "An agent task is already running. Please cancel or wait for it to complete.",
		};
	}

	const logs: string[] = [];
	const log = (msg: string) => {
		logs.push(msg);
		onLog?.(msg);
	};

	// Create temporary workspace folder
	const tempDir = path.join(
		os.tmpdir(),
		`captr-agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
	);
	await fsPromises.mkdir(tempDir, { recursive: true });

	const draftFile = path.join(tempDir, "project_draft.json");
	const contextFile = path.join(tempDir, "CONTEXT.md");

	try {
		// Assemble context
		const context = assembleAgentEditingContext(
			params.project,
			params.transcripts,
			params.userPrompt,
		);

		await fsPromises.writeFile(draftFile, context.projectJson, "utf-8");
		await fsPromises.writeFile(contextFile, context.fullContextMarkdown, "utf-8");

		// Resolve agent executable & arguments
		const known = KNOWN_AGENTS.find((a) => a.id === params.agentId);
		const command = params.customCommand?.trim() || known?.command || params.agentId;
		const taskPrompt = formatAgentTaskPrompt(params.userPrompt, "project_draft.json");

		let args: string[] = [];
		if (params.agentId === "claude" || params.agentId === "agy") {
			args = ["-p", taskPrompt];
		} else if (params.agentId === "opencode") {
			args = ["run", taskPrompt];
		} else {
			args = [taskPrompt];
		}

		log(`[Captr Studio] Launching agent: ${command} in ${tempDir}...\n`);

		const child = spawn(command, args, {
			cwd: tempDir,
			shell: process.platform === "win32",
			env: {
				...process.env,
				FORCE_COLOR: "0",
			},
		});
		activeProcess = child;

		let stdoutAccumulator = "";
		let stderrAccumulator = "";

		child.stdout?.on("data", (data: Buffer) => {
			const text = data.toString();
			stdoutAccumulator += text;
			log(text);
		});

		child.stderr?.on("data", (data: Buffer) => {
			const text = data.toString();
			stderrAccumulator += text;
			log(text);
		});

		await new Promise<void>((resolve, reject) => {
			child.on("error", (err) => reject(err));
			child.on("close", (code) => {
				log(`\n[Captr Studio] Agent finished with code ${code}.\n`);
				resolve();
			});
		});

		// 1. Check if draftFile on disk was updated
		let parsedResult = null;
		try {
			const diskContent = await fsPromises.readFile(draftFile, "utf-8");
			if (diskContent && diskContent !== context.projectJson) {
				parsedResult = parseAgentProjectOutput(diskContent);
			}
		} catch {}

		// 2. If not modified on disk, parse stdout
		if (!parsedResult || !parsedResult.success) {
			parsedResult = parseAgentProjectOutput(stdoutAccumulator);
		}

		if (!parsedResult.success || !parsedResult.project) {
			return {
				success: false,
				logs,
				error:
					parsedResult.error ||
					`Agent completed without writing valid project edits. Error logs: ${stderrAccumulator.slice(-300)}`,
			};
		}

		const diff = summarizeProjectDiff(params.project, parsedResult.project);
		return {
			success: true,
			project: parsedResult.project,
			diff,
			logs,
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log(`[Captr Studio] Error: ${message}\n`);
		return {
			success: false,
			logs,
			error: message,
		};
	} finally {
		activeProcess = null;
		await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
	}
}

/**
 * Cancels any currently running agent process.
 */
export function cancelAgentTask(): boolean {
	if (activeProcess) {
		activeProcess.kill();
		activeProcess = null;
		return true;
	}
	return false;
}
