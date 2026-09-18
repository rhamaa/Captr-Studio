import type { Span } from "dnd-timeline";
import { useCallback, useImperativeHandle } from "react";
import type { ForwardedRef, RefObject } from "react";
import type { TimelineShortcutBindings } from "../core/timelineTypes";
import { useTimelineDndBindings } from "./useTimelineDndBindings";
import { useTimelineAudioActions } from "./actions/useTimelineAudioActions";
import { useTimelineKeyboardShortcuts } from "./useTimelineKeyboardShortcuts";
import { useTimelineNormalization } from "./useTimelineNormalization";
import { useTimelineSelection } from "./useTimelineSelection";
import { useTimelineZoomActions } from "./actions/useTimelineZoomActions";
import { DEFAULT_LAYOUT_SCENE_DURATION_MS } from "../../types";
import type {
	AnnotationRegion,
	AudioRegion,
	ClipRegion,
	CursorTelemetryPoint,
	LayoutRegion,
	SpeedRegion,
	TrimRegion,
	ZoomFocus,
	ZoomRegion,
} from "../../types";
import type { TimelineEditorHandle } from "../TimelineEditor";

interface UseTimelineEditorRuntimeParams {
	ref: ForwardedRef<TimelineEditorHandle>;
	videoDuration: number;
	totalMs: number;
	currentTimeMs: number;
	safeMinDurationMs: number;
	cursorTelemetry: CursorTelemetryPoint[];
	autoSuggestZoomsTrigger: number;
	onAutoSuggestZoomsConsumed?: () => void;
	disableSuggestedZooms: boolean;
	zoomRegions: ZoomRegion[];
	onZoomAdded: (span: Span) => void;
	onZoomSuggested?: (span: Span, focus: ZoomFocus) => void;
	onZoomSpanChange: (id: string, span: Span) => void;
	onZoomDelete: (id: string) => void;
	selectedZoomId: string | null;
	onSelectZoom: (id: string | null) => void;
	trimRegions: TrimRegion[];
	onTrimSpanChange?: (id: string, span: Span) => void;
	clipRegions: ClipRegion[];
	onClipSplit?: (splitMs: number) => void;
	onClipSpanChange?: (id: string, span: Span) => void;
	onClipDelete?: (id: string, ripple?: boolean) => void;
	selectedClipId?: string | null;
	onSelectClip?: (id: string | null) => void;
	layoutRegions: LayoutRegion[];
	onLayoutAdded?: (span: Span) => void;
	onLayoutSpanChange?: (id: string, span: Span) => void;
	onLayoutDelete?: (id: string) => void;
	selectedLayoutId?: string | null;
	onSelectLayout?: (id: string | null) => void;
	annotationRegions: AnnotationRegion[];
	onAnnotationAdded?: (span: Span, trackIndex?: number) => void;
	onAnnotationSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onAnnotationDelete?: (id: string) => void;
	onAnnotationKeyframesChange?: (id: string, keyframes: import("../../types").PropertyKeyframe[]) => void;
	selectedAnnotationId?: string | null;
	onSelectAnnotation?: (id: string | null) => void;
	speedRegions: SpeedRegion[];
	onSpeedSpanChange?: (id: string, span: Span) => void;
	audioRegions: AudioRegion[];
	onAudioAdded?: (span: Span, audioPath: string, trackIndex?: number) => void;
	onAudioSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onAudioDelete?: (id: string) => void;
	selectedAudioId?: string | null;
	onSelectAudio?: (id: string | null) => void;
	isMac: boolean;
	keyShortcuts: TimelineShortcutBindings;
	isTimelineFocusedRef: RefObject<boolean>;
}

