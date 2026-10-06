import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
	CaptrInspectorModal,
	formatBytes,
} from "./CaptrInspectorModal";

describe("CaptrInspectorModal", () => {
	it("formats byte values cleanly", () => {
		expect(formatBytes(0)).toBe("0 B");
		expect(formatBytes(1024)).toBe("1 KB");
		expect(formatBytes(1024 * 1024 * 5.5)).toBe("5.5 MB");
		expect(formatBytes(1024 * 1024 * 1024 * 2.1)).toBe("2.1 GB");
	});

	it("renders empty state when no file is inspected", () => {
		const html = renderToStaticMarkup(
			createElement(CaptrInspectorModal, {
				open: true,
				onClose: () => {},
				recentProjects: [
					{
						name: "Demo Video",
						path: "D:/Videos/demo.captr",
						updatedAt: Date.now(),
					},
				],
			}),
		);

		expect(html).toContain("Captr Package Inspector");
		expect(html).toContain("Pilih File Proyek .captr");
		expect(html).toContain("Demo Video");
	});

	it("returns null when open is false", () => {
		const html = renderToStaticMarkup(
			createElement(CaptrInspectorModal, {
				open: false,
				onClose: () => {},
			}),
		);

		expect(html).toBe("");
	});
});
