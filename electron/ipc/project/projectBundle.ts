import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { ZipArchive } from "archiver";
import yauzl from "yauzl";

/**
 * Checks if a file is a valid ZIP archive bundle by inspecting the first 4 magic bytes ('PK\x03\x04').
 */
export async function isProjectBundle(filePath: string): Promise<boolean> {
	try {
		const fd = await fs.open(filePath, "r");
		const buffer = Buffer.alloc(4);
		const { bytesRead } = await fd.read(buffer, 0, 4, 0);
		await fd.close();
		if (bytesRead < 4) return false;
		return (
			buffer[0] === 0x50 && // 'P'
			buffer[1] === 0x4b && // 'K'
			buffer[2] === 0x03 &&
			buffer[3] === 0x04
		);
	} catch {
		return false;
	}
}

/**
 * Packs the contents of a project workspace directory into a single .captr ZIP bundle.
 * Media files (mp4, webm, m4a, wav, png, jpg) are stored without re-compression (STORE)
 * for near-instant saving of large video projects.
 */
export async function packProjectWorkspace(
	workspaceDir: string,
	targetCaptrPath: string,
): Promise<void> {
	await fs.mkdir(path.dirname(targetCaptrPath), { recursive: true });

	const tempTargetPath = `${targetCaptrPath}.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const outputStream = createWriteStream(tempTargetPath);

	const archive = new ZipArchive({
		// Level 0 (store) for fast throughput with already compressed media
		store: true,
	});

	await new Promise<void>((resolve, reject) => {
		outputStream.on("close", resolve);
		archive.on("error", reject);
		outputStream.on("error", reject);

		archive.pipe(outputStream);
		// Add all files and subdirectories from workspaceDir into the root of the archive
		archive.directory(workspaceDir, false);
		archive.finalize();
	});

	// Atomically replace targetCaptrPath
	await fs.rename(tempTargetPath, targetCaptrPath).catch(async (renameError) => {
		// Fallback for cross-device renames or Windows lock delays
		try {
			await fs.copyFile(tempTargetPath, targetCaptrPath);
			await fs.unlink(tempTargetPath).catch(() => undefined);
		} catch {
			throw renameError;
		}
	});
}

/**
 * Unpacks a .captr ZIP bundle into the specified target workspace directory.
 * Includes zip-slip path traversal protection.
 */
export async function unpackProjectBundle(
	captrPath: string,
	targetWorkspaceDir: string,
): Promise<void> {
	await fs.mkdir(targetWorkspaceDir, { recursive: true });

	return new Promise<void>((resolve, reject) => {
		yauzl.open(captrPath, { lazyEntries: true }, (openErr, zipfile) => {
			if (openErr) {
				return reject(openErr);
			}
			if (!zipfile) {
				return reject(new Error("Failed to open project bundle"));
			}

			zipfile.on("error", reject);
			zipfile.readEntry();

			zipfile.on("entry", async (entry: yauzl.Entry) => {
				try {
					// Normalize path separators and guard against Zip Slip
					const rawName = entry.fileName.replace(/\\/g, "/");
					const targetPath = path.resolve(targetWorkspaceDir, rawName);

					// Ensure target is strictly inside targetWorkspaceDir
					const relative = path.relative(targetWorkspaceDir, targetPath);
					if (relative.startsWith("..") || path.isAbsolute(relative)) {
						return reject(
							new Error(
								`Invalid entry in project bundle (path traversal): ${entry.fileName}`,
							),
						);
					}

					// Directory entry
					if (rawName.endsWith("/")) {
						await fs.mkdir(targetPath, { recursive: true });
						zipfile.readEntry();
						return;
					}

					// File entry: ensure parent directory exists
					await fs.mkdir(path.dirname(targetPath), { recursive: true });

					zipfile.openReadStream(entry, async (streamErr, readStream) => {
						if (streamErr) {
							return reject(streamErr);
						}
						if (!readStream) {
							return reject(
								new Error(`Failed to read entry stream: ${entry.fileName}`),
							);
						}

						try {
							const writeStream = createWriteStream(targetPath);
							await pipeline(readStream, writeStream);
							zipfile.readEntry();
						} catch (writeErr) {
							reject(writeErr);
						}
					});
				} catch (processErr) {
					reject(processErr);
				}
			});

			zipfile.on("end", () => {
				resolve();
			});
		});
	});
}

export interface ProjectInspectionEntry {
	path: string;
	size: number;
	compressedSize: number;
	isDirectory: boolean;
	slideId?: string;
	category: "config" | "thumbnail" | "video" | "audio" | "graphic" | "telemetry" | "other";
}

export interface ProjectInspectionResult {
	success: boolean;
	filePath: string;
	fileName: string;
	fileSize: number;
	lastModified: number;
	isBundle: boolean;
	thumbnailDataUrl?: string | null;
	projectData?: any;
	entries: ProjectInspectionEntry[];
	error?: string;
}

function categorizeEntry(relativePath: string): {
	category: ProjectInspectionEntry["category"];
	slideId?: string;
} {
	const norm = relativePath.replace(/\\/g, "/");
	const slideMatch = norm.match(/^slides\/([^/]+)\/(.+)$/);
	const slideId = slideMatch ? slideMatch[1] : undefined;
	const ext = path.extname(norm).toLowerCase();

	if (norm === "project.json") {
		return { category: "config", slideId };
	}
	if (norm === "thumbnail.png" || norm.endsWith(".thumb.png")) {
		return { category: "thumbnail", slideId };
	}
	if ([".mp4", ".webm", ".mov", ".mkv"].includes(ext)) {
		return { category: "video", slideId };
	}
	if ([".mp3", ".wav", ".m4a", ".aac", ".ogg"].includes(ext)) {
		return { category: "audio", slideId };
	}
	if ([".png", ".jpg", ".jpeg", ".svg", ".gif", ".webp"].includes(ext)) {
		return { category: "graphic", slideId };
	}
	if (norm.endsWith("telemetry.json") || norm.endsWith("cursor.json")) {
		return { category: "telemetry", slideId };
	}

	return { category: "other", slideId };
}

function readEntryToBuffer(zipfile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		zipfile.openReadStream(entry, (err, stream) => {
			if (err) return reject(err);
			if (!stream) return reject(new Error(`Stream not available for ${entry.fileName}`));
			const chunks: Buffer[] = [];
			stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
			stream.on("end", () => resolve(Buffer.concat(chunks)));
			stream.on("error", reject);
		});
	});
}

/**
 * Inspects a .captr project file (ZIP bundle or legacy JSON) without extracting
 * large media assets onto disk. Returns metadata, file entry breakdown, and project configuration.
 */
export async function inspectProjectBundle(captrPath: string): Promise<ProjectInspectionResult> {
	try {
		const stat = await fs.stat(captrPath);
		const fileName = path.basename(captrPath);
		const isBundle = await isProjectBundle(captrPath);

		if (isBundle) {
			return await new Promise<ProjectInspectionResult>((resolve) => {
				yauzl.open(captrPath, { lazyEntries: true }, (openErr, zipfile) => {
					if (openErr || !zipfile) {
						return resolve({
							success: false,
							filePath: captrPath,
							fileName,
							fileSize: stat.size,
							lastModified: stat.mtimeMs,
							isBundle: true,
							entries: [],
							error: openErr ? String(openErr) : "Failed to open project bundle",
						});
					}

					const entries: ProjectInspectionEntry[] = [];
					let projectData: any = null;
					let thumbnailDataUrl: string | null = null;

					zipfile.on("error", (err) => {
						resolve({
							success: false,
							filePath: captrPath,
							fileName,
							fileSize: stat.size,
							lastModified: stat.mtimeMs,
							isBundle: true,
							entries,
							projectData,
							thumbnailDataUrl,
							error: String(err),
						});
					});

					zipfile.readEntry();

					zipfile.on("entry", async (entry: yauzl.Entry) => {
						const rawName = entry.fileName.replace(/\\/g, "/");
						const isDir = rawName.endsWith("/");
						const { category, slideId } = categorizeEntry(rawName);

						entries.push({
							path: rawName,
							size: entry.uncompressedSize,
							compressedSize: entry.compressedSize,
							isDirectory: isDir,
							slideId,
							category,
						});

						try {
							if (!isDir && rawName === "project.json") {
								const buf = await readEntryToBuffer(zipfile, entry);
								try {
									projectData = JSON.parse(buf.toString("utf-8"));
								} catch (e) {
									console.warn("Failed to parse project.json inside bundle:", e);
								}
							} else if (!isDir && (rawName === "thumbnail.png" || rawName.endsWith(".thumb.png"))) {
								const buf = await readEntryToBuffer(zipfile, entry);
								thumbnailDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
							}
						} catch (readErr) {
							console.warn(`Failed to inspect entry ${rawName}:`, readErr);
						}

						zipfile.readEntry();
					});

					zipfile.on("end", () => {
						resolve({
							success: true,
							filePath: captrPath,
							fileName,
							fileSize: stat.size,
							lastModified: stat.mtimeMs,
							isBundle: true,
							thumbnailDataUrl,
							projectData,
							entries,
						});
					});
				});
			});
		}

		// Fallback for Legacy JSON .captr
		const rawContent = await fs.readFile(captrPath, "utf-8");
		let legacyData: any = null;
		try {
			legacyData = JSON.parse(rawContent);
		} catch (parseErr) {
			return {
				success: false,
				filePath: captrPath,
				fileName,
				fileSize: stat.size,
				lastModified: stat.mtimeMs,
				isBundle: false,
				entries: [],
				error: `Invalid JSON format: ${String(parseErr)}`,
			};
		}

		const entries: ProjectInspectionEntry[] = [
			{
				path: "project.json",
				size: stat.size,
				compressedSize: stat.size,
				isDirectory: false,
				category: "config",
			},
		];

		// Check for legacy thumbnail sidecar
		let thumbnailDataUrl: string | null = null;
		const sidecarThumb = path.join(path.dirname(captrPath), `.${fileName}.thumb.png`);
		try {
			const thumbBuf = await fs.readFile(sidecarThumb);
			thumbnailDataUrl = `data:image/png;base64,${thumbBuf.toString("base64")}`;
			entries.push({
				path: `.${fileName}.thumb.png`,
				size: thumbBuf.length,
				compressedSize: thumbBuf.length,
				isDirectory: false,
				category: "thumbnail",
			});
		} catch {
			// No sidecar thumbnail
		}

		return {
			success: true,
			filePath: captrPath,
			fileName,
			fileSize: stat.size,
			lastModified: stat.mtimeMs,
			isBundle: false,
			thumbnailDataUrl,
			projectData: legacyData,
			entries,
		};
	} catch (err) {
		return {
			success: false,
			filePath: captrPath,
			fileName: path.basename(captrPath),
			fileSize: 0,
			lastModified: 0,
			isBundle: false,
			entries: [],
			error: String(err),
		};
	}
}
