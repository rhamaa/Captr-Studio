import { describe, expect, it } from "vitest";
import {
	buildAgentCommandArgs,
	formatAgentTaskPrompt,
	getSpawnExecutionOptions,
	parseModelsFromOutput,
} from "./agentRunner";

describe("agentRunner", () => {
	it("formats agent task prompt with clear JSON file references", () => {
		const prompt = "Hapus bagian pembukaan yang terlalu panjang";
		const formatted = formatAgentTaskPrompt(prompt, "C:\\temp\\project_draft.json");

		expect(formatted).toContain("C:\\temp\\project_draft.json");
		expect(formatted).toContain(prompt);
		expect(formatted).toContain("TimelineProject");
	});

	it("builds correct non-interactive args with permission bypass and add-dir for agy", () => {
		const args = buildAgentCommandArgs("agy", "test prompt", "C:\\temp\\workspace");
		expect(args).toEqual([
			"--dangerously-skip-permissions",
			"--add-dir",
			"C:\\temp\\workspace",
			"-p",
			"test prompt",
		]);
	});

	it("builds correct non-interactive args with permission bypass for claude", () => {
		const args = buildAgentCommandArgs("claude", "test prompt");
		expect(args).toEqual(["--dangerously-skip-permissions", "-p", "test prompt"]);
	});

	it("builds correct args with auto-approve for opencode", () => {
		const args = buildAgentCommandArgs("opencode", "test prompt");
		expect(args).toEqual(["run", "--auto", "test prompt"]);
	});

	it("passes model flag to runner when specified", () => {
		const agyArgs = buildAgentCommandArgs("agy", "test prompt", undefined, undefined, "gemini-2.0-flash");
		expect(agyArgs).toEqual(["--dangerously-skip-permissions", "--model", "gemini-2.0-flash", "-p", "test prompt"]);

		const claudeArgs = buildAgentCommandArgs("claude", "test prompt", undefined, undefined, "claude-3-5-sonnet");
		expect(claudeArgs).toEqual(["--dangerously-skip-permissions", "--model", "claude-3-5-sonnet", "-p", "test prompt"]);

		const cursorArgs = buildAgentCommandArgs("cursor", "test prompt", undefined, ["-p"], "gpt-4o");
		expect(cursorArgs).toEqual(["--model", "gpt-4o", "-p", "test prompt"]);

		const devinArgs = buildAgentCommandArgs("devin", "test prompt", undefined, ["-p"], "devin-standard");
		expect(devinArgs).toEqual(["--model", "devin-standard", "-p", "test prompt"]);
	});

	describe("getSpawnExecutionOptions", () => {
		it("uses shell: false for native executable binaries", () => {
			const res = getSpawnExecutionOptions("C:\\tools\\agy.exe", ["-p", "Halo, tes koneksi"]);
			expect(res.shell).toBe(false);
			expect(res.args).toEqual(["-p", "Halo, tes koneksi"]);
		});

		it("wraps arguments with spaces in quotes for Windows batch files when shell is required", () => {
			const res = getSpawnExecutionOptions("C:\\tools\\run.cmd", ["-p", "Halo, tes koneksi"]);
			if (process.platform === "win32") {
				expect(res.shell).toBe(true);
				expect(res.args[1]).toBe('"Halo, tes koneksi"');
			}
		});
	});

	describe("parseModelsFromOutput", () => {
		it("extracts model names from CLI /model list or bullet points", () => {
			const output = `
Available AI models:
* gemini-2.0-flash (fast, multimodal)
* gemini-1.5-pro (advanced reasoning)
- claude-3-5-sonnet
- gpt-4o
- deepseek-chat
- o1-preview
			`;
			const models = parseModelsFromOutput(output);
			expect(models).toContain("gemini-2.0-flash");
			expect(models).toContain("gemini-1.5-pro");
			expect(models).toContain("claude-3-5-sonnet");
			expect(models).toContain("gpt-4o");
			expect(models).toContain("deepseek-chat");
			expect(models).toContain("o1-preview");
		});

		it("extracts model names from tabular output like agy models", () => {
			const output = `
Fetching available models...
gemini-3.8-flash-high\tGemini 3.8 Flash (High)
gemini-3.8-flash-medium\tGemini 3.8 Flash (Medium)
gemini-3.8-flash-low\tGemini 3.8 Flash (Low)
claude-sonnet-4-6\tClaude Sonnet 4.6 (Thinking)
claude-opus-4-6-thinking\tClaude Opus 4.6 (Thinking)
gpt-oss-120b-medium\tGPT-OSS 120B (Medium)
			`;
			const models = parseModelsFromOutput(output);
			expect(models).toContain("gemini-3.8-flash-high");
			expect(models).toContain("gemini-3.8-flash-medium");
			expect(models).toContain("gemini-3.8-flash-low");
			expect(models).toContain("claude-sonnet-4-6");
			expect(models).toContain("claude-opus-4-6-thinking");
			expect(models).toContain("gpt-oss-120b-medium");
			expect(models).not.toContain("Fetching");
		});

		it("filters out common command words and returns empty array on empty input", () => {
			expect(parseModelsFromOutput("")).toEqual([]);
			expect(parseModelsFromOutput("No models available.")).toEqual([]);
		});
	});
});

