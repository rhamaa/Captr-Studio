import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
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

function fixture(options?: { probe?: (path: string, kind: "audio") => Promise<any> }) {
	const project = createTimelineProject("project-one", "Project");
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
	it("registers an audio Asset and places it at the captured playhead", async () => {
		const { controller, assets } = fixture();
		const token = assets.begin(7_000_000);
		controller.seek(11_000_000);

		const result = await assets.finalize(token, makeTake());
		const project = controller.snapshot.project;
		const asset = project.assets.find((candidate) => candidate.id === result?.assetId);
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
		expect(controller.snapshot.project.assets).toHaveLength(1);
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
		expect(controller.snapshot.project.assets).toHaveLength(1);
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
