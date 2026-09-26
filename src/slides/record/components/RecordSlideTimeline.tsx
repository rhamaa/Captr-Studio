import { Plus } from "@phosphor-icons/react";
import type { Span } from "dnd-timeline";
import React, { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import type {
	SourceAudioTrackMeta,
	SourceAudioTrackSettings,
	SourceAudioTrackWithPeaks,
} from "@/components/video-editor/audio/audioTypes";
import KeyframeMarkers from "@/components/video-editor/timeline/components/markers/KeyframeMarkers";
import TimelineCanvas from "@/components/video-editor/timeline/components/viewport/TimelineCanvas";
import TimelineWrapper from "@/components/video-editor/timeline/components/wrapper/TimelineWrapper";
import { calculateTimelineScale } from "@/components/video-editor/timeline/core/time";
import type { SlideMedia4in1 } from "@/components/video-editor/timeline/core/timelineTypes";
import { useTimelineAudioPeaks } from "@/components/video-editor/timeline/hooks/useTimelineAudioPeaks";
import { useTimelineEditorRuntime } from "@/components/video-editor/timeline/hooks/useTimelineEditorRuntime";
import { useTimelineRange } from "@/components/video-editor/timeline/hooks/useTimelineRange";
import type {
	AnnotationRegion,
	AudioRegion,
	ClipRegion,
	CursorTelemetryPoint,
	LayoutRegion,
	SlideAssetFile,
	SpeedRegion,
	TrimRegion,
	ZoomFocus,
	ZoomRegion,
} from "@/components/video-editor/types";
import { useScopedT } from "@/contexts/I18nContext";
import { useShortcuts } from "@/contexts/ShortcutsContext";

export interface RecordSlideTimelineProps {
	recordToolsEnabled?: boolean;
	videoDuration: number;
	currentTime: number;
	playheadTime?: number;
	onSeek?: (time: number) => void;
	cursorTelemetry?: CursorTelemetryPoint[];
	autoSuggestZoomsTrigger?: number;
	onAutoSuggestZoomsConsumed?: () => void;
	disableSuggestedZooms?: boolean;
	zoomRegions: ZoomRegion[];
	onZoomAdded: (span: Span) => void;
	onZoomSuggested?: (span: Span, focus: ZoomFocus) => void;
	onZoomSpanChange: (id: string, span: Span) => void;
	onZoomDelete: (id: string) => void;
	selectedZoomId: string | null;
	onSelectZoom: (id: string | null) => void;
	trimRegions?: TrimRegion[];
	onTrimSpanChange?: (id: string, span: Span) => void;
	clipRegions?: ClipRegion[];
	onClipSplit?: (splitMs: number) => void;
	onClipSpanChange?: (id: string, span: Span) => void;
	onClipDelete?: (id: string, ripple?: boolean) => void;
	selectedClipId?: string | null;
	onSelectClip?: (id: string | null) => void;
	layoutRegions?: LayoutRegion[];
	onLayoutAdded?: (span: Span) => void;
	onLayoutSpanChange?: (id: string, span: Span) => void;
	onLayoutDelete?: (id: string) => void;
	selectedLayoutId?: string | null;
	onSelectLayout?: (id: string | null) => void;
	annotationRegions?: AnnotationRegion[];
	onAnnotationAdded?: (span: Span, trackIndex?: number) => void;
	onAnnotationSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onAnnotationDelete?: (id: string) => void;
	onAnnotationKeyframesChange?: (
		id: string,
		keyframes: import("@/components/video-editor/types").PropertyKeyframe[],
	) => void;
	selectedAnnotationId?: string | null;
	onSelectAnnotation?: (id: string | null) => void;
	speedRegions?: SpeedRegion[];
	onSpeedSpanChange?: (id: string, span: Span) => void;
	audioRegions?: AudioRegion[];
	onAudioAdded?: (span: Span, audioPath: string, trackIndex?: number) => void;
	onAudioSpanChange?: (id: string, span: Span, trackIndex?: number) => void;
	onAudioDelete?: (id: string) => void;
	selectedAudioId?: string | null;
	onSelectAudio?: (id: string | null) => void;
	videoPath?: string | null;
	videoSourcePath?: string | null;
	webcamPath?: string | null;
	webcamEnabled?: boolean;
	cursorTelemetrySourcePath?: string | null;
	showSourceAudioTrack?: boolean;
	onSourceAudioAvailabilityChange?: (available: boolean) => void;
	sourceAudioTrackSettings?: SourceAudioTrackSettings;
	getSourceAudioTrackSettingsForClip?: (clipId: string | null) => SourceAudioTrackSettings;
	onSourceAudioTracksMetaChange?: (tracks: SourceAudioTrackMeta) => void;
	onDropMediaAsset?: (asset: SlideAssetFile, dropMs: number) => void;
}

export interface RecordSlideTimelineHandle {
	addZoom: () => void;
	suggestZooms: () => void;
	splitClip: () => void;
	addLayout: () => void;
	addAnnotation: (trackIndex?: number) => void;
	addAudio: (trackIndex?: number) => Promise<void>;
	keyframes: {
		id: string;
		time: number;
		property?: "position" | "scale" | "rotation" | "opacity";
		easing?: string;
	}[];
}

export const RecordSlideTimeline = forwardRef<
	RecordSlideTimelineHandle,
	RecordSlideTimelineProps
>(function RecordSlideTimeline(
	{
		recordToolsEnabled = true,
		videoDuration,
		currentTime,
		playheadTime,
		onSeek,
		cursorTelemetry = [],
		autoSuggestZoomsTrigger = 0,
		onAutoSuggestZoomsConsumed,
		disableSuggestedZooms = false,
		zoomRegions,
		onZoomAdded,
		onZoomSuggested,
		onZoomSpanChange,
		onZoomDelete,
		selectedZoomId,
		onSelectZoom,
		trimRegions = [],
		onTrimSpanChange,
		clipRegions = [],
		onClipSplit,
		onClipSpanChange,
		onClipDelete,
		selectedClipId,
		onSelectClip,
		layoutRegions = [],
		onLayoutAdded,
		onLayoutSpanChange,
		onLayoutDelete,
		selectedLayoutId,
		onSelectLayout,
		annotationRegions = [],
		onAnnotationAdded,
		onAnnotationSpanChange,
		onAnnotationDelete,
		onAnnotationKeyframesChange,
		selectedAnnotationId,
		onSelectAnnotation,
		speedRegions = [],
		onSpeedSpanChange,
		audioRegions = [],
		onAudioAdded,
		onAudioSpanChange,
		onAudioDelete,
		selectedAudioId,
		onSelectAudio,
		videoPath,
		videoSourcePath,
		webcamPath,
		webcamEnabled,
		cursorTelemetrySourcePath,
		showSourceAudioTrack = false,
		onSourceAudioAvailabilityChange,
		sourceAudioTrackSettings = {},
		getSourceAudioTrackSettingsForClip,
		onSourceAudioTracksMetaChange,
		onDropMediaAsset,
	},
	ref,
) {
	const t = useScopedT("settings");
	const totalMs = useMemo(
		() => Math.max(0, Math.round(videoDuration * 1000)),
		[videoDuration],
	);
	const currentTimeMs = useMemo(
		() => Math.round((playheadTime ?? currentTime) * 1000),
		[currentTime, playheadTime],
	);
	const timelineScale = useMemo(() => calculateTimelineScale(videoDuration), [videoDuration]);
	const safeMinDurationMs = useMemo(
		() =>
			totalMs > 0
				? Math.min(timelineScale.minItemDurationMs, totalMs)
				: timelineScale.minItemDurationMs,
		[timelineScale.minItemDurationMs, totalMs],
	);

	const timelineContainerRef = useRef<HTMLDivElement>(null);
	const isTimelineFocusedRef = useRef(false);
	const { setRange, clampedRange, handleTimelineWheel } = useTimelineRange({
		totalMs,
		timelineContainerRef,
	});

	const [liveSpanPreviewById, setLiveSpanPreviewById] = useState<Record<string, Span>>({});
	const liveZoomPreview = useMemo(() => {
		const previewSpans: Record<string, Span> = { ...liveSpanPreviewById };
		const hiddenZoomIds = new Set<string>();

		for (const [previewId, previewSpan] of Object.entries(liveSpanPreviewById)) {
			const oldClip = clipRegions.find((clip) => clip.id === previewId);
			if (!oldClip) continue;

			const newStart = Math.round(previewSpan.start);
			const newEnd = Math.round(previewSpan.end);
			const removedSegments = [
				...(newStart > oldClip.startMs
					? [{ startMs: oldClip.startMs, endMs: newStart }]
					: []),
				...(newEnd < oldClip.endMs ? [{ startMs: newEnd, endMs: oldClip.endMs }] : []),
			];

			const startDelta = newStart - oldClip.startMs;
			const endDelta = newEnd - oldClip.endMs;
			const isMove = Math.abs(startDelta - endDelta) < 1 && Math.abs(startDelta) > 0;

			if (isMove) {
				const delta = startDelta;
				for (const zoom of zoomRegions) {
					const overlaps =
						zoom.startMs < oldClip.endMs && zoom.endMs > oldClip.startMs;
					if (!overlaps) continue;
					previewSpans[zoom.id] = {
						start: zoom.startMs + delta,
						end: zoom.endMs + delta,
					};
				}
			}

			if (removedSegments.length > 0) {
				for (const zoom of zoomRegions) {
					const removed = removedSegments.some(
						(segment) =>
							zoom.startMs < segment.endMs && zoom.endMs > segment.startMs,
					);
					if (removed) hiddenZoomIds.add(zoom.id);
				}
			}
		}

		return { previewSpans, hiddenZoomIds };
	}, [clipRegions, liveSpanPreviewById, zoomRegions]);

	const { shortcuts: keyShortcuts, isMac } = useShortcuts();
	const { peaks: sourceAudioPeaks, loading: sourceAudioLoading } = useTimelineAudioPeaks(
		videoPath,
		{
			enableSourceSidecarFallback: true,
		},
	);

	const sourceAudioTracks = useMemo<SourceAudioTrackWithPeaks[]>(() => {
		return sourceAudioPeaks
			? [
					{
						id: "mixed",
						label: t("audio.mixedLabel", "Source"),
						peaks: sourceAudioPeaks,
					},
				]
			: [];
	}, [sourceAudioPeaks, t]);

	const media4in1 = useMemo<SlideMedia4in1>(() => {
		return {
			videoPath: videoPath ?? null,
			webcamPath: webcamPath ?? null,
			webcamEnabled: webcamEnabled ?? Boolean(webcamPath),
			micPeaks: sourceAudioPeaks ?? null,
			systemPeaks: null,
			micMuted: false,
			systemMuted: false,
		};
	}, [videoPath, webcamPath, webcamEnabled, sourceAudioPeaks]);

	const isLoading = useMemo(() => {
		if (videoPath && sourceAudioLoading) return true;
		if (videoSourcePath && cursorTelemetrySourcePath !== videoSourcePath) return true;
		return false;
	}, [videoPath, videoSourcePath, cursorTelemetrySourcePath, sourceAudioLoading]);

	useEffect(() => {
		onSourceAudioTracksMetaChange?.(
			sourceAudioTracks.map((t) => ({ id: t.id, label: t.label })),
		);
	}, [onSourceAudioTracksMetaChange, sourceAudioTracks]);
	void sourceAudioTrackSettings;
	useEffect(() => {
		onSourceAudioAvailabilityChange?.(sourceAudioTracks.length > 0);
	}, [onSourceAudioAvailabilityChange, sourceAudioTracks.length]);

	const {
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
	} = useTimelineEditorRuntime({
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
	});

	if (!videoDuration || videoDuration === 0) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center rounded-lg bg-editor-surface gap-3">
				<div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center">
					<Plus className="w-6 h-6 text-muted-foreground" />
				</div>
				<div className="text-center">
					<p className="text-sm font-medium text-muted-foreground">No Video Loaded</p>
					<p className="text-xs text-muted-foreground/70 mt-1">
						Drag and drop a video to start editing
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 min-h-0 flex flex-col bg-editor-bg overflow-hidden">
			<div
				ref={timelineContainerRef}
				className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden bg-editor-bg relative"
				tabIndex={0}
				onFocus={() => {
					isTimelineFocusedRef.current = true;
				}}
				onBlur={() => {
					isTimelineFocusedRef.current = false;
				}}
				onMouseDown={() => {
					timelineContainerRef.current?.focus();
					isTimelineFocusedRef.current = true;
				}}
				onClick={() => {
					setSelectedKeyframeId(null);
					setSelectAllBlocksActive(false);
				}}
				onWheel={handleTimelineWheel}
			>
				<TimelineWrapper
					range={clampedRange}
					videoDuration={videoDuration}
					hasOverlap={hasOverlap}
					onRangeChange={setRange}
					minItemDurationMs={timelineScale.minItemDurationMs}
					minVisibleRangeMs={timelineScale.minVisibleRangeMs}
					onItemSpanChange={handleItemSpanChange}
					resolveTargetRowId={getResolvedDropRowId}
					allRegionSpans={allRegionSpans}
					onLiveSpanPreviewChange={(id, span) => {
						setLiveSpanPreviewById((prev) => {
							if (!span) {
								if (!(id in prev)) return prev;
								const next = { ...prev };
								delete next[id];
								return next;
							}
							const current = prev[id];
							if (
								current &&
								current.start === span.start &&
								current.end === span.end
							) {
								return prev;
							}
							return { ...prev, [id]: span };
						});
					}}
				>
					<KeyframeMarkers
						keyframes={keyframes}
						selectedKeyframeId={selectedKeyframeId}
						setSelectedKeyframeId={setSelectedKeyframeId}
						onKeyframeMove={handleKeyframeMove}
						videoDurationMs={totalMs}
						timelineRef={timelineContainerRef}
					/>
					<TimelineCanvas
						recordToolsEnabled={recordToolsEnabled}
						items={timelineItems}
						videoDurationMs={totalMs}
						currentTimeMs={currentTimeMs}
						onSeek={onSeek}
						onAddZoomAtMs={recordToolsEnabled ? addZoomAtMs : undefined}
						canPlaceZoomAtMs={canPlaceZoomAtMs}
						onAddLayoutAtMs={recordToolsEnabled ? addLayoutAtMs : undefined}
						canPlaceLayoutAtMs={canPlaceLayoutAtMs}
						onSelectZoom={handleSelectZoom}
						onSelectClip={handleSelectClip}
						onSelectLayout={handleSelectLayout}
						onSelectAnnotation={handleSelectAnnotation}
						onSelectAudio={handleSelectAudio}
						selectedZoomId={selectedZoomId}
						selectedClipId={selectedClipId}
						selectedLayoutId={selectedLayoutId}
						selectedAnnotationId={selectedAnnotationId}
						selectedAudioId={selectedAudioId}
						selectAllBlocksActive={selectAllBlocksActive}
						onClearBlockSelection={clearSelectedBlocks}
						keyframes={keyframes}
						sourceAudioTracks={sourceAudioTracks}
						getSourceAudioTrackSettingsForClip={getSourceAudioTrackSettingsForClip}
						showSourceAudioTrack={showSourceAudioTrack}
						media4in1={media4in1}
						liveSpanPreviewById={liveZoomPreview.previewSpans}
						liveHiddenItemIds={Array.from(liveZoomPreview.hiddenZoomIds)}
						onDropMediaAsset={onDropMediaAsset}
						isLoading={isLoading}
					/>
				</TimelineWrapper>
			</div>
		</div>
	);
});

RecordSlideTimeline.displayName = "RecordSlideTimeline";
export default RecordSlideTimeline;
