import { expect, it, vi } from "vitest";
import { createTimelineProject, placeAsset, registerMedia } from "@/core/timeline/commands";
import { ProjectController } from "./useProjectController";

it("imports into an empty library, previews independently and retains dirty work after a save races an edit", async () => {
	let finish!: (result: any) => void;
	const save = vi.fn(
		() =>
			new Promise<any>((resolve) => {
				finish = resolve;
			}),
	);
	const c = new ProjectController(createTimelineProject("p", "P"), save);
	const asset = {
		id: "a",
		kind: "video" as const,
		name: "Video",
		durationUs: 10_000_000,
		width: 1920,
		height: 1080,
		source: { path: "video.mp4", durationUs: 10_000_000, offsetUs: 0 },
	};
	c.execute((p) => registerMedia(p, asset));
	expect(c.snapshot.project.tracks.flatMap((t) => t.clips)).toEqual([]);
	expect(c.snapshot.dirty).toBe(true);
	const request = c.save();
	await Promise.resolve();
	c.execute((p) => placeAsset(p, "a", "visual-1", 0, { clipId: "c" }));
	c.preview("a");
	expect(c.snapshot.project.tracks[0].clips).toHaveLength(1);
	finish({ success: true, path: "p.captr", projectId: "p" });
	await request;
	expect(c.snapshot.dirty).toBe(true);
	expect(c.snapshot.path).toBe("p.captr");
	expect(c.snapshot.savedRevision).toBe(1);
	c.select(["c"]);
	c.undo();
	expect(c.snapshot.selection).toEqual([]);
	expect(c.snapshot.project.assets).toHaveLength(1);
});
it("invalidates late imports when a new project replaces the opened one", () => {
	const c = new ProjectController(createTimelineProject("p", "P"), vi.fn());
	const token = c.importToken();
	c.open(createTimelineProject("new", "New"), null);
	expect(
		c.acceptImport(token, (p) =>
			registerMedia(p, {
				id: "a",
				kind: "image",
				name: "Image",
				durationUs: 5_000_000,
				width: 1,
				height: 1,
				source: { path: "image.png", durationUs: 5_000_000, offsetUs: 0 },
			}),
		),
	).toBe(false);
	expect(c.snapshot.project.assets).toEqual([]);
});
it("Save As retains undo history under the new project identity", async () => {
	const c = new ProjectController(createTimelineProject("p", "Before"), async (p) => ({
		success: true,
		path: "copy.captr",
		projectId: p.projectId,
	}));
	c.execute((p) => ({ ...p, title: "After" }));
	await c.save(true);
	const id = c.snapshot.project.projectId;
	expect(id).not.toBe("p");
	expect(c.snapshot.canUndo).toBe(true);
	c.undo();
	expect(c.snapshot.project.title).toBe("Before");
	expect(c.snapshot.project.projectId).toBe(id);
});

it("syncs project title with opened .captr file name when title is New project", () => {
	const c = new ProjectController(createTimelineProject("init", "New project"), vi.fn());
	c.open(createTimelineProject("proj-1", "New project"), "/path/to/Tutorial React.captr");
	expect(c.snapshot.project.title).toBe("Tutorial React");
});

it("syncs project title with saved file name when saving a project with default New project title", async () => {
	const c = new ProjectController(createTimelineProject("init", "New project"), async (p) => ({
		success: true,
		path: "C:\\Users\\User\\Videos\\My Presentation.captr",
		projectId: p.projectId,
	}));
	await c.save();
	expect(c.snapshot.project.title).toBe("My Presentation");
});
