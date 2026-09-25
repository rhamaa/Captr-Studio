import { ArrowsClockwise, Lightning, UploadSimple } from "@phosphor-icons/react";
import React, { useEffect, useRef, useState } from "react";
import type { SlideWorkspaceProps } from "@/core/slides/types";
import {
	createDefaultMotionMeta,
	type MotionSlideMeta,
	STARTER_CSS,
	STARTER_HTML,
	STARTER_JS,
} from "../schema";
import { MotionCodeEditor, type MotionEditorTab } from "./MotionCodeEditor";
import { MotionModeModal } from "./MotionModeModal";
import { MotionPreviewMonitor } from "./MotionPreviewMonitor";
import { MotionTimelineBar } from "./MotionTimelineBar";

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

	// Mode Selection Popup: accessible via toolbar / template button
	const [showModeModal, setShowModeModal] = useState(false);
	const [sourceFileName, setSourceFileName] = useState(() => meta.sourceFileName || "");
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	// Active tab in editor: html | css | js | guide
	const [activeTab, setActiveTab] = useState<MotionEditorTab>("html");

	// Local code buffers for high-performance typing without lag
	const [htmlCode, setHtmlCode] = useState(() => meta.html ?? STARTER_HTML);
	const [cssCode, setCssCode] = useState(() => meta.css ?? STARTER_CSS);
	const [jsCode, setJsCode] = useState(() => meta.js ?? STARTER_JS);

	const [autoReload, setAutoReload] = useState(() => meta.autoReload ?? true);
	const [reloadNonce, setReloadNonce] = useState(0);
	const [compiledSrcDoc, setCompiledSrcDoc] = useState(() =>
		buildSrcDoc(htmlCode, cssCode, jsCode),
	);

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

	const handleManualReload = () => {
		setCurrentTimeMs(0);
		setIsPlaying(false);
		setReloadNonce((n) => n + 1);
	};

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

	const targetAspect =
		canvasDimensions && canvasDimensions.height > 0
			? canvasDimensions.width / canvasDimensions.height
			: 16 / 9;

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

					{/* Actions: Import HTML + Template + Auto Reload & Manual Reload */}
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={handleTriggerFileInput}
							title="Import file HTML dari komputer"
							className="flex items-center gap-1.5 rounded border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-xs text-sky-300 hover:bg-sky-500/25 hover:text-white transition shadow-xs cursor-pointer font-medium"
						>
							<UploadSimple size={13} weight="bold" />
							<span>Import HTML</span>
						</button>

						<button
							type="button"
							onClick={() => setShowModeModal(true)}
							title="Pilih template atau panduan animasi"
							className="flex items-center gap-1.5 rounded border border-slate-700 bg-slate-800/90 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 hover:text-white transition shadow-xs cursor-pointer"
						>
							<span>Template</span>
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
							className="flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 transition cursor-pointer"
						>
							<ArrowsClockwise size={13} weight="bold" />
							<span>Reload</span>
						</button>
					</div>
				</div>

				{/* Quick Guidance / Action Bar */}
				<div className="flex items-center justify-between gap-3 px-4 py-2 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/15 text-xs shrink-0">
					<div className="flex items-center gap-2 text-slate-300 min-w-0">
						<Lightning className="w-3.5 h-3.5 text-amber-400 shrink-0" weight="fill" />
						<span className="truncate text-[11px]">
							<strong className="text-amber-300 font-semibold">Motion Studio:</strong> Edit kode langsung di tab (HTML/CSS/JS), atau{" "}
							<button
								type="button"
								onClick={handleTriggerFileInput}
								className="underline text-sky-400 hover:text-sky-300 cursor-pointer font-medium"
							>
								upload file HTML
							</button>
							, atau{" "}
							<button
								type="button"
								onClick={() => setShowModeModal(true)}
								className="underline text-amber-400 hover:text-amber-300 cursor-pointer font-medium"
							>
								pilih template
							</button>
							.
						</span>
					</div>
					<div className="flex items-center gap-1.5 shrink-0">
						<button
							type="button"
							onClick={handleTriggerFileInput}
							className="flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-semibold bg-sky-500/15 text-sky-300 hover:bg-sky-500/25 border border-sky-500/30 transition cursor-pointer"
						>
							<UploadSimple size={12} weight="bold" />
							<span>Upload HTML</span>
						</button>
					</div>
				</div>

				{/* Middle: Canvas Viewport */}
				<MotionPreviewMonitor
					iframeRef={iframeRef}
					srcDoc={compiledSrcDoc}
					aspectRatio={targetAspect}
					onIframeLoad={handleIframeLoad}
				/>

				{/* Bottom: Playhead & Timeline Bar */}
				<MotionTimelineBar
					currentTimeMs={currentTimeMs}
					durationMs={durationMs}
					isPlaying={isPlaying}
					isLoop={isLoop}
					onSeek={(timeMs) => setCurrentTimeMs(timeMs)}
					onTogglePlay={() => setIsPlaying((p) => !p)}
					onRewind={() => setCurrentTimeMs(0)}
					onToggleLoop={() => setIsLoop((l) => !l)}
					onChangeDuration={(val) => {
						onUpdateDuration?.(val);
						onUpdateMeta((prev) => ({ ...prev, durationMs: val }));
					}}
				/>
			</div>

			{/* Right Column: Code Editor */}
			<MotionCodeEditor
				activeTab={activeTab}
				onChangeTab={setActiveTab}
				htmlCode={htmlCode}
				cssCode={cssCode}
				jsCode={jsCode}
				onChangeHtml={setHtmlCode}
				onChangeCss={setCssCode}
				onChangeJs={setJsCode}
				onResetStarter={handleResetStarter}
				autoReload={autoReload}
			/>

			{/* Mode Selection Popup Modal */}
			<MotionModeModal
				isOpen={showModeModal}
				hasSelectedModeBefore={Boolean(meta.modeSelected)}
				onSelectEditor={handleSelectEditorMode}
				onTriggerImport={handleTriggerFileInput}
				onClose={() => setShowModeModal(false)}
			/>

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
