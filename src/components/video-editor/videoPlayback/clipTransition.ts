import { Container, Graphics } from "pixi.js";
import type { ClipRegion, ClipTransitionType } from "../types";

export interface ClipTransitionState {
	transition: ClipTransitionType;
	progress: number;
}

/**
 * Calculates current active transition state for given timeline time.
 */
export function getActiveClipTransition(
	clips: ClipRegion[] | undefined,
	timelineTimeMs: number,
): ClipTransitionState | null {
	if (!clips || clips.length === 0) return null;

	for (const clip of clips) {
		if (timelineTimeMs >= clip.startMs && timelineTimeMs < clip.endMs) {
			const transition = clip.transitionIn;
			if (!transition || transition === "none") return null;

			const duration = clip.transitionInDurationMs ?? 400;
			if (duration <= 0) return null;

			const elapsed = timelineTimeMs - clip.startMs;
			if (elapsed < 0 || elapsed > duration) return null;

			const progress = Math.max(0, Math.min(1, elapsed / duration));
			return { transition, progress };
		}
	}
	return null;
}

export interface ApplyClipTransitionOptions {
	transitionState: ClipTransitionState | null;
	videoContainer: Container;
	overlayGraphics?: Graphics | null;
	bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Applies transition effect on PixiJS video container and optional overlay graphics.
 * Both VideoPlayback (preview) and modernFrameRenderer (export) use this for identical results.
 */
export function applyClipTransition({
	transitionState,
	videoContainer,
	overlayGraphics,
	bounds,
}: ApplyClipTransitionOptions): void {
	if (!transitionState || transitionState.transition === "none") {
		videoContainer.alpha = 1;
		videoContainer.position.set(0, 0);
		videoContainer.scale.set(1, 1);
		if (overlayGraphics) {
			overlayGraphics.clear();
			overlayGraphics.visible = false;
		}
		return;
	}

	const { transition, progress } = transitionState;
	// Cubic ease-out curve for natural, cinematic deceleration: f(t) = 1 - (1 - t)^3
	const eased = 1 - Math.pow(1 - progress, 3);

	switch (transition) {
		case "fade-black": {
			videoContainer.alpha = eased;
			videoContainer.position.set(0, 0);
			videoContainer.scale.set(1, 1);

			if (overlayGraphics) {
				overlayGraphics.visible = true;
				overlayGraphics.clear();
				overlayGraphics.rect(bounds.x, bounds.y, bounds.width, bounds.height);
				overlayGraphics.fill({ color: 0x000000, alpha: Math.max(0, 1 - eased) });
			}
			break;
		}
		case "fade-white": {
			videoContainer.alpha = 1;
			videoContainer.position.set(0, 0);
			videoContainer.scale.set(1, 1);

			if (overlayGraphics) {
				overlayGraphics.visible = true;
				overlayGraphics.clear();
				overlayGraphics.rect(bounds.x, bounds.y, bounds.width, bounds.height);
				overlayGraphics.fill({ color: 0xffffff, alpha: Math.max(0, (1 - eased) * 0.95) });
			}
			break;
		}
		case "zoom-push": {
			const scale = 1.0 + (1 - eased) * 0.12;
			const alpha = Math.min(1, progress * 3);
			videoContainer.alpha = alpha;

			const centerX = bounds.x + bounds.width / 2;
			const centerY = bounds.y + bounds.height / 2;
			videoContainer.scale.set(scale);
			videoContainer.position.set(centerX * (1 - scale), centerY * (1 - scale));

			if (overlayGraphics) {
				overlayGraphics.clear();
				overlayGraphics.visible = false;
			}
			break;
		}
		case "slide-left": {
			const offset = (1 - eased) * (bounds.width * 0.35);
			videoContainer.alpha = Math.min(1, progress * 2.5);
			videoContainer.scale.set(1, 1);
			videoContainer.position.set(offset, 0);

			if (overlayGraphics) {
				overlayGraphics.clear();
				overlayGraphics.visible = false;
			}
			break;
		}
		case "slide-right": {
			const offset = -(1 - eased) * (bounds.width * 0.35);
			videoContainer.alpha = Math.min(1, progress * 2.5);
			videoContainer.scale.set(1, 1);
			videoContainer.position.set(offset, 0);

			if (overlayGraphics) {
				overlayGraphics.clear();
				overlayGraphics.visible = false;
			}
			break;
		}
		default: {
			videoContainer.alpha = 1;
			videoContainer.position.set(0, 0);
			videoContainer.scale.set(1, 1);
			if (overlayGraphics) {
				overlayGraphics.clear();
				overlayGraphics.visible = false;
			}
		}
	}
}
