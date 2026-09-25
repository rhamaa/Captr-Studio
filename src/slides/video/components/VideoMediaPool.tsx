import { FilmSlate, UploadSimple } from "@phosphor-icons/react";
import React from "react";
import type { VideoSlideMeta } from "../schema";

interface VideoMediaPoolProps {
	mediaPool: VideoSlideMeta["mediaPool"];
	onImportClick?: () => void;
}

export const VideoMediaPool: React.FC<VideoMediaPoolProps> = ({ mediaPool, onImportClick }) => {
	return (
		<div className="flex w-72 flex-col border-r border-slate-800 bg-slate-900/60 p-3 backdrop-blur select-none">
			<div className="flex items-center justify-between pb-2 border-b border-slate-800">
				<div className="flex items-center gap-1.5 text-xs font-semibold text-white">
					<FilmSlate size={16} className="text-blue-400" />
					<span>Media Pool</span>
				</div>
				<button
					type="button"
					onClick={onImportClick}
					className="flex items-center gap-1 rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400 hover:bg-blue-500/30 transition cursor-pointer"
				>
					<UploadSimple size={12} />
					<span>Import</span>
				</button>
			</div>

			{/* Asset list */}
			<div className="flex-1 overflow-y-auto py-2">
				{mediaPool.length === 0 ? (
					<div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 p-4 text-center">
						<FilmSlate size={24} className="text-slate-600 mb-1" />
						<p className="text-[11px] text-slate-400">Tarik video atau audio ke sini</p>
					</div>
				) : (
					<div className="space-y-1.5">
						{mediaPool.map((asset) => (
							<div
								key={asset.id}
								className="flex items-center justify-between rounded bg-slate-800/80 px-2.5 py-1.5 text-xs text-slate-300"
							>
								<span className="truncate">{asset.name}</span>
								<span className="text-[10px] text-slate-500">{asset.type}</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};
