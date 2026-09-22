import { useEffect, useState } from "react";
import { resolveMediaElementSource } from "@/lib/exporter/localMediaSource";
import type { AnnotationRegion } from "./types";

export function ImageLayerPreview({ layer }: { layer: AnnotationRegion }) {
	const [source, setSource] = useState("");
	const resource = layer.imageContent || layer.content || layer.imageFilePath || "";
	useEffect(() => {
		let disposed = false;
		let revoke: () => void = () => undefined;
		setSource("");
		resolveMediaElementSource(resource)
			.then((result) => {
				if (disposed) {
					result.revoke();
					return;
				}
				revoke = result.revoke;
				setSource(result.src);
			})
			.catch(() => undefined);
		return () => {
			disposed = true;
			revoke();
		};
	}, [resource]);
	const style = layer.style;
	return source ? (
		<img
			crossOrigin="anonymous"
			src={source}
			alt={layer.name || "Image layer"}
			draggable={false}
			className="w-full h-full object-contain"
			style={{
				filter: style.dropShadow
					? `drop-shadow(${style.dropShadowOffsetX ?? 0}px ${style.dropShadowOffsetY ?? 4}px ${style.dropShadowBlur ?? 8}px ${style.dropShadowColor || "rgba(0,0,0,0.5)"})`
					: undefined,
			}}
		/>
	) : null;
}
