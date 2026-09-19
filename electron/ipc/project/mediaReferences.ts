type DataObject = Record<string, unknown>;

function object(value: unknown): DataObject {
	return value !== null && typeof value === "object" && !Array.isArray(value)
		? (value as DataObject)
		: {};
}

function objects(value: unknown): DataObject[] {
	return Array.isArray(value) ? value.map(object) : [];
}

/** Explicit project media fields shared by loading and recording retention.
 * Do not recursively approve arbitrary strings from a project file.
 */
export function collectProjectMediaPaths(project: unknown): string[] {
	const root = object(project);
	const paths = new Set<string>();
	const add = (value: unknown) => {
		if (typeof value === "string" && value.trim() && !/^(data|blob|https?):/i.test(value)) {
			paths.add(value);
		}
	};
	const collect = (entry: DataObject) => {
		for (const field of [
			"videoPath",
			"webcamPath",
			"microphoneAudioPath",
			"systemAudioPath",
			"cursorTelemetryPath",
		]) {
			add(entry[field]);
		}
		add(object(entry.webcam).sourcePath);
		for (const layer of objects(entry.mediaTrackLayers)) add(layer.sourcePath);
		for (const track of objects(entry.audioTracks)) add(track.sourcePath);
		for (const region of objects(entry.audioRegions)) add(region.audioPath);
		for (const region of objects(entry.annotationRegions)) {
			add(region.imageFilePath);
			add(region.videoFilePath);
			add(region.gifPath);
		}
		for (const asset of objects(entry.assetFiles)) add(asset.path);
	};
	collect(root);
	collect(object(root.editor));
	for (const clip of objects(root.clips)) collect(clip);
	return [...paths];
}

export function getProjectPrimaryMedia(project: unknown) {
	const root = object(project);
	const firstClip = objects(root.clips).find(
		(clip) => typeof clip.videoPath === "string" && clip.videoPath.trim(),
	);
	const videoPath =
		typeof root.videoPath === "string" && root.videoPath.trim()
			? root.videoPath
			: typeof firstClip?.videoPath === "string"
				? firstClip.videoPath
				: null;
	const webcam = object(object(root.editor).webcam).sourcePath;
	const webcamPath =
		typeof webcam === "string" && webcam.trim()
			? webcam
			: typeof firstClip?.webcamPath === "string"
				? firstClip.webcamPath
				: null;
	return { videoPath, webcamPath };
}
