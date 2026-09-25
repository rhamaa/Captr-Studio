import { MagnifyingGlassPlus, Trash } from "@phosphor-icons/react";
import React from "react";
import type { ZoomDepth, ZoomRegion } from "@/components/video-editor/types";
import { formatTime } from "./recordConstants";

export interface RecordZoomTabProps {
	zoomRegions: ZoomRegion[];
	selectedZoomId: string | null;
	connectZooms: boolean;
	hasVideo: boolean;
	onAutoSuggestZooms: () => void;
	onToggleConnectZooms: () => void;
	onSelectZoom: (id: string) => void;
	onSeekToZoom: (startMs: number, id: string) => void;
	onDeleteZoom: (id: string) => void;
	onUpdateZoomDepth: (id: string, depth: ZoomDepth) => void;
}

export const RecordZoomTab: React.FC<RecordZoomTabProps> = ({
	zoomRegions,
	selectedZoomId,
	connectZooms,
	hasVideo,
	onAutoSuggestZooms,
	onToggleConnectZooms,
	onSelectZoom,
	onSeekToZoom,
	onDeleteZoom,
	onUpdateZoomDepth,
}) => {
	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<span className="text-xs font-semibold text-white flex items-center gap-1.5">
					<MagnifyingGlassPlus size={16} className="text-emerald-400" />
					<span>Zoom Regions ({zoomRegions.length})</span>
				</span>
				<button
					type="button"
					onClick={onAutoSuggestZooms}
					disabled={!hasVideo}
					className="text-[11px] font-semibold text-purple-400 hover:underline disabled:opacity-40 cursor-pointer"
					title="Scan telemetry untuk buat zoom otomatis"
				>
					Auto-Detect
				</button>
			</div>

			{/* Connect Zooms Switch */}
			<div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-800/40">
				<div>
					<div className="text-xs font-medium text-white">Seamless Camera Glide</div>
					<div className="text-[10px] text-slate-400">Pan halus antar zoom berurutan</div>
				</div>
				<button
					type="button"
					onClick={onToggleConnectZooms}
					className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
						connectZooms
							? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
							: "bg-slate-800 text-slate-500"
					}`}
				>
					{connectZooms ? "ON" : "OFF"}
				</button>
			</div>

			{zoomRegions.length === 0 ? (
				<div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
					Belum ada zoom. Klik "Auto-Detect" atau geser playhead lalu klik "+ Add Zoom".
				</div>
			) : (
				<div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
					{zoomRegions.map((zoom, idx) => {
						const isSelected = selectedZoomId === zoom.id;
						return (
							<div
								key={zoom.id}
								onClick={() => onSelectZoom(zoom.id)}
								className={`rounded-xl border p-2.5 flex flex-col gap-2 transition-all cursor-pointer ${
									isSelected
										? "border-emerald-500/70 bg-emerald-500/10 shadow-sm"
										: "border-slate-800 bg-slate-800/50 hover:border-slate-700"
								}`}
							>
								<div className="flex items-center justify-between text-xs">
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onSeekToZoom(zoom.startMs, zoom.id);
										}}
										className="font-mono text-emerald-400 hover:underline text-[11px]"
										title="Lompat ke Zoom"
									>
										#{idx + 1} {formatTime(zoom.startMs)} →{" "}
										{formatTime(zoom.endMs)}
									</button>
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onDeleteZoom(zoom.id);
										}}
										className="text-slate-500 hover:text-red-400 transition-colors"
										title="Hapus Zoom"
									>
										<Trash size={14} />
									</button>
								</div>

								{/* Depth switcher */}
								<div className="flex items-center justify-between gap-1">
									<span className="text-[10px] text-slate-400">Depth</span>
									<div className="flex gap-1">
										{([1, 2, 3, 4, 5] as ZoomDepth[]).map((depth) => {
											const label =
												depth === 1
													? "1.25x"
													: depth === 2
														? "1.5x"
														: depth === 3
															? "2.0x"
															: depth === 4
																? "2.5x"
																: "3.0x";
											return (
												<button
													key={depth}
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														onUpdateZoomDepth(zoom.id, depth);
													}}
													className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${
														zoom.depth === depth
															? "bg-emerald-500 text-slate-950 font-bold"
															: "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
													}`}
												>
													{label}
												</button>
											);
										})}
									</div>
								</div>

								{/* Focus info */}
								<div className="text-[10px] text-slate-400 flex items-center justify-between">
									<span>Fokus Kamera</span>
									<span className="font-mono text-slate-300">
										x: {Math.round((zoom.focus.cx ?? 0.5) * 100)}%, y:{" "}
										{Math.round((zoom.focus.cy ?? 0.5) * 100)}%
									</span>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};
