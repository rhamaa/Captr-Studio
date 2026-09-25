import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	ArrowsClockwise,
	Check,
	Compass,
	CursorClick,
	FrameCorners,
	MagicWand as WandSparkles,
	MagnifyingGlassPlus,
	Palette,
	Pause,
	Play,
	Plus,
	Rewind,
	Scissors,
	Spinner,
	Trash,
	UploadSimple,
	UserSquare,
	VideoCamera,
	Waveform,
	X,
} from "@phosphor-icons/react";
import type { SlideWorkspaceProps } from "@/core/slides/types";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";
import VideoPlayback, { type VideoPlaybackRef } from "@/components/video-editor/VideoPlayback";
import {
	buildInteractionZoomSuggestions,
	normalizeCursorTelemetry,
} from "@/components/video-editor/timeline/zoomSuggestionUtils";
import {
	applySilenceRemovalToTimeline,
	detectSilenceFromAudioUrl,
	type SilenceRegion,
} from "@/components/video-editor/audio/silenceDetector";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type {
	CursorStyle,
	CursorTelemetryPoint,
	WebcamCorner,
	WebcamPositionPreset,
	ZoomDepth,
	ZoomFocus,
	ZoomRegion,
} from "@/components/video-editor/types";
import type { RecordSlideMeta } from "../schema";

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
	{ label: "Tahoe Light", value: "wallpapers/tahoe-light.jpg" },
];

const FRAME_PRESETS = [
	{ id: null, label: "None" },
	{ id: "mac-dark", label: "macOS Dark" },
	{ id: "mac-light", label: "macOS Light" },
	{ id: "glass", label: "Glassy" },
];

const CURSOR_STYLES: Array<{ id: CursorStyle; label: string }> = [
	{ id: "macos", label: "macOS" },
	{ id: "windows", label: "Windows" },
	{ id: "circle", label: "Dot Circle" },
	{ id: "glow", label: "Glow" },
];

