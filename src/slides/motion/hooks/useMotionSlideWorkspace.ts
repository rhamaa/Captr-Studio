import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import type { SlideWorkspaceProps } from "@/core/slides/types";
import { buildMotionEditorPreviewDocument, parseHtmlFileContent } from "../motionDocument";
import {
	createDefaultMotionMeta,
	STARTER_CSS,
	STARTER_HTML,
	STARTER_JS,
} from "../schema";
import type { MotionEditorTab } from "../components/MotionCodeEditor";

export function useMotionSlideWorkspace({
	slide,
	onUpdateMeta,
	onUpdateDuration,
	canvasDimensions,
}: SlideWorkspaceProps<"motion">) {
	const meta = useMemo(() => slide.meta || createDefaultMotionMeta(), [slide.meta]);
	const [showModeModal, setShowModeModal] = useState(false);
	const [sourceFileName, setSourceFileName] = useState(() => meta.sourceFileName || "");
	const fileInputRef = useRef<HTMLInputElement | null>(null);
	const [activeTab, setActiveTab] = useState<MotionEditorTab>("html");
	const [htmlCode, setHtmlCode] = useState(() => meta.html ?? STARTER_HTML);
	const [cssCode, setCssCode] = useState(() => meta.css ?? STARTER_CSS);
	const [jsCode, setJsCode] = useState(() => meta.js ?? STARTER_JS);
	const [autoReload, setAutoReload] = useState(() => meta.autoReload ?? true);
	const [reloadNonce, setReloadNonce] = useState(0);
	const [compiledSrcDoc, setCompiledSrcDoc] = useState(() =>
		buildMotionEditorPreviewDocument(htmlCode, cssCode, jsCode),
	);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTimeMs, setCurrentTimeMs] = useState(0);
	const [isLoop, setIsLoop] = useState(true);
	const durationMs = slide.durationMs || meta.durationMs || 5000;

	const iframeRef = useRef<HTMLIFrameElement>(null);
	const rafRef = useRef<number | null>(null);
	const lastFrameTimeRef = useRef(0);
	const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const latestCodeRef = useRef({ html: htmlCode, css: cssCode, js: jsCode });
	const currentSlideIdRef = useRef(slide.id);

	useEffect(() => {
		if (currentSlideIdRef.current === slide.id) return;
		currentSlideIdRef.current = slide.id;

		const nextMeta = slide.meta || createDefaultMotionMeta();
		const nextHtml = nextMeta.html ?? STARTER_HTML;
		const nextCss = nextMeta.css ?? STARTER_CSS;
		const nextJs = nextMeta.js ?? STARTER_JS;
		latestCodeRef.current = { html: nextHtml, css: nextCss, js: nextJs };
		if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
		if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
		debounceTimerRef.current = null;
		rafRef.current = null;

		setSourceFileName(nextMeta.sourceFileName || "");
		setActiveTab("html");
		setHtmlCode(nextHtml);
		setCssCode(nextCss);
		setJsCode(nextJs);
		setAutoReload(nextMeta.autoReload ?? true);
		setCompiledSrcDoc(buildMotionEditorPreviewDocument(nextHtml, nextCss, nextJs));
		setIsPlaying(false);
		setCurrentTimeMs(0);
		setIsLoop(true);
		setReloadNonce(0);
	}, [slide.id, slide.meta]);

	useEffect(() => {
		latestCodeRef.current = { html: htmlCode, css: cssCode, js: jsCode };
	}, [htmlCode, cssCode, jsCode]);

	const handleSelectEditorMode = () => {
		setShowModeModal(false);
		onUpdateMeta((prev) => ({ ...prev, modeSelected: true }));
	};

	const handleTriggerFileInput = () => fileInputRef.current?.click();

	const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (loadEvent) => {
			const content = loadEvent.target?.result;
			if (typeof content !== "string") return;

			const parsed = parseHtmlFileContent(content);
			setHtmlCode(parsed.html);
			setCssCode(parsed.css);
			setJsCode(parsed.js);
			setSourceFileName(file.name);
			setShowModeModal(false);
			setCurrentTimeMs(0);
			setIsPlaying(false);
			setCompiledSrcDoc(
				buildMotionEditorPreviewDocument(parsed.html, parsed.css, parsed.js),
			);
			onUpdateMeta((prev) => ({
				...prev,
				document: "",
				html: parsed.html,
				css: parsed.css,
				js: parsed.js,
				modeSelected: true,
				sourceFileName: file.name,
			}));
		};
		reader.readAsText(file);
		event.target.value = "";
	};

	useEffect(() => {
		if (reloadNonce <= 0) return;
		const { html, css, js } = latestCodeRef.current;
		setCompiledSrcDoc(buildMotionEditorPreviewDocument(html, css, js));
	}, [reloadNonce]);

	useEffect(() => {
		if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

		debounceTimerRef.current = setTimeout(() => {
			onUpdateMeta((prev) => ({
				...prev,
				document: "",
				html: htmlCode,
				css: cssCode,
				js: jsCode,
				autoReload,
				durationMs,
			}));

			if (autoReload) {
				setCompiledSrcDoc(buildMotionEditorPreviewDocument(htmlCode, cssCode, jsCode));
			}
		}, 300);

		return () => {
			if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
		};
	}, [htmlCode, cssCode, jsCode, autoReload, durationMs, onUpdateMeta]);

	const sendSeekToPreview = useCallback(() => {
		iframeRef.current?.contentWindow?.postMessage(
			{ type: "SEEK", timeMs: currentTimeMs, durationMs },
			"*",
		);
	}, [currentTimeMs, durationMs]);

	useEffect(() => {
		sendSeekToPreview();
	}, [sendSeekToPreview]);

	useEffect(() => {
		if (!isPlaying) {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
			return;
		}

		lastFrameTimeRef.current = performance.now();
		const loop = (now: number) => {
			const delta = now - lastFrameTimeRef.current;
			lastFrameTimeRef.current = now;

			setCurrentTimeMs((previousTimeMs) => {
				const nextTimeMs = previousTimeMs + delta;
				if (nextTimeMs >= durationMs) {
					if (isLoop) return 0;
					setIsPlaying(false);
					return durationMs;
				}
				return nextTimeMs;
			});
			rafRef.current = requestAnimationFrame(loop);
		};

		rafRef.current = requestAnimationFrame(loop);
		return () => {
			if (rafRef.current !== null) {
				cancelAnimationFrame(rafRef.current);
				rafRef.current = null;
			}
		};
	}, [isPlaying, durationMs, isLoop]);

	const handleManualReload = () => {
		setCurrentTimeMs(0);
		setIsPlaying(false);
		setReloadNonce((nonce) => nonce + 1);
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
			setReloadNonce((nonce) => nonce + 1);
		}
	};

	const handleChangeDuration = (nextDurationMs: number) => {
		onUpdateDuration?.(nextDurationMs);
		onUpdateMeta((prev) => ({ ...prev, durationMs: nextDurationMs }));
	};

	const targetAspect =
		canvasDimensions && canvasDimensions.height > 0
			? canvasDimensions.width / canvasDimensions.height
			: 16 / 9;

	return {
		meta,
		showModeModal,
		setShowModeModal,
		sourceFileName,
		fileInputRef,
		activeTab,
		setActiveTab,
		htmlCode,
		setHtmlCode,
		cssCode,
		setCssCode,
		jsCode,
		setJsCode,
		autoReload,
		setAutoReload,
		compiledSrcDoc,
		isPlaying,
		setIsPlaying,
		currentTimeMs,
		setCurrentTimeMs,
		isLoop,
		setIsLoop,
		durationMs,
		iframeRef,
		targetAspect,
		handleSelectEditorMode,
		handleTriggerFileInput,
		handleFileChange,
		handleIframeLoad: sendSeekToPreview,
		handleManualReload,
		handleResetStarter,
		handleChangeDuration,
	};
}
