import { describe, expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
import type { TimelineProject } from "@/core/timeline/types";
import type { CameraTake } from "@/recording/cameraRecorder";
import { createMonologRecordingAssetsController } from "./useMonologRecordingAssets";

const take = (): CameraTake => ({
	blob: new Blob(["video"], { type: "video/webm" }),
	mimeType: "video/webm",
	extension: "webm",
	durationMs: 3000,
	hasAudio: true,
});

function harness(options: { saveFails?: boolean; leaseFails?: boolean } = {}) {
	let project: TimelineProject = createTimelineProject("p", "Project");
	let generation = 1;
	let exited = false;
	const pendingWork = new Map<string, number>();
	const controller = {
		importToken: () => ({ generation, projectId: project.projectId }),
		acceptImport: vi.fn(
			(
				token: { generation: number; projectId: string },
				command: (p: TimelineProject) => TimelineProject,
			) => {
				if (token.generation !== generation || token.projectId !== project.projectId)
					return false;
				project = command(project);
				return true;
			},
		),
		setPendingWork: (key: string, count: number) => pendingWork.set(key, count),
		get isExited() {
			return exited;
		},
	};
	const api = {
		saveRecordedMonolog: vi.fn(async () =>
			options.saveFails
				? { success: false, error: "disk full" }
				: { success: true, filePath: "C:/rec/monologs/m.webm" },
		),
		discardRecordedMonolog: vi.fn(async () => ({ success: true, deleted: true })),
		setProjectRecordingFinalizing: vi.fn(async () => {
			if (options.leaseFails)
				throw new Error("Finish the project file operation before recording.");
			return { success: true };
		}),
	};
	let id = 0;
	const assets = createMonologRecordingAssetsController({
		controller,
		api,
		getProject: () => project,
		probeMedia: async () => ({ durationUs: 3_000_000, width: 1920, height: 1080, url: "u" }),
		createId: () => `id-${++id}`,
		namePrefix: "Monolog",
	});
	return {
		assets,
		api,
		controller,
		pendingWork,
		project: () => project,
		switchProject: () => {
			project = createTimelineProject("other", "Other");
			generation++;
		},
		exit: () => {
			exited = true;
		},
	};
}

describe("monolog recording assets", () => {
	it("leases the capture, registers one recording asset and places nothing", async () => {
		const h = harness();
		const token = await h.assets.begin();
		expect(h.api.setProjectRecordingFinalizing).toHaveBeenCalledWith({
			projectId: "p",
			captureId: token.ids.captureId,
			finalizing: true,
		});
		expect(h.pendingWork.get("monologRecording")).toBe(1);
		expect(h.assets.isActive()).toBe(true);

		const result = await h.assets.finalize(token, take());
		expect(result).toEqual({ assetId: token.ids.assetId });
		const project = h.project();
		expect(project.assets).toHaveLength(1);
		expect(project.assets[0]).toMatchObject({ kind: "recording", name: "Monolog 1" });
		expect(project.packages[0]).toMatchObject({
			captureSource: "camera",
			screen: { path: "C:/rec/monologs/m.webm" },
		});
		expect(project.tracks.flatMap((track) => track.clips)).toEqual([]);
		expect(h.api.setProjectRecordingFinalizing).toHaveBeenLastCalledWith({
			projectId: "p",
			captureId: token.ids.captureId,
			finalizing: false,
		});
		expect(h.pendingWork.get("monologRecording")).toBe(0);
		expect(h.assets.isActive()).toBe(false);
	});

	it("names the next take after the highest existing monolog", async () => {
		const h = harness();
		await h.assets.finalize(await h.assets.begin(), take());
		await h.assets.finalize(await h.assets.begin(), take());
		expect(h.project().assets.map((asset) => asset.name)).toEqual(["Monolog 1", "Monolog 2"]);
	});

	it("does not start when the main process refuses the lease", async () => {
		const h = harness({ leaseFails: true });
		await expect(h.assets.begin()).rejects.toThrow(/file operation/i);
		expect(h.assets.isActive()).toBe(false);
		expect(h.pendingWork.get("monologRecording")).toBe(0);
	});

	it("refuses a second take while one is active", async () => {
		const h = harness();
		await h.assets.begin();
		await expect(h.assets.begin()).rejects.toThrow(/already/i);
	});

	it("drops a take whose project changed and removes the stored file", async () => {
		const h = harness();
		const token = await h.assets.begin();
		h.api.saveRecordedMonolog.mockImplementationOnce(async () => {
			h.switchProject();
			return { success: true, filePath: "C:/rec/monologs/m.webm" };
		});
		expect(await h.assets.finalize(token, take())).toBeNull();
		expect(h.api.discardRecordedMonolog).toHaveBeenCalledWith("C:/rec/monologs/m.webm");
		expect(h.project().assets).toEqual([]);
		expect(h.assets.isActive()).toBe(false);
	});

	it("keeps the project unchanged and releases the lease when storing fails", async () => {
		const h = harness({ saveFails: true });
		const token = await h.assets.begin();
		await expect(h.assets.finalize(token, take())).rejects.toThrow(/disk full/);
		expect(h.project().assets).toEqual([]);
		expect(h.api.setProjectRecordingFinalizing).toHaveBeenLastCalledWith(
			expect.objectContaining({ finalizing: false }),
		);
		expect(h.assets.isActive()).toBe(false);
	});

	it("ignores a second finalize of the same token", async () => {
		const h = harness();
		const token = await h.assets.begin();
		await h.assets.finalize(token, take());
		expect(await h.assets.finalize(token, take())).toBeNull();
		expect(h.project().assets).toHaveLength(1);
	});

	it("discard releases the lease without storing anything", async () => {
		const h = harness();
		const token = await h.assets.begin();
		await h.assets.discard(token);
		expect(h.api.saveRecordedMonolog).not.toHaveBeenCalled();
		expect(h.api.setProjectRecordingFinalizing).toHaveBeenLastCalledWith(
			expect.objectContaining({ finalizing: false }),
		);
		expect(h.assets.isActive()).toBe(false);
	});

	it("drops the take when the controller exited", async () => {
		const h = harness();
		const token = await h.assets.begin();
		h.exit();
		expect(await h.assets.finalize(token, take())).toBeNull();
		expect(h.api.saveRecordedMonolog).not.toHaveBeenCalled();
	});
});
