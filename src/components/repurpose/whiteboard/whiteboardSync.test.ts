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

	it("detects missing cards in store and generates additions with flexible ID matching", () => {
		const existingShapeIds = new Set(["shape:artboard-card-1"]);
		const targetArtboardIds = ["artboard-card-1", "artboard-card-2"];
		const missing = reconcileProjectCardsWithStore(targetArtboardIds, existingShapeIds);
		expect(missing).toEqual(["artboard-card-2"]);

		// Test target IDs without 'artboard-' prefix matching shape:artboard-card-1
		const strippedMissing = reconcileProjectCardsWithStore(["card-1", "card-2"], existingShapeIds);
		expect(strippedMissing).toEqual(["card-2"]);
	});

	it("spaces artboards and hyperframes side-by-side without overlapping", () => {
		const positions = calculateInitialCardPositions(["ab-1", "ab-2"], ["hf-1"], 100, 100, 50, 300);
		expect(positions.get("ab-1")?.x).toBe(100);
		expect(positions.get("ab-2")?.x).toBe(450);
		expect(positions.get("hf-1")?.x).toBe(800);
	});
});
