import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { createTimelineProject } from "@/core/timeline/commands";
import { ProjectEditor } from "./ProjectEditor";
import { createProjectAudioRecorderNavigation } from "./projectAudioRecorderNavigation";
import { ProjectController } from "./useProjectController";

describe("ProjectEditor audio recording navigation", () => {
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

	it("vetoes Electron close when the user chooses Stay and resumes it after Finish", async () => {
		const setChoiceRequested = vi.fn();
		const closeRecorder = vi.fn();
		const navigation = createProjectAudioRecorderNavigation({
			isActive: () => true,
			setChoiceRequested,
			closeRecorder,
		});
		const close = navigation.beforeClose();
		navigation.resolve("stay");
		expect(await close).toBe(false);

		const secondClose = navigation.beforeClose();
		navigation.resolve("finish");
		expect(await secondClose).toBe(true);
	});

	it("wires the Audio Recorder action into the project Asset Library", () => {
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

		expect(markup).toContain('aria-label="Record Audio"');
		expect(markup).toContain("Record Audio");
		vi.unstubAllGlobals();
	});
});
