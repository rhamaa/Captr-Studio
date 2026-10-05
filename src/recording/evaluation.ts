import { createTimelineProject } from "@/core/timeline/commands";
import { mapCompositionTime, mapStreamTime } from "@/core/timeline/timeMapping";
import { resolveRecordingSettings } from "./editor/compositionAdapter";
import type { RecordComposition, RecordingPackage } from "./types";
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
export function recordingPreviewProject(
	pkg: RecordingPackage,
	composition: RecordComposition,
	canvas?: { width: number; height: number; fps?: number },
	clipTransform?: { x: number; y: number; scale: number; rotation: number; opacity: number },
) {
	const project = createTimelineProject("recording-preview", "Recording");
	if (canvas && canvas.width > 0 && canvas.height > 0) {
		project.canvas = {
			width: canvas.width,
			height: canvas.height,
			fps: canvas.fps ?? 30,
		};
	}
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
			transform: clipTransform ?? { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1 },
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
