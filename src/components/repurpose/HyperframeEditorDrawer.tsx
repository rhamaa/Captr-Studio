import {
	ArrowClockwise,
	CaretDown,
	Check,
	CheckCircle,
	Code,
	Copy,
	FloppyDisk,
	FolderOpen,
	Pause,
	Play,
	Robot,
	Sparkle,
	WarningCircle,
	X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { HyperframeComposition } from "@/core/story/storyTypes";
import type { TimelineProject } from "@/core/timeline/types";

export interface HyperframeEditorDrawerProps {
	hyperframe: HyperframeComposition;
	project: TimelineProject;
	projectTitle?: string;
	onUpdate: (updated: Partial<HyperframeComposition>) => void;
	onClose: () => void;
}

interface AgentOption {
	id: string;
	name: string;
	command: string;
	description: string;
	available: boolean;
	executablePath?: string;
}

const DEFAULT_AGENTS: AgentOption[] = [
	{ id: "claude", name: "Claude Code", command: "claude", description: "Anthropic Claude CLI", available: false },
	{ id: "agy", name: "Antigravity CLI", command: "agy", description: "Antigravity Agent CLI", available: false },
	{ id: "codex", name: "OpenAI Codex", command: "codex", description: "Codex terminal agent", available: false },
	{ id: "opencode", name: "OpenCode CLI", command: "opencode", description: "OpenCode AI developer", available: false },
	{ id: "kiro", name: "Kiro CLI", command: "kiro", description: "Kiro autonomous terminal agent", available: false },
	{ id: "trae", name: "Trae CLI", command: "trae", description: "Trae AI agent", available: false },
	{ id: "cline", name: "Cline CLI", command: "cline", description: "Cline agent CLI", available: false },
	{ id: "hermes", name: "Hermes CLI", command: "hermes", description: "Hermes agent runner", available: false },
	{ id: "custom", name: "Custom Binary...", command: "", description: "Custom terminal executable", available: false },
];

const PRESET_PROMPTS = [
	{ label: "Kinetic Intro", prompt: "Animate a bold title with smooth GSAP elastic bounce, glowing pastel subtitle, and floating particle badges." },
	{ label: "Lower Third", prompt: "Create a modern lower-third graphic with frosted glass card, speaker name, and animated accent bar." },
	{ label: "Stat Counter", prompt: "Display a clean metric card with an animated number counter from 0 to 100K and a pastel progress ring." },
	{ label: "Pastel CTA", prompt: "Design an outro card with soft pastel gradient, social icons, and pulse animation button." },
];

export function HyperframeEditorDrawer({
	hyperframe,
	project,
	projectTitle,
	onUpdate,
	onClose,
}: HyperframeEditorDrawerProps) {
	const iframeRef = useRef<HTMLIFrameElement | null>(null);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const logsEndRef = useRef<HTMLDivElement | null>(null);

	// Tabs: "agent" | "code"
	const [activeTab, setActiveTab] = useState<"agent" | "code">("agent");

	// Playback & Scrubber
	const [currentTimeSec, setCurrentTimeSec] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [scale, setScale] = useState(0.4);

	// Code editor state
	const [codeDraft, setCodeDraft] = useState(hyperframe.htmlContent || "");
	const [codeCopied, setCodeCopied] = useState(false);

	// Title editing
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState(hyperframe.name);

	// CLI Agent State
	const [availableAgents, setAvailableAgents] = useState<AgentOption[]>(DEFAULT_AGENTS);
	const [selectedAgentId, setSelectedAgentId] = useState("claude");
	const [customCommand, setCustomCommand] = useState("");
	const [userPrompt, setUserPrompt] = useState("");
	const [isAgentRunning, setIsAgentRunning] = useState(false);
	const [agentLogs, setAgentLogs] = useState<string[]>([]);
	const [agentError, setAgentError] = useState<string | null>(null);
	const [agentSuccess, setAgentSuccess] = useState<string | null>(null);

	const durationSec = Math.max(0.1, hyperframe.durationUs / 1_000_000);

	// Sync code draft when hyperframe updates externally
	useEffect(() => {
		setCodeDraft(hyperframe.htmlContent || "");
	}, [hyperframe.htmlContent]);

	// Load available CLI agents from electron
	useEffect(() => {
		let isMounted = true;
		if (window.electronAPI?.getAvailableAgents) {
			window.electronAPI
				.getAvailableAgents()
				.then((agents) => {
					if (!isMounted) return;
					if (agents && agents.length > 0) {
						// Merge with default list to preserve names and add custom option
						const merged = DEFAULT_AGENTS.map((def) => {
							const found = agents.find((a) => a.id === def.id);
							return found ? { ...def, ...found } : def;
						});
						setAvailableAgents(merged);
						// Pick first available agent if claude is not available
						const readyOne = merged.find((a) => a.available);
						if (readyOne && !merged.find((a) => a.id === selectedAgentId)?.available) {
							setSelectedAgentId(readyOne.id);
						}
					}
				})
				.catch((err) => {
					console.warn("Failed to detect CLI agents:", err);
				});
		}
		return () => {
			isMounted = false;
		};
	}, []);

	// Subscribe to streaming logs
	useEffect(() => {
		if (!window.electronAPI?.onHyperframeAgentLogStream) return;
		const unsubscribe = window.electronAPI.onHyperframeAgentLogStream((chunk) => {
			setAgentLogs((prev) => [...prev, chunk]);
		});
		return () => {
			unsubscribe();
		};
	}, []);

	// Auto scroll logs
	useEffect(() => {
		logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [agentLogs]);

	// Responsive scale calculation
	useEffect(() => {
		const updateScale = () => {
			if (!containerRef.current) return;
			const { clientWidth, clientHeight } = containerRef.current;
			if (clientWidth > 0 && clientHeight > 0) {
				const padding = 48;
				const scaleX = (clientWidth - padding) / (hyperframe.width || 1920);
				const scaleY = (clientHeight - padding) / (hyperframe.height || 1080);
				setScale(Math.max(0.15, Math.min(scaleX, scaleY, 0.85)));
			}
		};
		updateScale();
		window.addEventListener("resize", updateScale);
		return () => window.removeEventListener("resize", updateScale);
	}, [hyperframe.width, hyperframe.height]);

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

	// Send seek message to iframe
	useEffect(() => {
		if (!iframeRef.current?.contentWindow) return;
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
			// Ignore cross-origin error
		}
	}, [currentTimeSec]);

	// Esc hotkey
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose]);

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

	const handleApplyCode = () => {
		onUpdate({ htmlContent: codeDraft });
	};

	const handleCopyCode = () => {
		navigator.clipboard.writeText(codeDraft);
		setCodeCopied(true);
		setTimeout(() => setCodeCopied(false), 2000);
	};

	const handleSaveTitle = () => {
		const trimmed = titleDraft.trim();
		if (trimmed) {
			onUpdate({ name: trimmed });
		}
		setIsEditingTitle(false);
	};

	const handleRunAgent = async () => {
		if (!userPrompt.trim()) return;
		setAgentError(null);
		setAgentSuccess(null);
		setIsAgentRunning(true);
		setAgentLogs([`🚀 Invoking CLI Agent: ${selectedAgentId}...`]);

		try {
			if (!window.electronAPI?.runHyperframeAgentTask) {
				throw new Error("Electron Agent API is not available in this environment.");
			}

			const res = await window.electronAPI.runHyperframeAgentTask({
				agentId: selectedAgentId,
				customCommand: selectedAgentId === "custom" ? customCommand : undefined,
				userPrompt: userPrompt.trim(),
				hyperframeId: hyperframe.id,
				hyperframeName: hyperframe.name,
				currentHtml: hyperframe.htmlContent || "",
				width: hyperframe.width,
				height: hyperframe.height,
				durationSec,
				projectContext: {
					projectId: project.projectId,
					projectTitle: projectTitle || project.title,
					assets: project.assets.map((a) => ({
						id: a.id,
						name: a.name,
						kind: a.kind,
						sourcePath: a.source?.path,
						durationSec: a.durationUs ? a.durationUs / 1_000_000 : undefined,
						width: a.width,
						height: a.height,
					})),
				},
			});

			if (res.logs && res.logs.length > 0) {
				setAgentLogs(res.logs);
			}

			if (res.success && res.html) {
				onUpdate({ htmlContent: res.html });
				setCodeDraft(res.html);
				setAgentSuccess("Hyperframe updated successfully by agent!");
				if (iframeRef.current) {
					iframeRef.current.srcdoc = res.html;
				}
			} else {
				setAgentError(res.error || "Agent execution failed without returning valid HTML.");
			}
		} catch (err) {
			setAgentError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsAgentRunning(false);
		}
	};

	const handleCancelAgent = async () => {
		if (window.electronAPI?.cancelHyperframeAgentTask) {
			await window.electronAPI.cancelHyperframeAgentTask();
		}
		setIsAgentRunning(false);
		setAgentLogs((prev) => [...prev, "🛑 Agent task cancelled by user."]);
	};

	const selectedAgent = availableAgents.find((a) => a.id === selectedAgentId);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 backdrop-blur-sm transition-opacity">
			<div className="flex h-full w-full max-w-[1360px] flex-col border-l border-[#343A46] bg-[#15171C] text-[#F5F6F8] shadow-2xl">
				{/* Header */}
				<header className="flex h-14 shrink-0 items-center justify-between border-b border-[#343A46] bg-[#1C1F26] px-5">
					<div className="flex items-center gap-3">
						<span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#A879F5]/30 bg-[#A879F5]/15 text-[#A879F5]">
							<Sparkle size={18} weight="fill" />
						</span>

						{isEditingTitle ? (
							<div className="flex items-center gap-1.5">
								<input
									type="text"
									value={titleDraft}
									onChange={(e) => setTitleDraft(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleSaveTitle();
										if (e.key === "Escape") setIsEditingTitle(false);
									}}
									autoFocus
									className="rounded border border-[#6FA8FF] bg-[#15171C] px-2 py-0.5 text-sm font-semibold text-white outline-none"
								/>
								<button
									type="button"
									onClick={handleSaveTitle}
									className="rounded bg-[#6FA8FF] px-2 py-0.5 text-xs font-semibold text-[#15171C]"
								>
									Save
								</button>
							</div>
						) : (
							<div
								className="group flex cursor-pointer items-center gap-2"
								onClick={() => setIsEditingTitle(true)}
								title="Click to rename"
							>
								<h2 className="text-sm font-bold tracking-wide text-white group-hover:text-[#6FA8FF]">
									{hyperframe.name}
								</h2>
								<span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-[#A8AFBD] opacity-0 group-hover:opacity-100 transition">
									Rename
								</span>
							</div>
						)}

						<div className="flex items-center gap-2 border-l border-[#343A46] pl-3 text-xs">
							<span className="rounded bg-[#A879F5]/20 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#c5a7fb]">
								{hyperframe.aspectRatio || "16:9"}
							</span>
							<span className="font-mono text-[11px] text-[#A8AFBD]">
								{hyperframe.width}x{hyperframe.height}
							</span>
							<span className="text-[#343A46]">•</span>
							<span className="font-mono text-[11px] text-[#A8AFBD]">
								{durationSec.toFixed(1)}s
							</span>
							<span className="text-[#343A46]">•</span>
							<span className="font-mono text-[11px] text-[#8DDB9B]">60 FPS</span>
						</div>
					</div>

					{/* Header Right: Close Button */}
					<div className="flex items-center gap-3">
						<button
							type="button"
							data-testid="hyperframe-drawer-close"
							onClick={onClose}
							className="flex items-center gap-1.5 rounded-lg border border-[#343A46] bg-[#15171C] px-3 py-1.5 text-xs font-semibold text-[#A8AFBD] hover:border-white/20 hover:text-white transition"
							title="Close Editor (Esc)"
						>
							<X size={15} weight="bold" />
							<span>Close</span>
							<kbd className="ml-1 rounded bg-white/10 px-1 py-0.2 text-[10px]">Esc</kbd>
						</button>
					</div>
				</header>

				{/* Main Body: Stage (Left) & Controls/Tabs (Right) */}
				<div className="flex flex-1 overflow-hidden">
					{/* Left / Center: Interactive Preview Stage */}
					<section className="flex flex-1 flex-col border-r border-[#343A46] bg-[#111214]">
						{/* Preview Canvas Stage */}
						<div
							ref={containerRef}
							className="relative flex flex-1 items-center justify-center overflow-hidden p-6"
						>
							<div
								className="relative overflow-hidden rounded-lg border border-white/10 bg-transparent shadow-2xl transition-transform"
								style={{
									width: `${hyperframe.width}px`,
									height: `${hyperframe.height}px`,
									transform: `scale(${scale})`,
									transformOrigin: "center center",
								}}
							>
								<iframe
									ref={iframeRef}
									data-testid="hyperframe-drawer-iframe"
									title={hyperframe.name}
									sandbox="allow-scripts allow-same-origin"
									srcDoc={hyperframe.htmlContent || ""}
									className="h-full w-full border-none pointer-events-none"
								/>
							</div>
						</div>

						{/* Playback & Scrubber Bar */}
						<div className="flex h-14 shrink-0 items-center gap-4 border-t border-[#343A46] bg-[#1C1F26] px-5">
							<button
								type="button"
								onClick={togglePlay}
								className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6FA8FF] text-[#15171C] font-bold shadow transition hover:bg-[#85b7ff]"
								title={isPlaying ? "Pause" : "Play"}
							>
								{isPlaying ? <Pause size={16} weight="fill" /> : <Play size={16} weight="fill" />}
							</button>

							<button
								type="button"
								onClick={handleReload}
								className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#343A46] bg-[#15171C] text-[#A8AFBD] hover:border-white/20 hover:text-white transition"
								title="Restart & Reload Frame"
							>
								<ArrowClockwise size={15} />
							</button>

							<span className="w-14 text-right font-mono text-xs text-[#A8AFBD]">
								{currentTimeSec.toFixed(2)}s
							</span>

							<input
								type="range"
								data-testid="hyperframe-drawer-scrubber"
								min="0"
								max={durationSec}
								step="0.01"
								value={currentTimeSec}
								onChange={(e) => {
									setIsPlaying(false);
									setCurrentTimeSec(Number.parseFloat(e.target.value));
								}}
								className="flex-1 cursor-pointer accent-[#6FA8FF] h-1.5 rounded-lg bg-[#242832]"
							/>

							<span className="w-14 font-mono text-xs text-[#A8AFBD]">
								{durationSec.toFixed(2)}s
							</span>
						</div>
					</section>

					{/* Right Panel: AI Agent & Code Editor Drawer */}
					<aside className="flex w-[480px] shrink-0 flex-col bg-[#1C1F26]">
						{/* Tab Switcher */}
						<div className="flex border-b border-[#343A46] bg-[#15171C] p-2 gap-1.5">
							<button
								type="button"
								onClick={() => setActiveTab("agent")}
								className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition ${
									activeTab === "agent"
										? "border border-[#A879F5]/40 bg-[#A879F5]/15 text-white shadow-sm"
										: "text-[#A8AFBD] hover:text-white"
								}`}
							>
								<Robot size={16} weight="bold" className="text-[#A879F5]" />
								<span>CLI Agent</span>
							</button>

							<button
								type="button"
								onClick={() => setActiveTab("code")}
								className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-bold transition ${
									activeTab === "code"
										? "border border-[#6FA8FF]/40 bg-[#6FA8FF]/15 text-white shadow-sm"
										: "text-[#A8AFBD] hover:text-white"
								}`}
							>
								<Code size={16} weight="bold" className="text-[#6FA8FF]" />
								<span>Source Code</span>
							</button>
						</div>

						{/* Tab 1: AI Agent Bar */}
						{activeTab === "agent" && (
							<div className="flex flex-1 flex-col overflow-y-auto p-4 space-y-4">
								{/* Agent Selector Card */}
								<div className="rounded-xl border border-[#343A46] bg-[#15171C] p-3.5 space-y-3">
									<div className="flex items-center justify-between">
										<label className="text-xs font-bold uppercase tracking-wider text-[#A8AFBD]">
											CLI Agent Runner
										</label>
										<div className="flex items-center gap-1.5">
											{selectedAgent?.available ? (
												<span className="inline-flex items-center gap-1 rounded-full bg-[#8DDB9B]/15 px-2 py-0.5 text-[10px] font-semibold text-[#8DDB9B]">
													<CheckCircle size={12} weight="fill" />
													Ready
												</span>
											) : (
												<span className="inline-flex items-center gap-1 rounded-full bg-[#F6C768]/15 px-2 py-0.5 text-[10px] font-semibold text-[#F6C768]">
													<WarningCircle size={12} weight="fill" />
													Not in PATH
												</span>
											)}
										</div>
									</div>

									<div className="relative">
										<select
											value={selectedAgentId}
											onChange={(e) => setSelectedAgentId(e.target.value)}
											className="w-full appearance-none rounded-lg border border-[#343A46] bg-[#1C1F26] px-3 py-2 text-xs font-semibold text-white outline-none focus:border-[#6FA8FF] transition"
										>
											{availableAgents.map((agent) => (
												<option key={agent.id} value={agent.id}>
													{agent.name} ({agent.command || "custom"}) {agent.available ? "✓" : ""}
												</option>
											))}
										</select>
										<CaretDown
											size={13}
											className="pointer-events-none absolute right-3 top-3 text-[#A8AFBD]"
										/>
									</div>

									{selectedAgentId === "custom" && (
										<div className="flex gap-2">
											<input
												type="text"
												value={customCommand}
												onChange={(e) => setCustomCommand(e.target.value)}
												placeholder="Binary name e.g. hermes or /usr/bin/my-cli"
												className="flex-1 rounded-lg border border-[#343A46] bg-[#1C1F26] px-3 py-1.5 text-xs text-white placeholder-[#717887] outline-none focus:border-[#6FA8FF]"
											/>
										</div>
									)}

									{/* Project Context Chips */}
									<div className="flex flex-wrap items-center gap-1.5 pt-1">
										<span className="inline-flex items-center gap-1 rounded bg-[#242832] px-2 py-0.5 text-[10px] text-[#A8AFBD] font-medium">
											<FolderOpen size={11} className="text-[#6FA8FF]" />
											{project.assets.length} {project.assets.length === 1 ? "Asset" : "Assets"}
										</span>
										<span className="rounded bg-[#242832] px-2 py-0.5 text-[10px] font-mono text-[#A8AFBD]">
											{hyperframe.width}×{hyperframe.height}
										</span>
										<span className="rounded bg-[#242832] px-2 py-0.5 text-[10px] font-mono text-[#A8AFBD]">
											{durationSec.toFixed(1)}s
										</span>
										<span className="rounded bg-[#A879F5]/20 px-2 py-0.5 text-[10px] font-mono text-[#c5a7fb]">
											GSAP 3
										</span>
									</div>
								</div>

								{/* Prompt Presets */}
								<div className="space-y-1.5">
									<span className="text-[11px] font-semibold text-[#A8AFBD]">
										Inspiration Presets:
									</span>
									<div className="flex flex-wrap gap-1.5">
										{PRESET_PROMPTS.map((p) => (
											<button
												key={p.label}
												type="button"
												onClick={() => setUserPrompt(p.prompt)}
												className="rounded-md border border-[#343A46] bg-[#15171C] px-2 py-1 text-[11px] text-[#A8AFBD] hover:border-[#A879F5]/50 hover:text-white transition"
											>
												{p.label}
											</button>
										))}
									</div>
								</div>

								{/* Prompt Input & Execute */}
								<div className="flex flex-col space-y-2">
									<label className="text-xs font-bold text-white">
										Instructions for Agent
									</label>
									<textarea
										rows={4}
										value={userPrompt}
										onChange={(e) => setUserPrompt(e.target.value)}
										placeholder="Describe animation, layout, or modifications (e.g. 'Add a soft pastel gradient background, bounce the title with GSAP, and show a stats pill at 2s')..."
										className="w-full resize-none rounded-xl border border-[#343A46] bg-[#15171C] p-3 text-xs leading-relaxed text-white placeholder-[#717887] outline-none focus:border-[#6FA8FF] transition"
									/>

									<div className="flex items-center gap-2 pt-1">
										<button
											type="button"
											onClick={handleRunAgent}
											disabled={isAgentRunning || !userPrompt.trim()}
											className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6FA8FF] to-[#A879F5] py-2.5 text-xs font-bold text-[#15171C] shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
										>
											<Sparkle size={15} weight="bold" />
											<span>{isAgentRunning ? "Running Agent..." : "Run Agent"}</span>
										</button>

										{isAgentRunning && (
											<button
												type="button"
												onClick={handleCancelAgent}
												className="rounded-xl border border-red-500/40 bg-red-500/15 px-3 py-2.5 text-xs font-bold text-red-300 hover:bg-red-500/25 transition"
											>
												Cancel
											</button>
										)}
									</div>
								</div>

								{/* Status Notices */}
								{agentError && (
									<div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
										<p className="font-semibold">Agent Error:</p>
										<p className="mt-1 font-mono text-[11px] leading-relaxed">{agentError}</p>
									</div>
								)}

								{agentSuccess && (
									<div className="flex items-center gap-2 rounded-xl border border-[#8DDB9B]/40 bg-[#8DDB9B]/10 p-3 text-xs text-[#8DDB9B]">
										<Check size={16} weight="bold" />
										<span>{agentSuccess}</span>
									</div>
								)}

								{/* Execution Logs */}
								<div className="flex flex-1 flex-col rounded-xl border border-[#343A46] bg-[#111214] overflow-hidden">
									<div className="flex items-center justify-between border-b border-[#343A46] bg-[#15171C] px-3 py-1.5 text-[11px] font-semibold text-[#A8AFBD]">
										<span>Terminal Stream Logs</span>
										{isAgentRunning && (
											<span className="flex items-center gap-1.5 text-[#6FA8FF]">
												<span className="h-1.5 w-1.5 animate-ping rounded-full bg-[#6FA8FF]" />
												Streaming
											</span>
										)}
									</div>
									<div className="flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed text-slate-300 max-h-48 select-text">
										{agentLogs.length === 0 ? (
											<span className="text-[#555E6D]">No logs yet. Run an agent prompt above.</span>
										) : (
											agentLogs.map((log, i) => (
												<div key={i} className="whitespace-pre-wrap">
													{log}
												</div>
											))
										)}
										<div ref={logsEndRef} />
									</div>
								</div>
							</div>
						)}

						{/* Tab 2: Source Code Editor */}
						{activeTab === "code" && (
							<div className="flex flex-1 flex-col overflow-hidden p-4 space-y-3">
								<div className="flex items-center justify-between">
									<span className="text-xs font-bold text-white">Direct HTML Source</span>
									<div className="flex items-center gap-2">
										<button
											type="button"
											onClick={handleCopyCode}
											className="flex items-center gap-1 rounded border border-[#343A46] bg-[#15171C] px-2 py-1 text-xs text-[#A8AFBD] hover:text-white transition"
											title="Copy HTML"
										>
											{codeCopied ? <Check size={12} className="text-[#8DDB9B]" /> : <Copy size={12} />}
											<span>{codeCopied ? "Copied" : "Copy"}</span>
										</button>
										<button
											type="button"
											onClick={handleApplyCode}
											className="flex items-center gap-1 rounded bg-[#6FA8FF] px-2.5 py-1 text-xs font-bold text-[#15171C] hover:bg-[#85b7ff] transition"
											title="Apply and Hot-Reload"
										>
											<FloppyDisk size={13} weight="bold" />
											<span>Apply</span>
										</button>
									</div>
								</div>

								<div className="relative flex-1 overflow-hidden rounded-xl border border-[#343A46] bg-[#111214]">
									<textarea
										data-testid="hyperframe-code-editor"
										value={codeDraft}
										onChange={(e) => setCodeDraft(e.target.value)}
										spellCheck={false}
										className="h-full w-full resize-none bg-transparent p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none selection:bg-[#6FA8FF]/30 select-text"
									/>
								</div>
							</div>
						)}
					</aside>
				</div>
			</div>
		</div>
	);
}
