import {
	ArrowRight,
	CheckCircle,
	CircleNotch,
	Robot,
	Scissors,
	Sparkle,
	WarningCircle,
	X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { AgentDiffSummary } from "@/core/timeline/agentPayload";
import type { AssetTranscript } from "@/core/timeline/transcriptTypes";
import type { TimelineProject } from "@/core/timeline/types";

export interface AIAssistantModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	project: TimelineProject;
	transcripts: Record<string, AssetTranscript>;
	onApplyChanges: (modifiedProject: TimelineProject) => void;
}

interface DetectedAgent {
	id: string;
	name: string;
	command: string;
	description: string;
	available: boolean;
	executablePath?: string;
}

const PRESET_PROMPTS = [
	{
		title: "Cut dead air & long pauses",
		prompt:
			"Analyze speech transcripts and trim out long silent pauses between sentences to create a fast-paced, engaging cut.",
	},
	{
		title: "Make a 60-second reel",
		prompt:
			"Select the most impactful highlights based on the speech transcripts and condense the timeline into an exciting 60-second video.",
	},
	{
		title: "Remove filler words & hesitations",
		prompt:
			"Identify and cut out speech hesitations, filler words, and awkward false starts based on the transcript word timings.",
	},
	{
		title: "Trim to key highlights",
		prompt:
			"Keep only the sections where the main key points are discussed and remove repetitive or tangential discussion.",
	},
];

