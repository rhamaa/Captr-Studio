const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

app.disableHardwareAcceleration();

app.whenReady().then(async () => {
	try {
		const win = new BrowserWindow({
			width: 1024,
			height: 1024,
			show: false,
			frame: false,
			transparent: true,
			webPreferences: {
				offscreen: true,
			},
		});

		const svgPath = path.resolve("public/favicon.svg");
		const svgContent = fs.readFileSync(svgPath, "utf8");
		// Ensure width="1024" height="1024"
		const scaledSvg = svgContent.replace(
			/width="64"\s+height="64"/,
			'width="1024" height="1024"',
		);

		const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1024px; height: 1024px; overflow: hidden; background: transparent; }
    svg { width: 1024px; height: 1024px; display: block; }
  </style>
</head>
<body>
  ${scaledSvg}
</body>
</html>`;

		const tmpHtml = path.resolve("scratch_icon_render.html");
		fs.writeFileSync(tmpHtml, html, "utf8");

		await win.loadFile(tmpHtml);
		await new Promise((r) => setTimeout(r, 800));

		const image = await win.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
		const outPath = path.resolve("icon-1024.png");
		fs.writeFileSync(outPath, image.toPNG());
		console.log(`Generated 1024x1024 icon at: ${outPath}`);
		try {
			fs.unlinkSync(tmpHtml);
		} catch {
			// Best-effort temp cleanup; the generated icon already exists.
		}
	} catch (err) {
		console.error("Error generating icon:", err);
	} finally {
		app.exit(0);
	}
});
