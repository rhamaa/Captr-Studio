import { describe, expect, it } from "vitest";
import { KNOWN_AGENTS, parseWhereCommandOutput } from "./agentDetector";

describe("agentDetector", () => {
	it("has registered known agent specifications", () => {
		const ids = KNOWN_AGENTS.map((a) => a.id);
		expect(ids).toContain("claude");
		expect(ids).toContain("agy");
		expect(ids).toContain("opencode");
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
