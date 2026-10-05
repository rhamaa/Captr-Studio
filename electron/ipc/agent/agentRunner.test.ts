import { describe, expect, it } from "vitest";
import { buildAgentCommandArgs, formatAgentTaskPrompt } from "./agentRunner";

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
});
