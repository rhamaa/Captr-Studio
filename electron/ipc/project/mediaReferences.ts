import fs from "node:fs/promises";
import path from "node:path";

type DataObject = Record<string, unknown>;

function object(value: unknown): DataObject {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as DataObject)
		: {};
}

function objects(value: unknown): DataObject[] {
	return Array.isArray(value) ? value.map(object) : [];
}

export interface ProjectMediaReference {
	/** Human-readable location inside the project payload, e.g. `clips[0].videoPath`. */
	location: string;
	/** Referenced media path exactly as serialized. */
	path: string;
}

/** Explicit project media fields shared by loading and recording retention.
 * Do not recursively approve arbitrary strings from a project file.
 */
export function collectProjectMediaRefs(project: unknown): ProjectMediaReference[] {
	const refs: ProjectMediaReference[] = [];
	const push = (location: string, value: unknown) => {
		if (typeof value === "string" && value.trim() && !/^(data|blob|https?):/i.test(value)) {
			refs.push({ location, path: value });
		}
	};
	const collect = (entry: DataObject, prefix: string) => {
		for (const field of [
			"videoPath",
			"webcamPath",
			"microphoneAudioPath",
			"systemAudioPath",
			"cursorTelemetryPath",
		]) {
			push(`${prefix}${field}`, entry[field]);
		}
		const webcamSourcePath = object(entry.webcam).sourcePath;
		if (webcamSourcePath !== undefined) {
			push(`${prefix}webcam.sourcePath`, webcamSourcePath);
		}
		for (const layer of objects(entry.mediaTrackLayers)) {
			push(`${prefix}mediaTrackLayers[].sourcePath`, layer.sourcePath);
		}
		for (const track of objects(entry.audioTracks)) {
			push(`${prefix}audioTracks[].sourcePath`, track.sourcePath);
		}
		for (const region of objects(entry.audioRegions)) {
			push(`${prefix}audioRegions[].audioPath`, region.audioPath);
		}
		for (const region of objects(entry.annotationRegions)) {
			push(`${prefix}annotationRegions[].imageFilePath`, region.imageFilePath);
			push(`${prefix}annotationRegions[].videoFilePath`, region.videoFilePath);
			push(`${prefix}annotationRegions[].gifPath`, region.gifPath);
		}
		for (const asset of objects(entry.assetFiles)) {
			push(`${prefix}assetFiles[].path`, asset.path);
		}
	};
	collect(object(project), "");
	collect(object(object(project).editor), "editor.");
	const clips = objects(object(project).clips);
	clips.forEach((clip, index) => collect(clip, `clips[${index}].`));
	return refs;
}

export function collectProjectMediaPaths(project: unknown): string[] {
	return [...new Set(collectProjectMediaRefs(project).map((ref) => ref.path))];
}

export type ProjectMediaIssueReason = "missing" | "outside-bundle";

export interface ProjectMediaIssue {
	location: string;
	path: string;
	reason: ProjectMediaIssueReason;
}

/**
 * Raised when a .captr bundle is not self-contained — i.e. it references media
 * files that are not stored inside the bundle. A bundle in this state cannot be
 * moved to another device and reopened reliably.
 */
export class ProjectBundleValidationError extends Error {
	readonly issues: ProjectMediaIssue[];

	constructor(message: string, issues: ProjectMediaIssue[]) {
		super(message);
		this.name = "ProjectBundleValidationError";
		this.issues = issues;
	}
}

function isPathInsideWorkspace(candidatePath: string, workspaceDir: string): boolean {
	const normalizedCandidate = path.resolve(candidatePath);
	const normalizedWorkspace = path.resolve(workspaceDir);
	const relative = path.relative(
		process.platform === "win32"
			? normalizedWorkspace.toLowerCase()
			: normalizedWorkspace,
		process.platform === "win32"
			? normalizedCandidate.toLowerCase()
			: normalizedCandidate,
	);
	return !relative.startsWith("..") && !path.isAbsolute(relative);
}

/**
 * Validates that every media file referenced by a loaded project exists inside
 * the project workspace (the unpacked .captr bundle). This is the guarantee that
 * moving a single .captr file to another device keeps the project fully usable.
 *
 * Returns one issue per reference that is either missing from the workspace or
 * points outside it (an external path that would break on another device).
 */
export async function findProjectMediaIssues(
	project: unknown,
	workspaceDir: string,
): Promise<ProjectMediaIssue[]> {
	const issues: ProjectMediaIssue[] = [];

	for (const ref of collectProjectMediaRefs(project)) {
		const resolved = path.isAbsolute(ref.path)
			? path.resolve(ref.path)
			: path.resolve(workspaceDir, ref.path);

		if (!isPathInsideWorkspace(resolved, workspaceDir)) {
			issues.push({ location: ref.location, path: ref.path, reason: "outside-bundle" });
			continue;
		}

		try {
			await fs.access(resolved);
		} catch {
			issues.push({ location: ref.location, path: ref.path, reason: "missing" });
		}
	}

	return issues;
}

/**
 * Asserts a loaded project is fully self-contained inside its workspace.
 * Throws {@link ProjectBundleValidationError} with a detailed message when any
 * referenced media file is missing from, or lives outside, the bundle.
 */
export async function assertProjectMediaInsideBundle(
	project: unknown,
	workspaceDir: string,
): Promise<void> {
	const issues = await findProjectMediaIssues(project, workspaceDir);
	if (issues.length === 0) {
		return;
	}

	const lines = issues
		.slice(0, 10)
		.map(
			(issue) =>
				`- ${issue.location}: ${issue.path} (${
					issue.reason === "missing" ? "missing from bundle" : "stored outside the bundle"
				})`,
		);
	const omitted = issues.length > lines.length ? `\n- ...and ${issues.length - lines.length} more` : "";

	throw new ProjectBundleValidationError(
		`Project bundle is not self-contained: ${issues.length} referenced media file(s) ` +
			`are missing from or stored outside the bundle. The project cannot be moved to ` +
			`another device in this state:\n${lines.join("\n")}${omitted}`,
		issues,
	);
}


export function getProjectPrimaryMedia(project: unknown) {
	const root = object(project);
	const firstClip = objects(root.clips).find(
		(clip) => typeof clip.videoPath === "string" && clip.videoPath.trim(),
	);
	const videoPath =
		typeof root.videoPath === "string" && root.videoPath.trim()
			? root.videoPath
			: typeof firstClip?.videoPath === "string"
				? firstClip.videoPath
				: null;
	const webcam = object(object(root.editor).webcam).sourcePath;
	const webcamPath =
		typeof webcam === "string" && webcam.trim()
			? webcam
			: typeof firstClip?.webcamPath === "string"
				? firstClip.webcamPath
				: null;
	return { videoPath, webcamPath };
}
