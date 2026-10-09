import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ProjectTerminalConfigDialog } from "./ProjectTerminalConfigDialog";

describe("ProjectTerminalConfigDialog component", () => {
	it("returns null when open is false", () => {
		const markup = renderToStaticMarkup(
			createElement(ProjectTerminalConfigDialog, {
				open: false,
				onClose: vi.fn(),
				onSave: vi.fn(),
			}),
		);
		expect(markup).toBe("");
	});

	it("renders dialog fields when open is true", () => {
		const markup = renderToStaticMarkup(
			createElement(ProjectTerminalConfigDialog, {
				open: true,
				config: {
					preferredShell: "bash",
					startupCommand: "npm run start",
					customEnv: { AGY_MODE: "expert" },
				},
				onClose: vi.fn(),
				onSave: vi.fn(),
			}),
		);

		expect(markup).toContain("Project Terminal Settings");
		expect(markup).toContain("project.json");
		expect(markup).toContain("Startup Command (Opsional)");
		expect(markup).toContain("Custom Project Environment Variables");
		expect(markup).toContain("npm run start");
		expect(markup).toContain("AGY_MODE");
		expect(markup).toContain("expert");
	});
});
