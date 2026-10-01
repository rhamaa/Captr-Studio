import {
	isArrayOf,
	isFiniteNumber,
	isObjectRecord,
	isOptional,
	isString,
} from "@/core/validation";
import { isValidRecordingSettings } from "@/recording/schema";
import type {
	GlobalAudioTrack,
	ProjectSlideData,
	ProjectV2Data,
	SlideTransition,
	TransitionType,
} from "@/core/project/legacyTypes";

const transitionTypes: readonly TransitionType[] = [
	"none",
	"crossfade",
	"fade-black",
	"wipe-left",
	"wipe-right",
	"slide-left",
	"slide-right",
	"zoom-in",
];

function isTransitionType(value: unknown): value is TransitionType {
	return transitionTypes.some((type) => type === value);
}

function isProjectSlide(value: unknown): value is ProjectSlideData {
	if (!isObjectRecord(value) || !isObjectRecord(value.meta)) return false;
	if (
		!isString(value.id) ||
		!isString(value.title) ||
		!isFiniteNumber(value.durationMs) ||
		value.durationMs < 0 ||
		!isFiniteNumber(value.order) ||
		!isOptional(value.dirName, isString)
	) {
		return false;
	}

	switch (value.type) {
		case "record":
			return isValidRecordingSettings(value.meta);
		case "keyframe":
			// Keyframe remains an extension slot; its owning module validates its schema.
			return true;
		default:
			return false;
	}
}

function isSlideTransition(value: unknown): value is SlideTransition {
	return (
		isObjectRecord(value) &&
		isString(value.id) &&
		isString(value.fromSlideId) &&
		isString(value.toSlideId) &&
		value.fromSlideId !== value.toSlideId &&
		isTransitionType(value.type) &&
		isFiniteNumber(value.durationMs) &&
		value.durationMs >= 0
	);
}

function isGlobalAudioTrack(value: unknown): value is GlobalAudioTrack {
	if (!isObjectRecord(value)) return false;
	return (
		isString(value.id) &&
		isString(value.name) &&
		isString(value.path) &&
		isFiniteNumber(value.volume) &&
		isFiniteNumber(value.startMsOffset) &&
		isOptional(value.durationMs, isFiniteNumber) &&
		isOptional(value.trimStartMs, isFiniteNumber) &&
		isOptional(value.trimEndMs, isFiniteNumber) &&
		isOptional(value.fadeInMs, isFiniteNumber) &&
		isOptional(value.fadeOutMs, isFiniteNumber) &&
		isOptional(value.loop, (candidate): candidate is boolean => typeof candidate === "boolean")
	);
}

/** Deeply checks data loaded from a serialized V2 project before it is trusted. */
export function isProjectV2Data(value: unknown): value is ProjectV2Data {
	if (!isObjectRecord(value) || value.version !== 2) return false;
	if (
		!isString(value.projectId) ||
		!isString(value.title) ||
		!isOptional(value.createdAt, isFiniteNumber) ||
		!isOptional(value.updatedAt, isFiniteNumber) ||
		!isObjectRecord(value.canvas) ||
		!isFiniteNumber(value.canvas.width) ||
		value.canvas.width <= 0 ||
		!isFiniteNumber(value.canvas.height) ||
		value.canvas.height <= 0 ||
		!isFiniteNumber(value.canvas.fps) ||
		value.canvas.fps <= 0 ||
		!isOptional(value.canvas.aspectRatio, isString) ||
		!isArrayOf(value.slides, isProjectSlide) ||
		!isArrayOf(value.transitions, isSlideTransition) ||
		!isArrayOf(value.globalAudioTracks, isGlobalAudioTrack)
	) {
		return false;
	}

	const slideIds = new Set<string>();
	for (const slide of value.slides) {
		if (slideIds.has(slide.id)) return false;
		slideIds.add(slide.id);
	}
	for (const transition of value.transitions) {
		if (!slideIds.has(transition.fromSlideId) || !slideIds.has(transition.toSlideId)) {
			return false;
		}
	}
	return true;
}
