import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { EditorPreferences } from "../../editorPreferences";
import { SceneSection } from "./SceneSection";

vi.mock("motion/react", () => ({
	AnimatePresence: ({ children }: { children: ReactNode }) => children,
	LayoutGroup: ({ children }: { children: ReactNode }) => children,
	motion: new Proxy(
		{},
		{
			get:
				(_target, tag: string) =>
				({
					children,
					layoutId: _layoutId,
					transition: _transition,
					initial: _initial,
					animate: _animate,
					exit: _exit,
					...props
				}: {
					children?: ReactNode;
					layoutId?: unknown;
					transition?: unknown;
					initial?: unknown;
					animate?: unknown;
					exit?: unknown;
					[key: string]: unknown;
				}) =>
					createElement(tag, props, children),
		},
	),
}));

describe("SceneSection dynamic background", () => {
	it("shows loop patterns and controls when a generated background is selected", () => {
		const html = renderToStaticMarkup(
			<SceneSection
				selected="captr-dynamic-bg:v1:"
				backgroundBlur={0}
				initialEditorPreferences={{} as EditorPreferences}
				builtInWallpapers={[]}
				builtInWallpaperPaths={[]}
				wallpaperPreviewPaths={[]}
				extensionWallpapers={[]}
				extensionWallpaperPaths={[]}
				extensionWallpaperPreviewUrls={{}}
				colorPalette={[]}
				availableFrames={[]}
				tSettings={(_key, fallback) => fallback ?? ""}
				t={(_key, fallback) => fallback ?? ""}
			/>,
		);

		expect(html).toContain("Dynamic");
		expect(html).toContain("Dot Noise");
		expect(html).toContain("Film Grain");
		expect(html).toContain("Orbit");
		expect(html).toContain('aria-label="Dynamic background pattern"');
		expect(html).not.toContain('type="range"');
		expect(html).toContain('aria-label="Dynamic background density"');
		expect(html).toContain('aria-label="Dynamic background scale"');
		expect(html).toContain('aria-label="Dynamic background speed"');
		expect(html).toContain('aria-label="Dynamic background loop duration"');
		expect(html).toContain('data-slider-thumb="true"');
	});

	it("shows a draggable crop frame over the scene preview", () => {
		const html = renderToStaticMarkup(
			<SceneSection
				selected=""
				backgroundBlur={0}
				cropRegion={{ x: 0.1, y: 0.1, width: 0.8, height: 0.8 }}
				onCropChange={vi.fn()}
				previewSrc="screen-preview.mp4"
				initialEditorPreferences={{} as EditorPreferences}
				builtInWallpapers={[]}
				builtInWallpaperPaths={[]}
				wallpaperPreviewPaths={[]}
				extensionWallpapers={[]}
				extensionWallpaperPaths={[]}
				extensionWallpaperPreviewUrls={{}}
				colorPalette={[]}
				availableFrames={[]}
				tSettings={(_key, fallback) => fallback ?? ""}
				t={(_key, fallback) => fallback ?? ""}
			/>,
		);

		expect(html).toContain('src="screen-preview.mp4"');
		expect(html).toContain('aria-label="Move crop selection"');
		expect(html).toContain('aria-label="Resize crop selection from bottom right"');
	});
});
