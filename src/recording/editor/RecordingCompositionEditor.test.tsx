import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "@/components/video-editor/SettingsPanel";
import type { LayoutScenePreset } from "@/components/video-editor/types";
import { I18nProvider } from "@/contexts/I18nContext";
import { ShortcutsProvider } from "@/contexts/ShortcutsContext";
import { createTimelineProject, placeAsset, registerRecording } from "@/core/timeline/commands";
import { createDefaultRecordingSettings } from "../schema";
import { changeRecordingSettings, resolveRecordingSettings } from "./compositionAdapter";
import { RecordingCompositionEditor } from "./RecordingCompositionEditor";

// ThemeProvider writes to the browser DOM during initialization; rendering the
// editor's controls here only needs the theme preference, not that DOM effect.
vi.mock("@/contexts/ThemeContext", () => ({
	useTheme: () => ({ preference: "dark", setPreference: () => {} }),
}));
// Drag-and-drop timeline requires a browser layout. These tests exercise the
// real settings and navigation independently of the timeline's DOM effects.
vi.mock("../components/RecordingTimeline", async () => {
	const { createElement, forwardRef } = await import("react");
	return {
		RecordingTimeline: forwardRef<HTMLDivElement, Record<string, unknown>>((props, ref) =>
			createElement("div", {
				ref,
				"data-testid": "recording-timeline",
				"data-show-clip-row": String(props.showClipRow),
				"data-show-source-audio-track": String(props.showSourceAudioTrack),
				"data-microphone-audio-path": props.microphoneAudioPath ?? "",
				"data-system-audio-path": props.systemAudioPath ?? "",
			}),
		),
	};
});

const translate = (children: ReactNode) =>
	renderToStaticMarkup(
		createElement(I18nProvider, null, createElement(ShortcutsProvider, null, children)),
	);

