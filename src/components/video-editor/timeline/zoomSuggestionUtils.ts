import { type AspectRatio, getAspectRatioValue } from "@/utils/aspectRatioUtils";
import type { CursorTelemetryPoint, ZoomDepth, ZoomFocus } from "../types";

export const MIN_DWELL_DURATION_MS = 450;
export const MAX_DWELL_DURATION_MS = 2600;
export const DWELL_MOVE_THRESHOLD = 0.02;

export interface ZoomDwellCandidate {
	centerTimeMs: number;
	focus: ZoomFocus;
	strength: number;
}

export interface CursorInteractionCandidate extends ZoomDwellCandidate {
	kind:
		| "dwell"
		| "click-like"
		| "double-click-like"
		| "text-focus-like"
		| "dropdown-open"
		| "text-selection"
		| "text-field-click";
	source: "explicit" | "heuristic";
}

export interface SuggestedZoomRegion {
	start: number;
	end: number;
	focus: ZoomFocus;
	depth?: ZoomDepth;
}

export type InteractionZoomSuggestionStatus =
	| "ok"
	| "no-telemetry"
	| "no-interactions"
	| "no-slots";

export interface InteractionZoomSuggestionResult {
	status: InteractionZoomSuggestionStatus;
	suggestions: SuggestedZoomRegion[];
}

/** Max gap between consecutive clicks before they are split into separate zoom clusters. */
export const CLICK_CLUSTER_MERGE_GAP_MS = 2500;
/** Padding added before the first click and after the last click in a cluster. */
export const CLICK_CLUSTER_PAD_MS = 500;
const EXPLICIT_CLICK_TYPES = new Set<NonNullable<CursorTelemetryPoint["interactionType"]>>([
	"click",
	"double-click",
	"right-click",
	"middle-click",
]);

function isExplicitClickType(
	interactionType: CursorTelemetryPoint["interactionType"],
): interactionType is NonNullable<CursorTelemetryPoint["interactionType"]> {
	return typeof interactionType === "string" && EXPLICIT_CLICK_TYPES.has(interactionType);
}

function normalizeTelemetrySample(
	sample: CursorTelemetryPoint,
	totalMs: number,
): CursorTelemetryPoint {
	return {
		timeMs: Math.max(0, Math.min(sample.timeMs, totalMs)),
		cx: Math.max(0, Math.min(sample.cx, 1)),
		cy: Math.max(0, Math.min(sample.cy, 1)),
		interactionType: sample.interactionType,
		cursorType: sample.cursorType,
	};
}

function applyCursorTypeInRange(
	samples: CursorTelemetryPoint[],
	startMs: number,
	endMs: number,
	cursorType: NonNullable<CursorTelemetryPoint["cursorType"]>,
) {
	for (const sample of samples) {
		if (sample.timeMs < startMs || sample.timeMs > endMs) continue;
		if (!sample.cursorType) {
			sample.cursorType = cursorType;
		}
	}
}

export function normalizeCursorTelemetry(
	telemetry: CursorTelemetryPoint[],
	totalMs: number,
): CursorTelemetryPoint[] {
	const normalized = [...telemetry]
		.filter(
			(sample) =>
				Number.isFinite(sample.timeMs) &&
				Number.isFinite(sample.cx) &&
				Number.isFinite(sample.cy),
		)
		.sort((a, b) => a.timeMs - b.timeMs)
		.map((sample) => normalizeTelemetrySample(sample, totalMs));

	const interactions = detectInteractionCandidates(normalized);
	for (const candidate of interactions) {
		if (candidate.kind === "text-selection") {
			applyCursorTypeInRange(
				normalized,
				candidate.centerTimeMs - 140,
				candidate.centerTimeMs + 1200,
				"text",
			);
			continue;
		}

		if (candidate.kind === "text-field-click" || candidate.kind === "text-focus-like") {
			applyCursorTypeInRange(
				normalized,
				candidate.centerTimeMs - 100,
				candidate.centerTimeMs + 900,
				"text",
			);
			continue;
		}
	}

	for (const sample of normalized) {
		if (sample.interactionType !== "click" && sample.interactionType !== "double-click") {
			continue;
		}

		const mouseUp = normalized.find(
			(candidate) =>
				candidate.timeMs > sample.timeMs && candidate.interactionType === "mouseup",
		);
		if (!mouseUp) {
			continue;
		}

		const dragDuration = mouseUp.timeMs - sample.timeMs;
		const dragDistance = Math.hypot(mouseUp.cx - sample.cx, mouseUp.cy - sample.cy);
		if (dragDuration >= 160 && dragDistance > 0.015) {
			const isTextDrag =
				Math.abs(mouseUp.cx - sample.cx) > Math.abs(mouseUp.cy - sample.cy) * 1.8;
			applyCursorTypeInRange(
				normalized,
				sample.timeMs,
				mouseUp.timeMs,
				isTextDrag ? "text" : "closed-hand",
			);
		}
	}

	return normalized;
}

