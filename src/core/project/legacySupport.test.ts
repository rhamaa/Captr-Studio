import { describe, expect, it } from "vitest";
import { assertSupportedLegacyProject, getRetiredSlideIssues } from "./legacySupport";

describe("retired slide compatibility", () => {
	it("accepts Record packages without changing their media metadata", () => {
		const project = { clips: [{ id: "r", slideMode: "record", videoPath: "screen.mp4", cursorTelemetryPath: "cursor.json" }] };
		const before = structuredClone(project);
		expect(getRetiredSlideIssues(project)).toEqual([]);
		expect(() => assertSupportedLegacyProject(project)).not.toThrow();
		expect(project).toEqual(before);
	});
	it("rejects an entire mixed deck with the affected slide identifiers", () => {
		const project = { slides: [{ id: "r", type: "record" }, { id: "v", type: "video" }, { id: "m", type: "motion" }] };
		expect(getRetiredSlideIssues(project)).toEqual([{ id: "v", kind: "video" }, { id: "m", kind: "motion" }]);
		expect(() => assertSupportedLegacyProject(project)).toThrow(/previous version/i);
	});
	it("detects retired V1 modes and implicit uploaded Video clips", () => {
		expect(getRetiredSlideIssues({ clips: [{ id: "v", origin: "uploaded" }, { id: "m", slideMode: "motion" }, { id: "r", origin: "recorded" }] })).toEqual([{ id: "v", kind: "video" }, { id: "m", kind: "motion" }]);
	});
	it("leaves malformed input to the project validator", () => {
		for (const value of [null, undefined, {}, { clips: [null, 42], slides: "invalid" }]) {
			expect(getRetiredSlideIssues(value)).toEqual([]);
		}
	});
});
