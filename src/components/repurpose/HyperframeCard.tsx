import {
	Code,
	Copy,
	DotsSixVertical,
	Pause,
	PencilSimple,
	Play,
	Trash,
} from "@phosphor-icons/react";
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import type { HyperframeComposition } from "@/core/story/storyTypes";
import { formatMs } from "@/components/video-editor/timeline/items/itemUtils";

export interface HyperframeCardProps {
	hyperframe: HyperframeComposition;
	activePlayingId?: string | null;
	displayHeight?: number;
	onPlayingChange?: (isPlaying: boolean) => void;
	onOpenEditor?: (hyperframeId: string) => void;
	onRemove?: (hyperframeId: string) => void;
	onDuplicate?: (hyperframeId: string) => void;
	onRename?: (hyperframeId: string, newName: string) => void;
	onStartDragCard?: (e: ReactMouseEvent) => void;
}

export function HyperframeCard({
	hyperframe,
	activePlayingId,
	displayHeight = 360,
	onPlayingChange,
	onOpenEditor,
	onRemove,
	onDuplicate,
	onRename,
	onStartDragCard,
}: HyperframeCardProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const isPlaying = activePlayingId === hyperframe.id;
	const [isEditingName, setIsEditingName] = useState(false);
	const [nameInput, setNameInput] = useState(hyperframe.name);

	const aspectRatioStr = useMemo(() => {
		if (hyperframe.aspectRatio) return hyperframe.aspectRatio;
		if (hyperframe.width && hyperframe.height) {
			const ratio = hyperframe.width / hyperframe.height;
			if (Math.abs(ratio - 16 / 9) < 0.05) return "16:9";
			if (Math.abs(ratio - 9 / 16) < 0.05) return "9:16";
			if (Math.abs(ratio - 1) < 0.05) return "1:1";
			if (Math.abs(ratio - 4 / 5) < 0.05) return "4:5";
		}
		return "16:9";
	}, [hyperframe.aspectRatio, hyperframe.width, hyperframe.height]);

	const displayWidth = useMemo(() => {
		const ratio = (hyperframe.width || 1920) / (hyperframe.height || 1080);
		return Math.round(displayHeight * ratio);
	}, [hyperframe.width, hyperframe.height, displayHeight]);

	const scaleFactor = useMemo(() => {
		return displayHeight / (hyperframe.height || 1080);
	}, [hyperframe.height, displayHeight]);

	const handleSaveName = () => {
		setIsEditingName(false);
		const trimmed = nameInput.trim();
		if (trimmed && trimmed !== hyperframe.name) {
			onRename?.(hyperframe.id, trimmed);
		} else {
			setNameInput(hyperframe.name);
		}
	};

	const togglePlay = (e: ReactMouseEvent) => {
		e.stopPropagation();
		onPlayingChange?.(!isPlaying);
	};

	// Post play/pause messages to iframe
	useEffect(() => {
		if (!iframeRef.current?.contentWindow) return;
		try {
			iframeRef.current.contentWindow.postMessage(
				{ type: isPlaying ? "PLAY" : "PAUSE" },
				"*",
			);
		} catch {}
	}, [isPlaying]);

	const durationMs = Math.round((hyperframe.durationUs || 5_000_000) / 1000);

	return (
		<div
			className="repurpose-artboard-card repurpose-hyperframe-card relative rounded-2xl bg-[#161820] border border-[#2B2F3D] hover:border-[#6FA8FF]/40 shadow-xl overflow-hidden flex flex-col transition group select-none w-full h-full"
			style={{ width: displayWidth, minHeight: displayHeight + 42 }}
			data-hyperframe-id={hyperframe.id}
			onDoubleClick={() => onOpenEditor?.(hyperframe.id)}
		>
			{/* Card Header */}
			<div
				className="repurpose-card-header p-2.5 px-3 bg-[#1C1F29]/95 border-b border-[#2B2F3D] flex items-center justify-between gap-2 shrink-0 cursor-move"
				onMouseDown={(e) => {
					if ((e.target as HTMLElement).closest("button,input")) return;
					onStartDragCard?.(e);
				}}
				title="Drag header to move card · Double-click to edit Code & AI"
			>
				<div className="flex items-center gap-2 min-w-0 flex-1">
					{onStartDragCard && (
						<span className="text-[#6D7284] group-hover:text-[#A6ABB9] transition shrink-0 cursor-grab">
							<DotsSixVertical size={14} weight="bold" />
						</span>
					)}
					<span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold font-mono bg-[#A879F5]/20 border border-[#A879F5]/35 text-[#d8bfff] shrink-0">
						HYPERFRAME
					</span>
					<span className="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-medium bg-[#111215] border border-[#2B2F3D] text-[#8E93A5] shrink-0">
						{aspectRatioStr}
					</span>

					{isEditingName ? (
						<input
							type="text"
							value={nameInput}
							autoFocus
							onChange={(e) => setNameInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSaveName();
								if (e.key === "Escape") {
									setIsEditingName(false);
									setNameInput(hyperframe.name);
								}
							}}
							onBlur={handleSaveName}
							onClick={(e) => e.stopPropagation()}
							className="px-1.5 py-0.5 rounded bg-[#111215] border border-[#6FA8FF] text-xs font-semibold text-white focus:outline-none min-w-0 flex-1"
						/>
					) : (
						<span
							className="text-xs font-semibold text-white truncate cursor-text min-w-0"
							onDoubleClick={(e) => {
								e.stopPropagation();
								setIsEditingName(true);
							}}
							title="Double-click to rename"
						>
							{hyperframe.name}
						</span>
					)}
				</div>

				{/* Header Actions */}
				<div className="flex items-center gap-1 shrink-0">
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							setIsEditingName(true);
						}}
						title="Rename Hyperframe"
						className="p-1 rounded hover:bg-[#252834] text-[#8E93A5] hover:text-white transition"
					>
						<PencilSimple size={13} />
					</button>

					{onDuplicate && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onDuplicate(hyperframe.id);
							}}
							title="Duplicate Hyperframe"
							className="p-1 rounded hover:bg-[#252834] text-[#8E93A5] hover:text-white transition"
						>
							<Copy size={13} />
						</button>
					)}

					{onRemove && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onRemove(hyperframe.id);
							}}
							title="Delete Hyperframe"
							className="p-1 rounded hover:bg-[#FF6B81]/20 text-[#8E93A5] hover:text-[#FF6B81] transition"
						>
							<Trash size={13} />
						</button>
					)}
				</div>
			</div>

			{/* Sandboxed Live HTML Iframe Preview Stage */}
			<div
				className="relative bg-[#0F1014] overflow-hidden flex items-center justify-center w-full shrink-0"
				style={{ width: displayWidth, height: displayHeight, minHeight: displayHeight }}
			>
				<iframe
					ref={iframeRef}
					title={hyperframe.name}
					srcDoc={hyperframe.htmlContent || "<html><body></body></html>"}
					sandbox="allow-scripts allow-same-origin"
					className="pointer-events-none absolute origin-top-left border-0"
					style={{
						width: hyperframe.width || 1920,
						height: hyperframe.height || 1080,
						transform: `scale(${scaleFactor})`,
						transformOrigin: "top left",
					}}
				/>

				{/* Hover overlay with Open Editor & Playback action */}
				<div className="absolute inset-0 bg-gradient-to-t from-[#111215]/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3 pointer-events-auto">
					<div className="flex items-center justify-between gap-2">
						<button
							type="button"
							onClick={togglePlay}
							className="p-2 rounded-xl bg-[#1D202A]/90 hover:bg-[#262A38] text-white border border-[#343848] transition shadow-md flex items-center gap-1.5 text-xs font-semibold"
						>
							{isPlaying ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
							<span>{isPlaying ? "Pause" : "Play"}</span>
						</button>

						<button
							type="button"
							onClick={() => onOpenEditor?.(hyperframe.id)}
							className="px-3 py-1.5 rounded-xl bg-[#6FA8FF] hover:bg-[#85b7ff] text-[#111215] font-semibold text-xs transition shadow-md flex items-center gap-1.5"
						>
							<Code size={14} weight="bold" />
							<span>Open Code & Agent</span>
						</button>
					</div>
				</div>

				{/* Bottom Right Duration Pill */}
				<div className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#111215]/80 border border-white/10 text-[#6FA8FF] backdrop-blur-sm pointer-events-none">
					{formatMs(durationMs)}
				</div>
			</div>
		</div>
	);
}
