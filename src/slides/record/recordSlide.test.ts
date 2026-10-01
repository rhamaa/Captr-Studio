import { describe, expect, it } from "vitest";
import { slideRegistry } from "@/core/slides/registry";
import "@/slides"; // auto-registers all slide modules
import { recordSlideModule, RecordingTimeline } from "./index";
import { createDefaultRecordingSettings } from "@/recording/schema";

describe("RecordSlideModule", () => {
	it("is registered in slideRegistry under type 'record'", () => {
		expect(slideRegistry.has("record")).toBe(true);
		const mod = slideRegistry.get("record");
		expect(mod.type).toBe("record");
		expect(mod.displayName).toBe("Record Slide");
		expect(mod.WorkspaceComponent).toBeDefined();
	});

	it("creates default record metadata with expected initial properties", () => {
		const meta = createDefaultRecordingSettings();
		expect(meta.showCursor).toBe(true);
		expect(meta.cursorStyle).toBe("macos");
		expect(meta.zoomRegions).toEqual([]);
		expect(meta.borderRadius).toBe(12.5);
		expect(meta.shadowIntensity).toBe(0.67);
	});

	it("exports recordSlideModule with WorkspaceComponent", () => {
		expect(recordSlideModule.type).toBe("record");
		expect(typeof recordSlideModule.WorkspaceComponent).toBe("function");
	});

	it("exports RecordingTimeline component", () => {
		expect(RecordingTimeline).toBeDefined();
	});
});
