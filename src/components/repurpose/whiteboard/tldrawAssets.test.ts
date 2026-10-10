import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTldrawOfflineAssetUrls } from "./tldrawAssets";

describe("tldrawAssets", () => {
	it("returns local offline asset URLs without unpkg or remote CDN references", () => {
		const urls = getTldrawOfflineAssetUrls();
		expect(urls).toBeDefined();

		let stringCount = 0;
		const checkRecursive = (obj: unknown) => {
			if (typeof obj === "string") {
				stringCount++;
				expect(obj).not.toContain("unpkg.com");
				expect(obj).not.toContain("cdn.jsdelivr.net");
				expect(obj).not.toContain("file:///");
			} else if (obj && typeof obj === "object") {
				for (const val of Object.values(obj)) {
					checkRecursive(val);
				}
			}
		};

		checkRecursive(urls);
		expect(stringCount).toBeGreaterThan(10);
	});

	it("serves icons referencing standalone individual svg files from /tldraw-assets", () => {
		const urls = getTldrawOfflineAssetUrls();
		expect(urls.icons).toBeDefined();
		expect(urls.icons["tool-pointer"]).toBe(
			"/tldraw-assets/icons/icon/tool-pointer.svg",
		);
		expect(urls.icons["tool-pencil"]).toBe(
			"/tldraw-assets/icons/icon/tool-pencil.svg",
		);
		expect(urls.fonts["tldraw_mono_bold"]).toContain("/tldraw-assets/fonts/");
		expect(urls.translations["en"]).toBe("/tldraw-assets/translations/en.json");
	});

	it("switches to relative paths when running under file: protocol", () => {
		const originalWindow = globalThis.window;
		try {
			// @ts-expect-error testing window mock
			globalThis.window = { location: { protocol: "file:" } };
			const urls = getTldrawOfflineAssetUrls();
			expect(urls.icons["tool-pointer"]).toBe(
				"./tldraw-assets/icons/icon/tool-pointer.svg",
			);
		} finally {
			globalThis.window = originalWindow;
		}
	});
});
