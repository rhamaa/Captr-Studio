import { expect, it, vi } from "vitest";
import { createTimelineProject, placeAsset, registerMedia } from "@/core/timeline/commands";
import { evaluateProject } from "@/core/timeline/evaluation";
import type { TimelineProject } from "@/core/timeline/types";
import { TimelineProjectExporter } from "./timelineProjectExporter";

function project() {
	const p = registerMedia(createTimelineProject("p", "P"), {
		id: "a",
		kind: "image",
		name: "Image",
		durationUs: 1_000_000,
		width: 2,
		height: 2,
		source: { path: "source.png", durationUs: 1_000_000, offsetUs: 0 },
	});
	return placeAsset(p, "a", "visual-1", 0, { clipId: "c" });
}

function transitionProject(): TimelineProject {
	const base = createTimelineProject("transition", "Transition");
	let value = registerMedia(base, {
		id: "a", kind: "video", name: "Outgoing", durationUs: 2_000_000, width: 2, height: 2,
		source: { path: "outgoing.mp4", durationUs: 4_000_000, offsetUs: 0 },
	});
	value = registerMedia(value, {
		id: "b", kind: "video", name: "Incoming", durationUs: 2_000_000, width: 2, height: 2,
		source: { path: "incoming.mp4", durationUs: 4_000_000, offsetUs: 0 },
	});
	value = placeAsset(value, "a", "visual-1", 0, { clipId: "from" });
	value = placeAsset(value, "b", "visual-1", 2_000_000, { clipId: "to" });
	value.tracks[0]!.clips[0]!.sourceOutUs = 1_800_000;
	value.tracks[0]!.clips[1]!.startUs = 1_800_000;
	value.tracks[0]!.clips[1]!.sourceInUs = 200_000;
	value.clipTransitions = [{
		id: "transition", trackId: "visual-1", fromClipId: "from", toClipId: "to",
		preset: { kind: "cross-dissolve" }, durationUs: 400_000, easing: "linear",
	}];
	return value;
}

function pixelCanvas(evaluation: any) {
	const transition = evaluation.visualTransitions[0];
	const animation = evaluation.componentAnimations[0]?.enter;
	const data = new Uint8ClampedArray(16);
	data[0] = Math.round((1 - (transition?.progress ?? 0)) * 255);
	data[1] = Math.round((transition?.progress ?? 0) * 255);
	data[2] = Math.round((animation?.progress ?? 0) * 255);
	data[3] = 255;
	return { getContext: () => ({ getImageData: () => ({ data }) }) };
}

