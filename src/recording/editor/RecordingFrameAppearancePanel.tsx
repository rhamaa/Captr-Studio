import { useCallback, useEffect, useState } from "react";
import { useScopedT } from "@/contexts/I18nContext";
import type { RecordingFrameAppearance } from "../schema";
import type { RecordingFramePreset } from "./recordingFramePresets";

export type RecordingFrameTarget = "window" | "webcam";
type PresetLibraryApi = Window["electronAPI"]["recordFramePresets"];

export interface RecordingFrameAppearancePanelProps {
	target: RecordingFrameTarget;
	appearance: RecordingFrameAppearance;
	onChange: (target: RecordingFrameTarget, appearance: RecordingFrameAppearance) => void;
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

export function RecordingFrameAppearancePanel({
	target,
	appearance,
	onChange,
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
	) => {
		const label = t(`recordingFrameAppearance.${labelKey}`, fallback);
		return (
			<label className="flex flex-col gap-1 text-xs" key={labelKey}>
				<span>{label}</span>
				<input
					aria-label={label}
					className="w-full rounded-md border border-foreground/10 bg-background px-2 py-1.5"
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
				/>
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
			<label className="flex flex-col gap-1 text-xs" key={labelKey}>
				<span className="flex items-center justify-between">
					<span>{label}</span>
					<output aria-label={`${label} percent`}>{percent}%</output>
				</span>
				<input
					aria-label={label}
					className="w-full accent-primary"
					max="100"
					min="0"
					step="1"
					type="range"
					value={percent}
					onChange={(event) => onValue(Number(event.currentTarget.value) / 100)}
				/>
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
			<label className="flex flex-col gap-1 text-xs" key={field}>
				<span>{label}</span>
				<input
					aria-label={label}
					className="w-full rounded-md border border-foreground/10 bg-background px-2 py-1.5"
					type="text"
					value={value}
					onChange={(event) =>
						field === "shadowColor"
							? updateAppearance({ shadow: { color: event.currentTarget.value } })
							: updateAppearance({ [field]: event.currentTarget.value })
					}
				/>
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
			<h3 className="text-sm font-semibold">{title}</h3>

			<div className="grid grid-cols-2 gap-3">
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
				{colorField("borderColor", "borderColor", "Border color")}
				{opacityField(
					appearance.borderOpacity,
					"borderOpacity",
					"Border opacity",
					(value) => updateAppearance({ borderOpacity: value }),
				)}
				{numberField(
					appearance.cornerRadius,
					"cornerRadius",
					"Corner radius",
					(value) => updateAppearance({ cornerRadius: value }),
					0,
				)}
				{colorField("surfaceColor", "surfaceColor", "Surface color")}
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
				{colorField("shadowColor", "shadowColor", "Shadow color")}
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

			<div className="flex flex-col gap-2 border-t border-foreground/10 pt-3">
				<h4 className="text-xs font-semibold">
					{t("recordingFrameAppearance.presets", "Shared appearance presets")}
				</h4>
				<label className="flex flex-col gap-1 text-xs">
					<span>{t("recordingFrameAppearance.selectPreset", "Preset")}</span>
					<select
						aria-label={t("recordingFrameAppearance.selectPreset", "Preset")}
						className="w-full rounded-md border border-foreground/10 bg-background px-2 py-1.5"
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
					<span>{t("recordingFrameAppearance.presetName", "Preset name")}</span>
					<input
						aria-label={t("recordingFrameAppearance.presetName", "Preset name")}
						className="w-full rounded-md border border-foreground/10 bg-background px-2 py-1.5"
						value={presetName}
						onChange={(event) => setPresetName(event.currentTarget.value)}
					/>
				</label>
				<div className="grid grid-cols-2 gap-2">
					<button
						disabled={busy || !presetName.trim()}
						type="button"
						onClick={() => void savePreset()}
					>
						{t("recordingFrameAppearance.save", "Save preset")}
					</button>
					<button
						disabled={busy || !selectedPreset || !presetName.trim()}
						type="button"
						onClick={() => void renamePreset()}
					>
						{t("recordingFrameAppearance.rename", "Rename")}
					</button>
					<button
						disabled={busy || !selectedPreset}
						type="button"
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
						onClick={() => void deletePreset()}
					>
						{t("recordingFrameAppearance.delete", "Delete")}
					</button>
					<button disabled={busy} type="button" onClick={() => void importPreset()}>
						{t("recordingFrameAppearance.import", "Import JSON")}
					</button>
					<button
						disabled={busy || !selectedPreset}
						type="button"
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
