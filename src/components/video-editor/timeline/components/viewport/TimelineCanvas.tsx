import { Plus } from "@phosphor-icons/react";
import { useTimelineContext } from "dnd-timeline";
import {
	memo,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type MouseEvent,
	type MouseEventHandler,
} from "react";
import { cn } from "@/lib/utils";
import type {
	SourceAudioTrackSettings,
	SourceAudioTrackWithPeaks,
} from "@/components/video-editor/audio/audioTypes";
import {
	getTimelineRowsMinHeightPx,
} from "../../timelineLayout";
import glassStyles from "../../ItemGlass.module.css";
import Item from "../../Item";
import Row from "../../Row";
import { CLIP_ROW_ID, LAYOUT_ROW_ID, ZOOM_ROW_ID } from "../../core/constants";
import type { SlideMedia4in1, TimelineRenderItem } from "../../core/timelineTypes";
import {
	getAnnotationTrackIndex,
	getAnnotationTrackRowId,
	getAudioTrackIndex,
	getAudioTrackRowId,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
} from "../../core/rows";
import TimelineAxis from "../axis/TimelineAxis";
import ClipMarkerOverlay from "../overlays/ClipMarkerOverlay";
import PlaybackCursor from "../playhead/PlaybackCursor";
import { useTimelineAudioPeaks } from "../../hooks/useTimelineAudioPeaks";

const HINT_CLIP = "Press C to split clip";
const HINT_ANNOTATION = "Press A to add annotation";
const HINT_AUDIO = "Click music icon to add audio";

interface TimelineCanvasProps {
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
	keyframes?: { id: string; time: number }[];
	sourceAudioTracks?: SourceAudioTrackWithPeaks[];
	getSourceAudioTrackSettingsForClip?: (
		clipId: string | null,
	) => SourceAudioTrackSettings;
	showSourceAudioTrack?: boolean;
	media4in1?: SlideMedia4in1;
	liveSpanPreviewById?: Record<string, { start: number; end: number }>;
	liveHiddenItemIds?: string[];
	isLoading?: boolean;
}

interface TimelineHoverParams {
	direction: string;
	sidebarWidth: number;
	rangeStart: number;
	rangeEnd: number;
	videoDurationMs: number;
	onAddZoomAtMs?: (startMs: number) => void;
	canPlaceZoomAtMs?: (startMs: number) => boolean;
	onAddLayoutAtMs?: (startMs: number) => void;
	canPlaceLayoutAtMs?: (startMs: number) => boolean;
	valueToPixels: (value: number) => number;
}

