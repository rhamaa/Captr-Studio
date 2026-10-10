import { expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { ownershipFixture } from "@/core/timeline/storyOwnership.fixtures";
import { requestProjectExit, resolveApplicationBootstrap } from "./projectNavigation";
import { createAudioRecordingAssetsController } from "./useAudioRecordingAssets";
import { ProjectController } from "./useProjectController";

const api = () => ({
	consumePendingProjectOpen: vi.fn(async () => null),
	loadCurrentProjectFile: vi.fn(),
	getCurrentRecordingSession: vi.fn(async () => ({ success: true, session: null })),
	getTimelineProjectActivity: vi.fn(async () => ({ recording: false, finalizing: false })),
	deactivateTimelineProject: vi.fn(async () => ({ success: true })),
});
it("blocks Home while a Story take is saving and permits exit after discard", async () => {
	const controller = new ProjectController(ownershipFixture(), vi.fn());
	let finishSave!: (result: { success: boolean; filePath: string }) => void;
	const assets = createAudioRecordingAssetsController({
		controller,
		getProject: () => controller.snapshot.project,
		api: {
			saveRecordedAudio: () =>
				new Promise((resolve) => {
					finishSave = resolve;
				}),
			discardRecordedAudio: async () => ({ success: true }),
		},
		probeMedia: async () => ({ durationUs: 1_000_000 }),
	});
	const token = assets.begin(0, { kind: "artboard", artboardId: "A" });
	const completion = assets.finalize(token, {
		blob: new Blob([new Uint8Array([1])]),
		mimeType: "audio/webm",
		extension: "webm",
		durationMs: 1000,
		startUs: 0,
	});
	await vi.waitFor(() => expect(finishSave).toBeDefined());
	const lifecycle = api();
	expect(await requestProjectExit(controller, "discard", lifecycle)).toBe(false);
	expect(lifecycle.deactivateTimelineProject).not.toHaveBeenCalled();
	await assets.discard(token);
	finishSave({ success: true, filePath: "C:/recordings/voiceovers/discarded.webm" });
	expect(await completion).toBeNull();
	expect(await requestProjectExit(controller, "discard", lifecycle)).toBe(true);
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
it("Home owns mutations through its final async deactivation boundary", async () => {
	const c = new ProjectController(createTimelineProject("p", "P"), vi.fn());
	const a = api();
	let finish!: () => void;
	a.deactivateTimelineProject.mockImplementation(
		() =>
			new Promise((resolve) => {
				finish = () => resolve({ success: true });
			}),
	);
	const job = requestProjectExit(c, "discard", a);
	await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
	expect(() => c.execute((p) => ({ ...p, canvas: { ...p.canvas, width: 1280 } }))).toThrow();
	finish();
	expect(await job).toBe(true);
});
