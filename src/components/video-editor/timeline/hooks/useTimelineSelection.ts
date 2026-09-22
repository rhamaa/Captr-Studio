import { useCallback, useEffect, useMemo, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { addAnnotationKeyframe, moveAnnotationKeyframe } from "../../annotationKeyframes";
import type { AnnotationRegion, KeyframeProperty } from "../../types";
import type { TimelineRegion } from "../core/timelineTypes";

interface UseTimelineSelectionParams {
	totalMs: number;
	currentTimeMs: number;
	zoomRegions: TimelineRegion[];
	clipRegions: TimelineRegion[];
	layoutRegions: TimelineRegion[];
	annotationRegions: AnnotationRegion[];
	audioRegions: TimelineRegion[];
	selectedZoomId: string | null;
	selectedClipId?: string | null;
	selectedLayoutId?: string | null;
	selectedAnnotationId?: string | null;
	selectedAudioId?: string | null;
	onZoomDelete: (id: string) => void;
	onClipDelete?: (id: string, ripple?: boolean) => void;
	onLayoutDelete?: (id: string) => void;
	onAnnotationDelete?: (id: string) => void;
	onAnnotationKeyframesChange?: (
		id: string,
		keyframes: import("../../types").PropertyKeyframe[],
	) => void;
	onAudioDelete?: (id: string) => void;
	onSelectZoom: (id: string | null) => void;
	onSelectClip?: (id: string | null) => void;
	onSelectLayout?: (id: string | null) => void;
	onSelectAnnotation?: (id: string | null) => void;
	onSelectAudio?: (id: string | null) => void;
}

export function useTimelineSelection({
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
}: UseTimelineSelectionParams) {
	const selectedAnnotation = annotationRegions.find(
		(region) => region.id === selectedAnnotationId,
	);
	const keyframes = useMemo(
		() =>
			(selectedAnnotation?.keyframes ?? [])
				.map((frame) => ({
					id: frame.id,
					time:
						selectedAnnotation!.startMs +
						frame.timeMs -
						(selectedAnnotation!.keyframeTimeOffsetMs ?? 0),
					property: frame.property,
					easing: frame.easing,
				}))
				.filter(
					(frame) =>
						frame.time >= selectedAnnotation!.startMs &&
						frame.time <= selectedAnnotation!.endMs,
				)
				.sort((a, b) => a.time - b.time),
		[selectedAnnotation],
	);
	const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);
	useEffect(() => {
		setSelectedKeyframeId(null);
	}, [selectedAnnotationId]);
	const [selectAllBlocksActive, setSelectAllBlocksActive] = useState(false);

	const addKeyframe = useCallback(
		(property: KeyframeProperty = "position") => {
			if (
				!selectedAnnotation ||
				selectedAnnotation.locked ||
				!onAnnotationKeyframesChange ||
				totalMs === 0
			)
				return;
			onAnnotationKeyframesChange(
				selectedAnnotation.id,
				addAnnotationKeyframe(selectedAnnotation, property, currentTimeMs, uuidv4()),
			);
		},
		[selectedAnnotation, currentTimeMs, totalMs, onAnnotationKeyframesChange],
	);

	const deleteSelectedKeyframe = useCallback(() => {
		if (!selectedAnnotation || selectedAnnotation.locked || !selectedKeyframeId) return;
		onAnnotationKeyframesChange?.(
			selectedAnnotation.id,
			(selectedAnnotation.keyframes ?? []).filter((frame) => frame.id !== selectedKeyframeId),
		);
		setSelectedKeyframeId(null);
	}, [selectedAnnotation, selectedKeyframeId, onAnnotationKeyframesChange]);

	const handleKeyframeMove = useCallback(
		(id: string, newTime: number) => {
			if (!selectedAnnotation || selectedAnnotation.locked) return;
			onAnnotationKeyframesChange?.(
				selectedAnnotation.id,
				moveAnnotationKeyframe(selectedAnnotation, id, newTime),
			);
		},
		[selectedAnnotation, onAnnotationKeyframesChange],
	);

	const deleteSelectedZoom = useCallback(() => {
		if (!selectedZoomId) return;
		onZoomDelete(selectedZoomId);
		onSelectZoom(null);
	}, [selectedZoomId, onZoomDelete, onSelectZoom]);

	const deleteSelectedClip = useCallback(
		(ripple = false) => {
			if (!selectedClipId || !onClipDelete || !onSelectClip) return;
			onClipDelete(selectedClipId, ripple);
			onSelectClip(null);
		},
		[selectedClipId, onClipDelete, onSelectClip],
	);

	const deleteSelectedLayout = useCallback(() => {
		if (!selectedLayoutId || !onLayoutDelete || !onSelectLayout) return;
		onLayoutDelete(selectedLayoutId);
		onSelectLayout(null);
	}, [selectedLayoutId, onLayoutDelete, onSelectLayout]);

	const deleteSelectedAnnotation = useCallback(() => {
		if (!selectedAnnotationId || !onAnnotationDelete || !onSelectAnnotation) return;
		onAnnotationDelete(selectedAnnotationId);
		onSelectAnnotation(null);
	}, [selectedAnnotationId, onAnnotationDelete, onSelectAnnotation]);

	const deleteSelectedAudio = useCallback(() => {
		if (!selectedAudioId || !onAudioDelete || !onSelectAudio) return;
		onAudioDelete(selectedAudioId);
		onSelectAudio(null);
	}, [selectedAudioId, onAudioDelete, onSelectAudio]);

	const clearSelectedBlocks = useCallback(() => {
		onSelectZoom(null);
		onSelectClip?.(null);
		onSelectLayout?.(null);
		onSelectAnnotation?.(null);
		onSelectAudio?.(null);
		setSelectAllBlocksActive(false);
	}, [onSelectZoom, onSelectClip, onSelectLayout, onSelectAnnotation, onSelectAudio]);

	const hasAnyTimelineBlocks = useMemo(
		() =>
			zoomRegions.length > 0 ||
			clipRegions.length > 0 ||
			layoutRegions.length > 0 ||
			annotationRegions.length > 0 ||
			audioRegions.length > 0,
		[
			zoomRegions.length,
			clipRegions.length,
			layoutRegions.length,
			annotationRegions.length,
			audioRegions.length,
		],
	);

	const deleteAllBlocks = useCallback(() => {
		zoomRegions.map((r) => r.id).forEach((id) => onZoomDelete(id));
		clipRegions.map((r) => r.id).forEach((id) => onClipDelete?.(id));
		layoutRegions.map((r) => r.id).forEach((id) => onLayoutDelete?.(id));
		annotationRegions.map((r) => r.id).forEach((id) => onAnnotationDelete?.(id));
		audioRegions.map((r) => r.id).forEach((id) => onAudioDelete?.(id));
		clearSelectedBlocks();
		setSelectedKeyframeId(null);
	}, [
		zoomRegions,
		clipRegions,
		layoutRegions,
		annotationRegions,
		audioRegions,
		onZoomDelete,
		onClipDelete,
		onLayoutDelete,
		onAnnotationDelete,
		onAnnotationKeyframesChange,
		onAudioDelete,
		clearSelectedBlocks,
	]);

	const handleSelectZoom = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectZoom(id);
		},
		[onSelectZoom],
	);

	const handleSelectClip = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectClip?.(id);
		},
		[onSelectClip],
	);

	const handleSelectLayout = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectLayout?.(id);
		},
		[onSelectLayout],
	);

	const handleSelectAnnotation = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectAnnotation?.(id);
		},
		[onSelectAnnotation],
	);

	const handleSelectAudio = useCallback(
		(id: string | null) => {
			setSelectAllBlocksActive(false);
			onSelectAudio?.(id);
		},
		[onSelectAudio],
	);

	const cycleAnnotationsAtCurrentTime = useCallback(
		(backward = false) => {
			const overlapping = annotationRegions
				.filter((a) => currentTimeMs >= a.startMs && currentTimeMs <= a.endMs)
				.sort((a, b) => a.zIndex - b.zIndex);
			if (overlapping.length === 0) {
				return false;
			}

			if (!selectedAnnotationId || !overlapping.some((a) => a.id === selectedAnnotationId)) {
				onSelectAnnotation?.(overlapping[0].id);
				return true;
			}

			const currentIndex = overlapping.findIndex((a) => a.id === selectedAnnotationId);
			const nextIndex = backward
				? (currentIndex - 1 + overlapping.length) % overlapping.length
				: (currentIndex + 1) % overlapping.length;
			onSelectAnnotation?.(overlapping[nextIndex].id);
			return true;
		},
		[annotationRegions, currentTimeMs, selectedAnnotationId, onSelectAnnotation],
	);

	return {
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
	};
}
