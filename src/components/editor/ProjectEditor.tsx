import { useProjectMessages } from "./useProjectMessages";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	ArrowCounterClockwise,
	ArrowClockwise,
	CaretDown,
	FloppyDisk,
	Folder,
	FolderOpen,
	Minus,
	Plus,
	VideoCamera,
	X,
	Square,
	Play,
	Pause,
} from "@phosphor-icons/react";
import {
	createTimelineProject,
	placeAsset,
	registerMedia,
	removeAsset,
	updateComposition,
} from "@/core/timeline/commands";
import { clipDurationUs, projectDurationUs, type MediaAsset } from "@/core/timeline/types";
import { ProjectPreview } from "./ProjectPreview";
import { TimelineProjectExporter } from "@/lib/exporter/timelineProjectExporter";
import { validateTimelineProject } from "@/core/timeline/validation";
import { probeLegacyRecordProject } from "@/recording/legacyProbe";
import { convertLegacyRecordProject } from "@/core/timeline/legacyConversion";
import type { ProjectCommand } from "@/core/timeline/history";
import { RecordingCompositionEditor } from "@/recording/editor/RecordingCompositionEditor";
import { probeMedia } from "@/recording/mediaProbe";
import { Toaster } from "@/components/ui/sonner";
import { AssetLibrary } from "./AssetLibrary";
import { AssetSourcePreview } from "./AssetSourcePreview";
import { ProjectInspector } from "./ProjectInspector";
import { ProjectTimeline } from "./ProjectTimeline";
import { ProjectWelcome } from "./ProjectWelcome";
import { useProjectController } from "./useProjectController";
import { useRecordingAssets } from "./useRecordingAssets";
import "./projectEditor.css";

export function ProjectEditor() {
	const m = useProjectMessages();
	const initial = useMemo(() => createTimelineProject(crypto.randomUUID(), "New project"), []);
	const { controller, state } = useProjectController(initial);
	const [error, setError] = useState<string | null>(null),
		[busy, setBusy] = useState(false),
		[playing, setPlaying] = useState(false),
		[editingClipId, setEditingClipId] = useState<string | null>(null),
		[legacy, setLegacy] = useState<unknown | null>(null),
		[pendingNew, setPendingNew] = useState(false);
	const [exportProgress, setExportProgress] = useState<number | null>(null);
	const exportAbort = useRef<AbortController | null>(null);
	const [pendingOpen, setPendingOpen] = useState(false);
	const modalOpen = useRef(false);
	modalOpen.current = Boolean(
		pendingNew || pendingOpen || legacy || editingClipId || exportProgress !== null,
	);
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
			const result = await window.electronAPI.saveProjectFile(
				converted,
				`${converted.title} copy`,
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
		controller.open(project, path);
		setEditingClipId(null);
		setPlaying(false);
		setLegacy(null);
		setError(null);
		await window.electronAPI?.activateTimelineProject?.(project.projectId);
	};
	const open = async (discard = false) => {
		if (controller.snapshot.dirty && !discard) {
			setPendingOpen(true);
			return;
		}
		setPendingOpen(false);
		try {
			const result = await window.electronAPI.loadProjectFile();
			if (!result.success) {
				if (!result.canceled) throw new Error(result.message ?? "Could not open project");
				return;
			}
			if ((result.project as { version?: number })?.version === 3)
				await install(result.project, result.path ?? null);
			else {
				releaseLegacy();
				legacyToken.current = result.conversionToken ?? null;
				setLegacy(result.project);
			}
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
		if (window.electronAPI?.loadCurrentProjectFile)
			void window.electronAPI
				.loadCurrentProjectFile()
				.then(async (result) => {
					if (!active) return;
					if (result.success && result.project) {
						if ((result.project as { version?: number }).version === 3)
							await install(result.project, result.path ?? null);
						else setLegacy(result.project);
					} else
						await window.electronAPI.activateTimelineProject?.(initial.projectId, true);
				})
				.catch(errorMessage);
		return () => {
			active = false;
		};
	}, []);
	useEffect(() => {
		const keydown = (e: KeyboardEvent) => {
			if (modalOpen.current) return;
			if (
				(e.target as HTMLElement)?.matches?.("input,textarea,select,[contenteditable=true]")
			)
				return;
			if (e.ctrlKey || e.metaKey) {
				if (e.key.toLowerCase() === "s") {
					e.preventDefault();
					void save(e.shiftKey);
				} else if (e.key.toLowerCase() === "z") {
					e.preventDefault();
					if (e.shiftKey) controller.redo();
					else controller.undo();
				} else if (e.key.toLowerCase() === "y") {
					e.preventDefault();
					controller.redo();
				} else if (e.key.toLowerCase() === "o") {
					e.preventDefault();
					void open();
				}
			}
		};
		window.addEventListener("keydown", keydown);
		const unsub = [
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
		<main className="project-editor">
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
					title="Save project"
					disabled={state.saving}
					onClick={() => void save()}
				>
					<FloppyDisk size={18} />
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
						{sourceAsset && sourcePath ? (
							<AssetSourcePreview
								key={sourceAsset.id}
								asset={sourceAsset}
								path={sourcePath}
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
						<span>{(projectDurationUs(state.project) / 1_000_000).toFixed(2)}</span>
					</div>
				</section>
				<ProjectInspector
					project={state.project}
					selection={state.selection}
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
				onOpenRecording={setEditingClipId}
			/>
			<footer className="project-footer">
				<span>{busy ? "Importing media…" : `${state.project.assets.length} assets`}</span>
				<span>{state.project.canvas.fps} fps</span>
			</footer>
			{composition && pkg && (
				<div className="project-composition-modal">
					<RecordingCompositionEditor
						key={composition.id}
						package={pkg}
						composition={composition}
						onChange={(next) =>
							controller.execute((p) => updateComposition(p, composition.id, next))
						}
						onClose={() => setEditingClipId(null)}
					/>
				</div>
			)}
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
							<button onClick={() => setPendingOpen(false)}>Cancel</button>
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
