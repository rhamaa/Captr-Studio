import { expect, it, vi } from "vitest";
import { TimelineProjectExporter } from "./timelineProjectExporter";
import { createTimelineProject, registerMedia, placeAsset } from "@/core/timeline/commands";
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
