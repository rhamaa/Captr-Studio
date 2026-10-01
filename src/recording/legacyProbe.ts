import { probeMedia } from "./mediaProbe";
/** Probe only the explicit conversion copy; never mutate the legacy source project. */
export async function probeLegacyRecordProject(value: unknown): Promise<unknown> {
	const raw = structuredClone(value) as Record<string, any>,
		entries = Array.isArray(raw.slides)
			? raw.slides
			: Array.isArray(raw.clips) && raw.clips.length
				? raw.clips
				: [{ id: "recording", videoPath: raw.videoPath, ...raw.editor }];
	for (const entry of entries) {
		const meta = entry.meta ?? entry,
			videoPath = meta.videoPath ?? raw.videoPath;
		if (!videoPath) throw new Error("Missing legacy screen source");
		const screen = await probeMedia(videoPath, "video"),
			sources = await window.electronAPI.inspectRecordingSources(videoPath);
		if (!sources.success) throw new Error(sources.error ?? "Could not inspect legacy source");
		meta.microphoneAudioPath ??= sources.microphonePath;
		meta.systemAudioPath ??= sources.systemPath ?? (sources.embeddedAudio ? videoPath : null);
		meta.cursorTelemetryPath ??= sources.cursorPath;
		if (meta.cursorTelemetryPath) {
			const telemetry = await window.electronAPI.getCursorTelemetry(
				videoPath,
				meta.cursorTelemetryPath,
			);
			if (!telemetry.success) throw new Error("Legacy cursor metadata is unreadable");
			meta.cursorTelemetry = telemetry.samples;
		}
		const stream = async (
			path: string | undefined | null,
			kind: "audio" | "video",
			offsetMs = 0,
		) =>
			path
				? { ...(await probeMedia(path, kind)), offsetUs: Math.round(offsetMs * 1000) }
				: undefined;
		entry.__conversion = {
			screen,
			webcam: await stream(meta.webcamPath, "video", meta.webcam?.timeOffsetMs ?? 0),
			microphone: await stream(meta.microphoneAudioPath, "audio", sources.microphoneOffsetMs),
			system: await stream(meta.systemAudioPath, "audio", sources.systemOffsetMs),
		};
		entry.durationMs = screen.durationUs / 1000;
	}
	if (!Array.isArray(raw.slides)) raw.clips = entries;
	for (const track of raw.globalAudioTracks ?? []) {
		if (!track.durationMs)
			track.durationMs = (await probeMedia(track.path, "audio")).durationUs / 1000;
	}
	return raw;
}
