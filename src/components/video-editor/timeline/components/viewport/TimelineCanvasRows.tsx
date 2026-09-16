import { Plus } from "@phosphor-icons/react";
import {
	memo,
	useMemo,
	type MouseEventHandler,
} from "react";
import { cn } from "@/lib/utils";
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
import ClipMarkerOverlay from "../overlays/ClipMarkerOverlay";
import { AudioItemWithWaveform } from "./AudioItemWithWaveform";

const HINT_CLIP = "Press C to split clip";
const HINT_ANNOTATION = "Press A to add annotation";
const HINT_AUDIO = "Click music icon to add audio";

export interface TimelineCanvasRowsProps {
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

export const TimelineCanvasRows = memo(function TimelineCanvasRows({
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
	const hiddenIds = useMemo(
		() => new Set(liveHiddenItemIds ?? []),
		[liveHiddenItemIds],
	);
	const { clipItems, zoomItems, layoutItems, annotationRows, audioRows } =
		useMemo(() => {
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
			<Row
				id={CLIP_ROW_ID}
				isEmpty={clipItems.length === 0}
				hint={HINT_CLIP}
				minHeight={76}
			>
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
									? {
											right: `${ghostStartOffsetPx}px`,
											width: `${ghostWidthPx}px`,
										}
									: {
											left: `${ghostStartOffsetPx}px`,
											width: `${ghostWidthPx}px`,
										}
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
									? {
											right: `${layoutGhostStartOffsetPx}px`,
											width: `${layoutGhostWidthPx}px`,
										}
									: {
											left: `${layoutGhostStartOffsetPx}px`,
											width: `${layoutGhostWidthPx}px`,
										}
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
				<Row
					key={rowId}
					id={rowId}
					isEmpty={rowItems.length === 0}
					hint={index === 0 ? HINT_ANNOTATION : undefined}
				>
					{rowItems.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={
								selectAllBlocksActive || item.id === selectedAnnotationId
							}
							onSelectId={onSelectAnnotation}
							variant="annotation"
						>
							{item.label}
						</Item>
					))}
				</Row>
			))}

			{audioRows.map(({ rowId, items: rowItems }, index) => (
				<Row
					key={rowId}
					id={rowId}
					isEmpty={rowItems.length === 0}
					hint={index === 0 ? HINT_AUDIO : undefined}
				>
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
