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
import { KNOWN_AGENTS, checkAgentAvailability, getAugmentedEnv } from "./agentDetector";

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

export function formatAgentTaskPrompt(userPrompt: string, draftFilePath: string): string {
	return `You are editing a Captr Studio video timeline project.
The current project state is stored in: "${draftFilePath}".
Also read "CONTEXT.md" in the same folder, which contains clip summaries and speech transcripts with word timestamps.

USER REQUEST:
"${userPrompt}"

INSTRUCTIONS:
1. Open and inspect "${draftFilePath}".
2. Apply the requested edits (trimming clips, cutting pauses, deleting or reordering clips).
3. Ensure all clip startUs, duration, and source range properties match the TimelineProject schema and do not overlap.
4. Save the modified JSON directly back to "${draftFilePath}" OR print the updated JSON as your final response.`;
}

/**
 * Builds the exact CLI arguments for the specified agent.
 * Automatically injects flags before prompt so -p doesn't consume them as values.
 */
export function buildAgentCommandArgs(
	agentId: string,
	taskPrompt: string,
	workspaceDir?: string,
	defaultArgs?: string[],
): string[] {
	if (agentId === "agy") {
		const args = ["--dangerously-skip-permissions"];
		if (workspaceDir) {
			args.push("--add-dir", workspaceDir);
		}
		args.push("-p", taskPrompt);
		return args;
	}
	if (agentId === "claude") {
		return ["--dangerously-skip-permissions", "-p", taskPrompt];
	}
	if (agentId === "opencode") {
		return ["run", "--auto", taskPrompt];
	}
	if (defaultArgs && defaultArgs.length > 0) {
		return [...defaultArgs, taskPrompt];
	}
	return [taskPrompt];
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
		let command = params.customCommand?.trim() || known?.command || params.agentId;

		// Resolve absolute executable path if available
		if (!path.isAbsolute(command)) {
			const resolvedPath = await checkAgentAvailability(command);
			if (resolvedPath) {
				command = resolvedPath;
			}
		}

		const taskPrompt = formatAgentTaskPrompt(params.userPrompt, draftFile);
		const args = buildAgentCommandArgs(params.agentId, taskPrompt, tempDir, known?.defaultArgs);

		log(`[Captr Studio] Launching agent: ${command} in ${tempDir}...\n`);

		// Windows: If command is an .exe, run without cmd.exe shell so arguments aren't broken
		const useShell =
			process.platform === "win32" && !command.toLowerCase().endsWith(".exe");

		const child = spawn(command, args, {
			cwd: tempDir,
			shell: useShell,
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...getAugmentedEnv(),
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
			const cleanDisk = diskContent.replace(/^\uFEFF/, "").trim();
			const cleanOriginal = context.projectJson.trim();
			if (cleanDisk && cleanDisk !== cleanOriginal) {
				parsedResult = parseAgentProjectOutput(cleanDisk);
			}
		} catch {}

		// 2. If not modified on disk, parse stdout
		if (!parsedResult || !parsedResult.success) {
			parsedResult = parseAgentProjectOutput(stdoutAccumulator);
		}

		if (!parsedResult.success || !parsedResult.project) {
			let friendlyError = parsedResult.error;
			const combinedLogs = `${stdoutAccumulator}\n${stderrAccumulator}`;

			if (combinedLogs.includes("Not logged in")) {
				friendlyError = `Agent "${path.basename(command)}" is not logged in. Run "${path.basename(command)}" in your terminal to authenticate, or switch to "Antigravity (agy)".`;
			} else if (
				combinedLogs.includes("Auth method") ||
				combinedLogs.includes("API_KEY") ||
				combinedLogs.includes("GEMINI_API_KEY")
			) {
				friendlyError = `Agent "${path.basename(command)}" requires an API key. For zero-setup editing, choose "Antigravity (agy)" which uses your active session directly.`;
			}

			return {
				success: false,
				logs,
				error:
					friendlyError ||
					`Agent completed without writing valid project edits. Error: ${stderrAccumulator.slice(-300) || stdoutAccumulator.slice(-300)}`,
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
