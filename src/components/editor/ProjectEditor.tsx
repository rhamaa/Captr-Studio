import {
	ArrowClockwise,
	ArrowCounterClockwise,
	ArrowLeft,
	CaretDown,
	FloppyDisk,
	FolderOpen,
	Keyboard,
	Minus,
	Pause,
	Play,
	Plus,
	Square,
	SquaresFour,
	VideoCamera,
	X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import { projectFileName, projectTitleFromPath } from "@/core/project/projectNames";
import {
	addTextOverlay,
	placeAsset,
	registerMedia,
	removeAsset,
	updateComposition,
} from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";
import {
	ensureRepurposeBoard,
	getArtboardProjectView,
	updateArtboardProject,
} from "@/core/timeline/repurposeCommands";
import {
	clipDurationUs,
	type MediaAsset,
	projectDurationUs,
	type ShapeDefinition,
} from "@/core/timeline/types";
import { TimelineProjectExporter } from "@/lib/exporter/timelineProjectExporter";
import { RecordingCompositionEditor } from "@/recording/editor/RecordingCompositionEditor";
import { probeMedia } from "@/recording/mediaProbe";
import type { AspectRatio } from "@/utils/aspectRatioUtils";
import { RepurposeBoardEditor } from "../repurpose/RepurposeBoardEditor";
import { AssetLibrary } from "./AssetLibrary";
import { AssetSourcePreview } from "./AssetSourcePreview";
import { ProjectEditorPanel } from "./ProjectEditorPanel";
import { ProjectInspector } from "./ProjectInspector";
import { ProjectNameDialog } from "./ProjectNameDialog";
import { ProjectPreview } from "./ProjectPreview";
import { ProjectTimeline, shapePlacementCommand } from "./ProjectTimeline";
import { ProjectToolRail } from "./ProjectToolRail";
import { ProjectWelcome } from "./ProjectWelcome";
import { captureProjectThumbnail } from "./projectThumbnail";
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
		);

	const activeArtboard = useMemo(() => {
		if (!activeArtboardId) return null;
		const board = ensureRepurposeBoard(state.project).repurposeBoard;
		return board?.artboards.find((a) => a.id === activeArtboardId) ?? null;
	}, [state.project, activeArtboardId]);

	const currentActiveArtboardId = activeArtboard ? activeArtboard.id : null;

	const activeProject = useMemo(() => {
		if (!currentActiveArtboardId) return state.project;
		return getArtboardProjectView(state.project, currentActiveArtboardId);
	}, [state.project, currentActiveArtboardId]);

	const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);
	useEffect(() => {
		if (
			selectedTransitionId &&
			!activeProject.clipTransitions?.some((item) => item.id === selectedTransitionId)
		)
			setSelectedTransitionId(null);
	}, [selectedTransitionId, activeProject.clipTransitions]);
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
			if (currentActiveArtboardId) {
				controller.execute(
					(rootProject) =>
						updateArtboardProject(
							rootProject,
							currentActiveArtboardId,
							(artboardProject) => command(artboardProject),
						),
					selection,
				);
			} else {
				controller.execute(command, selection);
			}
			setError(null);
		} catch (e) {
			errorMessage(e);
		}
	};
	const addShape = (kind: ShapeDefinition["kind"]) => {
		const ids = {
			assetId: crypto.randomUUID(),
			clipId: crypto.randomUUID(),
			trackId: crypto.randomUUID(),
		};
		run(shapePlacementCommand(kind, state.playheadUs, ids), [ids.clipId]);
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
			audioTakeToken.current = audioAssets.begin(audioStartUsRef.current);
	};
	const finalizeAudioTake = async (
		take: import("@/recording/audioRecorder").RecordedAudioTake,
	) => {
		const token = audioTakeToken.current ?? audioAssets.begin(take.startUs);
		audioTakeToken.current = token;
		const result = await audioAssets.finalize(token, take);
		if (!result) return;
		audioTakeToken.current = null;
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
					if (
						projectDurationUs(controller.snapshot.project) > 0 &&
						exportProgress === null
					) {
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
							controller.seek(0);
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
					} else if (currentActiveArtboardId) {
						e.preventDefault();
						setActiveArtboardId(null);
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
					controller.seek(nextUs);
				} else if (key === "Home") {
					e.preventDefault();
					setPlaying(false);
					controller.preview(null);
					controller.seek(0);
				} else if (key === "End") {
					e.preventDefault();
					setPlaying(false);
					controller.preview(null);
					const proj = currentActiveArtboardId
						? activeProject
						: controller.snapshot.project;
					controller.seek(projectDurationUs(proj));
				} else if (key.toLowerCase() === "t" && !e.shiftKey) {
					e.preventDefault();
					const ids = {
						assetId: crypto.randomUUID(),
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
	}, [controller, currentActiveArtboardId, activeProject]);
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
				controller.seek(totalUs);
				setPlaying(false);
				return;
			}
			controller.seek(next);
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
	const sourceAsset = state.project.assets.find((a) => a.id === state.selectedAssetId),
		sourcePath =
			sourceAsset?.source?.path ??
			state.project.packages.find((p) => p.id === sourceAsset?.packageId)?.screen.path;
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
						onClick={() => {
							setPlaying(false);
							setActiveArtboardId(null);
						}}
					>
						<ArrowLeft size={14} weight="bold" />
						<span>Artboards</span>
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
						onClick={() => {
							setPlaying(false);
							setEditingClipId(null);
							setActiveArtboardId(null);
						}}
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
							onChange={(next) =>
								controller.execute((p) =>
									updateComposition(p, composition.id, next),
								)
							}
							onClose={() => setEditingClipId(null)}
						/>
					) : null
				}
				repurposeEditor={
					!currentActiveArtboardId ? (
						<RepurposeBoardEditor
							project={state.project}
							projectTitle={projectFileName(state.path)}
							selectedAssetId={state.selectedAssetId}
							onChange={(updater) => {
								controller.execute(updater);
							}}
							onClose={() => navigate(props.onRequestHome)}
							onOpenArtboardEditor={(artboardId) => {
								setPlaying(false);
								setEditingClipId(null);
								setActiveArtboardId(artboardId);
							}}
							onImport={(paths) => void importMedia(paths)}
							onRecord={() => void startRecord()}
							onRecordAudio={openAudioRecorder}
							onPreviewAsset={(id) => {
								setPlaying(false);
								controller.preview(id);
							}}
							onPlaceAsset={addToTimeline}
							onRemoveAsset={(id) => run((p) => removeAsset(p, id))}
						/>
					) : null
				}
			>
				<>
					<div className="project-workspace">
						<ProjectToolRail onAddShape={addShape} />
						<AssetLibrary
							assets={state.project.assets}
							packages={state.project.packages}
							selectedAssetId={state.selectedAssetId}
							onImport={(paths) => void importMedia(paths)}
							onRecord={() => void startRecord()}
							onRecordAudio={openAudioRecorder}
							onPreview={(id) => {
								setPlaying(false);
								controller.preview(id);
							}}
							onPlace={addToTimeline}
							onRemove={(id) => run((p) => removeAsset(p, id))}
						/>
						<section className="project-preview-panel">
							<header className="project-panel-header">
								<h2>{sourceAsset ? m("sourcePreview") : m("preview")}</h2>
								<span>
									{activeProject.canvas.width} × {activeProject.canvas.height}
								</span>
								{!sourceAsset && currentActiveArtboardId && (
									<button
										type="button"
										className="project-stage-repurpose-btn"
										title="Return to Multi-Artboard Hub"
										onClick={() => {
											setPlaying(false);
											setEditingClipId(null);
											setActiveArtboardId(null);
										}}
									>
										<SquaresFour size={14} weight="bold" />
										All Artboards
									</button>
								)}
								{sourceAsset && (
									<button onClick={() => controller.preview(null)}>
										{m("backTimeline")}
									</button>
								)}
							</header>
							<div className="project-preview-stage" ref={previewStage}>
								{sourceAsset ? (
									<AssetSourcePreview
										key={sourceAsset.id}
										asset={sourceAsset}
										path={sourcePath ?? ""}
										onError={setError}
									/>
								) : projectDurationUs(activeProject) > 0 ? (
									<ProjectPreview
										key={`${state.openingKey}-${currentActiveArtboardId}`}
										project={activeProject}
										timeUs={Math.min(
											state.playheadUs,
											Math.max(0, projectDurationUs(activeProject) - 1),
										)}
										playing={playing && !editingClipId}
										onError={setError}
									/>
								) : (
									<ProjectWelcome
										hasAssets={Boolean(state.project.assets.length)}
										onImport={() => void importMedia()}
										onRecord={() => void startRecord()}
									/>
								)}
							</div>
							<div className="project-preview-transport">
								<span>{(state.playheadUs / 1_000_000).toFixed(2)}</span>
								<button
									aria-label={playing ? "Pause timeline" : "Play timeline"}
									disabled={!projectDurationUs(activeProject)}
									onClick={() => {
										controller.preview(null);
										if (state.playheadUs >= projectDurationUs(activeProject))
											controller.seek(0);
										setPlaying((v) => !v);
									}}
								>
									{playing ? (
										<Pause size={20} weight="fill" />
									) : (
										<Play size={20} weight="fill" />
									)}
								</button>
								<span>
									{(projectDurationUs(activeProject) / 1_000_000).toFixed(2)}
								</span>
							</div>
						</section>
						<ProjectInspector
							project={activeProject}
							selection={state.selection}
							selectedTransitionId={selectedTransitionId}
							playheadUs={state.playheadUs}
							onCommand={run}
							onOpenRecording={setEditingClipId}
						/>
					</div>
					<ProjectTimeline
						project={activeProject}
						selection={state.selection}
						selectedTransitionId={selectedTransitionId}
						playheadUs={state.playheadUs}
						onCommand={run}
						onSelect={(ids) => {
							setSelectedTransitionId(null);
							controller.select(ids);
						}}
						onSelectTransition={(id) => {
							controller.select([]);
							setSelectedTransitionId(id);
						}}
						onSeek={(time) => {
							setPlaying(false);
							controller.preview(null);
							controller.seek(time);
						}}
						onOpenRecording={(id) => {
							setPlaying(false);
							setEditingClipId(id);
						}}
						scale={scale}
						onScaleChange={setScale}
						playing={playing}
						snappingEnabled={snappingEnabled}
						onToggleSnapping={() => setSnappingEnabled((v) => !v)}
					/>
					<footer className="project-footer">
						<span>
							{busy ? "Importing media…" : `${state.project.assets.length} assets`}
						</span>
						<span>{state.project.canvas.fps} fps</span>
					</footer>
				</>
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
						controller.seek(audioTakeToken.current?.startUs ?? audioStartUs);
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
