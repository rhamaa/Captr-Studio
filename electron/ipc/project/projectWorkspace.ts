import fs from "node:fs/promises";
import path from "node:path";
import { USER_DATA_PATH } from "../../appPaths";
import { COMPANION_AUDIO_LAYOUTS } from "../constants";
import { normalizePath } from "../utils";

export const WORKSPACES_DIR_NAME = "workspaces";

export function getWorkspacesRoot(): string {
	return path.join(USER_DATA_PATH, WORKSPACES_DIR_NAME);
}

export function getProjectWorkspaceDir(projectId: string): string {
	// Sanitize projectId for filesystem safety
	const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
	return path.join(getWorkspacesRoot(), safeId);
}

export async function ensureProjectWorkspace(projectId: string): Promise<string> {
	const workspaceDir = getProjectWorkspaceDir(projectId);
	await fs.mkdir(path.join(workspaceDir, "slides"), { recursive: true });
	return workspaceDir;
}

export function getSlideDir(workspaceDir: string, slideId: string): string {
	const safeSlideId = slideId.replace(/[^a-zA-Z0-9_-]/g, "_");
	return path.join(workspaceDir, "slides", safeSlideId);
}

export async function ensureSlideDir(workspaceDir: string, slideId: string): Promise<string> {
	const slideDir = getSlideDir(workspaceDir, slideId);
	await fs.mkdir(slideDir, { recursive: true });
	return slideDir;
}

export function getSlideAssetsDir(
	workspaceDir: string,
	slideId: string,
	subfolder?: string,
): string {
	const slideDir = getSlideDir(workspaceDir, slideId);
	if (subfolder && subfolder.trim().length > 0) {
		const safeSubfolder = subfolder.trim().replace(/[^a-zA-Z0-9_\- &]/g, "_");
		return path.join(slideDir, "assets", safeSubfolder);
	}
	return path.join(slideDir, "assets");
}

export async function ensureSlideAssetsDir(
	workspaceDir: string,
	slideId: string,
	subfolder?: string,
): Promise<string> {
	const assetsDir = getSlideAssetsDir(workspaceDir, slideId, subfolder);
	await fs.mkdir(assetsDir, { recursive: true });
	return assetsDir;
}

/**
 * Copies an external media file into the dedicated assets directory for the specified slide.
 * Returns both the absolute local path (for immediate UI playback) and the bundle-relative path (for serialization).
 */
export async function copyAssetToSlideWorkspace(
	workspaceDir: string,
	slideId: string,
	sourceFilePath: string,
	subfolder?: string,
): Promise<{ absolutePath: string; bundleRelativePath: string; fileName: string; size: number }> {
	const assetsDir = await ensureSlideAssetsDir(workspaceDir, slideId, subfolder);

	const parsed = path.parse(sourceFilePath);
	const baseName = parsed.name.replace(/[^a-zA-Z0-9_\-. ]/g, "_");
	const ext = parsed.ext.toLowerCase();

	let fileName = `${baseName}${ext}`;
	let targetPath = path.join(assetsDir, fileName);

	// Avoid overwriting existing files with the same name by adding a timestamp suffix
	try {
		await fs.access(targetPath);
		fileName = `${baseName}-${Date.now().toString(36)}${ext}`;
		targetPath = path.join(assetsDir, fileName);
	} catch {
		// Target does not exist, can use fileName
	}

	await fs.copyFile(sourceFilePath, targetPath);
	const stats = await fs.stat(targetPath);

	const normWorkspace = normalizePath(workspaceDir);
	let bundleRelativePath = normalizePath(targetPath);
	if (bundleRelativePath.toLowerCase().startsWith(normWorkspace.toLowerCase())) {
		bundleRelativePath = bundleRelativePath.slice(normWorkspace.length);
		bundleRelativePath = bundleRelativePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
	}

	return {
		absolutePath: normalizePath(targetPath),
		bundleRelativePath,
		fileName,
		size: stats.size,
	};
}

/**
 * Moves or copies a recording file directly into the slide's directory (e.g. main.mp4, webcam.mp4, cursor.json).
 */
