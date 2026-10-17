import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { app, dialog, ipcMain } from "electron";
import {
	parseRecordingFramePreset,
	type RecordingFramePreset,
	serializeRecordingFramePreset,
} from "../../../src/recording/editor/recordingFramePresets";
import type { RecordingFrameAppearance } from "../../../src/recording/schema";

export type RecordingFramePresetResult<T> =
	| { success: true; value: T }
	| { success: false; error: string };

export type RecordingFramePresetDialogResult<T> =
	| RecordingFramePresetResult<T>
	| { success: true; canceled: true };

const CHANNELS = {
	list: "record-frame-presets:list",
	save: "record-frame-presets:save",
	rename: "record-frame-presets:rename",
	delete: "record-frame-presets:delete",
	import: "record-frame-presets:import",
	export: "record-frame-presets:export",
} as const;

const VALIDATION_MESSAGES = new Set([
	"Invalid frame preset",
	"Unsupported preset schema version",
	"Preset name cannot be empty",
	"Invalid frame appearance",
]);

class PresetLibraryError extends Error {}

let libraryQueue: Promise<void> = Promise.resolve();

function withLibraryLock<T>(operation: () => Promise<T>): Promise<T> {
	const result = libraryQueue.then(operation, operation);
	libraryQueue = result.then(
		() => undefined,
		() => undefined,
	);
	return result;
}

function presetDirectory(): string {
	return path.join(app.getPath("userData"), "record-frame-presets");
}

function isValidPresetId(value: unknown): value is string {
	return (
		typeof value === "string" &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
	);
}

function requirePresetId(value: unknown): asserts value is string {
	if (!isValidPresetId(value)) throw new PresetLibraryError("Invalid preset ID");
}

function publicError(error: unknown, fallback: string): string {
	if (error instanceof PresetLibraryError) return error.message;
	if (error instanceof Error && VALIDATION_MESSAGES.has(error.message)) return error.message;
	return fallback;
}

function resultOf<T>(
	action: () => Promise<T>,
	fallback: string,
): Promise<RecordingFramePresetResult<T>> {
	return action().then(
		(value) => ({ success: true, value }),
		(error: unknown) => ({ success: false, error: publicError(error, fallback) }),
	);
}

function uniqueName(name: string, existing: RecordingFramePreset[], excludedId?: string): string {
	const usedNames = new Set(
		existing
			.filter((preset) => preset.id !== excludedId)
			.map((preset) => preset.name.toLowerCase()),
	);
	if (!usedNames.has(name.toLowerCase())) return name;
	let suffix = 2;
	while (usedNames.has(`${name} (${suffix})`.toLowerCase())) suffix += 1;
	return `${name} (${suffix})`;
}

async function readStoredPresets(): Promise<RecordingFramePreset[]> {
	const directory = presetDirectory();
	await fs.mkdir(directory, { recursive: true });
	const entries = await fs.readdir(directory, { withFileTypes: true });
	const presets: RecordingFramePreset[] = [];
	for (const entry of entries) {
		if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
		const fileId = entry.name.slice(0, -".json".length);
		if (!isValidPresetId(fileId)) continue;
		try {
			const content = await fs.readFile(path.join(directory, entry.name), "utf8");
			const preset = parseRecordingFramePreset(JSON.parse(content));
			if (preset.id !== fileId) throw new Error("Preset file identity mismatch");
			presets.push(preset);
		} catch {
			throw new PresetLibraryError("A saved frame preset could not be read.");
		}
	}
	return presets.sort((left, right) => left.name.localeCompare(right.name));
}

async function writePresetAtomically(preset: RecordingFramePreset): Promise<void> {
	const directory = presetDirectory();
	await fs.mkdir(directory, { recursive: true });
	const targetPath = path.join(directory, `${preset.id}.json`);
	const temporaryPath = path.join(directory, `.${preset.id}.${randomUUID()}.tmp`);
	try {
		await fs.writeFile(temporaryPath, serializeRecordingFramePreset(preset), {
			encoding: "utf8",
			flag: "wx",
		});
		await fs.rename(temporaryPath, targetPath);
	} catch (error) {
		await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
		throw error;
	}
}

async function findPreset(id: string): Promise<RecordingFramePreset> {
	const preset = (await readStoredPresets()).find((entry) => entry.id === id);
	if (!preset) throw new PresetLibraryError("Preset was not found.");
	return preset;
}

