import {
	Cpu as CpuIcon,
	Desktop as DesktopIcon,
	Folder as FolderIcon,
	FolderOpen as FolderOpenIcon,
	Gear as GearIcon,
	Globe as GlobeIcon,
	Info as InfoIcon,
	Keyboard as KeyboardIcon,
	Moon as MoonIcon,
	Palette as PaletteIcon,
	Sun as SunIcon,
	Terminal as TerminalIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { CaptrLogo } from "@/components/brand/CaptrLogo";
import { ProjectTerminal } from "@/components/terminal/ProjectTerminal";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import type { GlobalAiSettings } from "@/core/timeline/aiTypes";
import type { AppLocale } from "@/i18n/config";
import { SUPPORTED_LOCALES } from "@/i18n/config";
import { getGlobalAiSettings, saveGlobalAiSettings } from "@/lib/appSettings";

const LOCALE_LABELS: Record<string, string> = {
	en: "English",
	es: "Español",
	fr: "Français",
	it: "Italiano",
	nl: "Nederlands",
	ko: "한국어",
	"pt-BR": "Português (Brasil)",
	ru: "Русский",
	"zh-CN": "简体中文",
	"zh-TW": "繁體中文",
};

interface AppSettingsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	defaultTab?: string;
	onOpenShortcuts?: () => void;
}

