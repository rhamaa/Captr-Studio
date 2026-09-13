import { describe, expect, it } from "vitest";
import {
	applyPerspectiveTilt,
	computePerspectiveTilt,
	createPerspectiveTiltState,
	MAX_PERSPECTIVE_TILT_RAD,
	resetPerspectiveTiltState,
} from "./perspectiveTilt";

describe("perspectiveTilt", () => {
	const stageSize = { width: 1920, height: 1080 };
	const baseMask = { x: 100, y: 50, width: 1720, height: 980 };

	it("returns 0 skew and offset when intensity is 0", () => {
		const state = createPerspectiveTiltState();
		const result = computePerspectiveTilt(state, {
			cursor: { cx: 0.9, cy: 0.1 },
			intensity: 0,
			deltaMs: 16.6,
			stageSize,
			baseMask,
		});

		expect(result.skewX).toBe(0);
		expect(result.skewY).toBe(0);
		expect(result.offsetX).toBe(0);
		expect(result.offsetY).toBe(0);
	});

	it("returns 0 skew when cursor is at center (0.5, 0.5)", () => {
		const state = createPerspectiveTiltState();
		// Run a few steps to settle
		let result = computePerspectiveTilt(state, {
			cursor: { cx: 0.5, cy: 0.5 },
			intensity: 1,
			deltaMs: 16.6,
			stageSize,
			baseMask,
		});

		expect(result.skewX).toBeCloseTo(0, 4);
		expect(result.skewY).toBeCloseTo(0, 4);
		expect(result.offsetX).toBeCloseTo(0, 2);
		expect(result.offsetY).toBeCloseTo(0, 2);
	});

	it("produces positive Y-skew (yaw) when cursor is at right (cx > 0.5)", () => {
		const state = createPerspectiveTiltState();
		// Step multiple frames
		let result = computePerspectiveTilt(state, {
			cursor: { cx: 1.0, cy: 0.5 },
			intensity: 1,
			deltaMs: 16.6,
			stageSize,
			baseMask,
		});

		for (let i = 0; i < 30; i++) {
			result = computePerspectiveTilt(state, {
				cursor: { cx: 1.0, cy: 0.5 },
				intensity: 1,
				deltaMs: 16.6,
				stageSize,
				baseMask,
			});
		}

		// Cursor at right => positive yaw skew
		expect(result.skewY).toBeGreaterThan(0.04);
		expect(result.skewY).toBeLessThanOrEqual(MAX_PERSPECTIVE_TILT_RAD + 0.001);
		// SkewX should remain approximately 0 since cy = 0.5
		expect(result.skewX).toBeCloseTo(0, 3);
	});

	it("produces negative X-skew (pitch) when cursor is at bottom (cy > 0.5)", () => {
		const state = createPerspectiveTiltState();
		let result = computePerspectiveTilt(state, {
			cursor: { cx: 0.5, cy: 1.0 },
			intensity: 1,
			deltaMs: 16.6,
			stageSize,
			baseMask,
		});

		for (let i = 0; i < 30; i++) {
			result = computePerspectiveTilt(state, {
				cursor: { cx: 0.5, cy: 1.0 },
				intensity: 1,
				deltaMs: 16.6,
				stageSize,
				baseMask,
			});
		}

		// Cursor at bottom => negative pitch skew
		expect(result.skewX).toBeLessThan(-0.04);
		expect(result.skewX).toBeGreaterThanOrEqual(-MAX_PERSPECTIVE_TILT_RAD - 0.001);
		expect(result.skewY).toBeCloseTo(0, 3);
	});

	it("applies tilt to container correctly", () => {
		const mockContainer = {
			skew: {
				x: 0,
				y: 0,
				set(x: number, y: number) {
					this.x = x;
					this.y = y;
				},
			},
			position: {
				x: 50,
				y: 60,
			},
		} as any;

		applyPerspectiveTilt(mockContainer, {
			skewX: 0.02,
			skewY: -0.03,
			offsetX: -5,
			offsetY: 7,
		});

		expect(mockContainer.skew.x).toBe(0.02);
		expect(mockContainer.skew.y).toBe(-0.03);
		expect(mockContainer.position.x).toBe(45);
		expect(mockContainer.position.y).toBe(67);
	});

	it("resets state back to 0", () => {
		const state = createPerspectiveTiltState();
		computePerspectiveTilt(state, {
			cursor: { cx: 1.0, cy: 1.0 },
			intensity: 1,
			deltaMs: 16.6,
			stageSize,
			baseMask,
		});

		resetPerspectiveTiltState(state);
		expect(state.pitchSpring.value).toBe(0);
		expect(state.pitchSpring.velocity).toBe(0);
		expect(state.yawSpring.value).toBe(0);
		expect(state.yawSpring.velocity).toBe(0);
	});
});
