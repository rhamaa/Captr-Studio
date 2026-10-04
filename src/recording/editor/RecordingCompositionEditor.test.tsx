import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "@/components/video-editor/SettingsPanel";
import type { LayoutScenePreset } from "@/components/video-editor/types";
import { I18nProvider } from "@/contexts/I18nContext";
import { ShortcutsProvider } from "@/contexts/ShortcutsContext";
import { createTimelineProject, placeAsset, registerRecording } from "@/core/timeline/commands";
import { createDefaultRecordingSettings } from "../schema";
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

		expect(html).toContain('data-show-clip-row="false"');
		expect(html).toContain('data-show-source-audio-track="true"');
		expect(html).toContain('data-microphone-audio-path="microphone.wav"');
		expect(html).toContain('data-system-audio-path="system.wav"');
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

	it("offers only recording-specific Scene, Cursor and Layout tabs", () => {
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
});
