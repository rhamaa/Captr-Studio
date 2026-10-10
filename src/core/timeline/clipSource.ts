import type { MediaAsset, StoryClipContent, TimelineClip, TimelineProject } from "./types";

export type ResolvedClipSource = {
	kind: MediaAsset["kind"];
	name: string;
	width: number;
	height: number;
	durationUs: number;
	media?: MediaAsset;
	content?: StoryClipContent;
};

/** The caller supplies an already-scoped view. Sibling libraries are never searched. */
export function resolveMediaAsset(view: TimelineProject, assetId: string): MediaAsset {
	const matches = [...view.assets, ...(view.localAssets ?? [])].filter(
		(asset) => asset.id === assetId,
	);
	if (matches.length !== 1)
		throw new Error(`Missing or ambiguous media asset in Story scope: ${assetId}`);
	return matches[0];
}

export function resolveClipSource(view: TimelineProject, clip: TimelineClip): ResolvedClipSource {
	if ((clip.assetId !== undefined) === (clip.content !== undefined))
		throw new Error(`Clip ${clip.id} must have exactly one source`);
	if (clip.content === undefined) {
		const media = resolveMediaAsset(view, clip.assetId!);
		return {
			kind: media.kind,
			name: media.name,
			width: media.width,
			height: media.height,
			durationUs: media.durationUs,
			media,
		};
	}
	const content = clip.content;
	if (content.kind === "text")
		return {
			kind: "text",
			name: content.text.content,
			width: view.canvas.width,
			height: view.canvas.height,
			durationUs: content.durationUs,
			content,
		};
	if (content.kind !== "shape") throw new Error("Unknown inline source kind");
	const shape = content.shapeDefinition;
	const width =
		"width" in shape
			? Math.ceil(shape.width)
			: Math.max(1, Math.ceil(Math.max(shape.from.x, shape.to.x)));
	const height =
		"height" in shape
			? Math.ceil(shape.height)
			: Math.max(1, Math.ceil(Math.max(shape.from.y, shape.to.y)));
	return {
		kind: "shape",
		name: shape.kind,
		width,
		height,
		durationUs: content.durationUs,
		content,
	};
}
