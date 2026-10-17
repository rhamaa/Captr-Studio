import { useCallback, useEffect, useState } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import type { RecordingFrameAppearance, WindowHeaderStyle } from "../schema";
import {
	type RecordingFramePreset,
	STARTER_FRAME_PRESETS,
} from "./recordingFramePresets";

export type RecordingFrameTarget = "window" | "webcam";
type PresetLibraryApi = Window["electronAPI"]["recordFramePresets"];

export interface RecordingFrameAppearancePanelProps {
	target: RecordingFrameTarget;
	appearance: RecordingFrameAppearance;
	onChange: (target: RecordingFrameTarget, appearance: RecordingFrameAppearance) => void;
	onTargetChange?: (target: RecordingFrameTarget) => void;
	presetLibrary: PresetLibraryApi;
}

type PresetActionResponse<T> =
	| { success: true; value: T }
	| { success: true; canceled: true }
	| { success: false; error: string };

export type PresetActionOutcome<T> =
	| { status: "success"; value: T }
	| { status: "canceled" }
	| { status: "error"; message: string };

type AppearancePatch = Partial<Omit<RecordingFrameAppearance, "shadow">> & {
	shadow?: Partial<RecordingFrameAppearance["shadow"]>;
};

export function mergeRecordingFrameAppearance(
	appearance: RecordingFrameAppearance,
	patch: AppearancePatch,
): RecordingFrameAppearance {
	return {
		...appearance,
		...patch,
		shadow: { ...appearance.shadow, ...patch.shadow },
	};
}

export function applyRecordingFramePreset(
	target: RecordingFrameTarget,
	preset: RecordingFramePreset,
	onChange: (target: RecordingFrameTarget, appearance: RecordingFrameAppearance) => void,
): void {
	onChange(target, structuredClone(preset.appearance));
}

export function saveRecordingFramePresetSnapshot(
	save: PresetLibraryApi["save"],
	name: string,
	appearance: RecordingFrameAppearance,
) {
	return save(name, structuredClone(appearance));
}

export async function runRecordingFramePresetAction<T>(
	action: () => Promise<PresetActionResponse<T>>,
	fallback: string,
): Promise<PresetActionOutcome<T>> {
	try {
		const result = await action();
		if (!result.success) return { status: "error", message: result.error };
		if ("canceled" in result) return { status: "canceled" };
		return { status: "success", value: result.value };
	} catch {
		return { status: "error", message: fallback };
	}
}

function toHexColor(colorStr: string | undefined): string {
	if (!colorStr) return "#000000";
	const trimmed = colorStr.trim();
	if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
	if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
		return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
	}
	return "#000000";
}

