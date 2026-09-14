import type {
	AnnotationRegion,
	AudioRegion,
	ClipRegion,
	LayoutRegion,
	ZoomRegion,
} from "../../types";
import type { TimelineRegionSpan, TimelineRenderItem } from "../core/timelineTypes";
import { CLIP_ROW_ID, LAYOUT_ROW_ID, ZOOM_ROW_ID } from "../core/constants";
import {
	getAnnotationTrackIndex,
	getAnnotationTrackRowId,
	getAudioTrackIndex,
	getAudioTrackRowId,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
} from "../core/rows";

export function getAnnotationLabel(region: AnnotationRegion): string {
	if (region.name && region.name.trim()) {
		return region.name.trim();
	}
	if (region.videoFilePath) {
		const fileName = region.videoFilePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "");
		return fileName ? `Video: ${fileName}` : "Video B-Roll";
	}
	if (region.type === "text") {
		const preview = region.content.trim() || "Empty text";
		return preview.length > 20 ? `${preview.substring(0, 20)}...` : preview;
	}
	if (region.type === "image") {
		return "Image";
	}
	return "Annotation";
}

export function getAudioLabel(region: AudioRegion): string {
	return region.audioPath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "Audio";
}

export function buildTimelineItems(params: {
	zoomRegions: ZoomRegion[];
	clipRegions: ClipRegion[];
	layoutRegions?: LayoutRegion[];
	annotationRegions: AnnotationRegion[];
	audioRegions: AudioRegion[];
}): TimelineRenderItem[] {
	const { zoomRegions, clipRegions, layoutRegions = [], annotationRegions, audioRegions } = params;
	const zooms: TimelineRenderItem[] = zoomRegions.map((region, index) => ({
		id: region.id,
		rowId: ZOOM_ROW_ID,
		span: { start: region.startMs, end: region.endMs },
		label: `Zoom ${index + 1}`,
		zoomDepth: region.depth,
		zoomMode: region.mode ?? "auto",
		variant: "zoom",
	}));

	const clips: TimelineRenderItem[] = clipRegions.map((region, index) => {
		const displayDurationMs = Math.max(0, region.endMs - region.startMs);
		const speed = Number.isFinite(region.speed) && region.speed > 0 ? region.speed : 1;
		const sourceEndMs = region.startMs + displayDurationMs * speed;

		return {
			id: region.id,
			rowId: CLIP_ROW_ID,
			span: { start: region.startMs, end: region.endMs },
			sourceSpan: { start: region.startMs, end: sourceEndMs },
			label: `Clip ${index + 1}`,
			showSourceAudio: region.showSourceAudio,
			muted: Boolean(region.muted),
			transitionIn: region.transitionIn,
			variant: "clip",
		};
	});

	const layouts: TimelineRenderItem[] = layoutRegions.map((region) => ({
		id: region.id,
		rowId: LAYOUT_ROW_ID,
		span: { start: region.startMs, end: region.endMs },
		label: region.preset
			.split("-")
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" "),
		layoutPreset: region.preset,
		variant: "layout",
	}));

	const annotations: TimelineRenderItem[] = annotationRegions.map((region) => ({
		id: region.id,
		rowId: getAnnotationTrackRowId(region.trackIndex ?? 0),
		span: { start: region.startMs, end: region.endMs },
		label: getAnnotationLabel(region),
		variant: "annotation",
	}));

	const audios: TimelineRenderItem[] = audioRegions.map((region) => ({
		id: region.id,
		rowId: getAudioTrackRowId(region.trackIndex ?? 0),
		span: { start: region.startMs, end: region.endMs },
		label: getAudioLabel(region),
		audioPath: region.audioPath,
		audioGain: region.volume,
		audioNormalize: Boolean(region.normalize),
		variant: "audio",
	}));

	return [...zooms, ...clips, ...layouts, ...annotations, ...audios];
}

export function buildAllRegionSpans(params: {
	zoomRegions: ZoomRegion[];
	clipRegions: ClipRegion[];
	layoutRegions?: LayoutRegion[];
	audioRegions: AudioRegion[];
}): TimelineRegionSpan[] {
	const { zoomRegions, clipRegions, layoutRegions = [], audioRegions } = params;
	const zooms = zoomRegions.map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: ZOOM_ROW_ID,
	}));
	const clips = clipRegions.map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: CLIP_ROW_ID,
	}));
	const layouts = layoutRegions.map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: LAYOUT_ROW_ID,
	}));
	const audios = audioRegions.map((r) => ({
		id: r.id,
		start: r.startMs,
		end: r.endMs,
		rowId: getAudioTrackRowId(r.trackIndex ?? 0),
	}));
	return [...zooms, ...clips, ...layouts, ...audios];
}

export function resolveDropRowId(
	id: string,
	proposedRowId: string,
	timelineItems: TimelineRenderItem[],
) {
	const currentRowId = timelineItems.find((item) => item.id === id)?.rowId;
	if (!currentRowId) {
		return proposedRowId;
	}

	if (isAnnotationTrackRowId(currentRowId)) {
		return isAnnotationTrackRowId(proposedRowId)
			? getAnnotationTrackRowId(getAnnotationTrackIndex(proposedRowId))
			: currentRowId;
	}

	if (isAudioTrackRowId(currentRowId)) {
		return isAudioTrackRowId(proposedRowId)
			? getAudioTrackRowId(getAudioTrackIndex(proposedRowId))
			: currentRowId;
	}

	return currentRowId;
}