beforeEach(() => {
	vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("Recording composition settings", () => {
	it("keeps the other frame target unchanged on an edit without a dedicated Appearance tab", () => {
		const registered = registerRecording(
			createTimelineProject("project", "Project"),
			{
				captureId: "capture-frame-style",
				name: "Recording",
				screen: { path: "screen.mp4", offsetUs: 0, durationUs: 10_000_000 },
				durationUs: 10_000_000,
				width: 1920,
				height: 1080,
				settings: {},
			},
			{ assetId: "asset-frame-style", packageId: "package-frame-style" },
		);
		const project = placeAsset(registered, "asset-frame-style", registered.tracks[0].id, 0, {
			clipId: "clip-frame-style",
			compositionId: "composition-frame-style",
		});
		const pkg = project.packages[0];
		const composition = project.compositions[0];
		const resolved = resolveRecordingSettings(pkg, composition);
		const originalWebcam = resolved.frameAppearances.webcam;
		const nextWindow = { ...resolved.frameAppearances.window, borderWidth: 9 };
		const updated = changeRecordingSettings(pkg, composition, {
			frameAppearances: { ...resolved.frameAppearances, window: nextWindow },
		});
		const html = translate(
			createElement(RecordingCompositionEditor, {
				package: pkg,
				composition,
				onChange: () => {},
				onClose: () => {},
			}),
		);

		expect(html).toContain(">Appearance</span>");
		expect(updated.settings.frameAppearances.window.borderWidth).toBe(9);
		expect(updated.settings.frameAppearances.webcam).toEqual(originalWebcam);
	});

	it("uses a compact timeline and passes packaged audio sources to its waveform tracks", () => {
		const registered = registerRecording(
			createTimelineProject("project", "Project"),
			{
				captureId: "capture-with-audio",
				name: "Recording",
				screen: { path: "screen.mp4", offsetUs: 0, durationUs: 10_000_000 },
				microphone: {
					path: "microphone.wav",
					offsetUs: 125_000,
					durationUs: 9_500_000,
				},
				system: { path: "system.wav", offsetUs: 0, durationUs: 10_000_000 },
				durationUs: 10_000_000,
				width: 1920,
				height: 1080,
				settings: {},
			},
			{ assetId: "asset-audio", packageId: "package-audio" },
		);
		const project = placeAsset(registered, "asset-audio", registered.tracks[0].id, 0, {
			clipId: "clip-audio",
			compositionId: "composition-audio",
		});
		const html = translate(
			createElement(RecordingCompositionEditor, {
				package: project.packages[0],
				composition: project.compositions[0],
				onChange: () => {},
				onClose: () => {},
			}),
		);

		expect(html).toContain('aria-label="Add overlay"');
		expect(html).toContain('title="Add overlay · T adds text"');
		expect(html).not.toContain('title="Add text overlay (T)"');
		expect(html).toContain('data-show-clip-row="false"');
		expect(html).toContain('data-show-source-audio-track="true"');
		expect(html).toContain('data-microphone-audio-path="microphone.wav"');
		expect(html).toContain('data-system-audio-path="system.wav"');
		expect(html).not.toContain("Drag to reposition overlay");
	});

	it("does not render a separate list of cut and kept ranges", () => {
		const registered = registerRecording(
			createTimelineProject("project", "Project"),
			{
				captureId: "capture",
				name: "Recording",
				screen: { path: "screen.mp4", offsetUs: 0, durationUs: 10_000_000 },
				durationUs: 10_000_000,
				width: 1920,
				height: 1080,
				settings: {},
			},
			{ assetId: "asset", packageId: "package" },
		);
		const project = placeAsset(registered, "asset", registered.tracks[0].id, 0, {
			clipId: "clip",
			compositionId: "composition",
		});
		const html = translate(
			createElement(RecordingCompositionEditor, {
				package: project.packages[0],
				composition: project.compositions[0],
				onChange: () => {},
				onClose: () => {},
			}),
		);

		expect(html).not.toContain('aria-label="Cut and kept source ranges"');
		expect(html).not.toContain("Cut ranges");
		expect(html).not.toContain("Red = cut");
	});

	it("offers recording-specific Scene, Cursor, Layout, and Appearance tabs", () => {
		const registered = registerRecording(
			createTimelineProject("project", "Project"),
			{
				captureId: "capture",
				name: "Recording",
				screen: { path: "screen.mp4", offsetUs: 0, durationUs: 10_000_000 },
				durationUs: 10_000_000,
				width: 1920,
				height: 1080,
				settings: {},
			},
			{ assetId: "asset", packageId: "package" },
		);
		const project = placeAsset(registered, "asset", registered.tracks[0].id, 0, {
			clipId: "clip",
			compositionId: "composition",
		});
		const html = translate(
			createElement(RecordingCompositionEditor, {
				package: project.packages[0],
				composition: project.compositions[0],
				onChange: () => {},
				onClose: () => {},
			}),
		);
		const navigation = html.match(
			/<nav[^>]*aria-label="Recording effect sections"[^>]*>(.*?)<\/nav>/s,
		)?.[1];
		expect(navigation).toBeDefined();
		expect([...navigation!.matchAll(/title="([^"]+)"/g)].map((match) => match[1])).toEqual([
			"Scene",
			"Cursor",
			"Layout",
			"Appearance",
		]);
	});

	it.each([
		["bubble", true, true],
		["webcam-only", true, false],
		["camera-circle", true, false],
		["screen-only", false, false],
		["screen-center", false, false],
	] as const)("shows camera controls for %s only when the layout uses camera", (preset, cameraVisible, bubbleVisible) => {
		const settings = createDefaultRecordingSettings();
		const html = translate(
			createElement(SettingsPanel, {
				...settings,
				selected: settings.wallpaper,
				onWallpaperChange: () => {},
				activeEffectSection: "layout",
				selectedLayoutId: "layout",
				selectedLayoutPreset: preset as LayoutScenePreset,
				webcamPreviewSrc: "http://127.0.0.1:4321/webcam.mp4",
				webcamPreviewCurrentTime: 5,
				webcamPreviewPlaying: true,
				onWebcamChange: () => {},
			}),
		);
		expect(html.includes("Mirror webcam")).toBe(cameraVisible);
		expect(html.includes('aria-label="bottom-right"')).toBe(bubbleVisible);
		expect(html.includes('<video src="http://127.0.0.1:4321/webcam.mp4"')).toBe(cameraVisible);
	});

	it("renders Record appearance controls inside the appearance settings section", () => {
		const settings = createDefaultRecordingSettings();
		const appearanceContent = createElement(
			"div",
			{ "data-recording-appearance": true },
			"Frame styling",
		);
		const html = translate(
			createElement(SettingsPanel, {
				...settings,
				selected: settings.wallpaper,
				onWallpaperChange: () => {},
				activeEffectSection: "appearance",
				recordToolsEnabled: true,
				recordingAppearanceContent: appearanceContent,
			}),
		);

		expect(html).toContain('data-recording-appearance="true"');
	});

	it.each(["scene", "cursor", "layout"] as const)(
		"does not render Record appearance controls in %s section",
		(section) => {
			const settings = createDefaultRecordingSettings();
			const html = translate(
				createElement(SettingsPanel, {
					...settings,
					selected: settings.wallpaper,
					onWallpaperChange: () => {},
					activeEffectSection: section,
					recordToolsEnabled: true,
					recordingAppearanceContent: createElement(
						"div",
						{ "data-recording-appearance": true },
						"Frame styling",
					),
				}),
			);

			expect(html).not.toContain("data-recording-appearance");
		},
	);

	it("keeps preview canvas dimensions fixed to Artboard canvas props", () => {
		const registered = registerRecording(
			createTimelineProject("project-shorts", "Project Shorts"),
			{
				captureId: "capture-shorts",
				name: "Recording Shorts",
				screen: { path: "screen.mp4", offsetUs: 0, durationUs: 10_000_000 },
				durationUs: 10_000_000,
				width: 1920,
				height: 1080,
				settings: {},
			},
			{ assetId: "asset-shorts", packageId: "package-shorts" },
		);
		const project = placeAsset(registered, "asset-shorts", registered.tracks[0].id, 0, {
			clipId: "clip-shorts",
			compositionId: "comp-shorts",
		});
		const compositionWithStaleRatio = {
			...project.compositions[0],
			settings: { ...project.compositions[0].settings, aspectRatio: "16:9" },
		};
		const html = translate(
			createElement(RecordingCompositionEditor, {
				package: project.packages[0],
				composition: compositionWithStaleRatio,
				canvas: { width: 1080, height: 1920, fps: 30 },
				onChange: () => {},
				onClose: () => {},
			}),
		);

		expect(html).not.toContain('aria-label="Preview aspect ratio"');
		expect(html).toContain('aria-label="Canvas dimensions fixed"');
		expect(html).toContain("1080 × 1920");
		expect(html).toContain("1080 / 1920");
	});

	it("adapts preview canvas aspect ratio to passed 1:1 square ratio", () => {
		const registered = registerRecording(
			createTimelineProject("project-square", "Project Square"),
			{
				captureId: "capture-square",
				name: "Recording Square",
				screen: { path: "screen.mp4", offsetUs: 0, durationUs: 10_000_000 },
				durationUs: 10_000_000,
				width: 1920,
				height: 1080,
				settings: {},
			},
			{ assetId: "asset-square", packageId: "package-square" },
		);
		const project = placeAsset(registered, "asset-square", registered.tracks[0].id, 0, {
			clipId: "clip-square",
			compositionId: "comp-square",
		});
		const html = translate(
			createElement(RecordingCompositionEditor, {
				package: project.packages[0],
				composition: project.compositions[0],
				canvas: { width: 1080, height: 1080, fps: 30 },
				onChange: () => {},
				onClose: () => {},
			}),
		);

		expect(html).not.toContain('aria-label="Preview aspect ratio"');
		expect(html).toContain("1080 × 1080");
		expect(html).toContain("1080 / 1080");
	});

	it("renders preview zoom and pan controls in transport bar", () => {
		const registered = registerRecording(
			createTimelineProject("project-zoom", "Project Zoom"),
			{
				captureId: "capture-zoom",
				name: "Recording Zoom",
				screen: { path: "screen.mp4", offsetUs: 0, durationUs: 5_000_000 },
				durationUs: 5_000_000,
				width: 1920,
				height: 1080,
				settings: {},
			},
			{ assetId: "asset-zoom", packageId: "package-zoom" },
		);
		const project = placeAsset(registered, "asset-zoom", registered.tracks[0].id, 0, {
			clipId: "clip-zoom",
			compositionId: "comp-zoom",
		});
		const html = translate(
			createElement(RecordingCompositionEditor, {
				package: project.packages[0],
				composition: project.compositions[0],
				canvas: { width: 1920, height: 1080, fps: 30 },
				onChange: () => {},
				onClose: () => {},
			}),
		);

		expect(html).toContain('aria-label="Recording preview monitor"');
		expect(html).toContain('aria-label="Preview zoom controls"');
		expect(html).toContain('aria-label="Zoom out preview"');
		expect(html).toContain('aria-label="Reset preview zoom"');
		expect(html).toContain("100%");
		expect(html).toContain('aria-label="Zoom in preview"');
		expect(html).toContain('aria-label="Pan preview"');
	});
});