export function AppSettingsDialog({
	open,
	onOpenChange,
	defaultTab = "general",
	onOpenShortcuts,
}: AppSettingsDialogProps) {
	const { locale, setLocale, t } = useI18n();
	const { preference, setPreference } = useTheme();

	const [projectsDir, setProjectsDir] = useState<string>("");
	const [recordingsDir, setRecordingsDir] = useState<string>("");
	const [activeTab, setActiveTab] = useState(defaultTab);
	const [aiSettings, setAiSettings] = useState<GlobalAiSettings>(getGlobalAiSettings);

	useEffect(() => {
		if (open) {
			setActiveTab(defaultTab);
			void loadDirectories();
			setAiSettings(getGlobalAiSettings());
		}
	}, [open, defaultTab]);

	const handleAiSettingChange = <K extends keyof GlobalAiSettings>(
		key: K,
		value: GlobalAiSettings[K],
	) => {
		const updated = saveGlobalAiSettings({ [key]: value });
		setAiSettings(updated);
	};

	const loadDirectories = async () => {
		try {
			if (window.electronAPI?.getProjectsDirectory) {
				const pRes = await window.electronAPI.getProjectsDirectory();
				setProjectsDir(pRes?.path || "");
			}
			if (window.electronAPI?.getRecordingsDirectory) {
				const rRes = await window.electronAPI.getRecordingsDirectory();
				setRecordingsDir(rRes?.path || "");
			}
		} catch (err) {
			console.warn("Failed to load directories in settings:", err);
		}
	};

	const handleOpenProjectsDir = async () => {
		try {
			await window.electronAPI?.openProjectsDirectory?.();
		} catch (err) {
			console.error("Failed to open projects directory:", err);
		}
	};

	const handleOpenRecordingsDir = async () => {
		try {
			await window.electronAPI?.openRecordingsFolder?.();
		} catch (err) {
			console.error("Failed to open recordings directory:", err);
		}
	};

	const handleChangeRecordingsDir = async () => {
		try {
			const result = await window.electronAPI?.chooseRecordingsDirectory?.();
			if (result?.success && result.path) {
				setRecordingsDir(result.path);
			}
		} catch (err) {
			console.error("Failed to choose recordings directory:", err);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={`transition-all duration-200 ${
					activeTab === "terminal" ? "max-w-4xl" : "max-w-2xl"
				} bg-editor-dialog border border-foreground/10 text-foreground shadow-2xl p-0 overflow-hidden rounded-2xl`}
			>
				<DialogHeader className="px-6 pt-6 pb-2 border-b border-foreground/5 bg-foreground/[0.02]">
					<div className="flex items-center gap-3">
						<div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
							<GearIcon className="w-5 h-5" weight="duotone" />
						</div>
						<div>
							<DialogTitle className="text-lg font-bold tracking-tight text-foreground">
								{t("settings.title", "Captr Studio Preferences")}
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground">
								{t(
									"settings.description",
									"Manage your workspace appearance, directories, and defaults.",
								)}
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				<Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
					<div className="px-6 border-b border-foreground/5 bg-foreground/[0.01]">
						<TabsList className="bg-transparent h-11 p-0 gap-6 border-0">
							<TabsTrigger
								value="general"
								className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 py-2 text-xs font-semibold gap-2 border-b-2 border-transparent transition-all"
							>
								<PaletteIcon className="w-4 h-4" />
								{t("settings.general", "General")}
							</TabsTrigger>
							<TabsTrigger
								value="storage"
								className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 py-2 text-xs font-semibold gap-2 border-b-2 border-transparent transition-all"
							>
								<FolderIcon className="w-4 h-4" />
								{t("settings.storage", "Storage & Folders")}
							</TabsTrigger>
							<TabsTrigger
								value="shortcuts"
								className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 py-2 text-xs font-semibold gap-2 border-b-2 border-transparent transition-all"
							>
								<KeyboardIcon className="w-4 h-4" />
								{t("settings.shortcuts", "Shortcuts")}
							</TabsTrigger>
							<TabsTrigger
								value="ai"
								className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 py-2 text-xs font-semibold gap-2 border-b-2 border-transparent transition-all"
							>
								<CpuIcon className="w-4 h-4" />
								{t("settings.ai", "AI Harness & Models")}
							</TabsTrigger>
							<TabsTrigger
								value="terminal"
								className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 py-2 text-xs font-semibold gap-2 border-b-2 border-transparent transition-all"
							>
								<TerminalIcon className="w-4 h-4" />
								{t("settings.terminal", "Terminal / Dev")}
							</TabsTrigger>
							<TabsTrigger
								value="about"
								className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 py-2 text-xs font-semibold gap-2 border-b-2 border-transparent transition-all"
							>
								<InfoIcon className="w-4 h-4" />
								{t("settings.about", "About")}
							</TabsTrigger>
						</TabsList>
					</div>

					<div
						className={`p-6 ${activeTab === "terminal" ? "p-4 max-h-[600px]" : "max-h-[480px]"} overflow-y-auto`}
					>
						{/* GENERAL TAB */}
						<TabsContent value="general" className="mt-0 space-y-6">
							<div>
								<h3 className="text-sm font-semibold text-foreground mb-1">
									{t("settings.appearance", "Appearance & Theme")}
								</h3>
								<p className="text-xs text-muted-foreground mb-3">
									{t(
										"settings.appearanceDescription",
										"Select your preferred application color theme.",
									)}
								</p>
								<div className="grid grid-cols-3 gap-3 max-w-md">
									<button
										type="button"
										onClick={() => setPreference("dark")}
										className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium gap-2 transition-all ${
											preference === "dark"
												? "border-primary bg-primary/10 text-primary shadow-sm"
												: "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.05] text-muted-foreground"
										}`}
									>
										<MoonIcon
											className="w-5 h-5"
											weight={preference === "dark" ? "fill" : "regular"}
										/>
										<span>{t("settings.darkTheme", "Dark (Obsidian)")}</span>
									</button>
									<button
										type="button"
										onClick={() => setPreference("light")}
										className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium gap-2 transition-all ${
											preference === "light"
												? "border-primary bg-primary/10 text-primary shadow-sm"
												: "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.05] text-muted-foreground"
										}`}
									>
										<SunIcon
											className="w-5 h-5"
											weight={preference === "light" ? "fill" : "regular"}
										/>
										<span>{t("settings.lightTheme", "Light")}</span>
									</button>
									<button
										type="button"
										onClick={() => setPreference("system")}
										className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium gap-2 transition-all ${
											preference === "system"
												? "border-primary bg-primary/10 text-primary shadow-sm"
												: "border-foreground/10 bg-foreground/[0.02] hover:bg-foreground/[0.05] text-muted-foreground"
										}`}
									>
										<DesktopIcon
											className="w-5 h-5"
											weight={preference === "system" ? "fill" : "regular"}
										/>
										<span>{t("settings.systemTheme", "System")}</span>
									</button>
								</div>
							</div>

							<div className="pt-4 border-t border-foreground/5">
								<h3 className="text-sm font-semibold text-foreground mb-1">
									{t("settings.language", "Language / Locale")}
								</h3>
								<p className="text-xs text-muted-foreground mb-3">
									{t(
										"settings.languageDescription",
										"Choose your interface language.",
									)}
								</p>
								<div className="flex items-center gap-3">
									<GlobeIcon className="w-4 h-4 text-muted-foreground" />
									<select
										value={locale}
										onChange={(e) => setLocale(e.target.value as AppLocale)}
										className="h-9 px-3 rounded-lg border border-foreground/15 bg-background text-foreground text-xs font-medium outline-none focus:border-primary transition-colors cursor-pointer"
									>
										{SUPPORTED_LOCALES.map((loc) => (
											<option
												key={loc}
												value={loc}
												className="bg-editor-dialog text-foreground"
											>
												{LOCALE_LABELS[loc] || loc}
											</option>
										))}
									</select>
								</div>
							</div>
						</TabsContent>

						{/* STORAGE TAB */}
						<TabsContent value="storage" className="mt-0 space-y-6">
							<div>
								<h3 className="text-sm font-semibold text-foreground mb-1">
									{t("settings.projectsDirectory", "Projects Directory")}
								</h3>
								<p className="text-xs text-muted-foreground mb-2">
									{t(
										"settings.projectsDirectoryDesc",
										"Location where your Captr Studio project files (.captr) are saved.",
									)}
								</p>
								<div className="flex items-center gap-2">
									<input
										type="text"
										readOnly
										value={projectsDir || "Loading..."}
										className="flex-1 h-9 px-3 rounded-lg border border-foreground/15 bg-foreground/[0.03] text-foreground text-xs font-mono select-all outline-none"
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleOpenProjectsDir}
										className="h-9 px-3 gap-1.5 rounded-lg border-foreground/15 text-xs font-medium"
									>
										<FolderOpenIcon className="w-4 h-4" />
										{t("settings.openFolder", "Open Folder")}
									</Button>
								</div>
							</div>

							<div className="pt-4 border-t border-foreground/5">
								<h3 className="text-sm font-semibold text-foreground mb-1">
									{t("settings.recordingsDirectory", "Recordings Directory")}
								</h3>
								<p className="text-xs text-muted-foreground mb-2">
									{t(
										"settings.recordingsDirectoryDesc",
										"Location where screen capture takes and audio recordings are stored.",
									)}
								</p>
								<div className="flex items-center gap-2">
									<input
										type="text"
										readOnly
										value={recordingsDir || "Loading..."}
										className="flex-1 h-9 px-3 rounded-lg border border-foreground/15 bg-foreground/[0.03] text-foreground text-xs font-mono select-all outline-none"
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleChangeRecordingsDir}
										className="h-9 px-3 gap-1.5 rounded-lg border-foreground/15 text-xs font-medium"
									>
										{t("settings.change", "Change...")}
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={handleOpenRecordingsDir}
										className="h-9 px-3 gap-1.5 rounded-lg border-foreground/15 text-xs font-medium"
									>
										<FolderOpenIcon className="w-4 h-4" />
										{t("settings.openFolder", "Open Folder")}
									</Button>
								</div>
							</div>
						</TabsContent>

						{/* SHORTCUTS TAB */}
						<TabsContent value="shortcuts" className="mt-0 space-y-4">
							<div className="flex items-center justify-between">
								<div>
									<h3 className="text-sm font-semibold text-foreground">
										{t("settings.keyboardShortcuts", "Keyboard Shortcuts")}
									</h3>
									<p className="text-xs text-muted-foreground">
										{t(
											"settings.shortcutsDesc",
											"Quick actions to speed up your editing workflow.",
										)}
									</p>
								</div>
								{onOpenShortcuts && (
									<Button
										type="button"
										variant="outline"
										size="sm"
										onClick={() => {
											onOpenChange(false);
											onOpenShortcuts();
										}}
										className="h-8 px-3 rounded-lg border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold"
									>
										{t("settings.customizeShortcuts", "Customize Keybindings")}
									</Button>
								)}
							</div>

							<div className="rounded-xl border border-foreground/10 bg-foreground/[0.02] divide-y divide-foreground/5 text-xs">
								<div className="flex items-center justify-between px-3.5 py-2.5">
									<span className="text-foreground/90 font-medium">
										New Project
									</span>
									<kbd className="px-2 py-0.5 rounded bg-foreground/10 text-[11px] font-mono font-semibold">
										Ctrl + N
									</kbd>
								</div>
								<div className="flex items-center justify-between px-3.5 py-2.5">
									<span className="text-foreground/90 font-medium">
										Open Project
									</span>
									<kbd className="px-2 py-0.5 rounded bg-foreground/10 text-[11px] font-mono font-semibold">
										Ctrl + O
									</kbd>
								</div>
								<div className="flex items-center justify-between px-3.5 py-2.5">
									<span className="text-foreground/90 font-medium">
										Save Project
									</span>
									<kbd className="px-2 py-0.5 rounded bg-foreground/10 text-[11px] font-mono font-semibold">
										Ctrl + S
									</kbd>
								</div>
								<div className="flex items-center justify-between px-3.5 py-2.5">
									<span className="text-foreground/90 font-medium">
										Save As Project
									</span>
									<kbd className="px-2 py-0.5 rounded bg-foreground/10 text-[11px] font-mono font-semibold">
										Ctrl + Shift + S
									</kbd>
								</div>
								<div className="flex items-center justify-between px-3.5 py-2.5">
									<span className="text-foreground/90 font-medium">
										Play / Pause Timeline
									</span>
									<kbd className="px-2 py-0.5 rounded bg-foreground/10 text-[11px] font-mono font-semibold">
										Space
									</kbd>
								</div>
								<div className="flex items-center justify-between px-3.5 py-2.5">
									<span className="text-foreground/90 font-medium">
										Split Clip at Playhead
									</span>
									<kbd className="px-2 py-0.5 rounded bg-foreground/10 text-[11px] font-mono font-semibold">
										S
									</kbd>
								</div>
								<div className="flex items-center justify-between px-3.5 py-2.5">
									<span className="text-foreground/90 font-medium">
										Delete Selected Clip
									</span>
									<kbd className="px-2 py-0.5 rounded bg-foreground/10 text-[11px] font-mono font-semibold">
										Delete / Backspace
									</kbd>
								</div>
								<div className="flex items-center justify-between px-3.5 py-2.5">
									<span className="text-foreground/90 font-medium">
										Export Video
									</span>
									<kbd className="px-2 py-0.5 rounded bg-foreground/10 text-[11px] font-mono font-semibold">
										Ctrl + E
									</kbd>
								</div>
							</div>
						</TabsContent>

						{/* AI HARNESS & MODELS TAB */}
						<TabsContent value="ai" className="mt-0 space-y-6">
							<div>
								<h3 className="text-sm font-semibold text-foreground mb-1">
									{t("settings.aiHarnessTitle", "AI Harness & Orchestration")}
								</h3>
								<p className="text-xs text-muted-foreground mb-4">
									{t(
										"settings.aiHarnessDesc",
										"Configure the local CLI runner, model parameters, and speculative preview.",
									)}
								</p>

								<div className="space-y-4">
									{/* Preferred Runner */}
									<div>
										<label
											htmlFor="ai-preferred-runner"
											className="block text-xs font-medium text-foreground mb-1.5"
										>
											{t("settings.aiRunner", "Preferred Runner")}
										</label>
										<select
											id="ai-preferred-runner"
											name="preferredRunner"
											value={aiSettings.preferredRunner}
											onChange={(e) =>
												handleAiSettingChange(
													"preferredRunner",
													e.target
														.value as GlobalAiSettings["preferredRunner"],
												)
											}
											className="w-full h-9 px-3 rounded-lg border border-foreground/15 bg-background text-foreground text-xs font-medium outline-none focus:border-primary transition-colors cursor-pointer"
										>
											<option
												value="agy"
												className="bg-editor-dialog text-foreground"
											>
												Antigravity CLI (Default)
											</option>
											<option
												value="opencode"
												className="bg-editor-dialog text-foreground"
											>
												OpenCode Interpreter
											</option>
											<option
												value="hermes"
												className="bg-editor-dialog text-foreground"
											>
												Hermes Agent
											</option>
											<option
												value="cursor"
												className="bg-editor-dialog text-foreground"
											>
												Cursor CLI
											</option>
											<option
												value="custom"
												className="bg-editor-dialog text-foreground"
											>
												Custom CLI / Binary
											</option>
										</select>
										<p className="text-[11px] text-muted-foreground mt-1">
											{t(
												"settings.aiRunnerDesc",
												"The harness executable invoked for multimodal timeline edits.",
											)}
										</p>
									</div>

									{/* Custom CLI Path (Visible when runner is 'custom') */}
									{aiSettings.preferredRunner === "custom" && (
										<div>
											<label
												htmlFor="ai-custom-runner-path"
												className="block text-xs font-medium text-foreground mb-1.5"
											>
												{t(
													"settings.aiCustomRunnerPath",
													"Custom CLI Executable Path",
												)}
											</label>
											<input
												id="ai-custom-runner-path"
												type="text"
												name="customRunnerPath"
												value={aiSettings.customRunnerPath ?? ""}
												onChange={(e) =>
													handleAiSettingChange(
														"customRunnerPath",
														e.target.value,
													)
												}
												placeholder="C:\tools\agent.exe or /usr/local/bin/agent"
												className="w-full h-9 px-3 rounded-lg border border-foreground/15 bg-foreground/[0.03] text-foreground text-xs font-mono outline-none focus:border-primary transition-colors"
											/>
											<p className="text-[11px] text-muted-foreground mt-1">
												{t(
													"settings.aiCustomRunnerPathDesc",
													"Absolute filesystem path to the agent binary.",
												)}
											</p>
										</div>
									)}

									{/* Default Model */}
									<div>
										<label
											htmlFor="ai-default-model"
											className="block text-xs font-medium text-foreground mb-1.5"
										>
											{t("settings.aiDefaultModel", "Default Model")}
										</label>
										<input
											id="ai-default-model"
											type="text"
											name="defaultModel"
											value={aiSettings.defaultModel}
											onChange={(e) =>
												handleAiSettingChange(
													"defaultModel",
													e.target.value,
												)
											}
											placeholder="gemini-1.5-pro"
											className="w-full h-9 px-3 rounded-lg border border-foreground/15 bg-foreground/[0.03] text-foreground text-xs font-mono outline-none focus:border-primary transition-colors"
										/>
										<p className="text-[11px] text-muted-foreground mt-1">
											{t(
												"settings.aiDefaultModelDesc",
												"Model identifier passed to the runner (e.g. gemini-1.5-pro, claude-3-5-sonnet, gpt-4o).",
											)}
										</p>
									</div>

									{/* MCP Server Port */}
									<div>
										<label
											htmlFor="ai-mcp-port"
											className="block text-xs font-medium text-foreground mb-1.5"
										>
											{t("settings.aiMcpPort", "MCP Server Port")}
										</label>
										<input
											id="ai-mcp-port"
											type="number"
											name="mcpServerPort"
											min={1024}
											max={65535}
											value={aiSettings.mcpServerPort}
											onChange={(e) =>
												handleAiSettingChange(
													"mcpServerPort",
													parseInt(e.target.value, 10) || 4040,
												)
											}
											className="w-40 h-9 px-3 rounded-lg border border-foreground/15 bg-foreground/[0.03] text-foreground text-xs font-mono outline-none focus:border-primary transition-colors"
										/>
										<p className="text-[11px] text-muted-foreground mt-1">
											{t(
												"settings.aiMcpPortDesc",
												"Local WebSocket/HTTP port for Model Context Protocol communication (default 4040).",
											)}
										</p>
									</div>

									{/* Toggle Options: Ghost Preview & Auto-MCP Server */}
									<div className="pt-2 border-t border-foreground/5 space-y-3">
										<div className="flex items-center justify-between">
											<div>
												<label
													htmlFor="ai-ghost-preview"
													className="text-xs font-medium text-foreground block cursor-pointer"
												>
													{t(
														"settings.aiGhostPreview",
														"Speculative Ghost Preview",
													)}
												</label>
												<p className="text-[11px] text-muted-foreground">
													{t(
														"settings.aiGhostPreviewDesc",
														"Render tentative AI modifications as non-destructive ghost clips before accepting.",
													)}
												</p>
											</div>
											<Switch
												id="ai-ghost-preview"
												name="enableGhostPreview"
												checked={aiSettings.enableGhostPreview}
												onCheckedChange={(checked) =>
													handleAiSettingChange(
														"enableGhostPreview",
														checked,
													)
												}
											/>
										</div>

										<div className="flex items-center justify-between">
											<div>
												<label
													htmlFor="ai-auto-mcp"
													className="text-xs font-medium text-foreground block cursor-pointer"
												>
													{t(
														"settings.aiAutoMcp",
														"Auto-start MCP Server",
													)}
												</label>
												<p className="text-[11px] text-muted-foreground">
													{t(
														"settings.aiAutoMcpDesc",
														"Automatically launch the background MCP daemon when Captr Studio starts.",
													)}
												</p>
											</div>
											<Switch
												id="ai-auto-mcp"
												name="enableAutoMcpServer"
												checked={aiSettings.enableAutoMcpServer}
												onCheckedChange={(checked) =>
													handleAiSettingChange(
														"enableAutoMcpServer",
														checked,
													)
												}
											/>
										</div>
									</div>
								</div>
							</div>
						</TabsContent>

						{/* ABOUT TAB */}
						<TabsContent value="about" className="mt-0 space-y-5">
							<div className="flex flex-col items-center text-center p-6 rounded-2xl border border-foreground/10 bg-foreground/[0.02]">
								<div className="mb-3">
									<CaptrLogo variant="icon" size={64} animateGlow />
								</div>
								<h2 className="text-lg font-bold tracking-tight text-foreground">
									Captr Studio
								</h2>
								<div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/15 border border-primary/20 text-primary text-[11px] font-semibold mt-1">
									<span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
									Version 2.4.0 (Obsidian Edition)
								</div>
								<p className="text-xs text-muted-foreground mt-3 max-w-sm leading-relaxed">
									Professional screen recording, aperture camera framing, and
									precision video studio designed for macOS and Windows.
								</p>
							</div>

							<div className="grid grid-cols-2 gap-3 text-xs">
								<div className="p-3 rounded-xl border border-foreground/10 bg-foreground/[0.02]">
									<span className="text-muted-foreground block text-[11px]">
										Core Engine
									</span>
									<span className="font-semibold text-foreground">
										Electron + React + WebGPU
									</span>
								</div>
								<div className="p-3 rounded-xl border border-foreground/10 bg-foreground/[0.02]">
									<span className="text-muted-foreground block text-[11px]">
										Video Pipeline
									</span>
									<span className="font-semibold text-foreground">
										FFmpeg Hardware Accelerated
									</span>
								</div>
							</div>
						</TabsContent>

						{/* TERMINAL / DEV TAB */}
						<TabsContent value="terminal" className="mt-0">
							<ProjectTerminal />
						</TabsContent>
					</div>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
