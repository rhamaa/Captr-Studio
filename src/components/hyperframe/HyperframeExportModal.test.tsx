import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HyperframeExportModal } from "./HyperframeExportModal";

describe("HyperframeExportModal", () => {
	it("renders export modal with resolution, framerate, and quality choices", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframeExportModal, {
				isOpen: true,
				hyperframeName: "Kinetic Intro",
				htmlContent: "<h1>Intro</h1>",
				width: 1920,
				height: 1080,
				durationSec: 6.0,
				companionAudioPath: "C:\\audio\\mic.wav",
				companionAudioName: "Speaker Voiceover",
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain("Export Video");
		expect(html).toContain("Kinetic Intro");
		expect(html).toContain("1920x1080");
		expect(html).toContain("60 fps");
		expect(html).toContain("30 fps");
		expect(html).toContain("Speaker Voiceover");
		expect(html).toContain("Start Export");
	});

	it("renders companion audio toggle when audio path is present", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframeExportModal, {
				isOpen: true,
				hyperframeName: "Webcam Demo",
				htmlContent: "<h1>Demo</h1>",
				width: 1920,
				height: 1080,
				durationSec: 10.0,
				companionAudioPath: "C:\\audio\\recording.mic.wav",
				companionAudioName: "recording.mic.wav",
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain("Include Audio Track");
		expect(html).toContain("recording.mic.wav");
	});
});
