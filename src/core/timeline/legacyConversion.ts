import { assertSupportedLegacyProject } from "@/core/project/legacySupport";
import {
	createTimelineProject,
	registerRecording,
	placeAsset,
	registerMedia,
	trimClip,
	updateClip,
} from "./commands";
import { validateTimelineProject } from "./validation";
import type { TimelineProject } from "./types";
import type { RecordingSettings, MediaSource } from "@/recording/types";
import { createDefaultRecordingSettings } from "@/recording/schema";

const supportedSettings = new Set([
	...Object.keys(createDefaultRecordingSettings()),
	"videoPath",
	"webcamPath",
	"microphoneAudioPath",
	"systemAudioPath",
	"cursorTelemetryPath",
	"cursorTelemetry",
	"cropRegion",
	"cursorSpringStiffnessMultiplier",
	"cursorSpringDampingMultiplier",
	"cursorSpringMassMultiplier",
	"cameraSpringStiffnessMultiplier",
	"cameraSpringDampingMultiplier",
	"cameraSpringMassMultiplier",
	"cursorMotionBlur",
	"cursorClickBounceDuration",
	"zoomSmoothness",
	"zoomClassicMode",
	"zoomMotionBlurTuning",
	"zoomTemporalMotionBlur",
	"zoomMotionBlurSampleCount",
	"zoomMotionBlurShutterFraction",
	"zoomInOverlapMs",
	"connectedZoomGapMs",
	"connectedZoomDurationMs",
	"zoomInEasing",
	"zoomOutEasing",
	"connectedZoomEasing",
	"audioDuckingSettings",
	"sourceAudioSettings",
	"sourceAudioTrackSettingsByClip",
	"defaultSourceAudioTrackSettings",
	"aspectRatio",
	"loopCursor",
	"durationMs",
	"exportEncodingMode",
	"exportBackendPreference",
	"exportPipelineModel",
	"exportQuality",
	"mp4FrameRate",
	"exportFormat",
	"gifFrameRate",
	"gifLoop",
	"gifSizePreset",
	"autoFullTrackClipId",
	"autoFullTrackClipEndMs",
]);
function assertSettings(settings: Record<string, any>) {
	for (const key of Object.keys(settings)) {
		if (!supportedSettings.has(key)) throw new Error(`Unsupported legacy metadata: ${key}`);
	}
	if (settings.clipRegions?.some((c: any) => c.transitionIn && c.transitionIn !== "none"))
		throw new Error("Unsupported legacy clip transition");
}

