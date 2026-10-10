import {
	ArrowClockwise,
	ArrowCounterClockwise,
	ArrowLeft,
	CaretDown,
	FloppyDisk,
	FolderOpen,
	Keyboard,
	Minus,
	Plus,
	Sparkle,
	Square,
	SquaresFour,
	VideoCamera,
	X,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import { projectFileName, projectTitleFromPath } from "@/core/project/projectNames";
import type { AgentDiffSummary } from "@/core/timeline/agentPayload";
import {
	addTextOverlay,
	placeAsset,
	registerMedia,
	removeAsset,
	updateClip,
	updateComposition,
} from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";
import { ensureRepurposeBoard, getArtboardProjectView } from "@/core/timeline/repurposeCommands";
import {
	applyStoryCommand,
	getStoryEditProject,
	type StoryEditContext,
	sameStoryEditContext,
} from "@/core/timeline/storyOwnership";
import type { AssetTranscript } from "@/core/timeline/transcriptTypes";
import {
	clipDurationUs,
	type MediaAsset,
	projectDurationUs,
	type TimelineProject,
} from "@/core/timeline/types";
import { TimelineProjectExporter } from "@/lib/exporter/timelineProjectExporter";
import { RecordingCompositionEditor } from "@/recording/editor/RecordingCompositionEditor";
import { probeMedia } from "@/recording/mediaProbe";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { HyperframeEditor } from "../hyperframe/HyperframeEditor";
import { RepurposeBoardEditor } from "../repurpose/RepurposeBoardEditor";
import type { EditPlan } from "./CopilotSidebar";
import { ProjectEditorPanel } from "./ProjectEditorPanel";
import { ProjectNameDialog } from "./ProjectNameDialog";
import { captureProjectThumbnail } from "./projectThumbnail";
import { StoryEditor } from "./StoryEditor";
import { timelineActionCommand } from "./timelineInteractions";
import { type ProjectController, useProjectController } from "./useProjectController";
import { useProjectMessages } from "./useProjectMessages";
import { useRecordingAssets } from "./useRecordingAssets";
import "./projectEditor.css";
import type { RecordingSessionData } from "../../../electron/ipc/types";
import { AudioRecorderDialog } from "./AudioRecorderDialog";
import { createProjectAudioRecorderNavigation } from "./projectAudioRecorderNavigation";
import { bindProjectClose } from "./projectLifecycle";
import { useAudioRecordingAssets } from "./useAudioRecordingAssets";
export interface ProjectEditorProps {
	controller: ProjectController;
	recordingSession?: RecordingSessionData | null;
	onRequestHome: () => void;
	onProjectChanged: () => void;
	onRequestNew: () => void;
	onRequestOpen: () => void;
	onBusyChange?: (busy: boolean) => void;
	navigationBlocked?: boolean;
	initialArtboardId?: string;
}
export function ProjectEditor(props: ProjectEditorProps) {
	const m = useProjectMessages();
	const { openConfig } = useShortcuts();
	const { controller, state } = useProjectController(props.controller);
	const [error, setError] = useState<string | null>(null),
		[busy, setBusy] = useState(false),
		[playing, setPlaying] = useState(false),
		[editingClipId, setEditingClipId] = useState<string | null>(null),
		[activeArtboardId, setActiveArtboardId] = useState<string | null>(
			props.initialArtboardId ?? null,
		),
		[activeHyperframeId, setActiveHyperframeId] = useState<string | null>(null);

	const activeArtboard = useMemo(() => {
		if (!activeArtboardId) return null;
		const board = ensureRepurposeBoard(state.project).repurposeBoard;
		return board?.artboards.find((a) => a.id === activeArtboardId) ?? null;
	}, [state.project, activeArtboardId]);

	const currentActiveArtboardId = activeArtboard ? activeArtboard.id : null;

	const activeHyperframe = useMemo(() => {
		if (!activeHyperframeId) return null;
		return (state.project.hyperframes ?? []).find((h) => h.id === activeHyperframeId) ?? null;
	}, [state.project, activeHyperframeId]);

	const activeProject = useMemo(() => {
		if (activeArtboardId && !activeArtboard)
			return {
				...state.project,
				tracks: [],
				localAssets: [],
				compositions: [],
				repurposeBoard: undefined,
				stories: undefined,
				storyManifest: undefined,
			};
		return getStoryEditProject(
			state.project,
			activeArtboardId
				? { kind: "artboard", artboardId: activeArtboardId }
				: { kind: "root" },
		);
	}, [state.project, activeArtboardId, activeArtboard]);
	const [scale, setScale] = useState(65);
	const [snappingEnabled, setSnappingEnabled] = useState(true);
	const playingRef = useRef(playing);
	playingRef.current = playing;
	const previewStage = useRef<HTMLDivElement>(null);
	const [exportProgress, setExportProgress] = useState<number | null>(null);
	const exportAbort = useRef<AbortController | null>(null);
	const [recordingPending, setRecordingPending] = useState(0);
	const audioAssets = useAudioRecordingAssets(controller);
	const audioTakeToken = useRef<ReturnType<typeof audioAssets.begin> | null>(null);
	const [audioRecorderOpen, setAudioRecorderOpen] = useState(false);
	const [audioNavigationRequested, setAudioNavigationRequested] = useState(false);
	const [audioStartUs, setAudioStartUs] = useState(0);
	const audioStartUsRef = useRef(0);
	const audioNavigationRequestedRef = useRef(audioNavigationRequested);
	audioNavigationRequestedRef.current = audioNavigationRequested;
	const audioCaptureActive = audioAssets.isActive();
	const audioNavigation = useMemo(
		() =>
			createProjectAudioRecorderNavigation({
				isActive: audioAssets.isActive,
				setChoiceRequested: setAudioNavigationRequested,
				closeRecorder: () => setAudioRecorderOpen(false),
			}),
		[audioAssets],
	);
	const [nameDialog, setNameDialog] = useState(false),
		[draftName, setDraftName] = useState(""),
		[nameError, setNameError] = useState<string | null>(null);
	const [copilotOpen, setCopilotOpen] = useState(false);
	const [speculativeDraft, setSpeculativeDraft] = useState<{
		project: TimelineProject;
		diff: AgentDiffSummary;
		context: StoryEditContext;
	} | null>(null);
	const [editPlan, setEditPlan] = useState<EditPlan | null>(null);
	const [transcripts, setTranscripts] = useState<Record<string, AssetTranscript>>({});
	const scope = useMemo(
		() =>
			activeArtboardId
				? { kind: "artboard" as const, artboardId: activeArtboardId }
				: { kind: "root" as const },
		[activeArtboardId],
	);
	const { projectId, generation } = controller.importToken();
	const editContext = useMemo(
		() => ({ projectId, generation, scope, revision: state.revision }),
		[projectId, generation, scope, state.revision],
	);
	const editContextRef = useRef(editContext);
	editContextRef.current = editContext;
	const currentPlan = controller.currentStoryEditPlan(editPlan, scope);
	useEffect(() => {
		if (editPlan !== currentPlan) setEditPlan(currentPlan);
	}, [editPlan, currentPlan]);

	// Sync project context to local MCP server
	useEffect(() => {
		if (!window.electronAPI?.syncProjectContext) return;
		window.electronAPI.syncProjectContext({
			project: state.project,
			editContext,
			transcripts,
			playheadUs: state.playheadUs,
			selection: state.selection,
			activeArtboardId,
		});
	}, [
		state.project,
		editContext,
		transcripts,
		state.playheadUs,
		state.selection,
		activeArtboardId,
	]);

	// Listen for live MCP speculative edits preview
	useEffect(() => {
		if (!window.electronAPI?.onAgentSpeculativePreview) return;
		const unsub = window.electronAPI.onAgentSpeculativePreview((preview) => {
			if (!preview) setSpeculativeDraft(null);
			else if (sameStoryEditContext(preview.context, editContextRef.current))
				setSpeculativeDraft(preview);
			else setError("This Story edit proposal is stale. Refresh its context and try again.");
		});
		return () => unsub();
	}, []);

	// Listen for live MCP committed edits
	useEffect(() => {
		if (!window.electronAPI?.onAgentCommitEdits) return;
		const unsub = window.electronAPI.onAgentCommitEdits(({ project: toCommit, context }) => {
			if (controller.acceptStoryEdit(context, editContextRef.current.scope, () => toCommit))
				setSpeculativeDraft(null);
			else
				setError(
					"This Story edit proposal is stale or invalid. Refresh its context and try again.",
				);
		});
		return () => unsub();
	}, [controller]);

	// Listen for live MCP edit plan
	useEffect(() => {
		if (!window.electronAPI?.onAgentEditPlan) return;
		const unsub = window.electronAPI.onAgentEditPlan((plan) => {
			if (!plan) setEditPlan(null);
			else {
				const accepted = controller.currentStoryEditPlan(
					plan,
					editContextRef.current.scope,
				);
				if (accepted) setEditPlan(accepted);
			}
		});
		return () => unsub();
	}, [controller]);

	const handleApplyDraft = (modifiedProject: TimelineProject) => {
		if (
			!speculativeDraft ||
			!controller.acceptStoryEdit(speculativeDraft.context, scope, () => modifiedProject)
		) {
			setError(
				"This Story edit proposal is stale or invalid. Refresh its context and try again.",
			);
			return;
		}
		setSpeculativeDraft(null);
		void window.electronAPI?.clearSpeculativeEdits?.();
	};

	const handleDiscardDraft = () => {
		setSpeculativeDraft(null);
		void window.electronAPI?.clearSpeculativeEdits?.();
	};

	useEffect(() => {
		let isCurrent = true;
		const loadTranscript = window.electronAPI?.loadAssetTranscript;
		if (!loadTranscript) return;

		const loadAll = async () => {
			const map: Record<string, AssetTranscript> = {};
			for (const asset of [...activeProject.assets, ...(activeProject.localAssets ?? [])]) {
				const pkg = state.project.packages.find((p) => p.id === asset.packageId);
				const candidatePath = asset.source?.path ?? pkg?.screen.path;
				if (candidatePath) {
					try {
						const t = await loadTranscript(candidatePath);
						if (t && isCurrent) map[asset.id] = t;
					} catch {}
				}
			}
			if (isCurrent) setTranscripts(map);
		};

		void loadAll();
		return () => {
			isCurrent = false;
		};
	}, [activeProject.assets, activeProject.localAssets, state.project.packages]);

	const modalOpen = useRef(false);
	useEffect(() => {
		controller.setThumbnailProvider(() => {
			const project = controller.snapshot.project;
			const visualAsset = project.assets.find(
				(asset) =>
					asset.kind === "recording" || asset.kind === "video" || asset.kind === "image",
			);
			const fallbackMediaPath = visualAsset
				? (visualAsset.source?.path ??
					project.packages.find((pkg) => pkg.id === visualAsset.packageId)?.screen.path)
				: undefined;
			return captureProjectThumbnail(previewStage.current, fallbackMediaPath);
		});
		return () => controller.setThumbnailProvider(null);
	}, [controller]);
	modalOpen.current = Boolean(
		editingClipId ||
			exportProgress !== null ||
			nameDialog ||
			audioRecorderOpen ||
			props.navigationBlocked,
	);
	useEffect(() => {
		if (!editingClipId) return;
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				setEditingClipId(null);
			}
		};
		window.addEventListener("keydown", closeOnEscape);
		return () => window.removeEventListener("keydown", closeOnEscape);
	}, [editingClipId]);
	const exportProject = async () => {
		if (activeArtboardId && !activeArtboard) {
			setError("This Story owner no longer exists");
			return;
		}
		const abort = new AbortController();
		exportAbort.current = abort;
		setPlaying(false);
		setExportProgress(0);
		try {
			const projectToExport = currentActiveArtboardId
				? activeProject
				: controller.snapshot.project;
			const result = await new TimelineProjectExporter().export(projectToExport, {
				outputPath: "",
				fps: projectToExport.canvas.fps,
				signal: abort.signal,
				onProgress: setExportProgress,
			});
			if (!result.success && !result.canceled)
				throw new Error(result.error ?? "Export failed");
		} catch (e) {
			errorMessage(e);
		} finally {
			exportAbort.current = null;
			setExportProgress(null);
		}
	};
	const latest = useRef(state);
	latest.current = state;
	const errorMessage = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
	const recording = useRecordingAssets(
		state.project.projectId,
		{
			getProject: () => controller.snapshot.project,
			update: (next) => controller.execute(() => next),
			onError: errorMessage,
			onPendingChange: (count) => {
				setRecordingPending(count);
				controller.setPendingWork("recording", count);
			},
		},
		state.openingKey,
		props.recordingSession,
	);
	const run = (command: ProjectCommand, selection?: string[]) => {
		try {
			controller.execute((root) => applyStoryCommand(root, scope, command), selection);
			setError(null);
		} catch (e) {
			errorMessage(e);
		}
	};
	const save = async (saveAs = false) => {
		try {
			const result = await controller.save(saveAs);
			if (result.success) props.onProjectChanged();
			if (!result.success && !result.canceled)
				throw new Error(result.error ?? result.message ?? "Could not save project");
			if (result.success)
				await window.electronAPI?.activateTimelineProject?.(
					controller.snapshot.project.projectId,
				);
		} catch (e) {
			errorMessage(e);
		}
	};
	const commitName = async (intent: "save" | "save-as" | "rename") => {
		try {
			const result =
				intent === "rename"
					? await controller.rename(draftName)
					: await controller.save(intent === "save-as", draftName);
			if (result.success) {
				setNameDialog(false);
				props.onProjectChanged();
				if ("warning" in result && result.warning) setError(String(result.warning));
			} else if (!result.canceled)
				setNameError(
					result.error ??
						"Could not change project name. Choose another name or use Save As.",
				);
		} catch (e) {
			setNameError(e instanceof Error ? e.message : String(e));
		}
	};
	useEffect(() => {
		document.title = `${projectFileName(state.path)} — Captr Studio`;
	}, [state.path]);
	const navigate = (action: () => void) =>
		audioNavigation.request(() => {
			props.onBusyChange?.(false);
			action();
		});
	const navigateStory = useCallback((action: () => void) => {
		const current = controller.snapshot;
		if (
			current.navigationPending || current.fileOperation || controller.isExited ||
			busy || recordingPending > 0 || exportProgress !== null || props.navigationBlocked ||
			(current.pendingWork > 0 && !audioAssets.isActive())
		) return;
		audioNavigation.request(action);
	}, [controller, busy, recordingPending, exportProgress, props.navigationBlocked, audioAssets, audioNavigation]);
	const open = async () => navigate(props.onRequestOpen);
	const newProject = async () => navigate(props.onRequestNew);
	const openAudioRecorder = () => {
		setPlaying(false);
		controller.preview(null);
		audioStartUsRef.current = controller.snapshot.playheadUs;
		setAudioStartUs(audioStartUsRef.current);
		setAudioRecorderOpen(true);
	};
	const beginAudioCapture = () => {
		if (!audioTakeToken.current)
			audioTakeToken.current = audioAssets.begin(audioStartUsRef.current,
				activeArtboardId ? { kind: "artboard", artboardId: activeArtboardId } : { kind: "root" });
	};
	const finalizeAudioTake = async (
		take: import("@/recording/audioRecorder").RecordedAudioTake,
	) => {
		const token = audioTakeToken.current;
		if (!token) throw new Error("The originating Story capture context is unavailable");
		const result = await audioAssets.finalize(token, take);
		audioTakeToken.current = null;
		if (!result) return;
		if (!audioNavigationRequestedRef.current) setAudioRecorderOpen(false);
	};
	const discardAudioTake = async () => {
		await audioAssets.discard(audioTakeToken.current);
		audioTakeToken.current = null;
		if (!audioNavigationRequestedRef.current) setAudioRecorderOpen(false);
	};
	const closeAudioRecorder = () => {
		if (audioAssets.isActive()) {
			audioNavigation.request(() => setAudioRecorderOpen(false));
			return;
		}
		setAudioRecorderOpen(false);
	};
	const importMedia = async (paths?: string[]) => {
		controller.setPendingWork("import", 1);
		const token = controller.importToken();
		setBusy(true);
		try {
			const result = await window.electronAPI.importProjectMedia(paths);
			if (!result.success) {
				if (!result.canceled) throw new Error(result.error ?? "Could not import media");
				return;
			}
			const assets = await Promise.all(
				(result.paths ?? []).map(async (path) => {
					const kind = /\.(wav|mp3|m4a|ogg|aac|flac)$/i.test(path)
						? "audio"
						: /\.(png|jpe?g|webp|gif)$/i.test(path)
							? "image"
							: "video";
					const probe = await probeMedia(path, kind);
					return {
						id: crypto.randomUUID(),
						kind,
						name: path.split(/[\\/]/).at(-1) ?? "Media",
						durationUs: probe.durationUs,
						width: probe.width,
						height: probe.height,
						source: { path, durationUs: probe.durationUs, offsetUs: 0 },
					} as MediaAsset;
				}),
			);
			controller.acceptImport(token, (p) =>
				assets.reduce((next, asset) => registerMedia(next, asset), p),
			);
		} catch (e) {
			if (controller.importToken().generation === token.generation) errorMessage(e);
		} finally {
			setBusy(false);
			controller.setPendingWork("import", 0);
		}
	};
	const startRecord = async () => {
		try {
			const context = recording.prepareCapture();
			const result = await window.electronAPI.openRecorderHud({
				...context,
				preserveProjectPath: true,
			});
			if (!result.success) throw new Error("Could not open recorder");
		} catch (e) {
			errorMessage(e);
		}
	};
	const addToTimeline = (id: string) => {
		const targetProject = activeProject,
			asset = state.project.assets.find((a) => a.id === id);
		if (!asset) return;
		const track = targetProject.tracks.find(
			(t) => !t.locked && t.kind === (asset.kind === "audio" ? "audio" : "visual"),
		);
		if (!track) {
			setError("Add an unlocked compatible track first");
			return;
		}
		const startUs = Math.max(
				controller.snapshot.playheadUs,
				...track.clips.map((c) => c.startUs + clipDurationUs(c)),
			),
			clipId = crypto.randomUUID();
		try {
			run(
				(p) =>
					placeAsset(p, id, track.id, startUs, {
						clipId,
						compositionId: crypto.randomUUID(),
					}),
				[clipId],
			);
			controller.preview(null);
		} catch (e) {
			errorMessage(e);
		}
	};
	useEffect(() => {
		props.onBusyChange?.(
			busy ||
				recordingPending > 0 ||
				audioCaptureActive ||
				exportProgress !== null ||
				Boolean(state.fileOperation) ||
				state.navigationPending,
		);
	}, [
		busy,
		recordingPending,
		audioCaptureActive,
		exportProgress,
		state.fileOperation,
		state.navigationPending,
		props.onBusyChange,
	]);
	useEffect(
		() =>
			bindProjectClose(
				controller,
				window.electronAPI,
				errorMessage,
				audioNavigation.beforeClose,
			),
		[controller, audioNavigation, errorMessage],
	);
	useEffect(() => {
		const keydown = (e: KeyboardEvent) => {
			if (
				editingClipId ||
				nameDialog ||
				audioRecorderOpen ||
				props.navigationBlocked ||
				document.querySelector("[role=dialog]")
			)
				return;
			// In Multi-Artboard Hub, let RepurposeBoardEditor handle transport & split keys
			if (!currentActiveArtboardId && !e.ctrlKey && !e.metaKey) return;
			const target = e.target;
			if (
				target instanceof HTMLElement &&
				(target.matches("input,textarea,select,[contenteditable=true]") ||
					target.isContentEditable)
			)
				return;

			if (e.ctrlKey || e.metaKey) {
				const key = e.key.toLowerCase();
				if (key === "s") {
					e.preventDefault();
					void save(e.shiftKey);
				} else if (key === "z") {
					e.preventDefault();
					if (e.shiftKey) controller.redo();
					else controller.undo();
				} else if (key === "y") {
					e.preventDefault();
					controller.redo();
				} else if (key === "o") {
					e.preventDefault();
					void open();
				} else if (key === "n" && !e.shiftKey) {
					e.preventDefault();
					void newProject();
				} else if (key === "e") {
					e.preventDefault();
					const proj = currentActiveArtboardId
						? activeProject
						: controller.snapshot.project;
					if (projectDurationUs(proj) > 0 && exportProgress === null) {
						void exportProject();
					}
				} else if (key === "d") {
					if (controller.snapshot.selection.length > 0) {
						e.preventDefault();
						run(
							timelineActionCommand(
								"duplicate",
								controller.snapshot.selection,
								controller.snapshot.playheadUs,
							),
						);
					}
				} else if (key === "a") {
					e.preventDefault();
					const targetTracks = currentActiveArtboardId
						? activeProject.tracks
						: controller.snapshot.project.tracks;
					const allClipIds = targetTracks.flatMap((t) => t.clips.map((c) => c.id));
					controller.select(allClipIds);
				} else if (key === "b" && !e.shiftKey && !e.altKey) {
					e.preventDefault();
					run(
						timelineActionCommand(
							"split",
							controller.snapshot.selection,
							controller.snapshot.playheadUs,
						),
					);
				} else if (key === "=" || key === "+") {
					e.preventDefault();
					setScale((s) => Math.min(250, s * 1.25));
				} else if (key === "-") {
					e.preventDefault();
					setScale((s) => Math.max(8, s / 1.25));
				} else if (key === "0") {
					e.preventDefault();
					setScale(65);
				} else if (key === "/" || key === "?") {
					e.preventDefault();
					openConfig();
				}
				return;
			}

			if (!e.altKey && !e.ctrlKey && !e.metaKey) {
				const key = e.key;
				if (key === " ") {
					e.preventDefault();
					const proj = currentActiveArtboardId
						? activeProject
						: controller.snapshot.project;
					if (projectDurationUs(proj) > 0) {
						controller.preview(null);
						if (controller.snapshot.playheadUs >= projectDurationUs(proj)) {
							controller.seek(0, projectDurationUs(proj));
						}
						setPlaying((v) => !v);
					}
				} else if (key.toLowerCase() === "n") {
					e.preventDefault();
					setSnappingEnabled((v) => !v);
				} else if (key.toLowerCase() === "s" || key.toLowerCase() === "c") {
					e.preventDefault();
					run(
						timelineActionCommand(
							"split",
							controller.snapshot.selection,
							controller.snapshot.playheadUs,
						),
					);
				} else if (key === "Delete" || key === "Backspace") {
					if (controller.snapshot.selection.length > 0) {
						e.preventDefault();
						if (e.shiftKey) {
							run(
								timelineActionCommand(
									"ripple-delete",
									controller.snapshot.selection,
									controller.snapshot.playheadUs,
								),
							);
						} else {
							run(
								timelineActionCommand(
									"delete",
									controller.snapshot.selection,
									controller.snapshot.playheadUs,
								),
							);
						}
						controller.select([]);
					}
				} else if (key === "Escape") {
					if (controller.snapshot.selection.length > 0) {
						e.preventDefault();
						controller.select([]);
					} else if (playingRef.current) {
						e.preventDefault();
						setPlaying(false);
					} else if (activeHyperframeId) {
						e.preventDefault();
						setActiveHyperframeId(null);
					} else if (currentActiveArtboardId) {
						e.preventDefault();
						navigateStory(() => setActiveArtboardId(null));
					}
				} else if (key === "ArrowLeft" || key === "ArrowRight") {
					e.preventDefault();
					setPlaying(false);
					controller.preview(null);
					const proj = currentActiveArtboardId
						? activeProject
						: controller.snapshot.project;
					const fps = proj.canvas.fps || 30;
					const frameUs = Math.round(1_000_000 / fps);
					const stepUs = e.shiftKey ? 1_000_000 : frameUs;
					const dir = key === "ArrowLeft" ? -1 : 1;
					const maxUs = projectDurationUs(proj);
					const nextUs = Math.max(
						0,
						Math.min(maxUs, controller.snapshot.playheadUs + dir * stepUs),
					);
					controller.seek(nextUs, maxUs);
				} else if (key === "Home") {
					e.preventDefault();
					setPlaying(false);
					controller.preview(null);
					const proj = currentActiveArtboardId
						? activeProject
						: controller.snapshot.project;
					controller.seek(0, projectDurationUs(proj));
				} else if (key === "End") {
					e.preventDefault();
					setPlaying(false);
					controller.preview(null);
					const proj = currentActiveArtboardId
						? activeProject
						: controller.snapshot.project;
					const maxUs = projectDurationUs(proj);
					controller.seek(maxUs, maxUs);
				} else if (key.toLowerCase() === "t" && !e.shiftKey) {
					e.preventDefault();
					const ids = {
						trackId: crypto.randomUUID(),
						clipId: crypto.randomUUID(),
					};
					run((p) => addTextOverlay(p, controller.snapshot.playheadUs, ids));
					controller.select([ids.clipId]);
				} else if (key === "?") {
					e.preventDefault();
					openConfig();
				} else if (key.toLowerCase() === "z" && e.shiftKey && !e.ctrlKey && !e.metaKey) {
					e.preventDefault();
					const totalUs = projectDurationUs(
						currentActiveArtboardId ? activeProject : controller.snapshot.project,
					);
					if (totalUs > 0) {
						const targetScale = Math.max(
							8,
							Math.min(250, (window.innerWidth - 300) / (totalUs / 1_000_000)),
						);
						setScale(targetScale);
					}
				}
			}
		};
		window.addEventListener("keydown", keydown);
		const unsub = [
			window.electronAPI?.onMenuSaveProject?.(() => {
				if (!modalOpen.current) void save();
			}),
			window.electronAPI?.onMenuSaveProjectAs?.(() => {
				if (!modalOpen.current) void save(true);
			}),
		];
		return () => {
			window.removeEventListener("keydown", keydown);
			unsub.forEach((u) => u?.());
		};
	}, [controller, currentActiveArtboardId, activeHyperframeId, activeProject, navigateStory]);
	useEffect(() => {
		if (!playing) return;
		const started = performance.now(),
			base = controller.snapshot.playheadUs;
		let frame = 0;
		const tick = (now: number) => {
			const next = base + Math.round((now - started) * 1000);
			const targetProj = currentActiveArtboardId
				? getArtboardProjectView(controller.snapshot.project, currentActiveArtboardId)
				: controller.snapshot.project;
			const totalUs = projectDurationUs(targetProj);
			if (next >= totalUs) {
				controller.seek(totalUs, totalUs);
				setPlaying(false);
				return;
			}
			controller.seek(next, totalUs);
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [playing, currentActiveArtboardId]);
	const editedClip =
			(activeProject.tracks ?? state.project.tracks)
				.flatMap((t) => t.clips)
				.find((c) => c.id === editingClipId) ??
			state.project.tracks.flatMap((t) => t.clips).find((c) => c.id === editingClipId),
		composition =
			(activeProject.compositions ?? state.project.compositions).find(
				(c) => c.id === editedClip?.compositionId,
			) ?? state.project.compositions.find((c) => c.id === editedClip?.compositionId),
		pkg = state.project.packages.find((p) => p.id === composition?.packageId);
	return (
		<main
			className="project-editor dark"
			data-navigation-blocked={
				state.navigationPending || props.navigationBlocked || undefined
			}
		>
			<header className="project-header">
				{currentActiveArtboardId ? (
					<button
						type="button"
						className="project-back-artboards-button"
						aria-label="Back to Artboards Hub"
						title="Back to Multi-Artboard Hub (Esc)"
						onClick={() => navigateStory(() => {
							setPlaying(false);
							setActiveArtboardId(null);
						})}
					>
						<ArrowLeft size={14} weight="bold" />
						<span>Artboards</span>
						<kbd className="project-kbd">Esc</kbd>
					</button>
				) : activeHyperframe ? (
					<button
						type="button"
						className="project-back-artboards-button"
						aria-label="Back to Stories Hub"
						title="Back to Stories Hub (Esc)"
						onClick={() => {
							setPlaying(false);
							setActiveHyperframeId(null);
						}}
					>
						<ArrowLeft size={14} weight="bold" />
						<span>Stories</span>
						<kbd className="project-kbd">Esc</kbd>
					</button>
				) : (
					<button
						aria-label="Back to Home"
						disabled={
							busy || recordingPending > 0 || exportProgress !== null || state.saving
						}
						onClick={() => navigate(props.onRequestHome)}
					>
						Home
					</button>
				)}
				<div className="project-brand" aria-label="Captr Studio">
					<VideoCamera size={22} weight="duotone" />
				</div>
				<details className="project-file-menu">
					<summary>
						{m("file")}
						<CaretDown size={12} />
					</summary>
					<div>
						<button onClick={() => void newProject()}>
							<Plus size={16} />
							{m("newProject")}
						</button>
						<button onClick={() => void open()}>
							<FolderOpen size={16} />
							{m("openProject")}
						</button>
						<button onClick={() => void save()}>
							<FloppyDisk size={16} />
							{m("save")}
							<span>Ctrl+S</span>
						</button>
						<button onClick={() => void save(true)}>{m("saveAs")}</button>
					</div>
				</details>
				<span className="project-toolbar-separator" />
				<button
					aria-label="Undo"
					title="Undo (Ctrl+Z)"
					disabled={!state.canUndo}
					onClick={() => controller.undo()}
				>
					<ArrowCounterClockwise size={17} />
				</button>
				<button
					aria-label="Redo"
					title="Redo (Ctrl+Shift+Z)"
					disabled={!state.canRedo}
					onClick={() => controller.redo()}
				>
					<ArrowClockwise size={17} />
				</button>
				<button
					className="project-title"
					aria-label={m("projectName")}
					disabled={
						state.saving ||
						busy ||
						recordingPending > 0 ||
						exportProgress !== null ||
						props.navigationBlocked
					}
					onClick={() => {
						setDraftName(state.path ? projectTitleFromPath(state.path) : "Untitled");
						setNameError(null);
						setNameDialog(true);
					}}
				>
					{projectFileName(state.path)}
				</button>
				{activeArtboard && (
					<span className="project-artboard-tag" title="Active artboard sequence">
						{activeArtboard.name} ({activeArtboard.aspectRatio})
					</span>
				)}
				{activeHyperframe && (
					<span className="project-artboard-tag" title="Active Hyperframe Composition">
						{activeHyperframe.name} ({activeHyperframe.aspectRatio || "16:9"})
					</span>
				)}
				<span className="project-save-status">
					{state.saving
						? m("saving")
						: state.dirty
							? m("unsaved")
							: state.path
								? m("saved")
								: ""}
				</span>
				<button
					className="project-export-button"
					disabled={
						!projectDurationUs(
							currentActiveArtboardId ? activeProject : state.project,
						) || exportProgress !== null
					}
					onClick={() => void exportProject()}
				>
					Export
				</button>
				{exportProgress !== null && (
					<button onClick={() => exportAbort.current?.abort()}>
						Cancel {Math.round(exportProgress)}%
					</button>
				)}
				{currentActiveArtboardId && (
					<button
						type="button"
						className="project-repurpose-button"
						title="Return to Multi-Artboard Hub"
						disabled={
							state.saving ||
							busy ||
							recordingPending > 0 ||
							exportProgress !== null ||
							props.navigationBlocked
						}
						onClick={() => navigateStory(() => {
							setPlaying(false);
							setEditingClipId(null);
							setActiveArtboardId(null);
						})}
					>
						<SquaresFour size={16} weight="bold" />
						Artboards
					</button>
				)}
				<button
					className="project-record-button"
					disabled={
						state.saving || state.navigationPending || busy || recordingPending > 0
					}
					onClick={() => void startRecord()}
				>
					<VideoCamera size={17} />
					{m("record")}
				</button>
				<button
					type="button"
					className={`project-ai-assist-button ${copilotOpen ? "active" : ""}`}
					aria-label="AI Editor Copilot"
					title="Toggle AI Editor Copilot Sidebar (Claude, Antigravity, MCP)"
					disabled={state.saving || state.navigationPending || busy}
					onClick={() => {
						setCopilotOpen((v) => !v);
					}}
				>
					<Sparkle size={15} weight="fill" />
					<span>AI Editor</span>
				</button>
				<button
					aria-label="Save project"
					title="Save project (Ctrl+S)"
					disabled={state.saving}
					onClick={() => void save()}
				>
					<FloppyDisk size={18} />
				</button>
				<button
					aria-label="Keyboard shortcuts"
					title="Keyboard shortcuts (? / Ctrl+/)"
					onClick={() => openConfig()}
				>
					<Keyboard size={18} />
				</button>
				{window.electronAPI && (
					<div className="project-window-controls">
						<button
							aria-label="Minimize window"
							onClick={() => void window.electronAPI.minimizeWindow()}
						>
							<Minus size={17} />
						</button>
						<button
							aria-label="Maximize window"
							onClick={() => void window.electronAPI.maximizeWindow()}
						>
							<Square size={15} />
						</button>
						<button
							aria-label="Close window"
							onClick={() => void window.electronAPI.closeWindow()}
						>
							<X size={17} />
						</button>
					</div>
				)}
			</header>
			{error && (
				<div role="alert" className="project-error">
					<span>{error}</span>
					<button aria-label="Dismiss error" onClick={() => setError(null)}>
						<X size={16} />
					</button>
				</div>
			)}
			<ProjectEditorPanel
				recordingEditor={
					composition && pkg ? (
						<RecordingCompositionEditor
							key={composition.id}
							package={pkg}
							composition={composition}
							projectTitle={projectFileName(state.path)}
							canvas={activeProject.canvas}
							aspectRatio={
								(activeArtboard?.aspectRatio &&
								activeArtboard.aspectRatio !== "custom"
									? (activeArtboard.aspectRatio as AspectRatio)
									: null) ??
								(composition.settings?.aspectRatio as AspectRatio) ??
								(activeProject.canvas.width === 1080 &&
								activeProject.canvas.height === 1920
									? "9:16"
									: activeProject.canvas.width === activeProject.canvas.height
										? "1:1"
										: activeProject.canvas.width === 1080 &&
												activeProject.canvas.height === 1350
											? "4:5"
											: "16:9")
							}
							clipTransform={editedClip?.transform}
							onClipTransformChange={(transform) => {
								if (editingClipId) {
									run((p) => updateClip(p, editingClipId, { transform }));
								}
							}}
							onChange={(next) =>
								run((p) => updateComposition(p, composition.id, next))
							}
							onClose={() => setEditingClipId(null)}
						/>
					) : null
				}
				hyperframeEditor={
					activeHyperframe ? (
						<HyperframeEditor
							hyperframe={activeHyperframe}
							project={state.project}
							projectTitle={projectFileName(state.path)}
							transcripts={transcripts}
							onUpdate={(patch) => {
								controller.execute((prev) => ({
									...prev,
									hyperframes: (prev.hyperframes ?? []).map((h) =>
										h.id === activeHyperframe.id
											? {
													...h,
													...patch,
													updatedAt: new Date().toISOString(),
												}
											: h,
									),
								}));
							}}
							onClose={() => {
								setActiveHyperframeId(null);
							}}
						/>
					) : null
				}
				repurposeEditor={
					!activeArtboardId && !activeHyperframeId ? (
						<RepurposeBoardEditor
							project={state.project}
							projectTitle={projectFileName(state.path)}
							selectedAssetId={state.selectedAssetId}
							transcripts={transcripts}
							onChange={(updater) => {
								try {
									if (
										controller.snapshot.navigationPending ||
										controller.snapshot.fileOperation ||
										controller.isExited
									) {
										return;
									}
									controller.execute(updater);
								} catch (err) {
									if (
										err instanceof Error &&
										err.message === "Finish the file operation before editing."
									) {
										return;
									}
									throw err;
								}
							}}
							onClose={() => navigate(props.onRequestHome)}
							onOpenArtboardEditor={(artboardId) => navigateStory(() => {
								setPlaying(false);
								setEditingClipId(null);
								setActiveArtboardId(artboardId);
								controller.seek(0);
							})}
							onOpenHyperframeEditor={(hyperframeId) => navigateStory(() => {
								setPlaying(false);
								setActiveHyperframeId(hyperframeId);
							})}
							onImport={(paths) => void importMedia(paths)}
							onRecord={() => void startRecord()}
							onRecordAudio={openAudioRecorder}
							onPreviewAsset={(id) => {
								setPlaying(false);
								controller.preview(id);
							}}
							onPlaceAsset={addToTimeline}
							onRemoveAsset={(id) => {
								try {
									controller.execute((p) => removeAsset(p, id));
								} catch (error) {
									errorMessage(error);
								}
							}}
						/>
					) : null
				}
			>
				{activeArtboardId && !activeArtboard ? (
					<div role="alert" className="project-error">
						This Story owner no longer exists
						<button onClick={() => navigateStory(() => setActiveArtboardId(null))}>All Stories</button>
					</div>
				) : (
					<StoryEditor
						storyProject={activeProject}
						rootProject={state.project}
						storyId={activeArtboardId}
						storyName={activeArtboard?.name}
						controller={controller}
						transcripts={transcripts}
						copilotOpen={copilotOpen}
						onCloseCopilot={() => setCopilotOpen(false)}
						speculativeDraft={speculativeDraft}
						editPlan={currentPlan}
						onApplyDraft={handleApplyDraft}
						onDiscardDraft={handleDiscardDraft}
						editContext={editContext}
						onProjectCommand={(command) => {
							try {
								controller.execute(command);
								setError(null);
							} catch (error) {
								errorMessage(error);
							}
						}}
						onDraftReady={(draft) => {
							if (sameStoryEditContext(draft.context, editContextRef.current))
								setSpeculativeDraft(draft);
							else
								setError(
									"This Story edit proposal is stale. Refresh its context and try again.",
								);
						}}
						onBackToBoard={
							currentActiveArtboardId
								? () => navigateStory(() => {
										setPlaying(false);
										setEditingClipId(null);
										setActiveArtboardId(null);
									})
								: undefined
						}
						onImportMedia={(paths) => void importMedia(paths)}
						onStartRecord={() => void startRecord()}
						onOpenAudioRecorder={openAudioRecorder}
						onOpenRecording={(id) => {
							setPlaying(false);
							setEditingClipId(id);
						}}
						playing={playing}
						setPlaying={setPlaying}
						editingClipId={editingClipId}
						setEditingClipId={setEditingClipId}
						onCommand={run}
						onError={setError}
						busy={Boolean(busy)}
						previewStageRef={previewStage}
						scale={scale}
						onScaleChange={setScale}
						snappingEnabled={snappingEnabled}
						onToggleSnapping={() => setSnappingEnabled((v) => !v)}
					/>
				)}
			</ProjectEditorPanel>
			{nameDialog && (
				<ProjectNameDialog
					fileName={projectFileName(state.path)}
					draftName={draftName}
					saved={Boolean(state.path)}
					busy={state.saving}
					error={nameError}
					onDraftChange={(name) => {
						setDraftName(name.replace(/\.captr$/i, ""));
						setNameError(null);
					}}
					onClose={() => setNameDialog(false)}
					onRename={() => void commitName("rename")}
					onSaveAs={() => void commitName("save-as")}
					onSave={() => void commitName("save")}
				/>
			)}
			{audioRecorderOpen && (
				<AudioRecorderDialog
					startUs={audioStartUs}
					navigationRequested={audioNavigationRequested}
					onNavigationRequest={() => setAudioNavigationRequested(true)}
					onPreviewStart={() => {
						beginAudioCapture();
						controller.preview(null);
						controller.seek(
							audioTakeToken.current?.startUs ?? audioStartUs,
							projectDurationUs(activeProject),
						);
						setPlaying(true);
					}}
					onPreviewPause={() => setPlaying(false)}
					onTakeRecorded={finalizeAudioTake}
					onDiscard={discardAudioTake}
					onNavigationChoice={(choice) => audioNavigation.resolve(choice)}
					onRecordingChange={(recording) => {
						if (recording) beginAudioCapture();
					}}
					onClose={closeAudioRecorder}
				/>
			)}
			<Toaster />
		</main>
	);
}
