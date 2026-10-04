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
import { useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useShortcuts } from "@/contexts/ShortcutsContext";
import {
	addTextOverlay,
	
	placeAsset,
	registerMedia,
	removeAsset,
	updateComposition,
} from "@/core/timeline/commands";
import type { ProjectCommand } from "@/core/timeline/history";

import { clipDurationUs, type MediaAsset, projectDurationUs } from "@/core/timeline/types";

import { TimelineProjectExporter } from "@/lib/exporter/timelineProjectExporter";
import { RecordingCompositionEditor } from "@/recording/editor/RecordingCompositionEditor";

import { probeMedia } from "@/recording/mediaProbe";
import { AssetLibrary } from "./AssetLibrary";
import { AssetSourcePreview } from "./AssetSourcePreview";
import { ProjectEditorPanel } from "./ProjectEditorPanel";
import { ProjectInspector } from "./ProjectInspector";
import { ProjectPreview } from "./ProjectPreview";
import { ProjectTimeline } from "./ProjectTimeline";
import { ProjectWelcome } from "./ProjectWelcome";
import { timelineActionCommand } from "./timelineInteractions";
import { projectFileName } from "@/core/project/projectNames";
import { type ProjectController, useProjectController } from "./useProjectController";
import { useProjectMessages } from "./useProjectMessages";
import { useRecordingAssets } from "./useRecordingAssets";
import "./projectEditor.css";
import type { RecordingSessionData } from "../../../electron/ipc/types";
import {bindProjectClose} from "./projectLifecycle";
export interface ProjectEditorProps {
 controller:ProjectController;
 recordingSession?:RecordingSessionData|null;
 onRequestHome:()=>void;
 onProjectChanged:()=>void;
 onRequestNew:()=>void;
 onRequestOpen:()=>void;
 onBusyChange?:(busy:boolean)=>void;
}
export function ProjectEditor(props:ProjectEditorProps) {
	const m = useProjectMessages();
	const { openConfig } = useShortcuts();
	const {controller,state}=useProjectController(props.controller);
	const [error, setError] = useState<string | null>(null),
		[busy, setBusy] = useState(false),
		[playing, setPlaying] = useState(false),
		[editingClipId, setEditingClipId] = useState<string | null>(null);
	const [scale, setScale] = useState(65);
	const [snappingEnabled, setSnappingEnabled] = useState(true);
	const playingRef = useRef(playing);
	playingRef.current = playing;
	const [exportProgress, setExportProgress] = useState<number | null>(null);
	const exportAbort = useRef<AbortController | null>(null);
	const [recordingPending,setRecordingPending]=useState(0);
	const modalOpen = useRef(false);
	modalOpen.current = Boolean(
		editingClipId || exportProgress !== null,
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
	const latest = useRef(state);
	latest.current = state;
	const errorMessage = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
	const recording = useRecordingAssets(
		state.project.projectId,
		{
			getProject: () => controller.snapshot.project,
			update: (next) => controller.execute(() => next),
			onError: errorMessage,
			onPendingChange: setRecordingPending,
		},
		state.openingKey,
		props.recordingSession,
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
			if(result.success) props.onProjectChanged();
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
	const open = async () => props.onRequestOpen();
	const newProject = async () => props.onRequestNew();
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
	useEffect(()=>{props.onBusyChange?.(busy || recordingPending>0 || exportProgress!==null || Boolean(state.fileOperation));},[busy,recordingPending,exportProgress,state.fileOperation,props.onBusyChange]);
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
			window.electronAPI?.onMenuSaveProject?.(() => void save()),
			window.electronAPI?.onMenuSaveProjectAs?.(() => void save(true)),
			
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
<button aria-label='Back to Home' disabled={busy || recordingPending>0 || exportProgress!==null || state.saving} onClick={props.onRequestHome}>Home</button>
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
							projectTitle={projectFileName(state.path)}
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
			<Toaster />
		</main>
	);
}
