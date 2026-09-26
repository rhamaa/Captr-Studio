import type { ProjectV2Data } from "../slides/types";
import { exportSlideChunk } from "./slideChunkExporter";

export interface ExportProgressUpdate {
	stage: "preparing" | "rendering-slide" | "stitching" | "completed" | "error";
	currentSlideIndex: number;
	totalSlides: number;
	slideTitle?: string;
	percentage: number;
	message: string;
}

export interface MultiSlideExportOptions {
	project: ProjectV2Data;
	outputPath: string;
	onProgress?: (update: ExportProgressUpdate) => void;
}

export interface MultiSlideExportResult {
	success: boolean;
	outputPath?: string;
	error?: string;
}

/**
 * Orchestrates multi-slide rendering and FFmpeg stitching.
 */
export async function exportMultiSlideProject(
	options: MultiSlideExportOptions,
): Promise<MultiSlideExportResult> {
	const { project, outputPath, onProgress } = options;

	if (!project.slides || project.slides.length === 0) {
		return { success: false, error: "Project tidak memiliki slide untuk diekspor." };
	}

	if (typeof window === "undefined" || !window.electronAPI?.stitchProjectSlides) {
		return {
			success: false,
			error: "Electron API stitchProjectSlides tidak tersedia di environment ini.",
		};
	}

	const totalSlides = project.slides.length;
	const slideStitchInputs: Array<{ filePath: string; durationSec: number }> = [];

	// Stage 1: Render each slide chunk
	for (let i = 0; i < totalSlides; i++) {
		const slide = project.slides[i];

		onProgress?.({
			stage: "rendering-slide",
			currentSlideIndex: i + 1,
			totalSlides,
			slideTitle: slide.title,
			percentage: Math.round((i / totalSlides) * 80),
			message: `Merender Slide ${i + 1}/${totalSlides}: "${slide.title}"...`,
		});

		// Export chunk via modular slideChunkExporter. A slide that cannot produce
		// media must abort the export with a clear message: bubbling the rejection
		// leaves the export dialog stuck (it has no catch), and handing an empty
		// path to FFmpeg surfaces only later as an opaque mid-stitch failure.
		let chunk: Awaited<ReturnType<typeof exportSlideChunk>>;
		try {
			chunk = await exportSlideChunk({
				slide,
				canvas: project.canvas,
				onProgress: (percent) => {
					const slideSlice = 80 / totalSlides;
					const basePercent = i * slideSlice;
					const currentPercent = Math.round(basePercent + (percent / 100) * slideSlice);
					onProgress?.({
						stage: "rendering-slide",
						currentSlideIndex: i + 1,
						totalSlides,
						slideTitle: slide.title,
						percentage: currentPercent,
						message: `Merender Slide ${i + 1}/${totalSlides}: "${slide.title}" (${percent}%)...`,
					});
				},
			});
		} catch (renderError) {
			const message = String(renderError);
			onProgress?.({
				stage: "error",
				currentSlideIndex: i + 1,
				totalSlides,
				slideTitle: slide.title,
				percentage: 100,
				message: `Gagal merender Slide ${i + 1}/${totalSlides}: ${message}`,
			});
			return { success: false, error: message };
		}

		slideStitchInputs.push({
			filePath: chunk.filePath,
			durationSec: chunk.durationSec,
		});

		// Small tick delay to allow UI to breathe
		await new Promise((resolve) => setTimeout(resolve, 50));
	}

	// Stage 2: Prepare transitions
	onProgress?.({
		stage: "stitching",
		currentSlideIndex: totalSlides,
		totalSlides,
		percentage: 85,
		message: "Menggabungkan slide dan menerapkan transisi dengan FFmpeg...",
	});

	// FFmpeg xfade is chained per BOUNDARY: `transitions[i]` sits between
	// slides[i] and slides[i + 1]. Stored slide transitions carry explicit
	// fromSlideId/toSlideId and may be sparse or stored in a different order, so
	// resolve them per boundary instead of mapping the stored array positionally —
	// a positional mapping attaches one slide's transition to another pair.
	const transitionConfigs = project.slides.slice(1).map((slide, index) => {
		const previousSlide = project.slides[index];
		const stored = project.transitions.find(
			(transition) =>
				transition.fromSlideId === previousSlide.id && transition.toSlideId === slide.id,
		);
		const requested = stored?.type ?? "crossfade";
		return {
			// `zoom-in` has no FFmpeg xfade counterpart: degrade it to the default
			// crossfade so the boundary keeps its own transition definition.
			type: requested === "zoom-in" ? "crossfade" : requested,
			durationSec: (stored?.durationMs || 500) / 1000,
		};
	});

	// Stage 3: Call Electron IPC stitcher
	try {
		const stitchResult = await window.electronAPI.stitchProjectSlides({
			slides: slideStitchInputs,
			transitions: transitionConfigs,
			globalAudio: project.globalAudioTracks[0]
				? {
						path: project.globalAudioTracks[0].path,
						volume: project.globalAudioTracks[0].volume,
						loop: project.globalAudioTracks[0].loop,
					}
				: undefined,
			outputPath,
		});

		if (!stitchResult.success) {
			onProgress?.({
				stage: "error",
				currentSlideIndex: totalSlides,
				totalSlides,
				percentage: 100,
				message: `Gagal stitching: ${stitchResult.error}`,
			});
			return {
				success: false,
				error: stitchResult.error || "Gagal menggabungkan slide.",
			};
		}

		onProgress?.({
			stage: "completed",
			currentSlideIndex: totalSlides,
			totalSlides,
			percentage: 100,
			message: "Video berhasil diekspor!",
		});

		return {
			success: true,
			outputPath: stitchResult.outputPath || outputPath,
		};
	} catch (stitchErr) {
		const errorMessage = String(stitchErr);
		onProgress?.({
			stage: "error",
			currentSlideIndex: totalSlides,
			totalSlides,
			percentage: 100,
			message: `Error stitching: ${errorMessage}`,
		});
		return { success: false, error: errorMessage };
	}
}