export async function assignRecordingToSlide(
	workspaceDir: string,
	slideId: string,
	sourcePath: string,
	kind: "main" | "webcam" | "cursor",
): Promise<{ absolutePath: string; bundleRelativePath: string }> {
	const slideDir = await ensureSlideDir(workspaceDir, slideId);
	const ext = path.extname(sourcePath).toLowerCase();

	const fileName =
		kind === "cursor" ? "cursor.json" : kind === "webcam" ? `webcam${ext}` : `main${ext}`;
	const targetPath = path.join(slideDir, fileName);

	try {
		await fs.copyFile(sourcePath, targetPath);
	} catch (error) {
		throw new Error(
			`Failed to assign recording to slide ${slideId}: ${error instanceof Error ? error.message : String(error)}`,
		);
	}

	const normWorkspace = normalizePath(workspaceDir);
	let bundleRelativePath = normalizePath(targetPath);
	if (bundleRelativePath.toLowerCase().startsWith(normWorkspace.toLowerCase())) {
		bundleRelativePath = bundleRelativePath.slice(normWorkspace.length);
		bundleRelativePath = bundleRelativePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
	}

	return {
		absolutePath: normalizePath(targetPath),
		bundleRelativePath,
	};
}

/**
 * Stages companion sidecar audio (microphone / system) for a recording into the
 * project workspace so it is included when the workspace is packed into a
 * .captr bundle.
 *
 * Fresh recordings keep sidecar audio next to the source video inside the
 * recordings directory (e.g. `recording-1.mic.wav` next to `recording-1.mp4`)
 * and the editor discovers them by deriving sidecar names from the video path.
 * When the video is staged into the workspace as `slides/<id>/main.mp4`, the
 * sidecars must be copied next to it (`slides/<id>/main.mic.wav`, etc.) —
 * otherwise they are silently dropped from the bundle and audio is lost when
 * the project is reopened.
 *
 * Also copies the optional timing metadata file (`<sidecar>.json`) used for
 * companion audio start-delay alignment.
 *
 * Returns the workspace-absolute paths of the staged sidecars (null when the
 * recording has no usable sidecar of that kind).
 */
export async function stageCompanionAudioForRecording(
	sourceVideoPath: string,
	stagedVideoPath: string,
): Promise<{ microphoneAudioPath: string | null; systemAudioPath: string | null }> {
	const stripExtension = (filePath: string) => filePath.replace(/\.[^.]+$/u, "");
	const sourceBase = stripExtension(sourceVideoPath);
	const stagedBase = stripExtension(stagedVideoPath);

	const stageOne = async (suffix: string): Promise<string | null> => {
		const targetPath = `${stagedBase}${suffix}`;

		// Sidecar already staged next to the workspace video — reuse it.
		try {
			const stat = await fs.stat(targetPath);
			if (stat.size > 0) {
				return normalizePath(targetPath);
			}
		} catch {
			// Not staged yet; fall through to copy from the source recording.
		}

		const sourceCandidate = `${sourceBase}${suffix}`;
		try {
			const stat = await fs.stat(sourceCandidate);
			if (stat.size <= 0) {
				return null;
			}
			await fs.mkdir(path.dirname(targetPath), { recursive: true });
			await fs.copyFile(sourceCandidate, targetPath);
		} catch {
			// Recording has no usable sidecar of this kind.
			return null;
		}

		// Companion timing metadata is optional but required for accurate
		// start-delay alignment when present (e.g. `recording-1.mic.wav.json`).
		try {
			await fs.copyFile(`${sourceCandidate}.json`, `${targetPath}.json`);
		} catch {
			// Metadata is optional.
		}

		return normalizePath(targetPath);
	};

	let microphoneAudioPath: string | null = null;
	let systemAudioPath: string | null = null;

	for (const layout of COMPANION_AUDIO_LAYOUTS) {
		if (!systemAudioPath) {
			systemAudioPath = await stageOne(layout.systemSuffix);
		}
		if (!microphoneAudioPath) {
			microphoneAudioPath = await stageOne(layout.micSuffix);
		}
	}

	return { microphoneAudioPath, systemAudioPath };
}

/**
 * Maps every path-like media field inside a project entry (root project,
 * editor state, or clip) using the supplied mapper. Covers the fields shared
 * with `collectProjectMediaRefs` so serialization stays in sync with loading
 * and validation. Non-path values (data URLs, blob and http(s) URLs) are left
 * untouched.
 */
