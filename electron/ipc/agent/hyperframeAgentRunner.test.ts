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
});
