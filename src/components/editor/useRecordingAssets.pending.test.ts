import { expect, it, vi } from "vitest";
import { createTimelineProject } from "@/core/timeline/commands";
const h = vi.hoisted(() => ({
	effects: [] as Array<() => unknown>,
	complete: null as null | ((s: unknown) => void),
	probe: vi.fn(),
}));
vi.mock("react", () => ({
	useRef: (value: unknown) => ({ current: value }),
	useEffect: (fn: () => unknown) => h.effects.push(fn),
}));
vi.mock("@/recording/completedRecording", () => ({
	completedRecordingFromSession: (session: unknown) => h.probe(session),
}));
import { useRecordingAssets } from "./useRecordingAssets";
it("normal bootstrap keeps probe pending balanced and blocks one subsequent completion", async () => {
	let finish!: (v: any) => void;
	h.effects = [];
	h.probe.mockImplementation(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			}),
	);
	const changed = vi.fn();
	let project = createTimelineProject("p", "P");
	vi.stubGlobal("window", {
		electronAPI: {
			getCurrentRecordingSession: async () => ({ success: true, session: null }),
			onRecordingSessionChanged: (fn: any) => {
				h.complete = fn;
				return () => {};
			},
		},
	});
	useRecordingAssets("p", {
		getProject: () => project,
		update: (p) => {
			project = p;
		},
		onError: vi.fn(),
		onPendingChange: changed,
	});
	h.effects.forEach((fn) => fn());
	await vi.waitFor(() => expect(h.complete).toBeTypeOf("function"));
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(changed).not.toHaveBeenCalled();
	h.complete!({ captureId: "take", projectId: "p", videoPath: "screen.mp4" });
	expect(changed).toHaveBeenLastCalledWith(1);
	finish({
		captureId: "take",
		name: "Take",
		durationUs: 1_000_000,
		width: 1,
		height: 1,
		screen: { path: "screen.mp4", durationUs: 1_000_000, offsetUs: 0 },
		settings: {},
	});
	await vi.waitFor(() => expect(changed).toHaveBeenLastCalledWith(0));
	expect(project.assets).toHaveLength(1);
	vi.unstubAllGlobals();
});
