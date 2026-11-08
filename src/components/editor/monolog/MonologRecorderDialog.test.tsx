import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { MonologRecorderDialog } from "./MonologRecorderDialog";
import { TeleprompterPanel } from "./TeleprompterPanel";

const render = (element: ReturnType<typeof createElement>) =>
	renderToStaticMarkup(createElement(I18nProvider, null, element));

describe("MonologRecorderDialog", () => {
	it("renders the teleprompter above the camera preview with setup controls", () => {
		const markup = render(
			createElement(MonologRecorderDialog, {
				begin: vi.fn(),
				finalize: vi.fn(),
				discard: vi.fn(),
				onSaved: vi.fn(),
				onClose: vi.fn(),
			}),
		);
		expect(markup).toContain('role="dialog"');
		expect(markup).toContain("Record monolog");
		expect(markup.indexOf("monolog-teleprompter")).toBeLessThan(
			markup.indexOf("monolog-preview"),
		);
		expect(markup).toContain("Paste your script here");
		expect(markup).toContain("Start recording");
		expect(markup).toContain("1080p");
	});
});

describe("TeleprompterPanel", () => {
	const props = {
		onScriptChange: vi.fn(),
		fontSize: 32,
		onFontSizeChange: vi.fn(),
		mirrorText: false,
		onMirrorTextChange: vi.fn(),
	};

	it("is an editable textarea during setup", () => {
		const markup = render(
			createElement(TeleprompterPanel, { ...props, script: "Hello world", phase: "setup" }),
		);
		expect(markup).toContain("<textarea");
		expect(markup).toContain("Hello world");
	});

	it("becomes a read-only scrolling view with a reading marker while recording", () => {
		const markup = render(
			createElement(TeleprompterPanel, { ...props, script: "Line one", phase: "recording" }),
		);
		expect(markup).not.toContain("<textarea");
		expect(markup).toContain("monolog-teleprompter-marker");
		expect(markup).toContain("Line one");
		expect(markup).toContain("Space pauses");
	});

	it("mirrors the text only when asked", () => {
		const markup = render(
			createElement(TeleprompterPanel, {
				...props,
				mirrorText: true,
				script: "x",
				phase: "recording",
			}),
		);
		expect(markup).toContain("monolog-teleprompter-viewport mirrored");
	});
});