function formatDuration(us: number): string {
	const totalSec = Math.round(us / 1_000_000);
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export function AIAssistantModal({
	open,
	onOpenChange,
	project,
	transcripts,
	onApplyChanges,
}: AIAssistantModalProps) {
	const [prompt, setPrompt] = useState("");
	const [selectedAgent, setSelectedAgent] = useState("claude");
	const [agents, setAgents] = useState<DetectedAgent[]>([
		{
			id: "claude",
			name: "Claude Code",
			command: "claude",
			description: "Anthropic Claude autonomous coding CLI",
			available: true,
		},
		{
			id: "agy",
			name: "Antigravity",
			command: "agy",
			description: "Google DeepMind Antigravity CLI",
			available: true,
		},
		{
			id: "opencode",
			name: "OpenCode",
			command: "opencode",
			description: "Open-source developer agent",
			available: true,
		},
		{
			id: "codex",
			name: "Codex CLI",
			command: "codex",
			description: "OpenAI Codex CLI tool",
			available: false,
		},
	]);
	const [isRunning, setIsRunning] = useState(false);
	const [logs, setLogs] = useState<string[]>([]);
	const [showConsole, setShowConsole] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [pendingResult, setPendingResult] = useState<{
		project: TimelineProject;
		diff: AgentDiffSummary;
	} | null>(null);

	const consoleEndRef = useRef<HTMLDivElement>(null);

	// Load available agents on open
	useEffect(() => {
		if (!open) return;
		window.electronAPI?.getAvailableAgents?.()
			.then((detected) => {
				if (detected && detected.length > 0) {
					setAgents(detected);
					const firstAvailable = detected.find((a) => a.available);
					if (firstAvailable) {
						setSelectedAgent(firstAvailable.id);
					}
				}
			})
			.catch(() => undefined);
	}, [open]);

	// Listen for live CLI log streaming
	useEffect(() => {
		if (!open) return;
		const unsub = window.electronAPI?.onAgentLogStream?.((chunk) => {
			setLogs((prev) => [...prev, chunk]);
		});
		return () => unsub?.();
	}, [open]);

	// Auto-scroll console
	useEffect(() => {
		if (showConsole) {
			consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [logs, showConsole]);

	// Escape key to close
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isRunning) {
				onOpenChange(false);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, isRunning, onOpenChange]);

	const handleRun = async () => {
		if (!prompt.trim() || !window.electronAPI?.runAgentTask) return;
		setIsRunning(true);
		setError(null);
		setPendingResult(null);
		setLogs([]);
		setShowConsole(true);

		try {
			const res = await window.electronAPI.runAgentTask({
				agentId: selectedAgent,
				userPrompt: prompt.trim(),
				project,
				transcripts,
			});

			if (res.success && res.project && res.diff) {
				setPendingResult({
					project: res.project,
					diff: res.diff,
				});
				setError(null);
			} else {
				setError(res.error || "Agent task failed without producing valid project edits.");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsRunning(false);
		}
	};

	const handleCancel = async () => {
		try {
			await window.electronAPI?.cancelAgentTask?.();
		} catch {}
		setIsRunning(false);
	};

	const handleApply = () => {
		if (!pendingResult) return;
		onApplyChanges(pendingResult.project);
		onOpenChange(false);
	};

	if (!open) return null;

	const currentAgentInfo = agents.find((a) => a.id === selectedAgent);

	return (
		<div
			className="ai-assistant-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="ai-assistant-title"
			onClick={(e) => {
				if (e.target === e.currentTarget && !isRunning) {
					onOpenChange(false);
				}
			}}
		>
			<div className="ai-assistant-dialog">
				{/* Header */}
				<header className="ai-assistant-header">
					<div className="ai-assistant-title-group">
						<div className="ai-assistant-icon-badge">
							<Sparkle size={20} weight="fill" className="text-amber-400" />
						</div>
						<div>
							<h2 id="ai-assistant-title" className="ai-assistant-title">
								AI Editor Assistant
							</h2>
							<p className="ai-assistant-subtitle">
								Autonomous timeline editing via local CLI agents & transcripts
							</p>
						</div>
					</div>
					<button
						type="button"
						className="ai-assistant-close"
						aria-label="Close dialog"
						disabled={isRunning}
						onClick={() => onOpenChange(false)}
					>
						<X size={18} />
					</button>
				</header>

				{/* Agent Selection */}
				<div className="ai-assistant-section">
					<label className="ai-assistant-label">Choose AI CLI Agent</label>
					<div className="ai-assistant-agent-grid">
						{agents.map((ag) => (
							<button
								key={ag.id}
								type="button"
								className={`ai-assistant-agent-card ${selectedAgent === ag.id ? "selected" : ""} ${!ag.available ? "unavailable" : ""}`}
								onClick={() => setSelectedAgent(ag.id)}
							>
								<div className="ai-assistant-agent-card-header">
									<Robot size={15} weight="bold" />
									<span className="font-semibold text-sm">{ag.name}</span>
									<span
										className={`ai-assistant-agent-dot ${ag.available ? "online" : "offline"}`}
										title={ag.available ? "Installed in PATH" : "Not detected in PATH"}
									/>
								</div>
								<p className="ai-assistant-agent-desc">{ag.description}</p>
							</button>
						))}
					</div>
					{currentAgentInfo && !currentAgentInfo.available && (
						<p className="ai-assistant-warning">
							<WarningCircle size={14} className="shrink-0" />
							<span>
								"{currentAgentInfo.command}" is not found in your system PATH. Make sure it is
								installed or pick an available agent.
							</span>
						</p>
					)}
				</div>

				{/* Preset Prompts */}
				<div className="ai-assistant-section">
					<label className="ai-assistant-label">Editing Recipes & Presets</label>
					<div className="ai-assistant-presets">
						{PRESET_PROMPTS.map((preset) => (
							<button
								key={preset.title}
								type="button"
								className="ai-assistant-preset-chip"
								onClick={() => setPrompt(preset.prompt)}
							>
								<Scissors size={13} weight="bold" />
								<span>{preset.title}</span>
							</button>
						))}
					</div>
				</div>

				{/* Prompt Textarea */}
				<div className="ai-assistant-section">
					<label className="ai-assistant-label">Instruction Prompt</label>
					<textarea
						className="ai-assistant-textarea"
						rows={3}
						placeholder="Describe how the AI should edit your video (e.g., 'Trim out silent parts, keep the demonstration of feature X, and arrange the flow chronologically')..."
						value={prompt}
						onChange={(e) => setPrompt(e.target.value)}
						disabled={isRunning}
					/>
				</div>

				{/* Review / Diff Card */}
				{pendingResult && (
					<div className="ai-assistant-diff-card">
						<div className="ai-assistant-diff-header">
							<CheckCircle size={18} weight="fill" className="text-emerald-400" />
							<span className="font-semibold text-emerald-300">
								Agent Edits Ready for Review
							</span>
						</div>
						<div className="ai-assistant-diff-grid">
							<div className="ai-assistant-diff-stat">
								<span className="text-zinc-400 text-xs">Clips Count</span>
								<span className="font-medium">
									{pendingResult.diff.clipsBefore} → {pendingResult.diff.clipsAfter}
								</span>
							</div>
							<div className="ai-assistant-diff-stat">
								<span className="text-zinc-400 text-xs">Project Duration</span>
								<span className="font-medium">
									{formatDuration(pendingResult.diff.durationBeforeUs)} →{" "}
									{formatDuration(pendingResult.diff.durationAfterUs)} (
									{pendingResult.diff.durationDeltaUs >= 0 ? "+" : ""}
									{(pendingResult.diff.durationDeltaUs / 1_000_000).toFixed(1)}s)
								</span>
							</div>
							<div className="ai-assistant-diff-stat">
								<span className="text-zinc-400 text-xs">Modified Clips</span>
								<span className="font-medium">
									{pendingResult.diff.clipsModified.length} trimmed,{" "}
									{pendingResult.diff.clipsRemoved.length} deleted
								</span>
							</div>
						</div>
					</div>
				)}

				{/* Error Box */}
				{error && (
					<div className="ai-assistant-error-banner">
						<WarningCircle size={18} className="shrink-0" />
						<div>
							<p className="font-semibold text-xs">Agent Error</p>
							<p className="text-xs text-rose-300">{error}</p>
						</div>
					</div>
				)}

				{/* Terminal Output Console */}
				{(showConsole || isRunning) && (
					<div className="ai-assistant-console-box">
						<div
							className="ai-assistant-console-header"
							onClick={() => setShowConsole((v) => !v)}
						>
							<div className="flex items-center gap-2">
								<span className="font-mono text-xs text-zinc-300">Terminal Log</span>
								{isRunning && (
									<CircleNotch size={12} className="animate-spin text-amber-400" />
								)}
							</div>
							<span className="text-xs text-zinc-400">
								{showConsole ? "Hide" : "Show"} ({logs.length} lines)
							</span>
						</div>
						{showConsole && (
							<div className="ai-assistant-console-content">
								{logs.length === 0 ? (
									<span className="text-zinc-500 italic">Starting CLI process…</span>
								) : (
									logs.map((line, idx) => <div key={idx}>{line}</div>)
								)}
								<div ref={consoleEndRef} />
							</div>
						)}
					</div>
				)}

				{/* Actions Footer */}
				<footer className="ai-assistant-footer">
					{isRunning ? (
						<button
							type="button"
							className="ai-assistant-btn-cancel"
							onClick={() => void handleCancel()}
						>
							Cancel Running Task
						</button>
					) : pendingResult ? (
						<div className="flex items-center justify-between w-full">
							<button
								type="button"
								className="ai-assistant-btn-secondary"
								onClick={() => setPendingResult(null)}
							>
								Discard / Edit Again
							</button>
							<button
								type="button"
								className="ai-assistant-btn-apply"
								onClick={handleApply}
							>
								<CheckCircle size={16} weight="bold" />
								<span>Apply to Timeline</span>
							</button>
						</div>
					) : (
						<div className="flex items-center justify-end gap-3 w-full">
							<button
								type="button"
								className="ai-assistant-btn-secondary"
								onClick={() => onOpenChange(false)}
							>
								Cancel
							</button>
							<button
								type="button"
								className="ai-assistant-btn-primary"
								disabled={!prompt.trim()}
								onClick={() => void handleRun()}
							>
								<Sparkle size={15} weight="bold" />
								<span>Run AI Agent</span>
								<ArrowRight size={14} />
							</button>
						</div>
					)}
				</footer>
			</div>
		</div>
	);
}
