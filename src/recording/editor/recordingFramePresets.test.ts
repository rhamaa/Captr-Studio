import { describe, expect, it } from "vitest";
import type { RecordingFrameAppearance } from "../schema";
import {
	parseRecordingFramePreset,
	type RecordingFramePreset,
	serializeRecordingFramePreset,
} from "./recordingFramePresets";

const appearance: RecordingFrameAppearance = {
	framePadding: 12,
	borderWidth: 3,
	borderColor: "#9ca3af",
	borderOpacity: 0.8,
	cornerRadius: 20,
	surfaceColor: "#111827",
	surfaceOpacity: 0.7,
	backdropBlur: 8,
	shadow: {
		color: "#000000",
		opacity: 0.4,
		blur: 18,
		offsetX: 0,
		offsetY: 6,
	},
};

const preset: RecordingFramePreset = {
	schemaVersion: 1,
	id: "preset-1",
	name: "Studio Frame",
	createdAt: "2026-10-12T00:00:00.000Z",
	updatedAt: "2026-10-12T00:00:00.000Z",
	appearance,
};

describe("recording frame preset JSON contract", () => {
	it("round-trips a complete preset", () => {
		const serialized = serializeRecordingFramePreset(preset);
		expect(parseRecordingFramePreset(JSON.parse(serialized))).toEqual(preset);
	});

	it("serializes presets in stable field order", () => {
		const reordered = Object.fromEntries(
			Object.entries(preset).reverse(),
		) as unknown as RecordingFramePreset;
		expect(serializeRecordingFramePreset(reordered)).toBe(JSON.stringify(preset));
	});

	it("trims preset names when parsing and serializing", () => {
		const parsed = parseRecordingFramePreset({ ...preset, name: "  Studio Frame  " });
		expect(parsed.name).toBe("Studio Frame");
		expect(
			JSON.parse(serializeRecordingFramePreset({ ...preset, name: "  Studio Frame  " })).name,
		).toBe("Studio Frame");
	});

	it("rejects an empty name", () => {
		expect(() => parseRecordingFramePreset({ ...preset, name: "   " })).toThrow(
			"Preset name cannot be empty",
		);
	});

	it("rejects invalid nested appearance values", () => {
		expect(() =>
			parseRecordingFramePreset({
				...preset,
				appearance: { ...appearance, shadow: { ...appearance.shadow, opacity: 2 } },
			}),
		).toThrow("Invalid frame appearance");
		expect(() =>
			parseRecordingFramePreset({
				...preset,
				appearance: { ...appearance, shadow: { ...appearance.shadow, extra: true } },
			}),
		).toThrow("Invalid frame appearance");
	});

	it("rejects unsupported schema versions", () => {
		expect(() => parseRecordingFramePreset({ ...preset, schemaVersion: 2 })).toThrow(
			"Unsupported preset schema version",
		);
	});

	it("rejects unknown or incomplete payloads", () => {
		expect(() => parseRecordingFramePreset({ ...preset, extra: true })).toThrow(
			"Invalid frame preset",
		);
		expect(() => {
			const { cornerRadius: _cornerRadius, ...partialAppearance } = appearance;
			parseRecordingFramePreset({ ...preset, appearance: partialAppearance });
		}).toThrow("Invalid frame appearance");
	});
});