export function detectZoomDwellCandidates(samples: CursorTelemetryPoint[]): ZoomDwellCandidate[] {
	if (samples.length < 2) {
		return [];
	}

	const dwellCandidates: ZoomDwellCandidate[] = [];
	let runStart = 0;

	const pushRunIfDwell = (startIndex: number, endIndexExclusive: number) => {
		if (endIndexExclusive - startIndex < 2) {
			return;
		}

		const start = samples[startIndex];
		const end = samples[endIndexExclusive - 1];
		const runDuration = end.timeMs - start.timeMs;
		if (runDuration < MIN_DWELL_DURATION_MS || runDuration > MAX_DWELL_DURATION_MS) {
			return;
		}

		const runSamples = samples.slice(startIndex, endIndexExclusive);
		const avgCx = runSamples.reduce((sum, sample) => sum + sample.cx, 0) / runSamples.length;
		const avgCy = runSamples.reduce((sum, sample) => sum + sample.cy, 0) / runSamples.length;

		dwellCandidates.push({
			centerTimeMs: Math.round((start.timeMs + end.timeMs) / 2),
			focus: { cx: avgCx, cy: avgCy },
			strength: runDuration,
		});
	};

	for (let index = 1; index < samples.length; index += 1) {
		const prev = samples[index - 1];
		const curr = samples[index];
		const distance = Math.hypot(curr.cx - prev.cx, curr.cy - prev.cy);

		if (distance > DWELL_MOVE_THRESHOLD) {
			pushRunIfDwell(runStart, index);
			runStart = index;
		}
	}
	pushRunIfDwell(runStart, samples.length);

	return dwellCandidates;
}

export function detectInteractionCandidates(
	samples: CursorTelemetryPoint[],
): CursorInteractionCandidate[] {
	// --- Phase 1: Explicit interaction events (from uiohook telemetry) ---
	const clickEvents = samples.filter((sample) => isExplicitClickType(sample.interactionType));

	const explicitInteractionCandidates: CursorInteractionCandidate[] = [];

	for (const clickSample of clickEvents) {
		// Classify what happened AFTER this click by analyzing cursor trajectory
		const kind = classifyPostClickBehavior(samples, clickSample);

		const baseStrength =
			kind === "double-click-like"
				? 1500
				: kind === "dropdown-open"
					? 1200
					: kind === "text-selection"
						? 1300
						: kind === "text-field-click"
							? 1100
							: 900;

		explicitInteractionCandidates.push({
			centerTimeMs: Math.round(clickSample.timeMs),
			focus: { cx: clickSample.cx, cy: clickSample.cy },
			strength: baseStrength,
			kind,
			source: "explicit",
		});
	}

	// --- Phase 2: Dwell-based heuristic candidates ---
	const dwellCandidates = detectZoomDwellCandidates(samples).map<CursorInteractionCandidate>(
		(candidate) => {
			if (candidate.strength >= 1100) {
				return { ...candidate, kind: "text-focus-like", source: "heuristic" };
			}
			if (candidate.strength <= 800) {
				return { ...candidate, kind: "click-like", source: "heuristic" };
			}
			return { ...candidate, kind: "dwell", source: "heuristic" };
		},
	);

	// --- Phase 3: Synthetic double-click detection from dwell pairs ---
	const doubleClickCandidates: CursorInteractionCandidate[] = [];
	const sortedByTime = [...dwellCandidates].sort((a, b) => a.centerTimeMs - b.centerTimeMs);

	for (let index = 1; index < sortedByTime.length; index += 1) {
		const prev = sortedByTime[index - 1];
		const curr = sortedByTime[index];
		const timeGap = curr.centerTimeMs - prev.centerTimeMs;
		const spatialGap = Math.hypot(curr.focus.cx - prev.focus.cx, curr.focus.cy - prev.focus.cy);
		const bothShort = prev.strength <= 900 && curr.strength <= 900;

		if (bothShort && timeGap <= 450 && spatialGap <= 0.035) {
			doubleClickCandidates.push({
				centerTimeMs: Math.round((prev.centerTimeMs + curr.centerTimeMs) / 2),
				focus: {
					cx: (prev.focus.cx + curr.focus.cx) / 2,
					cy: (prev.focus.cy + curr.focus.cy) / 2,
				},
				strength: prev.strength + curr.strength + 500,
				kind: "double-click-like",
				source: "heuristic",
			});
		}
	}

	return [...explicitInteractionCandidates, ...dwellCandidates, ...doubleClickCandidates];
}

