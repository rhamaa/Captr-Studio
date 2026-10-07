import { ipcMain } from "electron";
import {
	renderHyperframeToMp4,
	type HyperframeExportOptions,
	type HyperframeExportProgress,
	type HyperframeExportResult,
} from "../hyperframe/hyperframeExportEngine";

interface ActiveExportSession {
	cancel: () => void;
}

const activeHyperframeExportSessions = new Map<string, ActiveExportSession>();

export function registerHyperframeExportHandlers() {
	ipcMain.handle(
		"hyperframe:export-video",
		async (
			event,
			options: HyperframeExportOptions,
		): Promise<HyperframeExportResult> => {
			const sessionId =
				options.sessionId ||
				`hf-export-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

			let isCancelled = false;
			activeHyperframeExportSessions.set(sessionId, {
				cancel: () => {
					isCancelled = true;
				},
			});

			try {
				const result = await renderHyperframeToMp4({
					...options,
					sessionId,
					onProgress: (progress: HyperframeExportProgress) => {
						if (!event.sender.isDestroyed()) {
							event.sender.send("hyperframe:export-progress", progress);
						}
					},
					isCancelled: () => isCancelled,
				});
				return result;
			} finally {
				activeHyperframeExportSessions.delete(sessionId);
			}
		},
	);

	ipcMain.handle(
		"hyperframe:cancel-export",
		async (_, sessionId: string): Promise<{ success: boolean }> => {
			const session = activeHyperframeExportSessions.get(sessionId);
			if (session) {
				session.cancel();
				activeHyperframeExportSessions.delete(sessionId);
				return { success: true };
			}
			return { success: false };
		},
	);
}