export function RecordingFrameAppearancePanel({
	target,
	appearance,
	onChange,
	onTargetChange,
	presetLibrary,
}: RecordingFrameAppearancePanelProps) {
	const t = useScopedT("editor");
	const targetLabel = t(
		`recordingFrameAppearance.${target}`,
		target === "window" ? "Window" : "Webcam",
	);
	const title = `${t("recordingFrameAppearance.title", "Frame appearance")} · ${targetLabel}`;
	const [presets, setPresets] = useState<RecordingFramePreset[]>([]);
	const [selectedPresetId, setSelectedPresetId] = useState("");
	const [presetName, setPresetName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const selectedPreset = presets.find((preset) => preset.id === selectedPresetId);

	const loadPresets = useCallback(
		async (preferredId?: string) => {
			const outcome = await runRecordingFramePresetAction(
				() => presetLibrary.list(),
				t("recordingFrameAppearance.loadError", "Could not load frame presets."),
			);
			if (outcome.status === "error") {
				setError(outcome.message);
				return;
			}
			if (outcome.status !== "success") return;
			setPresets(outcome.value);
			const next =
				outcome.value.find((preset) => preset.id === preferredId) ?? outcome.value[0];
			setSelectedPresetId(next?.id ?? "");
			setPresetName(next?.name ?? "");
		},
		[presetLibrary, t],
	);

	useEffect(() => {
		void loadPresets();
	}, [loadPresets]);

	const runAction = async <T,>(
		action: () => Promise<PresetActionResponse<T>>,
		fallback: string,
	): Promise<PresetActionOutcome<T>> => {
		setBusy(true);
		setError(null);
		const outcome = await runRecordingFramePresetAction(action, fallback);
		setBusy(false);
		if (outcome.status === "error") setError(outcome.message);
		return outcome;
	};

	const updateAppearance = (patch: AppearancePatch) => {
		onChange(target, mergeRecordingFrameAppearance(appearance, patch));
	};

	const numberField = (
		value: number,
		labelKey: string,
		fallback: string,
		onValue: (value: number) => void,
		min?: number,
		max?: number,
		unit = "px",
		step = 1,
	) => {
		const label = t(`recordingFrameAppearance.${labelKey}`, fallback);
		return (
			<label className="flex flex-col gap-1.5 text-xs" key={labelKey}>
				<span className="flex items-center justify-between">
					<span className="font-medium text-foreground/80">{label}</span>
					<span className="text-[10px] font-mono text-muted-foreground/70">{unit}</span>
				</span>
				<div className="group relative flex items-center rounded-md border border-border/40 bg-surface-1 hover:border-border/70 focus-within:border-captr-blue focus-within:ring-1 focus-within:ring-captr-blue/40 transition-all overflow-hidden shadow-xs">
					<input
						aria-label={label}
						className="w-full bg-transparent px-2.5 py-1.5 text-xs font-mono text-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
						max={max}
						min={min}
						step="any"
						type="number"
						value={value}
						onChange={(event) => {
							const next = event.currentTarget.valueAsNumber;
							if (!Number.isFinite(next)) return;
							const bounded =
								max !== undefined
									? Math.min(max, Math.max(min ?? Number.NEGATIVE_INFINITY, next))
									: min !== undefined
										? Math.max(min, next)
										: next;
							onValue(bounded);
						}}
						onKeyDown={(event) => {
							if (event.key === "ArrowUp") {
								event.preventDefault();
								const delta = event.shiftKey ? 5 : step;
								const next = value + delta;
								onValue(max !== undefined ? Math.min(max, next) : next);
							} else if (event.key === "ArrowDown") {
								event.preventDefault();
								const delta = event.shiftKey ? 5 : step;
								const next = value - delta;
								onValue(min !== undefined ? Math.max(min, next) : next);
							}
						}}
					/>
					<div className="flex flex-col border-l border-border/40 shrink-0 select-none bg-surface-2/40">
						<button
							type="button"
							tabIndex={-1}
							aria-label={`Increase ${label}`}
							className="h-3.5 px-1.5 text-[8px] text-muted-foreground hover:text-foreground hover:bg-surface-2 active:bg-captr-blue/20 transition-colors flex items-center justify-center border-b border-border/30 cursor-pointer"
							onClick={(e) => {
								e.preventDefault();
								const delta = e.shiftKey ? 5 : step;
								const next = value + delta;
								onValue(max !== undefined ? Math.min(max, next) : next);
							}}
						>
							▲
						</button>
						<button
							type="button"
							tabIndex={-1}
							aria-label={`Decrease ${label}`}
							className="h-3.5 px-1.5 text-[8px] text-muted-foreground hover:text-foreground hover:bg-surface-2 active:bg-captr-blue/20 transition-colors flex items-center justify-center cursor-pointer"
							onClick={(e) => {
								e.preventDefault();
								const delta = e.shiftKey ? 5 : step;
								const next = value - delta;
								onValue(min !== undefined ? Math.max(min, next) : next);
							}}
						>
							▼
						</button>
					</div>
				</div>
			</label>
		);
	};
	const opacityField = (
		value: number,
		labelKey: string,
		fallback: string,
		onValue: (value: number) => void,
	) => {
		const label = t(`recordingFrameAppearance.${labelKey}`, fallback);
		const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
		return (
			<label className="flex flex-col gap-1.5 text-xs" key={labelKey}>
				<span className="flex items-center justify-between">
					<span className="font-medium text-foreground/80">{label}</span>
					<output
						aria-label={`${label} percent`}
						className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-surface-2/70 text-foreground/90 border border-border/30"
					>
						{percent}%
					</output>
				</span>
				<div className="flex items-center h-7 px-1">
					<input
						aria-label={label}
						className="w-full h-1.5 rounded-full accent-primary bg-foreground/10 cursor-pointer"
						max="100"
						min="0"
						step="1"
						type="range"
						value={percent}
						onChange={(event) => onValue(Number(event.currentTarget.value) / 100)}
					/>
				</div>
			</label>
		);
	};

	const colorField = (
		field: "borderColor" | "surfaceColor" | "shadowColor",
		labelKey: string,
		fallback: string,
	) => {
		const label = t(`recordingFrameAppearance.${labelKey}`, fallback);
		const value = field === "shadowColor" ? appearance.shadow.color : appearance[field];
		return (
			<label className="flex flex-col gap-1.5 text-xs" key={field}>
				<span className="font-medium text-foreground/80">{label}</span>
				<div className="flex items-center gap-2">
					<div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md border border-border/50 shadow-xs">
						<input
							aria-label={`${label} color picker`}
							className="absolute -inset-2 h-12 w-12 cursor-pointer border-0 bg-transparent p-0"
							type="color"
							value={toHexColor(value)}
							onChange={(event) => {
								const newColor = event.currentTarget.value;
								if (field === "shadowColor") {
									updateAppearance({ shadow: { color: newColor } });
								} else {
									updateAppearance({ [field]: newColor });
								}
							}}
						/>
					</div>
					<div className="relative flex-1 flex items-center rounded-md border border-border/40 bg-surface-1 hover:border-border/70 focus-within:border-captr-blue focus-within:ring-1 focus-within:ring-captr-blue/40 transition-all overflow-hidden shadow-xs">
						<input
							aria-label={label}
							className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 font-mono text-xs text-foreground uppercase outline-none"
							type="text"
							value={value}
							onChange={(event) =>
								field === "shadowColor"
									? updateAppearance({ shadow: { color: event.currentTarget.value } })
									: updateAppearance({ [field]: event.currentTarget.value })
							}
						/>
					</div>
				</div>
			</label>
		);
	};

	const savePreset = async () => {
		const outcome = await runAction(
			() => saveRecordingFramePresetSnapshot(presetLibrary.save, presetName, appearance),
			t("recordingFrameAppearance.saveError", "Could not save frame preset."),
		);
		if (outcome.status === "success") await loadPresets(outcome.value.id);
	};

	const renamePreset = async () => {
		if (!selectedPreset) return;
		const outcome = await runAction(
			() => presetLibrary.rename(selectedPreset.id, presetName),
			t("recordingFrameAppearance.renameError", "Could not rename frame preset."),
		);
		if (outcome.status === "success") await loadPresets(outcome.value.id);
	};

	const deletePreset = async () => {
		if (!selectedPreset) return;
		const outcome = await runAction(
			() => presetLibrary.delete(selectedPreset.id),
			t("recordingFrameAppearance.deleteError", "Could not delete frame preset."),
		);
		if (outcome.status === "success") await loadPresets();
	};

	const importPreset = async () => {
		const outcome = await runAction(
			() => presetLibrary.import(),
			t("recordingFrameAppearance.importError", "Could not import frame preset."),
		);
		if (outcome.status === "success") await loadPresets(outcome.value.id);
	};

	const exportPreset = async () => {
		if (!selectedPreset) return;
		await runAction(
			() => presetLibrary.export(selectedPreset.id),
			t("recordingFrameAppearance.exportError", "Could not export frame preset."),
		);
	};

	return (
		<section aria-label={title} className="recording-frame-appearance min-w-0 flex flex-col gap-4">
			<div className="flex flex-col gap-2.5">
				<div className="flex items-center justify-between gap-2">
					<h3 className="text-sm font-semibold">{title}</h3>
				</div>
				{onTargetChange && (
					<div
						className="flex items-center rounded-lg bg-surface-2 p-1 border border-border/40 text-xs w-full"
						role="group"
						aria-label={t("recordingFrameAppearance.targetSwitcher", "Target")}
					>
						<button
							type="button"
							className={`flex-1 py-1.5 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 font-medium ${
								target === "window"
									? "bg-primary text-primary-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
							onClick={() => onTargetChange("window")}
						>
							<span>🖥️</span>
							<span>{t("recordingFrameAppearance.window", "Window")}</span>
						</button>
						<button
							type="button"
							className={`flex-1 py-1.5 px-3 rounded-md transition-colors flex items-center justify-center gap-1.5 font-medium ${
								target === "webcam"
									? "bg-primary text-primary-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
							}`}
							onClick={() => onTargetChange("webcam")}
						>
							<span>📷</span>
							<span>{t("recordingFrameAppearance.webcam", "Webcam")}</span>
						</button>
					</div>
				)}
			</div>

			{/* Section: Visual Starter Presets */}
			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<span className="text-xs font-semibold text-foreground/90">
						{t("recordingFrameAppearance.starterPresets", "Starter Presets")}
					</span>
					<span className="text-[10px] text-muted-foreground">Click to apply</span>
				</div>
				<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
					{STARTER_FRAME_PRESETS.map((starter) => {
						const isSelected =
							appearance.borderWidth === starter.appearance.borderWidth &&
							appearance.borderColor === starter.appearance.borderColor &&
							appearance.cornerRadius === starter.appearance.cornerRadius &&
							appearance.surfaceColor === starter.appearance.surfaceColor &&
							(starter.appearance.headerStyle === undefined ||
								(appearance.headerStyle ?? "none") === (starter.appearance.headerStyle ?? "none"));

						return (
							<button
								key={starter.id}
								type="button"
								title={starter.description}
								className={`group relative flex flex-col items-center gap-1.5 rounded-lg border p-2 text-left transition-all hover:border-captr-blue/60 hover:bg-surface-2 ${
									isSelected
										? "border-captr-blue bg-captr-blue/10 ring-1 ring-captr-blue text-foreground font-semibold shadow-sm"
										: "border-border/40 bg-surface-1 text-muted-foreground hover:text-foreground"
								}`}
								onClick={() => onChange(target, structuredClone(starter.appearance))}
							>
								{/* Visual Miniature Frame Preview */}
								<div className="flex h-11 w-full items-center justify-center rounded bg-zinc-950/70 p-1 border border-white/5 overflow-hidden">
									<div
										className="relative flex flex-col justify-between transition-transform duration-200 group-hover:scale-105"
										style={{
											width: "46px",
											height: "26px",
											borderRadius: `${Math.min(7, Math.max(1, Math.round(starter.appearance.cornerRadius * 0.3)))}px`,
											borderWidth: `${Math.max(1, Math.min(2.5, starter.appearance.borderWidth || 1))}px`,
											borderStyle: starter.appearance.borderWidth === 0 ? "none" : "solid",
											borderColor:
												starter.appearance.borderWidth > 0
													? starter.appearance.borderColor
													: "transparent",
											backgroundColor:
												starter.appearance.surfaceOpacity > 0
													? starter.appearance.surfaceColor
													: "rgba(255,255,255,0.06)",
											boxShadow:
												starter.appearance.shadow.blur === 0 &&
												starter.appearance.shadow.opacity > 0.5
													? "2px 2px 0px rgba(0,0,0,0.9)"
													: starter.appearance.shadow.color !== "#000000" &&
														  starter.appearance.shadow.opacity > 0.2
														? `0 0 6px ${starter.appearance.shadow.color}90`
														: starter.appearance.shadow.opacity > 0
															? `0 2px 5px rgba(0,0,0,${Math.min(0.8, starter.appearance.shadow.opacity)})`
															: "none",
										}}
									>
										{starter.appearance.headerStyle === "macos" && (
											<div className="flex items-center gap-0.5 px-0.5 pt-0.5">
												<span className="h-1 w-1 rounded-full bg-[#ff5f56]" />
												<span className="h-1 w-1 rounded-full bg-[#ffbd2e]" />
												<span className="h-1 w-1 rounded-full bg-[#27c93f]" />
											</div>
										)}
										{starter.appearance.headerStyle === "windows" && (
											<div className="flex items-center justify-end gap-0.5 px-0.5 pt-0.5">
												<span className="h-0.5 w-0.5 bg-white/70" />
												<span className="h-0.5 w-0.5 border border-white/70" />
												<span className="text-[5px] text-white/70 leading-none">×</span>
											</div>
										)}
										{starter.appearance.headerStyle === "linux" && (
											<div className="flex items-center gap-0.5 px-0.5 pt-0.5">
												<span className="h-0.5 w-0.5 rounded-full bg-zinc-400" />
												<span className="h-0.5 w-0.5 rounded-full bg-zinc-400" />
												<span className="h-0.5 w-0.5 rounded-full bg-zinc-400" />
											</div>
										)}
									</div>
								</div>
								<span className="text-[11px] font-medium leading-tight truncate w-full text-center">
									{starter.name}
								</span>
							</button>
						);
					})}
				</div>
			</div>

			{/* Section: Window Header Style */}
			{target === "window" && (
				<div className="flex flex-col gap-2 pt-1 border-t border-border/20">
					<span className="text-xs font-semibold text-foreground/90">
						{t("recordingFrameAppearance.headerStyle", "Window Header Style")}
					</span>
					<div className="grid grid-cols-4 gap-2">
						{[
							{
								id: "none" as const,
								label: "None",
								visual: (
									<div className="flex h-6 w-full items-center justify-center rounded border border-dashed border-muted-foreground/30 text-[9px] text-muted-foreground">
										Clean
									</div>
								),
							},
							{
								id: "macos" as const,
								label: "macOS",
								visual: (
									<div className="flex h-6 w-full items-center gap-1 rounded bg-zinc-900 px-1.5 border border-white/5">
										<span className="h-1.5 w-1.5 rounded-full bg-[#ff5f56]" />
										<span className="h-1.5 w-1.5 rounded-full bg-[#ffbd2e]" />
										<span className="h-1.5 w-1.5 rounded-full bg-[#27c93f]" />
									</div>
								),
							},
							{
								id: "windows" as const,
								label: "Win 11",
								visual: (
									<div className="flex h-6 w-full items-center justify-end gap-1 rounded bg-zinc-900 px-1.5 border border-white/5">
										<span className="h-0.5 w-1 bg-white/70" />
										<span className="h-1.5 w-1.5 border border-white/70" />
										<span className="text-[8px] text-white/70 leading-none">×</span>
									</div>
								),
							},
							{
								id: "linux" as const,
								label: "Linux",
								visual: (
									<div className="flex h-6 w-full items-center gap-1 rounded bg-zinc-900 px-1.5 border border-white/5">
										<span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
										<span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
										<span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
									</div>
								),
							},
						].map((style) => {
							const active = (appearance.headerStyle ?? "none") === style.id;
							return (
								<button
									key={style.id}
									type="button"
									className={`flex flex-col items-center gap-1.5 rounded-lg border p-1.5 transition-all text-xs ${
										active
											? "border-captr-blue bg-captr-blue/10 ring-1 ring-captr-blue text-foreground font-semibold"
											: "border-border/40 bg-surface-1 text-muted-foreground hover:text-foreground hover:border-border"
									}`}
									onClick={() =>
										updateAppearance({ headerStyle: style.id as WindowHeaderStyle })
									}
								>
									{style.visual}
									<span className="text-[11px] font-medium">{style.label}</span>
								</button>
							);
						})}
					</div>
				</div>
			)}

			{/* Section: Shape & Border */}
			<div className="flex flex-col gap-2.5 pt-1 border-t border-border/20">
				<span className="text-xs font-semibold text-foreground/90">Shape & Border</span>
				<div className="grid grid-cols-2 gap-3">
					{numberField(
						appearance.cornerRadius,
						"cornerRadius",
						"Corner radius",
						(value) => updateAppearance({ cornerRadius: value }),
						0,
					)}
					{numberField(
						appearance.framePadding,
						"framePadding",
						"Frame padding",
						(value) => updateAppearance({ framePadding: value }),
						0,
					)}
					{numberField(
						appearance.borderWidth,
						"borderWidth",
						"Border width",
						(value) => updateAppearance({ borderWidth: value }),
						0,
					)}
					{opacityField(
						appearance.borderOpacity,
						"borderOpacity",
						"Border opacity",
						(value) => updateAppearance({ borderOpacity: value }),
					)}
					<div className="col-span-2">
						{colorField("borderColor", "borderColor", "Border color")}
					</div>
				</div>
			</div>

			{/* Section: Surface & Backdrop */}
			<div className="flex flex-col gap-2.5 pt-1 border-t border-border/20">
				<span className="text-xs font-semibold text-foreground/90">Surface & Backdrop</span>
				<div className="grid grid-cols-2 gap-3">
					<div className="col-span-2">
						{colorField("surfaceColor", "surfaceColor", "Surface color")}
					</div>
					{opacityField(
						appearance.surfaceOpacity,
						"surfaceOpacity",
						"Surface opacity",
						(value) => updateAppearance({ surfaceOpacity: value }),
					)}
					{numberField(
						appearance.backdropBlur,
						"backdropBlur",
						"Backdrop blur",
						(value) => updateAppearance({ backdropBlur: value }),
						0,
					)}
				</div>
			</div>

			{/* Section: Drop Shadow */}
			<div className="flex flex-col gap-2.5 pt-1 border-t border-border/20">
				<span className="text-xs font-semibold text-foreground/90">Drop Shadow</span>
				<div className="grid grid-cols-2 gap-3">
					<div className="col-span-2">
						{colorField("shadowColor", "shadowColor", "Shadow color")}
					</div>
					{opacityField(
						appearance.shadow.opacity,
						"shadowOpacity",
						"Shadow opacity",
						(value) => updateAppearance({ shadow: { opacity: value } }),
					)}
					{numberField(
						appearance.shadow.blur,
						"shadowBlur",
						"Shadow blur",
						(value) => updateAppearance({ shadow: { blur: value } }),
						0,
					)}
					<p className="col-span-2 text-[11px] text-muted-foreground">
						{t("recordingFrameAppearance.shadowDirection", "Shadow direction (X/Y)")}
					</p>
					{numberField(
						appearance.shadow.offsetX,
						"shadowOffsetX",
						"Shadow offset X",
						(value) => updateAppearance({ shadow: { offsetX: value } }),
					)}
					{numberField(
						appearance.shadow.offsetY,
						"shadowOffsetY",
						"Shadow offset Y",
						(value) => updateAppearance({ shadow: { offsetY: value } }),
					)}
				</div>
			</div>

			{/* Section: Presets Library Management */}
			<div className="flex flex-col gap-2.5 border-t border-foreground/10 pt-3">
				<h4 className="text-xs font-semibold text-foreground/90">
					{t("recordingFrameAppearance.presets", "Shared appearance presets")}
				</h4>
				<label className="flex flex-col gap-1 text-xs">
					<span className="font-medium text-foreground/80">{t("recordingFrameAppearance.selectPreset", "Preset")}</span>
					<select
						aria-label={t("recordingFrameAppearance.selectPreset", "Preset")}
						className="w-full rounded-md border border-border/40 bg-surface-1 px-2.5 py-1.5 text-xs text-foreground focus:border-captr-blue focus:ring-1 focus:ring-captr-blue/40 outline-none transition-all cursor-pointer"
						value={selectedPresetId}
						onChange={(event) => {
							const next = presets.find(
								(preset) => preset.id === event.currentTarget.value,
							);
							setSelectedPresetId(next?.id ?? "");
							setPresetName(next?.name ?? "");
						}}
					>
						<option value="">
							{t("recordingFrameAppearance.noPresets", "No presets yet")}
						</option>
						{presets.map((preset) => (
							<option key={preset.id} value={preset.id}>
								{preset.name}
							</option>
						))}
					</select>
				</label>
				<label className="flex flex-col gap-1 text-xs">
					<span className="font-medium text-foreground/80">{t("recordingFrameAppearance.presetName", "Preset name")}</span>
					<input
						aria-label={t("recordingFrameAppearance.presetName", "Preset name")}
						className="w-full rounded-md border border-border/40 bg-surface-1 px-2.5 py-1.5 text-xs text-foreground focus:border-captr-blue focus:ring-1 focus:ring-captr-blue/40 outline-none transition-all"
						value={presetName}
						onChange={(event) => setPresetName(event.currentTarget.value)}
					/>
				</label>
				<div className="grid grid-cols-2 gap-2 pt-1">
					<button
						disabled={busy || !presetName.trim()}
						type="button"
						className="flex items-center justify-center gap-1.5 rounded-md border border-captr-blue/40 bg-captr-blue/10 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-captr-blue/20 hover:border-captr-blue/60 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
						onClick={() => void savePreset()}
					>
						{t("recordingFrameAppearance.save", "Save preset")}
					</button>
					<button
						disabled={busy || !selectedPreset || !presetName.trim()}
						type="button"
						className="flex items-center justify-center gap-1.5 rounded-md border border-border/40 bg-surface-1 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-2 hover:border-border/70 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
						onClick={() => void renamePreset()}
					>
						{t("recordingFrameAppearance.rename", "Rename")}
					</button>
					<button
						disabled={busy || !selectedPreset}
						type="button"
						className="flex items-center justify-center gap-1.5 rounded-md border border-captr-blue/50 bg-captr-blue text-primary-foreground font-semibold px-2.5 py-1.5 text-xs shadow-xs hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
						onClick={() => {
							if (selectedPreset)
								applyRecordingFramePreset(target, selectedPreset, onChange);
						}}
					>
						{t("recordingFrameAppearance.apply", "Apply selected")}
					</button>
					<button
						disabled={busy || !selectedPreset}
						type="button"
						className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 hover:border-destructive/60 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
						onClick={() => void deletePreset()}
					>
						{t("recordingFrameAppearance.delete", "Delete")}
					</button>
					<button
						disabled={busy}
						type="button"
						className="flex items-center justify-center gap-1.5 rounded-md border border-border/40 bg-surface-1 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-2 hover:border-border/70 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
						onClick={() => void importPreset()}
					>
						{t("recordingFrameAppearance.import", "Import JSON")}
					</button>
					<button
						disabled={busy || !selectedPreset}
						type="button"
						className="flex items-center justify-center gap-1.5 rounded-md border border-border/40 bg-surface-1 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-2 hover:border-border/70 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
						onClick={() => void exportPreset()}
					>
						{t("recordingFrameAppearance.export", "Export JSON")}
					</button>
				</div>
			</div>
			{error && (
				<p className="text-xs text-destructive" role="alert">
					{error}
				</p>
			)}
		</section>
	);
}
