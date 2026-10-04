import * as state from "../state";

let finalizations = 0;
const captureLeases = new Set<string>();
export function setProjectRecordingFinalizing(
	projectId: string,
	captureId: string,
	finalizing: boolean,
) {
	const key = `${projectId}:${captureId}`;
	if (finalizing) captureLeases.add(key);
	else captureLeases.delete(key);
}
export async function trackProjectFinalization<T>(job: () => Promise<T>): Promise<T> {
	finalizations++;
	try {
		return await job();
	} finally {
		finalizations--;
	}
}
export function getTimelineProjectActivity(): { recording: boolean; finalizing: boolean } {
	return {
		recording:
			state.nativeScreenRecordingActive ||
			state.windowsNativeCaptureActive ||
			state.ffmpegScreenRecordingActive ||
			state.isCursorCaptureActive,
		finalizing:
			finalizations > 0 || captureLeases.size > 0 || Boolean(state.windowsPendingVideoPath),
	};
}
