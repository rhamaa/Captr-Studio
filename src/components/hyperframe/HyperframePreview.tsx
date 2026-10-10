import {
	ArrowClockwise,
	Code,
	Pause,
	Play,
	Sparkle,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HyperframeComposition } from "@/core/story/storyTypes";
import { preprocessHyperframeHtml } from "./HyperframeEditor";

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

	const processedHtml = useMemo(() => {
		return preprocessHyperframeHtml(hyperframe.htmlContent || "");
	}, [hyperframe.htmlContent]);

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
				seekFrame?: (time: number, isPlaying?: boolean) => void;
			};
			if (typeof win.seekFrame === "function") {
				win.seekFrame(currentTimeSec, isPlaying);
			} else {
				iframeRef.current.contentWindow.postMessage(
					{ type: "SEEK_FRAME", timeSec: currentTimeSec, isPlaying },
					"*",
				);
			}
		} catch {
			// Cross-origin fallback
		}
	}, [currentTimeSec, isPlaying]);

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
			iframeRef.current.srcdoc = processedHtml;
			setCurrentTimeSec(0);
		}
	};

	return (
		<div
			className="hyperframe-preview-container flex flex-col h-full w-full bg-[#15171C] text-[#F5F6F8] rounded-xl overflow-hidden border border-[#343A46] shadow-xl"
			data-testid="hyperframe-preview"
		>
			{/* Header Toolbar */}
			<div className="flex items-center justify-between px-4 py-2.5 bg-[#1C1F26] border-b border-[#343A46]">
				<div className="flex items-center gap-2.5">
					<span className="p-1.5 rounded-lg bg-[#6FA8FF]/15 text-[#6FA8FF] border border-[#6FA8FF]/25">
						<Sparkle size={17} weight="bold" />
					</span>
					<div>
						<h3 className="text-sm font-semibold text-white tracking-wide">{hyperframe.name}</h3>
						<span className="text-xs text-[#A8AFBD] font-mono">
							{hyperframe.width}x{hyperframe.height} &bull; {durationSec.toFixed(1)}s &bull; HTML5 + GSAP
						</span>
					</div>
				</div>

				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={handleReload}
						className="p-1.5 rounded-md hover:bg-white/10 text-[#A8AFBD] hover:text-white transition"
						title="Reload Frame"
					>
						<ArrowClockwise size={16} />
					</button>
					<button
						type="button"
						onClick={() => setShowCode(!showCode)}
						className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-medium transition ${
							showCode
								? "bg-[#6FA8FF] text-[#15171C] font-semibold"
								: "bg-white/10 hover:bg-white/15 text-[#F5F6F8]"
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
					className="flex-1 relative flex items-center justify-center p-6 bg-[#111214] overflow-hidden"
				>
					<div
						className="relative shadow-2xl rounded-lg overflow-hidden border border-white/10 bg-transparent transition-transform"
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
							srcDoc={processedHtml}
							className="w-full h-full border-none pointer-events-none"
						/>
					</div>
				</div>

				{/* Code Viewer Panel */}
				{showCode && (
					<div className="w-96 border-l border-[#343A46] bg-[#1C1F26] flex flex-col text-xs font-mono">
						<div className="px-3 py-2 bg-[#15171C] border-b border-[#343A46] font-sans text-[#A8AFBD] font-semibold flex items-center justify-between">
							<span>Hyperframe HTML Source</span>
							<span className="text-[10px] bg-[#A879F5]/20 text-[#c5a7fb] px-1.5 py-0.5 rounded font-mono font-medium">
								GSAP Driven
							</span>
						</div>
						<div className="flex-1 overflow-auto p-3 text-slate-300 whitespace-pre leading-relaxed select-text">
							{hyperframe.htmlContent || "// No inline source loaded"}
						</div>
					</div>
				)}
			</div>

			{/* Playback Controls & Timeline Scrubber */}
			<div className="px-4 py-3 bg-[#1C1F26] border-t border-[#343A46] flex items-center gap-4">
				<button
					type="button"
					onClick={togglePlay}
					className="p-2 rounded-lg bg-[#6FA8FF] hover:bg-[#85b7ff] text-[#15171C] font-semibold transition shadow flex items-center justify-center"
					title={isPlaying ? "Pause" : "Play"}
				>
					{isPlaying ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
				</button>

				<span className="text-xs font-mono text-[#A8AFBD] w-12 text-right">
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
					className="flex-1 accent-[#6FA8FF] h-1.5 bg-[#242832] rounded-lg cursor-pointer"
				/>

				<span className="text-xs font-mono text-[#A8AFBD] w-12">
					{durationSec.toFixed(2)}s
				</span>
			</div>
		</div>
	);
}
