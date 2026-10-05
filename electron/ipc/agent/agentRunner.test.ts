import { describe, expect, it } from "vitest";
import { formatAgentTaskPrompt } from "./agentRunner";

describe("agentRunner", () => {
	it("formats agent task prompt with clear JSON file references", () => {
		const prompt = "Hapus bagian pembukaan yang terlalu panjang";
		const formatted = formatAgentTaskPrompt(prompt, "project_draft.json");

		expect(formatted).toContain("project_draft.json");
		expect(formatted).toContain(prompt);
		expect(formatted).toContain("TimelineProject");
	});
});
