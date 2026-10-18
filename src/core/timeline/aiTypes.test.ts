import { describe, it, expect } from "vitest";
import type {
	ActiveSurface,
	CaptrAppContext,
	GlobalAiSettings,
	ProjectAiConfig,
	AppActiveView,
	ContextualAccelerator,
} from "./aiTypes";
import type { TimelineProject } from "./types";
import { createTimelineProject } from "./commands";
import { validateTimelineProject } from "./validation";

describe("AI Harness Types & Timeline Project Schema", () => {
	describe("ActiveSurface discriminated union", () => {
		it("supports kind: none", () => {
			const surface: ActiveSurface = { kind: "none" };
			expect(surface.kind).toBe("none");
		});

		it("supports kind: story-editor with selection and playhead", () => {
			const surface: ActiveSurface = {
				kind: "story-editor",
				selectedClipIds: ["clip-1", "clip-2"],
				playheadUs: 1_000_000,
				activeTrackId: "track-visual-1",
				zoomScale: 1.5,
			};
			expect(surface.kind).toBe("story-editor");
			if (surface.kind === "story-editor") {
				expect(surface.selectedClipIds).toHaveLength(2);
				expect(surface.playheadUs).toBe(1_000_000);
				expect(surface.activeTrackId).toBe("track-visual-1");
				expect(surface.zoomScale).toBe(1.5);
			}
		});

		it("supports kind: record-editor with tab and appearance", () => {
			const surface: ActiveSurface = {
				kind: "record-editor",
				recordingAssetId: "asset-rec-1",
				packageId: "pkg-1",
				activeTab: "appearance",
				currentAppearancePreset: "dark-glow",
				outwardBorderWidth: 4,
			};
			expect(surface.kind).toBe("record-editor");
			if (surface.kind === "record-editor") {
				expect(surface.activeTab).toBe("appearance");
				expect(surface.packageId).toBe("pkg-1");
				expect(surface.outwardBorderWidth).toBe(4);
			}
		});

		it("supports kind: caption-editor with segment index and language", () => {
			const surface: ActiveSurface = {
				kind: "caption-editor",
				selectedSegmentIndex: 3,
				activeLanguage: "en",
				isBurnInEnabled: true,
				totalSegments: 12,
			};
			expect(surface.kind).toBe("caption-editor");
			if (surface.kind === "caption-editor") {
				expect(surface.selectedSegmentIndex).toBe(3);
				expect(surface.isBurnInEnabled).toBe(true);
				expect(surface.totalSegments).toBe(12);
			}
		});

		it("supports kind: artboard-canvas with aspect ratio", () => {
			const surface: ActiveSurface = {
				kind: "artboard-canvas",
				artboardId: "board-1",
				aspectRatio: "9:16",
				isRepurposing: true,
			};
			expect(surface.kind).toBe("artboard-canvas");
			if (surface.kind === "artboard-canvas") {
				expect(surface.aspectRatio).toBe("9:16");
				expect(surface.isRepurposing).toBe(true);
			}
		});

		it("supports kind: voiceover-studio with recording state", () => {
			const surface: ActiveSurface = {
				kind: "voiceover-studio",
				isRecording: false,
				takeCount: 2,
			};
			expect(surface.kind).toBe("voiceover-studio");
			if (surface.kind === "voiceover-studio") {
				expect(surface.isRecording).toBe(false);
				expect(surface.takeCount).toBe(2);
			}
		});
	});

	describe("CaptrAppContext", () => {
		it("constructs valid context with all fields", () => {
			const accelerator: ContextualAccelerator = {
				id: "accel-cut-silence",
				label: "Cut Silences",
				description: "Removes silence across all active tracks",
				toolName: "cut_silences",
				shortcut: "Ctrl+Shift+X",
			};

			const context: CaptrAppContext = {
				isProjectOpen: true,
				projectId: "proj-123",
				projectTitle: "My Project",
				projectPath: "C:/Projects/demo.captr",
				activeView: "editor" as AppActiveView,
				activeSurface: { kind: "none" },
				availableAccelerators: [accelerator],
				telemetrySummary: {
					transcriptWordCount: 450,
					hasCursorClicks: true,
					totalDurationUs: 15_000_000,
				},
			};

			expect(context.isProjectOpen).toBe(true);
			expect(context.availableAccelerators).toHaveLength(1);
			expect(context.telemetrySummary?.transcriptWordCount).toBe(450);
		});
	});

	describe("GlobalAiSettings", () => {
		it("constructs settings with runners and endpoints", () => {
			const settings: GlobalAiSettings = {
				preferredRunner: "agy",
				customRunnerPath: undefined,
				defaultModel: "gemini-2.5-flash",
				apiBaseUrl: "http://localhost:11434",
				apiKey: "sk-test",
				mcpServerPort: 42000,
				enableAutoMcpServer: true,
				enableGhostPreview: true,
			};

			expect(settings.preferredRunner).toBe("agy");
			expect(settings.mcpServerPort).toBe(42000);
			expect(settings.enableAutoMcpServer).toBe(true);
		});
	});

	describe("ProjectAiConfig & TimelineProject Integration", () => {
		it("validates project without aiConfig (backward-compatible)", () => {
			const project = createTimelineProject("proj-ai-1", "Test Project");
			expect(project.aiConfig).toBeUndefined();
			const validated = validateTimelineProject(project);
			expect(validated.aiConfig).toBeUndefined();
		});

		it("preserves aiConfig when validating TimelineProject", () => {
			const project = createTimelineProject("proj-ai-2", "Test Project");
			const aiConfig: ProjectAiConfig = {
				modelOverride: "claude-3-7-sonnet",
				personaPrompt: "You are an aggressive video editor focusing on high retention.",
				silenceThresholdMs: 300,
				defaultCaptionStyle: "karaoke-bounce",
			};
			const projectWithAi: TimelineProject = {
				...project,
				aiConfig,
			};

			const validated = validateTimelineProject(projectWithAi);
			expect(validated.aiConfig).toEqual(aiConfig);
			expect(validated.aiConfig?.modelOverride).toBe("claude-3-7-sonnet");
			expect(validated.aiConfig?.silenceThresholdMs).toBe(300);
		});

		it("rejects non-object aiConfig during validation", () => {
			const project = createTimelineProject("proj-ai-3", "Test Project");
			const invalidProject = {
				...project,
				aiConfig: "invalid-string",
			};
			expect(() => validateTimelineProject(invalidProject as unknown as TimelineProject)).toThrow(
				/Invalid project AI config/i,
			);
		});

		it("rejects invalid field types in aiConfig during validation", () => {
			const project = createTimelineProject("proj-ai-4", "Test Project");
			const invalidThreshold = {
				...project,
				aiConfig: { silenceThresholdMs: "not-a-number" },
			};
			expect(() => validateTimelineProject(invalidThreshold as unknown as TimelineProject)).toThrow(
				/Invalid AI silence threshold/i,
			);
		});
	});
});
