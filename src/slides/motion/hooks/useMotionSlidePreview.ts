import { useCallback, useEffect, useMemo, useRef } from "react";
import type { MotionSlideMeta } from "../schema";
import { buildMotionPreviewDocument } from "../motionDocument";
import { createDefaultMotionMeta } from "../schema";

interface UseMotionSlidePreviewOptions {
	isActive: boolean;
	meta?: MotionSlideMeta;
	currentTimeMs: number;
	durationMs: number;
}

export function useMotionSlidePreview({
	isActive,
	meta,
	currentTimeMs,
	durationMs,
}: UseMotionSlidePreviewOptions) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const defaultMeta = useMemo(() => createDefaultMotionMeta(), []);
	const srcDoc = useMemo(() => {
		if (!isActive) return "";
		return buildMotionPreviewDocument(meta ?? defaultMeta);
	}, [defaultMeta, isActive, meta]);

	const sendSeek = useCallback(() => {
		iframeRef.current?.contentWindow?.postMessage(
			{ type: "SEEK", timeMs: currentTimeMs, durationMs },
			"*",
		);
	}, [currentTimeMs, durationMs]);

	useEffect(() => {
		if (isActive) sendSeek();
	}, [isActive, sendSeek]);

	return {
		iframeRef,
		srcDoc,
		onIframeLoad: sendSeek,
	};
}
