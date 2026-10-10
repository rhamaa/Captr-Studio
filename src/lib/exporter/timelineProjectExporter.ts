import { drawArtboardFrame } from "@/components/repurpose/repurposeFraming";
import { evaluateProject } from "@/core/timeline/evaluation";
import type { RepurposeArtboard } from "@/core/timeline/repurposeTypes";
import { projectDurationUs, type TimelineProject } from "@/core/timeline/types";
import { validateTimelineProject } from "@/core/timeline/validation";
import { renderProjectAudio, throwIfCanceled } from "./projectAudioRenderer";
import { ProjectFrameRenderer } from "./projectFrameRenderer";

interface Options {
	outputPath: string;
	fps: number;
	signal?: AbortSignal;
	onProgress?: (percent: number) => void;
	artboard?: RepurposeArtboard;
	timeRangeUs?: { startUs: number; endUs: number };
	fileName?: string;
}
interface ExportResult {
	success: boolean;
	outputPath?: string;
	error?: string;
	canceled?: boolean;
}
interface Dependencies {
	renderer?: () => Pick<ProjectFrameRenderer, "render" | "destroy">;
	audio?: typeof renderProjectAudio;
	api?: Window["electronAPI"];
}
export class TimelineProjectExporter {
	constructor(private dependencies: Dependencies = {}) {}
	async export(value: TimelineProject, options: Options): Promise<ExportResult> {
		let session: string | undefined,
			temp: string | undefined,
			renderer: Pick<ProjectFrameRenderer, "render" | "destroy"> | undefined;
		const api = this.dependencies.api ?? window.electronAPI;
		try {
			const project = structuredClone(validateTimelineProject(value)),
				totalDuration = projectDurationUs(project);
			if (!totalDuration) throw new Error("Place an asset on the timeline before exporting");
			if (!Number.isFinite(options.fps) || options.fps <= 0 || options.fps > 120)
				throw new Error("Invalid export frame rate");
			throwIfCanceled(options.signal);
			if (!api?.nativeVideoExportStart)
				throw new Error("Project export requires the desktop encoder");

			const rangeStartUs = options.timeRangeUs ? Math.max(0, options.timeRangeUs.startUs) : 0;
			const rangeEndUs = options.timeRangeUs
				? Math.min(totalDuration, Math.max(rangeStartUs, options.timeRangeUs.endUs))
				: totalDuration;
			const duration = rangeEndUs - rangeStartUs;
			if (!duration) throw new Error("Export duration cannot be zero");

			renderer = this.dependencies.renderer?.() ?? new ProjectFrameRenderer();
			const audio = await (this.dependencies.audio ?? renderProjectAudio)(
				project,
				options.signal,
				options.timeRangeUs ? { startUs: rangeStartUs, endUs: rangeEndUs } : undefined,
			);
			throwIfCanceled(options.signal);

			const outputWidth = options.artboard ? options.artboard.width : project.canvas.width;
			const outputHeight = options.artboard ? options.artboard.height : project.canvas.height;

			// Match the preview canvas settings; output FPS controls project sampling only.
			const start = await api.nativeVideoExportStart({
				width: outputWidth,
				height: outputHeight,
				frameRate: options.fps,
				bitrate: 12_000_000,
				encodingMode: "quality",
				inputMode: "rawvideo",
			});
			if (!start.success || !start.sessionId)
				throw new Error(start.error ?? "Could not start encoder");
			session = start.sessionId;
			const frames = Math.ceil((duration * options.fps) / 1_000_000);

			let artboardCanvas: HTMLCanvasElement | undefined;
			if (options.artboard && typeof document !== "undefined") {
				artboardCanvas = document.createElement("canvas");
				artboardCanvas.width = outputWidth;
				artboardCanvas.height = outputHeight;
			}

			for (let i = 0; i < frames; i++) {
				throwIfCanceled(options.signal);
				const sampleTimeUs = rangeStartUs + Math.round((i * 1_000_000) / options.fps);
				const canvas = await renderer.render(evaluateProject(project, sampleTimeUs));
				throwIfCanceled(options.signal);

				let rgba: Uint8ClampedArray;
				if (options.artboard && artboardCanvas && !options.artboard.tracks) {
					const ctx = artboardCanvas.getContext("2d");
					if (!ctx) throw new Error("Artboard canvas context unavailable");
					drawArtboardFrame(
						ctx,
						canvas as HTMLCanvasElement,
						options.artboard,
						outputWidth,
						outputHeight,
					);
					rgba = ctx.getImageData(0, 0, outputWidth, outputHeight).data;
				} else {
					const context = canvas.getContext("2d");
					if (!context) throw new Error("Rendered frame unavailable");
					rgba = context.getImageData(0, 0, outputWidth, outputHeight).data;
				}

				const written = await api.nativeVideoExportWriteFrame(
					session,
					new Uint8Array(rgba.buffer, rgba.byteOffset, rgba.byteLength),
				);
				if (!written.success)
					throw new Error(written.error ?? "Encoder rejected project frame");
				options.onProgress?.(((i + 1) / frames) * 90);
			}
			throwIfCanceled(options.signal);
			const finished = await api.nativeVideoExportFinish(session, {
				audioMode: audio ? "edited-track" : "none",
				editedAudioData: audio ? await audio.arrayBuffer() : undefined,
				editedAudioMimeType: audio?.type,
				outputDurationSec: duration / 1_000_000,
			});
			if (!finished.success || !finished.tempPath)
				throw new Error(finished.error ?? "Encoder did not return a video");
			session = undefined;
			temp = finished.tempPath;
			throwIfCanceled(options.signal);
			const fileName = options.fileName || `${project.title}.mp4`;
			const saved = await api.finalizeExportedVideo({
				tempPath: temp,
				fileName,
				outputPath: options.outputPath || undefined,
			});
			if (saved.canceled) return { success: false, canceled: true };
			if (!saved.success)
				throw new Error(saved.error ?? saved.message ?? "Could not save exported video");
			temp = undefined;
			options.onProgress?.(100);
			return { success: true, outputPath: saved.path };
		} catch (error) {
			return {
				success: false,
				canceled: options.signal?.aborted,
				error: error instanceof Error ? error.message : String(error),
			};
		} finally {
			renderer?.destroy();
			if (session)
				await Promise.resolve(api.nativeVideoExportCancel(session)).catch(() => undefined);
			if (temp) await Promise.resolve(api.discardExportedTemp(temp)).catch(() => undefined);
		}
	}
}
