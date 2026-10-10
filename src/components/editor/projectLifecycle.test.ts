import { expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { bindProjectClose, resolveEditorBootstrap } from "./projectLifecycle";
import { ProjectController } from "./useProjectController";

it("publishes dirty state and closes only after the current revision is saved", async () => {
	let finish!: (value: any) => void;
	const save = vi.fn(
		() =>
			new Promise<any>((r) => {
				finish = r;
			}),
	);
	const c = new ProjectController(createTimelineProject("p", "P"), save);
	const dirty = vi.fn();
	let request!: () => Promise<boolean>;
	const unbind = bindProjectClose(
		c,
		{
			setHasUnsavedChanges: dirty,
			onRequestSaveBeforeClose: (fn) => {
				request = fn;
				return vi.fn();
			},
		},
		vi.fn(),
	);
	c.execute((p) => ({ ...p, title: "Edited" }));
	expect(dirty).toHaveBeenLastCalledWith(true);
	const saving = request();
	await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(1));
	c.execute((p) => ({ ...p, title: "During save" }));
	finish({ success: true, path: "p.captr" });
	expect(await saving).toBe(false);
	expect(c.snapshot.dirty).toBe(true);
	const last = request();
	await vi.waitFor(() => expect(save).toHaveBeenCalledTimes(2));
	finish({ success: true, path: "p.captr" });
	expect(await last).toBe(true);
	expect(dirty).toHaveBeenLastCalledWith(false);
	unbind();
});
it.each([
	{ success: false, canceled: true },
	{ success: false, error: "Disk full" },
])("keeps editor open when saving fails or is canceled: %j", async (result) => {
	const c = new ProjectController(createTimelineProject("p", "P"), async () => result);
	c.execute((p) => ({ ...p, title: "Dirty" }));
	let request!: () => Promise<boolean>;
	bindProjectClose(
		c,
		{
			setHasUnsavedChanges: vi.fn(),
			onRequestSaveBeforeClose: (fn) => {
				request = fn;
				return vi.fn();
			},
		},
		vi.fn(),
	);
	expect(await request()).toBe(false);
	expect(c.snapshot.dirty).toBe(true);
});
it("resolves an active audio take before asking to save for Electron close", async () => {
	const save = vi.fn(async () => ({ success: true, path: "p.captr" }));
	const controller = new ProjectController(createTimelineProject("p", "P"), save);
	controller.execute((project) => ({ ...project, title: "Dirty" }));
	let resolveTake!: (keep: boolean) => void;
	let request!: () => Promise<boolean>;
	const beforeClose = vi.fn(
		() =>
			new Promise<boolean>((resolve) => {
				resolveTake = resolve;
			}),
	);
	bindProjectClose(
		controller,
		{
			setHasUnsavedChanges: vi.fn(),
			onRequestSaveBeforeClose: (fn) => {
				request = fn;
				return vi.fn();
			},
		},
		vi.fn(),
		beforeClose,
	);

	const canceled = request();
	await vi.waitFor(() => expect(beforeClose).toHaveBeenCalledTimes(1));
	expect(save).not.toHaveBeenCalled();
	resolveTake(false);
	expect(await canceled).toBe(false);
	expect(save).not.toHaveBeenCalled();

	const continued = request();
	await vi.waitFor(() => expect(beforeClose).toHaveBeenCalledTimes(2));
	resolveTake(true);
	await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
	expect(await continued).toBe(true);
});

it("bootstraps a completed capture before resetting a new project path", async () => {
	const session = {
		projectId: "record-project",
		captureId: "first-capture",
		videoPath: "screen.mp4",
		timeOffsetMs: 0,
	};
	const api = {
		consumePendingProjectOpen: async () => null,
		loadCurrentProjectFile: async () => ({ success: false }),
		getCurrentRecordingSession: async () => ({ success: true, session }),
	};
	expect(await resolveEditorBootstrap(api)).toMatchObject({
		recordingProjectId: "record-project",
		resetPath: false,
	});
});
it("snapshots a completed recording before reloading an existing bundle clears the native session", async () => {
	let session: any = {
		projectId: "existing",
		captureId: "completed",
		videoPath: "screen.mp4",
		timeOffsetMs: 0,
	};
	const original = session;
	const api = {
		consumePendingProjectOpen: async () => null,
		getCurrentRecordingSession: async () => ({ success: true, session }),
		loadCurrentProjectFile: async () => {
			session = null;
			return {
				success: true,
				project: createTimelineProject("existing", "Existing"),
				path: "existing.captr",
			};
		},
	};
	expect((await resolveEditorBootstrap(api)).recordingSession).toEqual(original);
});
it("preserves a cold legacy candidate and token, and opens queued paths before the old project", async () => {
	const candidate = {
		success: true,
		project: { version: 2 },
		conversionToken: "candidate",
		path: "old.captr",
	};
	const current = vi.fn();
	const api = {
		consumePendingProjectOpen: async () => ({ result: candidate }),
		loadCurrentProjectFile: current,
	};
	expect((await resolveEditorBootstrap(api)).result).toBe(candidate);
	expect(current).not.toHaveBeenCalled();
	const load = vi.fn(async () => candidate);
	expect(
		(
			await resolveEditorBootstrap({
				...api,
				consumePendingProjectOpen: async () => ({ path: "old.captr" }),
				openProjectFileAtPath: load,
			})
		).result,
	).toBe(candidate);
	expect(load).toHaveBeenCalledWith("old.captr");
});
