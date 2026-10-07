import { describe, it, expect } from "vitest";
import { createTimelineProject } from "./commands";
import { validateTimelineProject } from "./validation";
import { setWhiteboardSnapshot } from "./repurposeCommands";

describe("Whiteboard Snapshot Persistence", () => {
  it("validates project with or without whiteboardSnapshot", () => {
    const project = createTimelineProject("proj-1", "My Project");
    expect(() => validateTimelineProject(project)).not.toThrow();

    const snapshot = {
      schema: { schemaVersion: 2 },
      store: { "shape:1": { id: "shape:1", type: "note" } },
    };
    const updated = setWhiteboardSnapshot(project, snapshot);
    expect(updated.whiteboardSnapshot).toEqual(snapshot);

    const validated = validateTimelineProject(updated);
    expect(validated.whiteboardSnapshot).toEqual(snapshot);
  });

  it("rejects non-object whiteboardSnapshot", () => {
    const project = createTimelineProject("proj-1", "My Project");
    const invalid = { ...project, whiteboardSnapshot: "not-an-object" };
    expect(() => validateTimelineProject(invalid as any)).toThrow("Invalid whiteboard snapshot");
  });
});
