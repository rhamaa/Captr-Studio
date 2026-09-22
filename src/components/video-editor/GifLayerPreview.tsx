import { useEffect, useRef, useState } from "react";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";
import { type DecodedGif, decodeGif, getGifFrameAtTime } from "@/lib/gifDecoder";
import type { AnnotationRegion } from "./types";

export function GifLayerPreview({ layer, timeMs }: { layer: AnnotationRegion; timeMs: number }) {
	const ref = useRef<HTMLCanvasElement>(null);
	const [gif, setGif] = useState<DecodedGif | null>(null);
	useEffect(() => {
		let disposed = false;
		let revoke: () => void = () => undefined;
		setGif(null);
		void (async () => {
			const source = await resolveMediaElementSource(layer.gifDataUrl || layer.gifPath || "");
			if (disposed) {
				source.revoke();
				return;
			}
			revoke = source.revoke;
			const decoded = await decodeGif(source.src);
			if (!disposed) setGif(decoded);
		})().catch(() => undefined);
		return () => {
			disposed = true;
			revoke();
		};
	}, [layer.gifPath, layer.gifDataUrl]);
	useEffect(() => {
		if (!gif || !ref.current) return;
		const frame = getGifFrameAtTime(gif, Math.max(layer.startMs, timeMs), layer.startMs);
		if (frame) ref.current.getContext("2d")?.putImageData(frame.imageData, 0, 0);
	}, [gif, timeMs, layer.startMs]);
	return (
		<canvas
			ref={ref}
			width={gif?.width ?? 1}
			height={gif?.height ?? 1}
			className="w-full h-full object-contain"
		/>
	);
}
