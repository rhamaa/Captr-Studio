import { ProjectSession } from "@/core/timeline/projectSession";
import type { TimelineProject } from "@/core/timeline/types";
import type { ProjectFileRequest, ProjectFileResult, ProjectPersistencePort } from "@/core/project/fileOperationTypes";
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
	save?: SaveProject;
	persist?: ProjectPersistencePort;
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
	run(request: ProjectFileRequest): Promise<ProjectFileResult> {
		const snapshot=structuredClone(request), generation=this.generation, owner=this.projectId;
		const job=this.queue.then(async ():Promise<ProjectFileResult> => {
			if(!this.session.isCurrent(generation,owner)) return {success:false,operationId:request.operationId,canceled:true};
			const result=await this.options.persist!(snapshot);
			if(result.success && (result.operationId!==snapshot.operationId || result.generation!==snapshot.generation || result.revision!==snapshot.revision || result.projectId!==snapshot.project.projectId))
				return {success:false,operationId:snapshot.operationId,error:"Project operation result ownership mismatch."};
			if(result.success && this.session.isCurrent(generation,owner)) this.options.onSaved(snapshot.revision,result.path,snapshot.project);
			return result;
		});
		this.queue=job.catch(()=>undefined); return job;
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
			const result = await this.options.save!(
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
