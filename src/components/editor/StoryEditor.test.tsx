import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { createTimelineProject } from "@/core/timeline/commands";
import { formatTimecode, StoryEditor } from "./StoryEditor";
import { ProjectController } from "./useProjectController";

describe("StoryEditor", () => {
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
	});
});
