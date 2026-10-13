import { describe, expect, it } from "vitest";
import { resolveRecordingFrameAppearanceTarget } from "./recordingFrameAppearanceRouting";

describe("resolveRecordingFrameAppearanceTarget", () => {
	it.each([
		["scene", "screen-only", "window"],
		["layout", "screen-only", "window"],
		["layout", "bubble", "webcam"],
		["layout", "webcam-only", "webcam"],
		["scene", "bubble", null],
		["scene", "webcam-only", null],
		["cursor", "screen-only", null],
		["layout", "screen-center", null],
		["layout", "camera-circle", null],
		["layout", null, null],
	] as const)("routes %s/%s to %s", (section, preset, expected) => {
		expect(resolveRecordingFrameAppearanceTarget(section, preset)).toBe(expected);
	});
});