/**
 * Computes bounding box, context-aware focus biasing, and adaptive depth
 * for a cluster of click interactions (RapidDemo & Screen Studio style).
 */
export function computeClusterFramingAndDepth(clicks: CursorInteractionCandidate[]): {
	focus: ZoomFocus;
	depth: ZoomDepth;
} {
	if (clicks.length === 0) {
		return { focus: { cx: 0.5, cy: 0.5 }, depth: 2 };
	}

	let minCx = clicks[0].focus.cx;
	let maxCx = clicks[0].focus.cx;
	let minCy = clicks[0].focus.cy;
	let maxCy = clicks[0].focus.cy;
	let bestStrength = clicks[0].strength;
	let bestFocus = clicks[0].focus;
	let primaryKind = clicks[0].kind;
	let sumCx = 0;
	let sumCy = 0;

	for (const click of clicks) {
		minCx = Math.min(minCx, click.focus.cx);
		maxCx = Math.max(maxCx, click.focus.cx);
		minCy = Math.min(minCy, click.focus.cy);
		maxCy = Math.max(maxCy, click.focus.cy);
		sumCx += click.focus.cx;
		sumCy += click.focus.cy;

		if (click.strength > bestStrength) {
			bestStrength = click.strength;
			bestFocus = click.focus;
			primaryKind = click.kind;
		}
	}

	const centroid = {
		cx: sumCx / clicks.length,
		cy: sumCy / clicks.length,
	};

	let targetFocus = bestFocus ?? centroid;

	// RapidDemo-style Context-Aware Focus Biasing
	if (primaryKind === "dropdown-open") {
		// User opened a dropdown menu: downward offset shows the unfolding options
		targetFocus = {
			cx: targetFocus.cx,
			cy: Math.min(0.92, targetFocus.cy + 0.06),
		};
	} else if (primaryKind === "text-selection") {
		// User highlighted text horizontally: center on the span
		targetFocus = {
			cx: (minCx + maxCx) / 2,
			cy: (minCy + maxCy) / 2,
		};
	} else if (primaryKind === "text-field-click") {
		// User clicked to type: slight rightward bias for incoming text
		targetFocus = {
			cx: Math.min(0.92, targetFocus.cx + 0.03),
			cy: targetFocus.cy,
		};
	}

	// Calculate cluster bounding box span
	const width = maxCx - minCx;
	const height = maxCy - minCy;
	const spanSize = Math.max(width, height);

	// Adaptive depth selection based on cluster footprint
	let depth: ZoomDepth;
	if (spanSize > 0.35) {
		depth = 1; // 1.25x wide overview
	} else if (spanSize > 0.22) {
		depth = 2; // 1.5x moderate
	} else if (spanSize > 0.12) {
		depth = 3; // 1.75x closer
	} else {
		// Tight cluster or single element
		if (primaryKind === "double-click-like" || primaryKind === "text-selection") {
			depth = 4; // 2.0x detail zoom
		} else if (primaryKind === "text-field-click") {
			depth = 3; // 1.75x readable text entry
		} else {
			depth = 2; // 1.5x standard clean focus
		}
	}

	return {
		focus: targetFocus,
		depth,
	};
}

