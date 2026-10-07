import {
	ARTBOARD_CARD_SHAPE_TYPE,
	ArtboardCardShapeUtil,
	type ArtboardCardShape,
} from "./ArtboardCardShapeUtil";
import {
	HYPERFRAME_CARD_SHAPE_TYPE,
	HyperframeCardShapeUtil,
	type HyperframeCardShape,
} from "./HyperframeCardShapeUtil";

export {
	ARTBOARD_CARD_SHAPE_TYPE,
	ArtboardCardShapeUtil,
	type ArtboardCardShape,
	HYPERFRAME_CARD_SHAPE_TYPE,
	HyperframeCardShapeUtil,
	type HyperframeCardShape,
};

export function createArtboardShapeProps(
	artboardId: string,
	width: number,
	height: number,
	displayHeight = 360,
) {
	const aspectRatio = width / height;
	const cardWidth = Math.round(displayHeight * aspectRatio);
	const cardHeight = displayHeight + 88;
	return {
		artboardId,
		w: cardWidth,
		h: cardHeight,
	};
}

export function createHyperframeShapeProps(
	hyperframeId: string,
	width: number,
	height: number,
	displayHeight = 360,
) {
	const aspectRatio = width / height;
	const cardWidth = Math.round(displayHeight * aspectRatio);
	const cardHeight = displayHeight + 88;
	return {
		hyperframeId,
		w: cardWidth,
		h: cardHeight,
	};
}

export const customShapeUtils = [ArtboardCardShapeUtil, HyperframeCardShapeUtil];
