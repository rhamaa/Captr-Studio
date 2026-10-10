import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import { getStoryProject } from "@/core/timeline/storyOwnership";
import { ownershipFixture } from "@/core/timeline/storyOwnership.fixtures";
import type { TimelineProject } from "@/core/timeline/types";
import type { RecordedAudioTake } from "@/recording/audioRecorder";
import { createAudioRecordingAssetsController } from "./useAudioRecordingAssets";
import { ProjectController } from "./useProjectController";

const filePath = "C:/Captr/recordings/voiceovers/take.webm";
const makeTake = (): RecordedAudioTake => ({
	blob: new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm;codecs=opus" }),
	mimeType: "audio/webm;codecs=opus",
	extension: "webm",
	durationMs: 2_500,
	startUs: 7_000_000,
});

function fixture(options?: {
	project?: TimelineProject;
	probe?: (path: string, kind: "audio") => Promise<{ durationUs: number }>;
}) {
	const project = options?.project ?? createTimelineProject("project-one", "Project");
	const controller = new ProjectController(project, async () => ({
		success: true,
		path: "project.captr",
	}));
	const api = {
		saveRecordedAudio: vi.fn(async () => ({ success: true, filePath })),
		discardRecordedAudio: vi.fn(async () => ({ success: true, deleted: true })),
	};
	const probeMedia = vi.fn(
		options?.probe ?? (async () => ({ durationUs: 2_500_000, width: 0, height: 0 })),
	);
	const assets = createAudioRecordingAssetsController({
		controller,
		api,
		getProject: () => controller.snapshot.project,
		probeMedia,
	});
	return { controller, api, probeMedia, assets };
}

