import { type ChildProcess, spawn } from "node:child_process";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { KNOWN_AGENTS, checkAgentAvailability, getAugmentedEnv } from "./agentDetector";

export interface HyperframeTaskContext {
	userPrompt: string;
	hyperframeName: string;
	width: number;
	height: number;
	durationSec: number;
	assetsSummary: string;
	draftFilePath: string;
}

export interface RunHyperframeTaskParams {
	agentId: string;
	customCommand?: string;
	userPrompt: string;
	hyperframeId: string;
	hyperframeName: string;
	currentHtml: string;
	width: number;
	height: number;
	durationSec: number;
	projectContext: {
		projectTitle: string;
		aspectRatio: string;
		assets: Array<{
			id: string;
			name: string;
			kind: string;
			path?: string;
			durationMs?: number;
		}>;
		transcripts?: Record<string, any>;
	};
}

export interface RunHyperframeTaskResult {
	success: boolean;
	html?: string;
	logs: string[];
	error?: string;
}

let activeProcess: ChildProcess | null = null;

export function formatHyperframeTaskPrompt(ctx: HyperframeTaskContext): string {
	return `You are crafting an HTML5/CSS/JavaScript video composition ("Hyperframe") for Captr Studio.
The composition file is located at: "${ctx.draftFilePath}".
Composition specs: ${ctx.width}x${ctx.height} px, duration: ${ctx.durationSec}s.
Target Title: "${ctx.hyperframeName}".

Available Project Assets:
${ctx.assetsSummary}

USER REQUEST:
"${ctx.userPrompt}"

INSTRUCTIONS:
1. Open and inspect "${ctx.draftFilePath}".
2. Implement the requested motion design (e.g. kinetic typography, CSS keyframes, HTML5 Canvas animation, CSS variables, glassmorphic layout, embedding videos or images).
3. Follow Captr Studio soft pastel aesthetics: soft blue (#6FA8FF), lavender (#A879F5), sage mint (#8DDB9B), honey amber (#F6C768), coral rose (#FF6B81). Avoid radioactive neon cyan.
4. Save the revised HTML code directly back to "${ctx.draftFilePath}" OR return the complete HTML inside a \`\`\`html code block in your response.`;
}

export function extractHtmlFromAgentOutput(output: string): string {
	const trimmed = output.trim();
	// Check for ```html ... ``` block
	const codeBlockMatch = trimmed.match(/```(?:html|htm)?\s*([\s\S]*?)```/i);
	if (codeBlockMatch && codeBlockMatch[1]) {
		const extracted = codeBlockMatch[1].trim();
		if (extracted.includes("<html") || extracted.includes("<!DOCTYPE") || extracted.includes("<div")) {
			return extracted;
		}
	}

	// Direct HTML detection
	if (
		trimmed.startsWith("<!DOCTYPE html") ||
		trimmed.startsWith("<html") ||
		(trimmed.includes("<body") && trimmed.includes("</body>"))
	) {
		return trimmed;
	}

	return output;
}

export function buildHyperframeAgentArgs(
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
	if (["kiro", "trae", "cline", "hermes"].includes(agentId)) {
		return ["-p", taskPrompt];
	}
	if (defaultArgs && defaultArgs.length > 0) {
		return [...defaultArgs, taskPrompt];
	}
	return ["-p", taskPrompt];
}

/**
 * Runs a CLI agent to generate or refine a Hyperframe HTML composition.
 */
