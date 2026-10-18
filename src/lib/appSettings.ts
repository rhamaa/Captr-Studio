import type { GlobalAiSettings } from "@/core/timeline/aiTypes";

type ElectronSettingsApi = Pick<Window["electronAPI"], "getAppSetting" | "setAppSetting">;

function getElectronSettingsApi(): ElectronSettingsApi | null {
	const api = (globalThis as typeof globalThis & { electronAPI?: ElectronSettingsApi })
		.electronAPI;
	if (
		!api ||
		typeof api.getAppSetting !== "function" ||
		typeof api.setAppSetting !== "function"
	) {
		return null;
	}

	return api;
}

export function loadAppSetting<T>(key: string): T | null {
	const api = getElectronSettingsApi();
	if (!api) {
		return null;
	}

	try {
		const value = api.getAppSetting(key);
		return value === undefined ? null : (value as T | null);
	} catch {
		return null;
	}
}

export function saveAppSetting(key: string, value: unknown): boolean {
	const api = getElectronSettingsApi();
	if (!api) {
		return false;
	}

	try {
		return api.setAppSetting(key, value);
	} catch {
		return false;
	}
}

export const AI_SETTINGS_STORAGE_KEY = "captr_global_ai_settings";

export const DEFAULT_AI_SETTINGS: GlobalAiSettings = {
	preferredRunner: "agy",
	defaultModel: "gemini-1.5-pro",
	mcpServerPort: 4040,
	enableAutoMcpServer: true,
	enableGhostPreview: true,
};

export function getGlobalAiSettings(): GlobalAiSettings {
	const storage =
		typeof window !== "undefined" && typeof window.localStorage !== "undefined"
			? window.localStorage
			: typeof localStorage !== "undefined"
				? localStorage
				: null;

	if (storage) {
		try {
			const raw = storage.getItem(AI_SETTINGS_STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (parsed && typeof parsed === "object") {
					return {
						...DEFAULT_AI_SETTINGS,
						...parsed,
					};
				}
			}
		} catch {
			return { ...DEFAULT_AI_SETTINGS };
		}
	}

	const fallback = loadAppSetting<Partial<GlobalAiSettings>>(AI_SETTINGS_STORAGE_KEY);
	if (fallback && typeof fallback === "object") {
		return {
			...DEFAULT_AI_SETTINGS,
			...fallback,
		};
	}

	return { ...DEFAULT_AI_SETTINGS };
}

export function saveGlobalAiSettings(settings: Partial<GlobalAiSettings>): GlobalAiSettings {
	const current = getGlobalAiSettings();
	const merged: GlobalAiSettings = {
		...current,
		...settings,
	};

	const storage =
		typeof window !== "undefined" && typeof window.localStorage !== "undefined"
			? window.localStorage
			: typeof localStorage !== "undefined"
				? localStorage
				: null;

	if (storage) {
		try {
			storage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(merged));
		} catch {
			// ignore storage error
		}
	}

	saveAppSetting(AI_SETTINGS_STORAGE_KEY, merged);
	return merged;
}