function useTimelineHover({
	direction,
	sidebarWidth,
	rangeStart,
	rangeEnd,
	videoDurationMs,
	onAddZoomAtMs,
	canPlaceZoomAtMs,
	onAddLayoutAtMs,
	canPlaceLayoutAtMs,
	valueToPixels,
}: TimelineHoverParams) {
	const [isTimelineHovered, setIsTimelineHovered] = useState(false);
	const [timelineHoverMs, setTimelineHoverMs] = useState<number | null>(null);
	const [isZoomRowHovered, setIsZoomRowHovered] = useState(false);
	const [zoomRowHoverMs, setZoomRowHoverMs] = useState<number | null>(null);
	const [isLayoutRowHovered, setIsLayoutRowHovered] = useState(false);
	const [layoutRowHoverMs, setLayoutRowHoverMs] = useState<number | null>(null);

	const visibleDurationMs = Math.max(1, rangeEnd - rangeStart);

	const updateTimelineHoverTime = useCallback(
		(clientX: number, rect: DOMRect) => {
			const contentWidth = Math.max(1, rect.width - sidebarWidth);
			const contentX =
				direction === "rtl" ? rect.right - sidebarWidth - clientX : clientX - rect.left - sidebarWidth;
			const clampedX = Math.max(0, Math.min(contentX, contentWidth));
			const ratio = clampedX / contentWidth;
			const nextMs = rangeStart + ratio * visibleDurationMs;
			setTimelineHoverMs(Math.max(0, Math.min(nextMs, videoDurationMs)));
		},
		[direction, rangeStart, sidebarWidth, videoDurationMs, visibleDurationMs],
	);

	const handleTimelineMouseEnter = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			setIsTimelineHovered(true);
			updateTimelineHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[updateTimelineHoverTime],
	);

	const handleTimelineMouseMove = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (!isTimelineHovered) setIsTimelineHovered(true);
			updateTimelineHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[isTimelineHovered, updateTimelineHoverTime],
	);

	const handleTimelineMouseLeave = useCallback(() => {
		setIsTimelineHovered(false);
		setTimelineHoverMs(null);
		setIsZoomRowHovered(false);
		setZoomRowHoverMs(null);
	}, []);

	const updateZoomRowHoverTime = useCallback(
		(clientX: number, rect: DOMRect) => {
			if (rect.width <= 0) return;
			const position =
				direction === "rtl"
					? Math.max(0, Math.min(rect.right - clientX, rect.width))
					: Math.max(0, Math.min(clientX - rect.left, rect.width));
			const ratio = position / rect.width;
			const nextMs = rangeStart + ratio * visibleDurationMs;
			setZoomRowHoverMs(Math.max(0, Math.min(nextMs, videoDurationMs)));
		},
		[direction, rangeStart, videoDurationMs, visibleDurationMs],
	);

	const handleZoomRowMouseEnter = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			setIsZoomRowHovered(true);
			updateZoomRowHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[updateZoomRowHoverTime],
	);

	const handleZoomRowMouseMove = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (!isZoomRowHovered) setIsZoomRowHovered(true);
			updateZoomRowHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[isZoomRowHovered, updateZoomRowHoverTime],
	);

	const handleZoomRowMouseLeave = useCallback(() => {
		setIsZoomRowHovered(false);
		setZoomRowHoverMs(null);
	}, []);

	const handleZoomRowMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
	}, []);

	const handleZoomRowClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			event.stopPropagation();
			if (!onAddZoomAtMs || zoomRowHoverMs === null) return;
			const startMs = Math.max(0, Math.min(zoomRowHoverMs, videoDurationMs));
			if (canPlaceZoomAtMs && !canPlaceZoomAtMs(startMs)) return;
			onAddZoomAtMs(startMs);
		},
		[canPlaceZoomAtMs, onAddZoomAtMs, videoDurationMs, zoomRowHoverMs],
	);

	const updateLayoutRowHoverTime = useCallback(
		(clientX: number, rect: DOMRect) => {
			if (rect.width <= 0) return;
			const position =
				direction === "rtl"
					? Math.max(0, Math.min(rect.right - clientX, rect.width))
					: Math.max(0, Math.min(clientX - rect.left, rect.width));
			const ratio = position / rect.width;
			const nextMs = rangeStart + ratio * visibleDurationMs;
			setLayoutRowHoverMs(Math.max(0, Math.min(nextMs, videoDurationMs)));
		},
		[direction, rangeStart, videoDurationMs, visibleDurationMs],
	);

	const handleLayoutRowMouseEnter = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			setIsLayoutRowHovered(true);
			updateLayoutRowHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[updateLayoutRowHoverTime],
	);

	const handleLayoutRowMouseMove = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			if (!isLayoutRowHovered) setIsLayoutRowHovered(true);
			updateLayoutRowHoverTime(event.clientX, event.currentTarget.getBoundingClientRect());
		},
		[isLayoutRowHovered, updateLayoutRowHoverTime],
	);

	const handleLayoutRowMouseLeave = useCallback(() => {
		setIsLayoutRowHovered(false);
		setLayoutRowHoverMs(null);
	}, []);

	const handleLayoutRowMouseDown = useCallback((event: MouseEvent<HTMLDivElement>) => {
		event.stopPropagation();
	}, []);

	const handleLayoutRowClick = useCallback(
		(event: MouseEvent<HTMLDivElement>) => {
			event.stopPropagation();
			if (!onAddLayoutAtMs || layoutRowHoverMs === null) return;
			const startMs = Math.max(0, Math.min(layoutRowHoverMs, videoDurationMs));
			if (canPlaceLayoutAtMs && !canPlaceLayoutAtMs(startMs)) return;
			onAddLayoutAtMs(startMs);
		},
		[canPlaceLayoutAtMs, layoutRowHoverMs, onAddLayoutAtMs, videoDurationMs],
	);

	const ghostStartMs =
		zoomRowHoverMs === null ? null : Math.max(0, Math.min(zoomRowHoverMs, videoDurationMs));
	const ghostDurationMs = Math.min(1000, videoDurationMs);
	const ghostEndMs =
		ghostStartMs === null
			? null
			: Math.max(ghostStartMs, Math.min(videoDurationMs, ghostStartMs + ghostDurationMs));
	const ghostStartOffsetPx =
		ghostStartMs === null ? 0 : valueToPixels(Math.max(0, ghostStartMs - rangeStart));
	const ghostEndOffsetPx = ghostEndMs === null ? 0 : valueToPixels(Math.max(0, ghostEndMs - rangeStart));
	const ghostWidthPx = Math.max(18, ghostEndOffsetPx - ghostStartOffsetPx);
	const layoutGhostStartMs =
		layoutRowHoverMs === null ? null : Math.max(0, Math.min(layoutRowHoverMs, videoDurationMs));
	const layoutGhostDurationMs = Math.min(4000, videoDurationMs);
	const layoutGhostEndMs =
		layoutGhostStartMs === null
			? null
			: Math.max(layoutGhostStartMs, Math.min(videoDurationMs, layoutGhostStartMs + layoutGhostDurationMs));
	const layoutGhostStartOffsetPx =
		layoutGhostStartMs === null ? 0 : valueToPixels(Math.max(0, layoutGhostStartMs - rangeStart));
	const layoutGhostEndOffsetPx =
		layoutGhostEndMs === null ? 0 : valueToPixels(Math.max(0, layoutGhostEndMs - rangeStart));
	const layoutGhostWidthPx = Math.max(18, layoutGhostEndOffsetPx - layoutGhostStartOffsetPx);
	const timelineGhostOffsetPx =
		timelineHoverMs === null ? 0 : valueToPixels(Math.max(0, timelineHoverMs - rangeStart));
	const canShowGhostPlayhead = isTimelineHovered && timelineHoverMs !== null;
	const canShowGhostZoom =
		isZoomRowHovered &&
		ghostStartMs !== null &&
		(onAddZoomAtMs ? (canPlaceZoomAtMs?.(ghostStartMs) ?? true) : false);
	const canShowGhostLayout =
		isLayoutRowHovered &&
		layoutGhostStartMs !== null &&
		(onAddLayoutAtMs ? (canPlaceLayoutAtMs?.(layoutGhostStartMs) ?? true) : false);

	return {
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
	};
}

