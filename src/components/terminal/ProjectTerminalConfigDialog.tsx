import { Gear, Plus, Trash, X } from "@phosphor-icons/react";
import { useState } from "react";
import type { ProjectTerminalConfig } from "@/core/timeline/types";

interface ProjectTerminalConfigDialogProps {
	open: boolean;
	config?: ProjectTerminalConfig;
	onClose: () => void;
	onSave: (config: ProjectTerminalConfig | undefined) => void;
}

export function ProjectTerminalConfigDialog({
	open,
	config,
	onClose,
	onSave,
}: ProjectTerminalConfigDialogProps) {
	if (!open) return null;

	const [preferredShell, setPreferredShell] = useState<
		"default" | "powershell" | "cmd" | "bash"
	>(config?.preferredShell ?? "default");
	const [startupCommand, setStartupCommand] = useState<string>(
		config?.startupCommand ?? "",
	);
	const [envEntries, setEnvEntries] = useState<Array<{ key: string; value: string }>>(
		() =>
			Object.entries(config?.customEnv ?? {}).map(([key, value]) => ({
				key,
				value,
			})),
	);

	const handleAddEnv = () => {
		setEnvEntries((prev) => [...prev, { key: "", value: "" }]);
	};

	const handleRemoveEnv = (index: number) => {
		setEnvEntries((prev) => prev.filter((_, i) => i !== index));
	};

	const handleEnvChange = (index: number, field: "key" | "value", val: string) => {
		setEnvEntries((prev) =>
			prev.map((item, i) => (i === index ? { ...item, [field]: val } : item)),
		);
	};

	const handleSave = () => {
		const customEnv: Record<string, string> = {};
		for (const { key, value } of envEntries) {
			const k = key.trim();
			if (k) customEnv[k] = value;
		}

		const hasCustomEnv = Object.keys(customEnv).length > 0;
		const hasCommand = Boolean(startupCommand.trim());
		const hasShell = preferredShell !== "default";

		if (!hasCustomEnv && !hasCommand && !hasShell) {
			onSave(undefined);
		} else {
			onSave({
				preferredShell: hasShell ? preferredShell : undefined,
				startupCommand: hasCommand ? startupCommand.trim() : undefined,
				customEnv: hasCustomEnv ? customEnv : undefined,
			});
		}
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
			<div className="flex flex-col w-full max-w-lg rounded-2xl border border-white/10 bg-[#101216] text-white shadow-2xl overflow-hidden">
				{/* Header */}
				<div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/[0.02]">
					<div className="flex items-center gap-2.5">
						<div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
							<Gear size={16} weight="bold" />
						</div>
						<div>
							<h3 className="text-sm font-semibold text-white">Project Terminal Settings</h3>
							<p className="text-[11px] text-zinc-400">
								Stored authoritatively in <span className="font-mono text-white/80">project.json</span> inside this <span className="font-mono text-white/80">.captr</span>
							</p>
						</div>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
					>
						<X size={16} />
					</button>
				</div>

				{/* Body Form */}
				<div className="p-5 space-y-4 max-h-[460px] overflow-y-auto text-xs">
					{/* Shell Setting */}
					<div>
						<label className="block font-medium text-zinc-300 mb-1.5">
							Default Project Shell
						</label>
						<select
							value={preferredShell}
							onChange={(e) => setPreferredShell(e.target.value as any)}
							className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-primary text-xs"
						>
							<option value="default" className="bg-[#12141a]">System Default (PowerShell / Bash)</option>
							<option value="powershell" className="bg-[#12141a]">PowerShell</option>
							<option value="cmd" className="bg-[#12141a]">Command Prompt (cmd.exe)</option>
							<option value="bash" className="bg-[#12141a]">Git Bash / WSL</option>
						</select>
						<p className="text-[10px] text-zinc-500 mt-1">
							Shell yang akan otomatis terbuka saat membuka terminal untuk project ini.
						</p>
					</div>

					{/* Startup Command */}
					<div>
						<label className="block font-medium text-zinc-300 mb-1.5">
							Startup Command (Opsional)
						</label>
						<input
							type="text"
							value={startupCommand}
							onChange={(e) => setStartupCommand(e.target.value)}
							placeholder="contoh: agy, claude, atau npm run dev"
							className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-zinc-600 focus:outline-none focus:border-primary font-mono text-xs"
						/>
						<p className="text-[10px] text-zinc-500 mt-1">
							Perintah otomatis yang langsung dieksekusi saat terminal sesi project dimulai.
						</p>
					</div>

					{/* Custom Environment Variables */}
					<div>
						<div className="flex items-center justify-between mb-1.5">
							<label className="font-medium text-zinc-300">
								Custom Project Environment Variables
							</label>
							<button
								type="button"
								onClick={handleAddEnv}
								className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
							>
								<Plus size={12} weight="bold" />
								<span>Add Var</span>
							</button>
						</div>

						{envEntries.length === 0 ? (
							<div className="p-3 rounded-xl border border-dashed border-white/10 text-center text-zinc-500 text-[11px]">
								Belum ada custom ENV. Klik "Add Var" untuk menambahkan (misal: API keys, model agent).
							</div>
						) : (
							<div className="space-y-2">
								{envEntries.map((entry, idx) => (
									<div key={idx} className="flex items-center gap-2">
										<input
											type="text"
											value={entry.key}
											onChange={(e) => handleEnvChange(idx, "key", e.target.value)}
											placeholder="KEY (e.g. AGENT_MODEL)"
											className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-primary"
										/>
										<span className="text-zinc-500 font-mono">=</span>
										<input
											type="text"
											value={entry.value}
											onChange={(e) => handleEnvChange(idx, "value", e.target.value)}
											placeholder="VALUE"
											className="flex-1 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-primary"
										/>
										<button
											type="button"
											onClick={() => handleRemoveEnv(idx)}
											className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
											title="Hapus variabel"
										>
											<Trash size={14} />
										</button>
									</div>
								))}
							</div>
						)}
					</div>
				</div>

				{/* Footer Actions */}
				<div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-white/10 bg-white/[0.02]">
					<button
						type="button"
						onClick={onClose}
						className="px-3.5 py-2 rounded-xl text-zinc-300 hover:text-white hover:bg-white/5 text-xs font-medium transition-colors"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={handleSave}
						className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all shadow-sm"
					>
						Save to Project (.captr)
					</button>
				</div>
			</div>
		</div>
	);
}
