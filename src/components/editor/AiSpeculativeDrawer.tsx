import { Check, CircleNotch, Sparkle, X } from "@phosphor-icons/react";
import { useEffect } from "react";
import type { AgentDiffSummary } from "@/core/timeline/agentPayload";

export interface AiSpeculativeDrawerProps {
	diff: AgentDiffSummary;
	onApplyDraft: () => void;
	onDiscardDraft: () => void;
	isApplying?: boolean;
}

export function AiSpeculativeDrawer({
	diff,
	onApplyDraft,
	onDiscardDraft,
	isApplying = false,
}: AiSpeculativeDrawerProps) {
	// Listen for global Enter / Escape when no text input is focused
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			if (
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA" ||
				target?.isContentEditable
			) {
				return;
			}

			if (e.key === "Enter") {
				e.preventDefault();
				onApplyDraft();
			} else if (e.key === "Escape") {
				e.preventDefault();
				onDiscardDraft();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onApplyDraft, onDiscardDraft]);

	const deltaSec = diff.durationDeltaUs / 1_000_000;
	const formattedDelta = deltaSec > 0 ? `+${deltaSec.toFixed(1)}s` : `${deltaSec.toFixed(1)}s`;

	return (
		<div
			className="fixed bottom-6 right-6 z-50 min-w-[320px] max-w-[420px] bg-neutral-900/95 backdrop-blur-md border border-amber-500/40 rounded-xl shadow-2xl p-4 text-neutral-100 flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-3 duration-200"
			role="region"
			aria-label="AI Speculative Preview Draft"
		>
			{/* Header */}
			<div className="flex items-center justify-between border-b border-neutral-800/80 pb-2">
				<div className="flex items-center gap-2">
					<Sparkle size={16} weight="fill" className="text-amber-400 shrink-0" />
					<span className="font-semibold text-sm tracking-tight text-white">
						AI Speculative Preview
					</span>
				</div>
				<span className="text-[11px] font-medium px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
					Draft
				</span>
			</div>

			{/* Diff metrics */}
			<div className="flex flex-wrap items-center gap-2 text-xs py-1">
				{diff.durationDeltaUs !== 0 && (
					<span className="px-2 py-1 rounded bg-neutral-800 text-neutral-200 border border-neutral-700/60 font-mono">
						{formattedDelta} duration
					</span>
				)}
				{diff.clipsAdded.length > 0 && (
					<span className="px-2 py-1 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
						+{diff.clipsAdded.length} clip{diff.clipsAdded.length > 1 ? "s" : ""}
					</span>
				)}
				{diff.clipsRemoved.length > 0 && (
					<span className="px-2 py-1 rounded bg-red-950/60 text-red-300 border border-red-800/50">
						-{diff.clipsRemoved.length} clip{diff.clipsRemoved.length > 1 ? "s" : ""}
					</span>
				)}
				{diff.clipsModified.length > 0 && (
					<span className="px-2 py-1 rounded bg-blue-950/60 text-blue-300 border border-blue-800/50">
						{diff.clipsModified.length} modified
					</span>
				)}
			</div>

			{/* Action buttons */}
			<div className="flex items-center gap-2 pt-1 border-t border-neutral-800/60">
				<button
					type="button"
					onClick={onApplyDraft}
					disabled={isApplying}
					className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs shadow transition-colors disabled:opacity-50"
				>
					{isApplying ? (
						<CircleNotch size={14} className="animate-spin" />
					) : (
						<Check size={14} weight="bold" />
					)}
					<span>Accept Changes (Enter)</span>
				</button>
				<button
					type="button"
					onClick={onDiscardDraft}
					disabled={isApplying}
					className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-800 text-neutral-300 hover:text-white font-medium text-xs border border-neutral-700/80 transition-colors disabled:opacity-50"
				>
					<X size={14} />
					<span>Discard (Esc)</span>
				</button>
			</div>
		</div>
	);
}
