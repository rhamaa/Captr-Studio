import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import {
	detectSilenceFromAudioUrl,
	NoAudioTrackError,
	type SilenceRegion,
} from "@/slides/record/silenceDetector";
import { toast } from "sonner";

interface UseRecordSlideSilenceAnalysisOptions {
	enabled: boolean;
	videoPath: string | null;
	videoSourcePath: string | null;
	fallbackAudioPaths: readonly (string | null | undefined)[];
	resolveVideoUrl: (path: string) => Promise<string>;
}

/** Owns Record slide silence detection state and analysis flow. */
export function useRecordSlideSilenceAnalysis({
	enabled,
	videoPath,
	videoSourcePath,
	fallbackAudioPaths,
	resolveVideoUrl,
}: UseRecordSlideSilenceAnalysisOptions) {
	const { t } = useI18n();
	const [isOpen, setIsOpen] = useState(false);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [detectedSilences, setDetectedSilences] = useState<SilenceRegion[]>([]);
	const [totalSavedMs, setTotalSavedMs] = useState(0);
	const [minDurationMs, setMinDurationMs] = useState(1000);
	const [thresholdDb, setThresholdDb] = useState(-36);
	const analysisRequestIdRef = useRef(0);

	useEffect(() => {
		analysisRequestIdRef.current += 1;
		setIsOpen(false);
		setIsAnalyzing(false);
		setDetectedSilences([]);
		setTotalSavedMs(0);
	}, [enabled, videoPath, videoSourcePath]);

	const analyze = useCallback(
		async (minDuration = minDurationMs, threshold = thresholdDb) => {
			if (!enabled) return;

			const fallbackAudioPath =
				fallbackAudioPaths.find(
					(path) =>
						typeof path === "string" &&
						path.trim().length > 0 &&
						!/\.(mp4|mov|webm|mkv)$/i.test(path),
				) ||
				fallbackAudioPaths[0] ||
				null;

			const targetSourcePath = fallbackAudioPath || videoSourcePath || videoPath;
			if (!targetSourcePath) {
				toast.error(t("editor.silence.noVideo", "No video loaded to analyze silence"));
				return;
			}

			const requestId = ++analysisRequestIdRef.current;
			setIsAnalyzing(true);
			try {
				let mediaUrl: string;
				if (
					targetSourcePath.startsWith("http") ||
					targetSourcePath.startsWith("blob:") ||
					targetSourcePath.startsWith("file:")
				) {
					mediaUrl = targetSourcePath;
				} else if (
					!fallbackAudioPath &&
					(videoPath?.startsWith("http") ||
						videoPath?.startsWith("blob:") ||
						videoPath?.startsWith("file:"))
				) {
					mediaUrl = videoPath;
				} else {
					mediaUrl = await resolveVideoUrl(targetSourcePath);
				}

				const result = await detectSilenceFromAudioUrl(mediaUrl, {
					minDurationMs: minDuration,
					thresholdDb: threshold,
					speechPaddingMs: 150,
					windowMs: 50,
				});
				if (analysisRequestIdRef.current !== requestId) return;

				setDetectedSilences(result.silences);
				setTotalSavedMs(result.totalSavedMs);
				setIsOpen(true);

				if (result.silences.length === 0) {
					toast.info(
						t(
							"editor.silence.noneFound",
							"No dead-air pauses detected. Audio is already dense.",
						),
					);
				}
			} catch (error) {
				if (analysisRequestIdRef.current !== requestId) return;

				if (
					error instanceof NoAudioTrackError ||
					(error instanceof Error && error.name === "NoAudioTrackError")
				) {
					toast.error(
						t(
							"editor.silence.noAudioTrack",
							"This video does not contain an audio track to analyze for silences.",
						),
					);
				} else {
					console.error("[SilenceDetector] Failed to analyze audio:", error);
					toast.error(t("editor.silence.error", "Failed to analyze audio for silences"));
				}
			} finally {
				if (analysisRequestIdRef.current === requestId) {
					setIsAnalyzing(false);
				}
			}
		},
		[
			enabled,
			fallbackAudioPaths,
			videoPath,
			videoSourcePath,
			minDurationMs,
			thresholdDb,
			resolveVideoUrl,
			t,
		],
	);

	return {
		isOpen,
		setIsOpen,
		isAnalyzing,
		detectedSilences,
		totalSavedMs,
		minDurationMs,
		setMinDurationMs,
		thresholdDb,
		setThresholdDb,
		analyze,
	};
}
