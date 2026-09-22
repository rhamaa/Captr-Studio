import fs from "fs";
import path from "path";

const sizes = [16, 32, 64, 128, 256, 512, 1024];
const srcDir = path.resolve("icons/icons/png");
const destDir = path.resolve("public/app-icons");
const icoSrc = path.resolve("icons/icons/win/icon.ico");
const faviconDest = path.resolve("public/favicon.ico");

fs.mkdirSync(destDir, { recursive: true });

for (const size of sizes) {
	const srcFile = path.join(srcDir, `${size}x${size}.png`);
	if (fs.existsSync(srcFile)) {
		fs.copyFileSync(srcFile, path.join(destDir, `captr-${size}.png`));
		fs.copyFileSync(srcFile, path.join(destDir, `captrmac-${size}.png`));
		fs.copyFileSync(srcFile, path.join(destDir, `recordly-${size}.png`));
		fs.copyFileSync(srcFile, path.join(destDir, `recordlymac-${size}.png`));
		console.log(`Synced size ${size}px`);
	} else {
		console.warn(`Missing size ${size}x${size}.png`);
	}
}

if (fs.existsSync(icoSrc)) {
	fs.copyFileSync(icoSrc, faviconDest);
	console.log("Synced favicon.ico");
}
