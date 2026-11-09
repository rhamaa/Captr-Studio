import type { MediaAsset } from "@/core/timeline/types";
import { probeMedia as defaultProbeMedia, type ProbedMedia } from "./mediaProbe";

export interface CameraTakeInput {
	id: string;
	videoPath: string;
	name: string;
}

interface CameraTakeDeps {
	probeMedia: (path: string, kind: "video") => Promise<ProbedMedia>;
}

/**
 * A Monolog take becomes a plain global video asset (its mic is embedded in the file), so every
 * Story and Artboard in the project can place it like any imported video.
 */
export async function cameraTakeAsset(
	input: CameraTakeInput,
	deps: CameraTakeDeps = { probeMedia: defaultProbeMedia },
): Promise<MediaAsset> {
	const media = await deps.probeMedia(input.videoPath, "video");
	if (!(media.width > 0 && media.height > 0))
		throw new Error("The camera take has no video frames");
	return {
		id: input.id,
		kind: "video",
		name: input.name,
		durationUs: media.durationUs,
		width: media.width,
		height: media.height,
		source: { path: input.videoPath, durationUs: media.durationUs, offsetUs: 0 },
	};
}

/** Next free "<prefix> N" name, one above the highest existing number. */
export function nextMonologName(assets: ReadonlyArray<{ name: string }>, prefix: string): string {
	const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(`^${escaped} (\\d+)$`);
	let highest = 0;
	for (const asset of assets) {
		const match = pattern.exec(asset.name);
		if (match) highest = Math.max(highest, Number(match[1]));
	}
	return `${prefix} ${highest + 1}`;
}