export async function runHyperframeAgentTask(
	params: RunHyperframeTaskParams,
	onLog?: (chunk: string) => void,
): Promise<RunHyperframeTaskResult> {
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

	let tempDir: string | null = null;

	try {
		const commandName =
			params.agentId === "custom" && params.customCommand
				? params.customCommand.trim()
				: KNOWN_AGENTS.find((a) => a.id === params.agentId)?.command || params.agentId;

		const execPath = await checkAgentAvailability(commandName);
		if (!execPath) {
			return {
				success: false,
				logs,
				error: `CLI Agent binary "${commandName}" is not installed or not found in system PATH. Please verify your environment or select another agent.`,
			};
		}

		// Create dedicated workspace
		const workspaceDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "captr-hyperframe-agent-"));
		tempDir = workspaceDir;
		const draftHtmlPath = path.join(workspaceDir, "index.html");
		await fsPromises.writeFile(draftHtmlPath, params.currentHtml, "utf-8");

		// Summarize assets
		const assetsSummaryList = (params.projectContext.assets || []).map(
			(a) => `- ${a.name} (type: ${a.kind}, id: ${a.id}${a.path ? `, path: ${a.path}` : ""})`,
		);
		const assetsSummary = assetsSummaryList.length > 0 ? assetsSummaryList.join("\n") : "No media assets";

		// Write PROJECT_ASSETS.json
		await fsPromises.writeFile(
			path.join(workspaceDir, "PROJECT_ASSETS.json"),
			JSON.stringify(
				{
					projectTitle: params.projectContext.projectTitle,
					aspectRatio: params.projectContext.aspectRatio,
					width: params.width,
					height: params.height,
					durationSec: params.durationSec,
					assets: params.projectContext.assets,
					transcripts: params.projectContext.transcripts,
				},
				null,
				2,
			),
			"utf-8",
		);

		const taskPrompt = formatHyperframeTaskPrompt({
			userPrompt: params.userPrompt,
			hyperframeName: params.hyperframeName,
			width: params.width,
			height: params.height,
			durationSec: params.durationSec,
			assetsSummary,
			draftFilePath: draftHtmlPath,
		});

		const defaultArgs = KNOWN_AGENTS.find((a) => a.id === params.agentId)?.defaultArgs;
		const args = buildHyperframeAgentArgs(params.agentId, taskPrompt, workspaceDir, defaultArgs);

		// Write TASK.md in workspace so agent can also inspect full task spec directly
		await fsPromises.writeFile(path.join(workspaceDir, "TASK.md"), taskPrompt, "utf-8");

		log(`[Captr Studio] Spawning ${execPath} in ${workspaceDir}…`);

		let combinedStdout = "";
		let combinedStderr = "";

		// Windows: If command is an .exe, run without cmd.exe shell so arguments aren't broken by cmd.exe word-splitting
		const useShell =
			process.platform === "win32" && !execPath.toLowerCase().endsWith(".exe");

		const exitCode = await new Promise<number | null>((resolve) => {
			const child = spawn(execPath, args, {
				cwd: workspaceDir,
				env: {
					...getAugmentedEnv(),
					FORCE_COLOR: "0",
				},
				shell: useShell,
				stdio: ["ignore", "pipe", "pipe"],
			}) as ChildProcess;
			activeProcess = child;

			child.stdout?.on("data", (chunk: Buffer) => {
				const str = chunk.toString("utf-8");
				combinedStdout += str;
				log(str);
			});

			child.stderr?.on("data", (chunk: Buffer) => {
				const str = chunk.toString("utf-8");
				combinedStderr += str;
				log(str);
			});

			child.on("close", (code: number | null) => {
				activeProcess = null;
				resolve(code);
			});

			child.on("error", (err: Error) => {
				activeProcess = null;
				log(`Process error: ${err.message}`);
				resolve(1);
			});
		});

		// Check if index.html was modified on disk
		let finalHtml: string | null = null;
		try {
			const onDisk = await fsPromises.readFile(draftHtmlPath, "utf-8");
			if (onDisk.trim() && onDisk !== params.currentHtml) {
				finalHtml = onDisk;
			}
		} catch {}

		// Fallback: extract HTML from stdout
		if (!finalHtml) {
			const extracted = extractHtmlFromAgentOutput(combinedStdout);
			if (extracted && extracted !== combinedStdout && extracted.includes("<html")) {
				finalHtml = extracted;
			} else if (extracted.includes("<!DOCTYPE") || extracted.includes("<html")) {
				finalHtml = extracted;
			}
		}

		if (!finalHtml) {
			// If exitCode was 0 but no HTML changed, return error or original with notice
			if (exitCode === 0) {
				return {
					success: false,
					logs,
					error: "Agent completed but did not produce modified HTML output.",
				};
			}
			return {
				success: false,
				logs,
				error: combinedStderr || `Agent exited with code ${exitCode}`,
			};
		}

		return {
			success: true,
			html: finalHtml,
			logs,
		};
	} catch (err) {
		return {
			success: false,
			logs,
			error: String(err),
		};
	} finally {
		if (tempDir) {
			await fsPromises.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
		}
	}
}

export function cancelActiveHyperframeAgentTask(): boolean {
	if (activeProcess) {
		activeProcess.kill();
		activeProcess = null;
		return true;
	}
	return false;
}
