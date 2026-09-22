import { type AnnotationRegion, DEFAULT_ANNOTATION_STYLE, type MediaTrackLayer } from "./types";

/** Read the early Phase 7 layer format into the editor's canonical editable layers. */
export function migrateMediaTrackLayers(layers: MediaTrackLayer[] = []): AnnotationRegion[] {
	return layers
		.filter((layer) => layer && typeof layer.id === "string" && layer.transform)
		.map((layer) => ({
			id: layer.id,
			name: layer.name,
			type: layer.type === "sticker" ? "image" : layer.type,
			content: layer.type === "text" ? (layer.dataUrl ?? "") : "",
			videoFilePath: layer.type === "video" ? layer.sourcePath : undefined,
			imageFilePath:
				layer.type === "image" || layer.type === "sticker" ? layer.sourcePath : undefined,
			imageContent:
				layer.type === "image" || layer.type === "sticker" ? layer.dataUrl : undefined,
			gifPath: layer.type === "gif" ? layer.sourcePath : undefined,
			gifDataUrl: layer.type === "gif" ? layer.dataUrl : undefined,
			startMs: layer.startMs,
			endMs: layer.endMs,
			trackIndex: layer.trackIndex,
			zIndex: layer.zIndex,
			position: { x: layer.transform.x, y: layer.transform.y },
			size: { width: layer.transform.width, height: layer.transform.height },
			rotationDeg: layer.transform.rotationDeg,
			style: { ...DEFAULT_ANNOTATION_STYLE, opacity: layer.opacity },
			visible: layer.visible,
			locked: layer.locked,
			muted: layer.muted,
			blendMode: layer.blendMode,
			keyframes: layer.keyframes,
		}));
}
