import { describe, expect, it, vi } from "vitest";
import { createTimelineProject, registerRecording } from "@/core/timeline/commands";
import { validateTimelineProject } from "@/core/timeline/validation";
import { completedRecordingFromCamera, nextMonologName } from "./completedCameraRecording";

const probe = (durationUs = 4_000_000, width = 1280, height = 720) =>
	vi.fn(async () => ({ durationUs, width, height, url: "media://x" }));

describe("completedRecordingFromCamera", () => {
	it("stores the camera file as the screen stream and embedded mic as microphone", async () => {
		const probeMedia = probe();
		const result = await completedRecordingFromCamera(
			{
				videoPath: "C:/rec/monolog.webm",
				captureId: "cap",
				name: "Monolog 1",
				hasAudio: true,
			},
			{ probeMedia },
		);
		expect(probeMedia).toHaveBeenCalledWith("C:/rec/monolog.webm", "video");
		expect(result).toMatchObject({
			captureId: "cap",
			name: "Monolog 1",
			captureSource: "camera",
			durationUs: 4_000_000,
			width: 1280,
			height: 720,
			screen: { path: "C:/rec/monolog.webm", durationUs: 4_000_000, offsetUs: 0 },
			microphone: { path: "C:/rec/monolog.webm", durationUs: 4_000_000, offsetUs: 0 },
		});
		expect(result.webcam).toBeUndefined();
		expect(result.system).toBeUndefined();
		expect(result.cursorPath).toBeUndefined();
		expect(result.settings.showCursor).toBe(false);
		expect(result.settings.zoomRegions).toEqual([]);
		expect(result.settings.webcam?.enabled).toBe(false);
	});

	it("omits the microphone when the take has no audio", async () => {
		const result = await completedRecordingFromCamera(
			{ videoPath: "v.webm", captureId: "cap", name: "M", hasAudio: false },
			{ probeMedia: probe() },
		);
		expect(result.microphone).toBeUndefined();
	});

	it("rejects a take without video dimensions", async () => {
		await expect(
			completedRecordingFromCamera(
				{ videoPath: "v.webm", captureId: "cap", name: "M", hasAudio: true },
				{ probeMedia: probe(4_000_000, 0, 0) },
			),
		).rejects.toThrow(/camera/i);
	});

	it("requires a capture id", async () => {
		await expect(
			completedRecordingFromCamera(
				{ videoPath: "v.webm", captureId: "", name: "M", hasAudio: true },
				{ probeMedia: probe() },
			),
		).rejects.toThrow(/capture/i);
	});

	it("produces a package that validates after registration", async () => {
		const result = await completedRecordingFromCamera(
			{ videoPath: "C:/rec/m.webm", captureId: "cap", name: "M", hasAudio: true },
			{ probeMedia: probe() },
		);
		const project = registerRecording(createTimelineProject("p", "P"), result, {
			assetId: "a",
			packageId: "r",
		});
		expect(() => validateTimelineProject(project)).not.toThrow();
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
