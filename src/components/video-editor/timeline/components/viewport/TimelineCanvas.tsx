import { useTimelineContext } from "dnd-timeline";
import { type MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
	SourceAudioTrackSettings,
	SourceAudioTrackWithPeaks,
} from "@/components/video-editor/audio/audioTypes";
import { isAnnotationTrackRowId, isAudioTrackRowId } from "../../core/rows";
import type { SlideMedia4in1, TimelineRenderItem } from "../../core/timelineTypes";
import { getTimelineRowsMinHeightPx } from "../../timelineLayout";
import TimelineAxis from "../axis/TimelineAxis";
import PlaybackCursor from "../playhead/PlaybackCursor";
import { TimelineCanvasRows } from "./TimelineCanvasRows";
import { useTimelineHover } from "./useTimelineHover";

export interface TimelineCanvasProps {
	recordToolsEnabled?: boolean;
	items: TimelineRenderItem[];
	videoDurationMs: number;
	currentTimeMs: number;
	onSeek?: (time: number) => void;
	canPlaceZoomAtMs?: (startMs: number) => boolean;
	onSelectZoom?: (id: string | null) => void;
	onSelectClip?: (id: string | null) => void;
	onSelectLayout?: (id: string | null) => void;
	onSelectAnnotation?: (id: string | null) => void;
	onSelectAudio?: (id: string | null) => void;
	onAddZoomAtMs?: (startMs: number) => void;
	onAddLayoutAtMs?: (startMs: number) => void;
	canPlaceLayoutAtMs?: (startMs: number) => boolean;
	selectedZoomId: string | null;
	selectedClipId?: string | null;
	selectedLayoutId?: string | null;
	selectedAnnotationId?: string | null;
	selectedAudioId?: string | null;
	selectAllBlocksActive?: boolean;
	onClearBlockSelection?: () => void;
	keyframes?: {
		id: string;
		time: number;
		property?: "position" | "scale" | "rotation" | "opacity";
		easing?: string;
	}[];
	sourceAudioTracks?: SourceAudioTrackWithPeaks[];
	getSourceAudioTrackSettingsForClip?: (clipId: string) => SourceAudioTrackSettings | undefined;
	showSourceAudioTrack?: boolean;
	media4in1?: SlideMedia4in1;
	liveSpanPreviewById?: Record<string, { start: number; end: number }>;
	liveHiddenItemIds?: string[];
	isLoading?: boolean;
}

