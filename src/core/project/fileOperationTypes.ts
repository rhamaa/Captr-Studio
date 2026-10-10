import type { TimelineProject } from "../timeline/types";

export type ProjectFileIntent = "save" | "save-as" | "rename";
export interface ProjectFileRequest {
	operationId: string;
	ownerProjectId: string;
	generation: number;
	revision: number;
	expectedPath: string | null;
	intent: ProjectFileIntent;
	project: TimelineProject;
	name?: string;
	thumbnailDataUrl?: string | null;
}
export type ProjectFileResult =
	| { success: true; operationId: string; generation: number; revision: number;
		path: string; projectId: string; title: string; warning?: string }
	| { success: false; operationId: string; canceled?: boolean; error?: string };
export type ProjectPersistencePort = (request: ProjectFileRequest) => Promise<ProjectFileResult>;
