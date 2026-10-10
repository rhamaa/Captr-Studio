import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProjectTerminal } from "@/components/terminal/ProjectTerminal";
import { I18nProvider } from "@/contexts/I18nContext";
import { createTimelineProject } from "@/core/timeline/commands";
import { addRepurposeArtboard, ensureRepurposeBoard } from "@/core/timeline/repurposeCommands";
import {
	applyStoryCommand,
	getStoryEditProject,
	getStoryProject,
} from "@/core/timeline/storyOwnership";
import { ownershipFixture } from "@/core/timeline/storyOwnership.fixtures";
import { probeMedia } from "@/recording/mediaProbe";
import { AudioRecorderDialog } from "./AudioRecorderDialog";
import { ProjectEditor } from "./ProjectEditor";
import { StoryEditor } from "./StoryEditor";

vi.mock("./AudioRecorderDialog", () => ({ AudioRecorderDialog: vi.fn(() => null) }));
vi.mock("@/recording/mediaProbe", () => ({ probeMedia: vi.fn() }));

vi.mock("@/components/terminal/ProjectTerminal", () => ({ ProjectTerminal: vi.fn(() => null) }));
const terminalUi = vi.hoisted(() => ({
	forceOpen: false,
	renderingStory: false,
	stateIndex: 0,
	audioOpen: false,
	projectStateIndex: 0,
	setters: [] as Array<{ index: number; value: unknown }>,
}));
vi.mock("react", async (importOriginal) => {
	const actual = await importOriginal<typeof import("react")>();
	return {
		...actual,
		useState: ((initial: unknown) => {
			const index =
				!terminalUi.renderingStory && new Error().stack?.includes("ProjectEditor (")
					? ++terminalUi.projectStateIndex
					: 0;
			const openTerminal =
				terminalUi.renderingStory && ++terminalUi.stateIndex === 2 && terminalUi.forceOpen;
			const [value, setValue] = actual.useState(
				openTerminal || (terminalUi.audioOpen && index === 11) ? true : initial,
			);
			return [
				value,
				(next: unknown) => {
					terminalUi.setters.push({ index, value: next });
					setValue(next);
				},
			];
		}) as typeof actual.useState,
	};
});
vi.mock("./StoryEditor", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./StoryEditor")>();
	return {
		...actual,
		StoryEditor: vi.fn((props: Parameters<typeof actual.StoryEditor>[0]) => {
			terminalUi.renderingStory = true;
			terminalUi.stateIndex = 0;
			try {
				return actual.StoryEditor(props);
			} finally {
				terminalUi.renderingStory = false;
			}
		}),
	};
});

import { createProjectAudioRecorderNavigation } from "./projectAudioRecorderNavigation";
import { ProjectController } from "./useProjectController";

