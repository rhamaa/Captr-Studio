import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CursorTelemetryPoint } from "@/components/video-editor/types";
import { normalizeCursorTelemetry } from "@/components/video-editor/timeline/zoomSuggestionUtils";

interface UseRecordSlideTelemetryOptions {
	enabled: boolean;
	videoPath: string | null;
	videoSourcePath: string | null;
	telemetryPath?: string | null;
	storedTelemetry?: CursorTelemetryPoint[] | null;
	duration: number;
	loading: boolean;
	isPreviewReady: boolean;
	hasZoomRegions: boolean;
	autoApplyFreshRecordingAutoZooms: boolean;
}

/** Owns Record-only cursor telemetry loading and fresh-recording auto-zoom flow. */
export function useRecordSlideTelemetry({
	enabled,
	videoPath,
	videoSourcePath,
	telemetryPath,
	storedTelemetry,
	duration,
	loading,
	isPreviewReady,
	hasZoomRegions,
	autoApplyFreshRecordingAutoZooms,
}: UseRecordSlideTelemetryOptions) {
	const [cursorTelemetry, setCursorTelemetry] = useState<CursorTelemetryPoint[]>([]);
	const [cursorTelemetrySourcePath, setCursorTelemetrySourcePath] = useState<string | null>(null);
	const [autoSuggestZoomsTrigger, setAutoSuggestZoomsTrigger] = useState(0);
	const autoSuggestedVideoPathRef = useRef<string | null>(null);
	const pendingFreshRecordingAutoZoomPathRef = useRef<string | null>(null);
	const pendingTelemetryRetryTimeoutRef = useRef<number | null>(null);
	const pendingAutoSuggestTimeoutRef = useRef<number | null>(null);
	const lastAutoSuggestTelemetryCountRef = useRef(0);

	const clearCursorTelemetry = useCallback(() => {
		setCursorTelemetry([]);
		setCursorTelemetrySourcePath(null);
	}, []);

	const clearPendingFreshRecordingAutoZoom = useCallback(() => {
		pendingFreshRecordingAutoZoomPathRef.current = null;
	}, []);

	const requestFreshRecordingAutoZoom = useCallback((path: string | null) => {
		pendingFreshRecordingAutoZoomPathRef.current = path;
	}, []);

	const markFreshRecordingAutoZoomApplied = useCallback((path: string | null) => {
		if (!path || pendingFreshRecordingAutoZoomPathRef.current !== path) return;
		autoSuggestedVideoPathRef.current = path;
		pendingFreshRecordingAutoZoomPathRef.current = null;
	}, []);

	const consumeAutoSuggestZooms = useCallback(() => {
		setAutoSuggestZoomsTrigger(0);
	}, []);

	useEffect(() => {
		let mounted = true;
		let retryAttempts = 0;

		async function loadCursorTelemetry() {
			if (!enabled || !videoPath || !videoSourcePath) {
				if (mounted) {
					clearCursorTelemetry();
				}
				return;
			}

			if (storedTelemetry?.length) {
				setCursorTelemetry(storedTelemetry);
				setCursorTelemetrySourcePath(videoSourcePath);
				return;
			}

			try {
				const result = await window.electronAPI.getCursorTelemetry(
					videoSourcePath,
					telemetryPath ?? undefined,
				);
				if (!mounted) return;

				setCursorTelemetry(result.success ? result.samples : []);
				setCursorTelemetrySourcePath(videoSourcePath);

				const shouldRetryFreshRecordingTelemetry =
					pendingFreshRecordingAutoZoomPathRef.current === videoPath &&
					autoSuggestedVideoPathRef.current !== videoPath &&
					retryAttempts < 12;

				if (shouldRetryFreshRecordingTelemetry) {
					retryAttempts += 1;
					pendingTelemetryRetryTimeoutRef.current = window.setTimeout(() => {
						pendingTelemetryRetryTimeoutRef.current = null;
						if (mounted) void loadCursorTelemetry();
					}, 350);
				}
			} catch (telemetryError) {
				console.warn("Unable to load cursor telemetry:", telemetryError);
				if (!mounted) return;

				setCursorTelemetry([]);
				setCursorTelemetrySourcePath(videoSourcePath);
				if (
					pendingFreshRecordingAutoZoomPathRef.current === videoPath &&
					autoSuggestedVideoPathRef.current !== videoPath &&
					retryAttempts < 12
				) {
					retryAttempts += 1;
					pendingTelemetryRetryTimeoutRef.current = window.setTimeout(() => {
						pendingTelemetryRetryTimeoutRef.current = null;
						if (mounted) void loadCursorTelemetry();
					}, 350);
				}
			}
		}

		if (pendingTelemetryRetryTimeoutRef.current !== null) {
			window.clearTimeout(pendingTelemetryRetryTimeoutRef.current);
			pendingTelemetryRetryTimeoutRef.current = null;
		}

		void loadCursorTelemetry();

		return () => {
			mounted = false;
			if (pendingTelemetryRetryTimeoutRef.current !== null) {
				window.clearTimeout(pendingTelemetryRetryTimeoutRef.current);
				pendingTelemetryRetryTimeoutRef.current = null;
			}
		};
	}, [enabled, videoPath, videoSourcePath, telemetryPath, storedTelemetry, clearCursorTelemetry]);

	const normalizedCursorTelemetry = useMemo(() => {
		if (cursorTelemetry.length === 0) return [];

		const totalMs = Math.max(0, Math.round(duration * 1000));
		return normalizeCursorTelemetry(
			cursorTelemetry,
			totalMs > 0 ? totalMs : Number.MAX_SAFE_INTEGER,
		);
	}, [cursorTelemetry, duration]);

	useEffect(() => {
		if (!autoApplyFreshRecordingAutoZooms) {
			clearPendingFreshRecordingAutoZoom();
		}
	}, [autoApplyFreshRecordingAutoZooms, clearPendingFreshRecordingAutoZoom]);

	useEffect(() => {
		if (
			!enabled ||
			!videoPath ||
			loading ||
			!isPreviewReady ||
			duration <= 0 ||
			hasZoomRegions ||
			normalizedCursorTelemetry.length < 2
		) {
			if (pendingAutoSuggestTimeoutRef.current !== null) {
				window.clearTimeout(pendingAutoSuggestTimeoutRef.current);
				pendingAutoSuggestTimeoutRef.current = null;
			}
			return;
		}

		if (pendingFreshRecordingAutoZoomPathRef.current !== videoPath) return;

		if (autoSuggestedVideoPathRef.current === videoPath) {
			pendingFreshRecordingAutoZoomPathRef.current = null;
			return;
		}

		const telemetryPointCount = cursorTelemetry.length;
		if (lastAutoSuggestTelemetryCountRef.current === telemetryPointCount) return;
		lastAutoSuggestTelemetryCountRef.current = telemetryPointCount;

		if (pendingAutoSuggestTimeoutRef.current !== null) {
			window.clearTimeout(pendingAutoSuggestTimeoutRef.current);
			pendingAutoSuggestTimeoutRef.current = null;
		}

		pendingAutoSuggestTimeoutRef.current = window.setTimeout(() => {
			pendingAutoSuggestTimeoutRef.current = null;
			if (
				pendingFreshRecordingAutoZoomPathRef.current !== videoPath ||
				autoSuggestedVideoPathRef.current === videoPath ||
				hasZoomRegions
			) {
				return;
			}

			setAutoSuggestZoomsTrigger((value) => value + 1);
		}, 500);
	}, [
		videoPath,
		enabled,
		loading,
		isPreviewReady,
		duration,
		cursorTelemetry.length,
		normalizedCursorTelemetry,
		hasZoomRegions,
	]);

	useEffect(() => {
		return () => {
			if (pendingTelemetryRetryTimeoutRef.current !== null) {
				window.clearTimeout(pendingTelemetryRetryTimeoutRef.current);
			}
			if (pendingAutoSuggestTimeoutRef.current !== null) {
				window.clearTimeout(pendingAutoSuggestTimeoutRef.current);
			}
		};
	}, []);

	return {
		cursorTelemetry,
		cursorTelemetrySourcePath,
		normalizedCursorTelemetry,
		autoSuggestZoomsTrigger,
		clearCursorTelemetry,
		clearPendingFreshRecordingAutoZoom,
		requestFreshRecordingAutoZoom,
		markFreshRecordingAutoZoomApplied,
		consumeAutoSuggestZooms,
	};
}
