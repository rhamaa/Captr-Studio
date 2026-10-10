import { beforeEach, describe, expect, it, vi } from "vitest";
import { getStoryProject } from "../../../src/core/timeline/storyOwnership";
import { ownershipFixture } from "../../../src/core/timeline/storyOwnership.fixtures";
import {
	clearSpeculativeProject,
	executeMcpToolCall,
	getSpeculativeProject,
	setMcpProjectContext,
} from "./mcpServer";

vi.mock("electron", () => ({ BrowserWindow: { getAllWindows: () => [] } }));
const scope = { kind: "artboard", artboardId: "A" } as const;
const context = { scope, projectId: "ownership", generation: 1, revision: 0 };
const sync = (editContext = context) =>
	setMcpProjectContext({
		project: ownershipFixture(),
		transcripts: {},
		playheadUs: 0,
		selection: [],
		activeArtboardId: editContext.scope.artboardId,
		editContext,
	});

describe("MCP Story proposal ownership", () => {
	beforeEach(() => {
		clearSpeculativeProject();
		sync();
	});
	it("edits scoped inline content while retaining root and sibling owners", async () => {
		const result = await executeMcpToolCall("add_broll_or_overlay", {
			type: "text",
			text: "Scoped title",
			durationUs: 3_000_000,
			editContext: context,
		});
		expect(result.isError).toBeUndefined();
		const draft = getSpeculativeProject()!;
		expect(
			getStoryProject(draft, scope)
				.tracks.flatMap((t) => t.clips)
				.some(
					(c) => c.content?.kind === "text" && c.content.text.content === "Scoped title",
				),
		).toBe(true);
		expect(draft.tracks).toEqual(ownershipFixture().tracks);
		expect(draft.repurposeBoard!.artboards[1]).toEqual(
			ownershipFixture().repurposeBoard!.artboards[1],
		);
		const preview = await executeMcpToolCall("preview_speculative_edits", {
			editContext: context,
		});
		expect(JSON.parse(preview.text).diff.clipsAdded).toHaveLength(1);
	});
	it("rejects stale revision, generation and sibling proposals atomically", async () => {
		await executeMcpToolCall("add_broll_or_overlay", { type: "text", editContext: context });
		for (const stale of [
			{ ...context, revision: 2 },
			{ ...context, generation: 2 },
			{ ...context, scope: { kind: "artboard", artboardId: "B" } },
		]) {
			const before = getSpeculativeProject();
			const result = await executeMcpToolCall("commit_edits", { editContext: stale });
			expect(result.isError).toBe(true);
			expect(getSpeculativeProject()).toBe(before);
		}
	});
	it("invalidates a proposal after an intervening ordinary edit and rejects deleted owner", async () => {
		await executeMcpToolCall("add_broll_or_overlay", { type: "text", editContext: context });
		sync({ ...context, revision: 1 });
		expect((await executeMcpToolCall("add_broll_or_overlay", { type: "text" })).isError).toBe(
			true,
		);
		expect(getSpeculativeProject()).toBeNull();
		expect((await executeMcpToolCall("commit_edits", { editContext: context })).isError).toBe(
			true,
		);
		const deleted = ownershipFixture();
		deleted.repurposeBoard!.artboards = deleted.repurposeBoard!.artboards.filter(
			(a) => a.id !== "A",
		);
		setMcpProjectContext({
			project: deleted,
			transcripts: {},
			playheadUs: 0,
			selection: [],
			activeArtboardId: "A",
			editContext: context,
		});
		expect(
			(
				await executeMcpToolCall("add_broll_or_overlay", {
					type: "text",
					editContext: context,
				})
			).isError,
		).toBe(true);
	});
});
