import { useEffect, useRef, useState } from "react";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";
import { isMediaLayerActive, mediaLayerSourceTime } from "./mediaLayerTiming";
import type { AnnotationRegion } from "./types";

export function VideoLayerPreview({
	layer,
	timeMs,
	playing,
}: {
	layer: AnnotationRegion;
	timeMs: number;
	playing: boolean;
}) {
	const ref = useRef<HTMLVideoElement>(null);
	const [source, setSource] = useState("");
	const [ready, setReady] = useState(false);
	const [error, setError] = useState(false);
	useEffect(() => {
		let disposed = false;
		let revoke: () => void = () => undefined;
		setReady(false);
		setError(false);
		setSource("");
		resolveMediaElementSource(layer.videoFilePath ?? "")
			.then((result) => {
				if (disposed) {
					result.revoke();
					return;
				}
				revoke = result.revoke;
				setSource(result.src);
			})
			.catch(() => {
				if (!disposed) setError(true);
			});
		return () => {
			disposed = true;
			revoke();
		};
	}, [layer.videoFilePath]);
	useEffect(() => {
		const video = ref.current;
		if (!video || !ready) return;
		const target = Math.min(
			mediaLayerSourceTime(layer, timeMs),
			Math.max(0, video.duration - 0.001),
		);
		video.playbackRate = layer.playbackRate ?? 1;
		// Audio is mixed through the editor audio plan, not through the visual decoder.
		video.muted = true;
		if (Math.abs(video.currentTime - target) > (playing ? 0.08 : 0.001))
			video.currentTime = target;
		if (playing && isMediaLayerActive(layer, timeMs)) void video.play().catch(() => undefined);
		else video.pause();
	}, [layer, timeMs, playing, ready]);
	if (error) return <div role="alert">Video layer unavailable</div>;
	return (
		<video
			ref={ref}
			src={source || undefined}
			onLoadedData={() => setReady(true)}
			onError={() => setError(true)}
			crossOrigin="anonymous"
			muted
			playsInline
			preload="auto"
			className="w-full h-full object-contain pointer-events-none"
		/>
	);
}
