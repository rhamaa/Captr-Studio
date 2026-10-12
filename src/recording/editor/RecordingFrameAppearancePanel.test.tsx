import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import type { RecordingFrameAppearance } from "../schema";
import {
	applyRecordingFramePreset,
	mergeRecordingFrameAppearance,
	RecordingFrameAppearancePanel,
	type RecordingFrameAppearancePanelProps,
	runRecordingFramePresetAction,
	saveRecordingFramePresetSnapshot,
} from "./RecordingFrameAppearancePanel";

const appearance: RecordingFrameAppearance = {
	framePadding: 12,
	borderWidth: 2,
	borderColor: "#ffffff",
	borderOpacity: 0.8,
	cornerRadius: 24,
	surfaceColor: "#111827",
	surfaceOpacity: 0.65,
	backdropBlur: 12,
	shadow: { color: "#000000", opacity: 0.4, blur: 20, offsetX: 0, offsetY: 8 },
};

const preset = {
	schemaVersion: 1 as const,
	id: "preset-a",
	name: "Film Glass",
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
	appearance,
};

const translate = (children: ReactNode) =>
	renderToStaticMarkup(createElement(I18nProvider, null, children));

beforeEach(() => {
	vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("RecordingFrameAppearancePanel", () => {
	it("renders Window/Webcam targets, raw style controls, and preset actions", () => {
		const props = {
			target: "window" as const,
			appearance,
			onTargetChange: vi.fn(),
			onChange: vi.fn(),
			presetLibrary: {} as RecordingFrameAppearancePanelProps["presetLibrary"],
		};
		const html = translate(createElement(RecordingFrameAppearancePanel, props));

		expect(html).toContain('aria-label="Appearance target"');
		expect(html).toMatch(/aria-pressed="true"[^>]*>Window<\/button>/);
		expect(html).toMatch(/aria-pressed="false"[^>]*>Webcam<\/button>/);
		for (const label of [
			"Frame padding",
			"Border width",
			"Border color",
			"Border opacity",
			"Corner radius",
			"Surface color",
			"Surface opacity",
			"Backdrop blur",
			"Shadow color",
			"Shadow opacity",
			"Shadow blur",
			"Shadow offset X",
			"Shadow offset Y",
			"Apply selected",
			"Save preset",
			"Rename",
			"Delete",
			"Import JSON",
			"Export JSON",
		]) {
			expect(html).toContain(label);
		}
	});

	it("merges raw edits without dropping shadow fields", () => {
		const updated = mergeRecordingFrameAppearance(appearance, {
			borderWidth: 6,
			shadow: { offsetY: 14 },
		});
		expect(updated.borderWidth).toBe(6);
		expect(updated.shadow).toEqual({ ...appearance.shadow, offsetY: 14 });
		expect(appearance.borderWidth).toBe(2);
	});

	it("saves and applies a full snapshot to only the selected target", async () => {
		const save = vi.fn(async (name: string, snapshot: RecordingFrameAppearance) => ({
			success: true as const,
			value: { ...preset, id: "saved", name, appearance: snapshot },
		}));
		const result = await saveRecordingFramePresetSnapshot(save, "  Glass  ", appearance);
		expect(result.success).toBe(true);
		expect(save).toHaveBeenCalledWith("  Glass  ", appearance);

		const onChange = vi.fn();
		applyRecordingFramePreset("webcam", preset, onChange);
		expect(onChange).toHaveBeenCalledWith("webcam", appearance);
		expect(onChange.mock.calls[0][1]).not.toBe(appearance);
	});

	it("keeps cancellation silent and reports library failures", async () => {
		await expect(
			runRecordingFramePresetAction(
				async () => ({ success: true, canceled: true }),
				"Fallback",
			),
		).resolves.toEqual({ status: "canceled" });
		await expect(
			runRecordingFramePresetAction(
				async () => ({ success: false, error: "Disk full" }),
				"Fallback",
			),
		).resolves.toEqual({ status: "error", message: "Disk full" });
		await expect(
			runRecordingFramePresetAction(
				async () => ({ success: true, value: preset }),
				"Fallback",
			),
		).resolves.toEqual({ status: "success", value: preset });
	});
});
