import {
	ArrowsClockwise,
	BookOpen,
	Check,
	Code,
	Copy,
	FileCss,
	FileHtml,
	FileJs,
	Lightning,
	Pause,
	Play,
	Repeat,
	Rewind,
	Sparkle,
	UploadSimple,
	X,
} from "@phosphor-icons/react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { SlideWorkspaceProps } from "@/core/slides/types";
import {
	createDefaultMotionMeta,
	type MotionSlideMeta,
	STARTER_CSS,
	STARTER_HTML,
	STARTER_JS,
} from "../schema";

function formatTime(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	const tenths = Math.floor((ms % 1000) / 100);
	return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

export function parseHtmlFileContent(rawContent: string): {
	html: string;
	css: string;
	js: string;
} {
	if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(rawContent, "text/html");

			// Extract all <style> tags
			const styleElements = Array.from(doc.querySelectorAll("style"));
			const cssList = styleElements.map((el) => el.textContent || "").filter(Boolean);
			styleElements.forEach((el) => el.remove());

			// Extract all inline <script> tags without src
			const scriptElements = Array.from(doc.querySelectorAll("script:not([src])"));
			const jsList = scriptElements.map((el) => el.textContent || "").filter(Boolean);
			scriptElements.forEach((el) => el.remove());

			// Retain external font/css links if present in head
			const headLinks = Array.from(
				doc.head?.querySelectorAll("link[rel='stylesheet']") || [],
			);
			const linksHtml = headLinks.map((l) => l.outerHTML).join("\n");

			// Body HTML contents
			let bodyHtml = doc.body ? doc.body.innerHTML.trim() : rawContent;
			if (linksHtml && !bodyHtml.includes(linksHtml)) {
				bodyHtml = `${linksHtml}\n${bodyHtml}`;
			}

			return {
				html: bodyHtml || rawContent,
				css: cssList.join("\n\n") || "/* Tidak ada tag <style> di dalam file HTML */",
				js:
					jsList.join("\n\n") ||
					"// Timeline hook dipanggil otomatis oleh Captr Studio saat scrubbing/playback\nwindow.setSeekTime = function(timeMs, durationMs) {};",
			};
		} catch (err) {
			console.warn("[MotionSlide] DOMParser error, using regex fallback:", err);
		}
	}

	// Regex Fallback (Node / Vitest / Web workers)
	const cssMatches: string[] = [];
	const cleanCss = rawContent.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, p1) => {
		cssMatches.push(p1.trim());
		return "";
	});

	const jsMatches: string[] = [];
	const cleanJs = cleanCss.replace(
		/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
		(_match, p1) => {
			jsMatches.push(p1.trim());
			return "";
		},
	);

	const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(cleanJs);
	const html = (bodyMatch ? bodyMatch[1] : cleanJs).trim();

	return {
		html: html || rawContent,
		css:
			cssMatches.filter(Boolean).join("\n\n") ||
			"/* Tidak ada tag <style> di dalam file HTML */",
		js:
			jsMatches.filter(Boolean).join("\n\n") ||
			"// Timeline hook dipanggil otomatis oleh Captr Studio saat scrubbing/playback\nwindow.setSeekTime = function(timeMs, durationMs) {};",
	};
}