describe("ProjectEditor audio recording navigation", () => {
	it("hands the captured Story to audio completion and guards the Story back action", async () => {
		vi.stubGlobal("window", {
			electronAPI: {
				saveRecordedAudio: vi.fn(async () => ({
					success: true,
					filePath: "C:/recordings/voiceovers/ui.webm",
				})),
				discardRecordedAudio: vi.fn(),
			},
			localStorage: { getItem: () => null, setItem: vi.fn() },
		});
		vi.mocked(probeMedia).mockResolvedValue({ durationUs: 2_000_000, width: 0, height: 0 });
		const controller = new ProjectController(ownershipFixture(), vi.fn());
		controller.seek(7_000_000);
		terminalUi.projectStateIndex = 0;
		terminalUi.audioOpen = true;
		terminalUi.setters = [];
		try {
			renderToStaticMarkup(
				createElement(
					I18nProvider,
					null,
					createElement(ProjectEditor, {
						controller,
						initialArtboardId: "A",
						onRequestHome: vi.fn(),
						onProjectChanged: vi.fn(),
						onRequestNew: vi.fn(),
						onRequestOpen: vi.fn(),
					}),
				),
			);
			const dialog = vi.mocked(AudioRecorderDialog).mock.calls.at(-1)![0];
			dialog.onRecordingChange!(true);
			controller.seek(11_000_000);
			terminalUi.setters = [];
			vi.mocked(StoryEditor).mock.calls.at(-1)![0].onBackToBoard!();
			expect(terminalUi.setters).toContainEqual({ index: 12, value: true });
			expect(terminalUi.setters.some((entry) => entry.index === 5)).toBe(false);
			dialog.onNavigationChoice("stay");
			expect(terminalUi.setters.some((entry) => entry.index === 5)).toBe(false);
			await dialog.onTakeRecorded({
				blob: new Blob([new Uint8Array([1])]),
				mimeType: "audio/webm",
				extension: "webm",
				durationMs: 2000,
				startUs: 0,
			});
			const view = getStoryProject(controller.snapshot.project, {
				kind: "artboard",
				artboardId: "A",
			});
			const recorded = view.localAssets?.find(
				(asset) => asset.source?.path === "C:/recordings/voiceovers/ui.webm",
			);
			expect(recorded).toBeDefined();
			expect(
				view.tracks
					.flatMap((track) => track.clips)
					.find((clip) => clip.assetId === recorded?.id)?.startUs,
			).toBe(0);
			expect(
				controller.snapshot.project.assets.filter((asset) => asset.kind === "audio"),
			).toHaveLength(0);
		} finally {
			terminalUi.audioOpen = false;
			vi.unstubAllGlobals();
		}
	});
	it.each([
		{ kind: "root" },
		{ kind: "artboard", artboardId: "A" },
	] as const)("updates and clears project terminal settings from $kind UI with undo", (scope) => {
		vi.stubGlobal("window", {
			electronAPI: {},
			localStorage: { getItem: () => null, setItem: vi.fn() },
		});
		const controller = new ProjectController(ownershipFixture(), vi.fn());
		const before = structuredClone(controller.snapshot.project);
		// Open the existing terminal control without a browser or terminal process.
		terminalUi.forceOpen = true;
		try {
			const view =
				scope.kind === "artboard"
					? createElement(ProjectEditor, {
							controller,
							initialArtboardId: scope.artboardId,
							onRequestHome: vi.fn(),
							onProjectChanged: vi.fn(),
							onRequestNew: vi.fn(),
							onRequestOpen: vi.fn(),
						})
					: createElement(StoryEditor, {
							storyProject: getStoryEditProject(controller.snapshot.project, scope),
							rootProject: controller.snapshot.project,
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
							onError: vi.fn(),
							onCommand: (command) =>
								controller.execute((root) =>
									applyStoryCommand(root, scope, command),
								),
							onProjectCommand: (command) => controller.execute(command),
						});
			renderToStaticMarkup(createElement(I18nProvider, null, view));
		} finally {
			terminalUi.forceOpen = false;
			vi.unstubAllGlobals();
		}
		const terminal = vi.mocked(ProjectTerminal).mock.calls.at(-1)![0];
		const config = { preferredShell: "powershell" as const, startupCommand: "npm run dev" };
		terminal.onUpdateTerminalConfig!(config);
		expect(controller.snapshot.project.terminalConfig).toEqual(config);
		expect(getStoryProject(controller.snapshot.project, scope).tracks).toEqual(
			getStoryProject(before, scope).tracks,
		);
		expect(controller.snapshot.project.repurposeBoard).toEqual(before.repurposeBoard);
		terminal.onUpdateTerminalConfig!(undefined);
		expect(controller.snapshot.project.terminalConfig).toBeUndefined();
		controller.undo();
		expect(controller.snapshot.project.terminalConfig).toEqual(config);
		controller.undo();
		expect(controller.snapshot.project.terminalConfig).toBeUndefined();
		expect(controller.snapshot.project.repurposeBoard).toEqual(before.repurposeBoard);
	});
	it("shows an unavailable owner instead of the root timeline when the selected Story disappeared", () => {
		vi.stubGlobal("window", {
			electronAPI: {},
			localStorage: { getItem: () => null, setItem: () => undefined },
		});
		const controller = new ProjectController(
			createTimelineProject("missing-story", "Project"),
			async () => ({ success: true, path: "project.captr" }),
		);
		const before = controller.snapshot;
		const html = renderToStaticMarkup(
			createElement(
				I18nProvider,
				null,
				createElement(ProjectEditor, {
					controller,
					initialArtboardId: "deleted-owner",
					onRequestHome: vi.fn(),
					onProjectChanged: vi.fn(),
					onRequestNew: vi.fn(),
					onRequestOpen: vi.fn(),
				}),
			),
		);
		expect(html).toContain("This Story owner no longer exists");
		expect(html).not.toContain('aria-label="Project timeline"');
		expect(controller.snapshot).toBe(before);
		vi.unstubAllGlobals();
	});
	it.each(["finish", "discard"] as const)("continues navigation after %s", (choice) => {
		let active = true;
		const action = vi.fn();
		const setChoiceRequested = vi.fn();
		const closeRecorder = vi.fn();
		const navigation = createProjectAudioRecorderNavigation({
			isActive: () => active,
			setChoiceRequested,
			closeRecorder,
		});

		navigation.request(() => action());
		expect(action).not.toHaveBeenCalled();
		expect(setChoiceRequested).toHaveBeenLastCalledWith(true);
		active = false;
		navigation.resolve(choice);

		expect(closeRecorder).toHaveBeenCalledOnce();
		expect(action).toHaveBeenCalledOnce();
	});

	it("keeps the recorder and project open when the user chooses Stay", () => {
		const action = vi.fn();
		const setChoiceRequested = vi.fn();
		const closeRecorder = vi.fn();
		const navigation = createProjectAudioRecorderNavigation({
			isActive: () => true,
			setChoiceRequested,
			closeRecorder,
		});

		navigation.request(action);
		navigation.resolve("stay");

		expect(setChoiceRequested).toHaveBeenLastCalledWith(false);
		expect(closeRecorder).not.toHaveBeenCalled();
		expect(action).not.toHaveBeenCalled();
	});
	it.each([
		"finish",
		"discard",
	] as const)("does not switch Stories while %s is still finalizing", (choice) => {
		let active = true;
		const action = vi.fn();
		const closeRecorder = vi.fn();
		const navigation = createProjectAudioRecorderNavigation({
			isActive: () => active,
			setChoiceRequested: vi.fn(),
			closeRecorder,
		});
		navigation.request(action);
		navigation.resolve(choice);
		expect(action).not.toHaveBeenCalled();
		expect(closeRecorder).not.toHaveBeenCalled();
		active = false;
		navigation.resolve(choice);
		expect(action).toHaveBeenCalledOnce();
	});

	it("vetoes Electron close when the user chooses Stay and resumes it after Finish", async () => {
		let active = true;
		const setChoiceRequested = vi.fn();
		const closeRecorder = vi.fn();
		const navigation = createProjectAudioRecorderNavigation({
			isActive: () => active,
			setChoiceRequested,
			closeRecorder,
		});
		const close = navigation.beforeClose();
		navigation.resolve("stay");
		expect(await close).toBe(false);

		const secondClose = navigation.beforeClose();
		active = false;
		navigation.resolve("finish");
		expect(await secondClose).toBe(true);
	});

	it("renders Multi-Artboard Hub as primary view by default", () => {
		vi.stubGlobal("window", {
			electronAPI: {},
			localStorage: { getItem: () => null, setItem: () => undefined },
		});
		const controller = new ProjectController(
			createTimelineProject("editor", "Editor"),
			async () => ({ success: true, path: "editor.captr" }),
		);
		const markup = renderToStaticMarkup(
			createElement(
				I18nProvider,
				null,
				createElement(ProjectEditor, {
					controller,
					onRequestHome: vi.fn(),
					onProjectChanged: vi.fn(),
					onRequestNew: vi.fn(),
					onRequestOpen: vi.fn(),
				}),
			),
		);

		expect(markup).toContain('class="repurpose-board-editor"');
		expect(markup).toContain("Multi-Artboard Hub");
		expect(markup).toContain("9:16");
		expect(markup).toContain("16:9");
		vi.unstubAllGlobals();
	});

	it("wires the Audio Recorder action into the project Asset Library when viewing artboard timeline", () => {
		vi.stubGlobal("window", {
			electronAPI: {},
			localStorage: { getItem: () => null, setItem: () => undefined },
		});
		let project = createTimelineProject("editor", "Editor");
		project = addRepurposeArtboard(project, {
			aspectRatio: "9:16",
			name: "Shorts",
			width: 1080,
			height: 1920,
			defaultFitMode: "cover",
		});
		const artboardId = project.repurposeBoard!.artboards[0].id;

		const controller = new ProjectController(project, async () => ({
			success: true,
			path: "editor.captr",
		}));
		const markup = renderToStaticMarkup(
			createElement(
				I18nProvider,
				null,
				createElement(ProjectEditor, {
					controller,
					onRequestHome: vi.fn(),
					onProjectChanged: vi.fn(),
					onRequestNew: vi.fn(),
					onRequestOpen: vi.fn(),
					initialArtboardId: artboardId,
				}),
			),
		);

		expect(markup).toContain('aria-label="Record Audio"');
		expect(markup).toContain("Record Audio");
		expect(markup).toContain('class="project-back-artboards-button"');
		vi.unstubAllGlobals();
	});
});