export const RecordSlideWorkspace: React.FC<SlideWorkspaceProps<RecordSlideMeta>> = ({
	slide,
	onUpdateMeta,
	onUpdateTitle,
	onUpdateDuration,
	canvasDimensions,
}) => {
	const meta = slide.meta;
	const videoPlaybackRef = useRef<VideoPlaybackRef | null>(null);
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const webcamFileInputRef = useRef<HTMLInputElement | null>(null);
	const timelineScrubRef = useRef<HTMLDivElement | null>(null);

	const [resolvedVideoSrc, setResolvedVideoSrc] = useState<string>("");
	const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
	const [durationMs, setDurationMs] = useState<number>(slide.durationMs || 5000);
	const [isPlaying, setIsPlaying] = useState<boolean>(false);
	const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
	const [rawTelemetry, setRawTelemetry] = useState<CursorTelemetryPoint[]>([]);
	const [activeTab, setActiveTab] = useState<"zoom" | "cursor" | "camera" | "canvas" | "webcam">("zoom");

	// Determine matching AspectRatio string for VideoPlayback
	const currentAspectRatio: AspectRatio = useMemo(() => {
		if (canvasDimensions.width === 1080 && canvasDimensions.height === 1920) return "9:16";
		if (canvasDimensions.width === 1080 && canvasDimensions.height === 1080) return "1:1";
		return "16:9";
	}, [canvasDimensions.width, canvasDimensions.height]);

	// Resolve video path for PixiJS WebGL video texture
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

	// Load Cursor Telemetry from file / Electron IPC
	useEffect(() => {
		if (!meta.videoPath) {
			setRawTelemetry([]);
			return;
		}
		if (meta.cursorTelemetry && meta.cursorTelemetry.length > 0) {
			setRawTelemetry(meta.cursorTelemetry);
			return;
		}
		if (window.electronAPI?.getCursorTelemetry) {
			window.electronAPI
				.getCursorTelemetry(meta.videoPath)
				.then((res) => {
					if (res.success && res.samples && res.samples.length > 0) {
						setRawTelemetry(res.samples);
					}
				})
				.catch((err) => {
					console.warn("[RecordSlide] Unable to load cursor telemetry:", err);
				});
		}
	}, [meta.videoPath, meta.cursorTelemetry]);

	// Normalize telemetry
	const normalizedTelemetry = useMemo(() => {
		if (!rawTelemetry || rawTelemetry.length === 0) return [];
		return normalizeCursorTelemetry(rawTelemetry, durationMs);
	}, [rawTelemetry, durationMs]);

	// Tahap 4: Descript-style Silence Removal State
	const [isAnalyzingSilence, setIsAnalyzingSilence] = useState<boolean>(false);
	const [silenceModalOpen, setSilenceModalOpen] = useState<boolean>(false);
	const [detectedSilences, setDetectedSilences] = useState<SilenceRegion[]>([]);
	const [selectedSilenceIds, setSelectedSilenceIds] = useState<Set<string>>(new Set());
	const [silenceThresholdDb, setSilenceThresholdDb] = useState<number>(-36);
	const [silenceMinDurationMs, setSilenceMinDurationMs] = useState<number>(1000);
	const [silenceSuccessMessage, setSilenceSuccessMessage] = useState<string | null>(null);

	// Tahap 3: Webcam Auto-Dodge Collision Logic (Screen Studio style)
	const { effectiveWebcam, isWebcamDodging, dodgedToPreset } = useMemo(() => {
		const baseWebcam = meta.webcam;
		if (!baseWebcam || !baseWebcam.enabled || baseWebcam.reactToZoom === false) {
			return { effectiveWebcam: baseWebcam, isWebcamDodging: false, dodgedToPreset: null };
		}

		// Check if active zoom region exists at current playback time
		const activeZoom = meta.zoomRegions.find(
			(z) => currentTimeMs >= z.startMs && currentTimeMs <= z.endMs,
		);
		if (!activeZoom || !activeZoom.focus) {
			return { effectiveWebcam: baseWebcam, isWebcamDodging: false, dodgedToPreset: null };
		}

		const { cx, cy } = activeZoom.focus;
		const currentPreset: WebcamPositionPreset =
			baseWebcam.positionPreset ?? baseWebcam.corner ?? "bottom-right";

		let isColliding = false;
		let dodgedPreset: WebcamPositionPreset = currentPreset;

		// Check quadrant collision between zoom focus and current webcam placement
		if (currentPreset === "bottom-right" && cx > 0.55 && cy > 0.55) {
			isColliding = true;
			dodgedPreset = cy > 0.75 ? "top-right" : "bottom-left";
		} else if (currentPreset === "bottom-left" && cx < 0.45 && cy > 0.55) {
			isColliding = true;
			dodgedPreset = cy > 0.75 ? "top-left" : "bottom-right";
		} else if (currentPreset === "top-right" && cx > 0.55 && cy < 0.45) {
			isColliding = true;
			dodgedPreset = cy < 0.25 ? "bottom-right" : "top-left";
		} else if (currentPreset === "top-left" && cx < 0.45 && cy < 0.45) {
			isColliding = true;
			dodgedPreset = cy < 0.25 ? "bottom-left" : "top-right";
		}

		if (isColliding) {
			const cornerPreset = dodgedPreset as WebcamCorner;
			return {
				effectiveWebcam: {
					...baseWebcam,
					positionPreset: dodgedPreset,
					corner: cornerPreset,
				},
				isWebcamDodging: true,
				dodgedToPreset: dodgedPreset,
			};
		}

		return { effectiveWebcam: baseWebcam, isWebcamDodging: false, dodgedToPreset: null };
	}, [meta.webcam, meta.zoomRegions, currentTimeMs]);

	// Playback Transport Controls
	const togglePlayPause = () => {
		if (isPlaying) {
			videoPlaybackRef.current?.pause();
			setIsPlaying(false);
		} else {
			videoPlaybackRef.current?.play().catch(() => undefined);
			setIsPlaying(true);
		}
	};

	const handleRewind = () => {
		handleSeek(0);
	};

	const handleSeek = (ms: number) => {
		const clampedMs = Math.max(0, Math.min(durationMs, ms));
		setCurrentTimeMs(clampedMs);
		if (videoPlaybackRef.current?.video) {
			videoPlaybackRef.current.video.currentTime = clampedMs / 1000;
		}
	};

	const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
		if (!timelineScrubRef.current || durationMs <= 0) return;
		const rect = timelineScrubRef.current.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const ratio = Math.max(0, Math.min(1, clickX / rect.width));
		handleSeek(ratio * durationMs);
	};

	// Actions: Ingest
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

	const handleWebcamPicker = async () => {
		try {
			if (window.electronAPI?.openVideoFilePicker) {
				const res = await window.electronAPI.openVideoFilePicker();
				if (res.success && res.path) {
					onUpdateMeta((prev) => ({
						...prev,
						webcam: {
							...prev.webcam,
							sourcePath: res.path ?? null,
							enabled: true,
						},
						webcamPath: res.path ?? null,
					}));
				}
			} else {
				webcamFileInputRef.current?.click();
			}
		} catch (err) {
			console.error("Failed to pick webcam video:", err);
		}
	};

	const handleWebcamFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const blobUrl = URL.createObjectURL(file);
			onUpdateMeta((prev) => ({
				...prev,
				webcam: {
					...prev.webcam,
					sourcePath: blobUrl,
					enabled: true,
				},
				webcamPath: blobUrl,
			}));
		}
	};

	const handleClearVideo = () => {
		if (isPlaying) {
			videoPlaybackRef.current?.pause();
			setIsPlaying(false);
		}
		onUpdateMeta((prev) => ({
			...prev,
			videoPath: undefined,
			zoomRegions: [],
		}));
		setResolvedVideoSrc("");
		setCurrentTimeMs(0);
		setSelectedZoomId(null);
	};

	// Tahap 2: Auto-Suggest Zooms via Telemetry Click Analysis
	const handleAutoSuggestZooms = () => {
		if (!normalizedTelemetry.length) {
			alert(
				"Belum ada data rekaman kursor (telemetry). Tambahkan zoom manual via tombol '+ Add Zoom di Playhead'.",
			);
			return;
		}

		const result = buildInteractionZoomSuggestions({
			cursorTelemetry: normalizedTelemetry,
			totalMs: durationMs,
			defaultDurationMs: 2500,
			reservedSpans: meta.zoomRegions.map((z) => ({ start: z.startMs, end: z.endMs })),
		});

		if (result.suggestions.length === 0) {
			alert("Tidak ada interaksi klik baru yang terdeteksi di luar zoom saat ini.");
			return;
		}

		const newZooms: ZoomRegion[] = result.suggestions.map((s, idx) => ({
			id: `zoom-${Date.now()}-${idx}`,
			startMs: s.start,
			endMs: s.end,
			depth: (s.depth ?? 2) as ZoomDepth,
			focus: s.focus,
			mode: "auto",
		}));

		onUpdateMeta((prev) => ({
			...prev,
			zoomRegions: [...prev.zoomRegions, ...newZooms].sort((a, b) => a.startMs - b.startMs),
		}));
		setSelectedZoomId(newZooms[0].id);
	};

	const handleAddZoomAtPlayhead = () => {
		const startMs = currentTimeMs;
		const endMs = Math.min(durationMs, startMs + 2500);
		const newZoom: ZoomRegion = {
			id: `zoom-${Date.now()}`,
			startMs,
			endMs,
			depth: 2 as ZoomDepth,
			focus: { cx: 0.5, cy: 0.5 },
			mode: "auto",
		};

		onUpdateMeta((prev) => ({
			...prev,
			zoomRegions: [...prev.zoomRegions, newZoom].sort((a, b) => a.startMs - b.startMs),
		}));
		setSelectedZoomId(newZoom.id);
	};

	const handleDeleteZoom = (zoomId: string) => {
		onUpdateMeta((prev) => ({
			...prev,
			zoomRegions: prev.zoomRegions.filter((z) => z.id !== zoomId),
		}));
		if (selectedZoomId === zoomId) setSelectedZoomId(null);
	};

	const handleUpdateZoomDepth = (zoomId: string, depth: ZoomDepth) => {
		onUpdateMeta((prev) => ({
			...prev,
			zoomRegions: prev.zoomRegions.map((z) => (z.id === zoomId ? { ...z, depth } : z)),
		}));
	};

	const handleZoomFocusChange = (id: string, focus: ZoomFocus) => {
		onUpdateMeta((prev) => ({
			...prev,
			zoomRegions: prev.zoomRegions.map((z) =>
				z.id === id ? { ...z, focus, mode: "manual" } : z,
			),
		}));
	};

	// Tahap 4: Descript-style Silence Removal Handlers
	const handleAnalyzeSilence = async () => {
		if (!resolvedVideoSrc) {
			alert("Silakan pilih file video atau rekam layar terlebih dahulu.");
			return;
		}

		setIsAnalyzingSilence(true);
		try {
			const result = await detectSilenceFromAudioUrl(resolvedVideoSrc, {
				thresholdDb: silenceThresholdDb,
				minDurationMs: silenceMinDurationMs,
				speechPaddingMs: 150,
			});

			if (result.silences.length === 0) {
				alert(
					`Tidak ada jeda dead-air hening di atas ${silenceMinDurationMs}ms yang terdeteksi (ambang ${silenceThresholdDb} dB).`,
				);
				setIsAnalyzingSilence(false);
				return;
			}

			setDetectedSilences(result.silences);
			setSelectedSilenceIds(new Set(result.silences.map((s) => s.id)));
			setSilenceModalOpen(true);
		} catch (err) {
			console.warn("[RecordSlide] Silence detection error:", err);
			alert("Gagal menganalisis audio: " + (err instanceof Error ? err.message : String(err)));
		} finally {
			setIsAnalyzingSilence(false);
		}
	};

	const handleApplySilenceRemoval = () => {
		const confirmedSilences = detectedSilences.filter((s) => selectedSilenceIds.has(s.id));
		if (confirmedSilences.length === 0) {
			setSilenceModalOpen(false);
			return;
		}

		const totalCutMs = confirmedSilences.reduce((acc, s) => acc + s.durationMs, 0);

		const result = applySilenceRemovalToTimeline({
			silences: confirmedSilences,
			clipRegions: meta.clipRegions ?? [],
			zoomRegions: meta.zoomRegions,
			annotationRegions: meta.annotationRegions ?? [],
			layoutRegions: meta.layoutRegions ?? [],
			audioRegions: meta.audioRegions ?? [],
			totalDurationMs: durationMs,
		});

		const newDurationMs = Math.max(1000, durationMs - totalCutMs);

		onUpdateMeta((prev) => ({
			...prev,
			clipRegions: result.clipRegions,
			zoomRegions: result.zoomRegions,
			trimRegions: confirmedSilences.map((s) => ({
				id: s.id,
				startMs: s.startMs,
				endMs: s.endMs,
			})),
		}));

		setDurationMs(newDurationMs);
		onUpdateDuration?.(newDurationMs);
		handleSeek(0);
		setSilenceModalOpen(false);

		setSilenceSuccessMessage(
			`Berhasil memotong ${confirmedSilences.length} dead-air (hemat ${(totalCutMs / 1000).toFixed(1)}s)!`,
		);
		setTimeout(() => setSilenceSuccessMessage(null), 4000);
	};

	const handleResetSilenceCuts = () => {
		if (confirm("Kembalikan rekaman ke durasi utuh tanpa potongan jeda?")) {
			onUpdateMeta((prev) => ({
				...prev,
				clipRegions: [],
				trimRegions: [],
			}));
			if (videoPlaybackRef.current?.video?.duration) {
				const origDur = Math.round(videoPlaybackRef.current.video.duration * 1000);
				setDurationMs(origDur);
				onUpdateDuration?.(origDur);
			}
			handleSeek(0);
		}
	};

	return (
		<div className="flex h-full w-full bg-slate-950 text-slate-200 select-none">
			<input
				type="file"
				ref={fileInputRef}
				accept="video/*"
				className="hidden"
				onChange={handleFileInputChange}
			/>

			{/* Center Area: Preview Canvas & Playback Transport */}
			<div className="flex flex-1 flex-col items-center justify-between p-6 relative overflow-hidden">
				{/* Top Canvas Header Bar */}
				<div className="w-full flex items-center justify-between pb-3 px-2">
					<div className="flex items-center gap-2">
						<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
							<VideoCamera size={14} weight="bold" />
							<span>Screen Studio Canvas</span>
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
								className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
								title="Change Video Source"
							>
								<ArrowsClockwise size={13} />
								<span>Ganti Video</span>
							</button>
							<button
								type="button"
								onClick={handleClearVideo}
								className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
								title="Hapus Video"
							>
								<Trash size={13} />
							</button>
						</div>
					)}
				</div>

				{/* Tahap 1: PixiJS WebGL Canvas Compositor via VideoPlayback */}
				<div className="flex flex-1 items-center justify-center w-full min-h-0 relative">
					{meta.videoPath && resolvedVideoSrc ? (
						<div
							className="relative flex items-center justify-center overflow-hidden rounded-2xl shadow-2xl border border-slate-800"
							style={{
								aspectRatio: `${canvasDimensions.width} / ${canvasDimensions.height}`,
								width: "100%",
								maxWidth: "92vw",
								height: "100%",
								maxHeight: "68vh",
							}}
						>
							<VideoPlayback
								ref={videoPlaybackRef}
								videoPath={resolvedVideoSrc}
								currentTime={currentTimeMs / 1000}
								isPlaying={isPlaying}
								onTimeUpdate={(sec) => setCurrentTimeMs(Math.round(sec * 1000))}
								onDurationChange={(sec) => {
									const dur = Math.round(sec * 1000);
									// Keep cut duration if clipRegions are active
									if (!meta.clipRegions || meta.clipRegions.length === 0) {
										setDurationMs(dur);
										if (Math.abs(dur - slide.durationMs) > 200) {
											onUpdateDuration?.(dur);
										}
									}
								}}
								onPlayStateChange={setIsPlaying}
								onError={(err) => console.warn("[RecordSlide VideoPlayback error]:", err)}
								wallpaper={meta.wallpaper}
								zoomRegions={meta.zoomRegions}
								clipRegions={meta.clipRegions ?? []}
								selectedZoomId={selectedZoomId}
								onSelectZoom={setSelectedZoomId}
								onZoomFocusChange={handleZoomFocusChange}
								showShadow={meta.shadowIntensity > 0}
								shadowIntensity={meta.shadowIntensity}
								backgroundBlur={meta.backgroundBlur}
								borderRadius={meta.borderRadius}
								padding={meta.padding}
								frame={meta.frame}
								cursorTelemetry={normalizedTelemetry}
								showCursor={meta.showCursor}
								cursorStyle={meta.cursorStyle ?? "macos"}
								cursorSize={meta.cursorSize ?? 2.5}
								cursorSmoothing={meta.cursorSmoothing ?? 0.67}
								cursorClickBounce={meta.cursorClickBounce ?? 2.5}
								cursorSway={meta.cursorSway ?? 0.4}
								cameraPerspectiveTilt={meta.cameraPerspectiveTilt ?? 0}
								zoomMotionBlur={meta.zoomMotionBlur ?? 0.35}
								connectZooms={meta.connectZooms ?? true}
								zoomInDurationMs={meta.zoomInDurationMs ?? 200}
								zoomOutDurationMs={meta.zoomOutDurationMs ?? 200}
								webcam={effectiveWebcam}
								webcamVideoPath={meta.webcam?.sourcePath ?? meta.webcamPath ?? null}
								aspectRatio={currentAspectRatio}
							/>
						</div>
					) : (
						/* Empty State with Direct Ingest Triggers */
						<div className="flex flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-slate-700/60 bg-slate-900/60 p-10 text-center backdrop-blur-md max-w-md mx-auto">
							<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
								<VideoCamera size={36} weight="duotone" />
							</div>
							<div>
								<h4 className="text-base font-bold text-white tracking-tight">
									Screen Studio Slide Mode
								</h4>
								<p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
									Rekam layar langsung ke slide ini atau import rekaman untuk mengaktifkan PixiJS WebGL canvas, spring camera auto-zoom, dan cursor smoothing.
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

				{/* Bottom Transport Scrubber & Playback Controls */}
				{meta.videoPath && (
					<div className="w-full max-w-3xl flex flex-col gap-2 pt-4">
						{/* Scrubber Bar with Visual Zoom Span Highlights */}
						<div
							ref={timelineScrubRef}
							onClick={handleTimelineClick}
							className="relative h-6 w-full rounded-lg bg-slate-900 border border-slate-800 cursor-pointer overflow-hidden group flex items-center"
						>
							{/* Dead-Air Cut Highlights */}
							{meta.trimRegions?.map((trim) => {
								const startPct = durationMs > 0 ? (trim.startMs / durationMs) * 100 : 0;
								const widthPct =
									durationMs > 0 ? ((trim.endMs - trim.startMs) / durationMs) * 100 : 0;
								return (
									<div
										key={trim.id}
										style={{ left: `${startPct}%`, width: `${widthPct}%` }}
										className="absolute top-0 bottom-0 bg-red-500/30 border-x border-red-500/60 z-5 pointer-events-none"
										title={`Dead-air cut: ${((trim.endMs - trim.startMs) / 1000).toFixed(1)}s`}
									/>
								);
							})}

							{/* Zoom Span Highlights */}
							{meta.zoomRegions.map((zoom) => {
								const startPct = durationMs > 0 ? (zoom.startMs / durationMs) * 100 : 0;
								const widthPct =
									durationMs > 0 ? ((zoom.endMs - zoom.startMs) / durationMs) * 100 : 0;
								const isSelected = selectedZoomId === zoom.id;
								return (
									<div
										key={zoom.id}
										style={{ left: `${startPct}%`, width: `${widthPct}%` }}
										className={`absolute top-1 bottom-1 rounded border z-10 pointer-events-none transition-all ${
											isSelected
												? "bg-emerald-500/50 border-emerald-400 shadow-sm"
												: "bg-emerald-500/25 border-emerald-500/50"
										}`}
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

						{/* Success Message Banner */}
						{silenceSuccessMessage && (
							<div className="flex items-center justify-center gap-1.5 py-1 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium animate-fadeIn">
								<Check size={14} weight="bold" />
								<span>{silenceSuccessMessage}</span>
							</div>
						)}

						{/* Transport Action Bar */}
						<div className="flex items-center justify-between px-1">
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={handleRewind}
									className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
									title="Rewind (0s)"
								>
									<Rewind size={16} weight="fill" />
								</button>
								<button
									type="button"
									onClick={togglePlayPause}
									className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-colors cursor-pointer"
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
								{/* Tahap 4: Descript-style Silence Removal Button */}
								<button
									type="button"
									onClick={handleAnalyzeSilence}
									disabled={isAnalyzingSilence}
									className="flex items-center gap-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 px-3 py-1.5 text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50"
									title="Deteksi dan potong jeda dead-air hening 1-klik ala Descript & Screen Studio"
								>
									{isAnalyzingSilence ? (
										<Spinner size={14} className="animate-spin text-rose-400" />
									) : (
										<Scissors size={14} weight="bold" />
									)}
									<span>{isAnalyzingSilence ? "Menganalisis..." : "Clean Pauses"}</span>
								</button>

								{/* Reset Cuts Button */}
								{((meta.clipRegions && meta.clipRegions.length > 0) ||
									(meta.trimRegions && meta.trimRegions.length > 0)) && (
									<button
										type="button"
										onClick={handleResetSilenceCuts}
										className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
										title="Reset potongan jeda hening ke durasi video utuh"
									>
										<ArrowsClockwise size={13} />
										<span>Reset Cuts</span>
									</button>
								)}

								{/* Tahap 2: Auto-Suggest Zooms button */}
								<button
									type="button"
									onClick={handleAutoSuggestZooms}
									className="flex items-center gap-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 px-3 py-1.5 text-xs font-semibold transition-all shadow-sm cursor-pointer"
									title="Auto-detect klik kursor untuk membuat zoom otomatis ala Screen Studio"
								>
									<WandSparkles size={14} weight="bold" />
									<span>Auto-Suggest Zooms</span>
								</button>

								<button
									type="button"
									onClick={handleAddZoomAtPlayhead}
									className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold transition-all shadow-sm cursor-pointer"
								>
									<Plus size={14} weight="bold" />
									<span>Add Zoom</span>
								</button>
							</div>
						</div>
					</div>
				)}

				{/* Tahap 4: Descript-style Silence Removal Modal Dialog */}
				{silenceModalOpen && (
					<div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
						<div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl flex flex-col gap-4 text-slate-200">
							{/* Modal Header */}
							<div className="flex items-center justify-between border-b border-slate-800 pb-3">
								<div className="flex items-center gap-2">
									<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400">
										<Scissors size={18} weight="bold" />
									</div>
									<div>
										<h3 className="text-sm font-bold text-white">Clean Pauses / Dead-Air</h3>
										<p className="text-[11px] text-slate-400">
											{detectedSilences.length} jeda hening terdeteksi (hemat{" "}
											{(
												detectedSilences.reduce((acc, s) => acc + s.durationMs, 0) / 1000
											).toFixed(1)}
											s)
										</p>
									</div>
								</div>
								<button
									type="button"
									onClick={() => setSilenceModalOpen(false)}
									className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
								>
									<X size={16} />
								</button>
							</div>

							{/* Sensitivity Sliders */}
							<div className="space-y-3 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
								<div>
									<div className="flex justify-between text-[11px] text-slate-400 mb-1">
										<span>Threshold Sensitivitas Hening</span>
										<span className="font-mono text-white">{silenceThresholdDb} dB</span>
									</div>
									<input
										type="range"
										min="-50"
										max="-20"
										step="2"
										value={silenceThresholdDb}
										onChange={(e) => setSilenceThresholdDb(Number(e.target.value))}
										className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
									/>
								</div>

								<div>
									<div className="flex justify-between text-[11px] text-slate-400 mb-1">
										<span>Durasi Jeda Minimal</span>
										<span className="font-mono text-white">{silenceMinDurationMs} ms</span>
									</div>
									<input
										type="range"
										min="500"
										max="2500"
										step="100"
										value={silenceMinDurationMs}
										onChange={(e) => setSilenceMinDurationMs(Number(e.target.value))}
										className="w-full accent-rose-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
									/>
								</div>

								<button
									type="button"
									onClick={handleAnalyzeSilence}
									disabled={isAnalyzingSilence}
									className="w-full py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
								>
									{isAnalyzingSilence ? (
										<Spinner size={13} className="animate-spin text-rose-400" />
									) : (
										<Waveform size={13} />
									)}
									<span>Hitung Ulang Analisis</span>
								</button>
							</div>

							{/* Detected Silences List */}
							<div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
								<div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
									Daftar Jeda Diam:
								</div>
								{detectedSilences.map((silence, idx) => {
									const isChecked = selectedSilenceIds.has(silence.id);
									return (
										<div
											key={silence.id}
											onClick={() => {
												const next = new Set(selectedSilenceIds);
												if (next.has(silence.id)) next.delete(silence.id);
												else next.add(silence.id);
												setSelectedSilenceIds(next);
											}}
											className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
												isChecked
													? "border-rose-500/40 bg-rose-500/10 text-white"
													: "border-slate-800 bg-slate-800/30 text-slate-500"
											}`}
										>
											<div className="flex items-center gap-2">
												<input
													type="checkbox"
													checked={isChecked}
													onChange={() => {}}
													className="accent-rose-500 cursor-pointer rounded"
												/>
												<span className="font-medium">Jeda #{idx + 1}</span>
											</div>
											<div className="font-mono text-[11px] text-slate-400">
												{formatTime(silence.startMs)} - {formatTime(silence.endMs)} (
												<span className="text-rose-400 font-semibold">
													{(silence.durationMs / 1000).toFixed(1)}s
												</span>
												)
											</div>
										</div>
									);
								})}
							</div>

							{/* Modal Footer */}
							<div className="flex items-center justify-end gap-2 border-t border-slate-800 pt-3">
								<button
									type="button"
									onClick={() => setSilenceModalOpen(false)}
									className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
								>
									Batal
								</button>
								<button
									type="button"
									onClick={handleApplySilenceRemoval}
									disabled={selectedSilenceIds.size === 0}
									className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
								>
									<Check size={14} weight="bold" />
									<span>Potong {selectedSilenceIds.size} Jeda (Ripple Cut)</span>
								</button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Right Sidebar: Screen Studio Inspector */}
			<div className="w-80 border-l border-slate-800 bg-slate-900/60 p-4 flex flex-col gap-4 overflow-y-auto backdrop-blur-md">
				{/* Slide Title Section */}
				<div>
					<div className="text-[10px] font-bold tracking-wider text-emerald-400 uppercase">
						Screen Studio Inspector
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
				<div className="grid grid-cols-5 gap-1 p-1 bg-slate-800/70 rounded-xl border border-slate-700/60 text-xs font-medium">
					<button
						type="button"
						onClick={() => setActiveTab("zoom")}
						className={`py-1 rounded-lg text-center transition-all cursor-pointer ${
							activeTab === "zoom"
								? "bg-emerald-600 text-white shadow-sm font-semibold"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Zoom
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("cursor")}
						className={`py-1 rounded-lg text-center transition-all cursor-pointer ${
							activeTab === "cursor"
								? "bg-emerald-600 text-white shadow-sm font-semibold"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Cursor
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("camera")}
						className={`py-1 rounded-lg text-center transition-all cursor-pointer ${
							activeTab === "camera"
								? "bg-emerald-600 text-white shadow-sm font-semibold"
								: "text-slate-400 hover:text-white"
						}`}
					>
						3D
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("canvas")}
						className={`py-1 rounded-lg text-center transition-all cursor-pointer ${
							activeTab === "canvas"
								? "bg-emerald-600 text-white shadow-sm font-semibold"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Canvas
					</button>
					<button
						type="button"
						onClick={() => setActiveTab("webcam")}
						className={`py-1 rounded-lg text-center transition-all cursor-pointer ${
							activeTab === "webcam"
								? "bg-emerald-600 text-white shadow-sm font-semibold"
								: "text-slate-400 hover:text-white"
						}`}
					>
						Webcam
					</button>
				</div>

				{/* TAB 1: SMART ZOOM (TAHAP 2) */}
				{activeTab === "zoom" && (
					<div className="flex flex-col gap-3">
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold text-white flex items-center gap-1.5">
								<MagnifyingGlassPlus size={16} className="text-emerald-400" />
								<span>Zoom Regions ({meta.zoomRegions.length})</span>
							</span>
							<button
								type="button"
								onClick={handleAutoSuggestZooms}
								disabled={!meta.videoPath}
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
								onClick={() =>
									onUpdateMeta((prev) => ({
										...prev,
										connectZooms: !prev.connectZooms,
									}))
								}
								className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
									meta.connectZooms !== false
										? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
										: "bg-slate-800 text-slate-500"
								}`}
							>
								{meta.connectZooms !== false ? "ON" : "OFF"}
							</button>
						</div>

						{meta.zoomRegions.length === 0 ? (
							<div className="rounded-xl border border-dashed border-slate-800 p-4 text-center text-xs text-slate-500">
								Belum ada zoom. Klik "Auto-Detect" atau geser playhead lalu klik "+ Add Zoom".
							</div>
						) : (
							<div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
								{meta.zoomRegions.map((zoom, idx) => {
									const isSelected = selectedZoomId === zoom.id;
									return (
										<div
											key={zoom.id}
											onClick={() => setSelectedZoomId(zoom.id)}
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
														handleSeek(zoom.startMs);
														setSelectedZoomId(zoom.id);
													}}
													className="font-mono text-emerald-400 hover:underline text-[11px]"
													title="Lompat ke Zoom"
												>
													#{idx + 1} {formatTime(zoom.startMs)} → {formatTime(zoom.endMs)}
												</button>
												<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														handleDeleteZoom(zoom.id);
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
																	handleUpdateZoomDepth(zoom.id, depth);
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
				)}

				{/* TAB 2: CINEMATIC CURSOR */}
				{activeTab === "cursor" && (
					<div className="flex flex-col gap-4">
						{/* Cursor toggle */}
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
								className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
									meta.showCursor
										? "bg-blue-600 text-white"
										: "bg-slate-800 text-slate-400 border border-slate-700"
								}`}
							>
								{meta.showCursor ? "ON" : "OFF"}
							</button>
						</div>

						{/* Cursor Style */}
						<div>
							<div className="text-[11px] text-slate-400 mb-1.5">Gaya Kursor</div>
							<div className="grid grid-cols-2 gap-1.5">
								{CURSOR_STYLES.map((st) => (
									<button
										key={st.id}
										type="button"
										onClick={() =>
											onUpdateMeta((prev) => ({
												...prev,
												cursorStyle: st.id,
											}))
										}
										className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
											(meta.cursorStyle ?? "macos") === st.id
												? "border-blue-500 bg-blue-500/10 text-white"
												: "border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700"
										}`}
									>
										{st.label}
									</button>
								))}
							</div>
						</div>

						{/* Cursor Smoothing Slider */}
						<div>
							<div className="flex justify-between text-[11px] text-slate-400 mb-1">
								<span>Spring Smoothing</span>
								<span className="font-mono text-white">
									{Math.round((meta.cursorSmoothing ?? 0.67) * 100)}%
								</span>
							</div>
							<input
								type="range"
								min="0.1"
								max="1.0"
								step="0.05"
								value={meta.cursorSmoothing ?? 0.67}
								onChange={(e) =>
									onUpdateMeta((prev) => ({
										...prev,
										cursorSmoothing: Number(e.target.value),
									}))
								}
								className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
							/>
						</div>

						{/* Cursor Scale Slider */}
						<div>
							<div className="flex justify-between text-[11px] text-slate-400 mb-1">
								<span>Ukuran Kursor</span>
								<span className="font-mono text-white">{(meta.cursorSize ?? 2.5).toFixed(1)}x</span>
							</div>
							<input
								type="range"
								min="1.0"
								max="4.0"
								step="0.2"
								value={meta.cursorSize ?? 2.5}
								onChange={(e) =>
									onUpdateMeta((prev) => ({
										...prev,
										cursorSize: Number(e.target.value),
									}))
								}
								className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
							/>
						</div>

						{/* Click Bounce Slider */}
						<div>
							<div className="flex justify-between text-[11px] text-slate-400 mb-1">
								<span>Click Bounce Effect</span>
								<span className="font-mono text-white">
									{(meta.cursorClickBounce ?? 2.5).toFixed(1)}
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="5.0"
								step="0.5"
								value={meta.cursorClickBounce ?? 2.5}
								onChange={(e) =>
									onUpdateMeta((prev) => ({
										...prev,
										cursorClickBounce: Number(e.target.value),
									}))
								}
								className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
							/>
						</div>
					</div>
				)}

				{/* TAB 3: 3D CAMERA & MOTION BLUR */}
				{activeTab === "camera" && (
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
									{(meta.cameraPerspectiveTilt ?? 0).toFixed(1)}°
								</span>
							</div>
							<input
								type="range"
								min="-6"
								max="6"
								step="0.5"
								value={meta.cameraPerspectiveTilt ?? 0}
								onChange={(e) =>
									onUpdateMeta((prev) => ({
										...prev,
										cameraPerspectiveTilt: Number(e.target.value),
									}))
								}
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
									{Math.round((meta.zoomMotionBlur ?? 0.35) * 100)}%
								</span>
							</div>
							<input
								type="range"
								min="0"
								max="1"
								step="0.05"
								value={meta.zoomMotionBlur ?? 0.35}
								onChange={(e) =>
									onUpdateMeta((prev) => ({
										...prev,
										zoomMotionBlur: Number(e.target.value),
									}))
								}
								className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
							/>
							<p className="mt-1 text-[10px] text-slate-500">
								Simulasi shutter blur saat pergerakan kamera cepat antar titik zoom.
							</p>
						</div>
					</div>
				)}

				{/* TAB 4: CANVAS & FRAMES */}
				{activeTab === "canvas" && (
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
										onClick={() =>
											onUpdateMeta((prev) => ({
												...prev,
												frame: fp.id,
											}))
										}
										className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
											meta.frame === fp.id
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
									const isSelected = meta.wallpaper === wp.value;
									return (
										<button
											key={wp.label}
											type="button"
											onClick={() =>
												onUpdateMeta((prev) => ({
													...prev,
													wallpaper: wp.value,
												}))
											}
											className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all cursor-pointer ${
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
									<span>Squircle Radius</span>
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

				{/* TAB 5: WEBCAM OVERLAY (Screen Studio style) */}
				{activeTab === "webcam" && (
					<div className="flex flex-col gap-4">
						<input
							type="file"
							ref={webcamFileInputRef}
							accept="video/*"
							className="hidden"
							onChange={handleWebcamFileInputChange}
						/>

						{/* Master PiP Toggle */}
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
											enabled: !prev.webcam?.enabled,
										},
									}))
								}
								className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
									meta.webcam?.enabled
										? "bg-emerald-600 text-white"
										: "bg-slate-800 text-slate-400 border border-slate-700"
								}`}
							>
								{meta.webcam?.enabled ? "ON" : "OFF"}
							</button>
						</div>

						{meta.webcam?.enabled && (
							<div className="space-y-4">
								{/* Tahap 3: Base Corner Position Selection */}
								<div>
									<div className="text-[11px] text-slate-400 mb-1.5 font-medium">
										Posisi Dasar PiP
									</div>
									<div className="grid grid-cols-2 gap-1.5">
										{[
											{ id: "top-left", label: "Top Left" },
											{ id: "top-right", label: "Top Right" },
											{ id: "bottom-left", label: "Bottom Left" },
											{ id: "bottom-right", label: "Bottom Right" },
										].map((corner) => {
											const currentCorner =
												meta.webcam?.positionPreset ?? meta.webcam?.corner ?? "bottom-right";
											const isSelected = currentCorner === corner.id;
											return (
												<button
													key={corner.id}
													type="button"
													onClick={() =>
														onUpdateMeta((prev) => ({
															...prev,
															webcam: {
																...prev.webcam,
																corner: corner.id as WebcamCorner,
																positionPreset: corner.id as WebcamPositionPreset,
															},
														}))
													}
													className={`py-1.5 px-2 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
														isSelected
															? "border-emerald-500 bg-emerald-500/15 text-white shadow-sm"
															: "border-slate-800 bg-slate-800/40 text-slate-400 hover:text-white hover:border-slate-700"
													}`}
												>
													{corner.label}
												</button>
											);
										})}
									</div>
								</div>

								{/* Tahap 3: Webcam Auto-Dodge Zoom Collision Guard */}
								<div className="p-3 rounded-xl border border-slate-800 bg-slate-800/40 flex flex-col gap-2">
									<div className="flex items-center justify-between">
										<div>
											<div className="text-xs font-semibold text-white flex items-center gap-1.5">
												<span>Auto-Dodge Zoom</span>
											</div>
											<div className="text-[10px] text-slate-400">
												Pindah sudut otomatis saat zoom
											</div>
										</div>
										<button
											type="button"
											onClick={() =>
												onUpdateMeta((prev) => ({
													...prev,
													webcam: {
														...prev.webcam,
														reactToZoom: !prev.webcam?.reactToZoom,
													},
												}))
											}
											className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
												meta.webcam?.reactToZoom !== false
													? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
													: "bg-slate-800 text-slate-500 border border-slate-700"
											}`}
										>
											{meta.webcam?.reactToZoom !== false ? "ON" : "OFF"}
										</button>
									</div>

									{/* Real-time Dodge Status Indicator */}
									{isWebcamDodging ? (
										<div className="flex items-center gap-1.5 text-[10px] text-amber-300 bg-amber-500/15 px-2.5 py-1.5 rounded-lg border border-amber-500/30 font-medium">
											<span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
											<span>
												Menghindar dari fokus zoom: dipindah ke{" "}
												<strong className="text-amber-200 uppercase">{dodgedToPreset}</strong>
											</span>
										</div>
									) : meta.webcam?.reactToZoom !== false ? (
										<div className="text-[10px] text-slate-500 leading-tight">
											Webcam otomatis meluncur ke sudut lain jika playhead memasuki zoom di sudut yang sama.
										</div>
									) : null}
								</div>

								{/* PiP Shape / Corner Radius */}
								<div>
									<div className="text-[11px] text-slate-400 mb-1.5 font-medium">Bentuk PiP</div>
									<div className="grid grid-cols-3 gap-1.5">
										{[
											{ label: "Squircle", radius: 24 },
											{ label: "Circle", radius: 50 },
											{ label: "Rounded", radius: 12 },
										].map((shape) => {
											const currentRad = meta.webcam?.cornerRadius ?? 50;
											const isSelected = Math.abs(currentRad - shape.radius) < 6;
											return (
												<button
													key={shape.label}
													type="button"
													onClick={() =>
														onUpdateMeta((prev) => ({
															...prev,
															webcam: {
																...prev.webcam,
																cornerRadius: shape.radius,
															},
														}))
													}
													className={`py-1 rounded-lg border text-xs font-semibold text-center transition-all cursor-pointer ${
														isSelected
															? "border-emerald-500 bg-emerald-500/15 text-white"
															: "border-slate-800 bg-slate-800/40 text-slate-400 hover:text-white"
													}`}
												>
													{shape.label}
												</button>
											);
										})}
									</div>
								</div>

								{/* PiP Size Slider */}
								<div>
									<div className="flex justify-between text-[11px] text-slate-400 mb-1">
										<span>Ukuran PiP</span>
										<span className="font-mono text-white">
											{Math.round((meta.webcam?.size ?? 25))}%
										</span>
									</div>
									<input
										type="range"
										min="15"
										max="45"
										step="2"
										value={meta.webcam?.size ?? 25}
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

								{/* Mirror PiP Toggle */}
								<div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-800/40">
									<div className="text-xs font-medium text-white">Mirror Kamera PiP</div>
									<button
										type="button"
										onClick={() =>
											onUpdateMeta((prev) => ({
												...prev,
												webcam: {
													...prev.webcam,
													mirror: !prev.webcam?.mirror,
												},
											}))
										}
										className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
											meta.webcam?.mirror !== false
												? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
												: "bg-slate-800 text-slate-500"
										}`}
									>
										{meta.webcam?.mirror !== false ? "ON" : "OFF"}
									</button>
								</div>

								{/* Webcam Video Source Picker */}
								<div className="pt-1">
									<div className="text-[11px] text-slate-400 mb-1.5 font-medium">
										File Rekaman Kamera
									</div>
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={handleWebcamPicker}
											className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-xs font-semibold text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
										>
											<UploadSimple size={13} />
											<span>
												{meta.webcam?.sourcePath ? "Ganti File PiP" : "Pilih File Webcam"}
											</span>
										</button>
										{meta.webcam?.sourcePath && (
											<button
												type="button"
												onClick={() =>
													onUpdateMeta((prev) => ({
														...prev,
														webcam: {
															...prev.webcam,
															sourcePath: null,
														},
														webcamPath: null,
													}))
												}
												className="p-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
												title="Hapus file webcam terpisah"
											>
												<Trash size={13} />
											</button>
										)}
									</div>
									{meta.webcam?.sourcePath && (
										<div className="mt-1 text-[10px] text-slate-500 font-mono truncate">
											{meta.webcam.sourcePath.split(/[/\\]/).pop()}
										</div>
									)}
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
};
