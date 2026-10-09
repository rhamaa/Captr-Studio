import {
	ArrowClockwise,
	ArrowSquareOut,
	Check,
	Code,
	Copy,
	FolderOpen,
	Terminal as TerminalIcon,
	Trash,
} from "@phosphor-icons/react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import "@xterm/xterm/css/xterm.css";

interface ProjectTerminalProps {
	className?: string;
	onClose?: () => void;
}

export function ProjectTerminal({ className = "" }: ProjectTerminalProps) {
	const terminalContainerRef = useRef<HTMLDivElement>(null);
	const termRef = useRef<Terminal | null>(null);
	const fitAddonRef = useRef<FitAddon | null>(null);
	const activeSessionIdRef = useRef<string | null>(null);

	const [shellType, setShellType] = useState<"powershell" | "cmd" | "bash">("powershell");
	const [activeCwd, setActiveCwd] = useState<string>("");
	const [activeProjectName, setActiveProjectName] = useState<string | null>(null);
	const [mcpPort, setMcpPort] = useState<number | null>(null);
	const [copied, setCopied] = useState(false);
	const [isRunning, setIsRunning] = useState(false);

	const startSession = async (shell: "powershell" | "cmd" | "bash") => {
		if (!window.electronAPI?.startTerminal) return;

		// Cleanup prior session if running
		if (activeSessionIdRef.current) {
			void window.electronAPI.killTerminal?.(activeSessionIdRef.current);
			activeSessionIdRef.current = null;
		}

		if (termRef.current) {
			termRef.current.reset();
			termRef.current.write("\x1b[90m[Captr Terminal] Spawning interactive session...\x1b[0m\r\n");
		}

		try {
			const res = await window.electronAPI.startTerminal({ shell });
			activeSessionIdRef.current = res.sessionId;
			setActiveCwd(res.cwd);
			setActiveProjectName(res.projectName);
			setMcpPort(res.mcpPort);
			setIsRunning(true);

			if (termRef.current) {
				termRef.current.write(
					`\x1b[36m⚡ Captr Project Context:\x1b[0m ${res.projectName || "Active Project"}\r\n` +
					`\x1b[90m📁 CWD:\x1b[0m ${res.cwd}\r\n` +
					`\x1b[90m🔌 MCP Port:\x1b[0m ${res.mcpPort} (env: CAPTR_MCP_PORT, CAPTR_WORKSPACE_DIR)\r\n\r\n`,
				);
			}
		} catch (err) {
			console.error("[Terminal] Failed to start session:", err);
			if (termRef.current) {
				termRef.current.write(
					`\r\n\x1b[31m[Error]: Failed to launch terminal shell: ${err instanceof Error ? err.message : String(err)}\x1b[0m\r\n`,
				);
			}
			setIsRunning(false);
		}
	};

	useEffect(() => {
		if (!terminalContainerRef.current) return;

		const term = new Terminal({
			cursorBlink: true,
			cursorStyle: "bar",
			fontSize: 12.5,
			fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", Menlo, monospace',
			lineHeight: 1.25,
			theme: {
				background: "#090a0d",
				foreground: "#e5e7eb",
				cursor: "#38bdf8",
				cursorAccent: "#090a0d",
				selectionBackground: "#38bdf840",
				black: "#1e222a",
				red: "#f87171",
				green: "#4ade80",
				yellow: "#facc15",
				blue: "#60a5fa",
				magenta: "#c084fc",
				cyan: "#38bdf8",
				white: "#e5e7eb",
				brightBlack: "#4b5563",
				brightRed: "#ef4444",
				brightGreen: "#22c55e",
				brightYellow: "#eab308",
				brightBlue: "#3b82f6",
				brightMagenta: "#a855f7",
				brightCyan: "#06b6d4",
				brightWhite: "#ffffff",
			},
			convertEol: true,
			allowProposedApi: true,
		});

		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.open(terminalContainerRef.current);

		termRef.current = term;
		fitAddonRef.current = fitAddon;

		// Initial fit
		requestAnimationFrame(() => {
			try {
				fitAddon.fit();
			} catch {}
		});

		// User keystroke dispatch to main process
		const onDataDisposable = term.onData((data) => {
			const sessId = activeSessionIdRef.current;
			if (sessId && window.electronAPI?.writeTerminal) {
				void window.electronAPI.writeTerminal(sessId, data);
			}
		});

		// Incoming output stream from main process
		const unsubData = window.electronAPI?.onTerminalData?.(({ sessionId, data }) => {
			if (sessionId === activeSessionIdRef.current) {
				term.write(data);
			}
		});

		// Process exit notification
		const unsubExit = window.electronAPI?.onTerminalExit?.(({ sessionId, code }) => {
			if (sessionId === activeSessionIdRef.current) {
				term.write(`\r\n\x1b[90m[Process exited with code ${code}]\x1b[0m\r\n`);
				setIsRunning(false);
			}
		});

		// Resize observer on container
		const ro = new ResizeObserver(() => {
			try {
				fitAddon.fit();
			} catch {}
		});
		ro.observe(terminalContainerRef.current);

		// Start initial terminal shell
		void startSession(shellType);

		return () => {
			onDataDisposable.dispose();
			unsubData?.();
			unsubExit?.();
			ro.disconnect();
			if (activeSessionIdRef.current) {
				void window.electronAPI?.killTerminal?.(activeSessionIdRef.current);
			}
			term.dispose();
		};
	}, []);

	const handleShellChange = (nextShell: "powershell" | "cmd" | "bash") => {
		setShellType(nextShell);
		void startSession(nextShell);
	};

	const handleCopyCwd = () => {
		if (!activeCwd) return;
		void navigator.clipboard.writeText(activeCwd);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const handleOpenExternal = async () => {
		try {
			await window.electronAPI?.openExternalTerminal?.(activeCwd);
		} catch (err) {
			console.error("[Terminal] Open external failed:", err);
		}
	};

	const handleOpenInCode = async () => {
		try {
			await window.electronAPI?.openInCodeEditor?.(activeCwd);
		} catch (err) {
			console.error("[Terminal] Open VS Code failed:", err);
		}
	};

	const handleClear = () => {
		termRef.current?.clear();
	};

	const handleRestart = () => {
		void startSession(shellType);
	};

	return (
		<div className={`flex flex-col h-[520px] w-full rounded-xl border border-white/10 bg-[#090a0d] overflow-hidden text-xs ${className}`}>
			{/* Top Tool Bar */}
			<div className="flex flex-wrap items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-white/[0.02] gap-2">
				<div className="flex items-center gap-2.5">
					<div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10 text-white/90">
						<TerminalIcon size={14} weight="bold" className="text-primary" />
						<select
							value={shellType}
							onChange={(e) => handleShellChange(e.target.value as "powershell" | "cmd" | "bash")}
							className="bg-transparent border-none text-xs font-semibold focus:outline-none cursor-pointer pr-1"
						>
							<option value="powershell" className="bg-[#12141a] text-white">PowerShell</option>
							<option value="cmd" className="bg-[#12141a] text-white">Command Prompt</option>
							<option value="bash" className="bg-[#12141a] text-white">Git Bash</option>
						</select>
					</div>

					{activeCwd && (
						<div
							onClick={handleCopyCwd}
							title="Click to copy project working directory"
							className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 text-muted-foreground hover:text-white cursor-pointer transition-colors max-w-[280px] truncate"
						>
							<FolderOpen size={13} className="shrink-0" />
							<span className="truncate font-mono text-[11px]">{activeCwd}</span>
							{copied ? (
								<Check size={12} className="text-green-400 shrink-0" />
							) : (
								<Copy size={12} className="shrink-0 opacity-60" />
							)}
						</div>
					)}

					{mcpPort && (
						<span
							className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
							title={`Local Captr MCP Server active on port ${mcpPort}`}
						>
							<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
							MCP :{mcpPort}
						</span>
					)}
				</div>

				<div className="flex items-center gap-1.5">
					<button
						type="button"
						onClick={handleOpenExternal}
						title="Open native Windows Terminal / PowerShell at this directory"
						className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/5 transition-colors"
					>
						<ArrowSquareOut size={13} />
						<span>Open External</span>
					</button>

					<button
						type="button"
						onClick={handleOpenInCode}
						title="Open this project in VS Code or Cursor"
						className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/5 transition-colors"
					>
						<Code size={13} />
						<span>VS Code</span>
					</button>

					<button
						type="button"
						onClick={handleClear}
						title="Clear terminal screen"
						className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
					>
						<Trash size={13} />
					</button>

					<button
						type="button"
						onClick={handleRestart}
						title="Restart shell process"
						className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
					>
						<ArrowClockwise size={13} />
					</button>
				</div>
			</div>

			{/* Terminal Screen Container */}
			<div
				ref={terminalContainerRef}
				className="flex-1 w-full p-2 bg-[#090a0d] overflow-hidden select-text"
				style={{ minHeight: "360px" }}
			/>

			{/* Bottom Status Footbar */}
			<div className="flex items-center justify-between px-3 py-1.5 border-t border-white/5 bg-white/[0.01] text-[11px] text-muted-foreground font-mono">
				<div className="flex items-center gap-2">
					<span className={`w-2 h-2 rounded-full ${isRunning ? "bg-emerald-400" : "bg-zinc-500"}`} />
					<span>{isRunning ? "Session Active" : "Session Inactive"}</span>
					{activeProjectName && (
						<span className="text-white/60">· Project: {activeProjectName}</span>
					)}
				</div>
				<div className="text-[10px] text-white/40">
					CLI agents (`claude`, `agy`, `codex`) have direct access to project files & MCP
				</div>
			</div>
		</div>
	);
}
