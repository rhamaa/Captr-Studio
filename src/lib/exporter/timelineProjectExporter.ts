import { evaluateProject } from "@/core/timeline/evaluation";
import { projectDurationUs, type TimelineProject } from "@/core/timeline/types";
import { validateTimelineProject } from "@/core/timeline/validation";
import { ProjectFrameRenderer } from "./projectFrameRenderer";
import { renderProjectAudio, throwIfCanceled } from "./projectAudioRenderer";
interface Options {
	outputPath: string;
	fps: number;
	signal?: AbortSignal;
	onProgress?: (percent: number) => void;
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
				duration = projectDurationUs(project);
			if (!duration) throw new Error("Place an asset on the timeline before exporting");
			if (!Number.isFinite(options.fps) || options.fps <= 0 || options.fps > 120)
				throw new Error("Invalid export frame rate");
			throwIfCanceled(options.signal);
			if (!api?.nativeVideoExportStart)
				throw new Error("Project export requires the desktop encoder");
			renderer = this.dependencies.renderer?.() ?? new ProjectFrameRenderer();
			const audio = await (this.dependencies.audio ?? renderProjectAudio)(
				project,
				options.signal,
			);
			throwIfCanceled(options.signal);
			// Match the preview canvas settings; output FPS controls project sampling only.
			const start = await api.nativeVideoExportStart({
				width: project.canvas.width,
				height: project.canvas.height,
				frameRate: options.fps,
				bitrate: 12_000_000,
				encodingMode: "quality",
				inputMode: "rawvideo",
			});
			if (!start.success || !start.sessionId)
				throw new Error(start.error ?? "Could not start encoder");
			session = start.sessionId;
			const frames = Math.ceil((duration * options.fps) / 1_000_000);
			for (let i = 0; i < frames; i++) {
				throwIfCanceled(options.signal);
				const canvas = await renderer.render(
					evaluateProject(project, Math.round((i * 1_000_000) / options.fps)),
				);
				throwIfCanceled(options.signal);
				const context = canvas.getContext("2d");
				if (!context) throw new Error("Rendered frame unavailable");
				const rgba = context.getImageData(
					0,
					0,
					project.canvas.width,
					project.canvas.height,
				).data;
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
			const saved = await api.finalizeExportedVideo({
				tempPath: temp,
				fileName: `${project.title}.mp4`,
				outputPath: options.outputPath,
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
