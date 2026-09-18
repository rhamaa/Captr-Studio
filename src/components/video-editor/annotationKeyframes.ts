import { interpolateNumericKeyframe, interpolatePositionKeyframe } from "./keyframeInterpolation";
import type { AnnotationRegion, KeyframeProperty, PropertyKeyframe } from "./types";

/** Validate project-file input before it reaches either renderer. */
export function normalizePropertyKeyframes(value: unknown): PropertyKeyframe[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const frames: PropertyKeyframe[] = [];
	const ids = new Set<string>();
	for (const raw of value) {
		if (
			!raw ||
			typeof raw !== "object" ||
			typeof raw.id !== "string" ||
			!raw.id ||
			ids.has(raw.id)
		)
			continue;
		if (!Number.isFinite(raw.timeMs) || raw.timeMs < 0) continue;
		if (!["position", "scale", "rotation", "opacity"].includes(raw.property)) continue;
		if (raw.property === "position") {
			if (!raw.value || !Number.isFinite(raw.value.x) || !Number.isFinite(raw.value.y))
				continue;
		} else if (!Number.isFinite(raw.value)) continue;
		ids.add(raw.id);
		frames.push({
			id: raw.id,
			timeMs: raw.timeMs,
			property: raw.property,
			value: raw.property === "position" ? { x: raw.value.x, y: raw.value.y } : raw.value,
			easing: [
				"linear",
				"ease-in",
				"ease-out",
				"ease-in-out",
				"spring-bounce",
				"cubic-bezier",
			].includes(raw.easing)
				? raw.easing
				: "ease-in-out",
		});
	}
	return frames.sort((a, b) => a.timeMs - b.timeMs);
}

/** Keyframe times are relative to the annotation, never the project playhead. */
export function getAnnotationLocalTime(
	annotation: AnnotationRegion,
	timelineTimeMs: number,
): number {
	return Math.max(
		0,
		Math.min(annotation.endMs - annotation.startMs, timelineTimeMs - annotation.startMs),
	);
}

export function sampleAnnotationTransform(annotation: AnnotationRegion, timelineTimeMs: number) {
	const time = getAnnotationLocalTime(annotation, timelineTimeMs);
	const frames = annotation.keyframes ?? [];
	return {
		position: interpolatePositionKeyframe(frames, time, annotation.position),
		scale: interpolateNumericKeyframe(frames, "scale", time, 1),
		opacity: interpolateNumericKeyframe(frames, "opacity", time, annotation.style.opacity ?? 1),
		rotation: interpolateNumericKeyframe(frames, "rotation", time, annotation.rotationDeg ?? 0),
	};
}

export function addAnnotationKeyframe(
	annotation: AnnotationRegion,
	property: KeyframeProperty,
	timelineTimeMs: number,
	id: string,
): PropertyKeyframe[] {
	const timeMs = getAnnotationLocalTime(annotation, timelineTimeMs);
	const sampled = sampleAnnotationTransform(annotation, timelineTimeMs);
	const frame: PropertyKeyframe = {
		id,
		property,
		timeMs,
		value: sampled[property],
		easing: "ease-in-out",
	};
	return [
		...(annotation.keyframes ?? []).filter(
			(existing) => existing.property !== property || Math.abs(existing.timeMs - timeMs) >= 1,
		),
		frame,
	].sort((a, b) => a.timeMs - b.timeMs);
}

export function moveAnnotationKeyframe(
	annotation: AnnotationRegion,
	id: string,
	timelineTimeMs: number,
): PropertyKeyframe[] {
	const frame = annotation.keyframes?.find((candidate) => candidate.id === id);
	if (!frame) return annotation.keyframes ?? [];
	const timeMs = getAnnotationLocalTime(annotation, timelineTimeMs);
	return (annotation.keyframes ?? [])
		.filter(
			(candidate) =>
				candidate.id === id ||
				candidate.property !== frame.property ||
				Math.abs(candidate.timeMs - timeMs) >= 1,
		)
		.map((candidate) => (candidate.id === id ? { ...candidate, timeMs } : candidate))
		.sort((a, b) => a.timeMs - b.timeMs);
}
