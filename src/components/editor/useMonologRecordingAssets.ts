import { useEffect, useMemo } from "react";
import { registerMedia } from "@/core/timeline/commands";
import type { TimelineProject } from "@/core/timeline/types";
import type { CameraTake } from "@/recording/cameraRecorder";
import { cameraTakeAsset, nextMonologName } from "@/recording/cameraTakeAsset";
import { type ProbedMedia, probeMedia } from "@/recording/mediaProbe";
import type { ProjectController } from "./useProjectController";

const PENDING_WORK_KEY = "monologRecording";

export interface MonologRecordingToken {
	token: { generation: number; projectId: string };
	ids: { assetId: string; captureId: string };
}

type MonologController = Pick<
	ProjectController,
	"importToken" | "acceptImport" | "setPendingWork" | "isExited"
>;

interface MonologApi {
	saveRecordedMonolog: (payload: {
		videoBuffer: ArrayBuffer | Uint8Array | number[];
		extension?: string;
	}) => Promise<{ success: boolean; filePath?: string; error?: string }>;
	discardRecordedMonolog: (filePath: string) => Promise<{ success: boolean; error?: string }>;
	setProjectRecordingFinalizing: (input: {
		projectId: string;
		captureId: string;
		finalizing: boolean;
	}) => Promise<{ success: boolean }>;
}

export interface MonologRecordingAssetsDependencies {
	controller: MonologController;
	api: MonologApi;
	getProject: () => TimelineProject;
	probeMedia: (path: string, kind: "video") => Promise<ProbedMedia>;
	createId?: () => string;
	/** Localized asset name prefix, e.g. "Monolog". */
	namePrefix: string;
}

export interface MonologRecordingAssetsController {
	/** Takes the main-process capture lease. Call before the countdown starts. */
	begin(): Promise<MonologRecordingToken>;
	finalize(token: MonologRecordingToken, take: CameraTake): Promise<{ assetId: string } | null>;
	discard(token?: MonologRecordingToken | null): Promise<void>;
	isActive(): boolean;
	dispose(): void;
}

export function createMonologRecordingAssetsController(
	dependencies: MonologRecordingAssetsDependencies,
): MonologRecordingAssetsController {
	const createId = dependencies.createId ?? (() => crypto.randomUUID());
	let active: MonologRecordingToken | null = null;
	let beginning = false;

	const setActive = (next: MonologRecordingToken | null) => {
		active = next;
		dependencies.controller.setPendingWork(PENDING_WORK_KEY, next ? 1 : 0);
	};

	const tokenIsCurrent = (token: MonologRecordingToken) => {
		if (active !== token || dependencies.controller.isExited) return false;
		const current = dependencies.controller.importToken();
		return (
			current.projectId === token.token.projectId &&
			current.generation === token.token.generation &&
			dependencies.getProject().projectId === token.token.projectId
		);
	};

	const releaseLease = async (token: MonologRecordingToken) => {
		try {
			await dependencies.api.setProjectRecordingFinalizing({
				projectId: token.token.projectId,
				captureId: token.ids.captureId,
				finalizing: false,
			});
		} catch {
			// The owner changed; main releases leases for abandoned projects and closed windows.
		}
	};

	const removeFile = async (filePath: string) => {
		await dependencies.api.discardRecordedMonolog(filePath).catch(() => undefined);
	};

	const end = async (token: MonologRecordingToken) => {
		if (active === token) setActive(null);
		await releaseLease(token);
	};

	return {
		async begin() {
			if (active || beginning) throw new Error("A monolog recording is already active");
			beginning = true;
			try {
				const project = dependencies.getProject();
				const importToken = dependencies.controller.importToken();
				if (project.projectId !== importToken.projectId)
					throw new Error("The active project changed before recording started");
				const token: MonologRecordingToken = Object.freeze({
					token: Object.freeze({ ...importToken }),
					ids: Object.freeze({
						assetId: createId(),
						captureId: createId(),
					}),
				});
				setActive(token);
				try {
					await dependencies.api.setProjectRecordingFinalizing({
						projectId: importToken.projectId,
						captureId: token.ids.captureId,
						finalizing: true,
					});
				} catch (error) {
					setActive(null);
					throw error;
				}
				return token;
			} finally {
				beginning = false;
			}
		},

		async finalize(token, take) {
			if (active !== token) return null;
			let filePath: string | null = null;
			try {
				if (!tokenIsCurrent(token)) return null;
				const saved = await dependencies.api.saveRecordedMonolog({
					videoBuffer: new Uint8Array(await take.blob.arrayBuffer()),
					extension: take.extension,
				});
				if (!saved.success || !saved.filePath)
					throw new Error(saved.error ?? "Could not save the monolog take");
				filePath = saved.filePath;
				if (!tokenIsCurrent(token)) {
					await removeFile(filePath);
					return null;
				}
				const asset = await cameraTakeAsset(
					{
						id: token.ids.assetId,
						videoPath: filePath,
						name: nextMonologName(
							dependencies.getProject().assets,
							dependencies.namePrefix,
						),
					},
					{ probeMedia: dependencies.probeMedia },
				);
				if (!tokenIsCurrent(token)) {
					await removeFile(filePath);
					return null;
				}
				// Name again against the latest assets, in case they changed while probing.
				asset.name = nextMonologName(
					dependencies.getProject().assets,
					dependencies.namePrefix,
				);
				// Global project Assets: shared by every Story and Artboard on the storyboard.
				const accepted = dependencies.controller.acceptImport(token.token, (project) =>
					registerMedia(project, asset),
				);
				if (!accepted) {
					await removeFile(filePath);
					return null;
				}
				return { assetId: token.ids.assetId };
			} catch (error) {
				if (filePath) await removeFile(filePath);
				throw error;
			} finally {
				await end(token);
			}
		},

		async discard(token) {
			const current = active && (!token || active === token) ? active : null;
			if (current) await end(current);
		},

		isActive: () => active !== null || beginning,

		dispose() {
			const current = active;
			if (current) void end(current);
		},
	};
}

export function useMonologRecordingAssets(
	controller: ProjectController,
	namePrefix: string,
): MonologRecordingAssetsController {
	const assets = useMemo(
		() =>
			createMonologRecordingAssetsController({
				controller,
				getProject: () => controller.snapshot.project,
				namePrefix,
				api: {
					saveRecordedMonolog: (payload) => {
						const save = window.electronAPI?.saveRecordedMonolog;
						if (!save) throw new Error("Monolog storage is unavailable");
						return save(payload);
					},
					discardRecordedMonolog: (path) => {
						const discard = window.electronAPI?.discardRecordedMonolog;
						if (!discard) throw new Error("Monolog cleanup is unavailable");
						return discard(path);
					},
					setProjectRecordingFinalizing: (input) =>
						window.electronAPI.setProjectRecordingFinalizing(input),
				},
				probeMedia: (path, kind) => probeMedia(path, kind),
			}),
		[controller, namePrefix],
	);
	useEffect(() => () => assets.dispose(), [assets]);
	return assets;
}
