import { probeMedia as defaultProbeMedia, type ProbedMedia } from "./mediaProbe";
import { createDefaultRecordingSettings } from "./schema";
import type { CompletedRecording } from "./types";

export interface CameraTakeInput {
	videoPath: string;
	captureId: string;
	name: string;
	/** True when the take contains a microphone track embedded in the video file. */
	hasAudio: boolean;
}

interface CameraRecordingDeps {
	probeMedia: (path: string, kind: "video") => Promise<ProbedMedia>;
}

/**
 * Builds a camera-only recording. The camera file is the package's `screen` stream so the
 * Record editor, evaluation and export work unchanged; `captureSource` marks its origin.
 */
export async function completedRecordingFromCamera(
	input: CameraTakeInput,
	deps: CameraRecordingDeps = { probeMedia: defaultProbeMedia },
): Promise<CompletedRecording> {
	if (!input.captureId) throw new Error("Recording capture id is missing");
	const media = await deps.probeMedia(input.videoPath, "video");
	if (!(media.width > 0 && media.height > 0))
		throw new Error("The camera take has no video frames");
	const stream = { path: input.videoPath, durationUs: media.durationUs, offsetUs: 0 };
	const defaults = createDefaultRecordingSettings();
	return {
		captureId: input.captureId,
		name: input.name,
		captureSource: "camera",
		durationUs: media.durationUs,
		width: media.width,
		height: media.height,
		screen: stream,
		...(input.hasAudio ? { microphone: { ...stream } } : {}),
		settings: {
			showCursor: false,
			zoomRegions: [],
			webcam: { ...defaults.webcam, enabled: false, sourcePath: null },
		},
	};
}

/** Next free "<prefix> N" name, one above the highest existing number. */
export function nextMonologName(assets: ReadonlyArray<{ name: string }>, prefix: string): string {
	const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(`^${escaped} (\\d+)$`);
	let highest = 0;
	for (const asset of assets) {
		const match = pattern.exec(asset.name);
		if (match) highest = Math.max(highest, Number(match[1]));
	}
	return `${prefix} ${highest + 1}`;
}