/**
 * Groups a sorted list of click timestamps into clusters where consecutive
 * clicks are no more than `mergeGapMs` apart. Returns an array of
 * `{ firstMs, lastMs, focus, depth }` objects, one per cluster.
 */
function buildClickClusters(
	clicks: CursorInteractionCandidate[],
	mergeGapMs: number,
): Array<{ firstMs: number; lastMs: number; focus: ZoomFocus; depth: ZoomDepth }> {
	if (clicks.length === 0) {
		return [];
	}

	const sorted = [...clicks].sort((a, b) => a.centerTimeMs - b.centerTimeMs);
	const clusters: Array<{ firstMs: number; lastMs: number; focus: ZoomFocus; depth: ZoomDepth }> =
		[];

	let currentCluster: CursorInteractionCandidate[] = [sorted[0]];
	let clusterStart = sorted[0].centerTimeMs;
	let clusterEnd = sorted[0].centerTimeMs;

	for (let i = 1; i < sorted.length; i++) {
		const click = sorted[i];
		const gap = click.centerTimeMs - clusterEnd;

		if (gap <= mergeGapMs) {
			clusterEnd = Math.max(clusterEnd, click.centerTimeMs);
			currentCluster.push(click);
		} else {
			const framing = computeClusterFramingAndDepth(currentCluster);
			clusters.push({
				firstMs: clusterStart,
				lastMs: clusterEnd,
				focus: framing.focus,
				depth: framing.depth,
			});
			currentCluster = [click];
			clusterStart = click.centerTimeMs;
			clusterEnd = click.centerTimeMs;
		}
	}

	// Flush last cluster
	const framing = computeClusterFramingAndDepth(currentCluster);
	clusters.push({
		firstMs: clusterStart,
		lastMs: clusterEnd,
		focus: framing.focus,
		depth: framing.depth,
	});

	return clusters;
}

export function buildInteractionZoomSuggestions(params: {
	cursorTelemetry: CursorTelemetryPoint[];
	totalMs: number;
	defaultDurationMs: number;
	reservedSpans?: Array<{ start: number; end: number }>;
	spacingMs?: number;
	mergeGapMs?: number;
	padMs?: number;
}): InteractionZoomSuggestionResult {
	const {
		cursorTelemetry,
		totalMs,
		reservedSpans = [],
		mergeGapMs = CLICK_CLUSTER_MERGE_GAP_MS,
		padMs = CLICK_CLUSTER_PAD_MS,
	} = params;

	if (totalMs <= 0) {
		return { status: "no-slots", suggestions: [] };
	}

	const normalizedSamples = normalizeCursorTelemetry(cursorTelemetry, totalMs);
	if (normalizedSamples.length === 0) {
		return { status: "no-telemetry", suggestions: [] };
	}

	if (
		normalizedSamples.length === 1 &&
		!isExplicitClickType(normalizedSamples[0].interactionType)
	) {
		return { status: "no-telemetry", suggestions: [] };
	}

	// Only use explicit click events (uiohook telemetry) – ignore dwell heuristics
	const clickCandidates = detectInteractionCandidates(normalizedSamples).filter(
		(candidate) => candidate.source === "explicit",
	);

	if (clickCandidates.length === 0) {
		return { status: "no-interactions", suggestions: [] };
	}

	// Group nearby clicks into clusters, then derive zoom windows from those clusters
	const clusters = buildClickClusters(clickCandidates, mergeGapMs);

	const reserved = [...reservedSpans].sort((a, b) => a.start - b.start);
	const suggestions: SuggestedZoomRegion[] = [];

	for (const cluster of clusters) {
		const regionStart = Math.max(0, cluster.firstMs - padMs);
		const regionEnd = Math.min(totalMs, cluster.lastMs + padMs);

		if (regionEnd <= regionStart) {
			continue;
		}

		const hasOverlap = reserved.some(
			(span) => regionEnd > span.start && regionStart < span.end,
		);

		if (hasOverlap) {
			continue;
		}

		reserved.push({ start: regionStart, end: regionEnd });
		suggestions.push({
			start: regionStart,
			end: regionEnd,
			focus: cluster.focus,
			depth: cluster.depth,
		});
	}

	if (suggestions.length === 0) {
		return { status: "no-slots", suggestions: [] };
	}

	// Sort chronologically
	suggestions.sort((a, b) => a.start - b.start);

	return { status: "ok", suggestions };
}

