import { describe, expect, it } from "vitest";
import { getActiveClipTransition, applyClipTransition } from "./clipTransition";
import type { ClipRegion } from "../types";
import { Container, Graphics } from "pixi.js";

describe("clipTransition", () => {
	const mockClips: ClipRegion[] = [
		{
			id: "clip-1",
			startMs: 0,
			endMs: 5000,
			speed: 1,
			transitionIn: "none",
		},
		{
			id: "clip-2",
			startMs: 5000,
			endMs: 10000,
			speed: 1,
			transitionIn: "fade-black",
			transitionInDurationMs: 500,
		},
		{
			id: "clip-3",
			startMs: 10000,
			endMs: 15000,
			speed: 1,
			transitionIn: "zoom-push",
			transitionInDurationMs: 400,
		},
	];

	it("returns null when no transition is active", () => {
		expect(getActiveClipTransition(mockClips, 2000)).toBeNull();
		expect(getActiveClipTransition(mockClips, 6000)).toBeNull(); // elapsed > 500ms
	});

	it("returns correct progress during transition", () => {
		const state = getActiveClipTransition(mockClips, 5250);
		expect(state).not.toBeNull();
		expect(state?.transition).toBe("fade-black");
		expect(state?.progress).toBeCloseTo(0.5, 2);
	});

	it("applies fade-black transition to videoContainer and overlayGraphics", () => {
		const videoContainer = new Container();
		const overlayGraphics = new Graphics();
		const bounds = { x: 0, y: 0, width: 1920, height: 1080 };

		applyClipTransition({
			transitionState: { transition: "fade-black", progress: 0.5 },
			videoContainer,
			overlayGraphics,
			bounds,
		});

		// Eased progress for 0.5 is 1 - (1-0.5)^3 = 0.875
		expect(videoContainer.alpha).toBeCloseTo(0.875, 2);
		expect(overlayGraphics.visible).toBe(true);

		// Resets when transition is null
		applyClipTransition({
			transitionState: null,
			videoContainer,
			overlayGraphics,
			bounds,
		});

		expect(videoContainer.alpha).toBe(1);
		expect(overlayGraphics.visible).toBe(false);
	});

	it("applies zoom-push transition scaling", () => {
		const videoContainer = new Container();
		const bounds = { x: 0, y: 0, width: 1000, height: 1000 };

		applyClipTransition({
			transitionState: { transition: "zoom-push", progress: 0 },
			videoContainer,
			bounds,
		});

		// At progress 0, scale should be 1.12
		expect(videoContainer.scale.x).toBeCloseTo(1.12, 2);
	});
});
