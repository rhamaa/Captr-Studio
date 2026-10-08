import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const srcDir = path.join(rootDir, "node_modules/@tldraw/assets");
const destDir = path.join(rootDir, "public/tldraw-assets");

if (fs.existsSync(srcDir)) {
	fs.mkdirSync(destDir, { recursive: true });
	for (const dir of ["icons", "embed-icons", "fonts", "translations"]) {
		const s = path.join(srcDir, dir);
		const d = path.join(destDir, dir);
		if (fs.existsSync(s)) {
			fs.cpSync(s, d, { recursive: true });
			console.log(`[copy-tldraw-assets] Copied ${dir} -> public/tldraw-assets/${dir}`);
		}
	}
} else {
	console.warn("[copy-tldraw-assets] Warning: node_modules/@tldraw/assets not found");
}
