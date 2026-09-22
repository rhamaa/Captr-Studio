import fs from "node:fs/promises";
import path from "node:path";
import { BrowserWindow, ipcMain } from "electron";
import {
	isPathInsideDirectory,
	rememberApprovedLocalReadPath,
	replaceApprovedSessionLocalReadPaths,
} from "../../project/manager";
import { persistRecordingSessionManifest, resolveRecordingSession } from "../../project/session";
import {
	currentRecordingSession,
	currentVideoPath,
	setCurrentProjectPath,
	setCurrentRecordingSession,
	setCurrentVideoPath,
} from "../../state";
import {
	approveUserPath,
	getRecordingsDir,
	getTelemetryPathForVideo,
	isAutoRecordingPath,
	normalizeVideoSourcePath,
} from "../../utils";
import { normalizeBoolean, normalizeRecordingTimeOffsetMs } from "./shared";

export function registerProjectSessionHandlers() {
	ipcMain.handle(
		"set-current-video-path",
		async (
			_,
			path: string,
			options?: { preserveProjectPath?: boolean; hideOverlayCursorByDefault?: boolean },
		) => {
			setCurrentVideoPath(normalizeVideoSourcePath(path) ?? path);
			approveUserPath(currentVideoPath);
			const resolvedSession = (await resolveRecordingSession(currentVideoPath)) ?? {
				videoPath: currentVideoPath!,
				webcamPath: null,
				timeOffsetMs: 0,
			};

			const nextSession = {
				...resolvedSession,
				hideOverlayCursorByDefault:
					normalizeBoolean(options?.hideOverlayCursorByDefault) ||
					normalizeBoolean(resolvedSession.hideOverlayCursorByDefault),
			};

			setCurrentRecordingSession(nextSession);
			await replaceApprovedSessionLocalReadPaths(
				[resolvedSession.videoPath, resolvedSession.webcamPath],
				options?.preserveProjectPath,
			);

			if (nextSession.webcamPath) {
				await persistRecordingSessionManifest(nextSession);
			}

			if (!options?.preserveProjectPath) {
				setCurrentProjectPath(null);
			}

			for (const window of BrowserWindow.getAllWindows()) {
				if (!window.isDestroyed()) {
					window.webContents.send("recording-session-changed", nextSession);
				}
			}

			return { success: true, webcamPath: nextSession.webcamPath ?? null };
		},
	);

	ipcMain.handle(
		"set-current-recording-session",
		async (
			_,
			session: {
				videoPath: string;
				webcamPath?: string | null;
				timeOffsetMs?: number;
				hideOverlayCursorByDefault?: boolean;
			},
			options?: { preserveProjectPath?: boolean },
		) => {
			const normalizedVideoPath =
				normalizeVideoSourcePath(session.videoPath) ?? session.videoPath;
			setCurrentVideoPath(normalizedVideoPath);
			setCurrentRecordingSession({
				videoPath: normalizedVideoPath,
				webcamPath: normalizeVideoSourcePath(session.webcamPath ?? null),
				timeOffsetMs: normalizeRecordingTimeOffsetMs(session.timeOffsetMs),
				hideOverlayCursorByDefault: normalizeBoolean(session.hideOverlayCursorByDefault),
			});
			await rememberApprovedLocalReadPath(currentRecordingSession!.videoPath);
			await rememberApprovedLocalReadPath(currentRecordingSession!.webcamPath);
			if (!options?.preserveProjectPath) {
				setCurrentProjectPath(null);
			}
			await persistRecordingSessionManifest(currentRecordingSession!);

			for (const window of BrowserWindow.getAllWindows()) {
				if (!window.isDestroyed()) {
					window.webContents.send("recording-session-changed", currentRecordingSession);
				}
			}

			return { success: true };
		},
	);

	ipcMain.handle("get-current-recording-session", () => {
		if (!currentRecordingSession) {
			return { success: false };
		}

		return {
			success: true,
			session: currentRecordingSession,
		};
	});

	ipcMain.handle("get-current-video-path", () => {
		return currentVideoPath ? { success: true, path: currentVideoPath } : { success: false };
	});

	ipcMain.handle("clear-current-video-path", () => {
		setCurrentVideoPath(null);
		setCurrentRecordingSession(null);
		return { success: true };
	});

	ipcMain.handle("delete-recording-file", async (_, filePath: string) => {
		try {
			if (!filePath) {
				return { success: false, error: "Only auto-generated recordings can be deleted" };
			}
			const resolvedPath = await fs.realpath(filePath).catch(() => path.resolve(filePath));
			const recordingsDirRaw = await getRecordingsDir();
			const recordingsDir = await fs
				.realpath(recordingsDirRaw)
				.catch(() => path.resolve(recordingsDirRaw));
			if (
				!isPathInsideDirectory(resolvedPath, recordingsDir) ||
				!isAutoRecordingPath(resolvedPath)
			) {
				return { success: false, error: "Only auto-generated recordings can be deleted" };
			}
			await fs.unlink(resolvedPath);
			// Also delete the cursor telemetry sidecar if it exists
			const telemetryPath = getTelemetryPathForVideo(resolvedPath);
			await fs.unlink(telemetryPath).catch(() => undefined);
			const currentResolved = currentVideoPath
				? await fs.realpath(currentVideoPath).catch(() => currentVideoPath)
				: null;
			if (currentResolved === resolvedPath) {
				setCurrentVideoPath(null);
				setCurrentRecordingSession(null);
			}
			return { success: true };
		} catch (error) {
			return { success: false, error: String(error) };
		}
	});
}
