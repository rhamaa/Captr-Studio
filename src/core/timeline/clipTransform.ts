import {
	interpolateNumericKeyframe,
	interpolatePositionKeyframe,
} from "@/components/video-editor/keyframeInterpolation";
import type { ClipTransform, TimelineClip } from "./types";

/**
 * Samples the interpolated ClipTransform for a TimelineClip at a given local time in microseconds.
 * localTimeUs is relative to the start of the clip playback (i.e. 0 at clip.startUs).
 */
export function sampleClipTransform(clip: TimelineClip, localTimeUs: number): ClipTransform {
	if (!clip.keyframes || clip.keyframes.length === 0) {
		return clip.transform;
	}

	const timeMs = Math.max(0, localTimeUs / 1000);
	const pos = interpolatePositionKeyframe(clip.keyframes, timeMs, {
		x: clip.transform.x,
		y: clip.transform.y,
	});
	const scale = interpolateNumericKeyframe(clip.keyframes, "scale", timeMs, clip.transform.scale);
	const rotation = interpolateNumericKeyframe(
		clip.keyframes,
		"rotation",
		timeMs,
		clip.transform.rotation,
	);
	const opacity = interpolateNumericKeyframe(
		clip.keyframes,
		"opacity",
		timeMs,
		clip.transform.opacity,
	);

	return {
		x: pos.x,
		y: pos.y,
		scale: Math.max(0.001, scale),
		rotation,
		opacity: Math.max(0, Math.min(1, opacity)),
	};
}
