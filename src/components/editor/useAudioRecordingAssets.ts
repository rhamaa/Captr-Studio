import { useEffect, useMemo } from "react";
import { registerStoryMedia } from "@/core/timeline/storyMediaCommands";
import { applyStoryCommand, getStoryProject } from "@/core/timeline/storyOwnership";
import type { PrivateMediaAsset, StoryScope, TimelineProject } from "@/core/timeline/types";
import { placeVoiceover } from "@/core/timeline/voiceoverPlacement";
import type { RecordedAudioTake } from "@/recording/audioRecorder";
import { probeMedia } from "@/recording/mediaProbe";
import type { ProjectController } from "./useProjectController";

export interface StoryVoiceoverContext {
	scope: StoryScope;
	token: { generation: number; projectId: string };
	startUs: number;
	ids: { assetId: string; clipId: string; trackId: string };
}
export type AudioRecordingToken = StoryVoiceoverContext;

type ProjectAudioController = Pick<
	ProjectController,
	"importToken" | "acceptImport" | "execute" | "setPendingWork" | "isExited"
>;

interface RecordedAudioApi {
	saveRecordedAudio: (payload: {
		audioBuffer: ArrayBuffer | Uint8Array | number[];
		extension?: string;
	}) => Promise<{ success: boolean; filePath?: string; error?: string }>;
	discardRecordedAudio: (filePath: string) => Promise<{
		success: boolean;
		deleted?: boolean;
		error?: string;
	}>;
}

export interface AudioRecordingAssetsDependencies {
	controller: ProjectAudioController;
	api: RecordedAudioApi;
	getProject: () => TimelineProject;
	probeMedia: (
		path: string,
		kind: "audio",
	) => Promise<{ durationUs: number; width?: number; height?: number }>;
	createId?: () => string;
}

interface ActiveCapture {
	token: AudioRecordingToken;
	filePath: string | null;
	asset?: PrivateMediaAsset;
}

export interface AudioRecordingAssetsController {
	begin(startUs: number, scope?: StoryScope): StoryVoiceoverContext;
	finalize(
		token: AudioRecordingToken,
		take: RecordedAudioTake,
	): Promise<{ assetId: string; clipId: string } | null>;
	discard(token?: AudioRecordingToken | null, filePath?: string): Promise<void>;
	isActive(): boolean;
	dispose(): void;
}

