import type { TimelineProject } from "./types";

const fields = new Set([
	"videoPath",
	"webcamPath",
	"microphoneAudioPath",
	"systemAudioPath",
	"cursorTelemetryPath",
	"imageFilePath",
	"videoFilePath",
	"gifPath",
	"audioPath",
	"sourcePath",
]);
export function isWallpaperMediaFile(v: string): boolean {
	if (!v || typeof v !== "string") return false;
	const trimmed = v.trim();
	if (/^(data|blob|https?):/i.test(trimmed)) return false;
	if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) return false;
	if (/^(?:linear|radial|conic)-gradient\(/i.test(trimmed)) return false;
	if (trimmed.toLowerCase() === "transparent" || trimmed.toLowerCase() === "none") return false;
	return (
		/^(?:[a-z]:[\\/]|\/)/i.test(trimmed) ||
		trimmed.startsWith("assets/") ||
		/^\/?(wallpapers|app-icons)\//i.test(trimmed) ||
		/\.(jpe?g|png|webp|avif|gif|svg|mp4|webm|mov|mkv)$/i.test(trimmed)
	);
}

function cleanMediaValue(v: string): string {
	if (v.startsWith("file://")) {
		let decoded = decodeURIComponent(v.replace(/^file:\/\//, ""));
		if (/^\/[A-Za-z]:/.test(decoded)) {
			decoded = decoded.slice(1);
		}
		return decoded;
	}
	return v;
}

export function isBundledWallpaperReference(v: string): boolean {
	const normalized = v.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
	return ["wallpapers/", "app-icons/"].some((prefix) => normalized.startsWith(prefix));
}

function settingsPaths(value: unknown, visit: (path: string, set: (path: string) => void) => void) {
	if (!value || typeof value !== "object") return;
	for (const [key, rawValue] of Object.entries(value)) {
		if (typeof rawValue === "string" && rawValue) {
			const v = cleanMediaValue(rawValue);
			if (
				!/^(data|blob|https?):/i.test(v) &&
				(fields.has(key) || (key === "wallpaper" && isWallpaperMediaFile(v)))
			) {
				visit(v, (next) => {
					(value as Record<string, unknown>)[key] = next;
				});
			}
		} else if (rawValue && typeof rawValue === "object") {
			settingsPaths(rawValue, visit);
		}
	}
}
/** Visits explicit media references only; arbitrary metadata strings never grant file access. */
export function visitTimelineMediaPaths(
	project: TimelineProject,
	visit: (path: string, set: (path: string) => void, ownerId: string) => void,
): void {
	for (const asset of project.assets) {
		if (asset.source)
			visit(
				asset.source.path,
				(p) => {
					asset.source!.path = p;
				},
				asset.id,
			);
		if (asset.packageId) {
			const pkg = project.packages.find((r) => r.id === asset.packageId);
			if (!pkg) throw new Error("Missing recording package");
			for (const source of [pkg.screen, pkg.webcam, pkg.microphone, pkg.system])
				if (source)
					visit(
						source.path,
						(p) => {
							source.path = p;
						},
						asset.id,
					);
			if (pkg.cursorPath)
				visit(
					pkg.cursorPath,
					(p) => {
						pkg.cursorPath = p;
					},
					asset.id,
				);
			settingsPaths(pkg.settings, (p, set) => visit(p, set, asset.id));
			for (const composition of project.compositions.filter((c) => c.packageId === pkg.id))
				settingsPaths(composition.settings, (p, set) => visit(p, set, asset.id));
		}
	}
}
export function timelineMediaPaths(project: TimelineProject): string[] {
	const paths = new Set<string>();
	visitTimelineMediaPaths(project, (p) => paths.add(p));
	return [...paths];
}
