import {
	isArrayOf,
	isFiniteNumber,
	isObjectRecord,
	isOptional,
	isString,
} from "@/core/slides/validation";

export interface VideoClipItem {
	id: string;
	title: string;
	sourcePath: string;
	startOffsetMs: number;
	durationMs: number;
	trimStartMs?: number;
	trimEndMs?: number;
	speedMultiplier: number;
	volume: number;
	muted?: boolean;
}

export interface VideoTrack {
	id: string;
	name: string;
	type: "video" | "overlay";
	muted?: boolean;
	locked?: boolean;
	clips: VideoClipItem[];
}

export type VideoTrackItem = VideoTrack;

export interface AudioTrackItem {
	id: string;
	name: string;
	sourcePath: string;
	startOffsetMs: number;
	durationMs: number;
	volume: number;
	muted?: boolean;
}

export interface TextOverlayItem {
	id: string;
	text: string;
	startOffsetMs: number;
	durationMs: number;
	position: { x: number; y: number };
	fontSize: number;
	color: string;
}

export interface VideoSlideMeta {
	videoTracks: VideoTrack[];
	audioTracks: AudioTrackItem[];
	textOverlays: TextOverlayItem[];
	mediaPool: Array<{
		id: string;
		name: string;
		path: string;
		type: "video" | "audio" | "image";
		durationMs?: number;
	}>;
}

function isVideoClipItem(value: unknown): value is VideoClipItem {
	if (!isObjectRecord(value)) return false;
	return (
		isString(value.id) &&
		isString(value.title) &&
		isString(value.sourcePath) &&
		isFiniteNumber(value.startOffsetMs) &&
		isFiniteNumber(value.durationMs) &&
		isOptional(value.trimStartMs, isFiniteNumber) &&
		isOptional(value.trimEndMs, isFiniteNumber) &&
		isFiniteNumber(value.speedMultiplier) &&
		isFiniteNumber(value.volume) &&
		isOptional(value.muted, (candidate): candidate is boolean => typeof candidate === "boolean")
	);
}

function isVideoTrack(value: unknown): value is VideoTrack {
	if (!isObjectRecord(value)) return false;
	return (
		isString(value.id) &&
		isString(value.name) &&
		(value.type === "video" || value.type === "overlay") &&
		isOptional(value.muted, (candidate): candidate is boolean => typeof candidate === "boolean") &&
		isOptional(value.locked, (candidate): candidate is boolean => typeof candidate === "boolean") &&
		isArrayOf(value.clips, isVideoClipItem)
	);
}

function isAudioTrackItem(value: unknown): value is AudioTrackItem {
	if (!isObjectRecord(value)) return false;
	return (
		isString(value.id) &&
		isString(value.name) &&
		isString(value.sourcePath) &&
		isFiniteNumber(value.startOffsetMs) &&
		isFiniteNumber(value.durationMs) &&
		isFiniteNumber(value.volume) &&
		isOptional(value.muted, (candidate): candidate is boolean => typeof candidate === "boolean")
	);
}

function isTextOverlayItem(value: unknown): value is TextOverlayItem {
	if (!isObjectRecord(value) || !isObjectRecord(value.position)) return false;
	return (
		isString(value.id) &&
		isString(value.text) &&
		isFiniteNumber(value.startOffsetMs) &&
		isFiniteNumber(value.durationMs) &&
		isFiniteNumber(value.position.x) &&
		isFiniteNumber(value.position.y) &&
		isFiniteNumber(value.fontSize) &&
		isString(value.color)
	);
}

function isMediaPoolItem(
	value: unknown,
): value is VideoSlideMeta["mediaPool"][number] {
	if (!isObjectRecord(value)) return false;
	return (
		isString(value.id) &&
		isString(value.name) &&
		isString(value.path) &&
		(value.type === "video" || value.type === "audio" || value.type === "image") &&
		isOptional(value.durationMs, isFiniteNumber)
	);
}

/** Runtime schema check used when loading serialized project data. */
export function isValidVideoSlideMeta(value: unknown): value is VideoSlideMeta {
	if (!isObjectRecord(value)) return false;
	return (
		isArrayOf(value.videoTracks, isVideoTrack) &&
		isArrayOf(value.audioTracks, isAudioTrackItem) &&
		isArrayOf(value.textOverlays, isTextOverlayItem) &&
		isArrayOf(value.mediaPool, isMediaPoolItem)
	);
}

export function createDefaultVideoMeta(): VideoSlideMeta {
	return {
		videoTracks: [
			{
				id: "track-v1",
				name: "Main Track (V1)",
				type: "video",
				clips: [],
			},
			{
				id: "track-v2",
				name: "B-Roll Overlay (V2)",
				type: "overlay",
				clips: [],
			},
		],
		audioTracks: [],
		textOverlays: [],
		mediaPool: [],
	};
}