describe("project audio recording asset handoff", () => {
	it("reports bounded cleanup failure for a canceled take whose save completes late", async () => {
		const { api, assets } = fixture();
		let finishSave!: (result: { success: boolean; filePath: string }) => void;
		api.saveRecordedAudio.mockImplementation(
			() =>
				new Promise((resolve) => {
					finishSave = resolve;
				}),
		);
		api.discardRecordedAudio.mockResolvedValue({ success: false, deleted: false });
		const token = assets.begin(0);
		const completion = assets.finalize(token, makeTake());
		await vi.waitFor(() => expect(finishSave).toBeDefined());
		await assets.discard(token);
		finishSave({ success: true, filePath });
		await expect(completion).rejects.toThrow(/temporary voiceover/i);
	});
	it("keeps a held take in its captured Story and preserves IDs across placement undo", async () => {
		let finishProbe!: (media: { durationUs: number }) => void;
		const { controller, api, assets } = fixture({
			project: ownershipFixture(),
			probe: () =>
				new Promise((resolve) => {
					finishProbe = resolve;
				}),
		});
		const scope = { kind: "artboard", artboardId: "A" } as const;
		const token = assets.begin(7_000_000, scope);
		const beforeB = structuredClone(
			getStoryProject(controller.snapshot.project, { kind: "artboard", artboardId: "B" }),
		);
		const completion = assets.finalize(token, makeTake());
		await vi.waitFor(() => expect(finishProbe).toBeDefined());
		controller.seek(11_000_000);
		controller.execute((p) => ({ ...p, title: "Ordinary edit" }));
		finishProbe({ durationUs: 2_500_000 });
		const kept = await completion;
		const root = controller.snapshot.project;
		const viewA = getStoryProject(root, scope);
		expect(viewA.localAssets?.find((asset) => asset.id === token.ids.assetId)).toBeDefined();
		expect(getStoryProject(root, { kind: "artboard", artboardId: "B" }).tracks).toEqual(
			beforeB.tracks,
		);
		expect(
			getStoryProject(root, { kind: "artboard", artboardId: "B" }).localAssets?.some(
				(asset) => asset.id === kept?.assetId,
			),
		).not.toBe(true);
		expect(root.assets.some((asset) => asset.id === kept?.assetId)).toBe(false);
		expect(
			viewA.tracks
				.flatMap((track) => track.clips)
				.find((clip) => clip.id === token.ids.clipId)?.startUs,
		).toBe(7_000_000);
		controller.undo();
		expect(
			getStoryProject(controller.snapshot.project, scope).localAssets?.some(
				(asset) => asset.id === kept?.assetId,
			),
		).toBe(true);
		expect(
			getStoryProject(controller.snapshot.project, scope)
				.tracks.flatMap((track) => track.clips)
				.some((clip) => clip.id === token.ids.clipId),
		).toBe(false);
		controller.redo();
		expect(
			getStoryProject(controller.snapshot.project, scope)
				.tracks.flatMap((track) => track.clips)
				.some((clip) => clip.id === token.ids.clipId),
		).toBe(true);
		expect(api.discardRecordedAudio).not.toHaveBeenCalled();
	});

	it.each([
		"deleted-owner",
		"new-project",
		"exit",
		"discard",
		"dispose",
	] as const)("rejects a held save after %s and cleans its output", async (reason) => {
		const { controller, api, assets } = fixture({ project: ownershipFixture() });
		let finishSave!: (result: { success: boolean; filePath: string }) => void;
		api.saveRecordedAudio.mockImplementation(
			() =>
				new Promise((resolve) => {
					finishSave = resolve;
				}),
		);
		const token = assets.begin(0, { kind: "artboard", artboardId: "A" });
		const completion = assets.finalize(token, makeTake());
		await vi.waitFor(() => expect(finishSave).toBeDefined());
		if (reason === "deleted-owner")
			controller.execute((p) => ({
				...p,
				repurposeBoard: {
					...p.repurposeBoard!,
					artboards: p.repurposeBoard!.artboards.filter((a) => a.id !== "A"),
				},
			}));
		if (reason === "new-project")
			controller.open(createTimelineProject("new-project", "New"), null);
		if (reason === "exit") controller.exit();
		if (reason === "discard") await assets.discard(token);
		if (reason === "dispose") assets.dispose();
		const before = structuredClone(controller.snapshot.project);
		finishSave({ success: true, filePath });
		expect(await completion).toBeNull();
		expect(controller.snapshot.project).toEqual(before);
		expect(api.discardRecordedAudio).toHaveBeenCalledWith(filePath);
		expect(assets.isActive()).toBe(false);
		if (reason !== "exit") expect(controller.snapshot.pendingWork).toBe(0);
	});

	it("retains a committed private source when placement fails and the take is discarded", async () => {
		const { controller, api, assets } = fixture({ project: ownershipFixture() });
		const scope = { kind: "artboard", artboardId: "A" } as const;
		const token = assets.begin(0, scope);
		const execute = controller.execute.bind(controller);
		let commands = 0;
		vi.spyOn(controller, "execute").mockImplementation((...args) => {
			if (++commands === 2) throw new Error("Placement failed");
			return execute(...args);
		});
		await expect(assets.finalize(token, makeTake())).rejects.toThrow("Placement failed");
		await assets.discard(token, filePath);
		expect(
			getStoryProject(controller.snapshot.project, scope).localAssets?.some(
				(asset) => asset.id === token.ids.assetId,
			),
		).toBe(true);
		expect(api.discardRecordedAudio).not.toHaveBeenCalled();
	});

	it("rejects a missing Story at begin without pending capture work", () => {
		const { controller, assets } = fixture();
		expect(() => assets.begin(0, { kind: "artboard", artboardId: "missing" })).toThrow(
			/owner/i,
		);
		expect(controller.snapshot.pendingWork).toBe(0);
	});
	it.each([
		"deleted-owner",
		"discard",
		"new-project",
	] as const)("rejects a held probe after %s without changing the rejected snapshot", async (reason) => {
		let finishProbe!: (result: { durationUs: number }) => void;
		const { controller, api, assets } = fixture({
			project: ownershipFixture(),
			probe: () =>
				new Promise((resolve) => {
					finishProbe = resolve;
				}),
		});
		const token = assets.begin(0, { kind: "artboard", artboardId: "A" });
		const completion = assets.finalize(token, makeTake());
		await vi.waitFor(() => expect(finishProbe).toBeDefined());
		if (reason === "deleted-owner")
			controller.execute((p) => ({
				...p,
				repurposeBoard: {
					...p.repurposeBoard!,
					artboards: p.repurposeBoard!.artboards.filter((a) => a.id !== "A"),
				},
			}));
		if (reason === "discard") await assets.discard(token);
		if (reason === "new-project")
			controller.open(createTimelineProject("new-probe-project", "Next"), null);
		const before = structuredClone(controller.snapshot.project);
		finishProbe({ durationUs: 2_500_000 });
		expect(await completion).toBeNull();
		expect(controller.snapshot.project).toEqual(before);
		expect(api.discardRecordedAudio).toHaveBeenCalledWith(filePath);
	});

	it("keeps save failure retryable without registration or placement", async () => {
		const { controller, api, assets } = fixture();
		api.saveRecordedAudio.mockRejectedValueOnce(new Error("Storage unavailable"));
		const token = assets.begin(0);
		const before = structuredClone(controller.snapshot.project);
		await expect(assets.finalize(token, makeTake())).rejects.toThrow("Storage unavailable");
		expect(controller.snapshot.project).toEqual(before);
		expect(assets.isActive()).toBe(true);
		await assets.finalize(token, makeTake());
		expect(controller.snapshot.project.localAssets?.[0]?.id).toBe(token.ids.assetId);
		expect(api.discardRecordedAudio).not.toHaveBeenCalled();
	});
	it("cleans a rejected probe when its Story has been deleted", async () => {
		let rejectProbe!: (error: Error) => void;
		const { controller, api, assets } = fixture({
			project: ownershipFixture(),
			probe: () =>
				new Promise((_resolve, reject) => {
					rejectProbe = reject;
				}),
		});
		const token = assets.begin(0, { kind: "artboard", artboardId: "A" });
		const completion = assets.finalize(token, makeTake());
		await vi.waitFor(() => expect(rejectProbe).toBeDefined());
		controller.execute((p) => ({
			...p,
			repurposeBoard: {
				...p.repurposeBoard!,
				artboards: p.repurposeBoard!.artboards.filter((a) => a.id !== "A"),
			},
		}));
		const before = structuredClone(controller.snapshot.project);
		rejectProbe(new Error("Decode failed"));
		expect(await completion).toBeNull();
		expect(controller.snapshot.project).toEqual(before);
		expect(api.discardRecordedAudio).toHaveBeenCalledWith(filePath);
		expect(assets.isActive()).toBe(false);
	});
	it("registers an audio Asset and places it at the captured playhead", async () => {
		const { controller, assets } = fixture();
		const token = assets.begin(7_000_000);
		controller.seek(11_000_000);

		const result = await assets.finalize(token, makeTake());
		const project = controller.snapshot.project;
		const asset = project.localAssets?.find((candidate) => candidate.id === result?.assetId);
		const clip = project.tracks
			.flatMap((track) => track.clips)
			.find((candidate) => candidate.id === result?.clipId);

		expect(asset).toMatchObject({
			kind: "audio",
			durationUs: 2_500_000,
			source: { path: filePath },
		});
		expect(clip).toMatchObject({ assetId: result?.assetId, startUs: 7_000_000 });
		expect(controller.snapshot.pendingWork).toBe(0);
	});

	it("keeps the Asset when placement is undone and restores the same clip on redo", async () => {
		const { controller, assets } = fixture();
		const result = await assets.finalize(assets.begin(1_000_000), makeTake());
		const originalClipId = result?.clipId;

		controller.undo();
		expect(controller.snapshot.project.localAssets).toHaveLength(1);
		expect(controller.snapshot.project.tracks.flatMap((track) => track.clips)).toHaveLength(0);
		controller.redo();
		expect(
			controller.snapshot.project.tracks
				.flatMap((track) => track.clips)
				.map((clip) => clip.id),
		).toEqual([originalClipId]);
	});

	it("cleans a staged file when finalization completes after the project changes", async () => {
		let controller!: ProjectController;
		const probe = vi.fn(async () => {
			controller.open(createTimelineProject("project-two", "Next"), null);
			return { durationUs: 2_500_000, width: 0, height: 0 };
		});
		const subject = fixture({ probe });
		controller = subject.controller;
		const { api, assets } = subject;
		const token = assets.begin(0);

		expect(await assets.finalize(token, makeTake())).toBeNull();
		expect(controller.snapshot.project.projectId).toBe("project-two");
		expect(controller.snapshot.project.assets).toHaveLength(0);
		expect(api.discardRecordedAudio).toHaveBeenCalledWith(filePath);
	});

	it("leaves the project unchanged and keeps a take retryable after probe failure", async () => {
		const probe = vi
			.fn()
			.mockRejectedValueOnce(new Error("Audio could not be decoded"))
			.mockResolvedValue({ durationUs: 2_500_000, width: 0, height: 0 });
		const { controller, api, assets } = fixture({ probe });
		const token = assets.begin(3_000_000);
		const take = makeTake();

		await expect(assets.finalize(token, take)).rejects.toThrow("Audio could not be decoded");
		expect(controller.snapshot.project.assets).toHaveLength(0);
		expect(controller.snapshot.project.tracks.flatMap((track) => track.clips)).toHaveLength(0);
		expect(controller.snapshot.pendingWork).toBeGreaterThan(0);
		await assets.finalize(token, take);
		expect(api.saveRecordedAudio).toHaveBeenCalledTimes(1);
		expect(controller.snapshot.project.localAssets).toHaveLength(1);
	});

	it("clears pending work and only deletes through the scoped Electron cleanup API on discard", async () => {
		const { controller, api, assets } = fixture();
		const token = assets.begin(0);

		await assets.discard(token, filePath);
		expect(api.discardRecordedAudio).toHaveBeenCalledWith(filePath);
		expect(controller.snapshot.pendingWork).toBe(0);
		expect(controller.snapshot.project.assets).toHaveLength(0);
	});
});
