import React from "react";

export interface RecordMotionTabProps {
	zoomMotionBlur: number;
	onUpdateZoomMotionBlur: (val: number) => void;
}

export const RecordMotionTab: React.FC<RecordMotionTabProps> = ({
	zoomMotionBlur,
	onUpdateZoomMotionBlur,
}) => {
	return (
		<div className="flex flex-col gap-4">
			<div className="text-xs font-semibold text-white">Zoom Motion Blur</div>
			<div>
				<div className="mb-1 flex justify-between text-[11px] text-slate-400">
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
					onChange={(event) => onUpdateZoomMotionBlur(Number(event.target.value))}
					className="h-1.5 w-full cursor-pointer rounded-lg bg-slate-800 accent-amber-500"
				/>
				<p className="mt-1 text-[10px] text-slate-500">
					Simulasi shutter blur saat pergerakan kamera cepat antar titik zoom.
				</p>
			</div>
		</div>
	);
};
