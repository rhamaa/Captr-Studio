import { useEffect, useRef } from "react";
import { evaluateProject } from "@/core/timeline/evaluation";
import type { TimelineProject } from "@/core/timeline/types";
import { renderProjectAudio } from "@/lib/exporter/projectAudioRenderer";
import { ProjectFrameRenderer } from "@/lib/exporter/projectFrameRenderer";
import { PreviewQueue } from "./previewQueue";
export function ProjectPreview({
	project,
	timeUs,
	playing = false,
	onError,
	onRenderedCanvas,
}: {
	project: TimelineProject;
	timeUs: number;
	playing?: boolean;
	onError: (error: string) => void;
	onRenderedCanvas?: (canvas: HTMLCanvasElement) => void;
}) {
	const canvas = useRef<HTMLCanvasElement>(null),
		queue =
			useRef<
				PreviewQueue<
					{ project: TimelineProject; timeUs: number; playing: boolean },
					HTMLCanvasElement
				>
			>(),
		latest = useRef({ timeUs, playing, onError, onRenderedCanvas });
	latest.current = { timeUs, playing, onError, onRenderedCanvas };
	const audio = useRef<HTMLAudioElement>();
	useEffect(() => {
		const renderer = new ProjectFrameRenderer();
		const next = new PreviewQueue<
			{ project: TimelineProject; timeUs: number; playing: boolean },
			HTMLCanvasElement
		>(
			(request) =>
				renderer.render(evaluateProject(request.project, request.timeUs), {
					continuousPlayback: request.playing,
				}),
			(rendered) => {
				if (canvas.current) {
					canvas.current.width = rendered.width;
					canvas.current.height = rendered.height;
					canvas.current.getContext("2d")?.drawImage(rendered, 0, 0);
					canvas.current.dataset.projectPreviewReady = "true";
				}
				latest.current.onRenderedCanvas?.(rendered);
			},
			(error) =>
				latest.current.onError(error instanceof Error ? error.message : String(error)),
		);
		queue.current = next;
		return () => {
			next.dispose();
			renderer.destroy();
		};
	}, []);
	useEffect(() => {
		if (canvas.current) canvas.current.dataset.projectPreviewReady = "false";
		queue.current?.request({ project, timeUs, playing }, { continuousPlayback: playing });
	}, [project, timeUs, playing]);
	useEffect(() => {
		const abort = new AbortController();
		let url = "";
		const element = new Audio();
		audio.current = element;
		const sync = () => {
			element.currentTime = latest.current.timeUs / 1_000_000;
			if (latest.current.playing)
				void element.play().catch((e) => latest.current.onError(String(e)));
		};
		void renderProjectAudio(project, abort.signal)
			.then((blob) => {
				if (abort.signal.aborted || !blob) return;
				url = URL.createObjectURL(blob);
				element.src = url;
				element.addEventListener("loadeddata", sync, { once: true });
				element.load();
			})
			.catch((error) => {
				if (!abort.signal.aborted)
					latest.current.onError(error instanceof Error ? error.message : String(error));
			});
		return () => {
			abort.abort();
			element.pause();
			element.removeAttribute("src");
			element.load();
			if (url) URL.revokeObjectURL(url);
		};
	}, [project]);
	useEffect(() => {
		const element = audio.current;
		if (!element?.src) return;
		if (!playing) element.pause();
		if (
			Number.isFinite(element.duration) &&
			Math.abs(element.currentTime - timeUs / 1_000_000) > 0.08
		)
			element.currentTime = timeUs / 1_000_000;
		if (playing && element.paused)
			void element.play().catch((error) => latest.current.onError(String(error)));
	}, [timeUs, playing]);
	return (
		<canvas
			ref={canvas}
			aria-label="Project video preview"
			className="project-rendered-preview"
			data-project-preview-ready="false"
		/>
	);
}
