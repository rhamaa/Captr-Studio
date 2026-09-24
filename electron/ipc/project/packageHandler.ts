import fs from "node:fs/promises";
import path from "node:path";
import { normalizePath } from "../utils";
import {
	ensureSlideDir,
	getSlideDir,
} from "./projectWorkspace";

export interface SlideManifestEntry {
	id: string;
	type: string;
	title: string;
	order: number;
	dirName: string;
	durationMs: number;
}

export interface ProjectV2Manifest {
	version: 2;
	projectId: string;
	title: string;
	canvas: {
		width: number;
		height: number;
		fps: number;
		aspectRatio?: string;
	};
	slides: SlideManifestEntry[];
	transitions?: Array<{
		id: string;
		fromSlideId: string;
		toSlideId: string;
		type: string;
		durationMs: number;
	}>;
	globalAudioTracks?: Array<{
		id: string;
		name: string;
		path: string;
		volume: number;
		startMsOffset: number;
		durationMs?: number;
		trimStartMs?: number;
		trimEndMs?: number;
	}>;
	createdAt?: number;
	updatedAt?: number;
}

/**
 * Checks whether a workspace directory represents a V2 modular slide project.
 */
export async function isWorkspaceV2(workspaceDir: string): Promise<boolean> {
	try {
		const projectJsonPath = path.join(workspaceDir, "project.json");
		const raw = await fs.readFile(projectJsonPath, "utf-8");
		const data = JSON.parse(raw);
		return data && (data.version === 2 || (Array.isArray(data.slides) && data.slides.length > 0));
	} catch {
		return false;
	}
}

/**
 * Writes the root project.json manifest for a V2 modular slide project.
 */
export async function writeProjectManifest(
	workspaceDir: string,
	manifest: ProjectV2Manifest,
): Promise<void> {
	await fs.mkdir(workspaceDir, { recursive: true });
	const projectJsonPath = path.join(workspaceDir, "project.json");
	const content = JSON.stringify(
		{
			...manifest,
			version: 2,
			updatedAt: Date.now(),
		},
		null,
		2,
	);
	await fs.writeFile(projectJsonPath, content, "utf-8");
}

/**
 * Reads the root project.json manifest for a V2 modular slide project.
 */
export async function readProjectManifest(
	workspaceDir: string,
): Promise<ProjectV2Manifest | null> {
	try {
		const projectJsonPath = path.join(workspaceDir, "project.json");
		const raw = await fs.readFile(projectJsonPath, "utf-8");
		return JSON.parse(raw) as ProjectV2Manifest;
	} catch {
		return null;
	}
}

/**
 * Saves metadata for a specific slide inside its subfolder `slides/<slideId>/slide.json`.
 */
export async function writeSlideData(
	workspaceDir: string,
	slideId: string,
	slideMeta: Record<string, unknown>,
): Promise<string> {
	const slideDir = await ensureSlideDir(workspaceDir, slideId);
	const slideJsonPath = path.join(slideDir, "slide.json");
	await fs.writeFile(slideJsonPath, JSON.stringify(slideMeta, null, 2), "utf-8");
	return normalizePath(slideJsonPath);
}

/**
 * Reads metadata for a specific slide from `slides/<slideId>/slide.json`.
 */
export async function readSlideData<T = Record<string, unknown>>(
	workspaceDir: string,
	slideId: string,
): Promise<T | null> {
	try {
		const slideDir = getSlideDir(workspaceDir, slideId);
		const slideJsonPath = path.join(slideDir, "slide.json");
		const raw = await fs.readFile(slideJsonPath, "utf-8");
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

/**
 * Lists all slide directories currently existing in the project workspace.
 */
export async function listSlideDirectories(workspaceDir: string): Promise<string[]> {
	try {
		const slidesDir = path.join(workspaceDir, "slides");
		const entries = await fs.readdir(slidesDir, { withFileTypes: true });
		return entries
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);
	} catch {
		return [];
	}
}

/**
 * Removes a slide subfolder and all its assets when a slide is deleted.
 */
export async function removeSlideDirectory(
	workspaceDir: string,
	slideId: string,
): Promise<boolean> {
	try {
		const slideDir = getSlideDir(workspaceDir, slideId);
		await fs.rm(slideDir, { recursive: true, force: true });
		return true;
	} catch (error) {
		console.warn(`[packageHandler] Failed to remove slide dir for ${slideId}:`, error);
		return false;
	}
}
