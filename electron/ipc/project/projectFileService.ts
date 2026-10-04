import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
	ProjectFileRequest,
	ProjectFileResult,
} from "../../../src/core/project/fileOperationTypes";
import {
	projectTitleFromPath,
	validateProjectBaseName,
} from "../../../src/core/project/projectNames";
import { visitTimelineMediaPaths } from "../../../src/core/timeline/mediaPaths";
import { validateTimelineProject } from "../../../src/core/timeline/validation";
import { inspectProjectBundle, packProjectWorkspace } from "./projectBundle";
import { enqueueProjectFileOperation } from "./projectFileQueue";
import { recoverProjectRenameTransactions, renameProjectBundle } from "./projectRenameTransaction";
import { stageTimelineProject } from "./timelineBundle";

export interface ProjectFileServicePorts {
	getCurrentPath: () => string | null;
	getProjectId: () => string | undefined;
	isBusy: () => boolean;
	isTrusted: (file: string) => boolean;
	validateMedia?: (file: string) => Promise<boolean>;
	journalDir: string;
	chooseSavePath: (suggestedName: string) => Promise<string | null>;
	commit: (file: string, projectId: string) => void;
	remember: (file: string, oldPath?: string) => Promise<void>;
}
function comparable(file: string): string {
	const resolved = path.resolve(file);
	return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
export async function sameProjectFile(a: string, b: string): Promise<boolean> {
	const [realA, realB] = await Promise.all([
		fs.realpath(a).catch(() => path.resolve(a)),
		fs.realpath(b).catch(() => path.resolve(b)),
	]);
	if (comparable(realA) === comparable(realB)) return true;
	const [statA, statB] = await Promise.all([
		fs.stat(realA).catch(() => null),
		fs.stat(realB).catch(() => null),
	]);
	return Boolean(
		statA && statB && statA.ino !== 0 && statA.ino === statB.ino && statA.dev === statB.dev,
	);
}
async function defaultPorts(): Promise<ProjectFileServicePorts> {
	const [{ app, dialog }, manager, state, context, activity] = await Promise.all([
		import("electron"),
		import("./manager"),
		import("../state"),
		import("./recordingContext"),
		import("./projectActivity"),
	]);
	return {
		getCurrentPath: () => state.currentProjectPath,
		getProjectId: context.getActiveRecordingProjectId,
		isBusy: () => {
			const s = activity.getTimelineProjectActivity();
			return s.recording || s.finalizing;
		},
		isTrusted: manager.isTrustedProjectPath,
		validateMedia: manager.isAllowedLocalMediaPath,
		journalDir: path.join(app.getPath("userData"), "project-rename-transactions"),
		chooseSavePath: async (name) => {
			const result = await dialog.showSaveDialog({
				title: "Save Captr Studio Project",
				defaultPath: path.join(await manager.getProjectsDir(), `${name}.captr`),
				filters: [{ name: "Captr Studio Project", extensions: ["captr"] }],
				properties: ["createDirectory", "showOverwriteConfirmation"],
			});
			return result.canceled ? null : (result.filePath ?? null);
		},
		commit: (file, id) => {
			state.setCurrentProjectPath(file);
			context.setActiveRecordingProjectId(id);
		},
		remember: (file, old) =>
			old ? manager.replaceRecentProjectPath(old, file) : manager.rememberRecentProject(file),
	};
}

export async function performProjectFileOperation(
	request: ProjectFileRequest,
	suppliedPorts?: ProjectFileServicePorts,
): Promise<ProjectFileResult> {
	return enqueueProjectFileOperation(async () => {
		const operationId = request?.operationId ?? "invalid";
		try {
			if (
				!/^[a-zA-Z0-9_-]{1,100}$/.test(operationId) ||
				!request.ownerProjectId ||
				!Number.isSafeInteger(request.generation) ||
				request.generation < 0 ||
				!Number.isSafeInteger(request.revision) ||
				request.revision < 0 ||
				!["save", "save-as", "rename"].includes(request.intent) ||
				!(request.expectedPath === null || typeof request.expectedPath === "string")
			)
				throw new Error("Invalid project file operation.");
			const ports = suppliedPorts ?? (await defaultPorts());
			const recovery = await recoverProjectRenameTransactions(ports.journalDir);
			if (recovery.warnings.length) throw new Error(recovery.warnings.join("\n"));
			if (ports.isBusy()) throw new Error("Finish recording before changing project files.");
			const project = structuredClone(validateTimelineProject(request.project));
			if (request.intent !== "save-as" && project.projectId !== request.ownerProjectId)
				throw new Error("Project identity does not match the active session.");
			if (request.intent === "save-as" && project.projectId === request.ownerProjectId)
				throw new Error("Save As requires a separate project identity.");
			const activeId = ports.getProjectId(),
				activePath = ports.getCurrentPath();
			if (activeId !== request.ownerProjectId)
				throw new Error("The active project changed; retry from the current project.");
			if (
				activePath &&
				(!request.expectedPath ||
					!(await sameProjectFile(activePath, request.expectedPath)))
			)
				throw new Error("The active project path changed.");
			if (request.expectedPath) {
				if (!ports.isTrusted(request.expectedPath) && request.intent === "rename")
					throw new Error("Open this project before renaming it.");
				const original = await inspectProjectBundle(request.expectedPath);
				if (
					!original.success ||
					!original.isBundle ||
					original.projectData?.projectId !== request.ownerProjectId
				)
					throw new Error("The active project file identity could not be verified.");
			}
			const draft =
				request.name === undefined ? project.title : validateProjectBaseName(request.name);
			let target: string;
			if (request.intent === "rename") {
				if (!request.expectedPath)
					throw new Error("Save the project before renaming its file.");
				target = path.join(
					path.dirname(request.expectedPath),
					`${validateProjectBaseName(draft)}.captr`,
				);
			} else if (request.intent === "save" && request.expectedPath)
				target = request.expectedPath;
			else {
				const chosen = await ports.chooseSavePath(
					validateProjectBaseName(draft || "Untitled"),
				);
				if (!chosen) return { success: false, operationId, canceled: true };
				target = /\.captr$/i.test(chosen) ? chosen : `${chosen}.captr`;
				validateProjectBaseName(path.basename(target));
				if (request.expectedPath && (await sameProjectFile(request.expectedPath, target)))
					throw new Error(
						"Choose a different file for Save As; the original project will be preserved.",
					);
			}
			if (
				ports.getProjectId() !== request.ownerProjectId ||
				ports.getCurrentPath() !== activePath
			)
				throw new Error("The active project changed while choosing a file.");
			if (ports.isBusy()) throw new Error("Finish recording before changing project files.");
			if (ports.validateMedia) {
				const media: string[] = [];
				visitTimelineMediaPaths(project, (file) => media.push(file));
				for (const file of media)
					if (!(await ports.validateMedia(file)))
						throw new Error("Project media path is not approved.");
			}
			project.title = projectTitleFromPath(target);
			let cleanupWarning: string | undefined;
			const staging = await fs.mkdtemp(path.join(os.tmpdir(), "captr-save-v3-"));
			try {
				await stageTimelineProject(project, staging);
				if (request.thumbnailDataUrl?.startsWith("data:image/png;base64,"))
					await fs.writeFile(
						path.join(staging, "thumbnail.png"),
						Buffer.from(request.thumbnailDataUrl.split(",")[1], "base64"),
					);
				if (
					ports.isBusy() ||
					ports.getProjectId() !== request.ownerProjectId ||
					ports.getCurrentPath() !== activePath
				)
					throw new Error("Project activity changed before file publication.");
				if (request.intent === "rename") {
					const renamed = await renameProjectBundle(
						{
							operationId,
							originalPath: request.expectedPath!,
							destinationPath: target,
							projectId: project.projectId,
							writeCandidate: (candidate) => packProjectWorkspace(staging, candidate),
						},
						{ journalDir: ports.journalDir },
					);
					if (renamed.warning) cleanupWarning = renamed.warning;
				} else await packProjectWorkspace(staging, target);
			} finally {
				if (path.dirname(path.resolve(staging)) !== path.resolve(os.tmpdir()))
					throw new Error("Unsafe project staging cleanup.");
				await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined);
			}
			ports.commit(target, project.projectId);
			let warning: string | undefined = cleanupWarning;
			try {
				await ports.remember(
					target,
					request.intent === "rename" ? (request.expectedPath ?? undefined) : undefined,
				);
			} catch (error) {
				warning = `Project saved, but the Home list needs a refresh: ${String(error)}`;
			}
			return {
				success: true,
				operationId,
				generation: request.generation,
				revision: request.revision,
				path: target,
				projectId: project.projectId,
				title: project.title,
				warning,
			};
		} catch (error) {
			return { success: false, operationId, error: String(error) };
		}
	});
}
