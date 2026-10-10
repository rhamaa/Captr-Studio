import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { CopilotSidebar, type EditPlan } from "./CopilotSidebar";

describe("CopilotSidebar", () => {
	function buildTestProject() {
		const project = createTimelineProject("test-copilot-proj", "Copilot Test");
		project.assets = [
			{
				id: "asset-rec",
				kind: "video",
				name: "Screen_Recording_1",
				durationUs: 15_000_000,
				width: 1920,
				height: 1080,
				source: {
					path: "/test/screen.mp4",
					durationUs: 15_000_000,
					offsetUs: 0,
				},
			},
		];
		project.tracks[0].clips = [
			{
				id: "clip-1",
				assetId: "asset-rec",
				startUs: 0,
				sourceInUs: 0,
				durationUs: 5_000_000,
				kind: "video",
			},
			{
				id: "clip-2",
				assetId: "asset-rec",
				startUs: 5_000_000,
				sourceInUs: 5_000_000,
				durationUs: 10_000_000,
				kind: "video",
			},
		];
		return project;
	}

	it("renders copilot sidebar with header, recipes, and context ribbon", () => {
		const project = buildTestProject();
		const html = renderToStaticMarkup(
			createElement(CopilotSidebar, {
				project,
				transcripts: {
					"asset-rec": {
						assetId: "asset-rec",
						language: "en",
						fullText: "Welcome to Captr Studio",
						segments: [],
						words: [],
						createdAt: "",
					},
				},
				playheadUs: 3_500_000,
				selection: ["clip-1"],
				activeArtboardId: "board-reel",
				speculativeDraft: null,
				editPlan: null,
				onClose: vi.fn(),
				onApplyDraft: vi.fn(),
				onDiscardDraft: vi.fn(),
			}),
		);

		// Header & Structure
		expect(html).toContain("Captr Copilot");
		expect(html).toContain("Autonomous Editor &amp; MCP Bridge");
		expect(html).toContain("Chat");
		expect(html).toContain("MCP");

		// Context Ribbon
		expect(html).toContain("0:03.5");
		expect(html).toContain("1 Clip");
		expect(html).toContain("@Artboard");
		expect(html).toContain("@Whiteboard");

		// Preset Recipes
		expect(html).toContain("Cut dead air &amp; long pauses");
		expect(html).toContain("Make a 60-second reel");
		expect(html).toContain("A-Roll speech + Hyperframe B-Roll");

		// Asset mentions & CC badge
		expect(html).toContain("@Screen_Recording_1");
		expect(html).toContain("CC");

		// Agent selection and Run button
		expect(html).toContain("Antigravity (agy)");
		expect(html).toContain("Run Agent");
	});

	it("renders selection count correctly for multiple selected clips", () => {
		const project = buildTestProject();
		const html = renderToStaticMarkup(
			createElement(CopilotSidebar, {
				project,
				transcripts: {},
				playheadUs: 0,
				selection: ["clip-1", "clip-2"],
				activeArtboardId: null,
				speculativeDraft: null,
				editPlan: null,
				onClose: vi.fn(),
				onApplyDraft: vi.fn(),
				onDiscardDraft: vi.fn(),
			}),
		);

		expect(html).toContain("2 Clips");
	});

	it("renders speculative ghost draft card with diff metrics and commit actions", () => {
		const project = buildTestProject();
		const draftProject = { ...project };

		const html = renderToStaticMarkup(
			createElement(CopilotSidebar, {
				project,
				transcripts: {},
				playheadUs: 2_000_000,
				selection: [],
				activeArtboardId: null,
				speculativeDraft: {
					project: draftProject,
					diff: {
						clipsBefore: 2,
						clipsAfter: 4,
						durationDeltaUs: -3_200_000,
						addedClips: ["clip-split-1", "clip-broll"],
						removedClips: ["clip-1"],
						modifiedClips: [],
					},
				},
				editPlan: null,
				onClose: vi.fn(),
				onApplyDraft: vi.fn(),
				onDiscardDraft: vi.fn(),
			}),
		);

		expect(html).toContain("Speculative Ghost Draft Ready");
		expect(html).toContain("Changes are rendered as ghost clips on your timeline");
		expect(html).toContain("2 → 4");
		expect(html).toContain("-3.2s");
		expect(html).toContain("Accept Changes");
		expect(html).toContain("Reject Changes");
	});

	it("renders proposed edit plan card with step by step breakdown", () => {
		const project = buildTestProject();
		const editPlan: EditPlan = {
			context: {
				scope: { kind: "root" },
				projectId: project.projectId,
				generation: 1,
				revision: 0,
			},
			summary: "Trim intro pause and generate fast-paced hook",
			steps: [
				"Identify dead air from 0.0s to 1.8s",
				"Split clip-1 at 1.8s and ripple delete pause",
				"Insert motion graphic title at 1.8s",
			],
			estimatedDurationSec: 4,
			createdAt: new Date().toISOString(),
		};

		const html = renderToStaticMarkup(
			createElement(CopilotSidebar, {
				project,
				transcripts: {},
				playheadUs: 0,
				selection: [],
				activeArtboardId: null,
				speculativeDraft: null,
				editPlan,
				editContext: editPlan.context,
				onClose: vi.fn(),
				onApplyDraft: vi.fn(),
				onDiscardDraft: vi.fn(),
			}),
		);

		expect(html).toContain("Proposed Edit Plan");
		expect(html).toContain("Trim intro pause and generate fast-paced hook");
		expect(html).toContain("Identify dead air from 0.0s to 1.8s");
		expect(html).toContain("Split clip-1 at 1.8s and ripple delete pause");
		expect(html).toContain("Insert motion graphic title at 1.8s");
		for (const changed of [
			{ ...editPlan.context, revision: 1 },
			{ ...editPlan.context, generation: 2 },
			{ ...editPlan.context, scope: { kind: "artboard", artboardId: "B" } as const },
		]) {
			const staleHtml = renderToStaticMarkup(
				createElement(CopilotSidebar, {
					project,
					transcripts: {},
					playheadUs: 0,
					selection: [],
					activeArtboardId: null,
					speculativeDraft: null,
					editPlan,
					editContext: changed,
					onClose: vi.fn(),
					onApplyDraft: vi.fn(),
					onDiscardDraft: vi.fn(),
				}),
			);
			expect(staleHtml).not.toContain("Proposed Edit Plan");
			expect(staleHtml).not.toContain(editPlan.summary);
		}
	});
});