/**
 * Analyzes cursor movement after a click to classify the interaction pattern.
 *
 * - **dropdown-open**: click followed by slow downward cursor movement (browsing items)
 * - **text-selection**: click followed by primarily horizontal drag movement
 * - **text-field-click**: click followed by cursor staying mostly still (dwell)
 * - **double-click-like**: explicit double-click interaction type
 * - **click-like**: generic click with no recognizable post-click pattern
 */
function classifyPostClickBehavior(
	samples: CursorTelemetryPoint[],
	clickSample: CursorTelemetryPoint,
): CursorInteractionCandidate["kind"] {
	// Explicit double-click from uiohook
	if (clickSample.interactionType === "double-click") {
		return "double-click-like";
	}

	const clickTime = clickSample.timeMs;

	// Check for mouseup shortly after (drag detection)
	const mouseUpAfter = samples.find(
		(s) =>
			s.interactionType === "mouseup" && s.timeMs > clickTime && s.timeMs - clickTime < 3000,
	);

	if (mouseUpAfter) {
		const dragDx = Math.abs(mouseUpAfter.cx - clickSample.cx);
		const dragDy = Math.abs(mouseUpAfter.cy - clickSample.cy);
		const dragDuration = mouseUpAfter.timeMs - clickTime;

		// Text selection: horizontal drag > 3% of screen, mostly horizontal, duration 200ms+
		if (dragDuration >= 200 && dragDx > 0.03 && dragDx > dragDy * 1.8) {
			return "text-selection";
		}
	}

	// Analyze trajectory in the 400ms-2000ms window after click
	const moveSamples = samples.filter(
		(s) =>
			s.timeMs > clickTime + 100 &&
			s.timeMs <= clickTime + 2000 &&
			(s.interactionType === "move" || !s.interactionType),
	);

	if (moveSamples.length < 3) {
		// Very few move samples after click = cursor stayed still = text field click
		return "text-field-click";
	}

	// Compute displacement from click position
	let maxDist = 0;
	let totalAbsDy = 0;
	let totalAbsDx = 0;
	for (const s of moveSamples) {
		const dist = Math.hypot(s.cx - clickSample.cx, s.cy - clickSample.cy);
		maxDist = Math.max(maxDist, dist);
		totalAbsDx += Math.abs(s.cx - clickSample.cx);
		totalAbsDy += Math.abs(s.cy - clickSample.cy);
	}

	// Cursor barely moved after click: text field click (dwell)
	if (maxDist < 0.02) {
		return "text-field-click";
	}

	// Primarily downward movement after click: dropdown open
	const lastMoveSample = moveSamples[moveSamples.length - 1];
	const netDy = lastMoveSample.cy - clickSample.cy;

	if (netDy > 0.03 && totalAbsDy > totalAbsDx * 1.5) {
		return "dropdown-open";
	}

	// Primarily horizontal movement: text selection (fallback if no mouseup)
	if (totalAbsDx > 0.03 && totalAbsDx > totalAbsDy * 1.8) {
		return "text-selection";
	}

	return "click-like";
}

export interface AutoReframeParams {
	cursorTelemetry: CursorTelemetryPoint[];
	totalMs: number;
	targetAspectRatio: AspectRatio;
	sourceAspectRatio?: number;
	reservedSpans?: Array<{ start: number; end: number }>;
	mergeGapMs?: number;
	padMs?: number;
	minDurationMs?: number;
}

/**
 * Builds automated framing and zoom suggestions specifically calibrated for
 * social aspect ratios (e.g. 9:16 Shorts/TikTok, 1:1 Square, 4:5 Portrait).
 *
 * Keeps active cursor clicks and dwell interactions centered within the visible
 * social safe-zone, avoiding mobile UI dead-zones (top status, bottom captions, right icons).
 */
