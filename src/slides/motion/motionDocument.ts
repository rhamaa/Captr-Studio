import {
	STARTER_CSS,
	STARTER_HTML,
	STARTER_JS,
	type MotionSlideMeta,
} from "./schema";

export interface MotionDocumentParts {
	html: string;
	css: string;
	js: string;
}

export interface MotionDocumentParseOptions {
	includeExternalStylesheets?: boolean;
	fallbackCss?: string;
	fallbackJs?: string;
}

export function parseMotionDocument(
	rawContent: string,
	options: MotionDocumentParseOptions = {},
): MotionDocumentParts {
	if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(rawContent, "text/html");

			const styleElements = Array.from(doc.querySelectorAll("style"));
			const cssList = styleElements.map((element) => element.textContent || "").filter(Boolean);
			styleElements.forEach((element) => element.remove());

			const scriptElements = Array.from(doc.querySelectorAll("script:not([src])"));
			const jsList = scriptElements.map((element) => element.textContent || "").filter(Boolean);
			scriptElements.forEach((element) => element.remove());

			const stylesheetLinks = options.includeExternalStylesheets
				? Array.from(doc.head?.querySelectorAll('link[rel="stylesheet"]') || [])
						.map((link) => link.outerHTML)
						.join("\n")
				: "";
			let html = doc.body ? doc.body.innerHTML.trim() : rawContent;
			if (stylesheetLinks && !html.includes(stylesheetLinks)) {
				html = `${stylesheetLinks}\n${html}`;
			}

			return {
				html: html || rawContent,
				css: cssList.join("\n\n") || options.fallbackCss || "",
				js: jsList.join("\n\n") || options.fallbackJs || "",
			};
		} catch (err) {
			console.warn("[MotionSlide] DOMParser error, using regex fallback:", err);
		}
	}

	const cssMatches: string[] = [];
	const cleanCss = rawContent.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, (_match, css) => {
		cssMatches.push(css.trim());
		return "";
	});

	const jsMatches: string[] = [];
	const cleanJs = cleanCss.replace(
		/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi,
		(_match, js) => {
			jsMatches.push(js.trim());
			return "";
		},
	);

	const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(cleanJs);
	const html = (bodyMatch ? bodyMatch[1] : cleanJs).trim();

	return {
		html: html || rawContent,
		css: cssMatches.filter(Boolean).join("\n\n") || options.fallbackCss || "",
		js: jsMatches.filter(Boolean).join("\n\n") || options.fallbackJs || "",
	};
}

export function extractDocumentParts(docString: string): MotionDocumentParts {
	return parseMotionDocument(docString);
}

export function parseHtmlFileContent(rawContent: string): MotionDocumentParts {
	return parseMotionDocument(rawContent, {
		includeExternalStylesheets: true,
		fallbackCss: "/* Tidak ada tag <style> di dalam file HTML */",
		fallbackJs:
			"// Timeline hook dipanggil otomatis oleh Captr Studio saat scrubbing/playback\nwindow.setSeekTime = function(timeMs, durationMs) {};",
	});
}

export function buildMotionEditorPreviewDocument(html: string, css: string, js: string): string {
	return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
${css}
  </style>
</head>
<body>
${html}
  <script>
    (function() {
      try {
${js}
      } catch (err) {
        console.error("[Motion Script Error]", err);
      }

      window.addEventListener("message", function(e) {
        if (e.data && e.data.type === "SEEK") {
          if (typeof window.setSeekTime === "function") {
            try {
              window.setSeekTime(e.data.timeMs, e.data.durationMs);
            } catch(seekErr) {
              console.error("[Motion Seek Error]", seekErr);
            }
          }
        }
      });
    })();
  </script>
</body>
</html>`;
}

export function buildMotionPreviewDocument(meta: Partial<MotionSlideMeta>): string {
	let document = meta.document?.trim();
	if (!document) {
		const html = meta.html ?? STARTER_HTML;
		const css = meta.css ?? STARTER_CSS;
		const js = meta.js ?? STARTER_JS;
		document = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
${css}
  </style>
</head>
<body>
${html}

  <script>
${js}
  </script>
</body>
</html>`;
	}

	const seekBridgeScript = `
  <script data-captr-bridge="true">
    (function() {
      window.addEventListener("message", function(e) {
        if (e.data && e.data.type === "SEEK") {
          if (typeof window.setSeekTime === "function") {
            try {
              window.setSeekTime(e.data.timeMs, e.data.durationMs);
            } catch(seekErr) {
              console.error("[Captr Motion Seek Error]", seekErr);
            }
          }
        }
      });
    })();
  </script>`;

	if (document.includes("</body>")) {
		return document.replace("</body>", `${seekBridgeScript}\n</body>`);
	}
	return `${document}\n${seekBridgeScript}`;
}
