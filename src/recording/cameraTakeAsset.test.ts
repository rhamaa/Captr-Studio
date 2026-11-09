import { describe, expect, it, vi } from "vitest";
import { createTimelineProject, registerMedia } from "@/core/timeline/commands";
import { validateTimelineProject } from "@/core/timeline/validation";
import { cameraTakeAsset, nextMonologName } from "./cameraTakeAsset";

const probe = (durationUs = 4_000_000, width = 1280, height = 720) =>
	vi.fn(async () => ({ durationUs, width, height, url: "media://x" }));

describe("cameraTakeAsset", () => {
	it("builds a plain video asset that points at the stored take", async () => {
		const probeMedia = probe();
		const asset = await cameraTakeAsset(
			{ id: "a", videoPath: "C:/rec/monologs/m.webm", name: "Monolog 1" },
			{ probeMedia },
		);
		expect(probeMedia).toHaveBeenCalledWith("C:/rec/monologs/m.webm", "video");
		expect(asset).toEqual({
			id: "a",
			kind: "video",
			name: "Monolog 1",
			durationUs: 4_000_000,
			width: 1280,
			height: 720,
			source: { path: "C:/rec/monologs/m.webm", durationUs: 4_000_000, offsetUs: 0 },
		});
	});

	it("rejects a take without video frames", async () => {
		await expect(
			cameraTakeAsset(
				{ id: "a", videoPath: "v.webm", name: "M" },
				{ probeMedia: probe(4_000_000, 0, 0) },
			),
		).rejects.toThrow(/camera/i);
	});

	it("registers as a global asset that validates", async () => {
		const asset = await cameraTakeAsset(
			{ id: "a", videoPath: "C:/rec/m.webm", name: "M" },
			{ probeMedia: probe() },
		);
		const project = registerMedia(createTimelineProject("p", "P"), asset);
		expect(() => validateTimelineProject(project)).not.toThrow();
		expect(project.assets).toHaveLength(1);
		expect(project.packages).toEqual([]);
	});
});

describe("nextMonologName", () => {
	const names = (...list: string[]) => list.map((name) => ({ name }));
	it("starts at 1", () => {
		expect(nextMonologName([], "Monolog")).toBe("Monolog 1");
	});
	it("continues after the highest number and ignores other names", () => {
		expect(
			nextMonologName(
				names("Monolog 1", "Monolog 4", "Intro", "Monolog x", "Monolog 2b"),
				"Monolog",
			),
		).toBe("Monolog 5");
	});
	it("uses the localized prefix", () => {
		expect(nextMonologName(names("Monólogo 2"), "Monólogo")).toBe("Monólogo 3");
	});
});
