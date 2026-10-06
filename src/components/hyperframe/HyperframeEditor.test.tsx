import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { HyperframeComposition } from "@/core/story/storyTypes";
import type { TimelineProject } from "@/core/timeline/types";
import {
	buildProjectMediaUrlMap,
	HyperframeEditor,
	preprocessHyperframeHtml,
} from "./HyperframeEditor";

const mockHyperframe: HyperframeComposition = {
	id: "hf-full-1",
	name: "Kinetic Intro Screen",
	entryHtml: "hyperframe/hyperframe-hf-full-1.html",
	specJson: "hyperframe/hyperframe-hf-full-1.json",
	htmlContent: "<!DOCTYPE html><html><body><h1>Hyperframe Full View</h1></body></html>",
	durationUs: 6_000_000,
	width: 1920,
	height: 1080,
	fps: 60,
	aspectRatio: "16:9",
	createdAt: "2026-10-06T10:00:00.000Z",
};

const mockProject: TimelineProject = {
	version: 3,
	projectId: "proj-full",
	title: "Product Launch",
	assets: [
		{
			id: "a1",
			kind: "video",
			name: "teaser.mp4",
			source: { kind: "video", path: "/videos/teaser.mp4" },
			durationUs: 10_000_000,
			width: 1920,
			height: 1080,
		},
		{
			id: "a-rec",
			kind: "recording",
			name: "recording-1791200003951.mp4",
			packageId: "pkg-1",
			durationUs: 15_000_000,
		},
	],
	tracks: [],
	canvas: { width: 1920, height: 1080, fps: 60 },
	packages: [
		{
			id: "pkg-1",
			captureId: "cap-1",
			schemaVersion: 1,
			durationUs: 15_000_000,
			width: 1920,
			height: 1080,
			settings: {},
			screen: {
				path: "C:\\Users\\FIRDAUS\\recordings\\recording-1791200003951.mp4",
				durationUs: 15_000_000,
				offsetUs: 0,
			},
			webcam: {
				path: "C:\\Users\\FIRDAUS\\recordings\\recording-1791200003951-webcam.mp4",
				durationUs: 15_000_000,
				offsetUs: 0,
			},
			microphone: {
				path: "C:\\Users\\FIRDAUS\\recordings\\recording-1791200003951.mic.wav",
				durationUs: 15_000_000,
				offsetUs: 0,
			},
			system: {
				path: "C:\\Users\\FIRDAUS\\recordings\\recording-1791200003951.sys.wav",
				durationUs: 15_000_000,
				offsetUs: 0,
			},
		},
	],
	compositions: [],
	createdAt: "2026-10-06T10:00:00.000Z",
	updatedAt: "2026-10-06T10:00:00.000Z",
};

describe("HyperframeEditor", () => {
	it("renders full editor header, expansive preview, and dedicated transport bar", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframeEditor, {
				hyperframe: mockHyperframe,
				project: mockProject,
				projectTitle: "Product Launch",
				onUpdate: vi.fn(),
				onClose: vi.fn(),
			}),
		);

		// Top header
		expect(html).toContain("Kinetic Intro Screen");
		expect(html).toContain("16:9");
		expect(html).toContain("1920x1080");
		expect(html).toContain("6.0s");
		expect(html).toContain("Back");

		// Dedicated Transport Controls
		expect(html).toContain("hyperframe-transport-play");
		expect(html).toContain("hyperframe-transport-scrubber");
		expect(html).toContain("0.00s");
		expect(html).toContain("6.00s");

		// Center Stage Preview
		expect(html).toContain("hyperframe-stage-iframe");

		// Side Panel
		expect(html).toContain("CLI Agent");
		expect(html).toContain("Source Code");
	});

	it("renders prompt input with @ asset tagging trigger", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframeEditor, {
				hyperframe: mockHyperframe,
				project: mockProject,
				onUpdate: vi.fn(),
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain("@ Tag Asset");
		expect(html).toContain("2 available");
	});

	it("preprocessHyperframeHtml rewrites raw paths and basenames to loopback media URLs, ensures muted/playsinline, and injects sync script", () => {
		const map = new Map<string, string>([
			[
				"C:\\Users\\FIRDAUS\\recordings\\recording-1791200003951.mp4",
				"http://127.0.0.1:62733/video?path=C%3A%5Crecordings%5Cscreen.mp4",
			],
			[
				"recording-1791200003951.mp4",
				"http://127.0.0.1:62733/video?path=C%3A%5Crecordings%5Cscreen.mp4",
			],
			[
				"recording-1791200003951-webcam.mp4",
				"http://127.0.0.1:62733/video?path=C%3A%5Crecordings%5Cwebcam.mp4",
			],
		]);

		const rawHtml = `<!DOCTYPE html>
<html>
<body>
  <video src="recording-1791200003951.mp4"></video>
  <video class="pip" src="recording-1791200003951-webcam.mp4" autoplay></video>
</body>
</html>`;

		const processed = preprocessHyperframeHtml(rawHtml, map);

		// Video sources are rewritten to playable HTTP loopback URLs
		expect(processed).toContain(
			'src="http://127.0.0.1:62733/video?path=C%3A%5Crecordings%5Cscreen.mp4"',
		);
		expect(processed).toContain(
			'src="http://127.0.0.1:62733/video?path=C%3A%5Crecordings%5Cwebcam.mp4"',
		);

		// Video elements have muted and playsinline attributes
		expect(processed).toContain("muted");
		expect(processed).toContain("playsinline");

		// Synchronizer script is injected before </body>
		expect(processed).toContain('id="__captr_hyperframe_sync"');
		expect(processed).toContain("window.seekFrame");
		expect(processed).toContain("syncMediaElements");
	});

	it("buildProjectMediaUrlMap probes package sources (screen, webcam, mic) and assets", async () => {
		const mockGetLocalMediaUrl = vi.fn(async (p: string) => {
			return {
				success: true,
				url: `http://127.0.0.1:5000/video?path=${encodeURIComponent(p)}`,
			};
		});

		const map = await buildProjectMediaUrlMap(mockProject, mockGetLocalMediaUrl);

		// Should have resolved screen, webcam, mic, sys, and asset
		expect(map.size).toBeGreaterThan(0);
		expect(map.has("recording-1791200003951.mp4")).toBe(true);
		expect(map.has("recording-1791200003951-webcam.mp4")).toBe(true);
		expect(map.get("recording-1791200003951.mp4")).toContain("http://127.0.0.1:5000/video");
	});
});
