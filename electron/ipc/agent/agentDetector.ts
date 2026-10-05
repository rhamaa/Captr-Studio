import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface AgentSpec {
	id: string;
	name: string;
	command: string;
	description: string;
	defaultArgs: string[];
}

export interface DetectedAgent extends AgentSpec {
	available: boolean;
	executablePath?: string;
}

export const KNOWN_AGENTS: AgentSpec[] = [
	{
		id: "claude",
		name: "Claude Code",
		command: "claude",
		description: "Anthropic Claude CLI for autonomous codebase and file editing",
		defaultArgs: ["-p"],
	},
	{
		id: "agy",
		name: "Antigravity",
		command: "agy",
		description: "Google DeepMind Antigravity AI Agent CLI",
		defaultArgs: ["-p"],
	},
	{
		id: "opencode",
		name: "OpenCode",
		command: "opencode",
		description: "Open-source autonomous developer agent CLI",
		defaultArgs: ["run"],
	},
	{
		id: "codex",
		name: "Codex CLI",
		command: "codex",
		description: "OpenAI Codex CLI tool for autonomous coding",
		defaultArgs: [],
	},
	{
		id: "gemini",
		name: "Gemini CLI",
		command: "gemini",
		description: "Google Gemini CLI tool",
		defaultArgs: [],
	},
];

export function parseWhereCommandOutput(output: string): string | null {
	if (!output) return null;
	const lines = output
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith("INFO:"));
	return lines[0] ?? null;
}

export async function checkAgentAvailability(command: string): Promise<string | null> {
	const isWindows = process.platform === "win32";
	const checkCmd = isWindows ? `where.exe ${command}` : `which ${command}`;

	try {
		const { stdout } = await execAsync(checkCmd);
		return parseWhereCommandOutput(stdout);
	} catch {
		return null;
	}
}

/**
 * Detects which CLI agents are installed and available in the current user environment.
 */
export async function detectAvailableAgents(): Promise<DetectedAgent[]> {
	const results: DetectedAgent[] = [];

	await Promise.all(
		KNOWN_AGENTS.map(async (agent) => {
			const path = await checkAgentAvailability(agent.command);
			results.push({
				...agent,
				available: Boolean(path),
				executablePath: path ?? undefined,
			});
		}),
	);

	// Sort: available first, then known order
	return results.sort((a, b) => {
		if (a.available === b.available) return 0;
		return a.available ? -1 : 1;
	});
}
