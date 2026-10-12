import { type CSSProperties, useEffect, useRef } from "react";
import { drawPatternFrame } from "@/lib/dynamicBackground/patternRenderer";
import {
	type DynamicBackgroundSettings,
	getDynamicBackgroundFrameSettings,
} from "@/lib/dynamicBackground/settings";

const WIDTH = 1280;
const HEIGHT = 720;
const FRAME_INTERVAL_MS = 1000 / 24;

export function DynamicPatternCanvas({
	settings,
	timeSeconds,
	className,
	style,
}: {
	settings: DynamicBackgroundSettings;
	timeSeconds?: number;
	className?: string;
	style?: CSSProperties;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const settingsRef = useRef(settings);
	const timeSecondsRef = useRef(timeSeconds);
	settingsRef.current = settings;
	timeSecondsRef.current = timeSeconds;

	useEffect(() => {
		const canvas = canvasRef.current;
		const context = canvas?.getContext("2d");
		if (!canvas || !context) return;
		canvas.width = WIDTH;
		canvas.height = HEIGHT;

		let requestId = 0;
		let lastDrawAt = Number.NEGATIVE_INFINITY;
		const startedAt = performance.now();
		const render = (now: number) => {
			if (now - lastDrawAt >= FRAME_INTERVAL_MS) {
				const elapsedSeconds = (now - startedAt) / 1000;
				drawPatternFrame(
					context,
					getDynamicBackgroundFrameSettings(
						settingsRef.current,
						WIDTH,
						HEIGHT,
						timeSecondsRef.current ?? elapsedSeconds,
					),
				);
				lastDrawAt = now;
			}
			requestId = requestAnimationFrame(render);
		};
		requestId = requestAnimationFrame(render);
		return () => cancelAnimationFrame(requestId);
	}, []);

	return (
		<canvas
			ref={canvasRef}
			aria-hidden="true"
			className={className}
			style={{ display: "block", ...style }}
		/>
	);
}
