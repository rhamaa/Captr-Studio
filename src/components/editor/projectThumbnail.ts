import { localMediaUrl } from "@/recording/mediaProbe";

const MAX_THUMBNAIL_WIDTH = 480;

function encodeThumbnail(source: CanvasImageSource, sourceWidth: number, sourceHeight: number) {
	if (!sourceWidth || !sourceHeight) return null;
	try {
		const canvas = document.createElement("canvas");
		canvas.width = Math.min(MAX_THUMBNAIL_WIDTH, sourceWidth);
		canvas.height = Math.max(1, Math.round((sourceHeight * canvas.width) / sourceWidth));
		const context = canvas.getContext("2d");
		if (!context) return null;
		context.drawImage(source, 0, 0, canvas.width, canvas.height);
		return canvas.toDataURL("image/png");
	} catch {
		return null;
	}
}

export async function captureProjectThumbnail(
	stage: HTMLElement | null,
	fallbackMediaPath?: string,
): Promise<string | null> {
	if (stage) {
		const rendered = stage.querySelector<HTMLCanvasElement>(
			'canvas[data-project-preview-ready="true"]',
		);
		if (rendered?.width && rendered.height) {
			const thumbnail = encodeThumbnail(rendered, rendered.width, rendered.height);
			if (thumbnail) return thumbnail;
		}

		const video = stage.querySelector<HTMLVideoElement>(".project-source-preview video");
		if (video?.readyState && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
			const thumbnail = encodeThumbnail(video, video.videoWidth, video.videoHeight);
			if (thumbnail) return thumbnail;
		}

		const image = stage.querySelector<HTMLImageElement>(".project-source-preview img");
		if (image?.complete && image.naturalWidth && image.naturalHeight) {
			const thumbnail = encodeThumbnail(image, image.naturalWidth, image.naturalHeight);
			if (thumbnail) return thumbnail;
		}
	}
	if (!fallbackMediaPath) return null;

	let url: string;
	try {
		url = await localMediaUrl(fallbackMediaPath);
	} catch {
		return null;
	}

	if (/\.(png|jpe?g|webp|gif|avif)$/i.test(fallbackMediaPath)) {
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.src = url;
		try {
			await image.decode();
		} catch {
			return null;
		}
		return encodeThumbnail(image, image.naturalWidth, image.naturalHeight);
	}

	const video = document.createElement("video");
	video.crossOrigin = "anonymous";
	video.preload = "auto";
	video.muted = true;
	video.src = url;
	try {
		await new Promise<void>((resolve, reject) => {
			if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return resolve();
			const timeout = window.setTimeout(
				() => reject(new Error("Preview frame timed out")),
				5000,
			);
			video.addEventListener(
				"loadeddata",
				() => {
					window.clearTimeout(timeout);
					resolve();
				},
				{ once: true },
			);
			video.addEventListener(
				"error",
				() => {
					window.clearTimeout(timeout);
					reject(new Error("Preview frame could not be loaded"));
				},
				{ once: true },
			);
			video.load();
		});
		return encodeThumbnail(video, video.videoWidth, video.videoHeight);
	} catch {
		return null;
	} finally {
		video.pause();
		video.removeAttribute("src");
		video.load();
	}
}
