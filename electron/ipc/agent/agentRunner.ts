import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { app } from "electron";
import {
	type AgentDiffSummary,
	assembleAgentEditingContext,
	parseAgentProjectOutput,
	summarizeProjectDiff,
} from "../../../src/core/timeline/agentPayload";
import {
	injectBRollClipsIntoProject,
	validateBRollSpecs,
} from "../../../src/core/timeline/brollTypes";
import type { AssetTranscript } from "../../../src/core/timeline/transcriptTypes";
import type { TimelineProject } from "../../../src/core/timeline/types";
import { renderHyperframeBRoll } from "../hyperframe/hyperframeRenderer";
import { KNOWN_AGENTS, checkAgentAvailability, getAugmentedEnv } from "./agentDetector";
import {
	getMcpProjectContext,
	getMcpServerInfo,
	getSpeculativeProject,
	setMcpProjectContext,
	setSpeculativeProject,
} from "./mcpServer";

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
4. Save the modified JSON directly back to "${draftFilePath}" OR print the updated JSON as your final response.
5. If MCP tools are enabled, you can also use structured tools: get_project_context, split_clip, trim_clip, remove_silence, add_broll_or_overlay, preview_speculative_edits, commit_edits.`;
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

		const prevCtx = getMcpProjectContext();
		setMcpProjectContext({
			project: params.project,
			transcripts: params.transcripts,
			playheadUs: prevCtx?.playheadUs ?? 0,
			selection: prevCtx?.selection ?? [],
			activeArtboardId: prevCtx?.activeArtboardId ?? null,
		});

		const mcpInfo = getMcpServerInfo();
		if (mcpInfo.running) {
			await fsPromises.writeFile(
				path.join(tempDir, ".mcp.json"),
				JSON.stringify(mcpInfo.mcpConfig, null, 2),
				"utf-8",
			);
		}

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

		// 3. If agent executed edits directly via local MCP tools
		if (!parsedResult || !parsedResult.success) {
			const spec = getSpeculativeProject();
			if (spec && JSON.stringify(spec) !== JSON.stringify(params.project)) {
				parsedResult = { success: true, project: spec };
			}
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

		let finalProject = parsedResult.project;

		// 3. Stage 2: Check for broll_specs.json and render Hyperframe B-Roll animations
		const brollSpecFile = path.join(tempDir, "broll_specs.json");
		try {
			if (fs.existsSync(brollSpecFile)) {
				const rawBroll = JSON.parse(await fsPromises.readFile(brollSpecFile, "utf-8"));
				const validatedSpecs = validateBRollSpecs(rawBroll);
				if (validatedSpecs.length > 0) {
					log(`\n[Captr Studio] Detected ${validatedSpecs.length} B-Roll specifications in broll_specs.json.\n`);
					log(`[Captr Studio] Rendering motion graphics via Hyperframe Engine...\n`);

					const userDataPath = app?.getPath?.("userData") ?? os.tmpdir();
					const brollStorageDir = path.join(userDataPath, "hyperframe_assets");
					await fsPromises.mkdir(brollStorageDir, { recursive: true });

					const renderResults = [];
					for (const spec of validatedSpecs) {
						const assetDir = path.join(brollStorageDir, `broll-${spec.id}`);
						log(`  • Rendering B-Roll [${spec.type}]: "${spec.title}"...\n`);
						const res = await renderHyperframeBRoll(spec, assetDir, finalProject.canvas);
						if (res.success) {
							log(`    ✓ Rendered successfully (${(res.durationUs / 1_000_000).toFixed(1)}s)\n`);
						} else {
							log(`    ⚠ Render notice: ${res.error}\n`);
						}
						renderResults.push(res);
					}

					finalProject = injectBRollClipsIntoProject(finalProject, renderResults);
				}
			}
		} catch (brollErr) {
			const brollMsg = brollErr instanceof Error ? brollErr.message : String(brollErr);
			log(`[Captr Studio] B-Roll processing notice: ${brollMsg}\n`);
		}

		const diff = summarizeProjectDiff(params.project, finalProject);
		setSpeculativeProject(finalProject, diff);
		return {
			success: true,
			project: finalProject,
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