interface TimelineCanvasRowsProps {
	items: TimelineRenderItem[];
	videoDurationMs: number;
	selectAllBlocksActive: boolean;
	selectedZoomId: string | null;
	selectedClipId?: string | null;
	selectedLayoutId?: string | null;
	selectedAnnotationId?: string | null;
	selectedAudioId?: string | null;
	onSelectZoom?: (id: string | null) => void;
	onSelectClip?: (id: string | null) => void;
	onSelectLayout?: (id: string | null) => void;
	onSelectAnnotation?: (id: string | null) => void;
	onSelectAudio?: (id: string | null) => void;
	media4in1?: SlideMedia4in1;
	liveSpanPreviewById?: Record<string, { start: number; end: number }>;
	liveHiddenItemIds?: string[];
	direction: string;
	canShowGhostZoom: boolean;
	ghostStartMs: number | null;
	ghostStartOffsetPx: number;
	ghostWidthPx: number;
	onZoomRowMouseEnter: MouseEventHandler<HTMLDivElement>;
	onZoomRowMouseMove: MouseEventHandler<HTMLDivElement>;
	onZoomRowMouseLeave: MouseEventHandler<HTMLDivElement>;
	onZoomRowMouseDown: MouseEventHandler<HTMLDivElement>;
	onZoomRowClick: MouseEventHandler<HTMLDivElement>;
	canShowGhostLayout: boolean;
	layoutGhostStartMs: number | null;
	layoutGhostStartOffsetPx: number;
	layoutGhostWidthPx: number;
	onLayoutRowMouseEnter: MouseEventHandler<HTMLDivElement>;
	onLayoutRowMouseMove: MouseEventHandler<HTMLDivElement>;
	onLayoutRowMouseLeave: MouseEventHandler<HTMLDivElement>;
	onLayoutRowMouseDown: MouseEventHandler<HTMLDivElement>;
	onLayoutRowClick: MouseEventHandler<HTMLDivElement>;
	isLoading?: boolean;
}

