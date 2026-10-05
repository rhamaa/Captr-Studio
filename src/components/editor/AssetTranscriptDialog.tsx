import {
	CheckCircle,
	CircleNotch,
	ClosedCaptioning,
	MagnifyingGlass,
	Microphone,
	Sparkle,
	WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import type { AssetTranscript } from "@/core/timeline/transcriptTypes";
import type { MediaAsset } from "@/core/timeline/types";

export interface AssetTranscriptDialogProps {
	asset: MediaAsset;
	sourcePath?: string;
	transcript: AssetTranscript | null;
	isTranscribing: boolean;
	error: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onTranscribe: (options: {
		engine?: "local" | "groq" | "openai";
		language?: string;
		cloudApiKey?: string;
	}) => Promise<void>;
}

function formatShortTimestamp(us: number): string {
	const totalSec = Math.floor(us / 1_000_000);
	const minutes = Math.floor(totalSec / 60);
	const seconds = totalSec % 60;
	const millis = Math.floor((us % 1_000_000) / 10_000);
	return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
}

const LANGUAGE_OPTIONS = [
	{ value: "auto", label: "Auto-detect" },
	{ value: "id", label: "Indonesian (Bahasa Indonesia)" },
	{ value: "en", label: "English" },
	{ value: "ja", label: "Japanese" },
	{ value: "es", label: "Spanish" },
	{ value: "fr", label: "French" },
	{ value: "de", label: "German" },
];

export function AssetTranscriptDialog({
	asset,
	transcript,
	isTranscribing,
	error,
	open,
	onOpenChange,
	onTranscribe,
}: AssetTranscriptDialogProps) {
	const [search, setSearch] = useState("");
	const [showOptions, setShowOptions] = useState(false);
	const [language, setLanguage] = useState("auto");
	const [engine, setEngine] = useState<"local" | "groq" | "openai">("local");
	const [apiKey, setApiKey] = useState(() => {
		try {
			return typeof window !== "undefined" && typeof localStorage !== "undefined"
				? (localStorage.getItem("captr_cloud_stt_key") ?? "")
				: "";
		} catch {
			return "";
		}
	});

	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isTranscribing) {
				onOpenChange(false);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, isTranscribing, onOpenChange]);

	const filteredSegments = useMemo(() => {
		if (!transcript?.segments) return [];
		if (!search.trim()) return transcript.segments;
		const query = search.toLowerCase();
		return transcript.segments.filter((seg) => seg.text.toLowerCase().includes(query));
	}, [transcript, search]);

	const totalWords = useMemo(() => {
		if (!transcript?.segments) return 0;
		return transcript.segments.reduce((acc, s) => acc + (s.words?.length ?? 0), 0);
	}, [transcript]);

	const handleStartTranscribe = async () => {
		if (apiKey.trim()) {
			try {
				if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
					localStorage.setItem("captr_cloud_stt_key", apiKey.trim());
				}
			} catch {}
		}
		await onTranscribe({
			engine,
			language: language === "auto" ? undefined : language,
			cloudApiKey: engine !== "local" ? apiKey.trim() : undefined,
		});
		setShowOptions(false);
	};

	if (!open) return null;

	return (
		<div
			className="asset-transcript-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="asset-transcript-title"
			onClick={(e) => {
				if (e.target === e.currentTarget && !isTranscribing) {
					onOpenChange(false);
				}
			}}
		>
			<div className="asset-transcript-dialog">
				<header className="asset-transcript-header">
					<div className="asset-transcript-title-row">
						<div className="asset-transcript-icon">
							<ClosedCaptioning size={20} weight="fill" />
						</div>
						<div>
							<h2 id="asset-transcript-title" className="asset-transcript-title">
								<span>Captions</span>
								<span className="asset-transcript-dot">·</span>
								<span className="asset-transcript-name" title={asset.name}>
									{asset.name}
								</span>
							</h2>
							<p className="asset-transcript-subtitle">
								Speech-to-text transcript with word-level timestamps
							</p>
						</div>
					</div>
					<button
						type="button"
						className="asset-transcript-close"
						aria-label="Close dialog"
						onClick={() => onOpenChange(false)}
					>
						×
					</button>
				</header>

				{isTranscribing ? (
					<div className="asset-transcript-loading">
						<CircleNotch size={36} className="asset-transcript-spin text-emerald-400" />
						<div className="asset-transcript-loading-text">
							<p className="asset-transcript-loading-title">
								Transcribing speech with Whisper…
							</p>
							<p className="asset-transcript-loading-desc">
								Extracting 16kHz audio and detecting word-level timestamps. This may take
								a few seconds.
							</p>
						</div>
					</div>
				) : error ? (
					<div className="asset-transcript-error-box">
						<div className="asset-transcript-error-banner">
							<WarningCircle size={20} className="shrink-0" />
							<div>
								<p className="font-semibold">Transcription failed</p>
								<p className="asset-transcript-error-message">{error}</p>
							</div>
						</div>
						<div className="asset-transcript-actions">
							<button
								type="button"
								className="asset-transcript-btn-primary"
								onClick={() => void handleStartTranscribe()}
							>
								Retry
							</button>
						</div>
					</div>
				) : transcript && !showOptions ? (
					<div className="asset-transcript-content">
						{/* Meta Summary Bar */}
						<div className="asset-transcript-summary-bar">
							<div className="asset-transcript-summary-meta">
								<span className="asset-transcript-badge-lang">
									<CheckCircle size={13} weight="fill" />
									{transcript.language?.toUpperCase() || "AUTO"}
								</span>
								<span>{transcript.segments.length} segments</span>
								<span>·</span>
								<span>{totalWords} words</span>
								<span>·</span>
								<span>{(transcript.durationUs / 1_000_000).toFixed(1)}s</span>
							</div>
							<button
								type="button"
								className="asset-transcript-toggle-options"
								onClick={() => setShowOptions(true)}
							>
								Re-generate / Options
							</button>
						</div>

						{/* Search Bar */}
						<div className="asset-transcript-search-box">
							<MagnifyingGlass size={14} className="asset-transcript-search-icon" />
							<input
								type="text"
								placeholder="Search text in captions…"
								className="asset-transcript-search-input"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>

						{/* Segment Scroll Container */}
						<div className="asset-transcript-segment-list">
							{filteredSegments.length === 0 ? (
								<p className="asset-transcript-empty">
									{search ? "No matching words found" : "Transcript is empty"}
								</p>
							) : (
								filteredSegments.map((seg) => (
									<div key={seg.id} className="asset-transcript-segment-item">
										<div className="asset-transcript-segment-header">
											<span className="asset-transcript-timestamp">
												{formatShortTimestamp(seg.startUs)} →{" "}
												{formatShortTimestamp(seg.endUs)}
											</span>
											<span>{(seg.words?.length ?? 0)} words</span>
										</div>
										<p className="asset-transcript-segment-text">{seg.text}</p>
										{seg.words && seg.words.length > 0 && (
											<div className="asset-transcript-word-list">
												{seg.words.map((w, idx) => (
													<span
														key={idx}
														title={`${formatShortTimestamp(w.startUs)} - ${formatShortTimestamp(w.endUs)}`}
														className="asset-transcript-word-pill"
													>
														{w.word}
													</span>
												))}
											</div>
										)}
									</div>
								))
							)}
						</div>
					</div>
				) : (
					/* Options / Setup View */
					<div className="asset-transcript-options-view">
						<div className="asset-transcript-form">
							<div className="asset-transcript-field">
								<label className="asset-transcript-label">Spoken Language</label>
								<select
									className="asset-transcript-select"
									value={language}
									onChange={(e) => setLanguage(e.target.value)}
								>
									{LANGUAGE_OPTIONS.map((opt) => (
										<option key={opt.value} value={opt.value}>
											{opt.label}
										</option>
									))}
								</select>
							</div>

							<div className="asset-transcript-field">
								<label className="asset-transcript-label">Speech-to-Text Engine</label>
								<div className="asset-transcript-engine-grid">
									<button
										type="button"
										className={`asset-transcript-engine-btn ${engine === "local" ? "selected" : ""}`}
										onClick={() => setEngine("local")}
									>
										<span className="engine-title">
											<Microphone size={14} />
											Local Whisper
										</span>
										<span className="engine-desc">Bundled CLI (Offline)</span>
									</button>

									<button
										type="button"
										className={`asset-transcript-engine-btn ${engine === "groq" ? "selected" : ""}`}
										onClick={() => setEngine("groq")}
									>
										<span className="engine-title">
											<Sparkle size={14} />
											Groq Cloud
										</span>
										<span className="engine-desc">Ultra-fast API</span>
									</button>

									<button
										type="button"
										className={`asset-transcript-engine-btn ${engine === "openai" ? "selected" : ""}`}
										onClick={() => setEngine("openai")}
									>
										<span className="engine-title">
											<Sparkle size={14} />
											OpenAI Whisper
										</span>
										<span className="engine-desc">Cloud API</span>
									</button>
								</div>
							</div>

							{engine !== "local" && (
								<div className="asset-transcript-field">
									<label className="asset-transcript-label">
										{engine === "groq" ? "Groq API Key" : "OpenAI API Key"}
									</label>
									<input
										type="password"
										placeholder={`Enter ${engine} API key…`}
										className="asset-transcript-input"
										value={apiKey}
										onChange={(e) => setApiKey(e.target.value)}
									/>
								</div>
							)}
						</div>

						<footer className="asset-transcript-actions">
							{transcript && (
								<button
									type="button"
									className="asset-transcript-btn-secondary"
									onClick={() => setShowOptions(false)}
								>
									Cancel
								</button>
							)}
							<button
								type="button"
								className="asset-transcript-btn-primary"
								onClick={() => void handleStartTranscribe()}
							>
								<ClosedCaptioning size={14} weight="bold" />
								<span>Generate Captions</span>
							</button>
						</footer>
					</div>
				)}
			</div>
		</div>
	);
}
