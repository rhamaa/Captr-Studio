import type { RecordingSessionData } from "../../../electron/ipc/types";
import type { ProjectController } from "./useProjectController";

export interface ProjectOpenResult {
	success: boolean;
	project?: unknown;
	path?: string;
	conversionToken?: string;
	error?: string;
	message?: string;
	canceled?: boolean;
}
export interface PendingProjectOpen {
	path?: string;
	result?: ProjectOpenResult;
}
export function bindProjectClose(
	controller: ProjectController,
	api: {
		setHasUnsavedChanges?: (dirty: boolean) => void;
		onRequestSaveBeforeClose?: (request: () => Promise<boolean>) => () => void;
	},
	onError: (error: unknown) => void,
	beforeClose?: () => Promise<boolean>,
): () => void {
	const sync = () => api.setHasUnsavedChanges?.(controller.snapshot.dirty);
	sync();
	const unsubscribe = controller.subscribe(sync);
	const release = api.onRequestSaveBeforeClose?.(async () => {
		try {
			if (beforeClose && !(await beforeClose())) return false;
			const result = await controller.save();
			if (!result.success) {
				if (!result.canceled)
					onError(result.error ?? result.message ?? "Could not save project");
				return false;
			}
			return !controller.snapshot.dirty;
		} catch (error) {
			onError(error);
			return false;
		}
	});
	return () => {
		unsubscribe();
		release?.();
	};
}
export async function resolveEditorBootstrap(api: {
	consumePendingProjectOpen?: () => Promise<PendingProjectOpen | null>;
	loadCurrentProjectFile?: () => Promise<ProjectOpenResult>;
	openProjectFileAtPath?: (path: string) => Promise<ProjectOpenResult>;
	getCurrentRecordingSession?: () => Promise<{
		success: boolean;
		session?: RecordingSessionData | null;
	}>;
}): Promise<{
	result?: ProjectOpenResult;
	recordingProjectId?: string;
	recordingSession?: RecordingSessionData;
	resetPath: boolean;
}> {
	const pending = await api.consumePendingProjectOpen?.();
	if (pending?.result) return { result: pending.result, resetPath: false };
	if (pending?.path)
		return { result: await api.openProjectFileAtPath?.(pending.path), resetPath: false };
	const completed = await api.getCurrentRecordingSession?.();
	const session = completed?.success ? completed.session : null;
	const result = await api.loadCurrentProjectFile?.();
	if (result?.success)
		return {
			result,
			recordingSession:
				session?.captureId &&
				session.projectId === (result.project as { projectId?: string })?.projectId
					? session
					: undefined,
			resetPath: false,
		};
	if (session?.captureId && session.projectId)
		return {
			recordingProjectId: session.projectId,
			recordingSession: session,
			resetPath: false,
		};
	return { resetPath: true };
}
