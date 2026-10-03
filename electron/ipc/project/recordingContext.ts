import { randomUUID } from "node:crypto";
export interface RecordingProjectContext {
	projectId?: string;
	captureId?: string;
}
let context: RecordingProjectContext = {};
let activeProjectId: string | undefined;
export function setActiveRecordingProjectId(id: string): void {
	activeProjectId = id;
}
export function getActiveRecordingProjectId(): string | undefined {
	return activeProjectId;
}
export function setRecordingProjectContext(next: RecordingProjectContext): void {
	const projectId = next.projectId ?? activeProjectId ?? randomUUID();
	activeProjectId = projectId;
	context = { projectId, captureId: next.captureId ?? randomUUID() };
}
export function getRecordingProjectContext(): RecordingProjectContext {
	if (!context.projectId || !context.captureId || context.projectId !== activeProjectId)
		setRecordingProjectContext({ projectId: activeProjectId });
	return { ...context };
}
