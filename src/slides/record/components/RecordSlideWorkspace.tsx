import React, { useEffect, useRef, useState } from "react";
import {
	ArrowsClockwise,
	Check,
	CursorClick,
	MagnifyingGlassPlus,
	Palette,
	Pause,
	Play,
	Plus,
	Rewind,
	Trash,
	UploadSimple,
	UserSquare,
	VideoCamera,
} from "@phosphor-icons/react";
import type { SlideWorkspaceProps } from "@/core/slides/types";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";
import type { RecordSlideMeta, ZoomRegion } from "../schema";

function formatTime(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	const tenths = Math.floor((ms % 1000) / 100);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

const WALLPAPER_PRESETS = [
	{ label: "Dark Space", value: "#090d16" },
	{ label: "Deep Slate", value: "#0f172a" },
	{ label: "Midnight", value: "#171717" },
	{ label: "Emerald Deep", value: "#064e3b" },
	{ label: "Indigo Mist", value: "#1e1b4b" },
	{ label: "Gradient Blue", value: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)" },
	{ label: "Gradient Violet", value: "linear-gradient(135deg, #4c1d95 0%, #090d16 100%)" },
];

export const RecordSlideWorkspace: React.FC<SlideWorkspaceProps<RecordSlideMeta>> = ({
	slide,
	onUpdateMeta,
	onUpdateTitle,
	onUpdateDuration,
	canvasDimensions,
}) => {
	const meta = slide.meta;
	const videoRef = useRef<HTMLVideoElement | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const timelineScrubRef = useRef<HTMLDivElement | null>(null);

	const [resolvedVideoSrc, setResolvedVideoSrc] = useState<string>("");
	const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
	const [durationMs, setDurationMs] = useState<number>(slide.durationMs || 5000);
	const [isPlaying, setIsPlaying] = useState<boolean>(false);
	const [activeTab, setActiveTab] = useState<"zoom" | "style" | "motion" | "webcam">("zoom");

	// Resolve video path for browser/Electron playback
	useEffect(() => {
		let isMounted = true;
		if (!meta.videoPath) {
			setResolvedVideoSrc("");
			return;
		}

		resolveMediaElementSource(meta.videoPath)
			.then((res) => {
				if (isMounted) setResolvedVideoSrc(res.src);
			})
			.catch((err) => {
				console.warn("[RecordSlide] Failed to resolve media path:", err);
				if (isMounted) setResolvedVideoSrc(meta.videoPath || "");
			});

		return () => {
			isMounted = false;
		};
	}, [meta.videoPath]);

	// Video events handler
	const handleLoadedMetadata = () => {
		if (videoRef.current) {
			const videoDuration = Math.round(videoRef.current.duration * 1000);
			if (Number.isFinite(videoDuration) && videoDuration > 0) {
				setDurationMs(videoDuration);
				if (Math.abs(videoDuration - slide.durationMs) > 200) {
					onUpdateDuration?.(videoDuration);
				}
			}
		}
	};

	const handleTimeUpdate = () => {
		if (videoRef.current) {
			setCurrentTimeMs(Math.round(videoRef.current.currentTime * 1000));
		}
	};

	const togglePlayPause = () => {
		if (!videoRef.current) return;
		if (isPlaying) {
			videoRef.current.pause();
			setIsPlaying(false);
		} else {
			if (videoRef.current.ended || currentTimeMs >= durationMs - 100) {
				videoRef.current.currentTime = 0;
				setCurrentTimeMs(0);
			}
			videoRef.current.play().catch(() => undefined);
			setIsPlaying(true);
		}
	};

	const handleRewind = () => {
		if (videoRef.current) {
			videoRef.current.currentTime = 0;
			setCurrentTimeMs(0);
		}
	};

	const handleSeek = (ms: number) => {
		const targetMs = Math.max(0, Math.min(durationMs, ms));
		setCurrentTimeMs(targetMs);
		if (videoRef.current) {
			videoRef.current.currentTime = targetMs / 1000;
		}
	};

	const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!timelineScrubRef.current || durationMs <= 0) return;
		const rect = timelineScrubRef.current.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const ratio = Math.max(0, Math.min(1, clickX / rect.width));
		handleSeek(ratio * durationMs);
	};

	// Actions: Ingest Video
	const handleOpenRecorderHud = async () => {
		try {
			if (window.electronAPI?.openRecorderHud) {
				await window.electronAPI.openRecorderHud();
			} else {
				alert("Recorder HUD requires desktop Electron environment.");
			}
		} catch (err) {
			console.error("Failed to open HUD:", err);
		}
	};

	const handleImportVideoPicker = async () => {
		try {
			if (window.electronAPI?.openVideoFilePicker) {
				const res = await window.electronAPI.openVideoFilePicker();
				if (res.success && res.path) {
					onUpdateMeta((prev) => ({
						...prev,
						videoPath: res.path,
					}));
				}
			} else {
				// Fallback to web file input
				fileInputRef.current?.click();
			}
		} catch (err) {
			console.error("Failed to pick video:", err);
		}
	};

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const blobUrl = URL.createObjectURL(file);
			onUpdateMeta((prev) => ({
				...prev,
				videoPath: blobUrl,
			}));
		}
	};

	const handleClearVideo = () => {
		if (isPlaying && videoRef.current) {
			videoRef.current.pause();
			setIsPlaying(false);
		}
		onUpdateMeta((prev) => ({
			...prev,
			videoPath: undefined,
			zoomRegions: [],
		}));
		setResolvedVideoSrc("");
		setCurrentTimeMs(0);
	};

	// Actions: Zoom Management
	const handleAddZoomAtPlayhead = () => {
		const startMs = currentTimeMs;
		const endMs = Math.min(durationMs, startMs + 3000);
		const newZoom: ZoomRegion = {
			id: `zoom-${Date.now()}`,
			startMs,
			endMs,
			depth: 2,
			focus: { x: 0.5, y: 0.5 },
		};

		onUpdateMeta((prev) => ({
			...prev,
			zoomRegions: [...prev.zoomRegions, newZoom].sort((a, b) => a.startMs - b.startMs),
		}));
	};

	const handleDeleteZoom = (zoomId: string) => {
		onUpdateMeta((prev) => ({
			...prev,
			zoomRegions: prev.zoomRegions.filter((z) => z.id !== zoomId),
		}));
	};

	const handleUpdateZoomDepth = (zoomId: string, depth: number) => {
		onUpdateMeta((prev) => ({
			...prev,
			zoomRegions: prev.zoomRegions.map((z) => (z.id === zoomId ? { ...z, depth } : z)),
		}));
	};

	// Check if current playhead is within any zoom region
	const activeZoom = meta.zoomRegions.find(
		(z) => currentTimeMs >= z.startMs && currentTimeMs <= z.endMs,
	);

	// Padding percentage
	const paddingRatio = meta.padding?.left ?? 0.05;

	return (
		<div className="flex h-full w-full bg-slate-950 text-slate-200 select-none">
			<input
				type="file"
				ref={fileInputRef}
				accept="video/*"
				className="hidden"
				onChange={handleFileInputChange}
			/>

			{/* Center Area: Preview Stage & Transport Controls */}
			<div className="flex flex-1 flex-col items-center justify-between p-6 relative overflow-hidden">
				{/* Top Canvas Header Bar */}
				<div className="w-full flex items-center justify-between pb-3 px-2">
					<div className="flex items-center gap-2">
						<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
							<VideoCamera size={14} weight="bold" />
							<span>Record Studio</span>
						</span>
						{meta.videoPath && (
							<span className="text-xs text-slate-400 font-mono truncate max-w-[280px]">
								{meta.videoPath.split(/[/\\]/).pop()}
							</span>
						)}
					</div>
					{meta.videoPath && (
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={handleImportVideoPicker}
								className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
								title="Change Video Source"
							>
								<ArrowsClockwise size={13} />
								<span>Ganti Video</span>
							</button>
							<button
								type="button"
								onClick={handleClearVideo}
								className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors"
								title="Hapus Video"
							>
								<Trash size={13} />
							</button>
						</div>
					)}
				</div>

				{/* Canvas Container with Canvas Dimensions Aspect Ratio */}
				<div className="flex flex-1 items-center justify-center w-full min-h-0 relative">
					<div
						className="relative flex items-center justify-center overflow-hidden rounded-2xl shadow-2xl border border-slate-800 transition-all"
						style={{
							aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}`,
							maxHeight: "68vh",
							maxWidth: "85vw",
							backgroundColor: meta.wallpaper.startsWith("#") ? meta.wallpaper : "#090d16",
							backgroundImage: meta.wallpaper.startsWith("linear") || meta.wallpaper.startsWith("url")
								? meta.wallpaper
								: undefined,
						}}
					>
						{meta.videoPath && resolvedVideoSrc ? (
							<div
								className="relative overflow-hidden bg-black transition-all duration-300 ease-out"
								style={{
									borderRadius: `${meta.borderRadius}px`,
									boxShadow: `0 25px 50px -12px rgba(0, 0, 0, ${meta.shadowIntensity})`,
									width: `calc(100% - ${paddingRatio * 200}%)`,
									height: `calc(100% - ${paddingRatio * 200}%)`,
									transform: activeZoom ? `scale(${activeZoom.depth})` : "scale(1)",
									transformOrigin: activeZoom
										? `${activeZoom.focus.x * 100}% ${activeZoom.focus.y * 100}%`
										: "50% 50%",
								}}
							>
								<video
									ref={videoRef}
									src={resolvedVideoSrc}
									controls={false}
									onLoadedMetadata={handleLoadedMetadata}
									onTimeUpdate={handleTimeUpdate}
									onEnded={() => setIsPlaying(false)}
									onPlay={() => setIsPlaying(true)}
									onPause={() => setIsPlaying(false)}
									className="h-full w-full object-cover"
								/>

								{/* Zoom Badge Indicator */}
								{activeZoom && (
									<div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-full bg-emerald-500/90 px-2.5 py-1 text-xs font-semibold text-slate-950 backdrop-blur shadow">
										<MagnifyingGlassPlus size={13} weight="bold" />
										<span>Zoom {activeZoom.depth}x</span>
									</div>
								)}

								{/* Simulated Webcam PiP */}
								{meta.webcam?.enabled && (
									<div
										className="absolute bottom-4 right-4 z-20 overflow-hidden border-2 border-white/20 bg-slate-900 shadow-2xl flex items-center justify-center"
										style={{
											width: `${(meta.webcam.size ?? 0.25) * 100}%`,
											aspectRatio: "1/1",
											borderRadius: `${meta.webcam.cornerRadius ?? 50}%`,
										}}
									>
										{meta.webcam.sourcePath ? (
											<video
												src={meta.webcam.sourcePath}
												autoPlay
												muted
												loop
												className="h-full w-full object-cover"
											/>
										) : (
											<div className="flex flex-col items-center justify-center text-slate-400">
												<UserSquare size={24} weight="bold" />
												<span className="text-[9px] mt-0.5 font-medium">Cam</span>
											</div>
										)}
									</div>
								)}
							</div>
						) : (
							/* Empty State with Direct Actions */
							<div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-slate-700/60 bg-slate-900/60 p-10 text-center backdrop-blur-md max-w-md mx-auto">
								<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
									<VideoCamera size={36} weight="duotone" />
								</div>
								<div>
									<h4 className="text-base font-bold text-white tracking-tight">
										Record Slide Studio
									</h4>
									<p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
										Mulai rekam layar langsung ke slide ini atau import video rekaman untuk mengaktifkan auto-zoom dan estetika canvas.
									</p>
								</div>
								<div className="flex flex-col sm:flex-row items-center gap-2.5 w-full justify-center pt-2">
									<button
										type="button"
										onClick={handleOpenRecorderHud}
										className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 text-xs font-semibold shadow-lg shadow-red-600/30 transition-all cursor-pointer"
									>
										<VideoCamera size={16} weight="fill" />
										<span>Rekam Layar (HUD)</span>
									</button>
									<button
										type="button"
										onClick={handleImportVideoPicker}
										className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 text-xs font-semibold transition-all cursor-pointer"
									>
										<UploadSimple size={16} weight="bold" />
										<span>Pilih File Video</span>
									</button>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Bottom Transport Scrubber & Playback Controls */}
				{meta.videoPath && (
					<div className="w-full max-w-3xl flex flex-col gap-2 pt-4">
						{/* Scrubber Bar with Zoom Spans Overlay */}
						<div
							ref={timelineScrubRef}
							onClick={handleTimelineClick}
							className="relative h-6 w-full rounded-lg bg-slate-900 border border-slate-800 cursor-pointer overflow-hidden group flex items-center"
						>
							{/* Zoom Span Highlights */}
							{meta.zoomRegions.map((zoom) => {
								const startPct = durationMs > 0 ? (zoom.startMs / durationMs) * 100 : 0;
								const widthPct =
									durationMs > 0 ? ((zoom.endMs - zoom.startMs) / durationMs) * 100 : 0;
								return (
									<div
										key={zoom.id}
										style={{ left: `${startPct}%`, width: `${widthPct}%` }}
										className="absolute top-1 bottom-1 rounded bg-emerald-500/30 border border-emerald-500/60 z-10 pointer-events-none"
										title={`Zoom ${zoom.depth}x`}
									/>
								);
							})}

							{/* Progress Bar */}
							<div
								style={{
									width: durationMs > 0 ? `${(currentTimeMs / durationMs) * 100}%` : "0%",
								}}
								className="h-full bg-blue-600/40 pointer-events-none"
							/>

							{/* Playhead Pin */}
							<div
								style={{
									left: durationMs > 0 ? `${(currentTimeMs / durationMs) * 100}%` : "0%",
								}}
								className="absolute top-0 bottom-0 w-1 bg-white shadow-md z-20 pointer-events-none -ml-0.5"
							/>
						</div>

						{/* Transport Action Bar */}
						<div className="flex items-center justify-between px-1">
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={handleRewind}
									className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
									title="Rewind (0s)"
								>
									<Rewind size={16} weight="fill" />
								</button>
								<button
									type="button"
									onClick={togglePlayPause}
									className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors"
									title={isPlaying ? "Pause" : "Play"}
								>
									{isPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
								</button>
								<span className="text-xs font-mono text-slate-400 pl-2">
									<span className="text-white font-semibold">{formatTime(currentTimeMs)}</span>
									{" / "}
									<span>{formatTime(durationMs)}</span>
								</span>
							</div>

							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={handleAddZoomAtPlayhead}
									className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold transition-all shadow-sm"
								>
									<Plus size={14} weight="bold" />
									<span>Add Zoom di Playhead</span>
								</button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Right Sidebar: Record Slide Inspector */}
			<div className="w-80 border-l border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-4 overflow-y-auto backdrop-blur-md">
				{/* Slide Title Section */}
				<div>
					<div className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
						Record Inspector
					</div>
					<input
						type="text"
						value={slide.title}
						onChange={(e) => onUpdateTitle?.(e.target.value)}
						className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1.5 text-xs font-semibold text-white focus:border-emerald-500 focus:outline-none transition-colors"
						placeholder="Judul Slide"
					/>
				</div>

				{/* Tab Navigation */}
				<div className="grid grid-cols-4 gap-1 p-1 bg-slate-800/70 rounded-xl border border-slate-700/60 text-xs font-medium">
					<button
						type="button"
						onClick={() => setActiveTab("zoom")}
						className={`py-1 rounded-lg text-center transition-all ${
							activeTab === "zoom"
								? "bg-emerald-600 text-white shadow-sm font-semibold"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Zoom
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("style")}
						className={`py-1 rounded-lg text-center transition-all ${
							activeTab === "style"
								? "bg-emerald-600 text-white shadow-sm font-semibold"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Style
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("motion")}
						className={`py-1 rounded-lg text-center transition-all ${
							activeTab === "motion"
								? "bg-emerald-600 text-white shadow-sm font-semibold"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Motion
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("webcam")}
						className={`py-1 rounded-lg text-center transition-all ${
							activeTab === "webcam"
								? "bg-emerald-600 text-white shadow-sm font-semibold"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Webcam
					</button>
				</div>

				{/* TAB 1: SMART ZOOM */}
				{activeTab === "zoom" && (
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold text-white flex items-center gap-1.5">
								<MagnifyingGlassPlus size={16} className="text-emerald-400" />
								<span>Zoom Regions ({meta.zoomRegions.length})</span>
							</span>
							<button
								type="button"
								onClick={handleAddZoomAtPlayhead}
								disabled={!meta.videoPath}
								className="text-[11px] font-semibold text-emerald-400 hover:underline disabled:opacity-40"
							>
								+ Tambah
							</button>
						</div>

						{meta.zoomRegions.length === 0 ? (
							<div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
								Belum ada zoom. Geser playhead dan klik "+ Tambah".
							</div>
						) : (
							<div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
								{meta.zoomRegions.map((zoom, idx) => (
									<div
										key={zoom.id}
										className="rounded-xl border border-slate-800 bg-slate-800/50 p-2.5 flex flex-col gap-2"
									>
										<div className="flex items-center justify-between text-xs">
											<button
												type="button"
												onClick={() => handleSeek(zoom.startMs)}
												className="font-mono text-emerald-400 hover:underline text-[11px]"
												title="Lompat ke Zoom"
											>
												#{idx + 1} {formatTime(zoom.startMs)} → {formatTime(zoom.endMs)}
											</button>
											<button
												type="button"
												onClick={() => handleDeleteZoom(zoom.id)}
												className="text-slate-500 hover:text-red-400 transition-colors"
												title="Hapus Zoom"
											>
												<Trash size={14} />
											</button>
										</div>
										<div className="flex items-center justify-between gap-1">
											<span className="text-[10px] text-slate-400">Depth</span>
											<div className="flex gap-1">
												{[1.5, 2, 2.5, 3].map((depth) => (
													<button
														key={depth}
														type="button"
														onClick={() => handleUpdateZoomDepth(zoom.id, depth)}
														className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
															zoom.depth === depth
																? "bg-emerald-500 text-slate-950 font-bold"
																: "bg-slate-700/60 text-slate-300 hover:bg-slate-700"
														}`}
													>
														{depth}x
													</button>
												))}
											</div>
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				)}

				{/* TAB 2: CANVAS STYLE */}
				{activeTab === "style" && (
					<div className="flex flex-col gap-4">
						{/* Wallpaper Presets */}
						<div>
							<div className="flex items-center gap-1.5 text-xs font-semibold text-white mb-2">
								<Palette size={16} className="text-purple-400" />
								<span>Wallpaper Backdrop</span>
							</div>
							<div className="grid grid-cols-2 gap-1.5">
								{WALLPAPER_PRESETS.map((wp) => {
									const isSelected = meta.wallpaper === wp.value;
									return (
										<button
											key={wp.label}
											type="button"
											onClick={() =>
												onUpdateMeta((prev) => ({ ...prev, wallpaper: wp.value }))
											}
											className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all ${
												isSelected
													? "border-emerald-500 bg-emerald-500/10 text-white"
													: "border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700"
											}`}
										>
											<span className="truncate">{wp.label}</span>
											{isSelected && <Check size={12} className="text-emerald-400 shrink-0" />}
										</button>
									);
								})}
							</div>
						</div>

						{/* Sliders: Radius, Padding, Shadow */}
						<div className="space-y-3 pt-1">
							<div>
								<div className="flex justify-between text-[11px] text-slate-400 mb-1">
									<span>Border Radius</span>
									<span className="font-mono text-white">{meta.borderRadius}px</span>
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
									className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
								/>
							</div>

							<div>
								<div className="flex justify-between text-[11px] text-slate-400 mb-1">
									<span>Canvas Padding</span>
									<span className="font-mono text-white">
										{Math.round((meta.padding?.left ?? 0.05) * 100)}%
									</span>
								</div>
								<input
									type="range"
									min="0.02"
									max="0.15"
									step="0.01"
									value={meta.padding?.left ?? 0.05}
									onChange={(e) => {
										const val = Number(e.target.value);
										onUpdateMeta((prev) => ({
											...prev,
											padding: { top: val, bottom: val, left: val, right: val },
										}));
									}}
									className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
								/>
							</div>

							<div>
								<div className="flex justify-between text-[11px] text-slate-400 mb-1">
									<span>Shadow Intensity</span>
									<span className="font-mono text-white">
										{Math.round(meta.shadowIntensity * 100)}%
									</span>
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
									className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
								/>
							</div>
						</div>
					</div>
				)}

				{/* TAB 3: MOTION & CURSOR */}
				{activeTab === "motion" && (
					<div className="flex flex-col gap-4">
						<div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-3">
							<div className="flex items-center gap-2 text-xs font-semibold text-white">
								<CursorClick size={16} className="text-blue-400" />
								<span>Tampilkan Kursor</span>
							</div>
							<button
								type="button"
								onClick={() =>
									onUpdateMeta((prev) => ({
										...prev,
										showCursor: !prev.showCursor,
									}))
								}
								className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
									meta.showCursor
										? "bg-blue-600 text-white"
										: "bg-slate-800 text-slate-400 border border-slate-700"
								}`}
							>
								{meta.showCursor ? "ON" : "OFF"}
							</button>
						</div>

						<div>
							<div className="flex justify-between text-[11px] text-slate-400 mb-1">
								<span>Cursor Smoothing Spring</span>
								<span className="font-mono text-white">
									{Math.round(meta.cursorSmoothing * 100)}%
								</span>
							</div>
							<input
								type="range"
								min="0.1"
								max="1.0"
								step="0.05"
								value={meta.cursorSmoothing}
								onChange={(e) =>
									onUpdateMeta((prev) => ({
										...prev,
										cursorSmoothing: Number(e.target.value),
									}))
								}
								className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
							/>
							<p className="mt-1.5 text-[10px] text-slate-500 leading-normal">
								Interpolasi spring physics untuk menghilangkan jitter kursor saat demo rekaman.
							</p>
						</div>
					</div>
				)}

				{/* TAB 4: WEBCAM OVERLAY */}
				{activeTab === "webcam" && (
					<div className="flex flex-col gap-4">
						<div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 p-3">
							<div className="flex items-center gap-2 text-xs font-semibold text-white">
								<UserSquare size={16} className="text-emerald-400" />
								<span>Webcam PiP</span>
							</div>
							<button
								type="button"
								onClick={() =>
									onUpdateMeta((prev) => ({
										...prev,
										webcam: {
											...prev.webcam,
											enabled: !prev.webcam.enabled,
										},
									}))
								}
								className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
									meta.webcam?.enabled
										? "bg-emerald-600 text-white"
										: "bg-slate-800 text-slate-400 border border-slate-700"
								}`}
							>
								{meta.webcam?.enabled ? "ON" : "OFF"}
							</button>
						</div>

						{meta.webcam?.enabled && (
							<div className="space-y-3">
								<div>
									<div className="flex justify-between text-[11px] text-slate-400 mb-1">
										<span>Ukuran Avatar PiP</span>
										<span className="font-mono text-white">
											{Math.round((meta.webcam.size ?? 0.25) * 100)}%
										</span>
									</div>
									<input
										type="range"
										min="0.15"
										max="0.45"
										step="0.02"
										value={meta.webcam.size ?? 0.25}
										onChange={(e) =>
											onUpdateMeta((prev) => ({
												...prev,
												webcam: {
													...prev.webcam,
													size: Number(e.target.value),
												},
											}))
										}
										className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
									/>
								</div>

								<div>
									<div className="flex justify-between text-[11px] text-slate-400 mb-1">
										<span>Bentuk PiP</span>
										<span className="font-mono text-white">
											{(meta.webcam.cornerRadius ?? 50) === 50 ? "Circle" : "Squircle"}
										</span>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<button
											type="button"
											onClick={() =>
												onUpdateMeta((prev) => ({
													...prev,
													webcam: { ...prev.webcam, cornerRadius: 50 },
												}))
											}
											className={`py-1.5 rounded-lg border text-xs font-medium ${
												(meta.webcam.cornerRadius ?? 50) === 50
													? "border-emerald-500 bg-emerald-500/10 text-white"
													: "border-slate-800 bg-slate-800/40 text-slate-400"
											}`}
										>
											Circle
										</button>
										<button
											type="button"
											onClick={() =>
												onUpdateMeta((prev) => ({
													...prev,
													webcam: { ...prev.webcam, cornerRadius: 16 },
												}))
											}
											className={`py-1.5 rounded-lg border text-xs font-medium ${
												(meta.webcam.cornerRadius ?? 50) !== 50
													? "border-emerald-500 bg-emerald-500/10 text-white"
													: "border-slate-800 bg-slate-800/40 text-slate-400"
											}`}
										>
											Squircle
										</button>
									</div>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};