function safeExportFilename(name: string): string {
	const normalized = name
		.replace(/[<>:"/\\|?*]/g, "-")
		.split("")
		.map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
		.join("")
		.replace(/[. ]+$/g, "")
		.trim();
	return `${normalized || "Record Frame"} - Record Frame.json`;
}

function handleDialogOperation<T>(
	action: () => Promise<RecordingFramePresetDialogResult<T>>,
	fallback: string,
): Promise<RecordingFramePresetDialogResult<T>> {
	return action().catch((error: unknown) => ({
		success: false,
		error: publicError(error, fallback),
	}));
}

export function registerRecordFramePresetHandlers(): void {
	ipcMain.handle(CHANNELS.list, () =>
		resultOf(() => readStoredPresets(), "Could not load frame presets."),
	);

	ipcMain.handle(CHANNELS.save, (_event, name: unknown, appearance: unknown) =>
		resultOf(
			() =>
				withLibraryLock(async () => {
					const now = new Date().toISOString();
					const candidate = parseRecordingFramePreset({
						schemaVersion: 1,
						id: randomUUID(),
						name,
						createdAt: now,
						updatedAt: now,
						appearance: appearance as RecordingFrameAppearance,
					});
					const existing = await readStoredPresets();
					const preset = parseRecordingFramePreset({
						...candidate,
						name: uniqueName(candidate.name, existing),
					});
					await writePresetAtomically(preset);
					return preset;
				}),
			"Could not save frame preset.",
		),
	);

	ipcMain.handle(CHANNELS.rename, (_event, id: unknown, name: unknown) =>
		resultOf(
			() =>
				withLibraryLock(async () => {
					requirePresetId(id);
					const existing = await readStoredPresets();
					const current = existing.find((preset) => preset.id === id);
					if (!current) throw new PresetLibraryError("Preset was not found.");
					const candidate = parseRecordingFramePreset({
						...current,
						name,
						updatedAt: new Date().toISOString(),
					});
					const renamed = parseRecordingFramePreset({
						...candidate,
						name: uniqueName(candidate.name, existing, id),
					});
					await writePresetAtomically(renamed);
					return renamed;
				}),
			"Could not rename frame preset.",
		),
	);

	ipcMain.handle(CHANNELS.delete, (_event, id: unknown) =>
		resultOf(
			() =>
				withLibraryLock(async () => {
					requirePresetId(id);
					await findPreset(id);
					await fs.rm(path.join(presetDirectory(), `${id}.json`));
					return { id };
				}),
			"Could not delete frame preset.",
		),
	);

	ipcMain.handle(CHANNELS.import, () =>
		handleDialogOperation(async () => {
			const selection = await dialog.showOpenDialog({
				title: "Import Record Frame Preset",
				filters: [{ name: "Record Frame Preset", extensions: ["json"] }],
				properties: ["openFile"],
			});
			const filePath = selection.filePaths[0];
			if (selection.canceled || !filePath) return { success: true, canceled: true };

			let source: RecordingFramePreset;
			try {
				source = parseRecordingFramePreset(JSON.parse(await fs.readFile(filePath, "utf8")));
			} catch (error) {
				if (error instanceof Error && VALIDATION_MESSAGES.has(error.message)) throw error;
				throw new PresetLibraryError(
					"The selected file is not a valid frame preset JSON file.",
				);
			}

			const imported = await withLibraryLock(async () => {
				const existing = await readStoredPresets();
				const now = new Date().toISOString();
				const preset = parseRecordingFramePreset({
					...source,
					id: randomUUID(),
					name: uniqueName(source.name, existing),
					createdAt: now,
					updatedAt: now,
				});
				await writePresetAtomically(preset);
				return preset;
			});
			return { success: true, value: imported };
		}, "Could not import frame preset."),
	);

	ipcMain.handle(CHANNELS.export, (_event, id: unknown) =>
		handleDialogOperation(async () => {
			requirePresetId(id);
			const preset = await findPreset(id);
			const selection = await dialog.showSaveDialog({
				title: "Export Record Frame Preset",
				defaultPath: path.join(app.getPath("documents"), safeExportFilename(preset.name)),
				filters: [{ name: "Record Frame Preset", extensions: ["json"] }],
				properties: ["createDirectory", "showOverwriteConfirmation"],
			});
			if (selection.canceled || !selection.filePath) return { success: true, canceled: true };
			const exportPath = /\.json$/i.test(selection.filePath)
				? selection.filePath
				: `${selection.filePath}.json`;
			await fs.writeFile(exportPath, serializeRecordingFramePreset(preset), "utf8");
			return { success: true, value: { exported: true } };
		}, "Could not export frame preset."),
	);
}
