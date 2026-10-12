import { afterEach, describe, expect, it, vi } from "vitest";
import {
	bindProjectSaveShortcut,
	canAutosaveProject,
	DEFAULT_PROJECT_AUTOSAVE_DELAY_MS,
	dispatchProjectSaveShortcut,
	scheduleProjectAutosave,
} from "./projectSaveShortcuts";

function keyEvent(overrides: Partial<KeyboardEvent> = {}) {
	return {
		key: "s",
		ctrlKey: true,
		metaKey: false,
		altKey: false,
		shiftKey: false,
		target: { tagName: "INPUT" },
		preventDefault: vi.fn(),
		...overrides,
	} as unknown as KeyboardEvent;
}

describe("project save shortcut", () => {
	it("registers in capture phase so focused inputs cannot swallow the shortcut", () => {
		const handlers: Array<(event: KeyboardEvent) => void> = [];
		const captureOptions: boolean[] = [];
		const target = {
			addEventListener: (
				_type: string,
				handler: (event: KeyboardEvent) => void,
				capture: boolean,
			) => {
				handlers.push(handler);
				captureOptions.push(capture);
			},
			removeEventListener: vi.fn(),
		} as unknown as Pick<Window, "addEventListener" | "removeEventListener">;
		const save = vi.fn();
		const options = {
			blocked: false,
			nameDialogOpen: false,
			hasSavedPath: true,
			save,
			commitName: vi.fn(),
		};
		const cleanup = bindProjectSaveShortcut(target, () => options);
		const event = keyEvent();
		expect(captureOptions).toEqual([true]);
		handlers[0](event);
		expect(save).toHaveBeenCalledWith(false);
		cleanup();
		expect(target.removeEventListener).toHaveBeenCalledWith("keydown", handlers[0], true);
	});

	it("saves even when Ctrl+S originates in a text input", () => {
		const save = vi.fn();
		const handled = dispatchProjectSaveShortcut(keyEvent(), {
			blocked: false,
			nameDialogOpen: false,
			hasSavedPath: true,
			save,
			commitName: vi.fn(),
		});
		expect(handled).toBe(true);
		expect(save).toHaveBeenCalledWith(false);
	});

	it("keeps Save As explicit and maps name-dialog shortcuts to the matching action", () => {
		const save = vi.fn(),
			commitName = vi.fn();
		dispatchProjectSaveShortcut(keyEvent({ shiftKey: true }), {
			blocked: false,
			nameDialogOpen: false,
			hasSavedPath: true,
			save,
			commitName,
		});
		expect(save).toHaveBeenCalledWith(true);
		dispatchProjectSaveShortcut(keyEvent(), {
			blocked: false,
			nameDialogOpen: true,
			hasSavedPath: true,
			save,
			commitName,
		});
		dispatchProjectSaveShortcut(keyEvent({ shiftKey: true }), {
			blocked: false,
			nameDialogOpen: true,
			hasSavedPath: true,
			save,
			commitName,
		});
		expect(commitName.mock.calls).toEqual([["rename"], ["save-as"]]);
	});

	it("does not open Save As for a project that has never been saved", () => {
		const save = vi.fn();
		dispatchProjectSaveShortcut(keyEvent({ shiftKey: true }), {
			blocked: false,
			nameDialogOpen: false,
			hasSavedPath: false,
			save,
			commitName: vi.fn(),
		});
		expect(save).toHaveBeenCalledWith(false);
	});

	it("consumes repeated keydown without starting a second save", () => {
		const save = vi.fn();
		const event = keyEvent({ repeat: true });
		const handled = dispatchProjectSaveShortcut(event, {
			blocked: false,
			nameDialogOpen: false,
			hasSavedPath: true,
			save,
			commitName: vi.fn(),
		});
		expect(handled).toBe(true);
		expect(event.preventDefault).toHaveBeenCalledOnce();
		expect(save).not.toHaveBeenCalled();
	});
});

describe("project autosave", () => {
	afterEach(() => vi.useRealTimers());

	it("autosaves only dirty, path-backed projects while the editor is idle", () => {
		const base = {
			path: "Tutorial.captr",
			dirty: true,
			saving: false,
			fileOperation: null,
			navigationPending: false,
			pendingWork: 0,
			busy: false,
			audioCaptureActive: false,
			exportInProgress: false,
			navigationBlocked: false,
			nameDialogOpen: false,
		};
		expect(canAutosaveProject(base)).toBe(true);
		expect(canAutosaveProject({ ...base, path: null })).toBe(false);
		expect(canAutosaveProject({ ...base, dirty: false })).toBe(false);
		expect(canAutosaveProject({ ...base, pendingWork: 1 })).toBe(false);
		expect(canAutosaveProject({ ...base, audioCaptureActive: true })).toBe(false);
	});

	it("waits for the debounce interval and cancels when newer state arrives", () => {
		vi.useFakeTimers();
		const callback = vi.fn();
		const cancel = scheduleProjectAutosave(callback);
		vi.advanceTimersByTime(DEFAULT_PROJECT_AUTOSAVE_DELAY_MS - 1);
		expect(callback).not.toHaveBeenCalled();
		cancel();
		vi.advanceTimersByTime(2);
		expect(callback).not.toHaveBeenCalled();
		scheduleProjectAutosave(callback);
		vi.advanceTimersByTime(DEFAULT_PROJECT_AUTOSAVE_DELAY_MS);
		expect(callback).toHaveBeenCalledTimes(1);
	});
});
