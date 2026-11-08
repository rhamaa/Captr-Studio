import { describe, expect, it } from "vitest";
import { createTimelineProject, registerRecording } from "@/core/timeline/commands";
import { validateTimelineProject } from "@/core/timeline/validation";
import { recordingCaptureSource, separateMicrophone } from "./captureSource";
import type { CompletedRecording } from "./types";

const camera: CompletedRecording = {
	captureId: "monolog-1",
	name: "Monolog 1",
	durationUs: 5_000_000,
	width: 1920,
	height: 1080,
	captureSource: "camera",
	screen: { path: "C:/rec/monolog-1.webm", durationUs: 5_000_000, offsetUs: 0 },
	microphone: { path: "C:/rec/monolog-1.webm", durationUs: 5_000_000, offsetUs: 0 },
	settings: {},
};

const register = (input: unknown) =>
	registerRecording(createTimelineProject("p", "P"), input as CompletedRecording, {
		assetId: "a",
		packageId: "r",
	});

describe("recording capture source", () => {
	it("validates a camera package", () => {
		const project = register(camera);
		expect(() => validateTimelineProject(project)).not.toThrow();
		expect(project.packages[0].captureSource).toBe("camera");
	});

	it("keeps packages without the field valid and treats them as screen", () => {
		const { captureSource: _omit, ...legacy } = camera;
		const project = register(legacy);
		expect(() => validateTimelineProject(project)).not.toThrow();
		expect(recordingCaptureSource(project.packages[0])).toBe("screen");
	});

	it("rejects an unknown capture source", () => {
		expect(() =>
			validateTimelineProject(register({ ...camera, captureSource: "phone" })),
		).toThrow(/capture source/i);
	});

	it("rejects cursor telemetry on a camera package", () => {
		expect(() =>
			validateTimelineProject(register({ ...camera, cursorPath: "C:/rec/cursor.json" })),
		).toThrow(/capture source/i);
	});

	it("reads the camera source", () => {
		expect(recordingCaptureSource(register(camera).packages[0])).toBe("camera");
	});

	it("treats an embedded camera mic as part of the screen file", () => {
		expect(separateMicrophone(register(camera).packages[0])).toBeUndefined();
		const mic = { path: "C:/rec/mic.wav", durationUs: 5_000_000, offsetUs: 0 };
		expect(separateMicrophone({ ...register(camera).packages[0], microphone: mic })).toEqual(
			mic,
		);
	});
});