export function useTimelineEditorRuntime({
	ref,
	videoDuration,
	totalMs,
	currentTimeMs,
	safeMinDurationMs,
	cursorTelemetry,
	autoSuggestZoomsTrigger,
	onAutoSuggestZoomsConsumed,
	disableSuggestedZooms,
	zoomRegions,
	onZoomAdded,
	onZoomSuggested,
	onZoomSpanChange,
	onZoomDelete,
	selectedZoomId,
	onSelectZoom,
	trimRegions,
	onTrimSpanChange,
	clipRegions,
	onClipSplit,
	onClipSpanChange,
	onClipDelete,
	selectedClipId,
	onSelectClip,
	layoutRegions,
	onLayoutAdded,
	onLayoutSpanChange,
	onLayoutDelete,
	selectedLayoutId,
	onSelectLayout,
	annotationRegions,
	onAnnotationAdded,
	onAnnotationSpanChange,
	onAnnotationDelete,
		onAnnotationKeyframesChange,
	selectedAnnotationId,
	onSelectAnnotation,
	speedRegions,
	onSpeedSpanChange,
	audioRegions,
	onAudioAdded,
	onAudioSpanChange,
	onAudioDelete,
	selectedAudioId,
	onSelectAudio,
	isMac,
	keyShortcuts,
	isTimelineFocusedRef,
}: UseTimelineEditorRuntimeParams) {
	const {
		keyframes,
		selectedKeyframeId,
		setSelectedKeyframeId,
		selectAllBlocksActive,
		setSelectAllBlocksActive,
		hasAnyTimelineBlocks,
		addKeyframe,
		deleteSelectedKeyframe,
		handleKeyframeMove,
		deleteSelectedZoom,
		deleteSelectedClip,
		deleteSelectedLayout,
		deleteSelectedAnnotation,
		deleteSelectedAudio,
		clearSelectedBlocks,
		deleteAllBlocks,
		handleSelectZoom,
		handleSelectClip,
		handleSelectLayout,
		handleSelectAnnotation,
		handleSelectAudio,
		cycleAnnotationsAtCurrentTime,
	} = useTimelineSelection({
		totalMs,
		currentTimeMs,
		zoomRegions,
		clipRegions,
		layoutRegions,
		annotationRegions,
		audioRegions,
		selectedZoomId,
		selectedClipId,
		selectedLayoutId,
		selectedAnnotationId,
		selectedAudioId,
		onZoomDelete,
		onClipDelete,
		onLayoutDelete,
		onAnnotationDelete,
		onAnnotationKeyframesChange,
		onAudioDelete,
		onSelectZoom,
		onSelectClip,
		onSelectLayout,
		onSelectAnnotation,
		onSelectAudio,
	});

	useTimelineNormalization({
		totalMs,
		safeMinDurationMs,
		zoomRegions,
		trimRegions,
		speedRegions,
		audioRegions,
		onZoomSpanChange,
		onTrimSpanChange,
		onSpeedSpanChange,
		onAudioSpanChange,
	});

	const { hasOverlap, timelineItems, allRegionSpans, getResolvedDropRowId, handleItemSpanChange } =
		useTimelineDndBindings({
			zoomRegions,
			trimRegions,
			clipRegions,
			layoutRegions,
			annotationRegions,
			speedRegions,
			audioRegions,
			onZoomSpanChange,
			onTrimSpanChange,
			onClipSpanChange,
			onLayoutSpanChange,
			onAnnotationSpanChange,
			onSpeedSpanChange,
			onAudioSpanChange,
		});

	const { defaultRegionDurationMs, canPlaceZoomAtMs, addZoomAtMs, handleAddZoom, handleSuggestZooms } =
		useTimelineZoomActions({
			timeline: { videoDuration, totalMs, currentTimeMs },
			regions: { zoom: zoomRegions, clip: clipRegions },
			cursorTelemetry,
			options: { disableSuggestedZooms },
			autoSuggestZoomsTrigger,
			onAutoSuggestZoomsConsumed,
			onZoomAdded,
			onZoomSuggested,
		});

	const handleSplitClip = useCallback(() => {
		if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onClipSplit) {
			return;
		}
		onClipSplit(currentTimeMs);
	}, [videoDuration, totalMs, currentTimeMs, onClipSplit]);

	const defaultLayoutDurationMs = Math.min(DEFAULT_LAYOUT_SCENE_DURATION_MS, totalMs);
	const canPlaceLayoutAtMs = useCallback(
		(startMs: number) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || defaultLayoutDurationMs <= 0) {
				return false;
			}

			const startPos = Math.max(0, Math.min(startMs, totalMs));
			const activeClip =
				clipRegions.length === 0
					? { startMs: 0, endMs: totalMs }
					: clipRegions.find((clip) => startPos >= clip.startMs && startPos < clip.endMs);
			if (!activeClip) return false;

			const sorted = [...layoutRegions].sort((left, right) => left.startMs - right.startMs);
			const nextRegion = sorted.find((region) => region.startMs > startPos);
			const gapToClipEnd = activeClip.endMs - startPos;
			const gapToNextRegion = nextRegion ? nextRegion.startMs - startPos : gapToClipEnd;
			const availableDuration = Math.min(gapToClipEnd, gapToNextRegion);
			const isOverlapping = sorted.some(
				(region) => startPos >= region.startMs && startPos < region.endMs,
			);

			return !isOverlapping && availableDuration >= defaultLayoutDurationMs;
		},
		[videoDuration, totalMs, defaultLayoutDurationMs, clipRegions, layoutRegions],
	);

	const addLayoutAtMs = useCallback(
		(startMs: number) => {
			if (!onLayoutAdded || !canPlaceLayoutAtMs(startMs)) {
				return;
			}
			const startPos = Math.max(0, Math.min(startMs, totalMs - defaultLayoutDurationMs));
			onLayoutAdded({ start: startPos, end: startPos + defaultLayoutDurationMs });
		},
		[canPlaceLayoutAtMs, defaultLayoutDurationMs, onLayoutAdded, totalMs],
	);

	const handleAddLayout = useCallback(() => {
		if (!videoDuration || videoDuration === 0 || totalMs === 0) {
			return;
		}
		const defaultDuration = defaultLayoutDurationMs;
		const latestStartPos = Math.max(0, totalMs - defaultDuration);
		const startPos = Math.max(0, Math.min(currentTimeMs, latestStartPos));
		addLayoutAtMs(startPos);
	}, [videoDuration, totalMs, currentTimeMs, defaultLayoutDurationMs, addLayoutAtMs]);

	const { handleAddAudio } = useTimelineAudioActions({
		timeline: { videoDuration, totalMs, currentTimeMs },
		regions: { audio: audioRegions },
		onAudioAdded,
	});

	const handleAddAnnotation = useCallback(
		(trackIndex = 0) => {
			if (!videoDuration || videoDuration === 0 || totalMs === 0 || !onAnnotationAdded) {
				return;
			}

			const defaultDuration = Math.min(defaultRegionDurationMs, totalMs);
			if (defaultDuration <= 0) {
				return;
			}

			const latestStartPos = Math.max(0, totalMs - defaultDuration);
			const startPos = Math.max(0, Math.min(currentTimeMs, latestStartPos));
			const endPos = Math.min(startPos + defaultDuration, totalMs);
			onAnnotationAdded({ start: startPos, end: endPos }, trackIndex);
		},
		[videoDuration, totalMs, currentTimeMs, defaultRegionDurationMs, onAnnotationAdded],
	);

	useTimelineKeyboardShortcuts({
		isMac,
		keyShortcuts,
		isTimelineFocusedRef,
		hasAnyTimelineBlocks,
		annotationCount: annotationRegions.length,
		selectedKeyframeId,
		selectedZoomId,
		selectedClipId,
		selectedLayoutId,
		selectedAnnotationId,
		selectedAudioId,
		selectAllBlocksActive,
		setSelectAllBlocksActive,
		setSelectedKeyframeId,
		addKeyframe,
		handleAddZoom,
		handleSplitClip,
		handleAddAnnotation: () => handleAddAnnotation(),
		deleteAllBlocks,
		deleteSelectedKeyframe,
		deleteSelectedZoom,
		deleteSelectedClip,
		deleteSelectedLayout,
		deleteSelectedAnnotation,
		deleteSelectedAudio,
		cycleAnnotationsAtCurrentTime,
	});

	useImperativeHandle(
		ref,
		() => ({
			addZoom: handleAddZoom,
			suggestZooms: handleSuggestZooms,
			splitClip: handleSplitClip,
			addLayout: handleAddLayout,
			addAnnotation: handleAddAnnotation,
			addAudio: handleAddAudio,
			keyframes,
		}),
		[
			handleAddAnnotation,
			handleAddAudio,
			handleAddLayout,
			handleAddZoom,
			handleSuggestZooms,
			handleSplitClip,
			keyframes,
		],
	);

	return {
		keyframes,
		selectedKeyframeId,
		setSelectedKeyframeId,
		selectAllBlocksActive,
		setSelectAllBlocksActive,
		handleKeyframeMove,
		clearSelectedBlocks,
		handleSelectZoom,
		handleSelectClip,
		handleSelectLayout,
		handleSelectAnnotation,
		handleSelectAudio,
		hasOverlap,
		timelineItems,
		allRegionSpans,
		getResolvedDropRowId,
		handleItemSpanChange,
		canPlaceZoomAtMs,
		addZoomAtMs,
		canPlaceLayoutAtMs,
		addLayoutAtMs,
		handleAddZoom,
		handleSuggestZooms,
		handleSplitClip,
		handleAddLayout,
		handleAddAudio,
		handleAddAnnotation,
	};
}
