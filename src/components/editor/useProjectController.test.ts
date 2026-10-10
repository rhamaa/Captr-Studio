import { expect, it, vi } from "vitest";
import { artboardToStory } from "@/core/story/storyUtils";
import {
	addTextOverlay,
	createTimelineProject,
	placeAsset,
	registerMedia,
} from "@/core/timeline/commands";
import { extendInlineClip } from "@/core/timeline/designTemplateCommands";
import { addRepurposeArtboard } from "@/core/timeline/repurposeCommands";
import { applyStoryCommand } from "@/core/timeline/storyOwnership";
import { fixtureText, ownershipFixture } from "@/core/timeline/storyOwnership.fixtures";
import { ProjectController } from "./useProjectController";

it.each([
	"missing-owner",
	"dangling-transition",
])("rejects %s ingress while retaining the complete active session and source", (failure) => {
	const controller = new ProjectController(ownershipFixture(), vi.fn());
	controller.open(ownershipFixture(), "Active.captr");
	controller.execute((project) => ({ ...project, canvas: { ...project.canvas, width: 1280 } }));
	controller.setPendingWork("import", 1);
	const previous = controller.snapshot;
	const token = controller.importToken();
	const invalid = ownershipFixture();
	if (failure === "missing-owner") {
		invalid.stories = [artboardToStory(invalid.repurposeBoard!.artboards[0])];
		invalid.repurposeBoard!.artboards.shift();
	} else {
		const owner = invalid.repurposeBoard!.artboards[0];
		delete owner.tracks;
		owner.clipTransitions = [
			{
				id: "dangling-fade",
				trackId: "root",
				fromClipId: "root-video",
				toClipId: "missing",
				durationUs: 500_000,
				preset: { kind: "cross-dissolve" },
				easing: "linear",
			},
		];
	}
	const source = JSON.stringify(invalid);
	expect(() => controller.open(invalid, "Rejected.captr")).toThrow();
	expect(controller.snapshot).toBe(previous);
	expect(controller.snapshot.path).toBe("Active.captr");
	expect(controller.snapshot.canUndo).toBe(true);
	expect(controller.snapshot.pendingWork).toBe(1);
	expect(controller.importToken()).toEqual(token);
	expect(JSON.stringify(invalid)).toBe(source);
});

it("normalizes legacy V3 on installation and rejects invalid opens without changing session", () => {
	const raw = ownershipFixture();
	delete raw.repurposeBoard!.artboards[1].tracks;
	raw.assets.push({
		id: "unused-title",
		kind: "text",
		name: "Preset",
		width: 1920,
		height: 1080,
		durationUs: 5_000_000,
		text: fixtureText,
	});
	const controller = new ProjectController(raw, vi.fn());
	expect(controller.snapshot.project.assets.some((a) => a.id === "unused-title")).toBe(false);
	expect(controller.snapshot.project.designTemplates?.[0].id).toBe("unused-title");
	expect(controller.snapshot.project.repurposeBoard!.artboards[1].tracks).toBeDefined();
	expect(raw.repurposeBoard!.artboards[1].tracks).toBeUndefined();
	controller.setPendingWork("import", 1);
	const previous = controller.snapshot,
		token = controller.importToken();
	const invalid = ownershipFixture();
	invalid.repurposeBoard!.artboards[0].localAssets![0].source!.path = "../escape.wav";
	expect(() => controller.open(invalid, "broken.captr")).toThrow();
	expect(controller.snapshot).toBe(previous);
	expect(controller.importToken()).toEqual(token);
	expect(controller.snapshot.pendingWork).toBe(1);
	controller.open(raw, "Legacy.captr");
	expect(controller.snapshot.project.designTemplates?.[0].id).toBe("unused-title");
});

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
it("owns navigation while async loading and blocks Save As until a pending import completes", async () => {
	const persist = vi.fn(async (r: any) => ({
		success: true,
		operationId: r.operationId,
		generation: r.generation,
		revision: r.revision,
		projectId: r.project.projectId,
		path: "Copy.captr",
		title: "Copy",
	}));
	const c = new ProjectController(createTimelineProject("p", "P"), { persist });
	expect(c.beginNavigation()).toBe(true);
	expect(() => c.execute((p) => ({ ...p, canvas: { ...p.canvas, width: 1280 } }))).toThrow();
	c.endNavigation();
	c.setPendingWork("import", 1);
	expect((await c.save(true)).success).toBe(false);
	expect(persist).not.toHaveBeenCalled();
	const token = c.importToken();
	expect(c.acceptImport(token, (p) => ({ ...p, canvas: { ...p.canvas, width: 1280 } }))).toBe(
		true,
	);
	c.setPendingWork("import", 0);
	expect((await c.save(true)).success).toBe(true);
	expect(c.snapshot.project.canvas.width).toBe(1280);
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
	expect(c.snapshot.project.title).toBe("copy");
	expect(c.snapshot.project.projectId).toBe(id);
});

