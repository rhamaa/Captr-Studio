import {
	CircleNotch,
	ClosedCaptioning,
	FilmStrip,
	Image as ImageIcon,
	Microphone,
	MusicNote,
	Plus,
	TextT,
	Trash,
	VideoCamera,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { AssetTranscript } from "@/core/timeline/transcriptTypes";
import type { MediaAsset } from "@/core/timeline/types";
import { localMediaUrl } from "@/recording/mediaProbe";
import { AssetTranscriptDialog } from "./AssetTranscriptDialog";
import { ASSET_DRAG_TYPE, beginTimelineDrag, endTimelineDrag } from "./timelineInteractions";

export interface AssetCardProps {
	asset: MediaAsset;
	sourcePath?: string;
	audioPath?: string;
	selected: boolean;
	onPreview: () => void;
	onPlace: () => void;
	onRemove: () => void;
	onTranscribe?: (asset: MediaAsset) => void;
}
export function AssetCard({
	asset,
	sourcePath,
	audioPath,
	selected,
	onPreview,
	onPlace,
	onRemove,
	onTranscribe,
}: AssetCardProps) {
	const [url, setUrl] = useState("");
	const [transcript, setTranscript] = useState<AssetTranscript | null>(null);
	const [isTranscribing, setIsTranscribing] = useState(false);
	const [transcribeError, setTranscribeError] = useState<string | null>(null);
	const [dialogOpen, setDialogOpen] = useState(false);

	const canHaveCaptions =
		asset.kind === "recording" || asset.kind === "video" || asset.kind === "audio";

	useEffect(() => {
		let current = true;
		setUrl("");
		if (sourcePath)
			void localMediaUrl(sourcePath)
				.then((u) => {
					if (current) setUrl(u);
				})
				.catch(() => undefined);
		return () => {
			current = false;
		};
	}, [sourcePath]);

	useEffect(() => {
		let current = true;
		if (sourcePath && canHaveCaptions) {
			window.electronAPI?.loadAssetTranscript?.(sourcePath)
				.then((t) => {
					if (current) setTranscript(t ?? null);
				})
				.catch(() => {
					if (current) setTranscript(null);
				});
		} else {
			setTranscript(null);
		}
		return () => {
			current = false;
		};
	}, [sourcePath, canHaveCaptions]);

	const handleTranscribe = async (options: {
		engine?: "local" | "groq" | "openai";
		language?: string;
		cloudApiKey?: string;
	}) => {
		const mediaPathForAudio = audioPath || sourcePath;
		if (!mediaPathForAudio || !window.electronAPI?.transcribeAsset) return;
		setIsTranscribing(true);
		setTranscribeError(null);
		try {
			const res = await window.electronAPI.transcribeAsset({
				assetId: asset.id,
				assetMediaFilePath: mediaPathForAudio,
				options,
			});
			if (res.success && res.transcript) {
				setTranscript(res.transcript);
				setTranscribeError(null);
				onTranscribe?.(asset);
			} else {
				setTranscribeError(res.error ?? "Failed to transcribe audio");
			}
		} catch (err) {
			setTranscribeError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsTranscribing(false);
		}
	};

	const Icon =
		asset.kind === "recording"
			? VideoCamera
			: asset.kind === "audio"
				? MusicNote
				: asset.kind === "image"
					? ImageIcon
					: asset.kind === "text"
						? TextT
						: FilmStrip;
	return (
		<>
			<article
				className={`project-asset-card ${selected ? "selected" : ""}`}
				draggable
				onDragStart={(event) => {
					beginTimelineDrag({
						type: "asset",
						id: asset.id,
						durationUs: asset.durationUs,
						mediaKind: asset.kind === "audio" ? "audio" : "visual",
						pointerOffsetPx: 0,
					});
					event.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id);
					event.dataTransfer.effectAllowed = "copy";
				}}
				onDragEnd={() => endTimelineDrag(asset.id)}
			>
				<button
					className="project-asset-preview"
					aria-label={`Preview ${asset.name}`}
					onClick={onPreview}
				>
					{asset.kind === "text" ? (
						<span
							className="project-asset-text-thumbnail"
							style={{
								color: asset.text?.color,
								fontFamily: asset.text?.fontFamily,
								fontSize: Math.min(20, asset.text?.fontSizePx ?? 20),
								fontWeight: asset.text?.fontWeight,
							}}
						>
							{asset.text?.content || "Text"}
						</span>
					) : url && asset.kind === "image" ? (
						<img src={url} alt={asset.name} />
					) : url && asset.kind !== "audio" ? (
						<video src={url} muted preload="metadata" />
					) : (
						<Icon size={32} weight="duotone" />
					)}
					<span className="project-asset-duration">
						{(asset.durationUs / 1_000_000).toFixed(1)}s
					</span>
					{asset.kind === "recording" && (
						<span className="project-package-badge">
							<VideoCamera size={12} />
							Recording
						</span>
					)}
					{transcript && (
						<span
							className="project-asset-cc-badge"
							title={`Captions ready (${transcript.language?.toUpperCase() || "CC"}). Click to preview.`}
							onClick={(e) => {
								e.stopPropagation();
								setDialogOpen(true);
							}}
						>
							<ClosedCaptioning size={11} weight="fill" />
							CC
						</span>
					)}
				</button>
				<div className="project-asset-info">
					<span title={asset.name}>{asset.name}</span>
					<div className="project-asset-actions">
						{canHaveCaptions && (
							<button
								className={`project-asset-cc-btn ${transcript ? "has-cc" : ""} ${isTranscribing ? "loading" : ""}`}
								aria-label={
									isTranscribing
										? "Generating captions…"
										: transcript
											? `View captions for ${asset.name}`
											: `Generate captions for ${asset.name}`
								}
								title={
									isTranscribing
										? "Generating captions…"
										: transcript
											? "View captions (CC)"
											: "Generate captions (CC)"
										}
								disabled={isTranscribing}
								onClick={(e) => {
									e.stopPropagation();
									setDialogOpen(true);
								}}
							>
								{isTranscribing ? (
									<CircleNotch size={15} className="project-asset-spin" />
								) : (
									<ClosedCaptioning size={15} weight={transcript ? "fill" : "regular"} />
								)}
							</button>
						)}
						<button
							aria-label={`Add ${asset.name} to timeline`}
							title="Add to timeline"
							onClick={onPlace}
						>
							<Plus size={15} />
						</button>
						<button
							aria-label={`Remove ${asset.name}`}
							title="Remove asset"
							onClick={onRemove}
						>
							<Trash size={15} />
						</button>
					</div>
				</div>
				<span className="project-asset-meta">
					<Icon size={12} />
					{asset.kind === "recording" ? (
						<>
							<Microphone size={12} />
							Editable package
						</>
					) : asset.kind === "audio" ? (
						"Audio"
					) : asset.kind === "text" ? (
						"Text overlay"
					) : (
						`${asset.width} × ${asset.height}`
					)}
				</span>
			</article>

			{canHaveCaptions && (
				<AssetTranscriptDialog
					asset={asset}
					sourcePath={sourcePath}
					transcript={transcript}
					isTranscribing={isTranscribing}
					error={transcribeError}
					open={dialogOpen}
					onOpenChange={setDialogOpen}
					onTranscribe={handleTranscribe}
				/>
			)}
		</>
	);
}