interface AudioItemWithWaveformProps {
	item: TimelineRenderItem;
	span: { start: number; end: number };
	waveformSpan: { start: number; end: number };
	isSelected: boolean;
	onSelectAudio?: (id: string | null) => void;
}

function AudioItemWithWaveform({
	item,
	span,
	waveformSpan,
	isSelected,
	onSelectAudio,
}: AudioItemWithWaveformProps) {
	const { peaks } = useTimelineAudioPeaks(item.audioPath ?? null);
	const normalizedWaveformSpan = useMemo(() => {
		const duration = Math.max(0, waveformSpan.end - waveformSpan.start);
		return { start: 0, end: duration };
	}, [waveformSpan.end, waveformSpan.start]);
	return (
			<Item
				id={item.id}
				rowId={item.rowId}
				span={span}
				isSelected={isSelected}
				onSelectId={onSelectAudio}
				variant="audio"
				waveformPeaks={peaks}
				waveformSegmentSpan={normalizedWaveformSpan}
				waveformGain={Math.max(0, Math.min(1, item.audioGain ?? 1))}
				waveformNormalize={Boolean(item.audioNormalize)}
			>
			{item.label}
		</Item>
	);
}

const TimelineCanvasRows = memo(function TimelineCanvasRows({
	items,
	videoDurationMs,
	selectAllBlocksActive,
	selectedZoomId,
	selectedClipId,
	selectedLayoutId,
	selectedAnnotationId,
	selectedAudioId,
	onSelectZoom,
	onSelectClip,
	onSelectLayout,
	onSelectAnnotation,
	onSelectAudio,
	media4in1,
	liveSpanPreviewById,
	liveHiddenItemIds,
	direction,
	canShowGhostZoom,
	ghostStartMs,
	ghostStartOffsetPx,
	ghostWidthPx,
	onZoomRowMouseEnter,
	onZoomRowMouseMove,
	onZoomRowMouseLeave,
	onZoomRowMouseDown,
	onZoomRowClick,
	canShowGhostLayout,
	layoutGhostStartMs,
	layoutGhostStartOffsetPx,
	layoutGhostWidthPx,
	onLayoutRowMouseEnter,
	onLayoutRowMouseMove,
	onLayoutRowMouseLeave,
	onLayoutRowMouseDown,
	onLayoutRowClick,
	isLoading = false,
}: TimelineCanvasRowsProps) {
	const hiddenIds = useMemo(() => new Set(liveHiddenItemIds ?? []), [liveHiddenItemIds]);
	const { clipItems, zoomItems, layoutItems, annotationRows, audioRows } = useMemo(() => {
		const nextClipItems: TimelineRenderItem[] = [];
		const nextZoomItems: TimelineRenderItem[] = [];
		const nextLayoutItems: TimelineRenderItem[] = [];
		const annotationBuckets = new Map<number, TimelineRenderItem[]>();
		const audioBuckets = new Map<number, TimelineRenderItem[]>();

		for (const item of items) {
			if (item.rowId === CLIP_ROW_ID) {
				nextClipItems.push(item);
				continue;
			}
			if (item.rowId === ZOOM_ROW_ID) {
				nextZoomItems.push(item);
				continue;
			}
			if (item.rowId === LAYOUT_ROW_ID) {
				nextLayoutItems.push(item);
				continue;
			}
			if (isAnnotationTrackRowId(item.rowId)) {
				const trackIndex = getAnnotationTrackIndex(item.rowId);
				const bucket = annotationBuckets.get(trackIndex);
				if (bucket) bucket.push(item);
				else annotationBuckets.set(trackIndex, [item]);
				continue;
			}
			if (isAudioTrackRowId(item.rowId)) {
				const trackIndex = getAudioTrackIndex(item.rowId);
				const bucket = audioBuckets.get(trackIndex);
				if (bucket) bucket.push(item);
				else audioBuckets.set(trackIndex, [item]);
			}
		}

		const annotationRowsSorted = Array.from(annotationBuckets.entries())
			.sort(([left], [right]) => left - right)
			.map(([trackIndex, rowItems]) => ({
				rowId: getAnnotationTrackRowId(trackIndex),
				items: rowItems,
			}));
		const audioRowsSorted = Array.from(audioBuckets.entries())
			.sort(([left], [right]) => left - right)
			.map(([trackIndex, rowItems]) => ({
				rowId: getAudioTrackRowId(trackIndex),
				items: rowItems,
			}));

		return {
			clipItems: nextClipItems,
			zoomItems: nextZoomItems,
			layoutItems: nextLayoutItems,
			annotationRows: annotationRowsSorted,
			audioRows: audioRowsSorted,
		};
	}, [items]);

	return (
		<>
			<Row id={CLIP_ROW_ID} isEmpty={clipItems.length === 0} hint={HINT_CLIP} minHeight={76}>
				<ClipMarkerOverlay videoDurationMs={videoDurationMs} />
				{clipItems.map((item) => (
					<Item
						id={item.id}
						key={item.id}
						rowId={item.rowId}
						span={item.span}
						waveformSegmentSpan={item.sourceSpan ?? item.span}
						isSelected={selectAllBlocksActive || item.id === selectedClipId}
						onSelectId={onSelectClip}
						transitionIn={item.transitionIn}
						media4in1={item.media4in1 ?? media4in1}
						variant="clip"
						isLoading={isLoading}
						loadingLabel="Analyzing..."
					>
						{item.label}
					</Item>
				))}
			</Row>

			<Row
				id={ZOOM_ROW_ID}
				isEmpty={zoomItems.length === 0}
				onMouseEnter={onZoomRowMouseEnter}
				onMouseMove={onZoomRowMouseMove}
				onMouseLeave={onZoomRowMouseLeave}
				onMouseDown={onZoomRowMouseDown}
				onClick={onZoomRowClick}
			>
				{canShowGhostZoom && ghostStartMs !== null && (
					<div className="absolute inset-0 z-[3] pointer-events-none">
						<div
							className="absolute top-1/2 -translate-y-1/2 h-[85%] min-h-[22px]"
							style={
								direction === "rtl"
									? { right: `${ghostStartOffsetPx}px`, width: `${ghostWidthPx}px` }
									: { left: `${ghostStartOffsetPx}px`, width: `${ghostWidthPx}px` }
							}
						>
							<div
								className={cn(
									glassStyles.glassPurple,
									"w-full h-full overflow-hidden flex items-center justify-center cursor-default relative opacity-80",
								)}
							>
								<div className={cn(glassStyles.zoomEndCap, glassStyles.left)} />
								<div className={cn(glassStyles.zoomEndCap, glassStyles.right)} />
								<div className="relative z-10 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/45 bg-white/15 text-white">
									<Plus className="h-2.5 w-2.5" />
								</div>
							</div>
						</div>
					</div>
				)}
				{zoomItems
					.filter((item) => !hiddenIds.has(item.id))
					.map((item) => (
					<Item
						id={item.id}
						key={item.id}
						rowId={item.rowId}
						span={item.span}
						isSelected={selectAllBlocksActive || item.id === selectedZoomId}
						onSelectId={onSelectZoom}
						zoomDepth={item.zoomDepth}
						zoomMode={item.zoomMode}
						variant="zoom"
					>
						{item.label}
					</Item>
				))}
			</Row>

			<Row
				id={LAYOUT_ROW_ID}
				label="Layout"
				labelColor="#60A5FA"
				isEmpty={layoutItems.length === 0}
				hint="Add layout scenes"
				onMouseEnter={onLayoutRowMouseEnter}
				onMouseMove={onLayoutRowMouseMove}
				onMouseLeave={onLayoutRowMouseLeave}
				onMouseDown={onLayoutRowMouseDown}
				onClick={onLayoutRowClick}
			>
				{canShowGhostLayout && layoutGhostStartMs !== null && (
					<div className="absolute inset-0 z-[3] pointer-events-none">
						<div
							className="absolute top-1/2 -translate-y-1/2 h-[85%] min-h-[22px]"
							style={
								direction === "rtl"
									? { right: `${layoutGhostStartOffsetPx}px`, width: `${layoutGhostWidthPx}px` }
									: { left: `${layoutGhostStartOffsetPx}px`, width: `${layoutGhostWidthPx}px` }
							}
						>
							<div
								className={cn(
									glassStyles.glassPurple,
									"w-full h-full overflow-hidden flex items-center justify-center cursor-default relative opacity-80",
								)}
							>
								<div className={cn(glassStyles.zoomEndCap, glassStyles.left)} />
								<div className={cn(glassStyles.zoomEndCap, glassStyles.right)} />
								<div className="relative z-10 inline-flex h-4 w-4 items-center justify-center rounded-full border border-white/45 bg-white/15 text-white">
									<Plus className="h-2.5 w-2.5" />
								</div>
							</div>
						</div>
					</div>
				)}
				{layoutItems.map((item) => (
					<Item
						id={item.id}
						key={item.id}
						rowId={item.rowId}
						span={item.span}
						isSelected={selectAllBlocksActive || item.id === selectedLayoutId}
						onSelectId={onSelectLayout}
						variant="layout"
					>
						{item.label}
					</Item>
				))}
			</Row>

			{annotationRows.map(({ rowId, items: rowItems }, index) => (
				<Row key={rowId} id={rowId} isEmpty={rowItems.length === 0} hint={index === 0 ? HINT_ANNOTATION : undefined}>
					{rowItems.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={selectAllBlocksActive || item.id === selectedAnnotationId}
							onSelectId={onSelectAnnotation}
							variant="annotation"
						>
							{item.label}
						</Item>
					))}
				</Row>
			))}

			{audioRows.map(({ rowId, items: rowItems }, index) => (
				<Row key={rowId} id={rowId} isEmpty={rowItems.length === 0} hint={index === 0 ? HINT_AUDIO : undefined}>
					{rowItems.map((item) => (
						<AudioItemWithWaveform
							key={item.id}
							item={item}
							span={item.span}
							waveformSpan={liveSpanPreviewById?.[item.id] ?? item.span}
							isSelected={selectAllBlocksActive || item.id === selectedAudioId}
							onSelectAudio={onSelectAudio}
						/>
					))}
				</Row>
			))}
		</>
	);
});

export default function TimelineCanvas({
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
			if (e.button !== 0 || !onSeek || videoDurationMs <= 0 || !localTimelineRef.current) return;
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
			if (!onSeek || !localTimelineRef.current || pendingSeekClientXRef.current === null) return;
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
		return 3 + annotationRowIds.size + audioRowIds.size;
	}, [items]);
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
						[sideProperty === "right" ? "marginRight" : "marginLeft"]: `${sidebarWidth - 1}px`,
					}}
				>
					<div className="absolute top-0 bottom-0 w-px bg-foreground/35" style={{ [sideProperty]: `${timelineGhostOffsetPx}px` }} />
				</div>
			)}

			<div className="relative z-10 flex flex-1 min-h-0 flex-col" style={{ minHeight: timelineRowsMinHeightPx }}>
				<TimelineCanvasRows
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
