import { expect, it } from "vitest";
import { projectNameDialogActions } from "./ProjectNameDialog";
it("saved and unsaved files expose distinct actions and reject invalid names", () => {
	expect(projectNameDialogActions(true, "Demo")).toEqual({
		valid: true,
		rename: true,
		saveAs: true,
		save: false,
		error: null,
	});
	expect(projectNameDialogActions(false, "Demo.captr").save).toBe(true);
	expect(projectNameDialogActions(true, "COM1").valid).toBe(false);
});
