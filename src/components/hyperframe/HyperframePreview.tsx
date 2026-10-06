import {
	ArrowClockwise,
	Code,
	Pause,
	Play,
	Sparkle,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { HyperframeComposition } from "@/core/story/storyTypes";

export interface HyperframePreviewProps {
	hyperframe: HyperframeComposition;
	onUpdateHtml?: (newHtml: string) => void;
	onAttachToStory?: (storyId: string) => void;
}

export function HyperframePreview({
	hyperframe,
}: HyperframePreviewProps) {
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const [currentTimeSec, setCurrentTimeSec] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [showCode, setShowCode] = useState(false);
	const [scale, setScale] = useState(0.4);
	const containerRef = useRef<HTMLDivElement | null>(null);

	const durationSec = Math.max(0.1, hyperframe.durationUs / 1_000_000);

	// Adjust scale to fit viewport
	useEffect(() => {
		const updateScale = () => {
			if (!containerRef.current) return;
			const { clientWidth, clientHeight } = containerRef.current;
			if (clientWidth > 0 && clientHeight > 0) {
				const padding = 64;
				const scaleX = (clientWidth - padding) / hyperframe.width;
				const scaleY = (clientHeight - padding) / hyperframe.height;
				setScale(Math.max(0.15, Math.min(scaleX, scaleY, 0.75)));
			}
		};
		updateScale();
		window.addEventListener("resize", updateScale);
		return () => window.removeEventListener("resize", updateScale);
	}, [hyperframe.width, hyperframe.height]);

	// Send seekFrame message or call direct function when time updates
	useEffect(() => {
		if (!iframeRef.current || !iframeRef.current.contentWindow) return;
		try {
			const win = iframeRef.current.contentWindow as unknown as {
				seekFrame?: (time: number) => void;
			};
			if (typeof win.seekFrame === "function") {
				win.seekFrame(currentTimeSec);
			} else {
				iframeRef.current.contentWindow.postMessage(
					{ type: "SEEK_FRAME", timeSec: currentTimeSec },
					"*",
				);
			}
		} catch {
			// Cross-origin fallback
		}
	}, [currentTimeSec]);

	// Playback animation loop
	useEffect(() => {
		if (!isPlaying) return;
		let animId: number;
		let lastTime = performance.now();

		const step = (now: number) => {
			const deltaSec = (now - lastTime) / 1000;
			lastTime = now;

			setCurrentTimeSec((prev) => {
				const next = prev + deltaSec;
				if (next >= durationSec) {
					setIsPlaying(false);
					return durationSec;
				}
				return next;
			});

			animId = requestAnimationFrame(step);
		};

		animId = requestAnimationFrame(step);
		return () => cancelAnimationFrame(animId);
	}, [isPlaying, durationSec]);

	const togglePlay = () => {
		if (isPlaying) {
			setIsPlaying(false);
		} else {
			if (currentTimeSec >= durationSec) {
				setCurrentTimeSec(0);
			}
			setIsPlaying(true);
		}
	};

	const handleReload = () => {
		if (iframeRef.current) {
			iframeRef.current.srcdoc = hyperframe.htmlContent || "";
			setCurrentTimeSec(0);
		}
	};

	return (
		<div
			className="hyperframe-preview-container flex flex-col h-full w-full bg-slate-950 text-slate-100 rounded-xl overflow-hidden border border-slate-800 shadow-2xl"
			data-testid="hyperframe-preview"
		>
			{/* Header Toolbar */}
			<div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-800">
				<div className="flex items-center gap-2.5">
					<span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
						<Sparkle size={18} weight="bold" />
					</span>
					<div>
						<h3 className="text-sm font-semibold text-white tracking-wide">{hyperframe.name}</h3>
						<span className="text-xs text-slate-400 font-mono">
							{hyperframe.width}x{hyperframe.height} &bull; {durationSec.toFixed(1)}s &bull; HTML5 + GSAP
						</span>
					</div>
				</div>

				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={handleReload}
						className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition"
						title="Reload Frame"
					>
						<ArrowClockwise size={16} />
					</button>
					<button
						type="button"
						onClick={() => setShowCode(!showCode)}
						className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-medium transition ${
							showCode
								? "bg-sky-500 text-slate-950 font-bold"
								: "bg-slate-800 hover:bg-slate-700 text-slate-300"
						}`}
						title="View Source HTML"
					>
						<Code size={14} weight="bold" />
						<span>Code</span>
					</button>
				</div>
			</div>

			{/* Main Preview Stage / Code Split View */}
			<div className="flex-1 relative flex overflow-hidden">
				{/* Viewport Canvas Stage */}
				<div
					ref={containerRef}
					className="flex-1 relative flex items-center justify-center p-6 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] bg-slate-950 overflow-hidden"
				>
					<div
						className="relative shadow-2xl rounded-lg overflow-hidden border border-slate-700/60 bg-transparent transition-transform"
						style={{
							width: `${hyperframe.width}px`,
							height: `${hyperframe.height}px`,
							transform: `scale(${scale})`,
							transformOrigin: "center center",
						}}
					>
						<iframe
							ref={iframeRef}
							title={hyperframe.name}
							sandbox="allow-scripts allow-same-origin"
							srcDoc={hyperframe.htmlContent || ""}
							className="w-full h-full border-none pointer-events-none"
						/>
					</div>
				</div>

				{/* Code Viewer Panel */}
				{showCode && (
					<div className="w-96 border-l border-slate-800 bg-slate-900 flex flex-col text-xs font-mono">
						<div className="px-3 py-2 bg-slate-950 border-b border-slate-800 font-sans text-slate-400 font-semibold flex items-center justify-between">
							<span>Hyperframe HTML Source</span>
							<span className="text-[10px] bg-sky-900/60 text-sky-300 px-1.5 py-0.5 rounded">
								GSAP Driven
							</span>
						</div>
						<div className="flex-1 overflow-auto p-3 text-sky-200/90 whitespace-pre leading-relaxed select-text">
							{hyperframe.htmlContent || "// No inline source loaded"}
						</div>
					</div>
				)}
			</div>

			{/* Playback Controls & Timeline Scrubber */}
			<div className="px-4 py-3 bg-slate-900 border-t border-slate-800 flex items-center gap-4">
				<button
					type="button"
					onClick={togglePlay}
					className="p-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition shadow-md flex items-center justify-center"
					title={isPlaying ? "Pause" : "Play"}
				>
					{isPlaying ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
				</button>

				<span className="text-xs font-mono text-slate-400 w-12 text-right">
					{currentTimeSec.toFixed(2)}s
				</span>

				<input
					type="range"
					min="0"
					max={durationSec}
					step="0.01"
					value={currentTimeSec}
					onChange={(e) => {
						setIsPlaying(false);
						setCurrentTimeSec(Number.parseFloat(e.target.value));
					}}
					className="flex-1 accent-sky-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
				/>

				<span className="text-xs font-mono text-slate-400 w-12">
					{durationSec.toFixed(2)}s
				</span>
			</div>
		</div>
	);
}
