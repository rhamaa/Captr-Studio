import type { MediaSource, RecordingCaptureSource, RecordingPackage } from "./types";

export function recordingCaptureSource(
	pkg: Pick<RecordingPackage, "captureSource">,
): RecordingCaptureSource {
	return pkg.captureSource ?? "screen";
}

/**
 * The microphone stream only when it is a separate file. A camera take embeds its mic in the
 * screen file; playing both would double the audio.
 */
export function separateMicrophone(
	pkg: Pick<RecordingPackage, "screen" | "microphone">,
): MediaSource | undefined {
	return pkg.microphone && pkg.microphone.path !== pkg.screen?.path ? pkg.microphone : undefined;
}
