import type { Container } from "pixi.js";
import type { ZoomFocus } from "../types";
import {
	createSpringState,
	resetSpringState,
	type SpringConfig,
	type SpringState,
	stepSpringValue,
} from "./motionSmoothing";

/**
 * Maximum tilt angle in radians at 100% intensity.
 * ~3.5 degrees (0.06 rad) provides a rich, subtle 3D physical depth without disorienting distortion.
 */
export const MAX_PERSPECTIVE_TILT_RAD = 0.061;

export interface PerspectiveTiltState {
	pitchSpring: SpringState;
	yawSpring: SpringState;
	lastTimeMs: number;
}

export function createPerspectiveTiltState(): PerspectiveTiltState {
	return {
		pitchSpring: createSpringState(0),
		yawSpring: createSpringState(0),
		lastTimeMs: 0,
	};
}

export function resetPerspectiveTiltState(state: PerspectiveTiltState): void {
	resetSpringState(state.pitchSpring, 0);
	resetSpringState(state.yawSpring, 0);
	state.lastTimeMs = 0;
}

export interface PerspectiveTiltParams {
	cursor: ZoomFocus | null;
	intensity: number;
	deltaMs: number;
	stageSize: { width: number; height: number };
	baseMask: { x: number; y: number; width: number; height: number };
	springConfig?: SpringConfig;
}

export interface PerspectiveTiltResult {
	skewX: number;
	skewY: number;
	offsetX: number;
	offsetY: number;
}

const DEFAULT_TILT_SPRING_CONFIG: SpringConfig = {
	stiffness: 140,
	damping: 18,
	mass: 1.0,
	restDelta: 0.0001,
	restSpeed: 0.001,
};

/**
 * Computes 3D perspective pitch and yaw skew for the camera container
 * based on the cursor position relative to center (0.5, 0.5).
 *
 * Includes center compensation offsets so the center of the viewport
 * does not drift when skewed.
 */
export function computePerspectiveTilt(
	state: PerspectiveTiltState,
	params: PerspectiveTiltParams,
): PerspectiveTiltResult {
	const { cursor, intensity, deltaMs, stageSize, baseMask, springConfig } = params;

	if (
		intensity <= 0 ||
		stageSize.width <= 0 ||
		stageSize.height <= 0 ||
		baseMask.width <= 0 ||
		baseMask.height <= 0
	) {
		resetPerspectiveTiltState(state);
		return { skewX: 0, skewY: 0, offsetX: 0, offsetY: 0 };
	}

	const clampedIntensity = Math.max(0, Math.min(1, intensity));

	// Normalized cursor offset from center (-0.5 to 0.5)
	const targetDx = cursor ? Math.max(-0.5, Math.min(0.5, cursor.cx - 0.5)) : 0;
	const targetDy = cursor ? Math.max(-0.5, Math.min(0.5, cursor.cy - 0.5)) : 0;

	// Target yaw (Y-skew) and pitch (X-skew) in radians
	const targetSkewY = targetDx * 2 * MAX_PERSPECTIVE_TILT_RAD * clampedIntensity;
	const targetSkewX = -targetDy * 2 * MAX_PERSPECTIVE_TILT_RAD * clampedIntensity;

	const config = springConfig ?? DEFAULT_TILT_SPRING_CONFIG;
	const currentSkewX = stepSpringValue(state.pitchSpring, targetSkewX, deltaMs, config);
	const currentSkewY = stepSpringValue(state.yawSpring, targetSkewY, deltaMs, config);

	// Center compensation:
	// A container with pivot (0,0) skewed by (skewX, skewY) shifts a point (cx, cy) by:
	// deltaX = cy * tan(skewX)
	// deltaY = cx * tan(skewY)
	// To keep the center of the video content stationary, we subtract this offset.
	const contentCenterX = baseMask.x + baseMask.width / 2;
	const contentCenterY = baseMask.y + baseMask.height / 2;

	const offsetX = -contentCenterY * Math.tan(currentSkewX);
	const offsetY = -contentCenterX * Math.tan(currentSkewY);

	return {
		skewX: currentSkewX,
		skewY: currentSkewY,
		offsetX,
		offsetY,
	};
}

/**
 * Applies perspective tilt to a PixiJS container.
 */
export function applyPerspectiveTilt(container: Container, tilt: PerspectiveTiltResult): void {
	container.skew.set(tilt.skewX, tilt.skewY);
	container.position.x += tilt.offsetX;
	container.position.y += tilt.offsetY;
}
