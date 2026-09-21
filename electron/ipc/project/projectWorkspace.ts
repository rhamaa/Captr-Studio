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

	const toRelative = (val: unknown): string | unknown => {
		if (typeof val !== "string" || !val) return val;
		const normVal = normalizePath(val);
		if (normVal.toLowerCase().startsWith(normWorkspace)) {
			let rel = normVal.slice(normWorkspace.length);
			rel = rel.replace(/^[/\\]+/, "").replace(/\\/g, "/");
			return rel;
		}
		return val;
	};

	if (cloned.videoPath) {
		cloned.videoPath = toRelative(cloned.videoPath);
	}

	if (Array.isArray(cloned.clips)) {
		for (const clip of cloned.clips) {
			if (clip.videoPath) clip.videoPath = toRelative(clip.videoPath);
			if (clip.webcamPath) clip.webcamPath = toRelative(clip.webcamPath);
			if (clip.cursorTelemetryPath)
				clip.cursorTelemetryPath = toRelative(clip.cursorTelemetryPath);
			if (clip.microphoneAudioPath)
				clip.microphoneAudioPath = toRelative(clip.microphoneAudioPath);
			if (clip.systemAudioPath) clip.systemAudioPath = toRelative(clip.systemAudioPath);

			if (Array.isArray(clip.assetFiles)) {
				for (const asset of clip.assetFiles) {
					if (asset.path) asset.path = toRelative(asset.path);
				}
			}

			if (Array.isArray(clip.annotationRegions)) {
				for (const annotation of clip.annotationRegions) {
					if (annotation.sourcePath)
						annotation.sourcePath = toRelative(annotation.sourcePath);
					if (annotation.customImagePath)
						annotation.customImagePath = toRelative(annotation.customImagePath);
				}
			}

			if (Array.isArray(clip.audioRegions)) {
				for (const audio of clip.audioRegions) {
					if (audio.audioPath) audio.audioPath = toRelative(audio.audioPath);
					if (audio.sourcePath) audio.sourcePath = toRelative(audio.sourcePath);
				}
			}
		}
	}

	if (cloned.editor && Array.isArray(cloned.editor.audioRegions)) {
		for (const audio of cloned.editor.audioRegions) {
			if (audio.audioPath) audio.audioPath = toRelative(audio.audioPath);
			if (audio.sourcePath) audio.sourcePath = toRelative(audio.sourcePath);
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

	const toAbsolute = (val: unknown): string | unknown => {
		if (typeof val !== "string" || !val) return val;
		// If it's already an absolute path (legacy project or external file), leave it
		if (path.isAbsolute(val) || /^[a-zA-Z]:[/\\]/.test(val)) {
			return normalizePath(val);
		}
		// Otherwise resolve relative to workspaceDir
		return normalizePath(path.resolve(workspaceDir, val));
	};

	if (cloned.videoPath) {
		cloned.videoPath = toAbsolute(cloned.videoPath);
	}

	if (Array.isArray(cloned.clips)) {
		for (const clip of cloned.clips) {
			if (clip.videoPath) clip.videoPath = toAbsolute(clip.videoPath);
			if (clip.webcamPath) clip.webcamPath = toAbsolute(clip.webcamPath);
			if (clip.cursorTelemetryPath)
				clip.cursorTelemetryPath = toAbsolute(clip.cursorTelemetryPath);
			if (clip.microphoneAudioPath) clip.microphoneAudioPath = toAbsolute(clip.microphoneAudioPath);
			if (clip.systemAudioPath) clip.systemAudioPath = toAbsolute(clip.systemAudioPath);

			if (Array.isArray(clip.assetFiles)) {
				for (const asset of clip.assetFiles) {
					if (asset.path) asset.path = toAbsolute(asset.path);
				}
			}

			if (Array.isArray(clip.annotationRegions)) {
				for (const annotation of clip.annotationRegions) {
					if (annotation.sourcePath)
						annotation.sourcePath = toAbsolute(annotation.sourcePath);
					if (annotation.customImagePath)
						annotation.customImagePath = toAbsolute(annotation.customImagePath);
				}
			}

			if (Array.isArray(clip.audioRegions)) {
				for (const audio of clip.audioRegions) {
					if (audio.audioPath) audio.audioPath = toAbsolute(audio.audioPath);
					if (audio.sourcePath) audio.sourcePath = toAbsolute(audio.sourcePath);
				}
			}
		}
	}

	if (cloned.editor && Array.isArray(cloned.editor.audioRegions)) {
		for (const audio of cloned.editor.audioRegions) {
			if (audio.audioPath) audio.audioPath = toAbsolute(audio.audioPath);
			if (audio.sourcePath) audio.sourcePath = toAbsolute(audio.sourcePath);
		}
	}

	return cloned;
}
