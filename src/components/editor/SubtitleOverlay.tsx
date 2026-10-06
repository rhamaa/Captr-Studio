import {
	ClosedCaptioning,
	Sliders,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import {
	type AssetTranscript,
	type TranscriptSegment,
	type TranscriptWord,
	getActiveSubtitleAtTime,
	mapTranscriptToClip,
} from "@/core/timeline/transcriptTypes";
import type { TimelineProject } from "@/core/timeline/types";

export interface SubtitleStyle {
	enabled: boolean;
	position: "bottom" | "top" | "center";
	fontSizePx: number;
	textColor: string;
	highlightColor: string;
	backgroundColor: string;
	highlightActiveWord: boolean;
}

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
	enabled: true,
	position: "bottom",
	fontSizePx: 20,
	textColor: "#ffffff",
	highlightColor: "#8DDB9B", // Sage mint highlight
	backgroundColor: "rgba(0, 0, 0, 0.72)",
	highlightActiveWord: true,
};

export interface ActiveSubtitleWordState {
	word: string;
	startTimelineUs: number;
	endTimelineUs: number;
	active: boolean;
	passed: boolean;
}

export interface ActiveSubtitleResult {
	segment: TranscriptSegment;
	activeWord: TranscriptWord | null;
	words: ActiveSubtitleWordState[];
}

/**
 * Computes active subtitle text and karaoke word states for a given project and timeline position.
 */
export function getSubtitleForProjectAtTime(
	project: TimelineProject,
	timeUs: number,
	transcripts: Record<string, AssetTranscript>,
): ActiveSubtitleResult | null {
	// Look through all enabled tracks for active clips with transcripts
	for (const track of project.tracks) {
		if (track.muted || track.hidden) continue;
		for (const clip of track.clips) {
			if (!clip.enabled) continue;
			const rate = clip.rate > 0 ? clip.rate : 1;
			const clipDurUs = Math.round((clip.sourceOutUs - clip.sourceInUs) / rate);

			// Check if clip is active at timeUs
			if (timeUs >= clip.startUs && timeUs <= clip.startUs + clipDurUs) {
				const transcript = transcripts[clip.assetId];
				if (!transcript || !transcript.segments?.length) continue;

				// Map transcript segments according to clip boundaries and rate
				const mappedSegments = mapTranscriptToClip(transcript, clip);
				const { segment, activeWord } = getActiveSubtitleAtTime(mappedSegments, timeUs);

				if (segment) {
					const words: ActiveSubtitleWordState[] = segment.words.map((w) => ({
						word: w.word,
						startTimelineUs: w.startUs,
						endTimelineUs: w.endUs,
						active: activeWord ? w.startUs === activeWord.startUs : false,
						passed: timeUs > w.endUs,
					}));

					return {
						segment,
						activeWord,
						words,
					};
				}
			}
		}
	}
	return null;
}

export interface SubtitleOverlayProps {
	project: TimelineProject;
	timeUs: number;
	styleOverrides?: Partial<SubtitleStyle>;
	initialTranscripts?: Record<string, AssetTranscript>;
}

