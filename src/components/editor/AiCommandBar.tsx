import {
	ArrowRight,
	CircleNotch,
	Lightning,
	MagnifyingGlass,
	Sparkle,
	X,
} from "@phosphor-icons/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatSurfaceBadge, getAcceleratorsForSurface } from "@/core/timeline/aiAccelerators";
import type { ActiveSurface, ContextualAccelerator } from "@/core/timeline/aiTypes";

export interface AiCommandBarProps {
	open: boolean;
	onClose: () => void;
	activeSurface: ActiveSurface;
	onExecuteAction?: (toolName: string, actionId?: string) => void;
	onSubmitPrompt?: (prompt: string) => void;
	isProcessing?: boolean;
	error?: string | null;
}

export function AiCommandBar({
	open,
	onClose,
	activeSurface,
	onExecuteAction,
	onSubmitPrompt,
	isProcessing = false,
	error = null,
}: AiCommandBarProps) {
	const [prompt, setPrompt] = useState("");
	const [selectedPillIndex, setSelectedPillIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement>(null);

	const pills = useMemo<ContextualAccelerator[]>(
		() => getAcceleratorsForSurface(activeSurface),
		[activeSurface],
	);

	const surfaceBadge = useMemo(
		() => formatSurfaceBadge(activeSurface),
		[activeSurface],
	);

	// Reset state when opening
	useEffect(() => {
		if (open) {
			setPrompt("");
			setSelectedPillIndex(-1);
			setTimeout(() => {
				inputRef.current?.focus();
			}, 20);
		}
	}, [open]);

	const handleExecutePill = useCallback(
		(pill: ContextualAccelerator) => {
			onExecuteAction?.(pill.toolName, pill.id);
		},
		[onExecuteAction],
	);

	const handleSubmit = useCallback(() => {
		if (selectedPillIndex >= 0 && selectedPillIndex < pills.length) {
			handleExecutePill(pills[selectedPillIndex]);
			return;
		}
		if (prompt.trim()) {
			onSubmitPrompt?.(prompt.trim());
		}
	}, [selectedPillIndex, pills, handleExecutePill, prompt, onSubmitPrompt]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
				return;
			}

			if (e.key === "ArrowDown") {
				e.preventDefault();
				if (pills.length === 0) return;
				setSelectedPillIndex((prev) => (prev + 1 >= pills.length ? 0 : prev + 1));
				return;
			}

			if (e.key === "ArrowUp") {
				e.preventDefault();
				if (pills.length === 0) return;
				setSelectedPillIndex((prev) => (prev <= 0 ? pills.length - 1 : prev - 1));
				return;
			}

			if (e.key === "Tab") {
				e.preventDefault();
				if (pills.length === 0) return;
				if (e.shiftKey) {
					setSelectedPillIndex((prev) => (prev <= 0 ? pills.length - 1 : prev - 1));
				} else {
					setSelectedPillIndex((prev) => (prev + 1 >= pills.length ? 0 : prev + 1));
				}
				return;
			}

			if (e.key === "Enter") {
				e.preventDefault();
				handleSubmit();
			}
		},
		[pills, onClose, handleSubmit],
	);

	// Global key listener for Escape when focused outside input
	useEffect(() => {
		if (!open) return;
		const handleGlobalKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		};
		window.addEventListener("keydown", handleGlobalKeyDown);
		return () => window.removeEventListener("keydown", handleGlobalKeyDown);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-100"
			onClick={(e) => {
				if (e.target === e.currentTarget) {
					onClose();
				}
			}}
			role="dialog"
			aria-modal="true"
			aria-label="AI Command Bar"
		>
			<div className="relative w-full max-w-2xl bg-neutral-900/95 backdrop-blur-md border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-neutral-100 animate-in fade-in zoom-in-95 duration-150">
				{/* Top surface badge and header */}
				<div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-neutral-800/80">
					<div className="flex items-center gap-2">
						<Sparkle size={16} weight="fill" className="text-amber-400 shrink-0" />
						<span
							className="text-xs font-medium px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700/60"
							data-testid="surface-badge"
						>
							{surfaceBadge}
						</span>
					</div>
					<div className="flex items-center gap-2">
						<kbd className="text-[11px] text-neutral-400 bg-neutral-800/80 px-1.5 py-0.5 rounded border border-neutral-700/60">
							Esc to close
						</kbd>
						<button
							type="button"
							onClick={onClose}
							className="p-1 text-neutral-400 hover:text-neutral-200 rounded transition-colors"
							aria-label="Close Command Bar"
						>
							<X size={15} />
						</button>
					</div>
				</div>

				{/* Input row */}
				<div className="flex items-center gap-3 px-4 py-3">
					<MagnifyingGlass size={20} className="text-neutral-400 shrink-0" />
					<input
						ref={inputRef}
						type="text"
						value={prompt}
						onChange={(e) => {
							setPrompt(e.target.value);
							setSelectedPillIndex(-1);
						}}
						onKeyDown={handleKeyDown}
						placeholder="Type an edit command or select a quick action..."
						className="w-full bg-transparent border-0 outline-none text-base text-neutral-100 placeholder:text-neutral-500"
						disabled={isProcessing}
					/>
					{isProcessing ? (
						<CircleNotch size={18} className="animate-spin text-amber-400 shrink-0" />
					) : (
						<button
							type="button"
							onClick={handleSubmit}
							disabled={!prompt.trim() && selectedPillIndex === -1}
							className="p-1 rounded text-neutral-400 hover:text-neutral-200 disabled:opacity-30 transition-colors"
							title="Execute"
						>
							<ArrowRight size={18} />
						</button>
					)}
				</div>

				{/* Prompt suggestions when input is empty */}
				{!prompt && !isProcessing && (
					<div className="px-4 pb-2.5 flex items-center gap-1.5 flex-wrap">
						<span className="text-[10px] text-neutral-500 font-medium mr-1">Suggestions:</span>
						{[
							"✨ Cyberpunk Neon",
							"🎨 Minimalist Dark",
							"🪟 macOS Glass",
							"✂️ Cut Silence & Pauses",
							"🔍 Auto-Zoom to Clicks",
						].map((sug) => (
							<button
								key={sug}
								type="button"
								onClick={() => {
									const cleaned = sug.replace(/^[^\w\s]+\s*/, "");
									setPrompt(cleaned);
									inputRef.current?.focus();
								}}
								className="text-[11px] px-2 py-0.5 rounded-full bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white border border-neutral-700/50 transition-colors"
							>
								{sug}
							</button>
						))}
					</div>
				)}

				{/* Error feedback if any */}
				{error && (
					<div className="px-4 py-1.5 bg-red-950/50 border-t border-red-900/50 text-red-300 text-xs flex items-center justify-between">
						<span>{error}</span>
					</div>
				)}

				{/* Contextual Action Pills */}
				{pills.length > 0 && (
					<div className="px-4 pb-3 pt-2 border-t border-neutral-800/60 bg-neutral-950/40">
						<div className="text-[11px] font-medium text-neutral-400 mb-2 flex items-center justify-between">
							<span>Contextual Actions</span>
							<span className="text-[10px] text-neutral-500">↑↓ to navigate • Enter to run</span>
						</div>
						<div className="flex flex-wrap gap-2">
							{pills.map((pill, idx) => {
								const isSelected = idx === selectedPillIndex;
								return (
									<button
										key={pill.id}
										type="button"
										onClick={() => handleExecutePill(pill)}
										className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border ${
											isSelected
												? "bg-amber-500/20 text-amber-300 border-amber-500/50 ring-1 ring-amber-500/30"
												: "bg-neutral-800/80 text-neutral-300 border-neutral-700/60 hover:bg-neutral-700 hover:text-white"
										}`}
										aria-selected={isSelected}
										title={pill.description}
									>
										<Lightning
											size={13}
											weight="fill"
											className={isSelected ? "text-amber-400" : "text-neutral-400"}
										/>
										<span>{pill.label}</span>
									</button>
								);
							})}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
