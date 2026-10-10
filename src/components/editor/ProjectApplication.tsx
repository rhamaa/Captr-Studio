import { useCallback, useEffect, useRef, useState } from "react";
import { AppSettingsDialog } from "@/components/settings/AppSettingsDialog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { WelcomeScreen } from "@/components/welcome/WelcomeScreen";
import { createTimelineProject } from "@/core/timeline/commands";
import { convertLegacyRecordProject } from "@/core/timeline/legacyConversion";
import { normalizeStoryOwnership } from "@/core/timeline/normalizeStoryOwnership";
import type { TimelineProject } from "@/core/timeline/types";
import { probeLegacyRecordProject } from "@/recording/legacyProbe";
import type { RecordingSessionData } from "../../../electron/ipc/types";
import { ProjectEditor } from "./ProjectEditor";
import type { PendingProjectOpen, ProjectOpenResult } from "./projectLifecycle";
import {
	projectCanSwitch,
	requestProjectExit,
	resolveApplicationBootstrap,
} from "./projectNavigation";
import { useHomeProjects } from "./useHomeProjects";
import { createProjectController, type ProjectController } from "./useProjectController";

export function ProjectApplication() {
	const [controller, setController] = useState<ProjectController | null>(null);
	const [recordingSession, setRecordingSession] = useState<RecordingSessionData | null>(null);
	const library = useHomeProjects(!controller);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);
	const [settings, setSettings] = useState(false);
	const [pending, setPending] = useState<(() => Promise<void>) | null>(null);
	const [legacy, setLegacy] = useState<ProjectOpenResult | null>(null);
	const active = useRef(controller);
	active.current = controller;
	const rendererBusy = useRef(false),
		operationBusy = useRef(false),
		mounted = useRef(true);
	const bootstrap = useRef<ReturnType<typeof resolveApplicationBootstrap>>();
	const api = window.electronAPI;
	const report = (e: unknown) => setError(e instanceof Error ? e.message : String(e));
	const refresh = library.refresh;
	const onBusyChange = useCallback((value: boolean) => {
		rendererBusy.current = value;
	}, []);
	const install = async (result: ProjectOpenResult, session?: RecordingSessionData) => {
		if (!result.success) {
			if (!result.canceled)
				throw new Error(result.error ?? result.message ?? "Could not open project.");
			return;
		}
		if ((result.project as { version?: number })?.version !== 3) {
			setLegacy(result);
			return;
		}
		const project = normalizeStoryOwnership(result.project as TimelineProject);
		const activated = await api?.activateTimelineProject?.(project.projectId);
		if (activated && !activated.success) throw new Error("Could not activate project.");
		const next = createProjectController(project);
		next.open(project, result.path ?? null);
		active.current?.exit();
		active.current = next;
		setRecordingSession(session ?? null);
		setController(next);
		setError(null);
	};
	const execute = async (action: () => Promise<void>) => {
		if (operationBusy.current) return;
		operationBusy.current = true;
		setBusy(true);
		const owner = active.current;
		const locked = owner?.beginNavigation();
		try {
			if (owner && !locked) throw new Error("Finish pending project work before switching.");
			await action();
		} catch (e) {
			report(e);
		} finally {
			owner?.endNavigation();
			operationBusy.current = false;
			setBusy(false);
		}
	};
	const request = async (action: () => Promise<void>) => {
		if (rendererBusy.current || operationBusy.current) {
			report("Finish the current operation before switching projects.");
			return;
		}
		const c = active.current;
		if (c && !(await projectCanSwitch(c, api ?? {}))) {
			report("Finish recording or saving before switching projects.");
			return;
		}
		if (c?.snapshot.dirty) {
			setPending(() => action);
			return;
		}
		await execute(action);
	};
	const open = async (intent?: PendingProjectOpen) =>
		request(async () => {
			const result =
				intent?.result ??
				(intent?.path
					? await api.openProjectFileAtPath(intent.path)
					: await api?.loadProjectFile?.());
			if (result) await install(result);
		});
	const create = async (aspectRatio = "16:9") =>
		request(async () => {
			const project = createTimelineProject(crypto.randomUUID(), "Untitled");
			const [w, h] = aspectRatio.split(":").map(Number);
			if (w > 0 && h > 0) project.canvas.height = Math.round((project.canvas.width * h) / w);
			const result = await api?.activateTimelineProject?.(project.projectId, true);
			if (result && !result.success) throw new Error("Could not start project.");
			active.current?.exit();
			const next = createProjectController(project);
			active.current = next;
			setController(next);
			setRecordingSession(null);
			setError(null);
		});
	const home = () =>
		request(async () => {
			const c = active.current;
			if (!c) return;
			if (!(await requestProjectExit(c, "discard", api ?? {})))
				throw new Error("Could not leave the active project.");
			active.current = null;
			rendererBusy.current = false;
			setController(null);
			setRecordingSession(null);
			api?.setHasUnsavedChanges?.(false);
			await refresh();
		});
	const decide = async (decision: "save" | "discard" | "cancel") => {
		if (decision === "cancel") {
			setPending(null);
			return;
		}
		const action = pending,
			c = active.current;
		if (!action) return;
		await execute(async () => {
			if (rendererBusy.current || (c && !(await projectCanSwitch(c, api ?? {}))))
				throw new Error("Finish the current operation first.");
			if (decision === "save" && c?.snapshot.dirty) {
				c.endNavigation();
				const saved = await c.save();
				if (!saved.success) {
					if (!saved.canceled) report(saved.error ?? "Could not save project.");
					return;
				}
				if (c.snapshot.dirty) return;
				if (!c.beginNavigation()) return;
			}
			setPending(null);
			await action();
		});
	};
	useEffect(() => {
		mounted.current = true;
		let activeEffect = true;
		void api?.setWindowMode?.("editor");
		bootstrap.current ??= resolveApplicationBootstrap(api ?? {});
		void bootstrap.current
			.then(async (result) => {
				if (!activeEffect) return;
				if (result.kind === "project")
					await install(result.result, result.recordingSession);
				else if (result.kind === "recording") {
					const project = createTimelineProject(result.session.projectId!, "Untitled");
					await install({ success: true, project }, result.session);
				} else if (result.kind === "error") setError(result.error);
				await refresh();
			})
			.catch(report)
			.finally(() => {
				if (mounted.current) setLoading(false);
			});
		return () => {
			activeEffect = false;
			mounted.current = false;
		};
	}, []);
	const handlers = useRef({ open, create });
	handlers.current = { open, create };
	useEffect(() => {
		const release = api?.onOpenProjectFilePath?.(() => {
			void bootstrap.current
				?.then(async () => {
					const intent = await api.consumePendingProjectOpen?.();
					if (intent) await handlers.current.open(intent);
				})
				.catch(report);
		});
		const menu = api?.onMenuLoadProject?.(() => void handlers.current.open());
		const key = (event: KeyboardEvent) => {
			if (
				active.current ||
				pending ||
				legacy ||
				document.querySelector("[role=dialog]") ||
				!(event.ctrlKey || event.metaKey)
			)
				return;
			if (event.key.toLowerCase() === "o") {
				event.preventDefault();
				void handlers.current.open();
			}
			if (event.key.toLowerCase() === "n") {
				event.preventDefault();
				void handlers.current.create();
			}
			if (event.key.toLowerCase() === "s") event.preventDefault();
		};
		window.addEventListener("keydown", key);
		return () => {
			release?.();
			menu?.();
			window.removeEventListener("keydown", key);
		};
	}, [pending, legacy]);
	const convert = () =>
		execute(async () => {
			if (!legacy?.conversionToken)
				throw new Error("Reopen the original project before converting.");
			const prepared = await probeLegacyRecordProject(legacy.project);
			const project = convertLegacyRecordProject(prepared, {
				projectId: crypto.randomUUID(),
				prefix: crypto.randomUUID(),
			});
			const saved = await api.saveConvertedProjectCopy(project, legacy.conversionToken);
			if (!saved.success) {
				if (!saved.canceled)
					throw new Error(saved.error ?? "Could not save converted copy.");
				return;
			}
			await install(await api.loadCurrentProjectFile());
			setLegacy(null);
			await refresh();
		});
	return (
		<>
			{controller ? (
				<ProjectEditor
					key={controller.snapshot.project.projectId}
					controller={controller}
					recordingSession={recordingSession}
					onRequestHome={() => void home()}
					onRequestNew={() => void create()}
					onRequestOpen={() => void open()}
					onProjectChanged={() => void refresh()}
					onBusyChange={onBusyChange}
					navigationBlocked={Boolean(pending || legacy || busy)}
				/>
			) : (
				<WelcomeScreen
					recentProjects={library.entries}
					loading={loading || library.loading}
					error={library.error}
					busy={busy || loading}
					onRefreshProjects={refresh}
					onOpenSettings={() => setSettings(true)}
					onNewProject={(ratio) => void create(ratio)}
					onOpenProjectFile={() => void open()}
					onOpenRecentProject={(path) => void open({ path })}
				/>
			)}
			{error && (
				<div className="application-status" role="alert">
					{error}
					<button onClick={() => setError(null)}>Dismiss</button>
				</div>
			)}
			<AppSettingsDialog
				open={settings}
				onOpenChange={(value) => {
					setSettings(value);
					if (!value) void refresh();
				}}
			/>
			<Dialog
				open={Boolean(pending)}
				onOpenChange={(value) => {
					if (!value && !busy) setPending(null);
				}}
			>
				<DialogContent
					onEscapeKeyDown={(event) => {
						if (busy) event.preventDefault();
					}}
				>
					<DialogTitle>Unsaved changes</DialogTitle>
					<DialogDescription>
						Save your project before leaving this editor?
					</DialogDescription>
					<div className="project-dialog-actions">
						<button disabled={busy} onClick={() => void decide("cancel")}>
							Cancel
						</button>
						<button disabled={busy} onClick={() => void decide("discard")}>
							Discard
						</button>
						<button disabled={busy} onClick={() => void decide("save")}>
							Save
						</button>
					</div>
				</DialogContent>
			</Dialog>
			<Dialog
				open={Boolean(legacy)}
				onOpenChange={(value) => {
					if (!value && !busy) {
						if (legacy?.conversionToken)
							void api.releaseLegacyProjectCandidate(legacy.conversionToken);
						setLegacy(null);
					}
				}}
			>
				<DialogContent>
					<DialogTitle>Convert a Record project</DialogTitle>
					<DialogDescription>
						Create an editable copy in the new Assets format. The original file is
						preserved.
					</DialogDescription>
					<button disabled={busy} onClick={() => void convert()}>
						Convert and save a copy
					</button>
				</DialogContent>
			</Dialog>
		</>
	);
}
