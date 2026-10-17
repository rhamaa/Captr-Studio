import {
	ClosedCaptioning,
	Microphone,
	MusicNote,
	SpeakerHigh,
	VideoCamera,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { AssetTranscript } from "@/core/timeline/transcriptTypes";
import { mapStreamTime } from "@/core/timeline/timeMapping";
import type { MediaAsset, RecordingPackage } from "@/core/timeline/types";
import { localMediaUrl } from "@/recording/mediaProbe";
/** Library source preview never creates or changes a timeline placement. */
export function AssetSourcePreview({
	asset,
	path,
	recordingPackage,
	timeUs,
	onError,
}: {
	asset: MediaAsset;
	path: string;
	recordingPackage?: RecordingPackage;
	timeUs?: number;
	onError?: (error: string) => void;
}) {
	const [url, setUrl] = useState(""),
		video = useRef<HTMLVideoElement>(null),
		webcamVideo = useRef<HTMLVideoElement>(null);
	const [componentUrls, setComponentUrls] = useState<Record<string, string>>({});
	const [transcript, setTranscript] = useState<AssetTranscript | null>(null);
	const syncWebcamToScreen = () => {
		const screen = video.current;
		const webcam = webcamVideo.current;
		const screenSource = recordingPackage?.screen;
		const webcamSource = recordingPackage?.webcam;
		if (!screen || !webcam || !screenSource || !webcamSource) return;

		const sourceUs = screen.currentTime * 1_000_000 + screenSource.offsetUs;
		const webcamUs = mapStreamTime(sourceUs, webcamSource.offsetUs, webcamSource.durationUs);
		if (webcamUs === null) {
			webcam.pause();
			return;
		}

		const webcamSeconds = webcamUs / 1_000_000;
		if (Math.abs(webcam.currentTime - webcamSeconds) > 0.08) {
			webcam.currentTime = webcamSeconds;
		}
		if (!screen.paused && webcam.paused) void webcam.play().catch(() => undefined);
	};
	useEffect(() => {
		let active = true;
		setUrl("");
		if (asset.kind === "text" || !path)
			return () => {
				active = false;
			};
		void localMediaUrl(path)
			.then((u) => {
				if (active) setUrl(u);
			})
			.catch((e) => {
				if (active) onError?.(String(e));
			});
		return () => {
			active = false;
		};
	}, [asset.kind, path]);
	useEffect(() => {
		let active = true;
		setComponentUrls({});
		const sources = [
			["webcam", recordingPackage?.webcam?.path],
			["microphone", recordingPackage?.microphone?.path],
			["system", recordingPackage?.system?.path],
		] as const;
		void Promise.all(
			sources.map(async ([key, sourcePath]) => {
				if (!sourcePath) return [key, ""] as const;
				try {
					return [key, await localMediaUrl(sourcePath)] as const;
				} catch (error) {
					onError?.(String(error));
					return [key, ""] as const;
				}
			}),
		).then((entries) => {
			if (active) setComponentUrls(Object.fromEntries(entries));
		});
		return () => {
			active = false;
		};
	}, [recordingPackage, onError]);
	useEffect(() => {
		let active = true;
		setTranscript(null);
		if (asset.kind === "recording" && path) {
			void window.electronAPI
				?.loadAssetTranscript?.(path)
				.then((value) => {
					if (active) setTranscript(value ?? null);
				})
				.catch(() => {
					if (active) setTranscript(null);
				});
		}
		return () => {
			active = false;
		};
	}, [asset.kind, path]);
	useEffect(() => {
		if (
			video.current &&
			timeUs !== undefined &&
			Math.abs(video.current.currentTime - timeUs / 1_000_000) > 0.03
		)
			video.current.currentTime = timeUs / 1_000_000;
	}, [timeUs, url]);
	return (
		<div className="project-source-preview" aria-label={`Source preview: ${asset.name}`}>
			{asset.kind === "recording" && recordingPackage ? (
				<div
					className="project-recording-source-preview"
					style={{
						display: "flex",
						flexDirection: "column",
						gap: 12,
						width: "100%",
						height: "100%",
						overflow: "auto",
						padding: 16,
						boxSizing: "border-box",
					}}
				>
					<div
						className="project-recording-preview-stage"
						style={{
							position: "relative",
							width: "100%",
							maxHeight: 420,
							aspectRatio: `${recordingPackage.width} / ${recordingPackage.height}`,
							background: "#08090c",
							overflow: "hidden",
							borderRadius: 8,
						}}
					>
						<video
							ref={video}
							src={url || undefined}
							controls
							playsInline
							style={{ width: "100%", height: "100%", objectFit: "contain" }}
							onPlay={() => {
								if (webcamVideo.current) {
									syncWebcamToScreen();
									void webcamVideo.current.play().catch(() => undefined);
								}
							}}
							onPause={() => webcamVideo.current?.pause()}
							onSeeked={syncWebcamToScreen}
							onTimeUpdate={syncWebcamToScreen}
							onError={() => onError?.("Could not decode screen recording preview")}
						/>
						{componentUrls.webcam && (
							<video
								ref={webcamVideo}
								src={componentUrls.webcam}
								muted
								playsInline
								style={{
									position: "absolute",
									right: 12,
									bottom: 48,
									width: "22%",
									maxHeight: "30%",
									objectFit: "cover",
									border: "2px solid rgba(255,255,255,.9)",
									borderRadius: 8,
									boxShadow: "0 4px 18px #0008",
								}}
								onLoadedMetadata={syncWebcamToScreen}
								onError={() => onError?.("Could not decode webcam recording preview")}
							/>
						)}
					</div>
					<div
						className="project-recording-preview-contents"
						style={{ display: "grid", gap: 8 }}
					>
						<strong>Recording contents</strong>
						<div
							style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}
						>
							<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
								<VideoCamera size={14} /> Screen video
							</span>
							{recordingPackage.webcam && (
								<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
									<VideoCamera size={14} /> Webcam video
								</span>
							)}
							{recordingPackage.microphone && (
								<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
									<Microphone size={14} /> Microphone audio
								</span>
							)}
							{recordingPackage.system && (
								<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
									<SpeakerHigh size={14} /> Internal audio
								</span>
							)}
							<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
								<ClosedCaptioning size={14} />
								{transcript
									? `Captions (${transcript.language.toUpperCase()})`
									: "No captions"}
							</span>
						</div>
						{recordingPackage.microphone && componentUrls.microphone && (
							<label style={{ display: "grid", gap: 4 }}>
								Microphone audio
								<audio src={componentUrls.microphone} controls />
							</label>
						)}
						{recordingPackage.system && componentUrls.system && (
							<label style={{ display: "grid", gap: 4 }}>
								Internal audio
								<audio src={componentUrls.system} controls />
							</label>
						)}
						{transcript && (
							<div
								className="project-recording-caption-preview"
								aria-label="Caption preview"
								style={{ maxHeight: 160, overflow: "auto" }}
							>
								{transcript.segments.slice(0, 5).map((segment) => (
									<p key={segment.id}>
										<small>{(segment.startUs / 1_000_000).toFixed(1)}s</small>{" "}
										{segment.text}
									</p>
								))}
							</div>
						)}
					</div>
				</div>
			) : asset.kind === "text" ? (
				<div
					className="project-text-source-preview"
					style={{
						color: asset.text?.color,
						fontFamily: asset.text?.fontFamily,
						fontSize: Math.min(96, asset.text?.fontSizePx ?? 48),
						fontWeight: asset.text?.fontWeight,
						textAlign: asset.text?.align,
						whiteSpace: "pre-wrap",
					}}
				>
					{asset.text?.content}
				</div>
			) : asset.kind === "image" ? (
				<img src={url || undefined} alt={asset.name} />
			) : asset.kind === "audio" ? (
				<div className="project-audio-preview">
					<MusicNote size={60} />
					<strong>{asset.name}</strong>
					{url && <audio src={url} controls />}
				</div>
			) : (
				url && (
					<video
						ref={video}
						src={url}
						controls={timeUs === undefined}
						onLoadedMetadata={() => {
							if (video.current && timeUs !== undefined)
								video.current.currentTime = timeUs / 1_000_000;
						}}
						onError={() => onError?.("Could not decode preview media")}
					/>
				)
			)}
		</div>
	);
}
