import {
	ArrowsClockwise as ArrowsClockwiseIcon,
	Check as CheckIcon,
	CircleNotch as CircleNotchIcon,
	Code as CodeIcon,
	CodeSimple as CodeSimpleIcon,
	Compass as CompassIcon,
	Cpu as CpuIcon,
	Cube as CubeIcon,
	Desktop as DesktopIcon,
	FloppyDisk as FloppyDiskIcon,
	Folder as FolderIcon,
	FolderOpen as FolderOpenIcon,
	Gear as GearIcon,
	Globe as GlobeIcon,
	Info as InfoIcon,
	Keyboard as KeyboardIcon,
	Lightning as LightningIcon,
	Moon as MoonIcon,
	Palette as PaletteIcon,
	PaperPlaneRight as PaperPlaneRightIcon,
	Plugs as PlugsIcon,
	Robot as RobotIcon,
	Sparkle as SparkleIcon,
	Sun as SunIcon,
	Terminal as TerminalIcon,
	Wrench as WrenchIcon,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { CaptrLogo } from "@/components/brand/CaptrLogo";
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

const AI_PROVIDERS = [
	{ id: "agy", name: "Antigravity", command: "agy", icon: SparkleIcon },
	{ id: "claude", name: "Claude Code", command: "claude", icon: CpuIcon },
	{ id: "opencode", name: "OpenCode", command: "opencode", icon: TerminalIcon },
	{ id: "cursor", name: "Cursor", command: "cursor", icon: CompassIcon },
	{ id: "codex", name: "Codex", command: "codex", icon: CodeIcon },
	{ id: "devin", name: "Devin", command: "devin", icon: RobotIcon },
	{ id: "hermes", name: "Hermes", command: "hermes", icon: LightningIcon },
	{ id: "cline", name: "Cline", command: "cline", icon: CodeSimpleIcon },
	{ id: "kiro", name: "Kiro", command: "kiro", icon: CubeIcon },
	{ id: "trae", name: "Trae", command: "trae", icon: PlugsIcon },
	{ id: "custom", name: "Custom CLI", command: "", icon: WrenchIcon },
] as const;

const RUNNER_MODEL_PRESETS: Record<string, string[]> = {
	agy: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash", "claude-3-5-sonnet"],
	claude: ["claude-3-5-sonnet", "claude-3-5-haiku", "claude-3-opus"],
	opencode: ["gpt-4o", "claude-3-5-sonnet", "gemini-1.5-pro", "deepseek-chat"],
	cursor: ["claude-3-5-sonnet", "gpt-4o", "cursor-small"],
	codex: ["o1-preview", "o1-mini", "gpt-4o"],
	devin: ["devin-standard", "gpt-4o"],
	hermes: ["hermes-3-llama-3.1-8b", "hermes-3-llama-3.1-70b"],
	cline: ["claude-3-5-sonnet", "gpt-4o", "gemini-1.5-pro"],
	kiro: ["claude-3-5-sonnet", "gpt-4o"],
	trae: ["claude-3-5-sonnet", "gpt-4o"],
	custom: [],
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
	const [detectedAgents, setDetectedAgents] = useState<
		Array<{ id: string; name: string; command: string; available: boolean; executablePath?: string }>
	>([]);
	const [isScanningAgents, setIsScanningAgents] = useState(false);
	const [testPrompt, setTestPrompt] = useState("Halo, tes koneksi Captr Studio");
	const [isTestingConnection, setIsTestingConnection] = useState(false);
	const [testChatMessages, setTestChatMessages] = useState<
		Array<{ sender: "user" | "agent"; text: string; latencyMs?: number; isError?: boolean }>
	>([]);
	const [availableModelsByRunner, setAvailableModelsByRunner] =
		useState<Record<string, string[]>>(RUNNER_MODEL_PRESETS);
	const [isFetchingModels, setIsFetchingModels] = useState(false);
	const [isCustomModelInputOpen, setIsCustomModelInputOpen] = useState(false);
	const [saveStatus, setSaveStatus] = useState<"idle" | "saved">("idle");

	const scanAvailableAgents = async () => {
		if (!window.electronAPI?.getAvailableAgents) return;
		setIsScanningAgents(true);
		try {
			const res = await window.electronAPI.getAvailableAgents();
			if (Array.isArray(res)) {
				setDetectedAgents(res);
			}
		} catch (err) {
			console.warn("Failed to detect CLI agents:", err);
		} finally {
			setIsScanningAgents(false);
		}
	};

	useEffect(() => {
		if (open) {
			setActiveTab(defaultTab);
			void loadDirectories();
			setAiSettings(getGlobalAiSettings());
			void scanAvailableAgents();
		}
	}, [open, defaultTab]);

	const handleAiSettingChange = <K extends keyof GlobalAiSettings>(
		key: K,
		value: GlobalAiSettings[K],
	) => {
		const updated = saveGlobalAiSettings({ [key]: value });
		setAiSettings(updated);
	};

	const handleSelectRunner = (runnerId: string) => {
		handleAiSettingChange("preferredRunner", runnerId as any);
		const presets = availableModelsByRunner[runnerId] || RUNNER_MODEL_PRESETS[runnerId];
		if (presets && presets.length > 0 && !presets.includes(aiSettings.defaultModel)) {
			handleAiSettingChange("defaultModel", presets[0]);
			setIsCustomModelInputOpen(false);
		}
	};

	const handleFetchModels = async () => {
		if (isFetchingModels) return;
		const runnerId = aiSettings.preferredRunner;
		const customCmd = aiSettings.customRunnerPath;
		setIsFetchingModels(true);
		try {
			if (window.electronAPI?.fetchAgentModels) {
				const res = await window.electronAPI.fetchAgentModels({
					agentId: runnerId,
					customCommand: customCmd,
				});
				if (res.success && res.models && res.models.length > 0) {
					setAvailableModelsByRunner((prev) => ({
						...prev,
						[runnerId]: Array.from(new Set([...res.models, ...(prev[runnerId] || [])])),
					}));
					if (!res.models.includes(aiSettings.defaultModel)) {
						handleAiSettingChange("defaultModel", res.models[0]);
						setIsCustomModelInputOpen(false);
					}
					setTestChatMessages((prev) => [
						...prev,
						{
							sender: "agent",
							text: `[${runnerId}] Berhasil mendeteksi ${res.models.length} model dari /model:\n${res.models.join(", ")}`,
						},
					]);
				} else {
					setTestChatMessages((prev) => [
						...prev,
						{
							sender: "agent",
							text: `[${runnerId}] ${res.error || "Tidak ada model yang terdeteksi dari /model. Menggunakan preset standar."}`,
							isError: true,
						},
					]);
				}
			}
		} catch (err) {
			console.warn("Failed to fetch models via /model:", err);
		} finally {
			setIsFetchingModels(false);
		}
	};

	const handleSaveAiSettings = () => {
		saveGlobalAiSettings(aiSettings);
		setSaveStatus("saved");
		setTimeout(() => setSaveStatus("idle"), 3000);
	};

	const handleRunTestConnection = async () => {
		const prompt = testPrompt.trim();
		if (!prompt || isTestingConnection) return;
		setIsTestingConnection(true);
		setTestChatMessages((prev) => [...prev, { sender: "user", text: prompt }]);

		try {
			if (window.electronAPI?.testAgentConnection) {
				const res = await window.electronAPI.testAgentConnection({
					agentId: aiSettings.preferredRunner,
					customCommand: aiSettings.customRunnerPath,
					model: aiSettings.defaultModel,
					prompt,
				});
				if (res.success) {
					setTestChatMessages((prev) => [
						...prev,
						{
							sender: "agent",
							text: res.response || "Koneksi berhasil.",
							latencyMs: res.latencyMs,
							isError: false,
						},
					]);
				} else {
					setTestChatMessages((prev) => [
						...prev,
						{
							sender: "agent",
							text: res.error || "Gagal menghubungi CLI provider.",
							latencyMs: res.latencyMs,
							isError: true,
						},
					]);
				}
			} else {
				setTestChatMessages((prev) => [
					...prev,
					{
						sender: "agent",
						text: "Electron API testAgentConnection tidak tersedia di environment ini.",
						isError: true,
					},
				]);
			}
		} catch (err) {
			setTestChatMessages((prev) => [
				...prev,
				{
					sender: "agent",
					text: err instanceof Error ? err.message : String(err),
					isError: true,
				},
			]);
		} finally {
			setIsTestingConnection(false);
		}
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
				className="transition-all duration-200 w-[94vw] max-w-4xl bg-editor-dialog border border-foreground/10 text-foreground shadow-2xl p-0 overflow-hidden rounded-2xl"
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
					<div className="px-6 border-b border-foreground/5 bg-foreground/[0.01] overflow-x-auto no-scrollbar">
						<TabsList className="bg-transparent h-11 p-0 gap-4 sm:gap-6 border-0 whitespace-nowrap min-w-max">
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
								value="about"
								className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-1 py-2 text-xs font-semibold gap-2 border-b-2 border-transparent transition-all"
							>
								<InfoIcon className="w-4 h-4" />
								{t("settings.about", "About")}
							</TabsTrigger>
						</TabsList>
					</div>

					<div
						className="p-6 max-h-[80vh] min-h-[520px] overflow-y-auto"
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
									{/* Preferred Runner - Icon-based Cards & Auto-Detection */}
									<div>
										<div className="flex items-center justify-between mb-2">
											<div>
												<label className="block text-xs font-semibold text-foreground">
													{t("settings.aiRunner", "AI Providers")}
												</label>
												<p className="text-[11px] text-muted-foreground">
													{t(
														"settings.aiRunnerDesc",
														"Pilih provider CLI yang terpasang di perangkat Anda sebagai engine AI.",
													)}
												</p>
											</div>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => void scanAvailableAgents()}
												disabled={isScanningAgents}
												className="h-7 px-2.5 gap-1.5 rounded-lg border-foreground/15 text-[11px] font-medium"
											>
												<ArrowsClockwiseIcon
													className={`w-3.5 h-3.5 ${
														isScanningAgents ? "animate-spin text-primary" : ""
													}`}
												/>
												{isScanningAgents
													? t("settings.scanning", "Scanning...")
													: t("settings.scanTools", "Detect Tools")}
											</Button>
										</div>

										{/* Hidden accessible select to preserve form/test compatibility */}
										<select
											id="ai-preferred-runner"
											name="preferredRunner"
											value={aiSettings.preferredRunner}
											onChange={(e) => handleSelectRunner(e.target.value)}
											className="sr-only"
											tabIndex={-1}
											aria-hidden="true"
										>
											{AI_PROVIDERS.map((p) => (
												<option key={p.id} value={p.id}>
													{p.name}
												</option>
											))}
										</select>

										{/* Provider Cards Grid with Icons */}
										<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
											{AI_PROVIDERS.map((provider) => {
												const isSelected =
													aiSettings.preferredRunner === provider.id;
												const isAvailable = detectedAgents.some(
													(a) => a.id === provider.id && a.available,
												);
												const IconComponent = provider.icon;
												return (
													<button
														key={provider.id}
														type="button"
														data-runner={provider.id}
														onClick={() => handleSelectRunner(provider.id)}
														className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all relative ${
															isSelected
																? "border-primary bg-primary/10 text-foreground shadow-sm ring-1 ring-primary/40"
																: "border-foreground/15 bg-foreground/[0.02] text-foreground/80 hover:bg-foreground/[0.05] hover:border-foreground/30"
														}`}
													>
														<div className="flex items-center justify-between w-full mb-1.5">
															<div
																className={`p-1.5 rounded-lg ${
																	isSelected
																		? "bg-primary/20 text-primary"
																		: "bg-foreground/10 text-foreground/70"
																}`}
															>
																<IconComponent className="w-4 h-4" />
															</div>
															{provider.id !== "custom" && (
																<span
																	className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
																		isAvailable
																			? "bg-emerald-500/15 text-emerald-400"
																			: "bg-foreground/5 text-muted-foreground"
																	}`}
																>
																	<span
																		className={`w-1.5 h-1.5 rounded-full ${
																			isAvailable
																				? "bg-emerald-500"
																				: "bg-foreground/30"
																		}`}
																	/>
																	{isAvailable ? "Ready" : "Not found"}
																</span>
															)}
														</div>
														<span className="text-xs font-semibold leading-tight line-clamp-1">
															{provider.name}
														</span>
														<span className="text-[10px] text-muted-foreground mt-0.5 font-mono">
															{provider.command || "custom path"}
														</span>
													</button>
												);
											})}
										</div>
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

									{/* Default Model with Dynamic /model Discovery */}
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<div>
												<label
													htmlFor="ai-default-model-select"
													className="block text-xs font-semibold text-foreground"
												>
													{t("settings.aiDefaultModel", "Default Model")}
												</label>
												<p className="text-[11px] text-muted-foreground">
													{t(
														"settings.aiDefaultModelDesc",
														"Model yang digunakan otomatis oleh seluruh fitur AI di Captr Studio.",
													)}
												</p>
											</div>
											<Button
												type="button"
												variant="outline"
												size="sm"
												onClick={() => void handleFetchModels()}
												disabled={isFetchingModels}
												className="h-8 px-2.5 text-xs gap-1.5 rounded-lg border-foreground/15 hover:bg-foreground/5 text-foreground shrink-0"
												title="Jalankan /model pada CLI provider untuk memeriksa model yang tersedia"
											>
												<ArrowsClockwiseIcon
													className={`w-3.5 h-3.5 ${isFetchingModels ? "animate-spin text-primary" : ""}`}
												/>
												{isFetchingModels ? "Mengecek /model..." : "Cek Model (/model)"}
											</Button>
										</div>

										<div className="space-y-2">
											<select
												id="ai-default-model-select"
												name="defaultModel"
												value={
													(
														availableModelsByRunner[aiSettings.preferredRunner] || []
													).includes(aiSettings.defaultModel)
														? aiSettings.defaultModel
														: "custom"
												}
												onChange={(e) => {
													if (e.target.value === "custom") {
														setIsCustomModelInputOpen(true);
													} else {
														setIsCustomModelInputOpen(false);
														handleAiSettingChange("defaultModel", e.target.value);
													}
												}}
												className="w-full h-9 px-3 rounded-lg border border-foreground/15 bg-background text-foreground text-xs font-mono outline-none focus:border-primary transition-colors cursor-pointer"
											>
												{(availableModelsByRunner[aiSettings.preferredRunner] || []).map(
													(m) => (
														<option
															key={m}
															value={m}
															className="bg-editor-dialog text-foreground font-mono"
														>
															{m}
														</option>
													),
												)}
												<option
													value="custom"
													className="bg-editor-dialog text-foreground italic"
												>
													+ Input Model Kustom...
												</option>
											</select>

											{(isCustomModelInputOpen ||
												!(
													availableModelsByRunner[aiSettings.preferredRunner] || []
												).includes(aiSettings.defaultModel)) && (
												<div className="space-y-1">
													<input
														id="ai-default-model-custom"
														type="text"
														name="defaultModelCustom"
														value={aiSettings.defaultModel}
														onChange={(e) =>
															handleAiSettingChange("defaultModel", e.target.value)
														}
														placeholder="Ketik model identifier kustom (misal: claude-3-7-sonnet)"
														className="w-full h-9 px-3 rounded-lg border border-primary/40 bg-foreground/[0.03] text-foreground text-xs font-mono outline-none focus:border-primary transition-colors"
													/>
													<span className="text-[10px] text-muted-foreground block">
														Model kustom disimpan otomatis ke konfigurasi AI Captr Studio.
													</span>
												</div>
											)}
										</div>
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

									{/* Mini Test Provider Connection Chat Panel */}
									<div className="pt-4 border-t border-foreground/10 space-y-3">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<div className="p-1.5 rounded-lg bg-primary/10 text-primary">
													<LightningIcon className="w-4 h-4" />
												</div>
												<div>
													<h4 className="text-xs font-semibold text-foreground">
														Test Provider Connection
													</h4>
													<p className="text-[11px] text-muted-foreground">
														Uji konektivitas CLI dan model aktif sebelum mulai mengedit.
													</p>
												</div>
											</div>
											<span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-foreground/5 text-muted-foreground shrink-0 border border-foreground/5">
												{aiSettings.preferredRunner} • {aiSettings.defaultModel}
											</span>
										</div>

										{/* Chat Log Window */}
										<div className="rounded-xl border border-foreground/10 bg-black/25 p-3.5 min-h-[110px] max-h-[220px] overflow-y-auto space-y-2 text-xs font-mono">
											{testChatMessages.length === 0 ? (
												<div className="flex items-center justify-center h-full py-4 text-muted-foreground text-[11px] italic">
													Pilih provider di atas dan kirim pesan tes untuk memverifikasi respon CLI.
												</div>
											) : (
												testChatMessages.map((msg, i) => (
													<div
														key={i}
														className={`flex flex-col gap-0.5 ${
															msg.sender === "user" ? "items-end" : "items-start"
														}`}
													>
														<span className="text-[10px] text-muted-foreground uppercase font-semibold">
															{msg.sender === "user" ? "You" : aiSettings.preferredRunner}
															{msg.latencyMs !== undefined && ` (${msg.latencyMs}ms)`}
														</span>
														<div
															className={`px-3 py-1.5 rounded-lg max-w-[85%] whitespace-pre-wrap ${
																msg.sender === "user"
																	? "bg-primary/20 text-primary border border-primary/30"
																	: msg.isError
																		? "bg-destructive/15 text-destructive border border-destructive/30"
																		: "bg-foreground/10 text-foreground border border-foreground/15"
															}`}
														>
															{msg.text}
														</div>
													</div>
												))
											)}
										</div>

										{/* Test Input Row */}
										<div className="flex items-center gap-2">
											<input
												type="text"
												value={testPrompt}
												onChange={(e) => setTestPrompt(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter") {
														e.preventDefault();
														void handleRunTestConnection();
													}
												}}
												placeholder="Halo, tes koneksi Captr Studio"
												className="flex-1 h-9 px-3 rounded-lg border border-foreground/15 bg-foreground/[0.03] text-foreground text-xs font-mono outline-none focus:border-primary transition-colors"
											/>
											<Button
												type="button"
												variant="default"
												size="sm"
												onClick={() => void handleRunTestConnection()}
												disabled={isTestingConnection || !testPrompt.trim()}
												className="h-9 px-4 gap-1.5 rounded-lg text-xs font-medium shrink-0"
											>
												{isTestingConnection ? (
													<>
														<CircleNotchIcon className="w-4 h-4 animate-spin" />
														Testing...
													</>
												) : (
													<>
														<PaperPlaneRightIcon className="w-4 h-4" />
														Test Connection
													</>
												)}
											</Button>
										</div>
									</div>

									{/* Save Configuration Action Bar */}
									<div className="pt-4 border-t border-foreground/10 flex items-center justify-between gap-4">
										<div className="flex items-center gap-2">
											{saveStatus === "saved" ? (
												<div className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
													<CheckIcon className="w-4 h-4 text-green-500" />
													<span>Konfigurasi AI berhasil disimpan &amp; aktif!</span>
												</div>
											) : (
												<span className="text-[11px] text-muted-foreground">
													{t(
														"settings.aiSaveNote",
														"Konfigurasi aktif di seluruh fitur AI Captr Studio.",
													)}
												</span>
											)}
										</div>
										<Button
											type="button"
											variant="default"
											size="sm"
											onClick={handleSaveAiSettings}
											className="h-9 px-4 gap-2 rounded-lg text-xs font-semibold shadow-sm shrink-0"
										>
											{saveStatus === "saved" ? (
												<>
													<CheckIcon className="w-4 h-4" />
													Tersimpan
												</>
											) : (
												<>
													<FloppyDiskIcon className="w-4 h-4" />
													Simpan Konfigurasi
												</>
											)}
										</Button>
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
					</div>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
