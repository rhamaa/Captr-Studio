import { Compass } from "@phosphor-icons/react";
import React from "react";

export interface RecordCameraTabProps {
	cameraPerspectiveTilt: number;
	zoomMotionBlur: number;
	onUpdateCameraPerspectiveTilt: (val: number) => void;
	onUpdateZoomMotionBlur: (val: number) => void;
}

export const RecordCameraTab: React.FC<RecordCameraTabProps> = ({
	cameraPerspectiveTilt,
	zoomMotionBlur,
	onUpdateCameraPerspectiveTilt,
	onUpdateZoomMotionBlur,
}) => {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-2 text-xs font-semibold text-white">
				<Compass size={16} className="text-amber-400" />
				<span>3D Perspective Tilt & Blur</span>
			</div>

			{/* Perspective Tilt Slider */}
			<div>
				<div className="flex justify-between text-[11px] text-slate-400 mb-1">
					<span>3D Perspective Tilt</span>
					<span className="font-mono text-white">
						{cameraPerspectiveTilt.toFixed(1)}°
					</span>
				</div>
				<input
					type="range"
					min="-6"
					max="6"
					step="0.5"
					value={cameraPerspectiveTilt}
					onChange={(e) => onUpdateCameraPerspectiveTilt(Number(e.target.value))}
					className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
				/>
				<p className="mt-1 text-[10px] text-slate-500">
					Memiringkan sudut kanvas 3D saat kamera zoom ke sudut layar ala iklan Apple.
				</p>
			</div>

			{/* Motion Blur Slider */}
			<div>
				<div className="flex justify-between text-[11px] text-slate-400 mb-1">
					<span>Motion Blur Panning</span>
					<span className="font-mono text-white">
						{Math.round(zoomMotionBlur * 100)}%
					</span>
				</div>
				<input
					type="range"
					min="0"
					max="1"
					step="0.05"
					value={zoomMotionBlur}
					onChange={(e) => onUpdateZoomMotionBlur(Number(e.target.value))}
					className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
				/>
				<p className="mt-1 text-[10px] text-slate-500">
					Simulasi shutter blur saat pergerakan kamera cepat antar titik zoom.
				</p>
			</div>
		</div>
	);
};
