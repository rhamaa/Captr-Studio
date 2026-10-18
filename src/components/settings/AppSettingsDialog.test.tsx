import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import {
	AI_SETTINGS_STORAGE_KEY,
	DEFAULT_AI_SETTINGS,
	getGlobalAiSettings,
	saveGlobalAiSettings,
} from "@/lib/appSettings";
import { AppSettingsDialog } from "./AppSettingsDialog";

// ThemeProvider writes to the browser DOM during initialization; rendering here
// only needs a static preference.
vi.mock("@/contexts/ThemeContext", () => ({
	useTheme: () => ({ preference: "dark", setPreference: () => {} }),
}));

// Terminal component uses xterm which touches DOM APIs.
vi.mock("@/components/terminal/ProjectTerminal", () => ({
	ProjectTerminal: () => createElement("div", { "data-testid": "project-terminal" }),
}));

// Mock DialogPortal from Radix UI to render inline for static markup evaluation in node.
vi.mock("@radix-ui/react-dialog", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@radix-ui/react-dialog")>();
	return {
		...actual,
		Portal: ({ children }: { children: ReactNode }) => children,
	};
});

function createStorageMock(initialValues: Record<string, string> = {}): Storage {
	const store = new Map(Object.entries(initialValues));
	return {
		get length() {
			return store.size;
		},
		clear() {
			store.clear();
		},
		getItem(key: string) {
			return store.get(key) ?? null;
		},
		key(index: number) {
			return Array.from(store.keys())[index] ?? null;
		},
		removeItem(key: string) {
			store.delete(key);
		},
		setItem(key: string, value: string) {
			store.set(key, value);
		},
	};
}

describe("AppSettingsDialog & AI Settings", () => {
	let storageMock: Storage;

	beforeEach(() => {
		storageMock = createStorageMock();
		vi.stubGlobal("localStorage", storageMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	describe("Global AI settings persistence", () => {
		it("provides DEFAULT_AI_SETTINGS with expected baseline values", () => {
			expect(DEFAULT_AI_SETTINGS).toEqual({
				preferredRunner: "agy",
				defaultModel: "gemini-1.5-pro",
				mcpServerPort: 4040,
				enableAutoMcpServer: true,
				enableGhostPreview: true,
			});
		});

		it("returns DEFAULT_AI_SETTINGS when no settings are stored", () => {
			const settings = getGlobalAiSettings();
			expect(settings).toEqual(DEFAULT_AI_SETTINGS);
		});

		it("persists partial updates and merges with existing settings", () => {
			const updated = saveGlobalAiSettings({
				preferredRunner: "opencode",
				defaultModel: "claude-3-5-sonnet",
			});

			expect(updated.preferredRunner).toBe("opencode");
			expect(updated.defaultModel).toBe("claude-3-5-sonnet");
			expect(updated.mcpServerPort).toBe(4040);
			expect(updated.enableGhostPreview).toBe(true);

			const loaded = getGlobalAiSettings();
			expect(loaded.preferredRunner).toBe("opencode");
			expect(loaded.defaultModel).toBe("claude-3-5-sonnet");
			expect(loaded.mcpServerPort).toBe(4040);

			const rawStored = storageMock.getItem(AI_SETTINGS_STORAGE_KEY);
			expect(rawStored).toBeTruthy();
			expect(JSON.parse(rawStored!)).toMatchObject({
				preferredRunner: "opencode",
				defaultModel: "claude-3-5-sonnet",
			});
		});

		it("handles invalid JSON in localStorage gracefully by returning defaults", () => {
			storageMock.setItem(AI_SETTINGS_STORAGE_KEY, "{not-valid-json");
			const settings = getGlobalAiSettings();
			expect(settings).toEqual(DEFAULT_AI_SETTINGS);
		});
	});

	describe("AI Harness & Models Dialog Tab", () => {
		it("renders AI tab trigger and panel controls with default settings", () => {
			const html = renderToStaticMarkup(
				createElement(
					I18nProvider,
					null,
					createElement(AppSettingsDialog, {
						open: true,
						defaultTab: "ai",
						onOpenChange: vi.fn(),
					}),
				),
			);

			// Check tab trigger
			expect(html).toContain('data-state="active"');
			expect(html).toContain("AI Harness &amp; Models");

			// Check Preferred Runner select
			expect(html).toContain('name="preferredRunner"');
			expect(html).toContain('value="agy"');
			expect(html).toContain('value="opencode"');
			expect(html).toContain('value="hermes"');
			expect(html).toContain('value="cursor"');
			expect(html).toContain('value="custom"');

			// Check Default Model input
			expect(html).toContain('name="defaultModel"');
			expect(html).toContain('value="gemini-1.5-pro"');

			// Check MCP Server Port input
			expect(html).toContain('name="mcpServerPort"');
			expect(html).toContain('value="4040"');

			// Check Ghost Preview toggle
			expect(html).toContain('name="enableGhostPreview"');

			// Custom runner path input should NOT be rendered when preferredRunner is agy
			expect(html).not.toContain('name="customRunnerPath"');
		});

		it("renders custom CLI path input when runner is set to custom", () => {
			saveGlobalAiSettings({
				preferredRunner: "custom",
				customRunnerPath: "C:\\tools\\custom-agent.exe",
			});

			const html = renderToStaticMarkup(
				createElement(
					I18nProvider,
					null,
					createElement(AppSettingsDialog, {
						open: true,
						defaultTab: "ai",
						onOpenChange: vi.fn(),
					}),
				),
			);

			expect(html).toContain('name="customRunnerPath"');
			expect(html).toContain('value="C:\\tools\\custom-agent.exe"');
		});

		it("renders rich AI provider cards with icons and no default bias", () => {
			const html = renderToStaticMarkup(
				createElement(
					I18nProvider,
					null,
					createElement(AppSettingsDialog, {
						open: true,
						defaultTab: "ai",
						onOpenChange: vi.fn(),
					}),
				),
			);

			// All runners should be rendered as cards with data-runner
			expect(html).toContain('data-runner="agy"');
			expect(html).toContain('data-runner="claude"');
			expect(html).toContain('data-runner="opencode"');
			expect(html).toContain('data-runner="cursor"');
			expect(html).toContain('data-runner="codex"');
			expect(html).toContain('data-runner="devin"');
			expect(html).toContain('data-runner="hermes"');
			expect(html).toContain('data-runner="cline"');
			expect(html).toContain('data-runner="kiro"');
			expect(html).toContain('data-runner="trae"');
			expect(html).toContain('data-runner="custom"');

			// None should have (Default) in their names
			expect(html).not.toContain("Antigravity CLI (Default)");

			// Test connection section should be present
			expect(html).toContain("Test Provider Connection");
			expect(html).toContain("Halo, tes koneksi Captr Studio");
		});
	});
});
