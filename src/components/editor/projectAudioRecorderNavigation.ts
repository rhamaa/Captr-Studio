export type ProjectAudioNavigationChoice = "finish" | "discard" | "stay";

export interface ProjectAudioRecorderNavigation {
	request(action: () => void): void;
	beforeClose(): Promise<boolean>;
	resolve(choice: ProjectAudioNavigationChoice): void;
}

export function createProjectAudioRecorderNavigation(options: {
	isActive: () => boolean;
	setChoiceRequested: (requested: boolean) => void;
	closeRecorder: () => void;
}): ProjectAudioRecorderNavigation {
	let pendingAction: (() => void) | null = null;
	let pendingClose: ((allow: boolean) => void) | null = null;

	const requestChoice = () => options.setChoiceRequested(true);
	const request = (action: () => void) => {
		if (!options.isActive()) {
			options.closeRecorder();
			action();
			return;
		}
		pendingAction = action;
		requestChoice();
	};
	const beforeClose = () => {
		if (!options.isActive()) return Promise.resolve(true);
		requestChoice();
		return new Promise<boolean>((resolve) => {
			pendingClose = resolve;
		});
	};
	const resolve = (choice: ProjectAudioNavigationChoice) => {
		options.setChoiceRequested(false);
		if (choice === "stay") {
			pendingAction = null;
			pendingClose?.(false);
			pendingClose = null;
			return;
		}
		options.closeRecorder();
		pendingAction?.();
		pendingAction = null;
		pendingClose?.(true);
		pendingClose = null;
	};
	return { request, beforeClose, resolve };
}
