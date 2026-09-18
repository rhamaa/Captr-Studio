import type { ClipTransition, ClipTransitionType } from "./types";

export const CLIP_TRANSITION_TYPES = [
	"none",
	"fade-black",
	"fade-white",
	"slide-left",
	"slide-right",
	"zoom-push",
] as const satisfies readonly ClipTransitionType[];

export function normalizeClipTransitionType(value: unknown): ClipTransitionType {
	// Older project files used a directionless slide name.
	if (value === "slide") return "slide-left";
	return CLIP_TRANSITION_TYPES.includes(value as ClipTransitionType)
		? (value as ClipTransitionType)
		: "none";
}

export function normalizeClipTransition(value: unknown): ClipTransition | undefined {
	if (!value || typeof value !== "object") return undefined;
	const transition = value as Record<string, unknown>;
	return {
		type: normalizeClipTransitionType(transition.type),
		durationMs:
			typeof transition.durationMs === "number" && Number.isFinite(transition.durationMs)
				? Math.max(0, Math.round(transition.durationMs))
				: 400,
	};
}
