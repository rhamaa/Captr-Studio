import fs from "fs";
import path from "path";

const sizes = [16, 32, 64, 128, 256, 512, 1024];
const srcDir = path.resolve("icons/icons/png");
const destDir = path.resolve("public/app-icons");
const icoSrc = path.resolve("icons/icons/win/icon.ico");
const faviconDest = path.resolve("public/favicon.ico");

const distDestDir = path.resolve("dist/app-icons");
const distFaviconDest = path.resolve("dist/favicon.ico");

fs.mkdirSync(destDir, { recursive: true });
if (fs.existsSync(path.resolve("dist"))) {
	fs.mkdirSync(distDestDir, { recursive: true });
}

for (const size of sizes) {
	const srcFile = path.join(srcDir, `${size}x${size}.png`);
	if (fs.existsSync(srcFile)) {
		for (const targetDir of [destDir, fs.existsSync(distDestDir) ? distDestDir : null].filter(Boolean)) {
			fs.copyFileSync(srcFile, path.join(targetDir, `captr-${size}.png`));
			fs.copyFileSync(srcFile, path.join(targetDir, `captrmac-${size}.png`));
			fs.copyFileSync(srcFile, path.join(targetDir, `recordly-${size}.png`));
			fs.copyFileSync(srcFile, path.join(targetDir, `recordlymac-${size}.png`));
		}
		console.log(`Synced size ${size}px`);
	} else {
		console.warn(`Missing size ${size}x${size}.png`);
	}
}

if (fs.existsSync(icoSrc)) {
	fs.copyFileSync(icoSrc, faviconDest);
	fs.copyFileSync(icoSrc, path.resolve("public/captr-project.ico"));
	if (fs.existsSync(path.resolve("dist"))) {
		fs.copyFileSync(icoSrc, distFaviconDest);
		fs.copyFileSync(icoSrc, path.resolve("dist/captr-project.ico"));
	}
	console.log("Synced favicon.ico and captr-project.ico");
}
