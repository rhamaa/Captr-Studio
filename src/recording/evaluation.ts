import type { RecordComposition, RecordingPackage } from "./types";
import { mapCompositionTime, mapStreamTime } from "@/core/timeline/timeMapping";
import { resolveRecordingSettings } from "./editor/compositionAdapter";
import { createTimelineProject } from "@/core/timeline/commands";
export function evaluateRecording(
	pkg: RecordingPackage,
	composition: RecordComposition,
	outputUs: number,
) {
	const sourceUs = mapCompositionTime(composition, outputUs),
		settings = resolveRecordingSettings(pkg, composition);
	return {
		package: pkg,
		composition,
		settings,
		sourceUs,
		screenUs: mapStreamTime(sourceUs, pkg.screen.offsetUs, pkg.screen.durationUs),
		webcamUs: pkg.webcam
			? mapStreamTime(sourceUs, pkg.webcam.offsetUs, pkg.webcam.durationUs)
			: null,
	};
}
export function recordingPreviewProject(pkg: RecordingPackage, composition: RecordComposition) {
	const project = createTimelineProject("recording-preview", "Recording");
	project.packages = [pkg];
	project.compositions = [composition];
	project.assets = [
		{
			id: "preview-asset",
			kind: "recording",
			name: "Recording",
			durationUs: pkg.durationUs,
			width: pkg.width,
			height: pkg.height,
			packageId: pkg.id,
		},
	];
	project.tracks[0].clips = [
		{
			id: "preview-clip",
			assetId: "preview-asset",
			compositionId: composition.id,
			startUs: 0,
			sourceInUs: 0,
			sourceOutUs: composition.durationUs,
			rate: 1,
			gain: 1,
			enabled: true,
			transform: { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
		},
	];
	return project;
}
export function sourceToCompositionTime(composition: RecordComposition, sourceUs: number) {
	for (const segment of composition.timeMap) {
		const end =
			segment.sourceStartUs + (segment.outputEndUs - segment.outputStartUs) * segment.rate;
		if (sourceUs < end)
			return Math.max(
				segment.outputStartUs,
				segment.outputStartUs + (sourceUs - segment.sourceStartUs) / segment.rate,
			);
	}
	return Math.max(0, composition.durationUs - 1);
}
