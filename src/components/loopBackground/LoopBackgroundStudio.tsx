import { ArrowLeft, DownloadSimple, Export, Minus, Square, X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import {
	exportLoopGif,
	type GifAspectRatio,
	GifExportCancelledError,
	type GifExportJob,
	type GifExportProgress,
	type GifExportSettings,
	type GifFrameRate,
	type GifResolution,
	getGifDimensions,
} from "@/lib/loopBackground/gifExport";
import { drawPatternFrame, type LoopPattern } from "@/lib/loopBackground/patternRenderer";
import "./LoopBackgroundStudio.css";

const INITIAL_SETTINGS: GifExportSettings = {
	pattern: "dot-noise",
	aspectRatio: "16:9",
	resolution: 720,
	backgroundColor: "#11151d",
	accentColor: "#8ab4ff",
	density: 0.4,
	scale: 1,
	speed: 2,
	durationSeconds: 4,
	frameRate: 25,
	seed: 42,
};

const PATTERNS: Array<{ id: LoopPattern; key: string; fallback: string }> = [
	{ id: "dot-noise", key: "dotNoise", fallback: "Dot Noise" },
	{ id: "film-grain", key: "filmGrain", fallback: "Film Grain" },
	{ id: "orbit", key: "orbit", fallback: "Orbit" },
];

type ExportState = "idle" | "exporting" | "done" | "error";

export function LoopBackgroundStudio({ onBack }: { onBack: () => void }) {
	const m = useScopedT("common");
	const text = (key: string, fallback: string) => m(`loopBackgroundStudio.${key}`, fallback);
	const [settings, setSettings] = useState(INITIAL_SETTINGS);
	const settingsRef = useRef(settings);
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const jobRef = useRef<GifExportJob | null>(null);
	const [exportState, setExportState] = useState<ExportState>("idle");
	const [progress, setProgress] = useState<GifExportProgress>({
		phase: "rendering",
		currentFrame: 0,
		totalFrames: 1,
		percentage: 0,
	});
	const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState("");

	settingsRef.current = settings;

	useEffect(() => {
		let animationId = 0;
		let lastDrawAt = 0;
		const startedAt = performance.now();
		const render = (now: number) => {
			if (now - lastDrawAt >= 1000 / 24) {
				const canvas = canvasRef.current;
				const currentSettings = settingsRef.current;
				if (canvas) {
					const dimensions = getGifDimensions(
						currentSettings.aspectRatio,
						currentSettings.resolution,
					);
					if (canvas.width !== dimensions.width) canvas.width = dimensions.width;
					if (canvas.height !== dimensions.height) canvas.height = dimensions.height;
					const context = canvas.getContext("2d");
					if (context) {
						const phase =
							((now - startedAt) / 1000 / currentSettings.durationSeconds) % 1;
						drawPatternFrame(context, {
							...currentSettings,
							width: dimensions.width,
							height: dimensions.height,
							phase,
							seed: currentSettings.seed ?? 42,
						});
					}
				}
				lastDrawAt = now;
			}
			animationId = requestAnimationFrame(render);
		};
		animationId = requestAnimationFrame(render);
		return () => cancelAnimationFrame(animationId);
	}, []);

	useEffect(
		() => () => {
			jobRef.current?.cancel();
			if (downloadUrl) URL.revokeObjectURL(downloadUrl);
		},
		[downloadUrl],
	);

	const updateSetting = <K extends keyof GifExportSettings>(
		key: K,
		value: GifExportSettings[K],
	) => setSettings((current) => ({ ...current, [key]: value }));

	const handleExport = async () => {
		setExportState("exporting");
		setErrorMessage("");
		setDownloadUrl(null);
		setProgress({ phase: "rendering", currentFrame: 0, totalFrames: 1, percentage: 0 });
		const job = exportLoopGif(settings, {
			onProgress: (nextProgress) => setProgress(nextProgress),
		});
		jobRef.current = job;
		try {
			const blob = await job.promise;
			setDownloadUrl(URL.createObjectURL(blob));
			setExportState("done");
		} catch (error) {
			if (error instanceof GifExportCancelledError) {
				setExportState("idle");
			} else {
				setErrorMessage(error instanceof Error ? error.message : String(error));
				setExportState("error");
			}
		} finally {
			if (jobRef.current === job) jobRef.current = null;
		}
	};

	const handleBack = () => {
		jobRef.current?.cancel();
		jobRef.current = null;
		onBack();
	};
	const dimensions = getGifDimensions(settings.aspectRatio, settings.resolution);
	const activePattern = PATTERNS.find((pattern) => pattern.id === settings.pattern);
	const isExporting = exportState === "exporting";

	return (
		<main className="loop-bg-studio">
			<header className="loop-bg-header">
				<button className="loop-bg-back" type="button" onClick={handleBack}>
					<ArrowLeft size={17} />
					{text("backHome", "Back to Home")}
				</button>
				<div className="loop-bg-title">
					<span>{text("miniApp", "MINI APP")}</span>
					<h1>{text("title", "Loop Background Studio")}</h1>
				</div>
				<div className="loop-bg-header-actions">
					{isExporting ? (
						<button
							className="loop-bg-export-button secondary"
							type="button"
							onClick={() => jobRef.current?.cancel()}
						>
							<X size={17} />
							{text("cancelExport", "Cancel export")}
						</button>
					) : (
						<button
							className="loop-bg-export-button"
							type="button"
							onClick={() => void handleExport()}
						>
							<Export size={17} />
							{text("exportGif", "Export GIF")}
						</button>
					)}
					<div className="loop-bg-window-controls">
						<button
							aria-label="Minimize"
							type="button"
							onClick={() => void window.electronAPI?.minimizeWindow?.()}
						>
							<Minus size={16} />
						</button>
						<button
							aria-label="Maximize"
							type="button"
							onClick={() => void window.electronAPI?.maximizeWindow?.()}
						>
							<Square size={14} />
						</button>
						<button
							aria-label="Close"
							type="button"
							onClick={() => void window.electronAPI?.closeWindow?.()}
						>
							<X size={16} />
						</button>
					</div>
				</div>
			</header>

			<div className="loop-bg-workspace">
				<section className="loop-bg-preview-panel" aria-label={text("preview", "Preview")}>
					<div className="loop-bg-preview-meta">
						<strong>
							{text(
								activePattern?.key ?? "dotNoise",
								activePattern?.fallback ?? "Dot Noise",
							)}
						</strong>
						<span>
							{settings.durationSeconds}s · {settings.frameRate} FPS ·{" "}
							{dimensions.width} × {dimensions.height}
						</span>
					</div>
					<div
						className="loop-bg-canvas-stage"
						style={{ aspectRatio: `${dimensions.width} / ${dimensions.height}` }}
					>
						<canvas
							ref={canvasRef}
							aria-label={text("previewCanvas", "Animated loop preview")}
						/>
					</div>
					<p>
						{text(
							"previewHint",
							"Preview loops continuously. Exported GIF uses the same animation.",
						)}
					</p>
					{isExporting && (
						<div className="loop-bg-progress" role="status" aria-live="polite">
							<div>
								<span>
									{progress.phase === "encoding"
										? text("encoding", "Encoding GIF")
										: text("rendering", "Rendering frames")}
								</span>
								<span>{progress.percentage}%</span>
							</div>
							<progress value={progress.percentage} max={100} />
						</div>
					)}
					{downloadUrl && (
						<a
							className="loop-bg-download"
							href={downloadUrl}
							download="loop-background.gif"
						>
							<DownloadSimple size={17} />
							{text("downloadGif", "Download GIF")}
						</a>
					)}
					{exportState === "error" && (
						<p className="loop-bg-error" role="alert">
							{errorMessage}
						</p>
					)}
				</section>

				<aside className="loop-bg-settings" aria-label={text("settings", "Loop settings")}>
					<div className="loop-bg-settings-heading">
						<div>
							<span>{text("design", "DESIGN")}</span>
							<h2>{text("settings", "Loop settings")}</h2>
						</div>
					</div>

					<fieldset disabled={isExporting}>
						<legend>{text("pattern", "Pattern")}</legend>
						<div className="loop-bg-pattern-list">
							{PATTERNS.map((pattern) => (
								<button
									key={pattern.id}
									className={settings.pattern === pattern.id ? "selected" : ""}
									type="button"
									aria-pressed={settings.pattern === pattern.id}
									onClick={() => updateSetting("pattern", pattern.id)}
								>
									<span className={`loop-bg-pattern-swatch ${pattern.id}`} />
									<span>{text(pattern.key, pattern.fallback)}</span>
								</button>
							))}
						</div>

						<label className="loop-bg-field">
							<span>{text("aspectRatio", "Aspect ratio")}</span>
							<select
								aria-label={text("aspectRatio", "Aspect ratio")}
								value={settings.aspectRatio}
								onChange={(event) =>
									updateSetting(
										"aspectRatio",
										event.target.value as GifAspectRatio,
									)
								}
							>
								<option value="16:9">
									16:9 · {text("landscape", "Widescreen")}
								</option>
								<option value="9:16">9:16 · {text("portrait", "Portrait")}</option>
								<option value="1:1">1:1 · {text("square", "Square")}</option>
							</select>
						</label>
						<label className="loop-bg-field">
							<span>{text("resolution", "Output size")}</span>
							<select
								aria-label={text("resolution", "Output size")}
								value={settings.resolution}
								onChange={(event) =>
									updateSetting(
										"resolution",
										Number(event.target.value) as GifResolution,
									)
								}
							>
								<option value={720}>720p</option>
								<option value={1080}>1080p</option>
							</select>
						</label>

						<div className="loop-bg-colors">
							<label className="loop-bg-color-field">
								<span>{text("background", "Background")}</span>
								<input
									aria-label={text("background", "Background")}
									type="color"
									value={settings.backgroundColor}
									onChange={(event) =>
										updateSetting("backgroundColor", event.target.value)
									}
								/>
							</label>
							<label className="loop-bg-color-field">
								<span>{text("accent", "Accent")}</span>
								<input
									aria-label={text("accent", "Accent")}
									type="color"
									value={settings.accentColor}
									onChange={(event) =>
										updateSetting("accentColor", event.target.value)
									}
								/>
							</label>
						</div>

						<RangeControl
							label={text("density", "Density")}
							value={settings.density}
							min={0.1}
							max={1.5}
							step={0.1}
							format={(value) => value.toFixed(1)}
							onChange={(value) => updateSetting("density", value)}
						/>
						<RangeControl
							label={text("scale", "Scale")}
							value={settings.scale}
							min={0.5}
							max={3}
							step={0.1}
							format={(value) => `${value.toFixed(1)}×`}
							onChange={(value) => updateSetting("scale", value)}
						/>
						<RangeControl
							label={text("speed", "Speed")}
							value={settings.speed}
							min={1}
							max={4}
							step={1}
							format={(value) => `${value}×`}
							onChange={(value) => updateSetting("speed", value)}
						/>

						<div className="loop-bg-duration-rate">
							<RangeControl
								label={text("duration", "Duration")}
								ariaLabel={text("durationAria", "Duration in seconds")}
								value={settings.durationSeconds}
								min={1}
								max={10}
								step={1}
								format={(value) => `${value}s`}
								onChange={(value) => updateSetting("durationSeconds", value)}
							/>
							<label className="loop-bg-field">
								<span>{text("frameRate", "Frame rate")}</span>
								<select
									aria-label={text("frameRate", "Frame rate")}
									value={settings.frameRate}
									onChange={(event) =>
										updateSetting(
											"frameRate",
											Number(event.target.value) as GifFrameRate,
										)
									}
								>
									{([15, 20, 25, 30] as GifFrameRate[]).map((frameRate) => (
										<option key={frameRate} value={frameRate}>
											{frameRate} FPS
										</option>
									))}
								</select>
							</label>
						</div>
					</fieldset>
					<p className="loop-bg-settings-note">
						{text(
							"loopNote",
							"GIFs repeat forever. Designs stay in this session only.",
						)}
					</p>
				</aside>
			</div>
		</main>
	);
}

function RangeControl({
	label,
	ariaLabel,
	value,
	min,
	max,
	step,
	format,
	onChange,
}: {
	label: string;
	ariaLabel?: string;
	value: number;
	min: number;
	max: number;
	step: number;
	format: (value: number) => string;
	onChange: (value: number) => void;
}) {
	return (
		<label className="loop-bg-range">
			<span>
				{label}
				<strong>{format(value)}</strong>
			</span>
			<input
				aria-label={ariaLabel ?? label}
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(event) => onChange(Number(event.target.value))}
			/>
		</label>
	);
}
