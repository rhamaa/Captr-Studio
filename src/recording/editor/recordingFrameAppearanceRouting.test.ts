import { describe, expect, it } from "vitest";
import { resolveRecordingFrameAppearanceTarget } from "./recordingFrameAppearanceRouting";

describe("resolveRecordingFrameAppearanceTarget", () => {
	it.each([
		["appearance", "screen-only", "window"],
		["appearance", "bubble", "window"],
		["appearance", "webcam-only", "webcam"],
		["appearance", null, "window"],
		["scene", "screen-only", null],
		["scene", "bubble", null],
		["scene", null, null],
		["layout", "screen-only", null],
		["layout", "bubble", null],
		["layout", "webcam-only", null],
		["layout", null, null],
		["cursor", "screen-only", null],
		["cursor", null, null],
	] as const)("routes %s/%s to %s", (section, preset, expected) => {
		expect(resolveRecordingFrameAppearanceTarget(section, preset)).toBe(expected);
	});
});
