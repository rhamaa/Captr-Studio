import React from "react";
import { describe, expect, it } from "vitest";
import { SlideRegistry } from "./registry";
import type { SlideModule } from "./types";

describe("SlideRegistry", () => {
	it("registers and retrieves slide modules", () => {
		const registry = new SlideRegistry();

		const mockRecordModule: SlideModule = {
			type: "record",
			displayName: "Record Slide",
			description: "Screen recorder module",
			icon: () => null,
			WorkspaceComponent: () => null,
			createDefaultMeta: () => ({ wallpaper: "sunset" }),
		};

		registry.register(mockRecordModule);
		expect(registry.has("record")).toBe(true);
		expect(registry.has("video")).toBe(false);

		const retrieved = registry.get("record");
		expect(retrieved.displayName).toBe("Record Slide");
		expect(retrieved.createDefaultMeta()).toEqual({ wallpaper: "sunset" });
	});

	it("throws error when accessing unregistered module", () => {
		const registry = new SlideRegistry();
		expect(() => registry.get("remotion")).toThrow(/No slide module registered/);
	});

	it("lists all registered slide types", () => {
		const registry = new SlideRegistry();

		const mod1: SlideModule = {
			type: "record",
			displayName: "Record",
			description: "",
			icon: () => null,
			WorkspaceComponent: () => null,
			createDefaultMeta: () => ({}),
		};
		const mod2: SlideModule = {
			type: "video",
			displayName: "Video",
			description: "",
			icon: () => null,
			WorkspaceComponent: () => null,
			createDefaultMeta: () => ({}),
		};

		registry.register(mod1);
		registry.register(mod2);

		expect(registry.getRegisteredTypes()).toEqual(["record", "video"]);
		expect(registry.getAll().length).toBe(2);
	});
});