export function SubtitleOverlay({
	project,
	timeUs,
	styleOverrides,
	initialTranscripts,
}: SubtitleOverlayProps) {
	const [transcripts, setTranscripts] = useState<Record<string, AssetTranscript>>(
		initialTranscripts ?? {},
	);
	const [style, setStyle] = useState<SubtitleStyle>(() => {
		try {
			if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
				const saved = localStorage.getItem("captr_subtitle_style");
				if (saved) return { ...DEFAULT_SUBTITLE_STYLE, ...JSON.parse(saved) };
			}
		} catch {}
		return DEFAULT_SUBTITLE_STYLE;
	});
	const [showMenu, setShowMenu] = useState(false);

	const activeStyle = useMemo(
		() => ({ ...style, ...styleOverrides }),
		[style, styleOverrides],
	);

	// Load transcripts for all audio/video/recording assets in project
	useEffect(() => {
		let isCurrent = true;
		const loadTranscript = window.electronAPI?.loadAssetTranscript;
		if (!loadTranscript) return;

		const loadAll = async () => {
			const results: Record<string, AssetTranscript> = {};
			for (const asset of project.assets) {
				if (
					asset.kind === "video" ||
					asset.kind === "recording" ||
					asset.kind === "audio"
				) {
					const pkg = project.packages.find((p) => p.id === asset.packageId);
					const candidatePath = asset.source?.path ?? pkg?.screen.path;
					if (candidatePath) {
						try {
							const t = await loadTranscript(candidatePath);
							if (t && isCurrent) {
								results[asset.id] = t;
							}
						} catch {}
					}
				}
			}
			if (isCurrent) {
				setTranscripts(results);
			}
		};

		void loadAll();
		return () => {
			isCurrent = false;
		};
	}, [project]);

	const activeSubtitle = useMemo(() => {
		if (!activeStyle.enabled) return null;
		return getSubtitleForProjectAtTime(project, timeUs, transcripts);
	}, [project, timeUs, transcripts, activeStyle.enabled]);

	const updateStyle = (next: Partial<SubtitleStyle>) => {
		const updated = { ...style, ...next };
		setStyle(updated);
		try {
			if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
				localStorage.setItem("captr_subtitle_style", JSON.stringify(updated));
			}
		} catch {}
	};

	const hasAnyTranscripts = Object.keys(transcripts).length > 0;
	if (!hasAnyTranscripts && !activeSubtitle) return null;

	const positionClass =
		activeStyle.position === "top"
			? "subtitle-pos-top"
			: activeStyle.position === "center"
				? "subtitle-pos-center"
				: "subtitle-pos-bottom";

	return (
		<div className={`subtitle-overlay-root ${positionClass}`}>
			{/* Quick settings pill toggle on hover */}
			<div className="subtitle-overlay-hover-bar">
				<button
					type="button"
					className={`subtitle-toggle-pill ${activeStyle.enabled ? "active" : ""}`}
					title={activeStyle.enabled ? "Disable subtitles (CC)" : "Enable subtitles (CC)"}
					onClick={(e) => {
						e.stopPropagation();
						updateStyle({ enabled: !activeStyle.enabled });
					}}
				>
					<ClosedCaptioning size={13} weight={activeStyle.enabled ? "fill" : "regular"} />
					<span>{activeStyle.enabled ? "CC On" : "CC Off"}</span>
				</button>

				{activeStyle.enabled && (
					<button
						type="button"
						className="subtitle-settings-pill"
						title="Subtitle styling options"
						onClick={(e) => {
							e.stopPropagation();
							setShowMenu((v) => !v);
						}}
					>
						<Sliders size={13} />
					</button>
				)}
			</div>

			{/* Customization Dropdown Panel */}
			{showMenu && activeStyle.enabled && (
				<div
					className="subtitle-settings-dropdown"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="subtitle-settings-row">
						<span>Position</span>
						<div className="subtitle-btn-group">
							<button
								type="button"
								className={activeStyle.position === "top" ? "selected" : ""}
								onClick={() => updateStyle({ position: "top" })}
							>
								Top
							</button>
							<button
								type="button"
								className={activeStyle.position === "center" ? "selected" : ""}
								onClick={() => updateStyle({ position: "center" })}
							>
								Center
							</button>
							<button
								type="button"
								className={activeStyle.position === "bottom" ? "selected" : ""}
								onClick={() => updateStyle({ position: "bottom" })}
							>
								Bottom
							</button>
						</div>
					</div>

					<div className="subtitle-settings-row">
						<span>Active Word Highlight</span>
						<button
							type="button"
							className={`subtitle-toggle-switch ${activeStyle.highlightActiveWord ? "on" : "off"}`}
							onClick={() =>
								updateStyle({ highlightActiveWord: !activeStyle.highlightActiveWord })
							}
						>
							{activeStyle.highlightActiveWord ? "Karaoke ON" : "Karaoke OFF"}
						</button>
					</div>

					<div className="subtitle-settings-row">
						<span>Font Size</span>
						<div className="subtitle-btn-group">
							<button
								type="button"
								className={activeStyle.fontSizePx === 16 ? "selected" : ""}
								onClick={() => updateStyle({ fontSizePx: 16 })}
							>
								S
							</button>
							<button
								type="button"
								className={activeStyle.fontSizePx === 20 ? "selected" : ""}
								onClick={() => updateStyle({ fontSizePx: 20 })}
							>
								M
							</button>
							<button
								type="button"
								className={activeStyle.fontSizePx === 26 ? "selected" : ""}
								onClick={() => updateStyle({ fontSizePx: 26 })}
							>
								L
							</button>
						</div>
					</div>

					<div className="subtitle-settings-row">
						<span>Highlight Color</span>
						<div className="subtitle-color-presets">
							{[
								{ label: "Sage Mint", color: "#8DDB9B" },
								{ label: "Honey Yellow", color: "#F6C768" },
								{ label: "Soft Blue", color: "#6FA8FF" },
								{ label: "Lavender", color: "#A879F5" },
								{ label: "White", color: "#ffffff" },
							].map((p) => (
								<button
									key={p.color}
									type="button"
									style={{ backgroundColor: p.color }}
									className={`color-dot ${activeStyle.highlightColor === p.color ? "selected" : ""}`}
									title={p.label}
									onClick={() => updateStyle({ highlightColor: p.color })}
								/>
							))}
						</div>
					</div>
				</div>
			)}

			{/* Subtitle Display Container */}
			{activeSubtitle && activeStyle.enabled && (
				<div
					className="subtitle-display-box"
					style={{
						backgroundColor: activeStyle.backgroundColor,
						fontSize: `${activeStyle.fontSizePx}px`,
						color: activeStyle.textColor,
					}}
				>
					{activeStyle.highlightActiveWord ? (
						<p className="subtitle-words-container">
							{activeSubtitle.words.map((w, idx) => {
								return (
									<span
										key={idx}
										className={`subtitle-word ${w.active ? "word-active" : ""} ${w.passed ? "word-passed" : ""}`}
										style={{
											color: w.active ? activeStyle.highlightColor : undefined,
										}}
									>
										{w.word}{" "}
									</span>
								);
							})}
						</p>
					) : (
						<p className="subtitle-text-plain">{activeSubtitle.segment.text}</p>
					)}
				</div>
			)}
		</div>
	);
}
