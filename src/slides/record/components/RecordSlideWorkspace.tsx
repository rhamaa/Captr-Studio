import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	applySilenceRemovalToTimeline,
	detectSilenceFromAudioUrl,
	type SilenceRegion,
} from "@/components/video-editor/audio/silenceDetector";
import {
	buildInteractionZoomSuggestions,
	normalizeCursorTelemetry,
} from "@/components/video-editor/timeline/zoomSuggestionUtils";
import type {
	CursorStyle,
	CursorTelemetryPoint,
	WebcamCorner,
	WebcamPositionPreset,
	ZoomDepth,
	ZoomFocus,
	ZoomRegion,
} from "@/components/video-editor/types";
import type { VideoPlaybackRef } from "@/components/video-editor/VideoPlayback";
import type { SlideWorkspaceProps } from "@/core/slides/types";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import type { RecordSlideMeta } from "../schema";
import { RecordInspectorPanel, type RecordInspectorTab } from "./RecordInspectorPanel";
import { RecordPreviewMonitor } from "./RecordPreviewMonitor";
import { RecordSilenceModal } from "./RecordSilenceModal";
import { RecordTimelineBar } from "./RecordTimelineBar";

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

	const [resolvedVideoSrc, setResolvedVideoSrc] = useState<string>("");
	const [currentTimeMs, setCurrentTimeMs] = useState<number>(0);
	const [durationMs, setDurationMs] = useState<number>(slide.durationMs || 5000);
	const [isPlaying, setIsPlaying] = useState<boolean>(false);
	const [selectedZoomId, setSelectedZoomId] = useState<string | null>(null);
	const [rawTelemetry, setRawTelemetry] = useState<CursorTelemetryPoint[]>([]);
	const [activeTab, setActiveTab] = useState<RecordInspectorTab>("zoom");

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
			alert(
				"Gagal menganalisis audio: " + (err instanceof Error ? err.message : String(err)),
			);
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
			<input
				type="file"
				ref={webcamFileInputRef}
				accept="video/*"
				className="hidden"
				onChange={handleWebcamFileInputChange}
			/>

			{/* Center Area: Preview Canvas & Playback Transport */}
			<div className="flex flex-1 flex-col items-center justify-between p-6 relative overflow-hidden">
				<RecordPreviewMonitor
					videoPath={meta.videoPath}
					resolvedVideoSrc={resolvedVideoSrc}
					canvasDimensions={canvasDimensions}
					videoPlaybackRef={videoPlaybackRef}
					currentTimeMs={currentTimeMs}
					isPlaying={isPlaying}
					onTimeUpdate={(ms) => setCurrentTimeMs(ms)}
					onDurationChange={(dur) => {
						if (!meta.clipRegions || meta.clipRegions.length === 0) {
							setDurationMs(dur);
							if (Math.abs(dur - slide.durationMs) > 200) {
								onUpdateDuration?.(dur);
							}
						}
					}}
					onPlayStateChange={setIsPlaying}
					meta={meta}
					normalizedTelemetry={normalizedTelemetry}
					effectiveWebcam={effectiveWebcam}
					currentAspectRatio={currentAspectRatio}
					selectedZoomId={selectedZoomId}
					onSelectZoom={setSelectedZoomId}
					onZoomFocusChange={handleZoomFocusChange}
					onImportVideoPicker={handleImportVideoPicker}
					onClearVideo={handleClearVideo}
					onOpenRecorderHud={handleOpenRecorderHud}
				/>

				{/* Bottom Transport Scrubber & Playback Controls */}
				{meta.videoPath && (
					<RecordTimelineBar
						meta={meta}
						durationMs={durationMs}
						currentTimeMs={currentTimeMs}
						isPlaying={isPlaying}
						selectedZoomId={selectedZoomId}
						isAnalyzingSilence={isAnalyzingSilence}
						silenceSuccessMessage={silenceSuccessMessage}
						onSeek={handleSeek}
						onTogglePlayPause={togglePlayPause}
						onRewind={handleRewind}
						onAnalyzeSilence={handleAnalyzeSilence}
						onResetSilenceCuts={handleResetSilenceCuts}
						onAutoSuggestZooms={handleAutoSuggestZooms}
						onAddZoomAtPlayhead={handleAddZoomAtPlayhead}
					/>
				)}

				{/* Silence Removal Modal Dialog */}
				<RecordSilenceModal
					isOpen={silenceModalOpen}
					detectedSilences={detectedSilences}
					selectedSilenceIds={selectedSilenceIds}
					silenceThresholdDb={silenceThresholdDb}
					silenceMinDurationMs={silenceMinDurationMs}
					isAnalyzingSilence={isAnalyzingSilence}
					onClose={() => setSilenceModalOpen(false)}
					onThresholdChange={setSilenceThresholdDb}
					onMinDurationChange={setSilenceMinDurationMs}
					onToggleSilenceSelection={(id) => {
						const next = new Set(selectedSilenceIds);
						if (next.has(id)) next.delete(id);
						else next.add(id);
						setSelectedSilenceIds(next);
					}}
					onReanalyze={handleAnalyzeSilence}
					onApplyRemoval={handleApplySilenceRemoval}
				/>
			</div>

			{/* Right Sidebar: Screen Studio Inspector */}
			<RecordInspectorPanel
				title={slide.title}
				onUpdateTitle={onUpdateTitle}
				activeTab={activeTab}
				onSelectTab={setActiveTab}
				zoomRegions={meta.zoomRegions}
				selectedZoomId={selectedZoomId}
				connectZooms={meta.connectZooms !== false}
				hasVideo={Boolean(meta.videoPath)}
				onAutoSuggestZooms={handleAutoSuggestZooms}
				onToggleConnectZooms={() =>
					onUpdateMeta((prev) => ({
						...prev,
						connectZooms: !prev.connectZooms,
					}))
				}
				onSelectZoom={setSelectedZoomId}
				onSeekToZoom={(startMs, id) => {
					handleSeek(startMs);
					setSelectedZoomId(id);
				}}
				onDeleteZoom={handleDeleteZoom}
				onUpdateZoomDepth={handleUpdateZoomDepth}
				showCursor={meta.showCursor}
				cursorStyle={meta.cursorStyle ?? "macos"}
				cursorSmoothing={meta.cursorSmoothing ?? 0.67}
				cursorSize={meta.cursorSize ?? 2.5}
				cursorClickBounce={meta.cursorClickBounce ?? 2.5}
				onToggleShowCursor={() =>
					onUpdateMeta((prev) => ({
						...prev,
						showCursor: !prev.showCursor,
					}))
				}
				onUpdateCursorStyle={(style: CursorStyle) =>
					onUpdateMeta((prev) => ({
						...prev,
						cursorStyle: style,
					}))
				}
				onUpdateCursorSmoothing={(val) =>
					onUpdateMeta((prev) => ({
						...prev,
						cursorSmoothing: val,
					}))
				}
				onUpdateCursorSize={(val) =>
					onUpdateMeta((prev) => ({
						...prev,
						cursorSize: val,
					}))
				}
				onUpdateCursorClickBounce={(val) =>
					onUpdateMeta((prev) => ({
						...prev,
						cursorClickBounce: val,
					}))
				}
				cameraPerspectiveTilt={meta.cameraPerspectiveTilt ?? 0}
				zoomMotionBlur={meta.zoomMotionBlur ?? 0.35}
				onUpdateCameraPerspectiveTilt={(val) =>
					onUpdateMeta((prev) => ({
						...prev,
						cameraPerspectiveTilt: val,
					}))
				}
				onUpdateZoomMotionBlur={(val) =>
					onUpdateMeta((prev) => ({
						...prev,
						zoomMotionBlur: val,
					}))
				}
				frame={meta.frame}
				wallpaper={meta.wallpaper}
				borderRadius={meta.borderRadius}
				shadowIntensity={meta.shadowIntensity}
				onUpdateFrame={(frame) =>
					onUpdateMeta((prev) => ({
						...prev,
						frame,
					}))
				}
				onUpdateWallpaper={(wallpaper) =>
					onUpdateMeta((prev) => ({
						...prev,
						wallpaper,
					}))
				}
				onUpdateBorderRadius={(radius) =>
					onUpdateMeta((prev) => ({
						...prev,
						borderRadius: radius,
					}))
				}
				onUpdateShadowIntensity={(intensity) =>
					onUpdateMeta((prev) => ({
						...prev,
						shadowIntensity: intensity,
					}))
				}
				webcam={meta.webcam}
				isWebcamDodging={isWebcamDodging}
				dodgedToPreset={dodgedToPreset}
				onToggleWebcam={() =>
					onUpdateMeta((prev) => ({
						...prev,
						webcam: {
							...prev.webcam,
							enabled: !prev.webcam?.enabled,
						},
					}))
				}
				onSelectCorner={(corner: WebcamCorner) =>
					onUpdateMeta((prev) => ({
						...prev,
						webcam: {
							...prev.webcam,
							corner,
							positionPreset: corner as WebcamPositionPreset,
						},
					}))
				}
				onToggleAutoDodge={() =>
					onUpdateMeta((prev) => ({
						...prev,
						webcam: {
							...prev.webcam,
							reactToZoom: !prev.webcam?.reactToZoom,
						},
					}))
				}
				onSelectShapeRadius={(radius) =>
					onUpdateMeta((prev) => ({
						...prev,
						webcam: {
							...prev.webcam,
							cornerRadius: radius,
						},
					}))
				}
				onUpdateSize={(size) =>
					onUpdateMeta((prev) => ({
						...prev,
						webcam: {
							...prev.webcam,
							size,
						},
					}))
				}
				onToggleMirror={() =>
					onUpdateMeta((prev) => ({
						...prev,
						webcam: {
							...prev.webcam,
							mirror: !prev.webcam?.mirror,
						},
					}))
				}
				onPickWebcamSource={handleWebcamPicker}
				onClearWebcamSource={() =>
					onUpdateMeta((prev) => ({
						...prev,
						webcam: {
							...prev.webcam,
							sourcePath: null,
						},
						webcamPath: null,
					}))
				}
			/>
		</div>
	);
};
