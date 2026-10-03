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
function settingsPaths(value: unknown, visit: (path: string, set: (path: string) => void) => void) {
	if (!value || typeof value !== "object") return;
	for (const [key, v] of Object.entries(value)) {
		if (
			typeof v === "string" &&
			v &&
			!/^(data|blob|https?):/i.test(v) &&
			(fields.has(key) ||
				(key === "wallpaper" &&
					(/^(?:[a-z]:[\\/]|\/)/i.test(v) || v.startsWith("assets/"))))
		)
			visit(v, (next) => {
				(value as Record<string, unknown>)[key] = next;
			});
		else if (v && typeof v === "object") settingsPaths(v, visit);
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
