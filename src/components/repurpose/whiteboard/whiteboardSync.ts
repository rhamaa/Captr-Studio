import type { Editor, TLShapePartial } from "@tldraw/tldraw";
import { createShapeId } from "@tldraw/tldraw";
import type { TimelineProject } from "@/core/timeline/types";
import {
	ARTBOARD_CARD_SHAPE_TYPE,
	HYPERFRAME_CARD_SHAPE_TYPE,
	createArtboardShapeProps,
	createHyperframeShapeProps,
} from "./shapes/customShapes";

export interface CardPosition {
	x: number;
	y: number;
}

/**
 * Calculates initial coordinates arranged side-by-side for artboard and hyperframe cards
 * when no prior whiteboard snapshot exists.
 */
export function calculateInitialCardPositions(
	artboardIds: string[],
	hyperframeIds: string[],
	startX = 100,
	startY = 100,
	gap = 48,
	defaultCardWidth = 320,
): Map<string, CardPosition> {
	const positions = new Map<string, CardPosition>();
	let currentX = startX;

	for (const id of artboardIds) {
		positions.set(id, { x: currentX, y: startY });
		currentX += defaultCardWidth + gap;
	}

	for (const id of hyperframeIds) {
		positions.set(id, { x: currentX, y: startY });
		currentX += defaultCardWidth + gap;
	}

	return positions;
}

/**
 * Compares required project card IDs against existing tldraw shape IDs
 * and returns IDs that do not currently have a corresponding shape on canvas.
 */
export function reconcileProjectCardsWithStore(
	targetIds: string[],
	existingShapeIds: Set<string> | Iterable<string>,
): string[] {
	const shapeSet =
		existingShapeIds instanceof Set ? existingShapeIds : new Set(existingShapeIds);
	const missing: string[] = [];

	for (const id of targetIds) {
		const isPresent =
			shapeSet.has(id) ||
			shapeSet.has(`shape:${id}`) ||
			Array.from(shapeSet).some(
				(shapeId) => shapeId === id || shapeId === `shape:${id}` || shapeId.endsWith(`:${id}`),
			);
		if (!isPresent) {
			missing.push(id);
		}
	}

	return missing;
}

/**
 * Synchronizes artboard and hyperframe cards from TimelineProject into the tldraw canvas.
 * Creates missing shapes and removes shapes whose underlying entity has been deleted.
 */
export function syncProjectCardsToCanvas(
	editor: Editor,
	project: TimelineProject,
) {
	const allShapes = editor.getCurrentPageShapes();
	const existingArtboardCardShapes = new Map<string, string>(); // artboardId -> shapeId
	const existingHyperframeCardShapes = new Map<string, string>(); // hyperframeId -> shapeId

	for (const shape of allShapes) {
		if ((shape.type as string) === ARTBOARD_CARD_SHAPE_TYPE) {
			const abId = (shape.props as any)?.artboardId;
			if (abId) existingArtboardCardShapes.set(abId, shape.id);
		} else if ((shape.type as string) === HYPERFRAME_CARD_SHAPE_TYPE) {
			const hfId = (shape.props as any)?.hyperframeId;
			if (hfId) existingHyperframeCardShapes.set(hfId, shape.id);
		}
	}

	const artboards = project.repurposeBoard?.artboards ?? [];
	const hyperframes = project.hyperframes ?? [];

	const artboardIds = artboards.map((a) => a.id);
	const hyperframeIds = hyperframes.map((h) => h.id);

	// Missing cards
	const missingArtboardIds = artboardIds.filter((id) => !existingArtboardCardShapes.has(id));
	const missingHyperframeIds = hyperframeIds.filter((id) => !existingHyperframeCardShapes.has(id));

	// Remove obsolete cards if any artboard was deleted
	const validArtboardIds = new Set(artboardIds);
	const validHyperframeIds = new Set(hyperframeIds);
	const shapeIdsToDelete: string[] = [];

	for (const [abId, shapeId] of existingArtboardCardShapes.entries()) {
		if (!validArtboardIds.has(abId)) {
			shapeIdsToDelete.push(shapeId);
		}
	}
	for (const [hfId, shapeId] of existingHyperframeCardShapes.entries()) {
		if (!validHyperframeIds.has(hfId)) {
			shapeIdsToDelete.push(shapeId);
		}
	}

	if (shapeIdsToDelete.length > 0) {
		editor.deleteShapes(shapeIdsToDelete as any);
	}

	if (missingArtboardIds.length === 0 && missingHyperframeIds.length === 0) {
		return;
	}

	// Calculate positions for new cards
	let startX = 100;
	let startY = 100;

	if (allShapes.length > 0) {
		let maxX = 100;
		for (const shape of allShapes) {
			const bounds = editor.getShapePageBounds(shape.id);
			if (bounds && bounds.maxX > maxX) {
				maxX = bounds.maxX;
			}
		}
		startX = maxX + 48;
	}

	const initialPositions = calculateInitialCardPositions(
		missingArtboardIds,
		missingHyperframeIds,
		startX,
		startY,
	);

	const shapesToCreate: TLShapePartial[] = [];

	for (const artboard of artboards) {
		if (missingArtboardIds.includes(artboard.id)) {
			const pos = initialPositions.get(artboard.id) ?? { x: startX, y: startY };
			const shapeProps = createArtboardShapeProps(
				artboard.id,
				artboard.width ?? 1080,
				artboard.height ?? 1920,
				360,
			);
			shapesToCreate.push({
				id: createShapeId(`artboard-${artboard.id}`),
				type: ARTBOARD_CARD_SHAPE_TYPE as any,
				x: pos.x,
				y: pos.y,
				props: shapeProps,
			});
		}
	}

	for (const hyperframe of hyperframes) {
		if (missingHyperframeIds.includes(hyperframe.id)) {
			const pos = initialPositions.get(hyperframe.id) ?? { x: startX, y: startY };
			const shapeProps = createHyperframeShapeProps(
				hyperframe.id,
				hyperframe.width || 1920,
				hyperframe.height || 1080,
				360,
			);
			shapesToCreate.push({
				id: createShapeId(`hyperframe-${hyperframe.id}`),
				type: HYPERFRAME_CARD_SHAPE_TYPE as any,
				x: pos.x,
				y: pos.y,
				props: shapeProps,
			});
		}
	}

	if (shapesToCreate.length > 0) {
		editor.createShapes(shapesToCreate as any);
		if (allShapes.length === 0) {
			editor.zoomToFit({ animation: { duration: 0 } });
		}
	}
}