export default function TimelineCanvas({
	recordToolsEnabled = true,
	items,
	videoDurationMs,
	currentTimeMs,
	onSeek,
	onAddZoomAtMs,
	canPlaceZoomAtMs,
	onAddLayoutAtMs,
	canPlaceLayoutAtMs,
	onSelectZoom,
	onSelectClip,
	onSelectLayout,
	onSelectAnnotation,
	onSelectAudio,
	selectedZoomId,
	selectedClipId,
	selectedLayoutId,
	selectedAnnotationId,
	selectedAudioId,
	selectAllBlocksActive = false,
	onClearBlockSelection,
	keyframes = [],
	sourceAudioTracks: _sourceAudioTracks = [],
	getSourceAudioTrackSettingsForClip: _getSourceAudioTrackSettingsForClip,
	showSourceAudioTrack: _showSourceAudioTrack = false,
	media4in1,
	liveSpanPreviewById,
	liveHiddenItemIds,
	isLoading = false,
}: TimelineCanvasProps) {
	const { setTimelineRef, style, sidebarWidth, direction, range, valueToPixels, pixelsToValue } =
		useTimelineContext();
	const localTimelineRef = useRef<HTMLDivElement | null>(null);
	const [isSeeking, setIsSeeking] = useState(false);
	const seekRafRef = useRef<number | null>(null);
	const pendingSeekClientXRef = useRef<number | null>(null);

	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			setTimelineRef(node);
			localTimelineRef.current = node;
		},
		[setTimelineRef],
	);

	const handleTimelineClick = useCallback(
		(e: MouseEvent<HTMLDivElement>) => {
			if (isSeeking) return;
			if (!onSeek || videoDurationMs <= 0) return;

			if (onClearBlockSelection) {
				onClearBlockSelection();
			} else {
				onSelectZoom?.(null);
				onSelectClip?.(null);
				onSelectLayout?.(null);
				onSelectAnnotation?.(null);
				onSelectAudio?.(null);
			}

			const rect = e.currentTarget.getBoundingClientRect();
			const clickX =
				direction === "rtl"
					? rect.right - sidebarWidth - e.clientX
					: e.clientX - rect.left - sidebarWidth;
			if (clickX < 0) return;
			const relativeMs = pixelsToValue(clickX);
			const absoluteMs = Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));
			onSeek(absoluteMs / 1000);
		},
		[
			isSeeking,
			onSeek,
			onSelectZoom,
			onSelectClip,
			onSelectLayout,
			onSelectAnnotation,
			onSelectAudio,
			onClearBlockSelection,
			videoDurationMs,
			sidebarWidth,
			direction,
			range.start,
			pixelsToValue,
		],
	);

	const getAbsoluteMsFromClientX = useCallback(
		(clientX: number, rect: DOMRect) => {
			const clickX =
				direction === "rtl"
					? rect.right - sidebarWidth - clientX
					: clientX - rect.left - sidebarWidth;
			const relativeMs = pixelsToValue(clickX);
			return Math.max(0, Math.min(range.start + relativeMs, videoDurationMs));
		},
		[direction, pixelsToValue, range.start, sidebarWidth, videoDurationMs],
	);

	const handleTimelineMouseDown = useCallback(
		(e: MouseEvent<HTMLDivElement>) => {
			if (e.button !== 0 || !onSeek || videoDurationMs <= 0 || !localTimelineRef.current)
				return;
			if ((e.target as HTMLElement).closest("[data-timeline-item]")) {
				return;
			}

			if (onClearBlockSelection) {
				onClearBlockSelection();
			} else {
				onSelectZoom?.(null);
				onSelectClip?.(null);
				onSelectLayout?.(null);
				onSelectAnnotation?.(null);
				onSelectAudio?.(null);
			}

			const rect = localTimelineRef.current.getBoundingClientRect();
			onSeek(getAbsoluteMsFromClientX(e.clientX, rect) / 1000);
			setIsSeeking(true);
			e.preventDefault();
		},
		[
			getAbsoluteMsFromClientX,
			onClearBlockSelection,
			onSeek,
			onSelectAnnotation,
			onSelectAudio,
			onSelectClip,
			onSelectLayout,
			onSelectZoom,
			videoDurationMs,
		],
	);

	useEffect(() => {
		if (!isSeeking) return;

		const flushSeek = () => {
			seekRafRef.current = null;
			if (!onSeek || !localTimelineRef.current || pendingSeekClientXRef.current === null)
				return;
			const rect = localTimelineRef.current.getBoundingClientRect();
			onSeek(getAbsoluteMsFromClientX(pendingSeekClientXRef.current, rect) / 1000);
		};

		const handleMouseMove = (event: globalThis.MouseEvent) => {
			pendingSeekClientXRef.current = event.clientX;
			if (seekRafRef.current === null) {
				seekRafRef.current = requestAnimationFrame(flushSeek);
			}
		};

		const handleMouseUp = () => {
			if (seekRafRef.current !== null) {
				cancelAnimationFrame(seekRafRef.current);
				seekRafRef.current = null;
			}
			if (pendingSeekClientXRef.current !== null) {
				flushSeek();
			}
			pendingSeekClientXRef.current = null;
			setIsSeeking(false);
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);

		return () => {
			if (seekRafRef.current !== null) {
				cancelAnimationFrame(seekRafRef.current);
				seekRafRef.current = null;
			}
			pendingSeekClientXRef.current = null;
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [getAbsoluteMsFromClientX, isSeeking, onSeek]);

	const timelineRowCount = useMemo(() => {
		const annotationRowIds = new Set<string>();
		const audioRowIds = new Set<string>();
		for (const item of items) {
			if (isAnnotationTrackRowId(item.rowId)) annotationRowIds.add(item.rowId);
			if (isAudioTrackRowId(item.rowId)) audioRowIds.add(item.rowId);
		}
		return (recordToolsEnabled ? 3 : 1) + annotationRowIds.size + audioRowIds.size;
	}, [items, recordToolsEnabled]);
	const timelineRowsMinHeightPx = getTimelineRowsMinHeightPx(timelineRowCount);
	const sideProperty = direction === "rtl" ? "right" : "left";
	const {
		canShowGhostPlayhead,
		timelineGhostOffsetPx,
		handleTimelineMouseEnter,
		handleTimelineMouseMove,
		handleTimelineMouseLeave,
		canShowGhostZoom,
		ghostStartMs,
		ghostStartOffsetPx,
		ghostWidthPx,
		handleZoomRowMouseEnter,
		handleZoomRowMouseMove,
		handleZoomRowMouseLeave,
		handleZoomRowMouseDown,
		handleZoomRowClick,
		canShowGhostLayout,
		layoutGhostStartMs,
		layoutGhostStartOffsetPx,
		layoutGhostWidthPx,
		handleLayoutRowMouseEnter,
		handleLayoutRowMouseMove,
		handleLayoutRowMouseLeave,
		handleLayoutRowMouseDown,
		handleLayoutRowClick,
	} = useTimelineHover({
		direction,
		sidebarWidth,
		rangeStart: range.start,
		rangeEnd: range.end,
		videoDurationMs,
		onAddZoomAtMs,
		canPlaceZoomAtMs,
		onAddLayoutAtMs,
		canPlaceLayoutAtMs,
		valueToPixels,
	});

	return (
		<div
			ref={setRefs}
			style={{
				...style,
				height: "100%",
			}}
			className="select-none bg-editor-bg relative cursor-pointer group flex flex-col overflow-hidden"
			onMouseDown={handleTimelineMouseDown}
			onClick={handleTimelineClick}
			onMouseEnter={handleTimelineMouseEnter}
			onMouseMove={handleTimelineMouseMove}
			onMouseLeave={handleTimelineMouseLeave}
		>
			<TimelineAxis videoDurationMs={videoDurationMs} currentTimeMs={currentTimeMs} />
			<PlaybackCursor
				currentTimeMs={currentTimeMs}
				videoDurationMs={videoDurationMs}
				onSeek={onSeek}
				timelineRef={localTimelineRef}
				keyframes={keyframes}
				isLoading={isLoading}
			/>
			{canShowGhostPlayhead && (
				<div
					className="absolute top-0 bottom-0 z-[45] pointer-events-none"
					style={{
						[sideProperty === "right" ? "marginRight" : "marginLeft"]:
							`${sidebarWidth - 1}px`,
					}}
				>
					<div
						className="absolute top-0 bottom-0 w-px bg-foreground/35"
						style={{ [sideProperty]: `${timelineGhostOffsetPx}px` }}
					/>
				</div>
			)}

			<div
				className="relative z-10 flex flex-1 min-h-0 flex-col"
				style={{ minHeight: timelineRowsMinHeightPx }}
			>
				<TimelineCanvasRows
					recordToolsEnabled={recordToolsEnabled}
					items={items}
					videoDurationMs={videoDurationMs}
					selectAllBlocksActive={selectAllBlocksActive}
					selectedZoomId={selectedZoomId}
					selectedClipId={selectedClipId}
					selectedLayoutId={selectedLayoutId}
					selectedAnnotationId={selectedAnnotationId}
					selectedAudioId={selectedAudioId}
					onSelectZoom={onSelectZoom}
					onSelectClip={onSelectClip}
					onSelectLayout={onSelectLayout}
					onSelectAnnotation={onSelectAnnotation}
					onSelectAudio={onSelectAudio}
					media4in1={media4in1}
					liveSpanPreviewById={liveSpanPreviewById}
					liveHiddenItemIds={liveHiddenItemIds}
					direction={direction}
					canShowGhostZoom={canShowGhostZoom}
					ghostStartMs={ghostStartMs}
					ghostStartOffsetPx={ghostStartOffsetPx}
					ghostWidthPx={ghostWidthPx}
					onZoomRowMouseEnter={handleZoomRowMouseEnter}
					onZoomRowMouseMove={handleZoomRowMouseMove}
					onZoomRowMouseLeave={handleZoomRowMouseLeave}
					onZoomRowMouseDown={handleZoomRowMouseDown}
					onZoomRowClick={handleZoomRowClick}
					canShowGhostLayout={canShowGhostLayout}
					layoutGhostStartMs={layoutGhostStartMs}
					layoutGhostStartOffsetPx={layoutGhostStartOffsetPx}
					layoutGhostWidthPx={layoutGhostWidthPx}
					onLayoutRowMouseEnter={handleLayoutRowMouseEnter}
					onLayoutRowMouseMove={handleLayoutRowMouseMove}
					onLayoutRowMouseLeave={handleLayoutRowMouseLeave}
					onLayoutRowMouseDown={handleLayoutRowMouseDown}
					onLayoutRowClick={handleLayoutRowClick}
					isLoading={isLoading}
				/>
			</div>
		</div>
	);
}
