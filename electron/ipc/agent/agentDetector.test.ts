import { describe, expect, it } from "vitest";
import { KNOWN_AGENTS, getAugmentedEnv, parseWhereCommandOutput } from "./agentDetector";

describe("agentDetector", () => {
	it("has registered known agent specifications with agy as priority", () => {
		const ids = KNOWN_AGENTS.map((a) => a.id);
		expect(ids[0]).toBe("agy");
		expect(ids).toContain("claude");
		expect(ids).toContain("opencode");
		expect(ids).not.toContain("gemini");
	});

	it("augments PATH with user CLI binary locations", () => {
		const env = getAugmentedEnv();
		const pathVal = env.PATH || env.Path || "";
		expect(pathVal).toBeTruthy();
	});

	it("parses where/which command output correctly", () => {
		const stdout = "C:\\Users\\test\\.local\\bin\\claude.exe\r\n";
		const parsed = parseWhereCommandOutput(stdout);
		expect(parsed).toBe("C:\\Users\\test\\.local\\bin\\claude.exe");
	});

	it("handles empty or failed command output", () => {
		expect(parseWhereCommandOutput("")).toBeNull();
		expect(parseWhereCommandOutput("INFO: Could not find files")).toBeNull();
	});
});
