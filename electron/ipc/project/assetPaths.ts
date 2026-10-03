import { existsSync } from "node:fs";
import path from "node:path";
import { app } from "electron";

export function getAssetRootPath(): string {
	if (typeof app !== "undefined" && app?.isPackaged) {
		return path.join(process.resourcesPath, "assets");
	}

	if (typeof app !== "undefined" && typeof app?.getAppPath === "function") {
		const devPublic = path.join(app.getAppPath(), "public");
		if (existsSync(devPublic)) {
			return devPublic;
		}
	}

	const cwdPublic = path.join(process.cwd(), "public");
	if (existsSync(cwdPublic)) {
		return cwdPublic;
	}

	return cwdPublic;
}
