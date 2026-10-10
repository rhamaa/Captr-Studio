import type { MediaAsset, TimelineClip, TimelineProject } from "@/core/timeline/types";
import { sampleClipTransform } from "@/core/timeline/clipTransform";

export interface CanvasObjectBounds {
	clipId: string;
	assetId: string;
	kind: MediaAsset["kind"];
	centerX: number; // in project canvas pixels, relative to (0,0) top-left
	centerY: number;
	width: number;   // base width before scale
	height: number;  // base height before scale
	scale: number;
	rotation: number; // degrees
	opacity: number;
}

/**
 * Computes base width and height for a clip given its asset and canvas dimensions.
 */
export function getClipBaseDimensions(
	clip: TimelineClip,
	asset: MediaAsset,
	canvasWidth: number,
	canvasHeight: number,
): { width: number; height: number } {
	if (asset.kind === "text") {
		const overlay = clip.text ?? asset.text;
		const fontSize = overlay?.fontSizePx ?? 96;
		const content = overlay?.content ?? "Text";
		const lines = content.split("\n");
		const longestLineLen = Math.max(...lines.map((l) => l.length), 1);
		// Estimate width ~0.6 * fontSize per char, capped at canvasWidth * 0.9
		const estimatedWidth = Math.min(canvasWidth * 0.9, Math.max(120, longestLineLen * fontSize * 0.6));
		const estimatedHeight = Math.max(fontSize * 1.2, lines.length * fontSize * 1.2);
		return { width: estimatedWidth, height: estimatedHeight };
	}

	if (asset.kind === "shape") {
		const shape = asset.shapeDefinition;
		const assetW = asset.width || canvasWidth;
		const assetH = asset.height || canvasHeight;
		const ratio = Math.min(canvasWidth / assetW, canvasHeight / assetH);
		let shapeW = 200;
		let shapeH = 200;
		if (shape) {
			if (shape.kind === "rectangle" || shape.kind === "ellipse") {
				shapeW = shape.width * ratio;
				shapeH = shape.height * ratio;
			} else if (shape.kind === "line" || shape.kind === "arrow") {
				shapeW = Math.max(40, Math.abs(shape.to.x - shape.from.x) * ratio);
				shapeH = Math.max(40, Math.abs(shape.to.y - shape.from.y) * ratio);
			}
		}
		return { width: Math.max(20, shapeW), height: Math.max(20, shapeH) };
	}

	// Images, Videos, Recordings
	const sourceWidth = asset.width || canvasWidth;
	const sourceHeight = asset.height || canvasHeight;
	const ratio = Math.min(canvasWidth / sourceWidth, canvasHeight / sourceHeight);
	return {
		width: Math.max(20, sourceWidth * ratio),
		height: Math.max(20, sourceHeight * ratio),
	};
}

/**
 * Calculates current visual bounds for all active clips at timeUs.
 */
export function getActiveVisualClipsBounds(
	project: TimelineProject,
	timeUs: number,
): CanvasObjectBounds[] {
	const results: CanvasObjectBounds[] = [];
	const { width: canvasWidth, height: canvasHeight } = project.canvas;

	for (const track of project.tracks) {
		if (track.kind !== "visual" || track.hidden || track.muted) continue;

		for (const clip of track.clips) {
			if (!clip.enabled) continue;
			const clipEndUs = clip.startUs + Math.round((clip.sourceOutUs - clip.sourceInUs) / (clip.rate || 1));
			if (timeUs < clip.startUs || timeUs >= clipEndUs) continue;

			const asset = project.assets.find((a) => a.id === clip.assetId);
			if (!asset) continue;

			const localTimeUs = Math.max(0, timeUs - clip.startUs);
			const transform = sampleClipTransform(clip, localTimeUs);
			if (transform.opacity <= 0.01) continue;

			const { width, height } = getClipBaseDimensions(clip, asset, canvasWidth, canvasHeight);

			// Canvas origin (0,0) is top-left.
			// Renderer draws centered at (width / 2 + transform.x, height / 2 + transform.y)
			const centerX = canvasWidth / 2 + transform.x;
			const centerY = canvasHeight / 2 + transform.y;

			results.push({
				clipId: clip.id,
				assetId: asset.id,
				kind: asset.kind,
				centerX,
				centerY,
				width,
				height,
				scale: transform.scale,
				rotation: transform.rotation,
				opacity: transform.opacity,
			});
		}
	}

	return results;
}

/**
 * Hit-test to find the topmost visual clip at a canvas (x, y) point.
 */
export function hitTestCanvasPoint(
	boundsList: CanvasObjectBounds[],
	canvasX: number,
	canvasY: number,
): CanvasObjectBounds | null {
	// Reverse order (topmost first, based on visual stack)
	for (let i = boundsList.length - 1; i >= 0; i--) {
		const b = boundsList[i]!;
		// Transform point into object's local rotated coordinate space
		const dx = canvasX - b.centerX;
		const dy = canvasY - b.centerY;

		const rad = (-b.rotation * Math.PI) / 180;
		const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
		const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

		const halfW = (b.width * b.scale) / 2;
		const halfH = (b.height * b.scale) / 2;

		if (Math.abs(localX) <= halfW && Math.abs(localY) <= halfH) {
			return b;
		}
	}

	return null;
}

/**
 * Handle direction identifiers for 8-point resize handles
 */
export type ResizeHandleDirection =
	| "nw"
	| "n"
	| "ne"
	| "e"
	| "se"
	| "s"
	| "sw"
	| "w";

/**
 * Computes new scale given drag delta in local unrotated coordinates.
 */
export function calculateResizeScale(
	initialScale: number,
	initialWidth: number,
	initialHeight: number,
	direction: ResizeHandleDirection,
	deltaLocalX: number,
	deltaLocalY: number,
): number {
	const initialBoxW = initialWidth * initialScale;
	const initialBoxH = initialHeight * initialScale;

	let scaleChange = 0;

	switch (direction) {
		case "se":
			scaleChange = (deltaLocalX / initialBoxW + deltaLocalY / initialBoxH) / 2;
			break;
		case "nw":
			scaleChange = (-deltaLocalX / initialBoxW - deltaLocalY / initialBoxH) / 2;
			break;
		case "ne":
			scaleChange = (deltaLocalX / initialBoxW - deltaLocalY / initialBoxH) / 2;
			break;
		case "sw":
			scaleChange = (-deltaLocalX / initialBoxW + deltaLocalY / initialBoxH) / 2;
			break;
		case "e":
			scaleChange = deltaLocalX / initialBoxW;
			break;
		case "w":
			scaleChange = -deltaLocalX / initialBoxW;
			break;
		case "s":
			scaleChange = deltaLocalY / initialBoxH;
			break;
		case "n":
			scaleChange = -deltaLocalY / initialBoxH;
			break;
	}

	const newScale = initialScale * (1 + scaleChange);
	// Clamp scale between 0.05 and 10.0
	return Math.max(0.05, Math.min(10.0, Math.round(newScale * 1000) / 1000));
}

/**
 * Computes new rotation angle in degrees from center to current pointer.
 */
export function calculateRotationAngle(
	centerX: number,
	centerY: number,
	currentX: number,
	currentY: number,
): number {
	const radians = Math.atan2(currentY - centerY, currentX - centerX);
	// Offset by 90 degrees since rotation handle is at the top (north)
	let degrees = (radians * 180) / Math.PI + 90;
	while (degrees > 180) degrees -= 360;
	while (degrees < -180) degrees += 360;
	return Math.round(degrees);
}
