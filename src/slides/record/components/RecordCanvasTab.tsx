import { Check, FrameCorners, Palette } from "@phosphor-icons/react";
import React from "react";
import { FRAME_PRESETS, WALLPAPER_PRESETS } from "./recordConstants";

export interface RecordCanvasTabProps {
	frame: string | null;
	wallpaper: string;
	borderRadius: number;
	shadowIntensity: number;
	onUpdateFrame: (frame: string | null) => void;
	onUpdateWallpaper: (wallpaper: string) => void;
	onUpdateBorderRadius: (radius: number) => void;
	onUpdateShadowIntensity: (intensity: number) => void;
}

export const RecordCanvasTab: React.FC<RecordCanvasTabProps> = ({
	frame,
	wallpaper,
	borderRadius,
	shadowIntensity,
	onUpdateFrame,
	onUpdateWallpaper,
	onUpdateBorderRadius,
	onUpdateShadowIntensity,
}) => {
	return (
		<div className="flex flex-col gap-4">
			{/* Window Frame Mockup */}
			<div>
				<div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-2">
					<FrameCorners size={16} className="text-teal-400" />
					<span>Window Frame Mockup</span>
				</div>
				<div className="grid grid-cols-2 gap-1.5">
					{FRAME_PRESETS.map((fp) => (
						<button
							key={fp.label}
							type="button"
							onClick={() => onUpdateFrame(fp.id)}
							className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
								frame === fp.id
									? "border-teal-500 bg-teal-500/10 text-white"
									: "border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700"
							}`}
						>
							{fp.label}
						</button>
					))}
				</div>
			</div>

			{/* Wallpaper Presets */}
			<div>
				<div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-2">
					<Palette size={16} className="text-purple-400" />
					<span>Wallpaper Backdrop</span>
				</div>
				<div className="grid grid-cols-2 gap-1.5">
					{WALLPAPER_PRESETS.map((wp) => {
						const isSelected = wallpaper === wp.value;
						return (
							<button
								key={wp.label}
								type="button"
								onClick={() => onUpdateWallpaper(wp.value)}
								className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
									isSelected
										? "border-emerald-500 bg-emerald-500/10 text-white"
										: "border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700"
								}`}
							>
								<span className="truncate">{wp.label}</span>
								{isSelected && (
									<Check size={12} className="text-emerald-400 shrink-0" />
								)}
							</button>
						);
					})}
				</div>
			</div>

			{/* Sliders: Radius, Shadow */}
			<div className="space-y-3 pt-1">
				<div>
					<div className="flex justify-between text-[11px] text-slate-400 mb-1">
						<span>Squircle Radius</span>
						<span className="font-mono text-white">{borderRadius}px</span>
					</div>
					<input
						type="range"
						min="0"
						max="32"
						value={borderRadius}
						onChange={(e) => onUpdateBorderRadius(Number(e.target.value))}
						className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
					/>
				</div>

				<div>
					<div className="flex justify-between text-[11px] text-slate-400 mb-1">
						<span>Shadow Intensity</span>
						<span className="font-mono text-white">
							{Math.round(shadowIntensity * 100)}%
						</span>
					</div>
					<input
						type="range"
						min="0"
						max="1"
						step="0.05"
						value={shadowIntensity}
						onChange={(e) => onUpdateShadowIntensity(Number(e.target.value))}
						className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
					/>
				</div>
			</div>
		</div>
	);
};
