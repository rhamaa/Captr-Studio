import React from "react";
import {
	CursorClick,
	MagnifyingGlassPlus,
	Palette,
	VideoCamera,
} from "@phosphor-icons/react";
import type { SlideWorkspaceProps } from "@/core/slides/types";
import type { RecordSlideMeta } from "../schema";

export const RecordSlideWorkspace: React.FC<SlideWorkspaceProps<RecordSlideMeta>> = ({
	slide,
	onUpdateMeta,
	onUpdateTitle,
	canvasDimensions,
}) => {
	const meta = slide.meta;

	const handleToggleCursor = () => {
		onUpdateMeta((prev) => ({ ...prev, showCursor: !prev.showCursor }));
	};

	const handleAddZoom = () => {
		const newZoomId = `zoom-${Date.now()}`;
		onUpdateMeta((prev) => ({
			...prev,
			zoomRegions: [
				...prev.zoomRegions,
				{
					id: newZoomId,
					startMs: 1000,
					endMs: Math.min(slide.durationMs, 4000),
					depth: 2,
					focus: { x: 0.5, y: 0.5 },
				},
			],
		}));
	};

	return (
		<div className="flex h-full w-full bg-slate-950 text-slate-200">
			{/* Center Area: Preview Canvas */}
			<div className="flex flex-1 flex-col items-center justify-center p-6 relative overflow-hidden">
				{/* Canvas Container with Aspect Ratio */}
				<div
					className="relative flex items-center justify-center overflow-hidden rounded-xl shadow-2xl border border-slate-800 transition-all"
					style={{
						aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}`,
						maxHeight: "75vh",
						maxWidth: "85vw",
						backgroundColor: meta.wallpaper.startsWith("#") ? meta.wallpaper : "#090d16",
						backgroundImage: meta.wallpaper.startsWith("url") ? meta.wallpaper : undefined,
					}}
				>
					{meta.videoPath ? (
						<div
							className="relative overflow-hidden bg-black shadow-2xl transition-transform"
							style={{
								borderRadius: `${meta.borderRadius}px`,
								boxShadow: `0 25px 50px -12px rgba(0, 0, 0, ${meta.shadowIntensity})`,
								width: "82%",
								height: "82%",
							}}
						>
							<video
								src={meta.videoPath}
								controls={false}
								className="h-full w-full object-cover"
							/>
							{/* Zoom Badge Indicator */}
							{meta.zoomRegions.length > 0 && (
								<div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-2.5 py-1 text-xs font-semibold text-slate-950 backdrop-blur shadow">
									<MagnifyingGlassPlus size={13} weight="bold" />
									<span>{meta.zoomRegions.length} Auto-Zoom</span>
								</div>
							)}
						</div>
					) : (
						/* Empty State / Dropzone */
						<div className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-700/60 bg-slate-900/40 p-12 text-center backdrop-blur">
							<div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
								<VideoCamera size={32} weight="duotone" />
							</div>
							<div>
								<h4 className="text-sm font-semibold text-white">Record Slide (Screen Studio Mode)</h4>
								<p className="text-xs text-slate-400 mt-1 max-w-xs">
									Rekam layar atau pilih video rekaman untuk mengaktifkan auto-zoom, penghalusan kursor, dan background estetik.
								</p>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Right Sidebar: Screen Studio Quick Controls */}
			<div className="w-80 border-l border-slate-800 bg-slate-900/50 p-4 flex flex-col gap-5 overflow-y-auto backdrop-blur">
				{/* Section Header */}
				<div>
					<div className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
						Record Inspector
					</div>
					<input
						type="text"
						value={slide.title}
						onChange={(e) => onUpdateTitle?.(e.target.value)}
						className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-sm font-semibold text-white focus:border-emerald-500 focus:outline-none"
					/>
				</div>

				{/* Auto-Zoom Panel */}
				<div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2 text-xs font-semibold text-white">
							<MagnifyingGlassPlus size={16} className="text-emerald-400" />
							<span>Smart Zoom</span>
						</div>
						<button
							type="button"
							onClick={handleAddZoom}
							className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/30"
						>
							+ Add Zoom
						</button>
					</div>
					<div className="mt-2 text-[11px] text-slate-400">
						{meta.zoomRegions.length} zoom terpasang pada slide ini.
					</div>
				</div>

				{/* Cursor Smoothing Panel */}
				<div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2 text-xs font-semibold text-white">
							<CursorClick size={16} className="text-blue-400" />
							<span>Cursor Smoothing</span>
						</div>
						<button
							type="button"
							onClick={handleToggleCursor}
							className={`rounded px-2 py-0.5 text-[11px] font-medium ${
								meta.showCursor
									? "bg-blue-500/20 text-blue-400"
									: "bg-slate-800 text-slate-500"
							}`}
						>
							{meta.showCursor ? "ON" : "OFF"}
						</button>
					</div>
					<div className="mt-2 text-[11px] text-slate-400">
						Spring motion smoothing membuat gerakan kursor terlihat halus sinematik.
					</div>
				</div>

				{/* Visual Styling Panel */}
				<div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
					<div className="flex items-center gap-2 text-xs font-semibold text-white mb-2">
						<Palette size={16} className="text-purple-400" />
						<span>Backdrop & Border</span>
					</div>
					<div className="space-y-3">
						<div>
							<div className="flex justify-between text-[11px] text-slate-400 mb-1">
								<span>Border Radius</span>
								<span>{meta.borderRadius}px</span>
							</div>
							<input
								type="range"
								min="0"
								max="32"
								value={meta.borderRadius}
								onChange={(e) =>
									onUpdateMeta((prev) => ({
										...prev,
										borderRadius: Number(e.target.value),
									}))
								}
								className="w-full accent-emerald-500"
							/>
						</div>
						<div>
							<div className="flex justify-between text-[11px] text-slate-400 mb-1">
								<span>Shadow Intensity</span>
								<span>{Math.round(meta.shadowIntensity * 100)}%</span>
							</div>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={meta.shadowIntensity}
								onChange={(e) =>
									onUpdateMeta((prev) => ({
										...prev,
										shadowIntensity: Number(e.target.value),
									}))
								}
								className="w-full accent-emerald-500"
							/>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
