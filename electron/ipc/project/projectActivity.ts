import * as state from "../state";

let finalizations = 0;
export async function trackProjectFinalization<T>(job: () => Promise<T>): Promise<T> {
	finalizations++;
	try { return await job(); } finally { finalizations--; }
}
export function getTimelineProjectActivity(): { recording: boolean; finalizing: boolean } {
	return {
		recording: state.nativeScreenRecordingActive || state.windowsNativeCaptureActive || state.ffmpegScreenRecordingActive || state.isCursorCaptureActive,
		finalizing: finalizations > 0 || Boolean(state.windowsPendingVideoPath),
	};
}
