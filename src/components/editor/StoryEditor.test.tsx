import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { createTimelineProject, updateTextOverlay } from "@/core/timeline/commands";
import {
	applyStoryCommand,
	getStoryEditProject,
	getStoryProject,
} from "@/core/timeline/storyOwnership";
import { ownershipFixture } from "@/core/timeline/storyOwnership.fixtures";
import { AssetLibrary } from "./AssetLibrary";
import { formatTimecode, StoryEditor } from "./StoryEditor";
import { ProjectController } from "./useProjectController";

vi.mock("./AssetLibrary", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./AssetLibrary")>();
	return { ...actual, AssetLibrary: vi.fn(actual.AssetLibrary) };
});

describe("StoryEditor", () => {
	it("creates inline Text/Shapes, applies independent templates, and publishes private media through root history", () => {
		const root = ownershipFixture();
		root.designTemplates = [
			{
				id: "title-template",
				name: "Reusable title",
				kind: "text",
				content: {
					kind: "text",
					text: {
						content: "Preset",
						fontFamily: "Arial",
						fontSizePx: 48,
						fontWeight: 400,
						color: "#ffffff",
						align: "center",
					},
					durationUs: 5_000_000,
				},
				width: 1920,
				height: 1080,
				defaultDurationUs: 5_000_000,
			},
		];
		const controller = new ProjectController(root, async () => ({
			success: true,
			path: "test.captr",
		}));
		const siblingBefore = structuredClone(
			controller.snapshot.project.repurposeBoard!.artboards[1],
		);
		const scope = { kind: "artboard", artboardId: "A" } as const;
		const render = () =>
			renderToStaticMarkup(
				createElement(
					I18nProvider,
					null,
					createElement(StoryEditor, {
						storyProject: getStoryEditProject(controller.snapshot.project, scope),
						rootProject: controller.snapshot.project,
						storyId: "A",
						controller,
						transcripts: {},
						copilotOpen: false,
						onCloseCopilot: vi.fn(),
						speculativeDraft: null,
						editPlan: null,
						onApplyDraft: vi.fn(),
						onDiscardDraft: vi.fn(),
						onDraftReady: vi.fn(),
						playing: false,
						setPlaying: vi.fn(),
						editingClipId: null,
						setEditingClipId: vi.fn(),
						onCommand: (command, selection) =>
							controller.execute(
								(root) => applyStoryCommand(root, scope, command),
								selection,
							),
						onProjectCommand: (command) => controller.execute(command),
						onError: vi.fn(),
					}),
				),
			);
		render();
		const controls = vi.mocked(AssetLibrary).mock.calls.at(-1)![0];
		expect(controls.assets.map((a) => a.id)).toEqual(["shared", "record"]);
		expect(controls.storyAssets!.map((a) => a.id)).toEqual(["voice-A"]);
		controls.onCreateText!();
		const textId = controller.snapshot.selection[0];
		controls.onCreateShape!("ellipse");
		const shapeId = controller.snapshot.selection[0];
		controls.onApplyTemplate!("title-template");
		const first = controller.snapshot.selection[0];
		controls.onApplyTemplate!("title-template");
		const second = controller.snapshot.selection[0];
		controller.execute((root) =>
			applyStoryCommand(root, scope, (p) =>
				updateTextOverlay(p, first, { content: "Independent" }),
			),
		);
		const owner = getStoryProject(controller.snapshot.project, scope);
		const clips = owner.tracks.flatMap((t) => t.clips);
		expect(clips.find((c) => c.id === textId)?.content?.kind).toBe("text");
		expect(clips.find((c) => c.id === shapeId)?.content?.kind).toBe("shape");
		expect(clips.find((c) => c.id === second)?.content).toEqual(
			root.designTemplates[0].content,
		);
		expect(controller.snapshot.project.assets).toEqual(root.assets);
		expect(controller.snapshot.project.repurposeBoard!.artboards[1]).toEqual(siblingBefore);
		controls.onPublish!("voice-A");
		expect(controller.snapshot.project.assets.at(-1)).toEqual(
			root.repurposeBoard!.artboards[0].localAssets![0],
		);
		controller.undo();
		expect(getStoryProject(controller.snapshot.project, scope).localAssets).toEqual(
			root.repurposeBoard!.artboards[0].localAssets,
		);
	});
	it("formats timecode accurately as MM:SS:FF", () => {
		expect(formatTimecode(0, 30)).toBe("00:00:00");
		expect(formatTimecode(1_000_000, 30)).toBe("00:01:00");
		expect(formatTimecode(65_500_000, 30)).toBe("01:05:15");
		expect(formatTimecode(65_500_000, 60)).toBe("01:05:30");
	});

	it("renders story name, canvas size, and workspace tools", () => {
		const project = createTimelineProject("test-project", "Test Project");
		const controller = new ProjectController(project, async () => ({
			success: true,
			path: "test.captr",
		}));

		const markup = renderToStaticMarkup(
			createElement(
				I18nProvider,
				null,
				createElement(StoryEditor, {
					storyProject: project,
					rootProject: project,
					storyId: "artboard-1",
					storyName: "TikTok Clip",
					controller,
					transcripts: {},
					copilotOpen: false,
					onCloseCopilot: vi.fn(),
					speculativeDraft: null,
					editPlan: null,
					onApplyDraft: vi.fn(),
					onDiscardDraft: vi.fn(),
					onDraftReady: vi.fn(),
					onBackToBoard: vi.fn(),
					playing: false,
					setPlaying: vi.fn(),
					editingClipId: null,
					setEditingClipId: vi.fn(),
					onCommand: vi.fn(),
					onError: vi.fn(),
				}),
			),
		);

		expect(markup).toContain("TikTok Clip");
		expect(markup).toContain(`${project.canvas.width} × ${project.canvas.height}`);
		expect(markup).toContain("All Stories");
		expect(markup).toContain("project-workspace");
		expect(markup).toContain("Story Media");
		expect(markup).toContain("No media in this Story");
		expect(markup).toContain("Text / Shapes");
		expect(markup).toContain("Templates");
	});

	it("omits All Stories button when viewing root project without storyId", () => {
		const project = createTimelineProject("root-proj", "Root Project");
		const controller = new ProjectController(project, async () => ({
			success: true,
			path: "root.captr",
		}));

		const markup = renderToStaticMarkup(
			createElement(
				I18nProvider,
				null,
				createElement(StoryEditor, {
					storyProject: project,
					rootProject: project,
					storyId: null,
					controller,
					transcripts: {},
					copilotOpen: false,
					onCloseCopilot: vi.fn(),
					speculativeDraft: null,
					editPlan: null,
					onApplyDraft: vi.fn(),
					onDiscardDraft: vi.fn(),
					onDraftReady: vi.fn(),
					playing: false,
					setPlaying: vi.fn(),
					editingClipId: null,
					setEditingClipId: vi.fn(),
					onCommand: vi.fn(),
					onError: vi.fn(),
				}),
			),
		);

		expect(markup).not.toContain("All Stories");
		expect(markup).toContain("project-timeline");
		expect(markup).toContain("Terminal");
	});

	it("renders project terminal button in footer", () => {
		const project = createTimelineProject("term-proj", "Terminal Project");
		const controller = new ProjectController(project, async () => ({
			success: true,
			path: "term.captr",
		}));

		const markup = renderToStaticMarkup(
			createElement(
				I18nProvider,
				null,
				createElement(StoryEditor, {
					storyProject: project,
					rootProject: project,
					storyId: null,
					controller,
					transcripts: {},
					copilotOpen: false,
					onCloseCopilot: vi.fn(),
					speculativeDraft: null,
					editPlan: null,
					onApplyDraft: vi.fn(),
					onDiscardDraft: vi.fn(),
					onDraftReady: vi.fn(),
					playing: false,
					setPlaying: vi.fn(),
					editingClipId: null,
					setEditingClipId: vi.fn(),
					onCommand: vi.fn(),
					onError: vi.fn(),
				}),
			),
		);

		expect(markup).toContain("Terminal");
		expect(markup).toContain("Toggle Project Terminal (Ctrl + `)");
	});

	it("renders pro transport controls and aspect ratio selector", () => {
		const project = createTimelineProject("pro-proj", "Pro Project");
		const controller = new ProjectController(project, async () => ({
			success: true,
			path: "pro.captr",
		}));

		const markup = renderToStaticMarkup(
			createElement(
				I18nProvider,
				null,
				createElement(StoryEditor, {
					storyProject: project,
					rootProject: project,
					storyId: null,
					controller,
					transcripts: {},
					copilotOpen: false,
					onCloseCopilot: vi.fn(),
					speculativeDraft: null,
					editPlan: null,
					onApplyDraft: vi.fn(),
					onDiscardDraft: vi.fn(),
					onDraftReady: vi.fn(),
					playing: false,
					setPlaying: vi.fn(),
					editingClipId: null,
					setEditingClipId: vi.fn(),
					onCommand: vi.fn(),
					onError: vi.fn(),
				}),
			),
		);

		expect(markup).toContain("Canvas Aspect Ratio");
		expect(markup).toContain("16:9 Landscape");
		expect(markup).toContain("9:16 Shorts/Reels");
		expect(markup).toContain("project-transport-timecode");
		expect(markup).toContain("Jump to Start (Home)");
		expect(markup).toContain("Step Back 1 Frame (Left Arrow)");
		expect(markup).toContain("Step Forward 1 Frame (Right Arrow)");
		expect(markup).toContain("Jump to End (End)");
		expect(markup).toContain("Loop Playback: OFF (L)");
		expect(markup).toContain("Grid &amp; Safe Zones: OFF");
		expect(markup).toContain("Fullscreen Preview (F)");
		expect(markup).toContain("Preview Zoom");
		expect(markup).toContain("Zoom In");
		expect(markup).toContain("Zoom Out");
		expect(markup).toContain("project-preview-zoom-wrapper");
	});
});