export function createAudioRecordingAssetsController(
	dependencies: AudioRecordingAssetsDependencies,
): AudioRecordingAssetsController {
	const createId = dependencies.createId ?? (() => crypto.randomUUID());
	let active: ActiveCapture | null = null;

	const tokenIsCurrent = (token: AudioRecordingToken) => {
		if (active?.token !== token || dependencies.controller.isExited) return false;
		const current = dependencies.controller.importToken();
		if (
			current.projectId !== token.token.projectId ||
			current.generation !== token.token.generation ||
			dependencies.getProject().projectId !== token.token.projectId
		)
			return false;
		try {
			getStoryProject(dependencies.getProject(), token.scope);
			return true;
		} catch {
			return false;
		}
	};

	const setActive = (next: ActiveCapture | null) => {
		active = next;
		dependencies.controller.setPendingWork("audioRecording", next ? 1 : 0);
	};

	const removeStagedFile = async (filePath: string) => {
		const result = await dependencies.api.discardRecordedAudio(filePath);
		if (!result.success)
			throw new Error(result.error ?? "Could not remove the temporary voiceover file");
	};

	const discard = async (token?: AudioRecordingToken | null, filePath?: string) => {
		const capture = active && (!token || active.token === token) ? active : null;
		const stagedPath = capture?.asset ? null : (filePath ?? capture?.filePath);
		if (stagedPath) await removeStagedFile(stagedPath);
		if (capture) setActive(null);
	};

	const begin = (startUs: number, scope: StoryScope = { kind: "root" }) => {
		if (!Number.isSafeInteger(startUs) || startUs < 0)
			throw new Error("Voiceover start time must be a non-negative integer");
		if (active) throw new Error("An audio recording is already active");
		const project = dependencies.getProject();
		getStoryProject(project, scope);
		const importToken = dependencies.controller.importToken();
		if (project.projectId !== importToken.projectId)
			throw new Error("The active project changed before audio recording started");
		const token: StoryVoiceoverContext = Object.freeze({
			token: Object.freeze({ ...importToken }),
			scope: Object.freeze({ ...scope }),
			startUs,
			ids: Object.freeze({ assetId: createId(), clipId: createId(), trackId: createId() }),
		});
		setActive({ token, filePath: null });
		return token;
	};

	const finalize = async (token: AudioRecordingToken, take: RecordedAudioTake) => {
		const capture = active?.token === token ? active : null;
		if (!capture) return null;
		if (!tokenIsCurrent(token)) {
			await discard(token);
			return null;
		}

		try {
			if (!capture.filePath) {
				const result = await dependencies.api.saveRecordedAudio({
					audioBuffer: new Uint8Array(await take.blob.arrayBuffer()),
					extension: take.extension,
				});
				if (!result.success || !result.filePath)
					throw new Error(result.error ?? "Could not save the recorded voiceover");
				capture.filePath = result.filePath;
			}

			const path = capture.filePath;
			if (!path) throw new Error("The saved voiceover path is missing");
			if (!tokenIsCurrent(token)) {
				await discard(token, path);
				return null;
			}
			let asset = capture.asset;
			if (!asset) {
				const media = await dependencies.probeMedia(path, "audio");
				if (!Number.isSafeInteger(media.durationUs) || media.durationUs <= 0)
					throw new Error("The recorded voiceover has no playable audio track");
				if (!tokenIsCurrent(token)) {
					await discard(token, path);
					return null;
				}

				asset = {
					id: token.ids.assetId,
					kind: "audio",
					name: `Voiceover ${new Date().toISOString()}`,
					durationUs: media.durationUs,
					width: 0,
					height: 0,
					source: { path, durationUs: media.durationUs, offsetUs: 0 },
				};
				const accepted = dependencies.controller.acceptImport(token.token, (project) =>
					registerStoryMedia(project, token.scope, asset!),
				);
				if (!accepted) {
					await discard(token, path);
					return null;
				}
				capture.asset = asset;
			}

			dependencies.controller.execute(
				(project) =>
					applyStoryCommand(project, token.scope, (view) =>
						placeVoiceover(view, token.ids.assetId, token.startUs, token.ids),
					),
				[token.ids.clipId],
			);
			setActive(null);
			return { assetId: token.ids.assetId, clipId: token.ids.clipId };
		} catch (error) {
			if (!tokenIsCurrent(token)) {
				// Discard protects sources whose separate registration already committed.
				await discard(token, capture.asset ? undefined : (capture.filePath ?? undefined));
				return null;
			}
			throw error;
		}
	};

	return {
		begin,
		finalize,
		discard,
		isActive: () => active !== null,
		dispose() {
			const filePath = active?.asset ? null : active?.filePath;
			setActive(null);
			if (filePath) void removeStagedFile(filePath).catch(() => undefined);
		},
	};
}

export function useAudioRecordingAssets(
	controller: ProjectController,
): AudioRecordingAssetsController {
	const assets = useMemo(
		() =>
			createAudioRecordingAssetsController({
				controller,
				getProject: () => controller.snapshot.project,
				api: {
					saveRecordedAudio: (payload) => {
						const save = window.electronAPI?.saveRecordedAudio;
						if (!save) throw new Error("Audio recording storage is unavailable");
						return save(payload);
					},
					discardRecordedAudio: (path) => {
						const discard = window.electronAPI?.discardRecordedAudio;
						if (!discard) throw new Error("Audio recording cleanup is unavailable");
						return discard(path);
					},
				},
				probeMedia: (path, kind) => probeMedia(path, kind),
			}),
		[controller],
	);
	useEffect(() => () => assets.dispose(), [assets]);
	return assets;
}
