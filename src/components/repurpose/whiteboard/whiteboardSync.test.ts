import { describe, it, expect } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { ensureRepurposeBoard } from "@/core/timeline/repurposeCommands";
import { calculateInitialCardPositions, reconcileProjectCardsWithStore } from "./whiteboardSync";

describe("whiteboardSync", () => {
	it("calculates clean grid layout coordinates for cards when no snapshot exists", () => {
		const project = ensureRepurposeBoard(createTimelineProject("proj-1", "Test"));
		const artboardIds = project.repurposeBoard!.artboards.map((a) => a.id);
		const positions = calculateInitialCardPositions(artboardIds, []);
		expect(positions.size).toBe(artboardIds.length);
		for (const [id, pos] of positions.entries()) {
			expect(pos.x).toBeGreaterThanOrEqual(100);
			expect(pos.y).toBeGreaterThanOrEqual(100);
		}
	});

	it("detects missing cards in store and generates additions", () => {
		const existingShapeIds = new Set(["shape:artboard-card-1"]);
		const targetArtboardIds = ["artboard-card-1", "artboard-card-2"];
		const missing = reconcileProjectCardsWithStore(targetArtboardIds, existingShapeIds);
		expect(missing).toEqual(["artboard-card-2"]);
	});
});
