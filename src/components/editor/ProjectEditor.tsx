import {
	ArrowClockwise,
	ArrowCounterClockwise,
	CaretDown,
	FloppyDisk,
	Folder,
	FolderOpen,
	Keyboard,
	Minus,
	Pause,
	Play,
	Plus,
	Square,
	VideoCamera,
	X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import {
	addTextOverlay,
	createTimelineProject,
	placeAsset,
	registerMedia,
	removeAsset,
	updateComposition,
} from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";
import { convertLegacyRecordProject } from "@/core/timeline/legacyConversion";
import { clipDurationUs, type MediaAsset, projectDurationUs } from "@/core/timeline/types";
import { validateTimelineProject } from "@/core/timeline/validation";
import { TimelineProjectExporter } from "@/lib/exporter/timelineProjectExporter";
import { RecordingCompositionEditor } from "@/recording/editor/RecordingCompositionEditor";
import { probeLegacyRecordProject } from "@/recording/legacyProbe";
import { probeMedia } from "@/recording/mediaProbe";
import { AssetLibrary } from "./AssetLibrary";
import { AssetSourcePreview } from "./AssetSourcePreview";
import { ProjectEditorPanel } from "./ProjectEditorPanel";
import { ProjectInspector } from "./ProjectInspector";
import { ProjectPreview } from "./ProjectPreview";
import { ProjectTimeline } from "./ProjectTimeline";
import { ProjectWelcome } from "./ProjectWelcome";
import { timelineActionCommand } from "./timelineInteractions";
import { useProjectController } from "./useProjectController";
import { useProjectMessages } from "./useProjectMessages";
import { useRecordingAssets } from "./useRecordingAssets";
import "./projectEditor.css";
import type { RecordingSessionData } from "../../../electron/ipc/types";
import {
	bindProjectClose,
	type PendingProjectOpen,
	type ProjectOpenResult,
	resolveEditorBootstrap,
} from "./projectLifecycle";

export function ProjectEditor() {
	const m = useProjectMessages();
	const { openConfig } = useShortcuts();
	const initial = useMemo(() => createTimelineProject(crypto.randomUUID(), "New project"), []);
	const { controller, state } = useProjectController(initial);
	const [error, setError] = useState<string | null>(null),
		[busy, setBusy] = useState(false),
		[playing, setPlaying] = useState(false),
		[editingClipId, setEditingClipId] = useState<string | null>(null),
		[legacy, setLegacy] = useState<unknown | null>(null),
		[pendingNew, setPendingNew] = useState(false);
	const [scale, setScale] = useState(65);
	const [snappingEnabled, setSnappingEnabled] = useState(true);
	const playingRef = useRef(playing);
	playingRef.current = playing;
	const [exportProgress, setExportProgress] = useState<number | null>(null);
	const exportAbort = useRef<AbortController | null>(null);
	const [pendingOpen, setPendingOpen] = useState(false);
	const pendingOpenRequest = useRef<PendingProjectOpen | null>(null);
	const bootstrapTask = useRef<ReturnType<typeof resolveEditorBootstrap>>();
	const [restoredRecordingSession, setRestoredRecordingSession] =
		useState<RecordingSessionData | null>(null);
	const modalOpen = useRef(false);
	modalOpen.current = Boolean(
		pendingNew || pendingOpen || legacy || editingClipId || exportProgress !== null,
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
			const result = await new TimelineProjectExporter().export(controller.snapshot.project, {
				outputPath: "",
				fps: controller.snapshot.project.canvas.fps,
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
	const legacyToken = useRef<string | null>(null);
	const releaseLegacy = () => {
		const token = legacyToken.current;
		legacyToken.current = null;
		if (token) void window.electronAPI.releaseLegacyProjectCandidate?.(token);
	};
	const convertProject = async () => {
		setBusy(true);
		const owner = controller.importToken();
		try {
			const prepared = await probeLegacyRecordProject(legacy);
			if (controller.importToken().generation !== owner.generation) return;
			const converted = convertLegacyRecordProject(prepared, {
				projectId: crypto.randomUUID(),
				prefix: crypto.randomUUID(),
			});
			if (!legacyToken.current)
				throw new Error("Open the original project again before converting");
			const result = await window.electronAPI.saveConvertedProjectCopy(
				converted,
				legacyToken.current,
			);
			if (!result.success) {
				if (!result.canceled)
					throw new Error(result.error ?? "Could not save converted copy");
				return;
			}
			const reopened = await window.electronAPI.loadCurrentProjectFile();
			if (!reopened.success)
				throw new Error(
					reopened.error ?? reopened.message ?? "Could not reopen converted copy",
				);
			await install(reopened.project, reopened.path ?? null);
			releaseLegacy();
		} catch (e) {
			errorMessage(e);
		} finally {
			setBusy(false);
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
		},
		state.openingKey,
		restoredRecordingSession,
	);
	const run = (command: ProjectCommand) => {
		try {
			controller.execute(command);
			setError(null);
		} catch (e) {
			errorMessage(e);
		}
	};
	const save = async (saveAs = false) => {
		try {
			const result = await controller.save(saveAs);
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
	const install = async (value: unknown, path: string | null) => {
		const project = validateTimelineProject(value);
		if (path) {
			const fileName = path
				.split(/[\\/]/)
				.pop()
				?.replace(/\.(captr|json)$/i, "")
				?.trim();
			if (
				fileName &&
				(project.title === "New project" ||
					!project.title?.trim() ||
					project.title.toLowerCase() === "new project")
			) {
				project.title = fileName;
			}
		}
		controller.open(project, path);
		setEditingClipId(null);
		setPlaying(false);
		setLegacy(null);
		setError(null);
		await window.electronAPI?.activateTimelineProject?.(project.projectId);
	};
	const acceptOpened = async (result: ProjectOpenResult) => {
		if (!result.success) {
			if (!result.canceled)
				throw new Error(result.error ?? result.message ?? "Could not open project");
			return;
		}
		if ((result.project as { version?: number })?.version === 3)
			await install(result.project, result.path ?? null);
		else {
			releaseLegacy();
			legacyToken.current = result.conversionToken ?? null;
			setLegacy(result.project);
		}
	};
	const open = async (discard = false, request?: PendingProjectOpen) => {
		if (request) pendingOpenRequest.current = request;
		if (controller.snapshot.dirty && !discard) {
			setPendingOpen(true);
			return;
		}
		setPendingOpen(false);
		try {
			const queued = pendingOpenRequest.current;
			pendingOpenRequest.current = null;
			await acceptOpened(
				queued?.result ??
					(queued?.path
						? await window.electronAPI.openProjectFileAtPath(queued.path)
						: await window.electronAPI.loadProjectFile()),
			);
		} catch (e) {
			errorMessage(e);
		}
	};
	const newProject = async () => {
		if (controller.snapshot.dirty && !pendingNew) {
			setPendingNew(true);
			return;
		}
		setPendingNew(false);
		const next = createTimelineProject(crypto.randomUUID(), "New project");
		await window.electronAPI?.activateTimelineProject?.(next.projectId, true);
		await install(next, null);
	};
	const importMedia = async (paths?: string[]) => {
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
		const project = controller.snapshot.project,
			asset = project.assets.find((a) => a.id === id);
		if (!asset) return;
		const track = project.tracks.find(
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
			controller.execute(
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
		let active = true;
		void window.electronAPI?.setWindowMode?.("editor");
		if (window.electronAPI) {
			bootstrapTask.current ??= resolveEditorBootstrap(window.electronAPI);
			void bootstrapTask.current
				.then(async ({ result, recordingProjectId, recordingSession, resetPath }) => {
					if (!active) return;
					setRestoredRecordingSession(recordingSession ?? null);
					if (result) await acceptOpened(result);
					else if (recordingProjectId)
						await install(
							createTimelineProject(recordingProjectId, "New project"),
							null,
						);
					else
						await window.electronAPI.activateTimelineProject?.(
							initial.projectId,
							resetPath,
						);
				})
				.catch(errorMessage);
		}
		return () => {
			active = false;
		};
	}, []);
	useEffect(() => bindProjectClose(controller, window.electronAPI, errorMessage), [controller]);
	useEffect(() => {
		const keydown = (e: KeyboardEvent) => {
			if (modalOpen.current) return;
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
					const allClipIds = controller.snapshot.project.tracks.flatMap((t) =>
						t.clips.map((c) => c.id),
					);
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
					const proj = controller.snapshot.project;
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
					}
				} else if (key === "ArrowLeft" || key === "ArrowRight") {
					e.preventDefault();
					setPlaying(false);
					controller.preview(null);
					const fps = controller.snapshot.project.canvas.fps || 30;
					const frameUs = Math.round(1_000_000 / fps);
					const stepUs = e.shiftKey ? 1_000_000 : frameUs;
					const dir = key === "ArrowLeft" ? -1 : 1;
					const maxUs = projectDurationUs(controller.snapshot.project);
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
					controller.seek(projectDurationUs(controller.snapshot.project));
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
					const totalUs = projectDurationUs(controller.snapshot.project);
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
			window.electronAPI?.onOpenProjectFilePath?.(() => {
				void window.electronAPI
					.consumePendingProjectOpen?.()
					.then((request) => {
						if (request) void open(false, request);
					})
					.catch(errorMessage);
			}),
			window.electronAPI?.onMenuSaveProject?.(() => void save()),
			window.electronAPI?.onMenuSaveProjectAs?.(() => void save(true)),
			window.electronAPI?.onMenuLoadProject?.(() => void open()),
		];
		return () => {
			window.removeEventListener("keydown", keydown);
			unsub.forEach((u) => u?.());
		};
	}, [controller]);
	useEffect(() => {
		if (!playing) return;
		const started = performance.now(),
			base = controller.snapshot.playheadUs;
		let frame = 0;
		const tick = (now: number) => {
			const next = base + Math.round((now - started) * 1000);
			if (next >= projectDurationUs(controller.snapshot.project)) {
				controller.seek(projectDurationUs(controller.snapshot.project));
				setPlaying(false);
				return;
			}
			controller.seek(next);
			frame = requestAnimationFrame(tick);
		};
		frame = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frame);
	}, [playing]);
	const editedClip = state.project.tracks
			.flatMap((t) => t.clips)
			.find((c) => c.id === editingClipId),
		composition = state.project.compositions.find((c) => c.id === editedClip?.compositionId),
		pkg = state.project.packages.find((p) => p.id === composition?.packageId);
	const sourceAsset = state.project.assets.find((a) => a.id === state.selectedAssetId),
		sourcePath =
			sourceAsset?.source?.path ??
			state.project.packages.find((p) => p.id === sourceAsset?.packageId)?.screen.path;
	return (
		<main className="project-editor dark">
			<header className="project-header">
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
				<input
					className="project-title"
					aria-label="Project name"
					value={state.project.title}
					onChange={(e) =>
						run((p) => ({
							...p,
							title: e.target.value,
							updatedAt: new Date().toISOString(),
						}))
					}
				/>
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
					disabled={!projectDurationUs(state.project) || exportProgress !== null}
					onClick={() => void exportProject()}
				>
					Export
				</button>
				{exportProgress !== null && (
					<button onClick={() => exportAbort.current?.abort()}>
						Cancel {Math.round(exportProgress)}%
					</button>
				)}
				<button className="project-record-button" onClick={() => void startRecord()}>
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
							onChange={(next) =>
								controller.execute((p) =>
									updateComposition(p, composition.id, next),
								)
							}
							onClose={() => setEditingClipId(null)}
						/>
					) : null
				}
			>
				<>
					<div className="project-workspace">
						<aside className="project-tool-rail">
							<button aria-label="Assets" aria-current="page">
								<Folder size={21} />
							</button>
						</aside>
						<AssetLibrary
							assets={state.project.assets}
							packages={state.project.packages}
							selectedAssetId={state.selectedAssetId}
							onImport={(paths) => void importMedia(paths)}
							onRecord={() => void startRecord()}
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
									{state.project.canvas.width} × {state.project.canvas.height}
								</span>
								{sourceAsset && (
									<button onClick={() => controller.preview(null)}>
										{m("backTimeline")}
									</button>
								)}
							</header>
							<div className="project-preview-stage">
								{sourceAsset ? (
									<AssetSourcePreview
										key={sourceAsset.id}
										asset={sourceAsset}
										path={sourcePath ?? ""}
										onError={setError}
									/>
								) : projectDurationUs(state.project) > 0 ? (
									<ProjectPreview
										key={state.openingKey}
										project={state.project}
										timeUs={Math.min(
											state.playheadUs,
											Math.max(0, projectDurationUs(state.project) - 1),
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
									disabled={!projectDurationUs(state.project)}
									onClick={() => {
										controller.preview(null);
										if (state.playheadUs >= projectDurationUs(state.project))
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
									{(projectDurationUs(state.project) / 1_000_000).toFixed(2)}
								</span>
							</div>
						</section>
						<ProjectInspector
							project={state.project}
							selection={state.selection}
							playheadUs={state.playheadUs}
							onCommand={run}
							onOpenRecording={setEditingClipId}
						/>
					</div>
					<ProjectTimeline
						project={state.project}
						selection={state.selection}
						playheadUs={state.playheadUs}
						onCommand={run}
						onSelect={(ids) => controller.select(ids)}
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
			{Boolean(legacy) && (
				<div className="project-dialog-backdrop">
					<section
						role="dialog"
						aria-modal="true"
						aria-label="Convert legacy project"
						className="project-dialog"
					>
						<h2>Convert a Record project</h2>
						<p>
							This project uses an earlier format. Create an editable copy in the new
							Assets format.
						</p>
						<div>
							<button
								onClick={() => {
									releaseLegacy();
									setLegacy(null);
								}}
							>
								Cancel
							</button>
							<button
								className="primary"
								disabled={busy}
								onClick={() => void convertProject()}
							>
								Convert and save a copy
							</button>
						</div>
					</section>
				</div>
			)}
			{pendingNew && (
				<div className="project-dialog-backdrop">
					<section
						role="dialog"
						aria-modal="true"
						aria-label="Unsaved project"
						className="project-dialog"
					>
						<h2>Unsaved changes</h2>
						<p>Save your project before starting a new one?</p>
						<div>
							<button onClick={() => setPendingNew(false)}>Cancel</button>
							<button onClick={() => void newProject()}>Discard and start new</button>
							<button
								className="primary"
								onClick={() =>
									void save().then(() => {
										if (!controller.snapshot.dirty) void newProject();
									})
								}
							>
								Save and start new
							</button>
						</div>
					</section>
				</div>
			)}
			{pendingOpen && (
				<div className="project-dialog-backdrop">
					<section
						role="dialog"
						aria-modal="true"
						aria-label="Unsaved project"
						className="project-dialog"
					>
						<h2>Unsaved changes</h2>
						<p>Save your project before opening another?</p>
						<div>
							<button
								onClick={() => {
									const token =
										pendingOpenRequest.current?.result?.conversionToken;
									if (token)
										void window.electronAPI.releaseLegacyProjectCandidate(
											token,
										);
									pendingOpenRequest.current = null;
									setPendingOpen(false);
								}}
							>
								Cancel
							</button>
							<button onClick={() => void open(true)}>Discard and open</button>
							<button
								className="primary"
								onClick={() =>
									void save().then(() => {
										if (!controller.snapshot.dirty) void open(true);
									})
								}
							>
								Save and open
							</button>
						</div>
					</section>
				</div>
			)}
			<Toaster />
		</main>
	);
}
