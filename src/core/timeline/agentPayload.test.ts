import { describe, expect, it } from "vitest";
import {
	assembleAgentEditingContext,
	parseAgentProjectOutput,
	summarizeProjectDiff,
} from "./agentPayload";
import { createTimelineProject, placeAsset, registerMedia } from "./commands";
import type { AssetTranscript } from "./transcriptTypes";

function createMockProject() {
	let project = registerMedia(createTimelineProject("proj-test-1", "Test Video Project"), {
		id: "asset-1",
		kind: "video",
		name: "Screen Recording 1",
		durationUs: 20_000_000,
		width: 1920,
		height: 1080,
		source: { path: "media/video-1.mp4", durationUs: 20_000_000, offsetUs: 0 },
	});
	project = placeAsset(project, "asset-1", "visual-1", 0, {
		clipId: "clip-1",
	});
	project = placeAsset(project, "asset-1", "visual-1", 20_000_000, {
		clipId: "clip-2",
	});
	return project;
}

const mockTranscript: AssetTranscript = {
	assetId: "asset-1",
	language: "id",
	durationUs: 20_000_000,
	segments: [
		{
			id: 0,
			startUs: 1_000_000,
			endUs: 4_000_000,
			text: "Halo semua selamat datang di tutorial",
			words: [
				{ word: "Halo", startUs: 1_000_000, endUs: 1_500_000 },
				{ word: "semua", startUs: 1_600_000, endUs: 2_000_000 },
			],
		},
		{
			id: 1,
			startUs: 12_000_000,
			endUs: 16_000_000,
			text: "Sekarang kita bahas bagian kedua",
			words: [
				{ word: "Sekarang", startUs: 12_000_000, endUs: 13_000_000 },
			],
		},
	],
};

describe("agentPayload", () => {
	it("assembles rich editing context including timeline clips and transcripts", () => {
		const project = createMockProject();
		const transcripts: Record<string, AssetTranscript> = { "asset-1": mockTranscript };
		const prompt = "Hapus bagian pembukaan yang tidak penting dan buat video lebih ringkas";

		const context = assembleAgentEditingContext(project, transcripts, prompt);

		expect(context.systemPrompt).toContain("Captr Studio");
		expect(context.userPrompt).toBe(prompt);
		expect(context.projectJson).toContain("proj-test-1");
		expect(context.formattedTranscripts).toContain("Halo semua selamat datang di tutorial");
		expect(context.formattedTranscripts).toContain("00:01.00 - 00:04.00");
		expect(context.clipsSummary).toContain("clip-1");
		expect(context.clipsSummary).toContain("clip-2");
	});

	it("parses valid JSON string output from agent", () => {
		const project = createMockProject();
		const raw = JSON.stringify(project);

		const result = parseAgentProjectOutput(raw);
		expect(result.success).toBe(true);
		expect(result.project?.projectId).toBe("proj-test-1");
	});

	it("extracts and parses JSON wrapped in markdown code blocks", () => {
		const project = createMockProject();
		const raw = `Here is the edited project file:\n\`\`\`json\n${JSON.stringify(project, null, 2)}\n\`\`\`\nHope this helps!`;

		const result = parseAgentProjectOutput(raw);
		expect(result.success).toBe(true);
		expect(result.project?.projectId).toBe("proj-test-1");
	});

	it("rejects invalid JSON or schema violations with error message", () => {
		const result = parseAgentProjectOutput("This is invalid text without json");
		expect(result.success).toBe(false);
		expect(result.error).toBeTruthy();
	});

	it("summarizes project diffs between original and edited versions", () => {
		const original = createMockProject();
		// Modify by deleting clip-2
		const modified = structuredClone(original);
		modified.tracks[0]!.clips = [modified.tracks[0]!.clips[0]!];

		const diff = summarizeProjectDiff(original, modified);
		expect(diff.clipsBefore).toBe(2);
		expect(diff.clipsAfter).toBe(1);
		expect(diff.clipsRemoved).toContain("clip-2");
		expect(diff.durationDeltaUs).toBe(-20_000_000);
	});
});
