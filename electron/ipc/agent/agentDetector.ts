import { exec } from "node:child_process";
import os from "node:os";
import path from "node:path";
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

/**
 * Returns environment variables with augmented PATH including common CLI install locations
 * (e.g. Antigravity agy, bun, local bin, npm global).
 */
export function getAugmentedEnv(): NodeJS.ProcessEnv {
	const env = { ...process.env };
	const isWindows = process.platform === "win32";
	const homedir = os.homedir();

	const extraDirs: string[] = isWindows
		? [
				path.join(homedir, "AppData", "Local", "agy", "bin"),
				path.join(homedir, ".local", "bin"),
				path.join(homedir, ".bun", "bin"),
				path.join(homedir, "AppData", "Roaming", "npm"),
				path.join(process.env.LOCALAPPDATA || "", "agy", "bin"),
		  ]
		: [
				path.join(homedir, ".local", "bin"),
				path.join(homedir, ".bun", "bin"),
				"/usr/local/bin",
				"/opt/homebrew/bin",
		  ];

	const pathKey = isWindows
		? Object.keys(env).find((k) => k.toUpperCase() === "PATH") || "Path"
		: "PATH";

	const currentPath = env[pathKey] || "";
	const parts = currentPath.split(path.delimiter);
	for (const dir of extraDirs) {
		if (dir && !parts.includes(dir)) {
			parts.unshift(dir);
		}
	}
	env[pathKey] = parts.join(path.delimiter);
	return env;
}

export const KNOWN_AGENTS: AgentSpec[] = [
	{
		id: "agy",
		name: "Antigravity (agy)",
		command: "agy",
		description: "Google DeepMind Antigravity CLI — zero extra setup, uses your active session directly",
		defaultArgs: ["-p", "--dangerously-skip-permissions"],
	},
	{
		id: "claude",
		name: "Claude Code",
		command: "claude",
		description: "Anthropic Claude autonomous coding CLI for file & codebase editing",
		defaultArgs: ["-p", "--dangerously-skip-permissions"],
	},
	{
		id: "opencode",
		name: "OpenCode",
		command: "opencode",
		description: "Open-source autonomous developer agent CLI",
		defaultArgs: ["run", "--auto"],
	},
	{
		id: "codex",
		name: "Codex CLI",
		command: "codex",
		description: "OpenAI Codex CLI tool for autonomous coding",
		defaultArgs: [],
	},
	{
		id: "kiro",
		name: "Kiro CLI",
		command: "kiro",
		description: "Kiro autonomous developer CLI agent",
		defaultArgs: ["-p"],
	},
	{
		id: "trae",
		name: "Trae CLI",
		command: "trae",
		description: "ByteDance Trae autonomous agent CLI",
		defaultArgs: ["-p"],
	},
	{
		id: "cline",
		name: "Cline CLI",
		command: "cline",
		description: "Cline autonomous coding CLI assistant",
		defaultArgs: ["-p"],
	},
	{
		id: "hermes",
		name: "Hermes Agent",
		command: "hermes",
		description: "Nous Research Hermes local autonomous reasoning agent",
		defaultArgs: ["-p"],
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
		const { stdout } = await execAsync(checkCmd, { env: getAugmentedEnv() });
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

	// Sort: available first, then preserve priority order (agy -> claude -> ...)
	return results.sort((a, b) => {
		if (a.available === b.available) {
			const idxA = KNOWN_AGENTS.findIndex((k) => k.id === a.id);
			const idxB = KNOWN_AGENTS.findIndex((k) => k.id === b.id);
			return idxA - idxB;
		}
		return a.available ? -1 : 1;
	});
}

/**
 * Checks a custom user-supplied command binary name.
 */
export async function checkCustomAgent(command: string): Promise<DetectedAgent> {
	const sanitized = command.trim();
	const executablePath = await checkAgentAvailability(sanitized);
	return {
		id: `custom-${sanitized.toLowerCase()}`,
		name: sanitized,
		command: sanitized,
		description: "Custom user-configured CLI agent",
		defaultArgs: ["-p"],
		available: Boolean(executablePath),
		executablePath: executablePath ?? undefined,
	};
}
