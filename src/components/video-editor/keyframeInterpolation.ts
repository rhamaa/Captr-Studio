import type { KeyframeEasing, KeyframeProperty, PropertyKeyframe } from "./types";

/**
 * Calculates easing progress (0 to 1) based on KeyframeEasing type.
 */
export function calculateEasingProgress(t: number, easing: KeyframeEasing = "ease-in-out", bezier?: [number, number, number, number]): number {
	const clamped = Math.max(0, Math.min(1, t));

	switch (easing) {
		case "linear":
			return clamped;
		case "ease-in":
			return clamped * clamped;
		case "ease-out":
			return clamped * (2 - clamped);
		case "ease-in-out":
			return clamped < 0.5
				? 2 * clamped * clamped
				: -1 + (4 - 2 * clamped) * clamped;
		case "spring-bounce": {
			// Decaying sinusoidal bounce
			const c4 = (2 * Math.PI) / 3;
			return clamped === 0
				? 0
				: clamped === 1
					? 1
					: Math.pow(2, -10 * clamped) * Math.sin((clamped * 10 - 0.75) * c4) + 1;
		}
		case "cubic-bezier": {
			const [x1, y1, x2, y2] = bezier ?? [0.42, 0, 0.58, 1];
			const sample = (u: number, a: number, b: number) => 3 * (1-u) ** 2 * u * a + 3 * (1-u) * u*u * b + u*u*u;
			let low = 0, high = 1;
			for (let i = 0; i < 30; i++) { const mid = (low + high) / 2; if (sample(mid, x1, x2) < clamped) low = mid; else high = mid; }
			return sample((low + high) / 2, y1, y2);
		}
		default:
			// Default smooth cubic bezier-like curve
			return clamped * clamped * (3 - 2 * clamped);
	}
}

/**
 * Interpolates numeric keyframe values for a given property at a specific playhead time.
 */
export function interpolateNumericKeyframe(
	keyframes: PropertyKeyframe[],
	property: KeyframeProperty,
	currentTimeMs: number,
	defaultValue: number,
): number {
	const propKeyframes = keyframes
		.filter((kf) => kf.property === property && typeof kf.value === "number")
		.sort((a, b) => a.timeMs - b.timeMs);

	if (propKeyframes.length === 0) {
		return defaultValue;
	}

	// Before first keyframe
	if (currentTimeMs <= propKeyframes[0].timeMs) {
		return propKeyframes[0].value as number;
	}

	// After last keyframe
	const lastKeyframe = propKeyframes[propKeyframes.length - 1];
	if (currentTimeMs >= lastKeyframe.timeMs) {
		return lastKeyframe.value as number;
	}

	// Between two keyframes
	for (let i = 0; i < propKeyframes.length - 1; i++) {
		const kfStart = propKeyframes[i];
		const kfEnd = propKeyframes[i + 1];

		if (currentTimeMs >= kfStart.timeMs && currentTimeMs <= kfEnd.timeMs) {
			const segmentDuration = Math.max(1, kfEnd.timeMs - kfStart.timeMs);
			const rawProgress = (currentTimeMs - kfStart.timeMs) / segmentDuration;
			const easedProgress = calculateEasingProgress(rawProgress, kfStart.easing, kfStart.bezier);

			const startVal = kfStart.value as number;
			const endVal = kfEnd.value as number;

			return startVal + (endVal - startVal) * easedProgress;
		}
	}

	return defaultValue;
}

/**
 * Interpolates 2D position keyframe values ({ x, y }) at a specific playhead time.
 */
export function interpolatePositionKeyframe(
	keyframes: PropertyKeyframe[],
	currentTimeMs: number,
	defaultPosition: { x: number; y: number },
): { x: number; y: number } {
	const posKeyframes = keyframes
		.filter(
			(kf) =>
				kf.property === "position" &&
				typeof kf.value === "object" &&
				kf.value !== null &&
				"x" in kf.value &&
				"y" in kf.value,
		)
		.sort((a, b) => a.timeMs - b.timeMs);

	if (posKeyframes.length === 0) {
		return defaultPosition;
	}

	if (currentTimeMs <= posKeyframes[0].timeMs) {
		return posKeyframes[0].value as { x: number; y: number };
	}

	const lastKeyframe = posKeyframes[posKeyframes.length - 1];
	if (currentTimeMs >= lastKeyframe.timeMs) {
		return lastKeyframe.value as { x: number; y: number };
	}

	for (let i = 0; i < posKeyframes.length - 1; i++) {
		const kfStart = posKeyframes[i];
		const kfEnd = posKeyframes[i + 1];

		if (currentTimeMs >= kfStart.timeMs && currentTimeMs <= kfEnd.timeMs) {
			const segmentDuration = Math.max(1, kfEnd.timeMs - kfStart.timeMs);
			const rawProgress = (currentTimeMs - kfStart.timeMs) / segmentDuration;
			const easedProgress = calculateEasingProgress(rawProgress, kfStart.easing, kfStart.bezier);

			const startVal = kfStart.value as { x: number; y: number };
			const endVal = kfEnd.value as { x: number; y: number };

			return {
				x: startVal.x + (endVal.x - startVal.x) * easedProgress,
				y: startVal.y + (endVal.y - startVal.y) * easedProgress,
			};
		}
	}

	return defaultPosition;
}
