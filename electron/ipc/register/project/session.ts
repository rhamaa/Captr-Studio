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
	consumePreserveProjectPathForNextNativeRecording,
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
import { clearRecordingProjectContext, getActiveRecordingProjectId, getRecordingProjectContext, setActiveRecordingProjectId } from "../../project/recordingContext";
import { enqueueProjectFileOperation } from "../../project/projectFileQueue";
import { getTimelineProjectActivity } from "../../project/projectActivity";

export function registerProjectSessionHandlers() {
	ipcMain.handle("activate-timeline-project", (_, projectId:string, resetPath:boolean) => enqueueProjectFileOperation(async () => {
		if (!/^[a-zA-Z0-9_-]+$/.test(projectId)) throw new Error("Invalid project identity");
		const activity = getTimelineProjectActivity();
		if ((activity.recording || activity.finalizing) && (resetPath || projectId !== getActiveRecordingProjectId())) throw new Error("Finish recording before switching projects.");
		setActiveRecordingProjectId(projectId);
		if (resetPath) {setCurrentProjectPath(null);setCurrentVideoPath(null);setCurrentRecordingSession(null);}
		return {success:true};
	}));
	ipcMain.handle("get-timeline-project-activity", (_, projectId: string) => {
		if (projectId !== getActiveRecordingProjectId()) throw new Error("Active project changed.");
		return getTimelineProjectActivity();
	});
	ipcMain.handle("deactivate-timeline-project", (_, projectId: string) => enqueueProjectFileOperation(async () => {
		if (projectId !== getActiveRecordingProjectId()) return { success: false, error: "Active project changed." };
		const activity = getTimelineProjectActivity();
		if (activity.recording || activity.finalizing) return { success: false, error: "Finish recording before returning Home." };
		clearRecordingProjectContext(); setCurrentProjectPath(null); setCurrentVideoPath(null); setCurrentRecordingSession(null);
		return { success: true };
	}));
	ipcMain.handle("get-recording-project-context", () => getRecordingProjectContext());
	ipcMain.handle(
		"set-current-video-path",
		async (
			_,
			path: string,
			options?: { preserveProjectPath?: boolean; hideOverlayCursorByDefault?: boolean;captureId?:string;projectId?:string },
		) => {
			const pendingProjectPathPreservation =
				consumePreserveProjectPathForNextNativeRecording();
			const preserveProjectPath =
				Boolean(options?.preserveProjectPath) || pendingProjectPathPreservation;
			setCurrentVideoPath(normalizeVideoSourcePath(path) ?? path);
			approveUserPath(currentVideoPath);
			const resolvedSession = (await resolveRecordingSession(currentVideoPath)) ?? {
				videoPath: currentVideoPath!,
				webcamPath: null,
				timeOffsetMs: 0,
			};

			const nextSession = {
				...resolvedSession,
				captureId: options?.captureId ?? resolvedSession.captureId,
				projectId: options?.projectId ?? resolvedSession.projectId,
				hideOverlayCursorByDefault:
					normalizeBoolean(options?.hideOverlayCursorByDefault) ||
					normalizeBoolean(resolvedSession.hideOverlayCursorByDefault),
			};

			setCurrentRecordingSession(nextSession);
			await replaceApprovedSessionLocalReadPaths(
				[resolvedSession.videoPath, resolvedSession.webcamPath],
				preserveProjectPath,
			);

			if (nextSession.webcamPath || nextSession.captureId) {
				await persistRecordingSessionManifest(nextSession);
			}

			if (!preserveProjectPath) {
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
			options?: { preserveProjectPath?: boolean;captureId?:string;projectId?:string },
		) => {
			const pendingProjectPathPreservation =
				consumePreserveProjectPathForNextNativeRecording();
			const preserveProjectPath =
				Boolean(options?.preserveProjectPath) || pendingProjectPathPreservation;
			const normalizedVideoPath =
				normalizeVideoSourcePath(session.videoPath) ?? session.videoPath;
			setCurrentVideoPath(normalizedVideoPath);
			setCurrentRecordingSession({
				captureId:options?.captureId,
				projectId:options?.projectId,
				videoPath: normalizedVideoPath,
				webcamPath: normalizeVideoSourcePath(session.webcamPath ?? null),
				timeOffsetMs: normalizeRecordingTimeOffsetMs(session.timeOffsetMs),
				hideOverlayCursorByDefault: normalizeBoolean(session.hideOverlayCursorByDefault),
			});
			await rememberApprovedLocalReadPath(currentRecordingSession!.videoPath);
			await rememberApprovedLocalReadPath(currentRecordingSession!.webcamPath);
			if (!preserveProjectPath) {
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
