import { isValidRecordingFrameAppearance, type RecordingFrameAppearance } from "../schema";

export const RECORDING_FRAME_PRESET_SCHEMA_VERSION = 1 as const;

export interface RecordingFramePreset {
	schemaVersion: typeof RECORDING_FRAME_PRESET_SCHEMA_VERSION;
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
	appearance: RecordingFrameAppearance;
}

const PRESET_KEYS = ["schemaVersion", "id", "name", "createdAt", "updatedAt", "appearance"];
const APPEARANCE_KEYS = [
	"framePadding",
	"borderWidth",
	"borderColor",
	"borderOpacity",
	"cornerRadius",
	"surfaceColor",
	"surfaceOpacity",
	"backdropBlur",
	"shadow",
];
const SHADOW_KEYS = ["color", "opacity", "blur", "offsetX", "offsetY"];

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expectedKeys: readonly string[]): boolean {
	const keys = Object.keys(value);
	return (
		keys.length === expectedKeys.length &&
		expectedKeys.every((key) => Object.hasOwn(value, key))
	);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
	return (
		typeof value === "string" &&
		/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value) &&
		Number.isFinite(Date.parse(value))
	);
}

function isStrictAppearance(value: unknown): value is RecordingFrameAppearance {
	if (!isRecord(value) || !hasExactKeys(value, APPEARANCE_KEYS) || !isRecord(value.shadow)) {
		return false;
	}
	return hasExactKeys(value.shadow, SHADOW_KEYS) && isValidRecordingFrameAppearance(value);
}

/** Parse and normalize an untrusted version-1 Record frame preset payload. */
export function parseRecordingFramePreset(value: unknown): RecordingFramePreset {
	if (!isRecord(value) || !hasExactKeys(value, PRESET_KEYS)) {
		throw new Error("Invalid frame preset");
	}
	if (value.schemaVersion !== RECORDING_FRAME_PRESET_SCHEMA_VERSION) {
		throw new Error("Unsupported preset schema version");
	}
	if (
		!isNonEmptyString(value.id) ||
		!isTimestamp(value.createdAt) ||
		!isTimestamp(value.updatedAt)
	) {
		throw new Error("Invalid frame preset");
	}
	if (typeof value.name !== "string" || value.name.trim().length === 0) {
		throw new Error("Preset name cannot be empty");
	}
	if (!isStrictAppearance(value.appearance)) {
		throw new Error("Invalid frame appearance");
	}

	return {
		schemaVersion: RECORDING_FRAME_PRESET_SCHEMA_VERSION,
		id: value.id,
		name: value.name.trim(),
		createdAt: value.createdAt,
		updatedAt: value.updatedAt,
		appearance: {
			framePadding: value.appearance.framePadding,
			borderWidth: value.appearance.borderWidth,
			borderColor: value.appearance.borderColor,
			borderOpacity: value.appearance.borderOpacity,
			cornerRadius: value.appearance.cornerRadius,
			surfaceColor: value.appearance.surfaceColor,
			surfaceOpacity: value.appearance.surfaceOpacity,
			backdropBlur: value.appearance.backdropBlur,
			shadow: {
				color: value.appearance.shadow.color,
				opacity: value.appearance.shadow.opacity,
				blur: value.appearance.shadow.blur,
				offsetX: value.appearance.shadow.offsetX,
				offsetY: value.appearance.shadow.offsetY,
			},
		},
	};
}

/** Serialize a validated preset with stable field ordering. */
export function serializeRecordingFramePreset(preset: RecordingFramePreset): string {
	return JSON.stringify(parseRecordingFramePreset(preset));
}
