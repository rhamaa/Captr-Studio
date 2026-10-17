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
	if (!isRecord(value) || !isRecord(value.shadow)) {
		return false;
	}
	const keys = Object.keys(value);
	const hasRequiredKeys = APPEARANCE_KEYS.every((k) => Object.hasOwn(value, k));
	if (!hasRequiredKeys) return false;
	const allowedKeys = new Set([...APPEARANCE_KEYS, "headerStyle"]);
	const onlyAllowedKeys = keys.every((k) => allowedKeys.has(k));
	if (!onlyAllowedKeys) return false;
	return hasExactKeys(value.shadow, SHADOW_KEYS) && isValidRecordingFrameAppearance(value);
}

export interface StarterFramePreset {
	id: string;
	name: string;
	description: string;
	appearance: RecordingFrameAppearance;
}

export const STARTER_FRAME_PRESETS: readonly StarterFramePreset[] = [
	{
		id: "macos-dark",
		name: "macOS Dark",
		description: "Clean dark window with traffic lights and smooth shadow",
		appearance: {
			framePadding: 0,
			borderWidth: 1,
			borderColor: "#3a3a44",
			borderOpacity: 0.6,
			cornerRadius: 12,
			surfaceColor: "#1e1e24",
			surfaceOpacity: 1,
			backdropBlur: 0,
			headerStyle: "macos",
			shadow: {
				color: "#000000",
				opacity: 0.45,
				blur: 32,
				offsetX: 0,
				offsetY: 12,
			},
		},
	},
	{
		id: "windows-fluent",
		name: "Windows 11",
		description: "Fluent window with subtle border and window controls",
		appearance: {
			framePadding: 0,
			borderWidth: 1,
			borderColor: "#ffffff",
			borderOpacity: 0.15,
			cornerRadius: 8,
			surfaceColor: "#202024",
			surfaceOpacity: 1,
			backdropBlur: 0,
			headerStyle: "windows",
			shadow: {
				color: "#000000",
				opacity: 0.4,
				blur: 24,
				offsetX: 0,
				offsetY: 8,
			},
		},
	},
	{
		id: "linux-flat",
		name: "Linux Modern",
		description: "Minimalist flat dark window with dot controls",
		appearance: {
			framePadding: 0,
			borderWidth: 1,
			borderColor: "#333338",
			borderOpacity: 0.8,
			cornerRadius: 10,
			surfaceColor: "#242428",
			surfaceOpacity: 1,
			backdropBlur: 0,
			headerStyle: "linux",
			shadow: {
				color: "#000000",
				opacity: 0.35,
				blur: 20,
				offsetX: 0,
				offsetY: 6,
			},
		},
	},
	{
		id: "glassmorphic-glow",
		name: "Glass Glow",
		description: "Translucent frosted glass with vibrant colored glow",
		appearance: {
			framePadding: 0,
			borderWidth: 1.5,
			borderColor: "#ffffff",
			borderOpacity: 0.25,
			cornerRadius: 16,
			surfaceColor: "#ffffff",
			surfaceOpacity: 0.08,
			backdropBlur: 20,
			headerStyle: "none",
			shadow: {
				color: "#3b82f6",
				opacity: 0.35,
				blur: 36,
				offsetX: 0,
				offsetY: 8,
			},
		},
	},
	{
		id: "minimal-floating",
		name: "Floating Card",
		description: "Borderless floating card with soft deep shadow",
		appearance: {
			framePadding: 0,
			borderWidth: 0,
			borderColor: "#000000",
			borderOpacity: 0,
			cornerRadius: 14,
			surfaceColor: "#000000",
			surfaceOpacity: 0,
			backdropBlur: 0,
			headerStyle: "none",
			shadow: {
				color: "#000000",
				opacity: 0.5,
				blur: 36,
				offsetX: 0,
				offsetY: 14,
			},
		},
	},
	{
		id: "neo-brutalist",
		name: "Neo-Brutalist",
		description: "High contrast thick black border and hard offset cast shadow",
		appearance: {
			framePadding: 0,
			borderWidth: 3,
			borderColor: "#000000",
			borderOpacity: 1,
			cornerRadius: 4,
			surfaceColor: "#fffdf5",
			surfaceOpacity: 1,
			backdropBlur: 0,
			headerStyle: "none",
			shadow: {
				color: "#000000",
				opacity: 1,
				blur: 0,
				offsetX: 5,
				offsetY: 5,
			},
		},
	},
	{
		id: "claymorphism",
		name: "Claymorphism",
		description: "Soft inflated clay card with puffy 3D depth and subtle rim light",
		appearance: {
			framePadding: 0,
			borderWidth: 2,
			borderColor: "#ffffff",
			borderOpacity: 0.35,
			cornerRadius: 22,
			surfaceColor: "#334155",
			surfaceOpacity: 0.95,
			backdropBlur: 14,
			headerStyle: "none",
			shadow: {
				color: "#0f172a",
				opacity: 0.6,
				blur: 28,
				offsetX: 0,
				offsetY: 12,
			},
		},
	},
	{
		id: "cyberpunk-neon",
		name: "Cyberpunk Neon",
		description: "Electric glowing border with vibrant neon cast shadow",
		appearance: {
			framePadding: 0,
			borderWidth: 2,
			borderColor: "#06b6d4",
			borderOpacity: 0.9,
			cornerRadius: 10,
			surfaceColor: "#09090b",
			surfaceOpacity: 0.95,
			backdropBlur: 0,
			headerStyle: "none",
			shadow: {
				color: "#06b6d4",
				opacity: 0.5,
				blur: 28,
				offsetX: 0,
				offsetY: 4,
			},
		},
	},
];

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
			...(value.appearance.headerStyle !== undefined
				? { headerStyle: value.appearance.headerStyle }
				: {}),
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
