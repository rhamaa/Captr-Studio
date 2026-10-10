import { describe, it, expect } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import {
	addRepurposeArtboard,
	ensureRepurposeBoard,
	setWhiteboardSnapshot,
} from "@/core/timeline/repurposeCommands";
import { validateTimelineProject } from "@/core/timeline/validation";

describe("Whiteboard .captr Bundle Integration", () => {
	it("survives project cloning, JSON serialization, and validation intact", () => {
		let project = ensureRepurposeBoard(createTimelineProject("proj-wb", "Whiteboard Show"));
		project = addRepurposeArtboard(project, {
			aspectRatio: "9:16",
			name: "Mobile Story",
			width: 1080,
			height: 1920,
			defaultFitMode: "cover",
		});

		const fakeTldrawSnapshot = {
			schema: { schemaVersion: 2 },
			store: {
				"record:page": { id: "page:1", name: "Brainstorm" },
				"shape:arrow1": {
					id: "shape:arrow1",
					type: "arrow",
					props: { start: { x: 0, y: 0 }, end: { x: 100, y: 100 } },
				},
				"shape:note1": {
					id: "shape:note1",
					type: "note",
					props: { text: "Ideas for hook" },
				},
			},
		};

		const projectWithWb = setWhiteboardSnapshot(project, fakeTldrawSnapshot);
		const jsonString = JSON.stringify(projectWithWb);
		const parsed = JSON.parse(jsonString);

		const validated = validateTimelineProject(parsed);
		expect(validated.whiteboardSnapshot).toEqual(fakeTldrawSnapshot);
		expect(validated.repurposeBoard!.artboards.length).toBeGreaterThan(0);
	});

	it("maintains backward compatibility with projects lacking whiteboardSnapshot", () => {
		const oldProject = createTimelineProject("old-proj", "Old V3 Project");
		expect(oldProject.whiteboardSnapshot).toBeUndefined();

		const validated = validateTimelineProject(oldProject);
		expect(validated.whiteboardSnapshot).toBeUndefined();
	});

	it("rejects invalid whiteboard snapshot structures", () => {
		const base = createTimelineProject("proj-invalid", "Invalid Snapshot Test");
		expect(() =>
			validateTimelineProject({
				...base,
				whiteboardSnapshot: ["not", "an", "object"] as any,
			}),
		).toThrow("Invalid whiteboard snapshot");

		expect(() =>
			validateTimelineProject({
				...base,
				whiteboardSnapshot: null as any,
			}),
		).toThrow("Invalid whiteboard snapshot");
	});
});