export interface ConversionIds {
	projectId: string;
	prefix: string;
}
export function convertLegacyRecordProject(value: unknown, ids: ConversionIds): TimelineProject {
	assertSupportedLegacyProject(value);
	if (!value || typeof value !== "object") throw new Error("Invalid legacy project");
	const raw = value as Record<string, any>;
	if (raw.version !== 1 && raw.version !== 2)
		throw new Error("Unsupported legacy project version");
	if (raw.extensions && Object.keys(raw.extensions).length)
		throw new Error("Unsupported legacy extensions");
	const rootKeys = new Set([
		"version",
		"projectId",
		"title",
		"canvas",
		"slides",
		"clips",
		"editor",
		"videoPath",
		"webcamPath",
		"globalAudioTracks",
		"transitions",
		"createdAt",
		"updatedAt",
		"extensions",
		"thumbnail",
	]);
	for (const key of Object.keys(raw)) {
		if (!rootKeys.has(key)) throw new Error(`Unsupported legacy project field: ${key}`);
	}
	if (
		raw.transitions?.some((t: any) => t.type !== "none") ||
		raw.clips?.some(
			(c: any) =>
				(c.transitionIn?.type && c.transitionIn.type !== "none") ||
				(c.transitionToNext?.type && c.transitionToNext.type !== "none"),
		)
	)
		throw new Error("Legacy transitions cannot be converted without loss");
	let result = createTimelineProject(
		ids.projectId,
		typeof raw.title === "string" ? raw.title : "Converted project",
	);
	if (raw.canvas) result.canvas = structuredClone(raw.canvas);
	const entries = Array.isArray(raw.slides)
		? [...raw.slides].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
		: Array.isArray(raw.clips) && raw.clips.length
			? raw.clips
			: [{ id: "recording", videoPath: raw.videoPath, ...raw.editor }];
	let startUs = 0;
	for (const [index, entry] of entries.entries()) {
		if (!entry || typeof entry !== "object" || (entry.type && entry.type !== "record"))
			throw new Error("Unsupported legacy recording");
		const entryKeys = new Set([
			...supportedSettings,
			"id",
			"type",
			"title",
			"order",
			"dirName",
			"meta",
			"sceneSettings",
			"recordSettings",
			"startMsOffset",
			"label",
			"origin",
			"slideMode",
			"trimStartMs",
			"trimEndMs",
			"speed",
			"transitionIn",
			"transitionToNext",
			"assetFiles",
			"mediaTrackLayers",
			"keyframes",
			"extensions",
			"__conversion",
		]);
		for (const key of Object.keys(entry)) {
			if (!entryKeys.has(key))
				throw new Error(`Unsupported legacy recording metadata: ${key}`);
		}
		if (
			(entry.extensions && Object.keys(entry.extensions).length) ||
			entry.assetFiles?.length ||
			entry.mediaTrackLayers?.length ||
			entry.keyframes?.length
		)
			throw new Error("Unsupported legacy package metadata");
		const metadata = entry.meta
			? structuredClone(entry.meta)
			: {
					...structuredClone(raw.editor ?? {}),
					...structuredClone(entry.sceneSettings ?? {}),
					...structuredClone(entry.recordSettings ?? {}),
				};
		if (!entry.meta) {
			for (const key of supportedSettings) {
				if (entry[key] !== undefined) metadata[key] = structuredClone(entry[key]);
			}
		}
		assertSettings(metadata);
		const meta = metadata as RecordingSettings;
		const videoPath = meta.videoPath;
		if (!videoPath) throw new Error("Missing legacy recording source");
		const durationUs =
			entry.__conversion?.screen.durationUs ??
			Math.round((entry.durationMs ?? raw.editor?.durationMs ?? 0) * 1000);
		if (durationUs <= 0)
			throw new Error("Legacy recording duration must be probed before conversion");
		if (!entry.meta && entry.trimStartMs !== undefined && entry.trimEndMs !== undefined) {
			const trims = [...(meta.trimRegions ?? [])];
			if (entry.trimStartMs > 0)
				trims.push({
					id: `${ids.prefix}-before-${index}`,
					startMs: 0,
					endMs: entry.trimStartMs,
				});
			if (entry.trimEndMs < durationUs / 1000)
				trims.push({
					id: `${ids.prefix}-after-${index}`,
					startMs: entry.trimEndMs,
					endMs: durationUs / 1000,
				});
			meta.trimRegions = trims;
		}
		if (!entry.meta && entry.speed !== undefined && entry.speed !== 1)
			meta.speedRegions = [
				{
					id: `${ids.prefix}-speed-${index}`,
					startMs: 0,
					endMs: durationUs / 1000,
					speed: entry.speed,
				},
			];
		const controls =
			meta.sourceAudioTrackSettingsByClip?.[entry.id] ?? meta.defaultSourceAudioTrackSettings;
		if (controls)
			meta.sourceAudioSettings = {
				microphone: controls.mic ?? { volume: 1, normalize: false },
				system: controls.system ?? controls.mixed ?? { volume: 1, normalize: false },
			};
		const source = (
			p: string | undefined | null,
			offsetUs = 0,
			kind = "",
		): MediaSource | undefined =>
			p
				? {
						path: p,
						durationUs: entry.__conversion?.[kind]?.durationUs ?? durationUs,
						offsetUs,
					}
				: undefined;
		const assetId = `${ids.prefix}-asset-${index}`,
			packageId = `${ids.prefix}-package-${index}`,
			name = entry.title ?? entry.label ?? `Recording ${index + 1}`;
		result = registerRecording(
			result,
			{
				captureId: `${raw.projectId ?? "legacy"}-${entry.id ?? index}`,
				name,
				durationUs,
				width: entry.__conversion?.screen.width ?? result.canvas.width,
				height: entry.__conversion?.screen.height ?? result.canvas.height,
				screen: source(videoPath, 0, "screen")!,
				webcam: source(
					meta.webcamPath,
					Math.round((meta.webcam?.timeOffsetMs ?? 0) * 1000),
					"webcam",
				),
				microphone: source(
					meta.microphoneAudioPath,
					entry.__conversion?.microphone?.offsetUs ?? 0,
					"microphone",
				),
				system: source(
					meta.systemAudioPath,
					entry.__conversion?.system?.offsetUs ?? 0,
					"system",
				),
				cursorPath: meta.cursorTelemetryPath ?? undefined,
				settings: structuredClone(meta),
			},
			{ assetId, packageId },
		);
		result = placeAsset(result, assetId, "visual-1", startUs, {
			clipId: `${ids.prefix}-clip-${index}`,
			compositionId: `${ids.prefix}-composition-${index}`,
		});
		startUs += result.compositions.at(-1)!.durationUs;
	}
	for (const [index, audio] of (raw.globalAudioTracks ?? []).entries()) {
		if (!audio.path || audio.loop || audio.fadeInMs > 0 || audio.fadeOutMs > 0)
			throw new Error("Unsupported legacy global audio looping/fades");
		const startUs = Math.round((audio.startMsOffset ?? 0) * 1000),
			durationUs = Math.round((audio.durationMs ?? 0) * 1000);
		if (durationUs <= 0) throw new Error("Unsupported legacy audio duration");
		const id = `${ids.prefix}-audio-${index}`;
		const trackId = `${ids.prefix}-audio-track-${index}`,
			clipId = `${id}-clip`;
		result.tracks.push({
			id: trackId,
			name: audio.name ?? "Audio",
			kind: "audio",
			locked: false,
			muted: false,
			hidden: false,
			clips: [],
		});
		result = registerMedia(result, {
			id,
			kind: "audio",
			name: audio.name ?? "Audio",
			durationUs,
			width: 0,
			height: 0,
			source: { path: audio.path, durationUs, offsetUs: 0 },
		});
		result = placeAsset(result, id, trackId, startUs, { clipId });
		result = trimClip(
			result,
			clipId,
			Math.round((audio.trimStartMs ?? 0) * 1000),
			Math.round((audio.trimEndMs ?? audio.durationMs) * 1000),
		);
		result = updateClip(result, clipId, { gain: audio.volume ?? 1 });
	}
	return validateTimelineProject(result);
}
