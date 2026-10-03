import { ProjectSession } from "@/core/timeline/projectSession";
import type { TimelineProject } from "@/core/timeline/types";
export interface ProjectSaveResult {
	success: boolean;
	path?: string;
	projectId?: string;
	canceled?: boolean;
	message?: string;
	error?: string;
}
export type SaveProject = (
	project: TimelineProject,
	title: string,
	existingPath?: string,
) => Promise<ProjectSaveResult>;
interface Options {
	save: SaveProject;
	onSaved: (revision: number, path: string, project: TimelineProject) => void;
}
/** Serializes immutable save snapshots. A completed older save clears only its own revision. */
export class TimelinePersistence {
	private session = new ProjectSession();
	private generation = 0;
	private projectId = "";
	private queue: Promise<unknown> = Promise.resolve();
	constructor(private options: Options) {}
	beginProject(projectId: string): void {
		this.projectId = projectId;
		this.generation = this.session.beginProject(projectId);
	}
	save(
		project: TimelineProject,
		revision: number,
		path: string | null,
		saveAs = false,
	): Promise<ProjectSaveResult> {
		const snapshot = structuredClone(project),
			generation = this.generation,
			ownerId = this.projectId;
		const job = this.queue.then(async () => {
			if (!this.session.isCurrent(generation, ownerId))
				return { success: false, canceled: true };
			const result = await this.options.save(
				snapshot,
				snapshot.title,
				saveAs ? undefined : (path ?? undefined),
			);
			if (
				result.success &&
				result.path &&
				(!result.projectId || result.projectId === snapshot.projectId) &&
				this.session.isCurrent(generation, ownerId)
			)
				this.options.onSaved(revision, result.path, snapshot);
			return result;
		});
		this.queue = job.catch(() => undefined);
		return job;
	}
	dispose(): void {
		this.session.dispose();
	}
}
