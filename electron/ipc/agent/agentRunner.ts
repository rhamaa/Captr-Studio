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
import {
	getStoryEditProject,
	type StoryEditContext,
	sameStoryEditContext,
} from "../../../src/core/timeline/storyOwnership";
import type { AssetTranscript } from "../../../src/core/timeline/transcriptTypes";
import type { TimelineProject } from "../../../src/core/timeline/types";
import { renderHyperframeBRoll } from "../hyperframe/hyperframeRenderer";
import { checkAgentAvailability, getAugmentedEnv, KNOWN_AGENTS } from "./agentDetector";
import {
	getMcpProjectContext,
	getMcpServerInfo,
	getSpeculativeProject,
	setSpeculativeProject,
} from "./mcpServer";

export interface RunAgentTaskParams {
	editContext: StoryEditContext;
	agentId: string;
	customCommand?: string;
	model?: string;
	userPrompt: string;
	project: TimelineProject;
	transcripts: Record<string, AssetTranscript>;
}

export interface RunAgentTaskResult {
	context?: StoryEditContext;
	success: boolean;
	project?: TimelineProject;
	diff?: AgentDiffSummary;
	logs: string[];
	error?: string;
}

let activeProcess: ChildProcess | null = null;

/**
 * Resolves spawn execution options for Windows and POSIX.
 * On Windows, native .exe executables must run with shell: false so that Node.js
 * uses Win32 CreateProcess argument formatting, preserving quotes and avoiding
 * cmd.exe token splitting (e.g. unexpected argument on commas/spaces).
 * Only Windows batch files (.cmd / .bat) require shell: true.
 */
