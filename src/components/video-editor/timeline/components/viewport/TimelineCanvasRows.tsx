import { Plus } from "@phosphor-icons/react";
import { type MouseEventHandler, memo, useMemo } from "react";
import type { SourceAudioTrackWithPeaks } from "@/components/video-editor/audio/audioTypes";
import { cn } from "@/lib/utils";
import { CLIP_ROW_ID, LAYOUT_ROW_ID, TRIM_ROW_ID, ZOOM_ROW_ID } from "../../core/constants";
import {
	getAnnotationTrackIndex,
	getAnnotationTrackRowId,
	getAudioTrackIndex,
	getAudioTrackRowId,
	isAnnotationTrackRowId,
	isAudioTrackRowId,
} from "../../core/rows";
import type { RecordingMediaStreams, TimelineRenderItem } from "../../core/timelineTypes";
import Item from "../../Item";
import glassStyles from "../../ItemGlass.module.css";
import Row from "../../Row";
import ClipMarkerOverlay from "../overlays/ClipMarkerOverlay";
import { AudioItemWithWaveform } from "./AudioItemWithWaveform";

const HINT_CLIP = "Press C to split clip";
const HINT_ANNOTATION = "Press A to add annotation";
const HINT_AUDIO = "Click music icon to add audio";

export interface TimelineCanvasRowsProps {
	recordToolsEnabled?: boolean;
	showClipRow?: boolean;
	showSourceAudioTrack?: boolean;
	sourceAudioTracks?: SourceAudioTrackWithPeaks[];
	items: TimelineRenderItem[];
	videoDurationMs: number;
	selectAllBlocksActive: boolean;
	selectedZoomId: string | null;
	selectedClipId?: string | null;
	selectedLayoutId?: string | null;
	selectedAnnotationId?: string | null;
	selectedAudioId?: string | null;
	onSelectZoom?: (id: string | null) => void;
	onTrimDelete?: (id: string) => void;
	onSelectClip?: (id: string | null) => void;
	onSelectLayout?: (id: string | null) => void;
	onSelectAnnotation?: (id: string | null) => void;
	onSelectAudio?: (id: string | null) => void;
	media4in1?: RecordingMediaStreams;
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
	recordToolsEnabled = true,
	showClipRow = true,
	showSourceAudioTrack = false,
	sourceAudioTracks = [],
	items,
	videoDurationMs,
	selectAllBlocksActive,
	selectedZoomId,
	selectedClipId,
	selectedLayoutId,
	selectedAnnotationId,
	selectedAudioId,
	onSelectZoom,
	onTrimDelete,
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
	const groupedItems = useMemo(() => {
		const nextClipItems: TimelineRenderItem[] = [];
		const nextTrimItems: TimelineRenderItem[] = [];
		const nextZoomItems: TimelineRenderItem[] = [];
		const nextLayoutItems: TimelineRenderItem[] = [];
		const annotationBuckets = new Map<number, TimelineRenderItem[]>();
		const audioBuckets = new Map<number, TimelineRenderItem[]>();

		for (const item of items) {
			if (item.rowId === TRIM_ROW_ID) {
				nextTrimItems.push(item);
				continue;
			}
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
			trimItems: nextTrimItems,
			zoomItems: nextZoomItems,
			layoutItems: nextLayoutItems,
			annotationRows: annotationRowsSorted,
			audioRows: audioRowsSorted,
		};
	}, [items]);
	const { clipItems, trimItems, zoomItems, layoutItems, annotationRows, audioRows } =
		groupedItems;

	return (
		<>
			{showClipRow && (
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
			)}

			{trimItems.length > 0 && (
				<Row
					id={TRIM_ROW_ID}
					label="Cuts"
					labelColor="#F87171"
					isEmpty={false}
					hint="Red ranges are removed; the gaps are kept"
				>
					{trimItems.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							variant="trim"
							onDelete={onTrimDelete ? () => onTrimDelete(item.id) : undefined}
						>
							{item.label}
						</Item>
					))}
				</Row>
			)}

			{showSourceAudioTrack &&
				sourceAudioTracks.map((track) => {
					const offsetMs = Number.isFinite(track.offsetMs) ? (track.offsetMs ?? 0) : 0;
					const sourceDurationMs =
						Number.isFinite(track.durationMs) && (track.durationMs ?? 0) > 0
							? (track.durationMs as number)
							: Math.max(0, videoDurationMs - offsetMs);
					const startMs = Math.max(0, offsetMs);
					const endMs = Math.min(videoDurationMs, offsetMs + sourceDurationMs);
					if (endMs <= startMs) return null;

					const rowId = `row-source-audio-${track.id}`;
					return (
						<Row
							key={track.id}
							id={rowId}
							label={track.label}
							labelColor="#34D399"
							isEmpty={false}
						>
							<Item
								id={`source-audio-${track.id}`}
								rowId={rowId}
								span={{ start: startMs, end: endMs }}
								waveformPeaks={track.peaks}
								waveformSegmentSpan={{
									start: startMs - offsetMs,
									end: endMs - offsetMs,
								}}
								variant="audio"
								disabled
								readOnly
							>
								{track.label}
							</Item>
						</Row>
					);
				})}

			{recordToolsEnabled && (
				<>
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
										<div
											className={cn(glassStyles.zoomEndCap, glassStyles.left)}
										/>
										<div
											className={cn(
												glassStyles.zoomEndCap,
												glassStyles.right,
											)}
										/>
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
										<div
											className={cn(glassStyles.zoomEndCap, glassStyles.left)}
										/>
										<div
											className={cn(
												glassStyles.zoomEndCap,
												glassStyles.right,
											)}
										/>
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
				</>
			)}

			{annotationRows.map(({ rowId, items: rowItems }, index) => (
				<Row
					key={rowId}
					id={rowId}
					label={index === 0 ? "Overlays" : `Overlay ${index + 1}`}
					labelColor="#F59E0B"
					isEmpty={rowItems.length === 0}
					hint={index === 0 ? HINT_ANNOTATION : undefined}
				>
					{rowItems.map((item) => (
						<Item
							id={item.id}
							key={item.id}
							rowId={item.rowId}
							span={item.span}
							isSelected={selectAllBlocksActive || item.id === selectedAnnotationId}
							onSelectId={onSelectAnnotation}
							keyframes={item.keyframes}
							locked={item.locked}
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
