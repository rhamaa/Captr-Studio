export const DEFAULT_PROJECT_AUTOSAVE_DELAY_MS = 1_200;

export type ProjectNameSaveIntent = "save" | "save-as" | "rename";

export interface ProjectSaveShortcutOptions {
	blocked: boolean;
	nameDialogOpen: boolean;
	hasSavedPath: boolean;
	save: (saveAs: boolean) => void;
	commitName: (intent: ProjectNameSaveIntent) => void;
}

export function bindProjectSaveShortcut(
	target: Pick<Window, "addEventListener" | "removeEventListener">,
	getOptions: () => ProjectSaveShortcutOptions,
): () => void {
	const keydown = (event: KeyboardEvent) => {
		dispatchProjectSaveShortcut(event, getOptions());
	};
	target.addEventListener("keydown", keydown, true);
	return () => target.removeEventListener("keydown", keydown, true);
}

export function dispatchProjectSaveShortcut(
	event: Pick<
		KeyboardEvent,
		"key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat" | "preventDefault"
	>,
	options: ProjectSaveShortcutOptions,
): boolean {
	if ((!event.ctrlKey && !event.metaKey) || event.altKey || event.key.toLowerCase() !== "s")
		return false;
	event.preventDefault();
	if (event.repeat || options.blocked) return true;
	if (options.nameDialogOpen) {
		options.commitName(!options.hasSavedPath ? "save" : event.shiftKey ? "save-as" : "rename");
	} else options.save(event.shiftKey && options.hasSavedPath);
	return true;
}

export interface ProjectAutosaveEligibility {
	path: string | null;
	dirty: boolean;
	saving: boolean;
	fileOperation: string | null;
	navigationPending: boolean;
	pendingWork: number;
	busy: boolean;
	audioCaptureActive: boolean;
	exportInProgress: boolean;
	navigationBlocked: boolean;
	nameDialogOpen: boolean;
}

export function canAutosaveProject(state: ProjectAutosaveEligibility): boolean {
	return Boolean(
		state.path &&
			state.dirty &&
			!state.saving &&
			!state.fileOperation &&
			!state.navigationPending &&
			state.pendingWork === 0 &&
			!state.busy &&
			!state.audioCaptureActive &&
			!state.exportInProgress &&
			!state.navigationBlocked &&
			!state.nameDialogOpen,
	);
}

export function scheduleProjectAutosave(
	callback: () => void,
	delayMs = DEFAULT_PROJECT_AUTOSAVE_DELAY_MS,
): () => void {
	const timer = setTimeout(callback, delayMs);
	return () => clearTimeout(timer);
}