it("normalizes stale names without dirtying and preserves rename through history", async () => {
	const c = new ProjectController(createTimelineProject("p", "Stale"), {
		persist: async (r) => ({
			success: true,
			operationId: r.operationId,
			generation: r.generation,
			revision: r.revision,
			projectId: r.project.projectId,
			path: "D:/Demo.captr",
			title: "Demo",
		}),
	});
	c.open(createTimelineProject("p", "Stale"), "D:/Tutorial.captr");
	expect(c.snapshot.project.title).toBe("Tutorial");
	expect(c.snapshot.dirty).toBe(false);
	c.execute((p) => ({ ...p, width: 1280 }));
	await c.rename("Demo");
	c.undo();
	expect(c.snapshot.project.title).toBe("Demo");
	c.redo();
	expect(c.snapshot.project.title).toBe("Demo");
});
it("rejects mismatched results and invalidates delayed saves after exit", async () => {
	let finish!: (r: any) => void;
	const c = new ProjectController(createTimelineProject("p", "P"), {
		persist: (r) =>
			new Promise((resolve) => {
				finish = (result) =>
					resolve({
						...result,
						operationId: r.operationId,
						generation: r.generation,
						revision: r.revision,
					});
			}),
	});
	const job = c.save();
	await Promise.resolve();
	c.exit();
	finish({ success: true, path: "D:/Late.captr", projectId: "p", title: "Late" });
	await job;
	expect(c.snapshot.path).toBe(null);
	const other = new ProjectController(createTimelineProject("p", "P"), {
		persist: async (r) => ({
			success: true,
			operationId: "wrong",
			generation: r.generation,
			revision: r.revision,
			path: "bad.captr",
			projectId: "p",
			title: "bad",
		}),
	});
	expect((await other.save()).success).toBe(false);
	expect(other.snapshot.path).toBe(null);
});
it("blocks edits during rename and leaves state intact on cancel", async () => {
	let finish!: (r: any) => void;
	let request: any;
	const c = new ProjectController(createTimelineProject("p", "P"), {
		persist: (r) => {
			request = r;
			return new Promise((resolve) => {
				finish = resolve;
			});
		},
	});
	c.open(createTimelineProject("p", "P"), "P.captr");
	const job = c.rename("Demo");
	await Promise.resolve();
	expect(() => c.execute((p) => ({ ...p, width: 1280 }))).toThrow();
	finish({ success: false, operationId: request.operationId, canceled: true });
	await job;
	expect(c.snapshot.path).toBe("P.captr");
	expect(c.snapshot.fileOperation).toBe(null);
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

it("clamps seek playhead against root duration, artboard sequences, and explicit max duration", () => {
	const c = new ProjectController(createTimelineProject("init", "Test"), vi.fn());
	// Empty project: duration is 0
	c.seek(5_000_000);
	expect(c.snapshot.playheadUs).toBe(0);

	// Add artboard with tracks totaling 10s
	c.execute((p) => {
		const next = addRepurposeArtboard(p, {
			aspectRatio: "1:1",
			name: "Square",
			width: 1080,
			height: 1080,
		});
		return applyStoryCommand(
			next,
			{ kind: "artboard", artboardId: next.repurposeBoard!.artboards[0]!.id },
			(view) =>
				extendInlineClip(
					addTextOverlay(view, 0, { clipId: "c-1", trackId: "t-1" }),
					"c-1",
					10_000_000,
				),
		);
	});

	// Without explicit maxDurationUs, seeks up to 10s using artboard fallback
	c.seek(4_000_000);
	expect(c.snapshot.playheadUs).toBe(4_000_000);
	c.seek(15_000_000);
	expect(c.snapshot.playheadUs).toBe(10_000_000);

	// With explicit maxDurationUs, clamps to the specified limit
	c.seek(8_000_000, 6_000_000);
	expect(c.snapshot.playheadUs).toBe(6_000_000);
});
