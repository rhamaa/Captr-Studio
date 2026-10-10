import { useRef, useSyncExternalStore } from "react";
import type { ProjectPersistencePort } from "@/core/project/fileOperationTypes";
import { projectTitleFromPath, validateProjectBaseName } from "@/core/project/projectNames";
import { type ProjectCommand, ProjectHistory } from "@/core/timeline/history";
import { ProjectSession } from "@/core/timeline/projectSession";
import {
	applyStoryCommand,
	getStoryProject,
	type StoryEditContext,
	sameStoryEditContext,
} from "@/core/timeline/storyOwnership";
import type { StoryScope } from "@/core/timeline/types";
import { projectDurationUs, type TimelineProject } from "@/core/timeline/types";
import { validateTimelineProject } from "@/core/timeline/validation";
import { type SaveProject, TimelinePersistence } from "./useTimelinePersistence";
export interface ProjectControllerState {
	project: TimelineProject;
	revision: number;
	savedRevision: number;
	path: string | null;
	dirty: boolean;
	selection: string[];
	selectedAssetId: string | null;
	playheadUs: number;
	canUndo: boolean;
	canRedo: boolean;
	saving: boolean;
	fileOperation: "save" | "save-as" | "rename" | null;
	openingKey: number;
	navigationPending: boolean;
	pendingWork: number;
}
export class ProjectController {
	private history: ProjectHistory;
	private persistence: TimelinePersistence;
	private listeners = new Set<() => void>();
	private importSession = new ProjectSession();
	private generation: number;
	private state: ProjectControllerState;
	private exited = false;
	private verified: boolean;
	private thumbnailProvider: (() => Promise<string | null> | string | null) | null = null;
	private work = new Map<string, number>();
	constructor(project: TimelineProject, save: SaveProject | { persist: ProjectPersistencePort }) {
		this.verified = typeof save !== "function";
		this.history = new ProjectHistory(project);
		this.generation = this.importSession.beginProject(project.projectId);
		this.state = {
			project: this.history.project,
			revision: 0,
			savedRevision: 0,
			path: null,
			dirty: false,
			selection: [],
			selectedAssetId: null,
			playheadUs: 0,
			canUndo: false,
			canRedo: false,
			saving: false,
			fileOperation: null,
			openingKey: 0,
			navigationPending: false,
			pendingWork: 0,
		};
		this.persistence = new TimelinePersistence({
			...(typeof save === "function" ? { save } : save),
			onSaved: (revision, path, saved) => {
				if (saved.projectId !== this.state.project.projectId) {
					// Save As changes identity after success while keeping edits made during saving.
					this.history.reidentify(saved.projectId);
					this.generation = this.importSession.beginProject(saved.projectId);
					this.persistence.beginProject(saved.projectId);
				}
				this.history.setTitle(projectTitleFromPath(path));
				this.publish({ savedRevision: revision, path });
			},
		});
		this.persistence.beginProject(project.projectId);
	}
	get snapshot(): ProjectControllerState {
		return this.state;
	}
	get isExited(): boolean {
		return this.exited;
	}
	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	};
	private publish(patch: Partial<ProjectControllerState> = {}): void {
		this.state = {
			...this.state,
			...patch,
			project: this.history.project,
			selection: this.history.selection,
			canUndo: this.history.canUndo,
			canRedo: this.history.canRedo,
		};
		this.state.dirty = this.state.revision !== this.state.savedRevision;
		for (const listener of this.listeners) listener();
	}
	storyEditContext(scope: StoryScope): StoryEditContext {
		getStoryProject(this.state.project, scope);
		return {
			...this.importToken(),
			scope: structuredClone(scope),
			revision: this.state.revision,
		};
	}
	acceptStoryEdit(
		context: StoryEditContext,
		scope: StoryScope,
		command: ProjectCommand,
	): boolean {
		if (this.exited) return false;
		try {
			if (!sameStoryEditContext(context, this.storyEditContext(scope))) return false;
			this.execute((root) => applyStoryCommand(root, context.scope, command));
			return true;
		} catch {
			return false;
		}
	}
	execute(command: ProjectCommand, selection?: string[]): void {
		if (
			this.exited ||
			this.state.navigationPending ||
			this.state.fileOperation === "rename" ||
			this.state.fileOperation === "save-as"
		)
			throw new Error("Finish the file operation before editing.");
		const previous = this.history.project;
		this.history.execute(command, selection);
		if (previous !== this.history.project) this.publish({ revision: this.state.revision + 1 });
	}
	select(selection: string[]): void {
		this.history.select(selection);
		this.publish({ selectedAssetId: null });
	}
	preview(assetId: string | null, scope: StoryScope = { kind: "root" }): void {
		const view = getStoryProject(this.history.project, scope);
		if (assetId && ![...view.assets, ...(view.localAssets ?? [])].some((a) => a.id === assetId))
			return;
		this.publish({ selectedAssetId: assetId });
	}
	seek(timeUs: number, maxDurationUs?: number): void {
		const rootDuration = projectDurationUs(this.history.project);
		const artboardDurations =
			this.history.project.repurposeBoard?.artboards.map((a) =>
				a.tracks ? projectDurationUs({ ...this.history.project, tracks: a.tracks }) : 0,
			) ?? [];
		const fallbackMax = Math.max(rootDuration, ...artboardDurations);
		const max = maxDurationUs !== undefined ? maxDurationUs : fallbackMax;
		this.publish({
			playheadUs: Math.max(0, Math.min(max, Math.round(timeUs))),
		});
	}
	undo(): void {
		if (this.state.navigationPending) return;
		if (this.state.fileOperation === "rename" || this.state.fileOperation === "save-as") return;
		if (!this.history.canUndo) return;
		this.history.undo();
		this.publish({ revision: this.state.revision + 1 });
	}
	redo(): void {
		if (this.state.navigationPending) return;
		if (this.state.fileOperation === "rename" || this.state.fileOperation === "save-as") return;
		if (!this.history.canRedo) return;
		this.history.redo();
		this.publish({ revision: this.state.revision + 1 });
	}
	open(project: TimelineProject, path: string | null): void {
		this.work.clear();
		const next = structuredClone(validateTimelineProject(project));
		if (path) next.title = projectTitleFromPath(path);
		this.history = new ProjectHistory(next);
		this.generation = this.importSession.beginProject(next.projectId);
		this.persistence.beginProject(next.projectId);
		this.publish({
			revision: 0,
			savedRevision: 0,
			path,
			selectedAssetId: null,
			playheadUs: 0,
			saving: false,
			fileOperation: null,
			openingKey: this.state.openingKey + 1,
			navigationPending: false,
			pendingWork: 0,
		});
	}
	importToken(): { generation: number; projectId: string } {
		return { generation: this.generation, projectId: this.state.project.projectId };
	}
	acceptImport(
		token: { generation: number; projectId: string },
		command: ProjectCommand,
	): boolean {
		if (
			this.exited ||
			this.state.fileOperation === "rename" ||
			this.state.fileOperation === "save-as" ||
			!this.importSession.isCurrent(token.generation, token.projectId)
		)
			return false;
		this.execute(command);
		return true;
	}
	async save(
		saveAs = false,
		name?: string,
	): Promise<import("./useTimelinePersistence").ProjectSaveResult> {
		return this.fileOperation(saveAs ? "save-as" : "save", name);
	}
	async rename(name: string): Promise<import("./useTimelinePersistence").ProjectSaveResult> {
		const valid = validateProjectBaseName(name);
		if (this.state.path && valid === projectTitleFromPath(this.state.path))
			return {
				success: true,
				path: this.state.path,
				projectId: this.state.project.projectId,
			};
		return this.fileOperation(this.state.path ? "rename" : "save", valid);
	}
	setThumbnailProvider(provider: (() => Promise<string | null> | string | null) | null): void {
		this.thumbnailProvider = provider;
	}
	private async fileOperation(
		intent: "save" | "save-as" | "rename",
		name?: string,
	): Promise<import("./useTimelinePersistence").ProjectSaveResult> {
		if (
			this.exited ||
			this.state.fileOperation ||
			this.state.navigationPending ||
			(intent !== "save" && this.state.pendingWork > 0)
		)
			return { success: false, error: "A project file operation is already running." };
		const generation = this.generation,
			owner = this.state.project.projectId,
			revision = this.state.revision,
			path = this.state.path;
		const project = structuredClone(this.history.project);
		if (name !== undefined) project.title = validateProjectBaseName(name);
		if (intent === "save-as") project.projectId = crypto.randomUUID();
		this.publish({ saving: true, fileOperation: intent });
		try {
			const thumbnailDataUrl = this.thumbnailProvider
				? ((await this.thumbnailProvider()) ?? undefined)
				: undefined;
			if (this.verified)
				return await this.persistence.run({
					operationId: crypto.randomUUID(),
					ownerProjectId: owner,
					generation,
					revision,
					expectedPath: path,
					intent,
					project,
					name,
					thumbnailDataUrl,
				});
			if (intent === "rename")
				return { success: false, error: "Rename requires the verified file service." };
			return await this.persistence.save(project, revision, path, intent === "save-as");
		} finally {
			if (
				!this.exited &&
				(generation === this.generation ||
					this.state.project.projectId === project.projectId)
			)
				this.publish({ saving: false, fileOperation: null });
		}
	}
	setPendingWork(key: string, count: number): void {
		if (this.exited) return;
		this.work.set(key, Math.max(0, count));
		this.publish({ pendingWork: [...this.work.values()].reduce((a, b) => a + b, 0) });
	}
	beginNavigation(): boolean {
		if (
			this.exited ||
			this.state.fileOperation ||
			this.state.navigationPending ||
			this.state.pendingWork
		)
			return false;
		this.publish({ navigationPending: true });
		return true;
	}
	endNavigation(): void {
		if (!this.exited) this.publish({ navigationPending: false });
	}
	exit(): void {
		this.exited = true;
		this.dispose();
	}
	dispose(): void {
		this.thumbnailProvider = null;
		this.persistence.dispose();
		this.importSession.dispose();
		this.listeners.clear();
	}
}
export function createProjectController(project: TimelineProject): ProjectController {
	return new ProjectController(project, {
		persist: (request) => window.electronAPI.operateTimelineProjectFile(request),
	});
}
export function useProjectController(initial: TimelineProject | ProjectController) {
	const ref = useRef<ProjectController>();
	if (!ref.current)
		ref.current =
			initial instanceof ProjectController ? initial : createProjectController(initial);
	const controller = initial instanceof ProjectController ? initial : ref.current;
	const state = useSyncExternalStore(
		controller.subscribe,
		() => controller.snapshot,
		() => controller.snapshot,
	);
	return { controller, state };
}
