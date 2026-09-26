import React from "react";

interface VideoClipInspectorProps {
	title: string;
	durationMs: number;
	audioTracksCount: number;
	onUpdateTitle?: (title: string) => void;
}

export const VideoClipInspector: React.FC<VideoClipInspectorProps> = ({
	title,
	durationMs,
	audioTracksCount,
	onUpdateTitle,
}) => {
	return (
		<div className="w-72 border-l border-slate-800 bg-slate-900/60 p-3 backdrop-blur select-none">
			<div className="text-[10px] font-bold tracking-wider text-blue-400 uppercase mb-2">
				Slide & Clip Inspector
			</div>
			<input
				type="text"
				value={title}
				onChange={(e) => onUpdateTitle?.(e.target.value)}
				className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-semibold text-white focus:border-blue-500 focus:outline-none mb-4"
			/>

			<div className="space-y-3">
				<div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
					<div className="text-[11px] font-semibold text-slate-300 mb-1">
						Durasi Slide
					</div>
					<div className="text-xs text-slate-400">
						{(durationMs / 1000).toFixed(1)} detik
					</div>
				</div>
				<div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
					<div className="text-[11px] font-semibold text-slate-300 mb-1">
						Audio Voiceovers
					</div>
					<div className="text-xs text-slate-400">
						{audioTracksCount} audio clip aktif
					</div>
				</div>
			</div>
		</div>
	);
};