function buildSrcDoc(html: string, css: string, js: string): string {
	return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
${css}
  </style>
</head>
<body>
${html}
  <script>
    (function() {
      try {
${js}
      } catch (err) {
        console.error("[Motion Script Error]", err);
      }

      window.addEventListener("message", function(e) {
        if (e.data && e.data.type === "SEEK") {
          if (typeof window.setSeekTime === "function") {
            try {
              window.setSeekTime(e.data.timeMs, e.data.durationMs);
            } catch(seekErr) {
              console.error("[Motion Seek Error]", seekErr);
            }
          }
        }
      });
    })();
  </script>
</body>
</html>`;
}

export const MotionSlideWorkspace: React.FC<SlideWorkspaceProps<MotionSlideMeta>> = ({
	slide,
	onUpdateMeta,
	onUpdateTitle: _onUpdateTitle,
	onUpdateDuration,
	canvasDimensions,
}) => {
	const meta = slide.meta || createDefaultMotionMeta();

	// Mode Selection Popup: shown on initial load if not selected, or via toolbar button
	const [showModeModal, setShowModeModal] = useState(() => !meta.modeSelected);
	const [sourceFileName, setSourceFileName] = useState(() => meta.sourceFileName || "");
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	// Active tab in editor: html | css | js | guide
	const [activeTab, setActiveTab] = useState<"html" | "css" | "js" | "guide">("html");

	// Local code buffers for high-performance typing without lag
	const [htmlCode, setHtmlCode] = useState(() => meta.html ?? STARTER_HTML);
	const [cssCode, setCssCode] = useState(() => meta.css ?? STARTER_CSS);
	const [jsCode, setJsCode] = useState(() => meta.js ?? STARTER_JS);

	const [autoReload, setAutoReload] = useState(() => meta.autoReload ?? true);
	const [reloadNonce, setReloadNonce] = useState(0);
	const [compiledSrcDoc, setCompiledSrcDoc] = useState(() =>
		buildSrcDoc(htmlCode, cssCode, jsCode),
	);
	const [isCopied, setIsCopied] = useState(false);

	// Playback & Timeline Scrubber
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTimeMs, setCurrentTimeMs] = useState(0);
	const [isLoop, setIsLoop] = useState(true);

	const durationMs = slide.durationMs || meta.durationMs || 5000;

	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const rafRef = useRef<number | null>(null);
	const lastFrameTimeRef = useRef<number>(0);
	const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

	const latestCodeRef = useRef({ html: htmlCode, css: cssCode, js: jsCode });
	useEffect(() => {
		latestCodeRef.current = { html: htmlCode, css: cssCode, js: jsCode };
	}, [htmlCode, cssCode, jsCode]);

	// Choose editor mode directly
	const handleSelectEditorMode = () => {
		setShowModeModal(false);
		onUpdateMeta((prev) => ({
			...prev,
			modeSelected: true,
		}));
	};

	// Open file picker
	const handleTriggerFileInput = () => {
		fileInputRef.current?.click();
	};

	// File selected handler
	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const content = event.target?.result;
			if (typeof content === "string") {
				const parsed = parseHtmlFileContent(content);
				setHtmlCode(parsed.html);
				setCssCode(parsed.css);
				setJsCode(parsed.js);
				setSourceFileName(file.name);
				setShowModeModal(false);
				setCurrentTimeMs(0);
				setIsPlaying(false);
				setCompiledSrcDoc(buildSrcDoc(parsed.html, parsed.css, parsed.js));
				onUpdateMeta((prev) => ({
					...prev,
					html: parsed.html,
					css: parsed.css,
					js: parsed.js,
					modeSelected: true,
					sourceFileName: file.name,
				}));
			}
		};
		reader.readAsText(file);
		e.target.value = "";
	};

	// Force manual reload
	useEffect(() => {
		if (reloadNonce > 0) {
			const { html, css, js } = latestCodeRef.current;
			setCompiledSrcDoc(buildSrcDoc(html, css, js));
		}
	}, [reloadNonce]);

	// Auto-reload debounce effect
	useEffect(() => {
		if (debounceTimerRef.current) {
			clearTimeout(debounceTimerRef.current);
		}

		debounceTimerRef.current = setTimeout(() => {
			onUpdateMeta((prev) => ({
				...prev,
				html: htmlCode,
				css: cssCode,
				js: jsCode,
				autoReload,
				durationMs,
			}));

			if (autoReload) {
				setCompiledSrcDoc(buildSrcDoc(htmlCode, cssCode, jsCode));
			}
		}, 300);

		return () => {
			if (debounceTimerRef.current) {
				clearTimeout(debounceTimerRef.current);
			}
		};
	}, [htmlCode, cssCode, jsCode, autoReload, durationMs, onUpdateMeta]);

	// Broadcast seek time to iframe whenever currentTimeMs changes
	useEffect(() => {
		if (iframeRef.current?.contentWindow) {
			iframeRef.current.contentWindow.postMessage(
				{
					type: "SEEK",
					timeMs: currentTimeMs,
					durationMs,
				},
				"*",
			);
		}
	}, [currentTimeMs, durationMs]);

	// Send seek message when iframe reloads
	const handleIframeLoad = () => {
		if (iframeRef.current?.contentWindow) {
			iframeRef.current.contentWindow.postMessage(
				{
					type: "SEEK",
					timeMs: currentTimeMs,
					durationMs,
				},
				"*",
			);
		}
	};

	// Playback Animation Frame Loop
	useEffect(() => {
		if (!isPlaying) {
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			return;
		}

		lastFrameTimeRef.current = performance.now();

		const loop = (now: number) => {
			const delta = now - lastFrameTimeRef.current;
			lastFrameTimeRef.current = now;

			setCurrentTimeMs((prev) => {
				const next = prev + delta;
				if (next >= durationMs) {
					if (isLoop) {
						return 0;
					}
					setIsPlaying(false);
					return durationMs;
				}
				return next;
			});

			rafRef.current = requestAnimationFrame(loop);
		};

		rafRef.current = requestAnimationFrame(loop);

		return () => {
			if (rafRef.current) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, [isPlaying, durationMs, isLoop]);

	// Manual Reload Handler
	const handleManualReload = () => {
		setCurrentTimeMs(0);
		setIsPlaying(false);
		setReloadNonce((n) => n + 1);
	};

	// Reset to Starter Template Handler
	const handleResetStarter = () => {
		if (
			window.confirm(
				"Kembalikan template ke Starter Template awal? Perubahan kode Anda saat ini akan ditimpa.",
			)
		) {
			setHtmlCode(STARTER_HTML);
			setCssCode(STARTER_CSS);
			setJsCode(STARTER_JS);
			setCurrentTimeMs(0);
			setIsPlaying(false);
			setReloadNonce((n) => n + 1);
		}
	};

	// Handle Tab Key inside Code Editor
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Tab") {
			e.preventDefault();
			const target = e.currentTarget;
			const start = target.selectionStart;
			const end = target.selectionEnd;
			const val = target.value;

			const newVal = `${val.substring(0, start)}  ${val.substring(end)}`;
			target.value = newVal;
			target.selectionStart = target.selectionEnd = start + 2;

			if (activeTab === "html") setHtmlCode(newVal);
			else if (activeTab === "css") setCssCode(newVal);
			else if (activeTab === "js") setJsCode(newVal);
		}
	};

	// Copy current tab code
	const handleCopyCode = () => {
		const currentCode =
			activeTab === "html" ? htmlCode : activeTab === "css" ? cssCode : jsCode;
		navigator.clipboard.writeText(currentCode);
		setIsCopied(true);
		setTimeout(() => setIsCopied(false), 1800);
	};

	// Aspect ratio calculation
	const targetAspect =
		canvasDimensions && canvasDimensions.height > 0
			? canvasDimensions.width / canvasDimensions.height
			: 16 / 9;

	// Active code based on tab
	const activeCodeValue = useMemo(() => {
		if (activeTab === "html") return htmlCode;
		if (activeTab === "css") return cssCode;
		return jsCode;
	}, [activeTab, htmlCode, cssCode, jsCode]);

	const setActiveCodeValue = (val: string) => {
		if (activeTab === "html") setHtmlCode(val);
		else if (activeTab === "css") setCssCode(val);
		else if (activeTab === "js") setJsCode(val);
	};

	return (
		<div className="flex h-full w-full bg-slate-950 text-slate-100 select-none overflow-hidden">
			{/* Left Column: Live Canvas Preview & Playhead Bar */}
			<div className="flex flex-1 flex-col border-r border-slate-800/80 bg-slate-950 overflow-hidden">
				{/* Top Canvas Header Bar */}
				<div className="flex h-12 items-center justify-between border-b border-slate-800/80 px-4 bg-slate-900/60 backdrop-blur">
					<div className="flex items-center gap-2">
						<div className="flex h-6 w-6 items-center justify-center rounded bg-amber-500/20 text-amber-400">
							<Lightning size={15} weight="bold" />
						</div>
						<span className="text-xs font-semibold text-slate-200">
							Live Motion Preview
						</span>
						<span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-mono text-amber-400 border border-amber-500/20">
							HTML5
						</span>
						{sourceFileName && (
							<span
								className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-300 border border-sky-500/20 truncate max-w-[150px]"
								title={sourceFileName}
							>
								📄 {sourceFileName}
							</span>
						)}
					</div>

					{/* Actions: Mode/Import + Auto Reload & Manual Reload */}
					<div className="flex items-center gap-2.5">
						<button
							type="button"
							onClick={() => setShowModeModal(true)}
							title="Pilih mode atau import file HTML"
							className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/90 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition shadow-xs cursor-pointer"
						>
							<UploadSimple size={13} weight="bold" />
							<span>Mode / Import</span>
						</button>

						<div className="h-4 w-[1px] bg-slate-800" />

						<label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
							<input
								type="checkbox"
								checked={autoReload}
								onChange={(e) => setAutoReload(e.target.checked)}
								className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-900 text-amber-500 accent-amber-500 cursor-pointer"
							/>
							<span className="text-[11px] text-slate-400">Auto-reload</span>
						</label>

						<button
							type="button"
							onClick={handleManualReload}
							title="Reload Preview Sandbox"
							className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 transition"
						>
							<ArrowsClockwise size={13} weight="bold" />
							<span>Reload</span>
						</button>
					</div>
				</div>

				{/* Middle: Canvas Viewport (16:9 letterbox with sandboxed iframe) */}
				<div className="flex flex-1 items-center justify-center p-4 bg-slate-950 overflow-hidden">
					<div
						className="relative flex items-center justify-center w-full h-full max-h-[82vh] overflow-hidden rounded-xl border border-slate-800/80 bg-black shadow-2xl"
						style={{
							aspectRatio: `${targetAspect}`,
						}}
					>
						<iframe
							ref={iframeRef}
							title="Captr Motion Preview"
							srcDoc={compiledSrcDoc}
							onLoad={handleIframeLoad}
							sandbox="allow-scripts allow-same-origin"
							className="h-full w-full border-0 select-none pointer-events-auto"
						/>
					</div>
				</div>

				{/* Bottom: Playhead & Timeline Bar */}
				<div className="flex flex-col gap-2 border-t border-slate-800 bg-slate-900/90 px-4 py-2.5 backdrop-blur">
					{/* Progress Scrubber Slider */}
					<div className="flex items-center gap-3">
						<span className="w-16 text-right font-mono text-xs font-semibold text-amber-400">
							{formatTime(currentTimeMs)}
						</span>
						<input
							type="range"
							min={0}
							max={durationMs}
							value={currentTimeMs}
							onChange={(e) => {
								const newTime = Number(e.target.value);
								setCurrentTimeMs(newTime);
							}}
							className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-700 accent-amber-500"
						/>
						<span className="w-16 font-mono text-xs text-slate-400">
							{formatTime(durationMs)}
						</span>
					</div>

					{/* Playback Controls & Duration Editor */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setCurrentTimeMs(0)}
								title="Rewind ke awal"
								className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
							>
								<Rewind size={15} weight="bold" />
							</button>

							<button
								type="button"
								onClick={() => setIsPlaying((p) => !p)}
								className="flex h-8 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-xs font-semibold text-slate-950 shadow-md hover:bg-amber-400 transition"
							>
								{isPlaying ? (
									<>
										<Pause size={14} weight="fill" />
										<span>Pause</span>
									</>
								) : (
									<>
										<Play size={14} weight="fill" />
										<span>Play</span>
									</>
								)}
							</button>

							<button
								type="button"
								onClick={() => setIsLoop((l) => !l)}
								title={isLoop ? "Loop Aktif" : "Loop Non-aktif"}
								className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
									isLoop
										? "border-amber-500/40 bg-amber-500/10 text-amber-400"
										: "border-slate-700/60 bg-slate-800 text-slate-400 hover:text-slate-200"
								}`}
							>
								<Repeat size={14} weight="bold" />
							</button>
						</div>

						{/* Duration Setting */}
						<div className="flex items-center gap-2 text-xs text-slate-300">
							<span className="text-[11px] text-slate-400">Durasi Slide:</span>
							<select
								value={durationMs}
								onChange={(e) => {
									const val = Number(e.target.value);
									onUpdateDuration?.(val);
									onUpdateMeta((prev) => ({ ...prev, durationMs: val }));
								}}
								className="rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:border-amber-500 focus:outline-none"
							>
								<option value={3000}>3 Detik</option>
								<option value={5000}>5 Detik (Default)</option>
								<option value={8000}>8 Detik</option>
								<option value={10000}>10 Detik</option>
								<option value={15000}>15 Detik</option>
								<option value={20000}>20 Detik</option>
							</select>
						</div>
					</div>
				</div>
			</div>

			{/* Right Column: Code Editor & Starter Guide Tabs */}
			<div className="flex w-[480px] shrink-0 flex-col bg-slate-900 border-l border-slate-800">
				{/* Tabs Navigation */}
				<div className="flex h-12 items-center justify-between border-b border-slate-800 px-3 bg-slate-900/90">
					<div className="flex items-center gap-1">
						<button
							type="button"
							onClick={() => setActiveTab("html")}
							className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
								activeTab === "html"
									? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
									: "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
							}`}
						>
							<FileHtml size={14} weight="bold" />
							<span>HTML</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab("css")}
							className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
								activeTab === "css"
									? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
									: "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
							}`}
						>
							<FileCss size={14} weight="bold" />
							<span>CSS</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab("js")}
							className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
								activeTab === "js"
									? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
									: "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
							}`}
						>
							<FileJs size={14} weight="bold" />
							<span>JS</span>
						</button>

						<button
							type="button"
							onClick={() => setActiveTab("guide")}
							className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
								activeTab === "guide"
									? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
									: "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
							}`}
						>
							<BookOpen size={14} weight="bold" />
							<span>Panduan</span>
						</button>
					</div>

					{/* Reset / Copy Buttons */}
					<div className="flex items-center gap-1">
						{activeTab !== "guide" && (
							<button
								type="button"
								onClick={handleCopyCode}
								title="Salin Kode Tab Ini"
								className="flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
							>
								{isCopied ? (
									<Check size={14} className="text-emerald-400" />
								) : (
									<Copy size={14} />
								)}
							</button>
						)}

						<button
							type="button"
							onClick={handleResetStarter}
							title="Kembalikan Template ke Starter Awal"
							className="rounded border border-slate-700/80 bg-slate-800/80 px-2 py-1 text-[11px] font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
						>
							Reset Starter
						</button>
					</div>
				</div>

				{/* Editor Content Area */}
				<div className="relative flex flex-1 flex-col overflow-hidden bg-slate-950 font-mono text-xs">
					{activeTab === "guide" ? (
						<div className="flex-1 overflow-y-auto p-4 text-slate-300 font-sans leading-relaxed space-y-4">
							<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5">
								<div className="flex items-center gap-2 text-amber-400 font-semibold text-xs mb-1">
									<Sparkle size={15} weight="fill" />
									<span>Cara Kerja Motion Slide Captr Studio</span>
								</div>
								<p className="text-xs text-slate-300">
									Motion Slide memungkinkan Anda membuat video motion graphics
									menggunakan teknologi web standar (HTML5, CSS3, & JS). Anda
									tidak perlu rendering berat atau tool eksternal!
								</p>
							</div>

							<div className="space-y-2">
								<h4 className="text-xs font-bold text-white flex items-center gap-1.5">
									<span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-amber-400">
										1
									</span>
									Membuat Animasi dengan CSS Keyframes
								</h4>
								<p className="text-[11px] text-slate-400">
									Gunakan deklarasi <code>@keyframes</code> standard di tab{" "}
									<strong>CSS</strong>. Untuk transisi masuk berurutan, atur{" "}
									<code>animation-delay</code> pada masing-masing elemen.
								</p>
								<div className="rounded-lg bg-slate-900 p-2.5 font-mono text-[11px] text-amber-300 border border-slate-800">
									{`@keyframes slideIn {\n  0% { opacity: 0; transform: translateY(20px); }\n  100% { opacity: 1; transform: translateY(0); }\n}`}
								</div>
							</div>

							<div className="space-y-2">
								<h4 className="text-xs font-bold text-white flex items-center gap-1.5">
									<span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-amber-400">
										2
									</span>
									Sinkronisasi Playhead (Scrubbing) dengan JS
								</h4>
								<p className="text-[11px] text-slate-400">
									Captr Studio otomatis memanggil fungsi JavaScript berikut saat
									playhead bergerak:
								</p>
								<div className="rounded-lg bg-slate-900 p-2.5 font-mono text-[11px] text-sky-300 border border-slate-800">
									{`window.setSeekTime = function(timeMs, durationMs) {\n  const progress = timeMs / durationMs;\n  // Update elemen sesuai progress (0.0 - 1.0)\n};`}
								</div>
							</div>

							<div className="space-y-2">
								<h4 className="text-xs font-bold text-white flex items-center gap-1.5">
									<span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-amber-400">
										3
									</span>
									Auto Reload & Live Editing
								</h4>
								<p className="text-[11px] text-slate-400">
									Setiap ketikan Anda di tab HTML, CSS, atau JS akan langsung
									di-compile ke preview sebelah kiri tanpa perlu me-reload manual.
									Anda dapat mematikan toggle Auto-reload di bagian atas jika
									ingin mengedit tanpa refresh otomatis.
								</p>
							</div>

							<div className="space-y-2">
								<h4 className="text-xs font-bold text-white flex items-center gap-1.5">
									<span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-[10px] text-amber-400">
										4
									</span>
									Kompatibilitas Global Flow
								</h4>
								<p className="text-[11px] text-slate-400">
									Slide ini dapat digabungkan dengan Slide Record dan Slide Video
									Captr Studio. Transisi antar-slide (Crossfade, Fade to Black,
									Slide Left, dll.) berfungsi penuh di timeline dan saat
									multi-slide export.
								</p>
							</div>
						</div>
					) : (
						<div className="relative flex-1 flex flex-col h-full overflow-hidden">
							<textarea
								value={activeCodeValue}
								onChange={(e) => setActiveCodeValue(e.target.value)}
								onKeyDown={handleKeyDown}
								spellCheck={false}
								autoCapitalize="off"
								autoComplete="off"
								className="h-full w-full resize-none bg-slate-950 p-4 font-mono text-[12px] leading-relaxed text-slate-200 outline-none focus:ring-0 select-text scrollbar-thin scrollbar-thumb-slate-700"
								placeholder={`Masukkan kode ${activeTab.toUpperCase()} Anda di sini...`}
							/>
						</div>
					)}
				</div>

				{/* Editor Status Bar */}
				<div className="flex h-7 items-center justify-between border-t border-slate-800 bg-slate-950 px-3 text-[10px] text-slate-500">
					<div className="flex items-center gap-2">
						<Code size={12} />
						<span className="uppercase">{activeTab} Mode</span>
						<span>•</span>
						<span>{activeCodeValue.split("\n").length} Baris</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
						<span className="text-emerald-400">Auto-Reload Active</span>
					</div>
				</div>
			</div>

			{/* Mode Selection Popup Modal */}
			{showModeModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
					<div className="relative w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl text-slate-200 overflow-hidden">
						{/* Ambient Glow */}
						<div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />

						{/* Header */}
						<div className="flex items-start justify-between pb-4 border-b border-slate-800">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
									<Lightning size={22} weight="bold" />
								</div>
								<div>
									<h3 className="text-base font-bold text-white">
										Mulai Slide Motion
									</h3>
									<p className="text-xs text-slate-400 mt-0.5">
										Pilih bagaimana Anda ingin memulai slide animasi HTML ini:
									</p>
								</div>
							</div>
							{meta.modeSelected && (
								<button
									type="button"
									onClick={() => setShowModeModal(false)}
									className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition cursor-pointer"
								>
									<X size={16} />
								</button>
							)}
						</div>

						{/* Options Grid */}
						<div className="grid grid-cols-2 gap-3.5 my-5">
							{/* Option 1: Langsung di Editor */}
							<button
								type="button"
								onClick={handleSelectEditorMode}
								className="group relative flex flex-col justify-between rounded-xl border border-slate-700/80 bg-slate-800/40 p-4 text-left transition hover:border-amber-500/60 hover:bg-amber-500/5 cursor-pointer shadow-sm"
							>
								<div>
									<div className="flex items-center justify-between mb-2.5">
										<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 group-hover:scale-105 transition-transform">
											<Code size={18} weight="bold" />
										</div>
										<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20">
											INTERAKTIF
										</span>
									</div>
									<h4 className="text-sm font-semibold text-white group-hover:text-amber-300 transition-colors">
										Langsung di Editor
									</h4>
									<p className="text-xs text-slate-400 mt-1 leading-relaxed">
										Mulai dengan Starter Template. Tulis kode HTML, CSS & JS
										langsung dengan auto-reload dan timeline control.
									</p>
								</div>
								<div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-amber-400 group-hover:translate-x-0.5 transition-transform">
									<span>Buka Code Editor</span>
									<span>→</span>
								</div>
							</button>

							{/* Option 2: Parsing dari File HTML */}
							<button
								type="button"
								onClick={handleTriggerFileInput}
								className="group relative flex flex-col justify-between rounded-xl border border-slate-700/80 bg-slate-800/40 p-4 text-left transition hover:border-sky-500/60 hover:bg-sky-500/5 cursor-pointer shadow-sm"
							>
								<div>
									<div className="flex items-center justify-between mb-2.5">
										<div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-500/20 text-sky-400 group-hover:scale-105 transition-transform">
											<UploadSimple size={18} weight="bold" />
										</div>
										<span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/20">
											IMPORT FILE
										</span>
									</div>
									<h4 className="text-sm font-semibold text-white group-hover:text-sky-300 transition-colors">
										Parsing dari File HTML
									</h4>
									<p className="text-xs text-slate-400 mt-1 leading-relaxed">
										Pilih file .html yang sudah ada. Captr Studio otomatis
										mengekstrak &lt;style&gt;, &lt;script&gt;, dan elemen body
										ke workspace.
									</p>
								</div>
								<div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-sky-400 group-hover:translate-x-0.5 transition-transform">
									<span>Pilih File HTML...</span>
									<span>→</span>
								</div>
							</button>
						</div>

						{/* Footer Note */}
						<div className="flex items-center justify-between pt-3 border-t border-slate-800 text-[11px] text-slate-500">
							<span>
								Anda dapat berganti mode atau mengimpor file lain kapan saja.
							</span>
							{meta.modeSelected && (
								<button
									type="button"
									onClick={() => setShowModeModal(false)}
									className="text-slate-400 hover:text-slate-200 cursor-pointer"
								>
									Tutup
								</button>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Hidden file input for HTML upload */}
			<input
				ref={fileInputRef}
				type="file"
				accept=".html,.htm"
				onChange={handleFileChange}
				className="hidden"
			/>
		</div>
	);
};
