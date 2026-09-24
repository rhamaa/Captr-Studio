import React, { useState } from "react";
import {
	FilmSlate,
	MusicNote,
	Plus,
	Scissors,
	SpeakerHigh,
	TextT,
	Trash,
	UploadSimple,
} from "@phosphor-icons/react";
import type { SlideWorkspaceProps } from "@/core/slides/types";
import type { VideoClipItem, VideoSlideMeta } from "../schema";

export const VideoSlideWorkspace: React.FC<SlideWorkspaceProps<VideoSlideMeta>> = ({
	slide,
	onUpdateMeta,
	onUpdateTitle,
	canvasDimensions,
}) => {
	const meta = slide.meta;
	const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

	const handleAddSampleClip = (trackId: string) => {
		const newClip: VideoClipItem = {
			id: `clip-${Date.now()}`,
			title: "Sample B-Roll Clip",
			sourcePath: "",
			startOffsetMs: 0,
			durationMs: 3000,
			speedMultiplier: 1,
			volume: 1,
		};

		onUpdateMeta((prev) => ({
			...prev,
			videoTracks: prev.videoTracks.map((track) =>
				track.id === trackId ? { ...track, clips: [...track.clips, newClip] } : track,
			),
		}));
	};

	const handleDeleteClip = (trackId: string, clipId: string) => {
		onUpdateMeta((prev) => ({
			...prev,
			videoTracks: prev.videoTracks.map((track) =>
				track.id === trackId
					? { ...track, clips: track.clips.filter((c) => c.id !== clipId) }
					: track,
			),
		}));
		if (selectedClipId === clipId) setSelectedClipId(null);
	};

	return (
		<div className="flex h-full w-full flex-col bg-slate-950 text-slate-200">
			{/* Top Panel: Media Pool + Preview Monitor */}
			<div className="flex flex-1 overflow-hidden border-b border-slate-800">
				{/* Left: Media Pool / Asset Pool */}
				<div className="flex w-72 flex-col border-r border-slate-800 bg-slate-900/60 p-3 backdrop-blur">
					<div className="flex items-center justify-between pb-2 border-b border-slate-800">
						<div className="flex items-center gap-1.5 text-xs font-semibold text-white">
							<FilmSlate size={16} className="text-blue-400" />
							<span>Media Pool</span>
						</div>
						<button
							type="button"
							className="flex items-center gap-1 rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-400 hover:bg-blue-500/30"
						>
							<UploadSimple size={12} />
							<span>Import</span>
						</button>
					</div>

					{/* Asset list */}
					<div className="flex-1 overflow-y-auto py-2">
						{meta.mediaPool.length === 0 ? (
							<div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 p-4 text-center">
								<FilmSlate size={24} className="text-slate-600 mb-1" />
								<p className="text-[11px] text-slate-400">Tarik video atau B-roll ke sini</p>
							</div>
						) : (
							<div className="space-y-1.5">
								{meta.mediaPool.map((asset) => (
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

				{/* Center: Video Preview Monitor */}
				<div className="flex flex-1 flex-col items-center justify-center p-6 bg-slate-950/60 relative">
					<div
						className="relative flex items-center justify-center overflow-hidden rounded-lg bg-black shadow-2xl border border-slate-800"
						style={{
							aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}`,
							maxHeight: "45vh",
							maxWidth: "65vw",
						}}
					>
						<div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
							<FilmSlate size={36} className="text-blue-400 opacity-60" />
							<span className="text-xs text-slate-400">
								Preview Video NLE ({canvasDimensions.width}x{canvasDimensions.height} @ {canvasDimensions.fps}fps)
							</span>
						</div>
					</div>
				</div>

				{/* Right: Clip Inspector */}
				<div className="w-72 border-l border-slate-800 bg-slate-900/60 p-3 backdrop-blur">
					<div className="text-[10px] font-bold tracking-wider text-blue-400 uppercase mb-2">
						Slide & Clip Inspector
					</div>
					<input
						type="text"
						value={slide.title}
						onChange={(e) => onUpdateTitle?.(e.target.value)}
						className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-semibold text-white focus:border-blue-500 focus:outline-none mb-4"
					/>

					<div className="space-y-3">
						<div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
							<div className="text-[11px] font-semibold text-slate-300 mb-1">Durasi Slide</div>
							<div className="text-xs text-slate-400">{(slide.durationMs / 1000).toFixed(1)} detik</div>
						</div>
						<div className="rounded-lg border border-slate-800 bg-slate-900 p-2.5">
							<div className="text-[11px] font-semibold text-slate-300 mb-1">Status Multi-Track</div>
							<div className="text-xs text-slate-400">
								{meta.videoTracks.reduce((acc, t) => acc + t.clips.length, 0)} klip aktif
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Bottom Panel: CapCut Style Multi-Track Timeline */}
			<div className="flex h-56 flex-col bg-slate-900/90 backdrop-blur">
				{/* Timeline Action Header */}
				<div className="flex items-center justify-between border-b border-slate-800 px-4 py-1.5">
					<div className="flex items-center gap-2">
						<span className="text-[11px] font-semibold text-white uppercase tracking-wider">
							Multi-Track Timeline
						</span>
						<span className="text-[10px] text-slate-500">CapCut / Filmora NLE Mode</span>
					</div>

					<div className="flex items-center gap-1.5">
						<button
							type="button"
							title="Split Clip at Playhead"
							className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700"
						>
							<Scissors size={13} />
							<span>Split</span>
						</button>
						<button
							type="button"
							onClick={() => handleAddSampleClip("track-v1")}
							className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-500"
						>
							<Plus size={13} weight="bold" />
							<span>+ Clip</span>
						</button>
					</div>
				</div>

				{/* Tracks Area */}
				<div className="flex-1 overflow-y-auto p-3 space-y-2">
					{meta.videoTracks.map((track) => (
						<div key={track.id} className="flex items-center gap-2">
							{/* Track Header */}
							<div className="flex w-36 items-center justify-between rounded bg-slate-800/90 px-2 py-2 text-xs font-medium text-slate-300 border border-slate-750">
								<div className="flex items-center gap-1.5 truncate">
									{track.type === "overlay" ? (
										<TextT size={13} className="text-purple-400 shrink-0" />
									) : (
										<FilmSlate size={13} className="text-blue-400 shrink-0" />
									)}
									<span className="truncate text-[11px]">{track.name}</span>
								</div>
								<button
									type="button"
									onClick={() => handleAddSampleClip(track.id)}
									className="text-slate-400 hover:text-white"
									title="Add clip to track"
								>
									<Plus size={12} />
								</button>
							</div>

							{/* Track Lane */}
							<div className="flex flex-1 items-center gap-2 h-9 rounded bg-slate-950/80 px-2 border border-slate-800/80 overflow-x-auto">
								{track.clips.length === 0 ? (
									<span className="text-[10px] text-slate-600 italic">Track kosong</span>
								) : (
									track.clips.map((clip) => {
										const isSelected = selectedClipId === clip.id;
										return (
											<div
												key={clip.id}
												onClick={() => setSelectedClipId(clip.id)}
												className={`flex h-7 items-center justify-between rounded px-2 text-xs transition cursor-pointer ${
													isSelected
														? "bg-blue-600 text-white ring-1 ring-white/50"
														: "bg-blue-950/80 text-blue-200 border border-blue-800/60 hover:bg-blue-900/80"
												}`}
												style={{ width: `${Math.max(80, (clip.durationMs / 1000) * 35)}px` }}
											>
												<span className="truncate text-[10px] font-medium">{clip.title}</span>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														handleDeleteClip(track.id, clip.id);
													}}
													className="text-slate-400 hover:text-rose-400 ml-1"
												>
													<Trash size={11} />
												</button>
											</div>
										);
									})
								)}
							</div>
						</div>
					))}

					{/* Audio Track Lane */}
					<div className="flex items-center gap-2">
						<div className="flex w-36 items-center justify-between rounded bg-slate-800/90 px-2 py-2 text-xs font-medium text-slate-300 border border-slate-750">
							<div className="flex items-center gap-1.5 truncate">
								<MusicNote size={13} className="text-emerald-400 shrink-0" />
								<span className="truncate text-[11px]">Audio Track (A1)</span>
							</div>
							<SpeakerHigh size={12} className="text-slate-500" />
						</div>
						<div className="flex flex-1 items-center gap-2 h-9 rounded bg-slate-950/80 px-2 border border-slate-800/80">
							<span className="text-[10px] text-slate-600 italic">Drop background music atau SFX di sini</span>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
