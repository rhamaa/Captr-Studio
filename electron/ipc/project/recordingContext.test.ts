import { expect, it } from "vitest";
import {
	setRecordingProjectContext,
	getRecordingProjectContext,
	setActiveRecordingProjectId,
} from "./recordingContext";
it("gives a HUD launched before the editor stable project and capture identities", () => {
	setRecordingProjectContext({});
	const initial = getRecordingProjectContext();
	expect(initial.projectId).toMatch(/^[a-zA-Z0-9_-]+$/);
	expect(initial.captureId).toMatch(/^[a-zA-Z0-9_-]+$/);
	expect(getRecordingProjectContext()).toEqual(initial);
	setActiveRecordingProjectId("existing");
	setRecordingProjectContext({ captureId: "capture" });
	expect(getRecordingProjectContext()).toEqual({ projectId: "existing", captureId: "capture" });
});
