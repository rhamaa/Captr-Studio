import type { AudioPeaksData } from "../video-editor/timeline/core/timelineTypes";

export function waveformPath(
	data: AudioPeaksData,
	sourceInUs: number,
	rate: number,
	scale: number,
	width: number,
	height: number,
): string {
	let path = "";
	const count = Math.min(4000, Math.ceil(width / 3));
	for (let i = 0; i < count; i++) {
		const x = i * width / count,
			begin = (sourceInUs + (x / scale) * 1_000_000 * rate) / 1000;
		const end = begin + (width / count / scale) * 1000 * rate;
		const a = Math.max(0, Math.floor((begin / data.durationMs) * data.peaks.length));
		const b = Math.min(
			data.peaks.length,
			Math.max(a + 1, Math.ceil((end / data.durationMs) * data.peaks.length)),
		);
		let peak = 0;
		for (let n = a; n < b; n++) peak = Math.max(peak, data.peaks[n]);
		const h = Math.min(1, Math.max(0, peak)) * height;
		if (h) path += `M${x},${(height - h) / 2}h2v${h}h-2Z `;
	}
	return path;
}

export function sourceTimesForFilmstrip(
	sourceInUs: number,
	sourceOutUs: number,
	_rate: number,
	requested: number,
): number[] {
	const count = Math.max(1, Math.min(12, Math.ceil(requested)));
	return Array.from({ length: count }, (_, i) =>
		Math.round(sourceInUs + ((sourceOutUs - sourceInUs) * i) / count),
	);
}