export function buildAutoReframeSuggestions(
	params: AutoReframeParams,
): InteractionZoomSuggestionResult {
	const {
		cursorTelemetry,
		totalMs,
		targetAspectRatio,
		sourceAspectRatio = 16 / 9,
		reservedSpans = [],
		mergeGapMs = CLICK_CLUSTER_MERGE_GAP_MS,
		padMs = CLICK_CLUSTER_PAD_MS,
		minDurationMs = 1200,
	} = params;

	if (totalMs <= 0) {
		return { status: "no-slots", suggestions: [] };
	}

	const normalizedSamples = normalizeCursorTelemetry(cursorTelemetry, totalMs);
	if (normalizedSamples.length === 0) {
		return { status: "no-telemetry", suggestions: [] };
	}

	const targetRatioValue = getAspectRatioValue(targetAspectRatio, sourceAspectRatio);
	const isVertical = targetRatioValue < 0.75; // e.g. 9:16 (~0.5625)
	const isSquareOrPortrait = targetRatioValue >= 0.75 && targetRatioValue < 1.1; // e.g. 1:1, 4:5 (0.8)

	// In vertical / mobile feeds, we require closer zoom (depth 3 = 1.75x or 4 = 2.0x) so text is legible
	const baseSocialDepth: ZoomDepth = isVertical ? 3 : isSquareOrPortrait ? 2 : 2;

	const allCandidates = detectInteractionCandidates(normalizedSamples);
	// Prioritize explicit clicks; fallback to high-confidence dwells if no clicks found
	let candidates = allCandidates.filter((c) => c.source === "explicit");
	if (candidates.length === 0) {
		candidates = allCandidates.filter((c) => c.strength >= 0.45);
	}

	if (candidates.length === 0) {
		return { status: "no-interactions", suggestions: [] };
	}

	const clusters = buildClickClusters(candidates, mergeGapMs);
	const reserved = [...reservedSpans].sort((a, b) => a.start - b.start);
	const suggestions: SuggestedZoomRegion[] = [];

	for (const cluster of clusters) {
		let regionStart = Math.max(0, cluster.firstMs - padMs);
		let regionEnd = Math.min(totalMs, cluster.lastMs + padMs);

		// Ensure minimum duration for smooth camera movement
		if (regionEnd - regionStart < minDurationMs) {
			const diff = minDurationMs - (regionEnd - regionStart);
			regionStart = Math.max(0, regionStart - diff / 2);
			regionEnd = Math.min(totalMs, regionEnd + diff / 2);
		}

		if (regionEnd <= regionStart) {
			continue;
		}

		const hasOverlap = reserved.some(
			(span) => regionEnd > span.start && regionStart < span.end,
		);

		if (hasOverlap) {
			continue;
		}

		// Adjust focus for mobile safe-zones
		const targetFocus = { ...cluster.focus };
		const targetDepth: ZoomDepth = Math.max(cluster.depth, baseSocialDepth) as ZoomDepth;

		if (isVertical) {
			// TikTok / Reels safe zone biasing:
			// Bottom 20% is obscured by user avatar/captions/sound bar
			if (targetFocus.cy > 0.78) {
				targetFocus.cy = Math.max(0.2, targetFocus.cy - 0.08);
			} else if (targetFocus.cy < 0.16) {
				targetFocus.cy = Math.min(0.8, targetFocus.cy + 0.05);
			}

			// Right 16% is obscured by Like, Comment, Bookmark, Share icons
			if (targetFocus.cx > 0.82) {
				targetFocus.cx = Math.max(0.18, targetFocus.cx - 0.07);
			}
		}

		// Clamp focus to valid bounds (0.05 - 0.95)
		targetFocus.cx = Math.max(0.05, Math.min(0.95, targetFocus.cx));
		targetFocus.cy = Math.max(0.05, Math.min(0.95, targetFocus.cy));

		reserved.push({ start: regionStart, end: regionEnd });
		suggestions.push({
			start: regionStart,
			end: regionEnd,
			focus: targetFocus,
			depth: targetDepth,
		});
	}

	if (suggestions.length === 0) {
		return { status: "no-slots", suggestions: [] };
	}

	suggestions.sort((a, b) => a.start - b.start);
	return { status: "ok", suggestions };
}
