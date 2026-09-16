import { useEffect, useState } from "react";
import { getRenderableVideoUrl } from "@/lib/assetPath";

export function WallpaperVideoPreview({ src }: { src: string }) {
	const [resolvedSrc, setResolvedSrc] = useState(src);

	useEffect(() => {
		let cancelled = false;
		setResolvedSrc(src);

		void (async () => {
			try {
				const nextSrc = await getRenderableVideoUrl(src);
				if (!cancelled) {
					setResolvedSrc(nextSrc);
				}
			} catch {
				if (!cancelled) {
					setResolvedSrc(src);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [src]);

	return (
		<video
			src={resolvedSrc}
			muted
			playsInline
			preload="metadata"
			className="h-full w-full select-none object-cover [transform:translateZ(0)]"
			draggable={false}
			onMouseEnter={(e) => e.currentTarget.play().catch(() => undefined)}
			onMouseLeave={(e) => {
				e.currentTarget.pause();
				e.currentTarget.currentTime = 0;
			}}
		/>
	);
}
