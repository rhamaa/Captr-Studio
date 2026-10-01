import { useCallback } from "react";
import type { Span } from "dnd-timeline";
import { toast } from "sonner";
import { buildAutoReframeSuggestions } from "@/components/video-editor/timeline/zoomSuggestionUtils";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type {
	CursorTelemetryPoint,
	ZoomDepth,
	ZoomFocus,
	ZoomRegion,
} from "@/components/video-editor/types";

interface UseRecordingAutoReframeOptions {
	cursorTelemetry: CursorTelemetryPoint[];
	duration: number;
	aspectRatio: AspectRatio;
	zoomRegions: ZoomRegion[];
	onZoomSuggested: (span: Span, focus: ZoomFocus, depth?: ZoomDepth) => void;
}

interface RecordSlideSourceDimensions {
	width: number;
	height: number;
}

/** Builds and applies Record slide auto-reframe suggestions from cursor telemetry. */
export function useRecordingAutoReframe({
	cursorTelemetry,
	duration,
	aspectRatio,
	zoomRegions,
	onZoomSuggested,
}: UseRecordingAutoReframeOptions) {
	return useCallback(
		({ width, height }: RecordSlideSourceDimensions) => {
			if (!cursorTelemetry.length || duration <= 0) return;

			const sourceAspectRatio = height > 0 ? width / height : 16 / 9;
			const result = buildAutoReframeSuggestions({
				cursorTelemetry,
				totalMs: duration * 1000,
				targetAspectRatio: aspectRatio,
				sourceAspectRatio,
				reservedSpans: zoomRegions.map((region) => ({
					start: region.startMs,
					end: region.endMs,
				})),
			});

			if (result.status !== "ok" || result.suggestions.length === 0) {
				toast.error("No auto-reframe suggestions found for this video.");
				return;
			}

			for (const suggestion of result.suggestions) {
				onZoomSuggested(
					{ start: suggestion.start, end: suggestion.end },
					suggestion.focus,
					suggestion.depth,
				);
			}
			toast.success(`Auto-reframed ${result.suggestions.length} scene(s) for ${aspectRatio}`);
		},
		[cursorTelemetry, duration, aspectRatio, zoomRegions, onZoomSuggested],
	);
}
