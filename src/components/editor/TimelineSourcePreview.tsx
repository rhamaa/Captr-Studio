import { useEffect, useState } from "react";
import { useTimelineAudioPeaks } from "../video-editor/timeline/hooks/useTimelineAudioPeaks";
import type { TimelineClip, TimelineProject } from "@/core/timeline/types";
import { resolveClipSource } from "@/core/timeline/clipSource";
import { mapCompositionTime } from "@/core/timeline/timeMapping";
import { LayerVideoSource } from "@/lib/exporter/layerVideoSource";
import { sourceTimesForFilmstrip, waveformPath } from "./timelineMediaPreview";

const thumbnails = new Map<string, string>();
let thumbnailQueue = Promise.resolve();

export function TimelineAudioPreview({
	path,
	clip,
	scale,
	width,
}: {
	path: string;
	clip: TimelineClip;
	scale: number;
	width: number;
}) {
	const { peaks, loading } = useTimelineAudioPeaks(path);
	return peaks ? (
		<svg className="project-clip-waveform" aria-hidden="true">
			<path
				d={waveformPath(peaks, clip.sourceInUs, clip.rate, scale, width, 51)}
				fill="currentColor"
			/>
		</svg>
	) : (
		<span className="project-clip-media-status">
			{loading ? "Loading waveform…" : "Waveform unavailable"}
		</span>
	);
}

export function TimelineFilmstrip({
	project,
	clip,
	width,
}: {
	project: TimelineProject;
	clip: TimelineClip;
	width: number;
}) {
	const source = resolveClipSource(project, clip),
		comp = project.compositions.find((c) => c.id === clip.compositionId);
	const pkg = project.packages.find((p) => p.id === comp?.packageId),
		path = pkg?.screen.path ?? source.media?.source?.path;
	const times = sourceTimesForFilmstrip(
		clip.sourceInUs,
		clip.sourceOutUs,
		clip.rate,
		Math.ceil(width / 80),
	).map((t) =>
		comp
			? Math.max(
					0,
					mapCompositionTime(comp, Math.min(comp.durationUs - 1, t)) -
						(pkg?.screen.offsetUs ?? 0),
				)
			: t,
	);
	const key = JSON.stringify([path, times]);
	const [result, setResult] = useState<{ key: string; frames: string[]; error?: boolean }>({
		key: "",
		frames: [],
	});
	useEffect(() => {
		if (!path) return;
		const abort = new AbortController();
		let decoder: LayerVideoSource | undefined;
		const job = thumbnailQueue.then(async () => {
			if (abort.signal.aborted) return;
			const canvas = document.createElement("canvas");
			canvas.width = 128;
			canvas.height = 72;
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("Thumbnail canvas unavailable");
			const frames: string[] = [];
			try {
				for (const time of times) {
					if (abort.signal.aborted) return;
					const cacheKey = `${path}:${time}`;
					let frame = thumbnails.get(cacheKey);
					if (!frame) {
						if (!decoder) {
							decoder = new LayerVideoSource();
							await decoder.load(path);
						}
						const video = await decoder.frame(time / 1_000_000);
						if (abort.signal.aborted) return;
						ctx.clearRect(0, 0, 128, 72);
						ctx.drawImage(video, 0, 0, 128, 72);
						frame = canvas.toDataURL("image/jpeg", 0.65);
						thumbnails.set(cacheKey, frame);
						if (thumbnails.size > 120)
							thumbnails.delete(thumbnails.keys().next().value!);
					}
					frames.push(frame);
				}
				if (!abort.signal.aborted) setResult({ key, frames });
			} finally {
				decoder?.destroy();
				decoder = undefined;
			}
		});
		thumbnailQueue = job.catch(() => {
			if (!abort.signal.aborted) setResult({ key, frames: [], error: true });
		});
		return () => {
			abort.abort();
			decoder?.destroy();
			decoder = undefined;
		};
	}, [key]);
	return result.key === key && result.frames.length ? (
		<div className="project-clip-filmstrip" aria-hidden="true">
			{result.frames.map((src, i) => (
				<img key={i} src={src} alt="" draggable={false} />
			))}
		</div>
	) : (
		<span className="project-clip-media-status">
			{result.key === key && result.error ? "Thumbnails unavailable" : "Loading thumbnails…"}
		</span>
	);
}
