import { describe, expect, it } from "vitest";
import {
	extractHtmlFromAgentOutput,
	formatHyperframeTaskPrompt,
} from "./hyperframeAgentRunner";

describe("hyperframeAgentRunner", () => {
	it("formats hyperframe task prompt including assets and dimensions", () => {
		const prompt = formatHyperframeTaskPrompt({
			userPrompt: "Create a modern 3D title card",
			hyperframeName: "Intro Card",
			width: 1920,
			height: 1080,
			durationSec: 5,
			assetsSummary: "screen-1.mp4 (video), logo.png (graphic)",
			draftFilePath: "D:/temp/index.html",
		});

		expect(prompt).toContain("Create a modern 3D title card");
		expect(prompt).toContain("1920x1080");
		expect(prompt).toContain("screen-1.mp4");
		expect(prompt).toContain("index.html");
	});

	it("extracts html code block from stdout when present", () => {
		const stdout = `Here is the revised kinetic composition:
\`\`\`html
<!DOCTYPE html>
<html>
<head><style>h1 { color: #6FA8FF; }</style></head>
<body><h1>Hello Captr</h1></body>
</html>
\`\`\`
Hope this helps!`;

		const extracted = extractHtmlFromAgentOutput(stdout);
		expect(extracted).toContain("<!DOCTYPE html>");
		expect(extracted).toContain("Hello Captr");
		expect(extracted).not.toContain("Here is the revised");
	});

	it("returns raw text if no code block but starts with <!DOCTYPE or <html", () => {
		const raw = "<!DOCTYPE html><html><body><h1>Direct</h1></body></html>";
		expect(extractHtmlFromAgentOutput(raw)).toBe(raw);
	});

	it("formats task prompt with tagged media priority section when taggedAssets are provided", () => {
		const prompt = formatHyperframeTaskPrompt({
			userPrompt: "Animate @logo.png and bounce it",
			hyperframeName: "Intro",
			width: 1920,
			height: 1080,
			durationSec: 5,
			assetsSummary: "logo.png (image, id: a1)",
			draftFilePath: "index.html",
			taggedAssets: [
				{ id: "a1", name: "logo.png", kind: "image", path: "/path/to/logo.png" },
			],
		});

		expect(prompt).toContain("PRIORITY TAGGED MEDIA");
		expect(prompt).toContain("@logo.png");
		expect(prompt).toContain("/path/to/logo.png");
	});

	it("formats recording package details including screen, webcam, mic, captions, and cursor telemetry", () => {
		const prompt = formatHyperframeTaskPrompt({
			userPrompt: "Insert @recording-123.mp4 into frame and highlight cursor clicks",
			hyperframeName: "Demo Recording",
			width: 1920,
			height: 1080,
			durationSec: 10,
			assetsSummary: "recording-123.mp4 (recording)",
			draftFilePath: "index.html",
			taggedAssets: [
				{
					id: "a-rec",
					name: "recording-123.mp4",
					kind: "recording",
					path: "C:/recordings/screen.mp4",
					mediaUrl: "http://127.0.0.1:5000/video?path=screen.mp4",
					recordingPackage: {
						id: "pkg-1",
						name: "Recording Session 1",
						screen: {
							path: "C:/recordings/screen.mp4",
							mediaUrl: "http://127.0.0.1:5000/video?path=screen.mp4",
							width: 1920,
							height: 1080,
							durationSec: 10,
						},
						webcam: {
							path: "C:/recordings/webcam.mp4",
							mediaUrl: "http://127.0.0.1:5000/video?path=webcam.mp4",
						},
						microphone: {
							path: "C:/recordings/mic.wav",
							mediaUrl: "http://127.0.0.1:5000/video?path=mic.wav",
						},
						transcript: {
							fullText: "Welcome to our application walkthrough",
							segments: [{ startMs: 0, endMs: 2000, text: "Welcome to our application" }],
						},
						cursorTelemetrySummary: {
							sampleCount: 420,
							clickCount: 5,
						},
					},
				},
			],
		});

		expect(prompt).toContain("Screen Recording Video");
		expect(prompt).toContain("http://127.0.0.1:5000/video?path=screen.mp4");
		expect(prompt).toContain("Webcam Overlay Video");
		expect(prompt).toContain("Microphone Audio Track");
		expect(prompt).toContain("Speech Transcript & Captions");
		expect(prompt).toContain("Welcome to our application walkthrough");
		expect(prompt).toContain("420 points, 5 mouse clicks recorded");
		expect(prompt).toContain("cursor_telemetry.json");
		expect(prompt).toContain("transcript.json");
		expect(prompt).toContain("captions.vtt");
		expect(prompt).toContain("CRITICAL HTML5 VIDEO EMBEDDING & SYNC RULES");
	});
});
