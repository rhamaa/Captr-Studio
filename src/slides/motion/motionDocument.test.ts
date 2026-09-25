import {
	DEFAULT_SINGLE_DOCUMENT_TEMPLATE,
	type MotionSlideMeta,
	createDefaultMotionMeta,
	extractDocumentParts,
} from "./schema";

describe("Motion single document structure", () => {
	it("extracts html, css, and js from unified single document", () => {
		const doc = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { background: #000; color: #fff; }
    .box { width: 100px; height: 100px; }
  </style>
</head>
<body>
  <div class="box">Motion Box</div>
  <script>
    window.setSeekTime = function(timeMs) {
      console.log(timeMs);
    };
  </script>
</body>
</html>`;

		const parts = extractDocumentParts(doc);
		expect(parts.css).toContain("body { background: #000;");
		expect(parts.js).toContain("window.setSeekTime");
		expect(parts.html).toContain('<div class="box">Motion Box</div>');
	});

	it("creates default meta with full unified document", () => {
		const meta = createDefaultMotionMeta();
		expect(meta.document).toContain("<!DOCTYPE html>");
		expect(meta.document).toContain("<style>");
		expect(meta.document).toContain("<script>");
		expect(meta.document).toContain("window.setSeekTime");
		expect(meta.durationMs).toBe(5000);
	});
});
