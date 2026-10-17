import type { PatternRenderSettings } from "./patternRenderer";

export type DynamicBackgroundPattern = "dot-noise" | "film-grain" | "orbit";

export interface DynamicBackgroundSettings {
	pattern: DynamicBackgroundPattern;
	backgroundColor: string;
	accentColor: string;
	density: number;
	scale: number;
	speed: number;
	durationSeconds: number;
	seed: number;
}

export const DYNAMIC_BACKGROUND_PREFIX = "captr-dynamic-bg:v1:";

export const DEFAULT_DYNAMIC_BACKGROUND_SETTINGS: DynamicBackgroundSettings = {
	pattern: "dot-noise",
	backgroundColor: "#11151d",
	accentColor: "#8ab4ff",
	density: 0.4,
	scale: 1,
	speed: 2,
	durationSeconds: 4,
	seed: 42,
};

const PATTERNS: DynamicBackgroundPattern[] = ["dot-noise", "film-grain", "orbit"];

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function normalizeSettings(
	settings: Partial<DynamicBackgroundSettings>,
): DynamicBackgroundSettings {
	return {
		pattern: PATTERNS.includes(settings.pattern as DynamicBackgroundPattern)
			? (settings.pattern as DynamicBackgroundPattern)
			: DEFAULT_DYNAMIC_BACKGROUND_SETTINGS.pattern,
		backgroundColor: /^#[0-9a-f]{6}$/i.test(settings.backgroundColor ?? "")
			? settings.backgroundColor!
			: DEFAULT_DYNAMIC_BACKGROUND_SETTINGS.backgroundColor,
		accentColor: /^#[0-9a-f]{6}$/i.test(settings.accentColor ?? "")
			? settings.accentColor!
			: DEFAULT_DYNAMIC_BACKGROUND_SETTINGS.accentColor,
		density: clamp(Number(settings.density) || 0.4, 0.05, 1.5),
		scale: clamp(Number(settings.scale) || 1, 0.25, 3),
		speed: clamp(Number(settings.speed) || 2, 1, 4),
		durationSeconds: clamp(Number(settings.durationSeconds) || 4, 1, 10),
		seed: Math.trunc(Number(settings.seed) || 42),
	};
}

export function serializeDynamicBackgroundSettings(
	settings: Partial<DynamicBackgroundSettings>,
): string {
	return `${DYNAMIC_BACKGROUND_PREFIX}${encodeURIComponent(JSON.stringify(normalizeSettings(settings)))}`;
}

export function isDynamicBackgroundWallpaper(value: string): boolean {
	return value.startsWith(DYNAMIC_BACKGROUND_PREFIX);
}

export function parseDynamicBackgroundSettings(value: string): DynamicBackgroundSettings | null {
	if (!isDynamicBackgroundWallpaper(value)) return null;
	try {
		const json = decodeURIComponent(value.slice(DYNAMIC_BACKGROUND_PREFIX.length));
		return normalizeSettings(JSON.parse(json) as Partial<DynamicBackgroundSettings>);
	} catch {
		return null;
	}
}

export function getDynamicBackgroundPhase(timeSeconds: number, durationSeconds: number): number {
	const duration = Number.isFinite(durationSeconds) ? clamp(durationSeconds, 1, 10) : 4;
	const time = Number.isFinite(timeSeconds) ? Math.max(0, timeSeconds) : 0;
	return (((time % duration) + duration) % duration) / duration;
}

export function getDynamicBackgroundFrameSettings(
	settings: DynamicBackgroundSettings,
	width: number,
	height: number,
	timeSeconds: number,
): PatternRenderSettings {
	return {
		...settings,
		width,
		height,
		phase: getDynamicBackgroundPhase(timeSeconds, settings.durationSeconds),
	};
}
