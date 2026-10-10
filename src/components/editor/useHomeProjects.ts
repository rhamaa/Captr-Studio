import { useEffect, useRef, useSyncExternalStore } from "react";
import type { ProjectLibraryEntry } from "../../../electron/ipc/types";
interface HomeState {
	entries: ProjectLibraryEntry[];
	loading: boolean;
	error: string | null;
}
export class HomeProjectsController {
	private current: HomeState = { entries: [], loading: false, error: null };
	private revision = 0;
	private listeners = new Set<() => void>();
	constructor(
		private list: () => Promise<{
			success: boolean;
			entries: ProjectLibraryEntry[];
			error?: string;
		}>,
	) {}
	get snapshot() {
		return this.current;
	}
	subscribe = (fn: () => void) => {
		this.listeners.add(fn);
		return () => {
			this.listeners.delete(fn);
		};
	};
	private publish(patch: Partial<HomeState>) {
		this.current = { ...this.current, ...patch };
		this.listeners.forEach((fn) => fn());
	}
	invalidate() {
		this.revision++;
	}
	refresh = async () => {
		const revision = ++this.revision;
		this.publish({ loading: true, error: null });
		try {
			const result = await this.list();
			if (revision !== this.revision) return;
			if (!result.success) throw new Error(result.error ?? "Could not load projects.");
			this.publish({ entries: result.entries, loading: false });
		} catch (error) {
			if (revision === this.revision)
				this.publish({
					loading: false,
					error: error instanceof Error ? error.message : String(error),
				});
		}
	};
}
export function useHomeProjects(enabled: boolean) {
	const ref = useRef<HomeProjectsController>();
	if (!ref.current)
		ref.current = new HomeProjectsController(
			() =>
				window.electronAPI?.listProjectFiles?.() ??
				Promise.resolve({ success: true, entries: [] }),
		);
	const controller = ref.current;
	const state = useSyncExternalStore(
		controller.subscribe,
		() => controller.snapshot,
		() => controller.snapshot,
	);
	useEffect(() => {
		if (enabled) void controller.refresh();
		return () => controller.invalidate();
	}, [controller, enabled]);
	return { ...state, refresh: controller.refresh };
}
