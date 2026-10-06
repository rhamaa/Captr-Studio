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
		expect(html).toContain("hyperframe-transport-mute");
		expect(html).toContain("hyperframe-transport-scrubber");
		expect(html).toContain("hyperframe-total-duration-btn");
		expect(html).toContain("0.00s");
		expect(html).toContain("6.00s");

		// Center Stage Preview
		expect(html).toContain("hyperframe-stage-iframe");

		// Side Panel
		expect(html).toContain("CLI Agent");
		expect(html).toContain("Source Code");
	});

	it("renders prompt input with @ asset tagging trigger and synthesizes package audio tracks", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframeEditor, {
				hyperframe: mockHyperframe,
				project: mockProject,
				onUpdate: vi.fn(),
				onClose: vi.fn(),
			}),
		);

		expect(html).toContain("@ Tag Asset");
		// 2 project assets + 3 synthesized package tracks (mic, sys, webcam) = 5 available
		expect(html).toContain("5 available");
	});

	it("preprocessHyperframeHtml rewrites raw paths and basenames to loopback media URLs, ensures playsinline, and injects sync script with duration detector", () => {
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

		// Video elements have playsinline attribute
		expect(processed).toContain("playsinline");

		// Synchronizer script is injected before </body> with media duration detection
		expect(processed).toContain('id="__captr_hyperframe_sync"');
		expect(processed).toContain("window.seekFrame");
		expect(processed).toContain("syncMediaElements");
		expect(processed).toContain("detectMediaDuration");
		expect(processed).toContain("HYPERFRAME_DETECTED_DURATION");
	});

	it("buildProjectMediaUrlMap probes package sources (screen, webcam, mic) and maps synthesized audio names", async () => {
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
		expect(map.has("recording-1791200003951.mp4 (Microphone Audio)")).toBe(true);
		expect(map.has("pkg-1-mic")).toBe(true);
		expect(map.get("recording-1791200003951.mp4")).toContain("http://127.0.0.1:5000/video");
	});

	it("preprocessHyperframeHtml re-bases stale loopback URLs with old ports and auto-injects companion audio when missing", () => {
		const map = new Map<string, string>([
			[
				"recording-1791200003951.mp4",
				"http://127.0.0.1:63893/video?path=C%3A%5Cassets%5C0-0-0-0-0-recording-1791200003951.mp4",
			],
			[
				"recording-1791200003947-webcam.mp4",
				"http://127.0.0.1:63893/video?path=C%3A%5Cassets%5C1-1-1-1-1-recording-1791200003947-webcam.mp4",
			],
			[
				"recording-1791200003951.mp4 (Microphone Audio)",
				"http://127.0.0.1:63893/video?path=C%3A%5Cassets%5C2-2-2-2-2-recording-1791200003951.mic.wav",
			],
			[
				"pkg-1-mic",
				"http://127.0.0.1:63893/video?path=C%3A%5Cassets%5C2-2-2-2-2-recording-1791200003951.mic.wav",
			],
		]);

		// HTML produced in a previous run with dead port 49221 and shifted prefix 0-0-0-0-
		const staleHtml = `<!DOCTYPE html>
<html>
<body>
  <video id="screenVid" src="http://127.0.0.1:49221/video?path=C%3A%5Cworkspaces%5Cold%5Cassets%5C20148%5C0-0-0-0-recording-1791200003951.mp4"></video>
  <video id="webcamVid" src="http://127.0.0.1:49221/video?path=C%3A%5Cworkspaces%5Cold%5Cassets%5C20148%5C1-1-1-1-recording-1791200003947-webcam.mp4"></video>
</body>
</html>`;

		const processed = preprocessHyperframeHtml(staleHtml, map);

		// Dead port 49221 and shifted prefixes are resolved to the live media server port and files
		expect(processed).not.toContain(":49221");
		expect(processed).toContain(
			'src="http://127.0.0.1:63893/video?path=C%3A%5Cassets%5C0-0-0-0-0-recording-1791200003951.mp4"',
		);
		expect(processed).toContain(
			'src="http://127.0.0.1:63893/video?path=C%3A%5Cassets%5C1-1-1-1-1-recording-1791200003947-webcam.mp4"',
		);

		// Companion microphone audio is automatically injected since video is present without <audio>
		expect(processed).toContain('<audio id="__captr_companion_mic"');
		expect(processed).toContain(
			'src="http://127.0.0.1:63893/video?path=C%3A%5Cassets%5C2-2-2-2-2-recording-1791200003951.mic.wav"',
		);
	});

	it("renders Chatbot UI thread with version history ribbon and initial draft snapshot", () => {
		const html = renderToStaticMarkup(
			createElement(HyperframeEditor, {
				hyperframe: mockHyperframe,
				project: mockProject,
				onUpdate: vi.fn(),
				onClose: vi.fn(),
			}),
		);

		// Version History Ribbon
		expect(html).toContain("Version History");
		expect(html).toContain("1 rev");
		expect(html).toContain("hyperframe-version-pill-1");
		expect(html).toContain("Initial Draft");

		// Chatbot message thread
		expect(html).toContain("Motion Assistant:");
		expect(html).toContain("Hai! Saya AI Motion Designer untuk Captr Studio.");

		// Preset inspiration buttons
		expect(html).toContain("Video Showcase");
		expect(html).toContain("Screen + PiP Webcam");
		expect(html).toContain("Kinetic Intro");
	});

	it("renders multiple versions with historical assistant cards and terminal logs", () => {
		const hyperframeWithVersions: HyperframeComposition = {
			...mockHyperframe,
			versions: [
				{
					id: "v1",
					versionNumber: 1,
					timestamp: 1700000000000,
					label: "Initial Draft",
					htmlContent: "<h1>v1</h1>",
					durationUs: 6_000_000,
				},
				{
					id: "v2",
					versionNumber: 2,
					timestamp: 1700000010000,
					label: "Browser Mockup",
					prompt: "Embed in browser container",
					agentId: "claude",
					agentName: "Claude Code",
					htmlContent: "<h1>v2 Browser</h1>",
					durationUs: 6_000_000,
					logs: ["Compiling GSAP...", "Generated mockup frame"],
				},
			],
		};

		const html = renderToStaticMarkup(
			createElement(HyperframeEditor, {
				hyperframe: hyperframeWithVersions,
				project: mockProject,
				onUpdate: vi.fn(),
				onClose: vi.fn(),
			}),
		);

		// Shows 2 versions in ribbon
		expect(html).toContain("2 revs");
		expect(html).toContain("hyperframe-version-pill-1");
		expect(html).toContain("hyperframe-version-pill-2");

		// Shows user prompt in chat
		expect(html).toContain("Embed in browser container");

		// Shows assistant response card with agent name and version
		expect(html).toContain("Claude Code");
		expect(html).toContain("Generated Version 2 (Browser Mockup)");
		expect(html).toContain("Terminal Stream (2 lines)");
	});
});

