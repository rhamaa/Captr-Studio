import { expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { ProjectController } from "./useProjectController";
import { resolveApplicationBootstrap, requestProjectExit } from "./projectNavigation";
const api = () => ({
	consumePendingProjectOpen: vi.fn(async () => null),
	loadCurrentProjectFile: vi.fn(),
	getCurrentRecordingSession: vi.fn(async () => ({ success: true, session: null })),
	getTimelineProjectActivity: vi.fn(async () => ({ recording: false, finalizing: false })),
	deactivateTimelineProject: vi.fn(async () => ({ success: true })),
});
it("normal launch shows Home without loading or activating a project", async () => {
	const a = api();
	expect(await resolveApplicationBootstrap(a)).toEqual({ kind: "home" });
	expect(a.loadCurrentProjectFile).not.toHaveBeenCalled();
});
it("consumes an OS open arriving during bootstrap before showing Home", async () => {
	const a = api();
	const result = { success: true, path: "P.captr", project: createTimelineProject("p", "P") };
	a.consumePendingProjectOpen
		.mockResolvedValueOnce(null)
		.mockResolvedValueOnce({ result } as any);
	expect(await resolveApplicationBootstrap(a)).toMatchObject({ kind: "project", result });
	expect(a.consumePendingProjectOpen).toHaveBeenCalledTimes(2);
});
it("restores only matching capture identity and preserves saved path", async () => {
	const a = api();
	a.getCurrentRecordingSession.mockResolvedValue({
		success: true,
		session: { captureId: "take", projectId: "p" },
	} as any);
	a.loadCurrentProjectFile.mockResolvedValue({
		success: true,
		path: "P.captr",
		project: createTimelineProject("other", "Other"),
	});
	expect(await resolveApplicationBootstrap(a)).toMatchObject({ kind: "error" });
});
it("Save Discard Cancel and busy capture guard Home exit", async () => {
	for (const decision of ["save", "discard", "cancel"] as const) {
		const c = new ProjectController(createTimelineProject("p", "P"), async () => ({
			success: false,
			canceled: true,
		}));
		c.execute((p) => ({ ...p, width: 1280 }));
		const a = api();
		expect(await requestProjectExit(c, decision, a)).toBe(decision === "discard");
		expect(a.deactivateTimelineProject).toHaveBeenCalledTimes(decision === "discard" ? 1 : 0);
	}
	const c = new ProjectController(createTimelineProject("p", "P"), vi.fn());
	const a = api();
	a.getTimelineProjectActivity.mockResolvedValue({ recording: false, finalizing: true });
	expect(await requestProjectExit(c, "discard", a)).toBe(false);
});
it("newer edits during Save prevent exiting", async () => {
	let finish!: (r: any) => void;
	const c = new ProjectController(
		createTimelineProject("p", "P"),
		() =>
			new Promise((resolve) => {
				finish = resolve;
			}),
	);
	c.execute((p) => ({ ...p, width: 1280 }));
	const a = api();
	const job = requestProjectExit(c, "save", a);
	await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
	c.execute((p) => ({ ...p, height: 720 }));
	finish({ success: true, path: "P.captr", projectId: "p" });
	expect(await job).toBe(false);
	expect(a.deactivateTimelineProject).not.toHaveBeenCalled();
});
