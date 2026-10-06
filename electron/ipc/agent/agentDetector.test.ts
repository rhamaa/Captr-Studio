import { describe, expect, it } from "vitest";
import {
	KNOWN_AGENTS,
	checkCustomAgent,
	getAugmentedEnv,
	parseWhereCommandOutput,
} from "./agentDetector";

describe("agentDetector", () => {
	it("has registered known agent specifications with agy as priority", () => {
		const ids = KNOWN_AGENTS.map((a) => a.id);
		expect(ids[0]).toBe("agy");
		expect(ids).toContain("claude");
		expect(ids).toContain("opencode");
		expect(ids).toContain("kiro");
		expect(ids).toContain("trae");
		expect(ids).toContain("cline");
		expect(ids).toContain("hermes");
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

	it("evaluates custom agent commands cleanly", async () => {
		const res = await checkCustomAgent("unknown-binary-xyz");
		expect(res.name).toBe("unknown-binary-xyz");
		expect(res.available).toBe(false);
	});
});