function successfulExportApi(writes: number[][]) {
	return {
		nativeVideoExportStart: async () => ({ success: true, sessionId: "session" }),
		nativeVideoExportWriteFrame: async (_session: string, bytes: Uint8Array) => {
			writes.push(Array.from(bytes));
			return { success: true };
		},
		nativeVideoExportFinish: async () => ({ success: true, tempPath: "temporary.mp4" }),
		nativeVideoExportCancel: vi.fn(),
		discardExportedTemp: vi.fn(),
		finalizeExportedVideo: async () => ({ success: true, path: "out.mp4" }),
	} as any;
}
it("samples exactly the shared evaluation and cleans temporary output on cancellation", async () => {
	const signal = new AbortController(),
		render = vi.fn(async (e: any) => {
			if (e.timeUs >= 100_000) signal.abort();
			return {
				getContext: () => ({ getImageData: () => ({ data: new Uint8ClampedArray(16) }) }),
			};
		}),
		cancel = vi.fn(),
		discard = vi.fn();
	const exporter = new TimelineProjectExporter({
		renderer: () => ({ render, destroy: vi.fn() }),
		audio: async () => null,
		api: {
			nativeVideoExportStart: async () => ({ success: true, sessionId: "session" }),
			nativeVideoExportWriteFrame: async () => ({ success: true }),
			nativeVideoExportFinish: vi.fn(),
			nativeVideoExportCancel: cancel,
			discardExportedTemp: discard,
			finalizeExportedVideo: vi.fn(),
		} as any,
	});
	const p = project(),
		before = JSON.stringify(p);
	const result = await exporter.export(p, {
		outputPath: "out.mp4",
		fps: 10,
		signal: signal.signal,
	});
	expect(result.success).toBe(false);
	expect(cancel).toHaveBeenCalledWith("session");
	expect(render.mock.calls[0][0].visuals[0]).toMatchObject({ path: "source.png", sourceUs: 0 });
	expect(JSON.stringify(p)).toBe(before);
});
it("rejects empty timeline before encoder start and refuses successful empty frames", async () => {
	const start = vi.fn(),
		exporter = new TimelineProjectExporter({ api: { nativeVideoExportStart: start } as any });
	expect(
		(await exporter.export(createTimelineProject("p", "P"), { outputPath: "out.mp4", fps: 30 }))
			.success,
	).toBe(false);
	expect(start).not.toHaveBeenCalled();
});
it("treats cancellation of the save dialog as cancellation and removes temporary output", async () => {
	const discard = vi.fn(async () => ({ success: true }));
	const exporter = new TimelineProjectExporter({
		renderer: () => ({
			render: async () =>
				({
					getContext: () => ({
						getImageData: () => ({ data: new Uint8ClampedArray(16) }),
					}),
				}) as any,
			destroy: vi.fn(),
		}),
		audio: async () => null,
		api: {
			nativeVideoExportStart: async () => ({ success: true, sessionId: "session" }),
			nativeVideoExportWriteFrame: async () => ({ success: true }),
			nativeVideoExportFinish: async () => ({ success: true, tempPath: "temporary.mp4" }),
			nativeVideoExportCancel: vi.fn(),
			discardExportedTemp: discard,
			finalizeExportedVideo: async () => ({ success: false, canceled: true }),
		} as any,
	});
	const result = await exporter.export(project(), { outputPath: "", fps: 1 });
	expect(result.canceled).toBe(true);
	expect(discard).toHaveBeenCalledWith("temporary.mp4");
});

it("timelineProjectExporter matches preview at transition start, midpoint, and just before its end", async () => {
	const value = transitionProject();
	const writes: number[][] = [];
	const render = vi.fn(async (evaluation: any) => pixelCanvas(evaluation));
	const exporter = new TimelineProjectExporter({
		renderer: () => ({ render, destroy: vi.fn() }),
		audio: async () => null,
		api: successfulExportApi(writes),
	});
	const result = await exporter.export(value, { outputPath: "out.mp4", fps: 30 });
	expect(result.success).toBe(true);
	const samples = [48, 54, 59];
	for (const frame of samples) {
		const timeUs = Math.round((frame * 1_000_000) / 30);
		const preview = pixelCanvas(evaluateProject(value, timeUs)).getContext().getImageData().data;
		expect(writes[frame]).toEqual(Array.from(preview));
	}
	const progress = samples.map((frame) => render.mock.calls[frame]![0].visualTransitions[0]?.progress);
	expect(progress[0]).toBe(0);
	expect(progress[1]).toBe(0.5);
	expect(progress[2]).toBeGreaterThan(0.9);
});

it("timelineProjectExporter matches preview for component animation after random seek", async () => {
	const value = project();
	value.tracks[0]!.clips[0]!.componentAnimation = {
		enter: { preset: "fade", durationUs: 1_000_000, easing: "linear" },
	};
	const writes: number[][] = [];
	const render = vi.fn(async (evaluation: any) => pixelCanvas(evaluation));
	const exporter = new TimelineProjectExporter({
		renderer: () => ({ render, destroy: vi.fn() }),
		audio: async () => null,
		api: successfulExportApi(writes),
	});
	const result = await exporter.export(value, { outputPath: "out.mp4", fps: 4 });
	expect(result.success).toBe(true);
	for (const timeUs of [750_000, 250_000]) {
		const frame = Math.round((timeUs * 4) / 1_000_000);
		const preview = pixelCanvas(evaluateProject(value, timeUs)).getContext().getImageData().data;
		expect(writes[frame]).toEqual(Array.from(preview));
	}
	expect(render.mock.calls[3]![0].componentAnimations[0]?.enter?.progress).toBe(0.75);
	expect(render.mock.calls[1]![0].componentAnimations[0]?.enter?.progress).toBe(0.25);
});