const PATH_LIKE_ENTRY_FIELDS = [
	"videoPath",
	"webcamPath",
	"microphoneAudioPath",
	"systemAudioPath",
	"cursorTelemetryPath",
] as const;

const PATH_LIKE_ITEM_FIELDS = [
	"sourcePath",
	"audioPath",
	"imageFilePath",
	"videoFilePath",
	"gifPath",
	"path",
	"customImagePath",
] as const;

const PATH_LIKE_COLLECTION_FIELDS = [
	"mediaTrackLayers",
	"audioTracks",
	"audioRegions",
	"annotationRegions",
	"assetFiles",
] as const;

function isNonFilePathValue(value: string): boolean {
	return /^(data|blob|https?):/i.test(value);
}

function mapEntryMediaPaths(
	entry: unknown,
	mapPath: (value: string) => string,
): void {
	if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
		return;
	}
	const record = entry as Record<string, unknown>;

	for (const field of PATH_LIKE_ENTRY_FIELDS) {
		const value = record[field];
		if (typeof value === "string" && value && !isNonFilePathValue(value)) {
			record[field] = mapPath(value);
		}
	}

	const webcam = record.webcam;
	if (webcam && typeof webcam === "object" && !Array.isArray(webcam)) {
		const webcamRecord = webcam as Record<string, unknown>;
		const sourcePath = webcamRecord.sourcePath;
		if (typeof sourcePath === "string" && sourcePath && !isNonFilePathValue(sourcePath)) {
			webcamRecord.sourcePath = mapPath(sourcePath);
		}
	}

	for (const collectionField of PATH_LIKE_COLLECTION_FIELDS) {
		const items = record[collectionField];
		if (!Array.isArray(items)) {
			continue;
		}
		for (const item of items) {
			if (!item || typeof item !== "object" || Array.isArray(item)) {
				continue;
			}
			const itemRecord = item as Record<string, unknown>;
			for (const field of PATH_LIKE_ITEM_FIELDS) {
				const value = itemRecord[field];
				if (typeof value === "string" && value && !isNonFilePathValue(value)) {
					itemRecord[field] = mapPath(value);
				}
			}
		}
	}
}

/**
 * Converts all absolute paths inside a project data object into bundle-relative paths for serialization.
 */
export function convertProjectToBundleRelative(
	projectData: Record<string, unknown>,
	workspaceDir: string,
): Record<string, unknown> {
	if (!projectData || typeof projectData !== "object") {
		return projectData;
	}

	const cloned = JSON.parse(JSON.stringify(projectData));
	const normWorkspace = normalizePath(workspaceDir).toLowerCase();

	const toRelative = (value: string): string => {
		const normVal = normalizePath(value);
		if (normVal.toLowerCase().startsWith(normWorkspace)) {
			let rel = normVal.slice(normWorkspace.length);
			rel = rel.replace(/^[/\\]+/, "").replace(/\\/g, "/");
			return rel;
		}
		return value;
	};

	mapEntryMediaPaths(cloned, toRelative);
	mapEntryMediaPaths(cloned.editor, toRelative);
	if (Array.isArray(cloned.clips)) {
		for (const clip of cloned.clips) {
			mapEntryMediaPaths(clip, toRelative);
		}
	}

	return cloned;
}

/**
 * Converts all bundle-relative paths inside a deserialized project data object into absolute workspace paths.
 */
export function convertProjectToWorkspaceAbsolute(
	projectData: Record<string, unknown>,
	workspaceDir: string,
): Record<string, unknown> {
	if (!projectData || typeof projectData !== "object") {
		return projectData;
	}

	const cloned = JSON.parse(JSON.stringify(projectData));

	const toAbsolute = (value: string): string => {
		// If it's already an absolute path (legacy project or external file), leave it
		if (path.isAbsolute(value) || /^[a-zA-Z]:[/\\]/.test(value)) {
			return normalizePath(value);
		}
		// Otherwise resolve relative to workspaceDir
		return normalizePath(path.resolve(workspaceDir, value));
	};

	mapEntryMediaPaths(cloned, toAbsolute);
	mapEntryMediaPaths(cloned.editor, toAbsolute);
	if (Array.isArray(cloned.clips)) {
		for (const clip of cloned.clips) {
			mapEntryMediaPaths(clip, toAbsolute);
		}
	}

	return cloned;
}
