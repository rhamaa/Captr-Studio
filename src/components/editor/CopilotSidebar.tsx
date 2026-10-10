import {
	ArrowRight,
	Check,
	CheckCircle,
	CircleNotch,
	Copy,
	GitBranch,
	Play,
	Scissors,
	Sparkle,
	Terminal,
	WarningCircle,
	X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { AgentDiffSummary } from "@/core/timeline/agentPayload";
import { resolveClipSource } from "@/core/timeline/clipSource";
import type { StoryEditContext } from "@/core/timeline/storyOwnership";
import type { AssetTranscript } from "@/core/timeline/transcriptTypes";
import type { TimelineProject } from "@/core/timeline/types";

export interface EditPlan {
	summary: string;
	steps: string[];
	estimatedDurationSec?: number;
	createdAt: string;
}

export interface CopilotSidebarProps {
	editContext?: StoryEditContext;
	project: TimelineProject;
	transcripts: Record<string, AssetTranscript>;
	playheadUs: number;
	selection: string[];
	activeArtboardId: string | null;
	speculativeDraft: {
		project: TimelineProject;
		diff: AgentDiffSummary;
		context: StoryEditContext;
	} | null;
	editPlan: EditPlan | null;
	onClose: () => void;
	onApplyDraft: (draftProject: TimelineProject) => void;
	onDiscardDraft: () => void;
	onDraftReady?: (draft: {
		project: TimelineProject;
		diff: AgentDiffSummary;
		context: StoryEditContext;
	}) => void;
	onSeekTo?: (timeUs: number) => void;
}

interface DetectedAgent {
	id: string;
	name: string;
	command: string;
	description: string;
	available: boolean;
	executablePath?: string;
}

const PRESET_RECIPES = [
	{
		title: "Cut dead air & long pauses",
		prompt: "Analyze speech transcripts and trim out long silent pauses between sentences to create a fast-paced, engaging cut.",
	},
	{
		title: "Make a 60-second reel",
		prompt: "Select the most impactful highlights based on the speech transcripts and condense the timeline into an exciting 60-second video.",
	},
	{
		title: "Remove filler words & hesitations",
		prompt: "Identify and cut out speech hesitations, filler words, and awkward false starts based on the transcript word timings.",
	},
	{
		title: "A-Roll speech + Hyperframe B-Roll",
		prompt: "Keep the main spoken dialogue as A-Roll, cut out dead air, and generate visual Hyperframe B-Roll motion graphics for the main highlight points.",
	},
	{
		title: "Trim to key highlights",
		prompt: "Keep only the sections where the main key points are discussed and remove repetitive or tangential discussion.",
	},
];

function formatTime(us: number): string {
	const totalSec = Math.floor(us / 1_000_000);
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	const tenths = Math.floor((us % 1_000_000) / 100_000);
	return `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;
}

export function CopilotSidebar({
	project,
	transcripts,
	playheadUs,
	selection,
	activeArtboardId,
	speculativeDraft,
	editPlan,
	onClose,
	onApplyDraft,
	onDiscardDraft,
	onDraftReady,
	editContext,
	onSeekTo,
}: CopilotSidebarProps) {
	const [activeTab, setActiveTab] = useState<"chat" | "mcp">("chat");
	const [prompt, setPrompt] = useState("");
	const [selectedAgent, setSelectedAgent] = useState("agy");
	const [agents, setAgents] = useState<DetectedAgent[]>([
		{
			id: "agy",
			name: "Antigravity (agy)",
			command: "agy",
			description: "Google DeepMind Antigravity CLI",
			available: true,
		},
		{
			id: "claude",
			name: "Claude Code",
			command: "claude",
			description: "Anthropic Claude autonomous coding CLI",
			available: true,
		},
		{
			id: "opencode",
			name: "OpenCode",
			command: "opencode",
			description: "Open-source developer agent",
			available: true,
		},
	]);
	const [isRunning, setIsRunning] = useState(false);
	const [logs, setLogs] = useState<string[]>([]);
	const [showConsole, setShowConsole] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [mcpInfo, setMcpInfo] = useState<{
		running: boolean;
		port: number;
		sseUrl: string;
		mcpConfig: Record<string, unknown>;
	} | null>(null);
	const [copiedConfig, setCopiedConfig] = useState(false);

	const consoleEndRef = useRef<HTMLDivElement>(null);

	// Load available agents & MCP info
	useEffect(() => {
		window.electronAPI
			?.getAvailableAgents?.()
			.then((detected) => {
				if (detected && detected.length > 0) {
					setAgents(detected);
					const agy = detected.find((a) => a.id === "agy" && a.available);
					const first = agy || detected.find((a) => a.available);
					if (first) setSelectedAgent(first.id);
				}
			})
			.catch(() => undefined);

		window.electronAPI
			?.getMcpServerInfo?.()
			.then((info) => {
				if (info) setMcpInfo(info);
			})
			.catch(() => undefined);
	}, []);

	// Live log streaming
	useEffect(() => {
		const unsub = window.electronAPI?.onAgentLogStream?.((chunk) => {
			setLogs((prev) => [...prev, chunk]);
		});
		return () => unsub?.();
	}, []);

	// Auto-scroll console
	useEffect(() => {
		if (showConsole) {
			consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
	}, [logs, showConsole]);

	const handleRun = async () => {
		if (!prompt.trim() || !window.electronAPI?.runAgentTask || !editContext) return;
		const capturedContext = structuredClone(editContext);
		setIsRunning(true);
		setError(null);
		setLogs([]);
		setShowConsole(true);

		try {
			const res = await window.electronAPI.runAgentTask({
				agentId: selectedAgent,
				userPrompt: prompt.trim(),
				project,
				transcripts,
				editContext: capturedContext,
			});

			if (res.success && res.project) {
				setError(null);
				if (res.diff) {
					onDraftReady?.({
						project: res.project,
						diff: res.diff,
						context: res.context ?? capturedContext,
					});
				}
			} else {
				setError(res.error || "Agent completed without producing valid project edits.");
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

	const copyMcpConfig = () => {
		if (!mcpInfo) return;
		const text = JSON.stringify(mcpInfo.mcpConfig, null, 2);
		navigator.clipboard.writeText(text);
		setCopiedConfig(true);
		setTimeout(() => setCopiedConfig(false), 2000);
	};

	const selectedClips = project.tracks
		.flatMap((t) => t.clips)
		.filter((c) => selection.includes(c.id));

	const appendTag = (tag: string) => {
		setPrompt((prev) => (prev ? `${prev.trim()} ${tag} ` : `${tag} `));
	};

	return (
		<aside className="copilot-sidebar-dock" aria-label="Captr Copilot AI Assistant">
			{/* Top Header */}
			<header className="copilot-header">
				<div className="flex items-center gap-2">
					<div className="copilot-icon-badge">
						<Sparkle size={17} weight="fill" className="text-amber-400" />
					</div>
					<div>
						<h2 className="copilot-title">Captr Copilot</h2>
						<p className="copilot-subtitle">Autonomous Editor & MCP Bridge</p>
					</div>
				</div>
				<div className="flex items-center gap-1.5">
					<button
						type="button"
						className={`copilot-tab-btn ${activeTab === "chat" ? "active" : ""}`}
						onClick={() => setActiveTab("chat")}
						title="Integrated AI Assistant Chat"
					>
						Chat
					</button>
					<button
						type="button"
						className={`copilot-tab-btn ${activeTab === "mcp" ? "active" : ""}`}
						onClick={() => setActiveTab("mcp")}
						title="External MCP Server Connection"
					>
						MCP
					</button>
					<button
						type="button"
						className="copilot-close-btn"
						aria-label="Close Copilot Sidebar"
						onClick={onClose}
					>
						<X size={15} />
					</button>
				</div>
			</header>

			{/* Context Ribbon (Playhead, Selection, Artboard pills) */}
			<div className="copilot-context-ribbon">
				<button
					type="button"
					className="copilot-pill"
					title="Click to tag current playhead timestamp"
					onClick={() => {
						appendTag(`@Playhead:${formatTime(playheadUs)}`);
						onSeekTo?.(playheadUs);
					}}
				>
					<Play size={10} weight="fill" className="text-emerald-400" />
					<span>{formatTime(playheadUs)}</span>
				</button>

				{selectedClips.length > 0 && (
					<button
						type="button"
						className="copilot-pill selected"
						title={`Tag ${selectedClips.length} selected clip(s)`}
						onClick={() =>
							appendTag(
								selectedClips
									.map((c) => {
										return `@Clip:${resolveClipSource(project, c).name || c.id}`;
									})
									.join(" "),
							)
						}
					>
						<span>
							{selectedClips.length} {selectedClips.length === 1 ? "Clip" : "Clips"}
						</span>
					</button>
				)}

				{activeArtboardId && (
					<button
						type="button"
						className="copilot-pill artboard"
						title="Click to tag active artboard"
						onClick={() => appendTag(`@Artboard:${activeArtboardId}`)}
					>
						<span>@Artboard</span>
					</button>
				)}

				{/* Quick mention tags */}
				<div className="flex items-center gap-1 ml-auto text-[10px]">
					<button
						type="button"
						className="copilot-tag-chip"
						title="Tag Whiteboard"
						onClick={() => appendTag("@Whiteboard")}
					>
						@Whiteboard
					</button>
				</div>
			</div>

			{/* Main Content Body */}
			<div className="copilot-body">
				{activeTab === "mcp" ? (
					/* External MCP Connection Panel */
					<div className="copilot-mcp-panel">
						<div className="copilot-mcp-status-card">
							<div className="flex items-center justify-between mb-2">
								<div className="flex items-center gap-2">
									<span
										className={`w-2.5 h-2.5 rounded-full ${
											mcpInfo?.running
												? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
												: "bg-rose-400"
										}`}
									/>
									<span className="font-semibold text-xs text-white">
										{mcpInfo?.running
											? "Local MCP Server Online"
											: "Starting Server..."}
									</span>
								</div>
								{mcpInfo && (
									<span className="font-mono text-[11px] text-zinc-400">
										Port {mcpInfo.port}
									</span>
								)}
							</div>
							<p className="text-[11px] text-zinc-300 leading-relaxed mb-3">
								External agents running in your terminal (Claude Code, Antigravity,
								Cursor) can connect directly to this live Captr Studio session via
								MCP.
							</p>

							{mcpInfo && (
								<div className="space-y-2">
									<div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
										SSE Endpoint
									</div>
									<div className="copilot-code-snippet">
										<span>{mcpInfo.sseUrl}</span>
									</div>

									<div className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider mt-3">
										Terminal Connect Command
									</div>
									<div className="copilot-code-snippet">
										<span>claude mcp add captr {mcpInfo.sseUrl}</span>
									</div>

									<button
										type="button"
										className="copilot-copy-btn mt-3"
										onClick={copyMcpConfig}
									>
										{copiedConfig ? (
											<Check
												size={13}
												weight="bold"
												className="text-emerald-400"
											/>
										) : (
											<Copy size={13} />
										)}
										<span>
											{copiedConfig
												? "Copied MCP Config JSON!"
												: "Copy MCP Configuration"}
										</span>
									</button>
								</div>
							)}
						</div>

						{/* Tools summary */}
						<div className="copilot-section mt-4">
							<div className="text-[11px] font-semibold text-zinc-300 mb-2">
								Exposed MCP Tools
							</div>
							<div className="space-y-1.5 text-[11px]">
								<div className="copilot-tool-item">
									<code>get_project_context</code> — Full timeline, transcripts &
									playhead
								</div>
								<div className="copilot-tool-item">
									<code>propose_edit_plan</code> — Structured editing plan
								</div>
								<div className="copilot-tool-item">
									<code>split_clip</code> — Atomic split at timestamp
								</div>
								<div className="copilot-tool-item">
									<code>trim_clip</code> — Atomic source in/out trim
								</div>
								<div className="copilot-tool-item">
									<code>remove_silence</code> — Automated dead-air ripple cuts
								</div>
								<div className="copilot-tool-item">
									<code>add_broll_or_overlay</code> — Insert kinetic B-roll or
									text
								</div>
								<div className="copilot-tool-item">
									<code>preview_speculative_edits</code> — Ghost timeline diff
								</div>
								<div className="copilot-tool-item">
									<code>commit_edits</code> — Route through ProjectController
								</div>
							</div>
						</div>
					</div>
				) : (
					/* Chat & Interactive Editing Panel */
					<div className="copilot-chat-panel">
						{/* Agent Selector */}
						<div className="copilot-agent-bar">
							<label className="text-[11px] text-zinc-400 font-medium">Agent:</label>
							<select
								className="copilot-agent-select"
								value={selectedAgent}
								onChange={(e) => setSelectedAgent(e.target.value)}
							>
								{agents.map((ag) => (
									<option key={ag.id} value={ag.id}>
										{ag.name} {ag.available ? "(Ready)" : "(Not in PATH)"}
									</option>
								))}
							</select>
						</div>

						{/* Quick Recipes */}
						<div className="copilot-recipes-scroll">
							{PRESET_RECIPES.map((recipe) => (
								<button
									key={recipe.title}
									type="button"
									className="copilot-recipe-chip"
									onClick={() => setPrompt(recipe.prompt)}
								>
									<Scissors size={11} weight="bold" />
									<span>{recipe.title}</span>
								</button>
							))}
						</div>

						{/* Asset Mention Chips */}
						{project.assets.length > 0 && (
							<div className="copilot-asset-chips-row">
								<span className="text-[10px] text-zinc-400">Assets:</span>
								{project.assets.map((asset) => {
									const hasCC = Boolean(transcripts[asset.id]);
									const tag = `@${asset.name.replace(/\s+/g, "_")}`;
									return (
										<button
											key={asset.id}
											type="button"
											className="copilot-mention-btn"
											onClick={() => appendTag(tag)}
										>
											<span>{tag}</span>
											{hasCC && <span className="copilot-cc-badge">CC</span>}
										</button>
									);
								})}
							</div>
						)}

						{/* Prompt Textarea */}
						<div className="copilot-prompt-container">
							<textarea
								className="copilot-textarea"
								rows={3}
								placeholder="What should the AI edit? (e.g. 'Cut silent pauses in @Screen_Recording and add title card')..."
								value={prompt}
								onChange={(e) => setPrompt(e.target.value)}
								onKeyDown={(e) => {
									if (
										e.key === "Enter" &&
										(e.ctrlKey || e.metaKey) &&
										!isRunning
									) {
										e.preventDefault();
										void handleRun();
									}
								}}
								disabled={isRunning}
							/>
							<div className="flex items-center justify-between mt-2">
								<span className="text-[10px] text-zinc-400">Ctrl+Enter to run</span>
								{isRunning ? (
									<button
										type="button"
										className="copilot-btn-cancel"
										onClick={() => void handleCancel()}
									>
										Cancel Task
									</button>
								) : (
									<button
										type="button"
										className="copilot-btn-run"
										disabled={!prompt.trim()}
										onClick={() => void handleRun()}
									>
										<Sparkle size={13} weight="bold" />
										<span>Run Agent</span>
										<ArrowRight size={12} />
									</button>
								)}
							</div>
						</div>

						{/* Proposed Edit Plan Card */}
						{editPlan && (
							<div className="copilot-plan-card">
								<div className="flex items-center gap-1.5 font-semibold text-xs text-amber-300 mb-1.5">
									<GitBranch size={14} weight="bold" />
									<span>Proposed Edit Plan</span>
								</div>
								<p className="text-xs text-zinc-200 mb-2 font-medium">
									{editPlan.summary}
								</p>
								<ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-300">
									{editPlan.steps.map((st, idx) => (
										<li key={idx}>{st}</li>
									))}
								</ol>
							</div>
						)}

						{/* Speculative / Ghost Draft Review Card */}
						{speculativeDraft && (
							<div className="copilot-speculative-card">
								<div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-300 mb-1">
									<CheckCircle
										size={15}
										weight="fill"
										className="text-emerald-400"
									/>
									<span>Speculative Ghost Draft Ready</span>
								</div>
								<p className="text-[11px] text-zinc-300 mb-2">
									Changes are rendered as ghost clips on your timeline. Inspect
									before committing!
								</p>

								<div className="grid grid-cols-2 gap-2 text-[11px] bg-black/25 p-2 rounded-lg border border-white/5 mb-3">
									<div>
										<span className="text-zinc-400">Clips Count:</span>{" "}
										<span className="font-semibold text-white">
											{speculativeDraft.diff.clipsBefore} →{" "}
											{speculativeDraft.diff.clipsAfter}
										</span>
									</div>
									<div>
										<span className="text-zinc-400">Duration Δ:</span>{" "}
										<span
											className={`font-semibold ${
												speculativeDraft.diff.durationDeltaUs <= 0
													? "text-emerald-400"
													: "text-amber-400"
											}`}
										>
											{speculativeDraft.diff.durationDeltaUs >= 0 ? "+" : ""}
											{(
												speculativeDraft.diff.durationDeltaUs / 1_000_000
											).toFixed(1)}
											s
										</span>
									</div>
								</div>

								<div className="flex items-center gap-2">
									<button
										type="button"
										className="copilot-draft-btn-reject flex-1"
										onClick={onDiscardDraft}
									>
										Reject Changes
									</button>
									<button
										type="button"
										className="copilot-draft-btn-accept flex-1"
										onClick={() => onApplyDraft(speculativeDraft.project)}
									>
										Accept Changes
									</button>
								</div>
							</div>
						)}

						{/* Error Banner */}
						{error && (
							<div className="copilot-error-banner">
								<WarningCircle size={16} className="shrink-0 text-rose-400" />
								<div className="text-xs text-rose-300 leading-tight">{error}</div>
							</div>
						)}

						{/* Streaming Terminal Log */}
						{(showConsole || isRunning || logs.length > 0) && (
							<div className="copilot-console-wrapper">
								<div
									className="copilot-console-header"
									onClick={() => setShowConsole((v) => !v)}
								>
									<div className="flex items-center gap-1.5">
										<Terminal size={12} />
										<span className="font-mono text-[11px]">
											Terminal Stream
										</span>
										{isRunning && (
											<CircleNotch
												size={11}
												className="animate-spin text-amber-400"
											/>
										)}
									</div>
									<span className="text-[10px] text-zinc-400">
										{showConsole ? "Hide" : "Show"} ({logs.length} lines)
									</span>
								</div>
								{showConsole && (
									<div className="copilot-console-content">
										{logs.length === 0 ? (
											<span className="text-zinc-500 italic">
												Waiting for agent logs…
											</span>
										) : (
											logs.map((line, idx) => <div key={idx}>{line}</div>)
										)}
										<div ref={consoleEndRef} />
									</div>
								)}
							</div>
						)}
					</div>
				)}
			</div>
		</aside>
	);
}
