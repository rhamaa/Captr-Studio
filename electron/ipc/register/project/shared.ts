import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PROJECT_FILE_EXTENSION } from "../../constants";
import { parseJsonWithByteOrderMark } from "../../utils";
export function normalizeRecordingTimeOffsetMs(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
}

export function normalizeBoolean(value: unknown, fallback = false): boolean {
	return typeof value === "boolean" ? value : fallback;
}

/**
 * Produces a filesystem-safe project base name without the project extension.
 */
export function normalizeProjectSaveName(projectName?: string | null) {
	if (typeof projectName !== "string") {
		return null;
	}

	const trimmedName = projectName.trim();
	if (!trimmedName) {
		return null;
	}

	const withoutExtension = trimmedName.replace(
		new RegExp(`\\.${PROJECT_FILE_EXTENSION}$`, "i"),
		"",
	);
	const withoutInvalidFilesystemChars = withoutExtension.replace(/[<>:"/\\|?*]/g, "");
	const withoutControlChars = Array.from(withoutInvalidFilesystemChars)
		.filter((character) => character.charCodeAt(0) > 31)
		.join("");
	const sanitizedName = withoutControlChars
		.replace(/\s+/g, " ")
		.replace(/[. ]+$/g, "")
		.trim();

	return sanitizedName || null;
}

/**
 * Extracts the persisted source video path from a saved project payload.
 */
export function getProjectVideoPath(projectData: unknown) {
	if (!projectData || typeof projectData !== "object") {
		return null;
	}

	const candidate = projectData as { videoPath?: unknown; clips?: unknown };
	if (typeof candidate.videoPath === "string" && candidate.videoPath) {
		return candidate.videoPath;
	}
	if (Array.isArray(candidate.clips) && candidate.clips.length > 0) {
		const firstClip = candidate.clips[0] as { videoPath?: unknown };
		if (typeof firstClip?.videoPath === "string" && firstClip.videoPath) {
			return firstClip.videoPath;
		}
	}
	return null;
}

export function getProjectId(projectData: unknown) {
	if (!projectData || typeof projectData !== "object") {
		return null;
	}

	const candidate = projectData as { projectId?: unknown };
	return typeof candidate.projectId === "string" && candidate.projectId.trim().length > 0
		? candidate.projectId
		: null;
}

export function withProjectId(projectData: unknown, projectId: string) {
	if (!projectData || typeof projectData !== "object" || Array.isArray(projectData)) {
		return projectData;
	}

	return {
		...projectData,
		projectId,
	};
}

export function ensureProjectDataHasProjectId(projectData: unknown): {
	projectId: string;
	projectData: Record<string, unknown>;
} {
	const safeData =
		projectData && typeof projectData === "object" && !Array.isArray(projectData)
			? (projectData as Record<string, unknown>)
			: {};
	const existingProjectId = getProjectId(safeData);
	if (existingProjectId) {
		return {
			projectId: existingProjectId,
			projectData: safeData,
		};
	}

	const projectId = randomUUID();
	return {
		projectId,
		projectData: withProjectId(safeData, projectId) as Record<string, unknown>,
	};
}

export async function resolveComparablePath(filePath: string) {
	return fs.realpath(filePath).catch(() => path.resolve(filePath));
}

/**
 * Prevents a named save from silently overwriting a different project file.
 */
export async function ensureNamedProjectSaveDoesNotOverwriteDifferentProject(
	targetProjectPath: string,
	projectData: unknown,
	activeProjectPath?: string | null,
) {
	try {
		await fs.stat(targetProjectPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
			return { success: true };
		}
		throw error;
	}

	const targetResolvedPath = await resolveComparablePath(targetProjectPath);
	if (activeProjectPath) {
		const activeResolvedPath = await resolveComparablePath(activeProjectPath);
		if (activeResolvedPath === targetResolvedPath) {
			return { success: true };
		}
	}

	const incomingProjectId = getProjectId(projectData);
	const incomingVideoPath = getProjectVideoPath(projectData);

	try {
		const existingProjectRaw = await fs.readFile(targetProjectPath, "utf-8");
		const existingProjectData = parseJsonWithByteOrderMark(existingProjectRaw);
		const existingProjectId = getProjectId(existingProjectData);
		const existingVideoPath = getProjectVideoPath(existingProjectData);

		if (existingProjectId && incomingProjectId) {
			if (existingProjectId === incomingProjectId) {
				return { success: true };
			}

			return {
				success: false,
				message: "A different project already uses this name",
			};
		}

		if (existingVideoPath && incomingVideoPath && existingVideoPath !== incomingVideoPath) {
			return {
				success: false,
				message: "A different project already uses this name",
			};
		}

		if (!existingProjectId && !incomingProjectId && existingVideoPath && incomingVideoPath) {
			return {
				success: false,
				message: "Unable to verify project identity for the chosen name",
			};
		}

		return {
			success: false,
			message: "Unable to verify project identity for the chosen name",
		};
	} catch (error) {
		console.error("Failed to verify existing named project before overwrite:", error);
		return {
			success: false,
			message: "Unable to verify project identity for the chosen name",
		};
	}
}