export function getSpawnExecutionOptions(
	command: string,
	args: string[],
): { shell: boolean; args: string[] } {
	const isWindows = process.platform === "win32";
	const isBatch =
		isWindows &&
		(command.toLowerCase().endsWith(".cmd") ||
			command.toLowerCase().endsWith(".bat"));

	if (!isBatch) {
		return { shell: false, args };
	}

	// For Windows batch files executed through cmd.exe, wrap arguments containing whitespace/delimiters
	const safeArgs = args.map((arg) => {
		if (/[\s,;=]/.test(arg) && !arg.startsWith('"') && !arg.endsWith('"')) {
			return `"${arg.replace(/"/g, '""')}"`;
		}
		return arg;
	});

	return { shell: true, args: safeArgs };
}

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
	model?: string,
): string[] {
	if (agentId === "agy") {
		const args = ["--dangerously-skip-permissions"];
		if (workspaceDir) {
			args.push("--add-dir", workspaceDir);
		}
		if (model) {
			args.push("--model", model);
		}
		args.push("-p", taskPrompt);
		return args;
	}
	if (agentId === "claude") {
		const args = ["--dangerously-skip-permissions"];
		if (model) {
			args.push("--model", model);
		}
		args.push("-p", taskPrompt);
		return args;
	}
	if (agentId === "opencode") {
		const args = ["run", "--auto"];
		if (model) {
			args.push("--model", model);
		}
		args.push(taskPrompt);
		return args;
	}
	const args: string[] = [];
	if (model) {
		args.push("--model", model);
	}
	if (defaultArgs && defaultArgs.length > 0) {
		args.push(...defaultArgs);
	}
	args.push(taskPrompt);
	return args;
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
		const current = getMcpProjectContext();
		if (!sameStoryEditContext(params.editContext, current?.editContext))
			throw new Error("Stale Story edit context");
		// Assemble context
		const context = assembleAgentEditingContext(
			params.project,
			params.transcripts,
			params.userPrompt,
			params.editContext,
		);

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
		const args = buildAgentCommandArgs(
			params.agentId,
			taskPrompt,
			tempDir,
			known?.defaultArgs,
			params.model,
		);

		log(`[Captr Studio] Launching agent: ${command} in ${tempDir}...\n`);

		const { shell: useShell, args: safeArgs } = getSpawnExecutionOptions(command, args);

		const child = spawn(command, safeArgs, {
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
				parsedResult = {
					success: true,
					project: getStoryEditProject(spec, params.editContext.scope),
				};
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
					log(
						`\n[Captr Studio] Detected ${validatedSpecs.length} B-Roll specifications in broll_specs.json.\n`,
					);
					log(`[Captr Studio] Rendering motion graphics via Hyperframe Engine...\n`);

					const userDataPath = app?.getPath?.("userData") ?? os.tmpdir();
					const brollStorageDir = path.join(userDataPath, "hyperframe_assets");
					await fsPromises.mkdir(brollStorageDir, { recursive: true });

					const renderResults = [];
					for (const spec of validatedSpecs) {
						const assetDir = path.join(brollStorageDir, `broll-${spec.id}`);
						log(`  • Rendering B-Roll [${spec.type}]: "${spec.title}"...\n`);
						const res = await renderHyperframeBRoll(
							spec,
							assetDir,
							finalProject.canvas,
						);
						if (res.success) {
							log(
								`    ✓ Rendered successfully (${(res.durationUs / 1_000_000).toFixed(1)}s)\n`,
							);
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
		setSpeculativeProject(finalProject, diff, params.editContext);
		return {
			success: true,
			project: finalProject,
			context: params.editContext,
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

export interface TestAgentConnectionParams {
	agentId: string;
	customCommand?: string;
	model?: string;
	prompt: string;
}

export interface TestAgentConnectionResult {
	success: boolean;
	response?: string;
	latencyMs: number;
	error?: string;
}

export async function testAgentConnection(
	params: TestAgentConnectionParams,
): Promise<TestAgentConnectionResult> {
	const start = Date.now();
	const known = KNOWN_AGENTS.find((a) => a.id === params.agentId);
	let command = params.customCommand?.trim() || known?.command || params.agentId;

	if (!path.isAbsolute(command)) {
		const resolved = await checkAgentAvailability(command);
		if (!resolved && params.agentId !== "custom") {
			return {
				success: false,
				latencyMs: Date.now() - start,
				error: `Executable "${command}" tidak ditemukan di PATH sistem. Pastikan CLI provider sudah terpasang.`,
			};
		}
		if (resolved) {
			command = resolved;
		}
	}

	const args = buildAgentCommandArgs(
		params.agentId,
		params.prompt || "Ping from Captr Studio",
		undefined,
		known?.defaultArgs,
		params.model,
	);

	const { shell: useShell, args: safeArgs } = getSpawnExecutionOptions(command, args);

	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		let killed = false;

		const proc = spawn(command, safeArgs, {
			env: getAugmentedEnv(),
			shell: useShell,
			windowsHide: true,
		});

		const timer = setTimeout(() => {
			killed = true;
			try {
				proc.kill("SIGTERM");
			} catch {}
			resolve({
				success: false,
				latencyMs: Date.now() - start,
				error: "Koneksi timeout setelah 20 detik.",
			});
		}, 20000);

		proc.stdout?.on("data", (d) => {
			stdout += d.toString();
		});

		proc.stderr?.on("data", (d) => {
			stderr += d.toString();
		});

		proc.on("error", (err) => {
			if (killed) return;
			clearTimeout(timer);
			resolve({
				success: false,
				latencyMs: Date.now() - start,
				error: err.message,
			});
		});

		proc.on("close", (code) => {
			if (killed) return;
			clearTimeout(timer);
			const latencyMs = Date.now() - start;
			if (code === 0) {
				const response = (stdout || stderr).trim() || "Koneksi berhasil (status code 0).";
				resolve({
					success: true,
					response,
					latencyMs,
				});
			} else {
				const errorMsg =
					stderr.trim() || stdout.trim() || `CLI provider keluar dengan exit code ${code}.`;
				resolve({
					success: false,
					latencyMs,
					error: errorMsg,
				});
			}
		});
	});
}

export interface FetchAgentModelsParams {
	agentId: string;
	customCommand?: string;
}

export interface FetchAgentModelsResult {
	success: boolean;
	models: string[];
	rawOutput?: string;
	error?: string;
}

/**
 * Extracts distinct AI model names from CLI output (e.g. from `/model` or `models` command).
 */
export function parseModelsFromOutput(output: string): string[] {
	if (!output || !output.trim()) return [];
	const found = new Set<string>();
	const lines = output.split(/\r?\n/);

	const modelTokenRegex =
		/\b(?:[a-zA-Z0-9_-]+\/)?(?:gpt-[a-z0-9.-]+|claude-[a-z0-9.-]+|gemini-[a-z0-9.-]+|deepseek-[a-z0-9.-]+|llama-[a-z0-9.-]+|o[13](?:-[a-z0-9.-]+)?|qwen-[a-z0-9.-]+|mistral-[a-z0-9.-]+|[a-z0-9]+(?:-[a-z0-9]+)+(?:\.[a-z0-9]+)*)\b/gi;

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Table or first-token pattern (e.g. "gemini-3.8-flash-high\tGemini 3.8 Flash (High)" or "openrouter/openai/gpt-4o")
		const firstToken = trimmed.split(/[\t\s]+/)[0];
		if (
			firstToken &&
			/^[a-zA-Z0-9_\-./]+$/.test(firstToken) &&
			!firstToken.toLowerCase().includes("http") &&
			![
				"model",
				"models",
				"default",
				"current",
				"available",
				"provider",
				"select",
				"fetching",
			].includes(firstToken.toLowerCase())
		) {
			const tokenMatches = firstToken.match(modelTokenRegex);
			if (tokenMatches && tokenMatches[0] === firstToken) {
				found.add(firstToken);
			}
		}

		// Bullet point pattern like "- claude-3-5-sonnet: ..." or "* gemini-2.0-flash"
		const bulletMatch = trimmed.match(/^[-*#\d.>|]\s*([a-zA-Z0-9_\-./:]+)/);
		if (
			bulletMatch &&
			bulletMatch[1] &&
			bulletMatch[1].length > 2 &&
			!bulletMatch[1].toLowerCase().includes("http")
		) {
			const candidate = bulletMatch[1].replace(/[:*`,()]/g, "").trim();
			if (
				candidate &&
				/^[a-zA-Z0-9_\-./]+$/.test(candidate) &&
				/[a-zA-Z]/.test(candidate) &&
				![
					"model",
					"models",
					"default",
					"current",
					"available",
					"provider",
					"select",
					"fetching",
				].includes(candidate.toLowerCase())
			) {
				found.add(candidate);
			}
		}

		// Pattern search for model tokens
		const matches = trimmed.match(modelTokenRegex);
		if (matches) {
			for (const m of matches) {
				const cleaned = m.replace(/^[/:.-]+|[/:.-]+$/g, "").trim();
				if (
					cleaned.length >= 3 &&
					![
						"model",
						"models",
						"default",
						"current",
						"available",
						"provider",
						"select",
						"fetching",
					].includes(cleaned.toLowerCase())
				) {
					found.add(cleaned);
				}
			}
		}
	}

	return Array.from(found);
}

/**
 * Fetches available models from a CLI provider by invoking it with `models` or `/model`.
 */
export async function fetchAgentModels(
	params: FetchAgentModelsParams,
): Promise<FetchAgentModelsResult> {
	const known = KNOWN_AGENTS.find((a) => a.id === params.agentId);
	let command = params.customCommand?.trim() || known?.command || params.agentId;

	if (!path.isAbsolute(command)) {
		const resolvedPath = await checkAgentAvailability(command);
		if (resolvedPath) {
			command = resolvedPath;
		} else {
			return {
				success: false,
				models: [],
				error: `CLI provider "${command}" tidak ditemukan di sistem.`,
			};
		}
	}

	let args: string[];
	if (
		params.agentId === "agy" ||
		params.agentId === "opencode" ||
		params.agentId === "hermes"
	) {
		args = ["models"];
	} else {
		args = buildAgentCommandArgs(
			params.agentId,
			"/model",
			undefined,
			known?.defaultArgs,
		);
	}

	const { shell: useShell, args: safeArgs } = getSpawnExecutionOptions(
		command,
		args,
	);

	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		let killed = false;

		const proc = spawn(command, safeArgs, {
			env: getAugmentedEnv(),
			shell: useShell,
			windowsHide: true,
		});

		const timer = setTimeout(() => {
			killed = true;
			try {
				proc.kill("SIGTERM");
			} catch {}
			resolve({
				success: false,
				models: [],
				error: "Permintaan /model timeout setelah 15 detik.",
			});
		}, 15000);

		proc.stdout?.on("data", (d) => {
			stdout += d.toString();
		});

		proc.stderr?.on("data", (d) => {
			stderr += d.toString();
		});

		proc.on("error", (err) => {
			if (killed) return;
			clearTimeout(timer);
			resolve({
				success: false,
				models: [],
				error: err.message,
			});
		});

		proc.on("close", (code) => {
			if (killed) return;
			clearTimeout(timer);
			const fullOutput = (stdout + "\n" + stderr).trim();
			const models = parseModelsFromOutput(fullOutput);
			if (code === 0 || models.length > 0) {
				resolve({
					success: true,
					models,
					rawOutput: fullOutput,
				});
			} else {
				resolve({
					success: false,
					models: [],
					rawOutput: fullOutput,
					error:
						stderr.trim() ||
						stdout.trim() ||
						`CLI keluar dengan kode ${code}.`,
				});
			}
		});
	});
}


